/**
 * MatrixLab — view registry and hash router.
 *
 * Views register themselves; the router renders one at a time into #view.
 * URLs look like #/calculator or #/learn/eigenvalues, so any screen can be
 * linked to or bookmarked.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;

  /** @type {Object<string, object>} */
  const views = {};
  const order = [];

  /**
   * @param {object} spec
   * @param {string} spec.id
   * @param {string} spec.title       Sidebar / topbar label.
   * @param {string} [spec.heading]   Page heading (defaults to title).
   * @param {string} [spec.tagline]   One-line description under the heading.
   * @param {boolean} [spec.ownHeading] Skip the standard heading; build() renders its own <h1>.
   * @param {string} [spec.icon]
   * @param {string} [spec.group]
   * @param {(context: {path: string[], params: URLSearchParams}) => Node} spec.build
   */
  function registerView(spec) {
    if (!spec || !spec.id || typeof spec.build !== 'function') {
      throw new Error('registerView needs an id and a build function');
    }
    views[spec.id] = spec;
    order.push(spec.id);
  }

  function getView(id) {
    return views[id] || null;
  }

  function parseHash() {
    const raw = (globalThis.location.hash || '').replace(/^#\/?/, '');
    const [pathPart, queryPart] = raw.split('?');
    const segments = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
    return {
      id: segments[0] || 'dashboard',
      path: segments.slice(1),
      params: new URLSearchParams(queryPart || ''),
    };
  }

  const router = {
    current: null,

    /** Navigate by id, e.g. navigate('calculator', ['inverse']). */
    navigate: function (id, path, params) {
      let hash = '#/' + id;
      if (path && path.length) hash += '/' + path.map(encodeURIComponent).join('/');
      if (params) {
        const query = new URLSearchParams(params).toString();
        if (query) hash += '?' + query;
      }
      if (globalThis.location.hash === hash) router.render();
      else globalThis.location.hash = hash;
    },

    /** Render whatever the current URL points at. */
    render: function () {
      const route = parseHash();
      const view = getView(route.id);
      const container = document.getElementById('view');
      if (!container) return;

      if (!view) {
        ui.clear(container);
        container.appendChild(
          el('div.view__head', [
            el('h1', 'Page not found'),
            el('p.view__lead', 'There is no section called “' + route.id + '”.'),
          ])
        );
        container.appendChild(
          ui.button('Go to the dashboard', { variant: 'primary', onClick: function () { router.navigate('dashboard'); } })
        );
        return;
      }

      router.current = view.id;
      document.title = view.title + ' — MatrixLab';
      const topbarTitle = document.getElementById('topbar-title');
      if (topbarTitle) topbarTitle.textContent = view.title;

      ui.qsa('.nav__link').forEach(function (link) {
        const isCurrent = link.dataset.view === view.id;
        if (isCurrent) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });

      ui.clear(container);
      // A view with its own hero (the dashboard) supplies its own <h1>.
      if (!view.ownHeading) {
        container.appendChild(el('div.view__head', [
          el('h1', [view.heading || view.title, view.badge ? ui.badge(view.badge, 'brand') : null]),
          view.tagline ? el('p.view__lead', view.tagline) : null,
        ]));
      }

      const body = el('div.stack-lg');
      container.appendChild(body);
      ui.safeRender(body, function () { return view.build(route); });

      globalThis.scrollTo({ top: 0, behavior: 'auto' });
      ui.announce(view.title + ' opened');
    },

    /** All registered views in declaration order. */
    all: function () {
      return order.map(function (id) { return views[id]; });
    },

    start: function () {
      globalThis.addEventListener('hashchange', router.render);
      if (!globalThis.location.hash) globalThis.location.replace('#/dashboard');
      router.render();
    },
  };

  ML.registerView = registerView;
  ML.getView = getView;
  ML.router = router;
})((globalThis.ML = globalThis.ML || {}));
