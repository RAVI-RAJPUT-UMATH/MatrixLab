/**
 * MatrixLab — application bootstrap.
 *
 * Builds the sidebar from the registered views, wires the theme and precision
 * controls, and starts the router. Loaded last so every view has registered.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;

  /** Sidebar structure. Each id must match a registered view. */
  const NAV = [
    { label: null, items: ['dashboard'] },
    { label: 'Calculator', items: ['calculator', 'analysis', 'properties', 'row-reduction', 'equations'] },
    { label: 'Linear algebra', items: ['eigen', 'decompositions', 'subspaces', 'least-squares'] },
    { label: 'Vectors', items: ['vectors', 'orthogonality'] },
    { label: 'Visualise', items: ['transformations', 'visualizations'] },
    { label: 'Learn', items: ['learn', 'examples'] },
    { label: 'Tools', items: ['generator', 'settings'] },
  ];

  /* ------------------------------------------------------------------ *
   * Theme
   * ------------------------------------------------------------------ */

  const darkQuery = typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia('(prefers-color-scheme: dark)')
    : null;

  /**
   * Controls that want to be told when the theme changes, each paired with its
   * element. Views are rebuilt on every render, so listeners are dropped once
   * their element leaves the document — otherwise every re-render would leak
   * one more closure holding a detached node.
   */
  const themeListeners = [];

  function notifyThemeListeners(mode) {
    for (let i = themeListeners.length - 1; i >= 0; i--) {
      const entry = themeListeners[i];
      if (entry.node && document.body && !document.body.contains(entry.node)) {
        themeListeners.splice(i, 1);
        continue;
      }
      entry.fn(mode);
    }
  }

  const theme = {
    /**
     * The theme in force. There are only two, light and dark. Until the reader
     * picks one, we take the system preference — so the first visit already
     * matches the rest of their desktop without anything being stored.
     *
     * @returns {'light'|'dark'}
     */
    get: function () {
      const value = ML.store.getSetting('theme', null);
      if (value === 'light' || value === 'dark') return value;
      return theme.systemPrefers();
    },

    /** Whether the reader has chosen, as opposed to inheriting the system. */
    chosen: function () {
      const value = ML.store.getSetting('theme', null);
      return value === 'light' || value === 'dark';
    },

    systemPrefers: function () {
      return darkQuery && darkQuery.matches ? 'dark' : 'light';
    },

    apply: function (mode) {
      document.documentElement.setAttribute('data-theme', mode);
      document.documentElement.style.colorScheme = mode;
      notifyThemeListeners(mode);
    },

    /** Re-sync a theme control when the theme changes. */
    onChange: function (fn, node) {
      themeListeners.push({ fn: fn, node: node || null });
    },

    set: function (mode) {
      ML.store.setSetting('theme', mode);
      theme.apply(mode);
      ui.announce(mode === 'dark' ? 'Dark theme enabled' : 'Light theme enabled');
      // Canvases read their colours from CSS, so redraw the current view. That
      // discards the button if it lives in the view, so restore focus to its
      // replacement — otherwise a keyboard user loses their place.
      const focused = document.activeElement;
      const wasInButton = !!(focused && focused.closest && focused.closest('.theme-btn'));
      if (ML.router.current) ML.router.render();
      if (wasInButton && document.body && !document.body.contains(focused)) {
        const replacement = ui.qs('#view .theme-btn') || ui.qs('.theme-btn');
        if (replacement) replacement.focus();
      }
    },

    /** Flip to the other theme. */
    toggle: function () {
      theme.set(theme.get() === 'dark' ? 'light' : 'dark');
    },

    /**
     * The theme control: one button that flips between light and dark.
     *
     * It shows the theme you would get by pressing it, which is the convention
     * readers expect from this button, and says so in words on hover and to a
     * screen reader — an icon alone cannot resolve "current or target?".
     *
     * The icons are inline SVG in currentColor rather than ☀/🌙, because emoji
     * keep their own colour whatever the theme and render at a different size
     * and baseline on every platform.
     */
    control: function () {
      return buildThemeButton();
    },
  };

  ML.theme = theme;

  /** Line-art sun and moon. Deliberately not emoji — see theme.control above. */
  function themeIcon(mode) {
    const svg = el('svg.theme-btn__icon', {
      viewBox: '0 0 24 24',
      width: '17',
      height: '17',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.8',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    });
    if (mode === 'light') {
      svg.appendChild(el('circle', { cx: '12', cy: '12', r: '4.1' }));
      [
        [12, 2.2, 12, 4.4], [12, 19.6, 12, 21.8], [2.2, 12, 4.4, 12], [19.6, 12, 21.8, 12],
        [5.1, 5.1, 6.7, 6.7], [17.3, 17.3, 18.9, 18.9], [18.9, 5.1, 17.3, 6.7], [6.7, 17.3, 5.1, 18.9],
      ].forEach(function (ray) {
        svg.appendChild(el('line', { x1: ray[0], y1: ray[1], x2: ray[2], y2: ray[3] }));
      });
    } else {
      svg.appendChild(el('path', { d: 'M20.5 14.6A8.7 8.7 0 0 1 9.4 3.5a8.8 8.8 0 1 0 11.1 11.1z' }));
    }
    return svg;
  }

  function buildThemeButton() {
    const button = el('button.theme-btn', {
      type: 'button',
      onClick: theme.toggle,
    });

    function sync() {
      const current = theme.get();
      const target = current === 'dark' ? 'light' : 'dark';
      const words = 'Switch to ' + target + ' theme';
      ui.clear(button);
      button.appendChild(themeIcon(target));
      button.setAttribute('title', words);
      button.setAttribute('aria-label', words);
      button.dataset.mode = current;
    }

    sync();
    theme.onChange(sync, button);
    return button;
  }

  // Until the reader chooses, we follow the system — including while the page
  // is open. Without this, flipping the OS theme left every canvas drawn in the
  // old colours, because they sample the CSS variables once at draw time.
  if (darkQuery && typeof darkQuery.addEventListener === 'function') {
    darkQuery.addEventListener('change', function () {
      if (theme.chosen()) return;
      theme.apply(theme.systemPrefers());
      if (ML.router.current) ML.router.render();
    });
  }

  /* ------------------------------------------------------------------ *
   * Sidebar
   * ------------------------------------------------------------------ */

  function buildNav() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    ui.clear(nav);
    NAV.forEach(function (group) {
      if (group.label) nav.appendChild(el('div.nav__group-label', group.label));
      group.items.forEach(function (id) {
        const view = ML.getView(id);
        if (!view) return; // a view that is not built yet simply does not appear
        nav.appendChild(
          el('a.nav__link', { href: '#/' + id, dataset: { view: id } }, [
            el('span.nav__icon', { 'aria-hidden': 'true' }, view.icon || '·'),
            el('span', view.title),
          ])
        );
      });
    });
  }

  /**
   * The skip link must not navigate: the app routes on the hash, so letting
   * "#view" through would be read as a route name. Move focus directly instead.
   */
  function wireSkipLink() {
    const link = document.getElementById('skip-link');
    const main = document.getElementById('view');
    if (!link || !main) return;
    link.addEventListener('click', function (event) {
      event.preventDefault();
      main.focus();
      main.scrollIntoView({ block: 'start' });
    });
  }

  function wireDrawer() {
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('scrim');
    const toggle = document.getElementById('menu-toggle');
    if (!sidebar || !toggle || !scrim) return;

    function setOpen(open) {
      sidebar.classList.toggle('is-open', open);
      scrim.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggle.addEventListener('click', function () {
      setOpen(!sidebar.classList.contains('is-open'));
    });
    scrim.addEventListener('click', function () { setOpen(false); });
    sidebar.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setOpen(false);
    });
  }

  /* ------------------------------------------------------------------ *
   * Topbar controls
   * ------------------------------------------------------------------ */

  function buildTopbarTools() {
    const host = document.getElementById('topbar-tools');
    if (!host) return;
    ui.clear(host);

    // Hidden on narrow screens, where it would crowd the title — the same
    // control lives in Settings, which stays reachable.
    host.appendChild(
      el('span.row.row--tight.hide-sm', [
        el('span.small.muted', 'Decimals'),
        ui.segmented({
          label: 'Decimal places',
          value: String(ML.config.decimals),
          options: [
            { value: '2', label: '2' },
            { value: '4', label: '4' },
            { value: '6', label: '6' },
            { value: '8', label: '8' },
          ],
          onChange: function (value) {
            ML.store.setSetting('decimals', Number(value));
            ML.setConfig({ decimals: Number(value) });
          },
        }),
      ])
    );

    host.appendChild(theme.control());
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function restoreSettings() {
    theme.apply(theme.get());
    const decimals = Number(ML.store.getSetting('decimals', 4));
    const format = ML.store.getSetting('format', 'auto');
    ML.config.decimals = [2, 4, 6, 8].indexOf(decimals) >= 0 ? decimals : 4;
    ML.config.format = ['auto', 'fraction', 'decimal'].indexOf(format) >= 0 ? format : 'auto';
  }

  function boot() {
    restoreSettings();
    buildNav();
    buildTopbarTools();
    wireDrawer();
    wireSkipLink();

    // Any change to precision or number format re-renders the current view so
    // every number on screen agrees with the settings.
    ML.onConfigChange(function () {
      buildTopbarTools();
      if (ML.router.current) ML.router.render();
    });

    ML.router.start();

    const year = document.getElementById('footer-year');
    if (year) year.textContent = String(new Date().getFullYear());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})((globalThis.ML = globalThis.ML || {}));
