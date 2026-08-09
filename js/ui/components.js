/**
 * MatrixLab — reusable UI blocks.
 *
 * The important one is resultBlock(): the Result / Steps / Explanation panel
 * that every calculation in the app presents its answer through, so the three
 * questions "what is this, how is it calculated, what is the result" are always
 * answered in the same place.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;

  let uid = 0;
  function nextId(prefix) {
    uid += 1;
    return (prefix || 'ml') + '-' + uid;
  }

  /* ------------------------------------------------------------------ *
   * Containers
   * ------------------------------------------------------------------ */

  /**
   * @param {object} spec {title, subtitle, actions, body, className, headingLevel}
   */
  function card(spec) {
    const options = spec || {};
    const head =
      options.title || options.actions
        ? el('div.card__head', [
            options.title ? el('h' + (options.headingLevel || 2), options.title) : null,
            options.subtitle ? el('span.small.muted', options.subtitle) : null,
            options.actions ? el('div.row.row--tight', options.actions) : null,
          ])
        : null;
    return el('section.card' + (options.className ? '.' + options.className.split(' ').join('.') : ''), { id: options.id }, [
      head,
      options.body ? el('div.card__body' + (options.tight ? '.card__body--tight' : ''), options.body) : null,
      options.foot ? el('div.card__foot', options.foot) : null,
    ]);
  }

  function sectionLabel(text, extra) {
    return el('div.section-title', [text, extra]);
  }

  function emptyState(text) {
    return el('div.empty', text);
  }

  /* ------------------------------------------------------------------ *
   * Messages
   * ------------------------------------------------------------------ */

  const ALERT_ICONS = { info: 'ℹ', ok: '✓', warn: '!', error: '✕' };

  /**
   * @param {'info'|'ok'|'warn'|'error'} kind
   * @param {string|Node|Array} body
   * @param {string} [title]
   */
  function alert(kind, body, title) {
    return el('div.alert.alert--' + kind, { role: kind === 'error' ? 'alert' : 'status' }, [
      el('span.alert__icon', { 'aria-hidden': 'true' }, ALERT_ICONS[kind] || 'ℹ'),
      el('div.alert__body', [title ? el('strong', title + ' ') : null, body]),
    ]);
  }

  /** Render an error (usually an MLError) as a friendly panel. */
  function errorPanel(error) {
    const message = error && error.message ? error.message : 'Something went wrong.';
    const hint = error && error.details && error.details.hint ? error.details.hint : null;
    const isML = error && error.name === 'MLError';
    return el('div.alert.alert--error', { role: 'alert' }, [
      el('span.alert__icon', { 'aria-hidden': 'true' }, '✕'),
      el('div.alert__body', [
        el('div', message),
        hint ? el('div.small', { style: { marginTop: '4px', opacity: '0.85' } }, hint) : null,
        !isML && error && error.stack
          ? el('details', { style: { marginTop: '6px' } }, [
              el('summary.tiny', 'Technical details'),
              el('pre.tiny.mono', { style: { whiteSpace: 'pre-wrap', margin: '4px 0 0' } }, String(error.stack)),
            ])
          : null,
      ]),
    ]);
  }

  /**
   * Run a builder, rendering its result into `container`. Any MLError becomes a
   * friendly panel instead of a blank screen or a console-only failure.
   * @param {HTMLElement} container
   * @param {() => (Node|Array|null)} build
   */
  function safeRender(container, build) {
    ui.clear(container);
    try {
      const result = build();
      if (result) ui.append(container, result);
      return true;
    } catch (error) {
      container.appendChild(errorPanel(error));
      if (!(error && error.name === 'MLError') && typeof console !== 'undefined') {
        console.error(error);
      }
      return false;
    }
  }

  /* ------------------------------------------------------------------ *
   * Readouts
   * ------------------------------------------------------------------ */

  /** @param {Array<{label:string, value:*, note?:string, node?:Node}>} items */
  function kpis(items) {
    return el(
      'div.kpis',
      items.filter(Boolean).map(function (item) {
        return el('div.kpi', [
          el('div.kpi__label', item.label),
          el('div.kpi__value', [item.node ? item.node : ui.renderValue(item.value)]),
          item.note ? el('div.kpi__note', item.note) : null,
        ]);
      })
    );
  }

  /** @param {Array<{name:string, value:boolean, why?:string}>} items */
  function propGrid(items) {
    return el(
      'div.prop-grid',
      items.filter(Boolean).map(function (item) {
        return el('div.prop' + (item.value ? '.is-yes' : ''), [
          el('span.prop__mark', { 'aria-hidden': 'true' }, item.value ? '✓' : '✕'),
          el('span.prop__name', [
            item.name,
            el('span.sr-only', item.value ? ': yes' : ': no'),
            item.why ? el('span.prop__why', item.why) : null,
          ]),
        ]);
      })
    );
  }

  /** @param {Array<[string, *]>} pairs */
  function readout(pairs) {
    const list = el('dl.readout');
    pairs.filter(Boolean).forEach(function (pair) {
      list.appendChild(el('dt', pair[0]));
      list.appendChild(el('dd', [pair[1] instanceof Node ? pair[1] : ui.renderValue(pair[1])]));
    });
    return list;
  }

  function badge(text, kind) {
    return el('span.badge' + (kind ? '.badge--' + kind : ''), text);
  }

  function table(headers, rows) {
    return el('div.table-wrap', [
      el('table.table', [
        el('thead', [el('tr', headers.map(function (h) { return el('th', h); }))]),
        el(
          'tbody',
          rows.map(function (row) {
            return el(
              'tr',
              row.map(function (cell) {
                return el('td' + (cell && cell.num ? '.num' : ''), [
                  cell instanceof Node ? cell : cell && cell.node ? cell.node : String(cell == null ? '' : cell.text != null ? cell.text : cell),
                ]);
              })
            );
          })
        ),
      ]),
    ]);
  }

  /* ------------------------------------------------------------------ *
   * Tabs
   * ------------------------------------------------------------------ */

  /**
   * Accessible tab set. Panels are built lazily the first time they are shown.
   * @param {Array<{id:string, label:string, build:() => Node}>} items
   * @param {object} [options] {initial: string, onChange: fn}
   */
  function tabs(items, options) {
    const opts = options || {};
    const list = el('div.tabs', { role: 'tablist' });
    const panels = el('div');
    const built = {};
    const buttons = [];
    const group = nextId('tabs');

    function select(index, focus) {
      items.forEach(function (item, i) {
        const isActive = i === index;
        buttons[i].setAttribute('aria-selected', isActive ? 'true' : 'false');
        buttons[i].tabIndex = isActive ? 0 : -1;
        const panel = panels.children[i];
        panel.hidden = !isActive;
        // Panels build lazily. With `rebuild`, they also refresh every time
        // they are selected, so a panel that depends on live input is current.
        if (isActive && (!built[i] || opts.rebuild)) {
          built[i] = true;
          safeRender(panel, item.build);
        }
      });
      if (focus) buttons[index].focus();
      if (opts.onChange) opts.onChange(items[index], index);
    }

    items.forEach(function (item, i) {
      const panelId = group + '-panel-' + i;
      const tabId = group + '-tab-' + i;
      const button = el('button.tab', {
        type: 'button',
        role: 'tab',
        id: tabId,
        'aria-controls': panelId,
        'aria-selected': 'false',
        tabIndex: -1,
        text: item.label,
        onClick: function () { select(i, false); },
        onKeydown: function (event) {
          const key = event.key;
          let next = null;
          if (key === 'ArrowRight') next = (i + 1) % items.length;
          else if (key === 'ArrowLeft') next = (i - 1 + items.length) % items.length;
          else if (key === 'Home') next = 0;
          else if (key === 'End') next = items.length - 1;
          if (next != null) {
            event.preventDefault();
            select(next, true);
          }
        },
      });
      buttons.push(button);
      list.appendChild(button);
      panels.appendChild(el('div.tabpanel', { role: 'tabpanel', id: panelId, 'aria-labelledby': tabId, hidden: true }));
    });

    let initialIndex = 0;
    if (opts.initial) {
      const found = items.findIndex(function (item) { return item.id === opts.initial; });
      if (found >= 0) initialIndex = found;
    }
    select(initialIndex, false);

    const wrapper = el('div.card', [list, panels]);
    wrapper.mlSelect = select;
    return wrapper;
  }

  /**
   * The standard Result / Steps / Explanation panel.
   *
   * @param {object} spec
   * @param {string} [spec.title]
   * @param {Node|Array} spec.result       The answer, already rendered.
   * @param {ML.StepLog} [spec.steps]      Steps recorded by the algorithm.
   * @param {Node|string|Array} [spec.explanation] What the result means.
   * @param {string} [spec.formula]        The formula being applied.
   */
  function resultBlock(spec) {
    const items = [
      {
        id: 'result',
        label: 'Result',
        build: function () {
          return el('div.stack', [
            spec.formula ? el('div.formula', spec.formula) : null,
            spec.result instanceof Node || Array.isArray(spec.result) ? spec.result : el('div', String(spec.result)),
          ]);
        },
      },
    ];
    if (spec.steps && !spec.steps.isEmpty()) {
      items.push({
        id: 'steps',
        label: 'Show Steps',
        build: function () {
          return el('div.stack', [
            spec.steps.title ? el('h3', spec.steps.title) : null,
            ui.renderSteps(spec.steps),
          ]);
        },
      });
    }
    if (spec.explanation) {
      items.push({
        id: 'explanation',
        label: 'Explanation',
        build: function () {
          return el('div.lesson', spec.explanation instanceof Node || Array.isArray(spec.explanation)
            ? spec.explanation
            : el('p', spec.explanation));
        },
      });
    }
    const node = tabs(items, { initial: spec.initial });
    if (spec.title) node.insertBefore(el('div.card__head', [el('h2', spec.title)]), node.firstChild);
    return node;
  }

  /* ------------------------------------------------------------------ *
   * Controls
   * ------------------------------------------------------------------ */

  function field(labelText, control, hint) {
    const id = control.id || nextId('field');
    control.id = id;
    return el('div.field', [
      el('label.label', { for: id }, labelText),
      control,
      hint ? el('span.tiny.muted', hint) : null,
    ]);
  }

  /**
   * @param {object} spec {label, options: [{value,label}], value, onChange, id}
   */
  function select(spec) {
    const node = el('select.select', {
      id: spec.id,
      'aria-label': spec.ariaLabel || spec.label,
      onChange: function (event) { if (spec.onChange) spec.onChange(event.target.value); },
    });
    spec.options.forEach(function (option) {
      node.appendChild(
        el('option', { value: option.value, selected: String(option.value) === String(spec.value) }, option.label)
      );
    });
    if (spec.label) return field(spec.label, node, spec.hint);
    return node;
  }

  /** Number field that reports its value on input. */
  function numberInput(spec) {
    const node = el('input.input.input--num', {
      type: 'text',
      inputmode: spec.inputmode || 'decimal',
      value: spec.value == null ? '' : String(spec.value),
      placeholder: spec.placeholder || '',
      'aria-label': spec.ariaLabel || spec.label,
      autocomplete: 'off',
      spellcheck: 'false',
      onInput: function (event) { if (spec.onInput) spec.onInput(event.target.value, event); },
      onKeydown: function (event) {
        if (event.key === 'Enter' && spec.onEnter) spec.onEnter(event.target.value);
      },
    });
    if (spec.label) return field(spec.label, node, spec.hint);
    return node;
  }

  /** −/+ stepper for small integers such as matrix dimensions. */
  function stepper(spec) {
    const state = { value: spec.value };
    const output = el('output', { text: String(state.value), 'aria-live': 'off' });
    const minus = el('button', {
      type: 'button',
      'aria-label': 'Decrease ' + (spec.label || 'value'),
      text: '−',
      onClick: function () { set(state.value - 1); },
    });
    const plus = el('button', {
      type: 'button',
      'aria-label': 'Increase ' + (spec.label || 'value'),
      text: '+',
      onClick: function () { set(state.value + 1); },
    });

    function set(next) {
      const clamped = Math.max(spec.min, Math.min(spec.max, next));
      if (clamped === state.value) return;
      state.value = clamped;
      output.textContent = String(clamped);
      minus.disabled = clamped <= spec.min;
      plus.disabled = clamped >= spec.max;
      if (spec.onChange) spec.onChange(clamped);
    }

    minus.disabled = state.value <= spec.min;
    plus.disabled = state.value >= spec.max;

    const node = el('span.stepper', { role: 'group', 'aria-label': spec.label }, [minus, output, plus]);
    node.mlSet = set;
    node.mlValue = function () { return state.value; };
    return node;
  }

  function button(label, spec) {
    const options = spec || {};
    return el('button.btn' + (options.variant ? '.btn--' + options.variant : '') + (options.size ? '.btn--' + options.size : ''), {
      type: 'button',
      text: label,
      title: options.title,
      'aria-label': options.ariaLabel,
      disabled: options.disabled,
      onClick: options.onClick,
    });
  }

  /** Segmented control: one active option out of several. */
  function segmented(spec) {
    const group = el('div.btn-group', { role: 'group', 'aria-label': spec.label });
    const buttons = spec.options.map(function (option) {
      const node = el('button.btn.btn--sm', {
        type: 'button',
        text: option.label,
        title: option.title,
        'aria-pressed': String(option.value) === String(spec.value) ? 'true' : 'false',
        onClick: function () {
          buttons.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
          node.setAttribute('aria-pressed', 'true');
          if (spec.onChange) spec.onChange(option.value);
        },
      });
      group.appendChild(node);
      return node;
    });
    return group;
  }

  function disclosure(title, bodyBuilder, options) {
    const opts = options || {};
    const body = el('div.disclosure__body');
    let built = false;
    const node = el('details.disclosure', { open: opts.open }, [el('summary', title), body]);
    function build() {
      if (built) return;
      built = true;
      safeRender(body, bodyBuilder);
    }
    if (opts.open) build();
    node.addEventListener('toggle', function () { if (node.open) build(); });
    return node;
  }

  /** Copy-to-clipboard button for a result (plain-text matrix layout). */
  function copyButton(getText, label) {
    return button(label || 'Copy', {
      variant: 'ghost',
      size: 'sm',
      onClick: function (event) {
        const text = getText();
        const done = function () {
          const original = event.target.textContent;
          event.target.textContent = 'Copied';
          setTimeout(function () { event.target.textContent = original; }, 1200);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
        } else {
          fallbackCopy(text, done);
        }
      },
    });
  }

  function fallbackCopy(text, done) {
    const area = el('textarea', { value: text, style: { position: 'fixed', opacity: '0' } });
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      done();
    } catch (err) {
      /* clipboard unavailable — nothing else we can do */
    }
    document.body.removeChild(area);
  }

  /** Plain-text form of a matrix, for the clipboard. */
  function matrixToText(matrix) {
    const cells = matrix.data.map(function (row) { return row.map(function (v) { return ML.fmt(v); }); });
    const widths = [];
    for (let j = 0; j < matrix.cols; j++) {
      widths[j] = Math.max.apply(null, cells.map(function (row) { return row[j].length; }));
    }
    return cells
      .map(function (row) {
        return '[ ' + row.map(function (cell, j) { return cell.padStart(widths[j]); }).join('  ') + ' ]';
      })
      .join('\n');
  }

  Object.assign(ui, {
    nextId: nextId,
    card: card,
    sectionLabel: sectionLabel,
    emptyState: emptyState,
    alert: alert,
    errorPanel: errorPanel,
    safeRender: safeRender,
    kpis: kpis,
    propGrid: propGrid,
    readout: readout,
    badge: badge,
    table: table,
    tabs: tabs,
    resultBlock: resultBlock,
    field: field,
    select: select,
    numberInput: numberInput,
    stepper: stepper,
    button: button,
    segmented: segmented,
    disclosure: disclosure,
    copyButton: copyButton,
    matrixToText: matrixToText,
  });
})((globalThis.ML = globalThis.ML || {}));
