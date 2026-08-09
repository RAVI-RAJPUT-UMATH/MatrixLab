/**
 * MatrixLab — small DOM helpers.
 *
 * No framework: just enough sugar to build elements declaratively so view
 * code stays readable. Everything mathematical lives in js/math; this file and
 * its siblings never compute anything.
 */
(function (ML) {
  'use strict';

  const ui = (ML.ui = ML.ui || {});

  const SVG_TAGS = { svg: 1, path: 1, circle: 1, line: 1, g: 1, rect: 1, text: 1, polygon: 1, polyline: 1 };

  /**
   * Create an element.
   *
   *   el('div.card', { id: 'x' }, [el('h2', 'Title'), 'text'])
   *
   * The tag accepts a CSS-ish shorthand: 'button.btn.btn--primary'.
   * Attributes: text, html, className/class, dataset, style (object), any
   * plain or aria- attribute, and on<Event> handlers (onClick, onInput, …).
   *
   * @param {string} spec
   * @param {object|string|Node|Array} [attrs]
   * @param {string|Node|Array} [children]
   * @returns {HTMLElement}
   */
  function el(spec, attrs, children) {
    const parts = String(spec).split('.');
    const tag = parts.shift() || 'div';
    const node = SVG_TAGS[tag]
      ? document.createElementNS('http://www.w3.org/2000/svg', tag)
      : document.createElement(tag);
    if (parts.length) node.setAttribute('class', parts.join(' '));

    // Allow el('p', 'some text') and el('div', [child, child]).
    if (attrs != null && (typeof attrs === 'string' || attrs instanceof Node || Array.isArray(attrs))) {
      children = attrs;
      attrs = null;
    }

    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        const value = attrs[key];
        if (value == null || value === false) return;
        if (key === 'text') {
          node.textContent = String(value);
        } else if (key === 'html') {
          node.innerHTML = value;
        } else if (key === 'className' || key === 'class') {
          const existing = node.getAttribute('class');
          node.setAttribute('class', existing ? existing + ' ' + value : String(value));
        } else if (key === 'dataset') {
          Object.keys(value).forEach(function (dk) {
            if (value[dk] != null) node.dataset[dk] = value[dk];
          });
        } else if (key === 'style' && typeof value === 'object') {
          Object.keys(value).forEach(function (sk) { node.style[sk] = value[sk]; });
        } else if (key.length > 2 && key.slice(0, 2) === 'on' && typeof value === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (value === true) {
          node.setAttribute(key, '');
        } else {
          node.setAttribute(key, String(value));
        }
      });
    }

    append(node, children);
    return node;
  }

  /** Append a string / Node / nested array, skipping null and false. */
  function append(parent, children) {
    if (children == null || children === false) return parent;
    if (Array.isArray(children)) {
      children.forEach(function (child) { append(parent, child); });
      return parent;
    }
    parent.appendChild(children instanceof Node ? children : document.createTextNode(String(children)));
    return parent;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function frag(children) {
    return append(document.createDocumentFragment(), children);
  }

  function qs(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function qsa(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  /** Read a CSS custom property (lets canvas drawing follow the theme). */
  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback || '';
  }

  /** Debounce for live inputs (sliders, matrix cells driving a canvas). */
  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      const self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, wait == null ? 120 : wait);
    };
  }

  /** Announce a message to screen readers via the shared live region. */
  function announce(message) {
    const region = document.getElementById('live-region');
    if (!region) return;
    region.textContent = '';
    // A tick later so repeated identical messages are still read out.
    setTimeout(function () { region.textContent = message; }, 30);
  }

  ui.el = el;
  ui.append = append;
  ui.clear = clear;
  ui.frag = frag;
  ui.qs = qs;
  ui.qsa = qsa;
  ui.cssVar = cssVar;
  ui.debounce = debounce;
  ui.announce = announce;
})((globalThis.ML = globalThis.ML || {}));
