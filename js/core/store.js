/**
 * MatrixLab — shared workspace.
 *
 * Matrices you type persist across views and across reloads, so loading an
 * example in one place and studying it in another is one click rather than
 * retyping. Storage is localStorage; if it is unavailable (private mode, file
 * restrictions) everything still works, just without persistence.
 */
(function (ML) {
  'use strict';

  const KEY = 'matrixlab.workspace.v1';
  const available = (function () {
    try {
      const probe = '__ml_probe__';
      globalThis.localStorage.setItem(probe, '1');
      globalThis.localStorage.removeItem(probe);
      return true;
    } catch (error) {
      return false;
    }
  })();

  let state = { matrices: {}, settings: {} };

  function load() {
    if (!available) return;
    try {
      const raw = globalThis.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          state.matrices = parsed.matrices || {};
          state.settings = parsed.settings || {};
        }
      }
    } catch (error) {
      state = { matrices: {}, settings: {} };
    }
  }

  const save = function () {
    if (!available) return;
    try {
      globalThis.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (error) {
      /* quota or private mode — persistence is optional */
    }
  };

  load();

  /**
   * Starting contents for the shared slots. A first-time visitor should land on
   * a working calculation rather than a grid of zeros.
   */
  const DEFAULTS = {
    A: [['1', '2'], ['3', '4']],
    B: [['0', '1'], ['1', '0']],
    b: [['5'], ['6']],
  };

  const store = {
    available: available,

    /**
     * Remembered matrix as a grid of strings, or null.
     * @param {string} slot e.g. 'A', 'B', 'system'
     * @returns {string[][]|null}
     */
    getValues: function (slot) {
      const entry = state.matrices[slot];
      if (!entry || !Array.isArray(entry) || !entry.length || !Array.isArray(entry[0])) return null;
      return entry;
    },

    /** Remembered values, falling back to a sensible starting matrix. */
    getValuesOrDefault: function (slot, fallback) {
      const stored = store.getValues(slot);
      if (stored) return stored;
      const preset = fallback || DEFAULTS[slot];
      return preset ? preset.map(function (row) { return row.slice(); }) : null;
    },

    /** Remembered matrix as a Matrix, or null when absent/unreadable. */
    getMatrix: function (slot) {
      const values = store.getValues(slot);
      if (!values) return null;
      try {
        return ML.Matrix.from(values);
      } catch (error) {
        return null;
      }
    },

    setValues: function (slot, values) {
      state.matrices[slot] = values.map(function (row) { return row.map(String); });
      save();
    },

    setMatrix: function (slot, matrix) {
      store.setValues(
        slot,
        matrix.data.map(function (row) { return row.map(function (v) { return v.toString(); }); })
      );
    },

    /** Remember a MatrixInput's current contents (called on change). */
    bind: function (slot, input) {
      const previous = input.onChange;
      input.onChange = function (self) {
        store.setValues(slot, self.values);
        if (previous) previous(self);
      };
      return input;
    },

    getSetting: function (key, fallback) {
      return Object.prototype.hasOwnProperty.call(state.settings, key) ? state.settings[key] : fallback;
    },

    setSetting: function (key, value) {
      state.settings[key] = value;
      save();
    },

    clear: function () {
      state = { matrices: {}, settings: {} };
      save();
    },
  };

  ML.store = store;
})((globalThis.ML = globalThis.ML || {}));
