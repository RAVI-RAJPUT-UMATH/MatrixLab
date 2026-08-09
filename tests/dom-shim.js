/**
 * MatrixLab — minimal DOM shim for headless smoke tests.
 *
 * This exists only so `node tests/run-views.js` can build every view and click
 * every tab without a browser, catching real runtime errors in the UI layer.
 * It is a test tool: the application itself uses the browser's real DOM.
 */
'use strict';

/* ------------------------------------------------------------------ *
 * Selector matching (tag, #id, .class, [attr], [attr=value])
 * ------------------------------------------------------------------ */

function parseSimple(selector) {
  const spec = { tag: null, id: null, classes: [], attrs: [] };
  const pattern = /([#.]?[\w-]+|\[[^\]]+\])/g;
  let match;
  while ((match = pattern.exec(selector))) {
    const token = match[1];
    if (token[0] === '#') spec.id = token.slice(1);
    else if (token[0] === '.') spec.classes.push(token.slice(1));
    else if (token[0] === '[') {
      const body = token.slice(1, -1);
      const eq = body.indexOf('=');
      if (eq < 0) spec.attrs.push([body, null]);
      else spec.attrs.push([body.slice(0, eq), body.slice(eq + 1).replace(/^["']|["']$/g, '')]);
    } else spec.tag = token.toLowerCase();
  }
  return spec;
}

function matchesSimple(node, spec) {
  if (node.nodeType !== 1) return false;
  if (spec.tag && node.tagName.toLowerCase() !== spec.tag) return false;
  if (spec.id && node.id !== spec.id) return false;
  for (const cls of spec.classes) if (!node.classList.contains(cls)) return false;
  for (const [name, value] of spec.attrs) {
    if (!node.hasAttribute(name)) return false;
    if (value !== null && node.getAttribute(name) !== value) return false;
  }
  return true;
}

/** Supports comma lists and descendant combinators (space), which is all we use. */
function matches(node, selector) {
  return selector.split(',').some(function (part) {
    const chain = part.trim().split(/\s+/).map(parseSimple);
    if (!matchesSimple(node, chain[chain.length - 1])) return false;
    let ancestor = node.parentNode;
    for (let i = chain.length - 2; i >= 0; i--) {
      let found = false;
      while (ancestor) {
        if (matchesSimple(ancestor, chain[i])) {
          found = true;
          ancestor = ancestor.parentNode;
          break;
        }
        ancestor = ancestor.parentNode;
      }
      if (!found) return false;
    }
    return true;
  });
}

/* ------------------------------------------------------------------ *
 * Nodes
 * ------------------------------------------------------------------ */

class Node2 {
  constructor() {
    this.childNodes = [];
    this.parentNode = null;
  }
  get firstChild() {
    return this.childNodes[0] || null;
  }
  get children() {
    return this.childNodes.filter(function (child) { return child.nodeType === 1; });
  }
  appendChild(child) {
    if (child instanceof Fragment) {
      child.childNodes.slice().forEach((sub) => this.appendChild(sub));
      child.childNodes = [];
      return child;
    }
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  /** True for the node itself and any descendant, as in a real DOM. */
  contains(node) {
    let current = node;
    while (current) {
      if (current === this) return true;
      current = current.parentNode;
    }
    return false;
  }
  insertBefore(child, ref) {
    const index = ref ? this.childNodes.indexOf(ref) : -1;
    if (index < 0) return this.appendChild(child);
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.splice(index, 0, child);
    return child;
  }
  removeChild(child) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }
  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }
  get textContent() {
    return this.childNodes.map(function (child) { return child.textContent; }).join('');
  }
  set textContent(value) {
    this.childNodes = [];
    if (value !== '' && value != null) this.appendChild(new Text2(String(value)));
  }
  /** Depth-first walk, used by the query helpers. */
  walk(visit) {
    for (const child of this.childNodes) {
      if (child.nodeType === 1) {
        visit(child);
        child.walk(visit);
      }
    }
  }
  querySelector(selector) {
    let hit = null;
    this.walk(function (node) {
      if (!hit && matches(node, selector)) hit = node;
    });
    return hit;
  }
  querySelectorAll(selector) {
    const out = [];
    this.walk(function (node) {
      if (matches(node, selector)) out.push(node);
    });
    return out;
  }
}

class Text2 extends Node2 {
  constructor(text) {
    super();
    this.nodeType = 3;
    this.data = String(text);
  }
  get textContent() {
    return this.data;
  }
  set textContent(value) {
    this.data = String(value);
  }
}

class Fragment extends Node2 {
  constructor() {
    super();
    this.nodeType = 11;
  }
}

class ClassList {
  constructor(owner) {
    this.owner = owner;
  }
  _list() {
    return (this.owner.getAttribute('class') || '').split(/\s+/).filter(Boolean);
  }
  _write(list) {
    this.owner.setAttribute('class', list.join(' '));
  }
  contains(name) {
    return this._list().indexOf(name) >= 0;
  }
  add(name) {
    const list = this._list();
    if (list.indexOf(name) < 0) list.push(name);
    this._write(list);
  }
  remove(name) {
    this._write(this._list().filter(function (n) { return n !== name; }));
  }
  toggle(name, force) {
    const has = this.contains(name);
    const want = force === undefined ? !has : !!force;
    if (want) this.add(name);
    else this.remove(name);
    return want;
  }
}

/** camelCase → dash-case, for dataset ↔ data-* attribute reflection. */
function dashCase(key) {
  return key.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); });
}

class Element2 extends Node2 {
  constructor(tagName) {
    super();
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.attributes = Object.create(null);
    // Custom properties go through setProperty/getPropertyValue, not the
    // camelCase accessors, so the shim needs both routes onto one store.
    const styleStore = {
      setProperty(name, value) { styleStore[name] = String(value); },
      getPropertyValue(name) { return styleStore[name] || ''; },
      removeProperty(name) { delete styleStore[name]; },
    };
    this.style = new Proxy(styleStore, {
      get: (t, k) => (typeof t[k] === 'function' ? t[k] : t[k] || ''),
      set: (t, k, v) => ((t[k] = v), true),
    });
    // dataset must reflect to data-* attributes, as it does in a real DOM.
    const self = this;
    this.dataset = new Proxy(
      {},
      {
        get: (target, key) => {
          const value = self.getAttribute('data-' + dashCase(String(key)));
          return value === null ? undefined : value;
        },
        set: (target, key, value) => {
          self.setAttribute('data-' + dashCase(String(key)), value);
          return true;
        },
        has: (target, key) => self.hasAttribute('data-' + dashCase(String(key))),
        deleteProperty: (target, key) => {
          self.removeAttribute('data-' + dashCase(String(key)));
          return true;
        },
      }
    );
    this.classList = new ClassList(this);
    this.listeners = Object.create(null);
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.tabIndex = 0;
    this.open = false;
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this._innerHTML = '';
    if (this.tagName === 'CANVAS') {
      this.width = 600;
      this.height = 400;
      this.getContext = function () { return makeContext2D(); };
      this.getBoundingClientRect = function () { return { left: 0, top: 0, width: 600, height: 400 }; };
    }
  }
  get id() {
    return this.getAttribute('id') || '';
  }
  set id(value) {
    this.setAttribute('id', value);
  }
  get className() {
    return this.getAttribute('class') || '';
  }
  set className(value) {
    this.setAttribute('class', value);
  }
  get innerHTML() {
    return this._innerHTML;
  }
  set innerHTML(value) {
    this._innerHTML = String(value);
    this.childNodes = [];
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    // Reflect the attributes that browsers mirror onto properties, so code
    // that writes el('input', {value: x}) then reads node.value behaves the
    // same here as in a browser.
    if (name === 'value') this.value = String(value);
    else if (name === 'hidden') this.hidden = true;
    else if (name === 'disabled') this.disabled = true;
    else if (name === 'open') this.open = true;
    else if (name === 'tabindex') this.tabIndex = Number(value) || 0;
    else if (name === 'selected') this.selected = true;
    else if (name === 'checked') this.checked = true;
  }
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }
  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
  }
  removeAttribute(name) {
    delete this.attributes[name];
  }
  addEventListener(type, fn) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
  }
  removeEventListener(type, fn) {
    if (this.listeners[type]) this.listeners[type] = this.listeners[type].filter((f) => f !== fn);
  }
  /** Fire a synthetic event; used by the smoke test to click things. */
  dispatch(type, event) {
    const payload = Object.assign({ type: type, target: this, preventDefault() {}, stopPropagation() {} }, event || {});
    (this.listeners[type] || []).slice().forEach((fn) => fn.call(this, payload));
    return payload;
  }
  click() {
    return this.dispatch('click');
  }
  focus() {
    globalThis.document.activeElement = this;
  }
  blur() {}
  select() {}
  closest(selector) {
    let node = this;
    while (node && node.nodeType === 1) {
      if (matches(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 600, height: 400 };
  }
  scrollIntoView() {}
}

/** Canvas 2D context stub: every call is a no-op, so drawing code is exercised. */
function makeContext2D() {
  const noop = function () {};
  const context = {
    canvas: { width: 600, height: 400 },
    save: noop, restore: noop, scale: noop, translate: noop, rotate: noop, setTransform: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, rect: noop, ellipse: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop, clearRect: noop, clip: noop,
    fillText: noop, strokeText: noop, setLineDash: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
    createLinearGradient: function () { return { addColorStop: noop }; },
    measureText: function (text) { return { width: String(text).length * 6 }; },
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
  };
  return context;
}

/* ------------------------------------------------------------------ *
 * document / window
 * ------------------------------------------------------------------ */

function install() {
  const document = {
    nodeType: 9,
    readyState: 'complete',
    activeElement: null,
    listeners: Object.create(null),
    createElement(tag) {
      return new Element2(tag);
    },
    createElementNS(ns, tag) {
      return new Element2(tag);
    },
    createTextNode(text) {
      return new Text2(text);
    },
    createDocumentFragment() {
      return new Fragment();
    },
    getElementById(id) {
      return document.documentElement.querySelector('#' + id);
    },
    querySelector(selector) {
      return document.documentElement.querySelector(selector);
    },
    querySelectorAll(selector) {
      return document.documentElement.querySelectorAll(selector);
    },
    addEventListener(type, fn) {
      (document.listeners[type] = document.listeners[type] || []).push(fn);
    },
    dispatch(type, event) {
      (document.listeners[type] || []).forEach((fn) => fn(Object.assign({ type }, event || {})));
    },
    execCommand() {
      return true;
    },
    title: '',
  };

  document.documentElement = new Element2('html');
  document.body = new Element2('body');
  document.head = new Element2('head');
  document.documentElement.appendChild(document.head);
  document.documentElement.appendChild(document.body);

  const listeners = Object.create(null);
  const location = {
    _hash: '',
    get hash() {
      return this._hash;
    },
    set hash(value) {
      const next = value.startsWith('#') ? value : '#' + value;
      if (next === this._hash) return;
      this._hash = next;
      (listeners.hashchange || []).forEach((fn) => fn({ type: 'hashchange' }));
    },
    replace(value) {
      this._hash = value.startsWith('#') ? value : '#' + value;
    },
    href: 'file:///matrixlab/index.html',
  };

  const memory = new Map();

  // Some globals (navigator) are getter-only in modern Node, so define rather
  // than assign.
  const define = function (values) {
    Object.keys(values).forEach(function (key) {
      Object.defineProperty(globalThis, key, {
        value: values[key],
        writable: true,
        configurable: true,
        enumerable: true,
      });
    });
  };

  define({
    window: globalThis,
    document: document,
    Node: Node2,
    Element: Element2,
    Text: Text2,
    HTMLElement: Element2,
    location: location,
    navigator: { userAgent: 'node-shim', clipboard: null },
    devicePixelRatio: 2,
    localStorage: {
      getItem: (k) => (memory.has(k) ? memory.get(k) : null),
      setItem: (k, v) => memory.set(k, String(v)),
      removeItem: (k) => memory.delete(k),
      clear: () => memory.clear(),
    },
    getComputedStyle() {
      return {
        getPropertyValue(name) {
          // Plausible values so canvas code gets usable colours/sizes.
          if (name.indexOf('color') >= 0 || name.indexOf('--viz') === 0) return '#7788aa';
          return '';
        },
      };
    },
    requestAnimationFrame(fn) {
      return setTimeout(() => fn(Date.now()), 0);
    },
    cancelAnimationFrame(id) {
      clearTimeout(id);
    },
    matchMedia() {
      return { matches: false, addEventListener() {}, addListener() {} };
    },
    scrollTo() {},
    alert() {},
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      if (listeners[type]) listeners[type] = listeners[type].filter((f) => f !== fn);
    },
  });

  return { document, location, listeners };
}

module.exports = { install, matches, Element2, Node2 };
