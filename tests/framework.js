/**
 * MatrixLab — tiny test framework.
 *
 * Zero dependencies, runs identically in a browser (tests/index.html) and in
 * Node (tests/run-node.js). Assertions compare exact rationals exactly and
 * floats with an explicit tolerance, so a "pass" really means the mathematics
 * is right rather than approximately plausible.
 */
(function (root) {
  'use strict';

  const suites = [];

  function describeValue(value) {
    const ML = root.ML;
    if (ML && ML.Matrix && ML.Matrix.isMatrix(value)) {
      return '\n' + value.toString() + '\n';
    }
    if (ML && ML.Frac && value instanceof ML.Frac) return value.toString();
    if (Array.isArray(value)) return JSON.stringify(value);
    if (value && typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (err) {
        return String(value);
      }
    }
    return String(value);
  }

  function Asserter(record) {
    this._record = record;
  }

  Asserter.prototype._pass = function (message) {
    this._record({ ok: true, message: message });
  };

  Asserter.prototype._fail = function (message, detail) {
    this._record({ ok: false, message: message, detail: detail });
  };

  /** Truthiness. */
  Asserter.prototype.ok = function (condition, message) {
    if (condition) this._pass(message);
    else this._fail(message, 'expected a truthy value, received ' + describeValue(condition));
  };

  Asserter.prototype.notOk = function (condition, message) {
    if (!condition) this._pass(message);
    else this._fail(message, 'expected a falsy value, received ' + describeValue(condition));
  };

  /** Strict equality for primitives, exact equality for Frac. */
  Asserter.prototype.eq = function (actual, expected, message) {
    const ML = root.ML;
    let same;
    if (ML && ML.Frac && actual instanceof ML.Frac) same = actual.eq(expected);
    else if (typeof actual === 'object' && actual !== null) same = JSON.stringify(actual) === JSON.stringify(expected);
    else same = actual === expected;
    if (same) this._pass(message);
    else this._fail(message, 'expected ' + describeValue(expected) + ', got ' + describeValue(actual));
  };

  /** Exact rational equality against a number/string like "1/3". */
  Asserter.prototype.frac = function (actual, expected, message) {
    const ML = root.ML;
    const want = ML.Frac.of(expected);
    const got = ML.Frac.of(actual);
    if (got.eq(want)) this._pass(message);
    else this._fail(message, 'expected ' + want.toString() + ', got ' + got.toString());
  };

  /** Floating point comparison with tolerance. */
  Asserter.prototype.close = function (actual, expected, tol, message) {
    const t = tol == null ? 1e-9 : tol;
    const a = typeof actual === 'object' && actual && actual.toNumber ? actual.toNumber() : actual;
    if (typeof a === 'number' && Number.isFinite(a) && Math.abs(a - expected) <= t * Math.max(1, Math.abs(expected))) {
      this._pass(message);
    } else {
      this._fail(message, 'expected ≈ ' + expected + ' (tol ' + t + '), got ' + describeValue(actual));
    }
  };

  /** Exact matrix equality against a 2-D array of numbers/strings. */
  Asserter.prototype.matrix = function (actual, expected, message) {
    const ML = root.ML;
    if (!ML.Matrix.isMatrix(actual)) {
      this._fail(message, 'expected a Matrix, got ' + describeValue(actual));
      return;
    }
    let want;
    try {
      want = ML.Matrix.from(expected);
    } catch (err) {
      this._fail(message, 'bad expectation in the test itself: ' + err.message);
      return;
    }
    if (actual.equals(want)) this._pass(message);
    else this._fail(message, 'expected' + describeValue(want) + 'got' + describeValue(actual));
  };

  /** Matrix comparison with tolerance, for numeric (float) results. */
  Asserter.prototype.matrixClose = function (actual, expected, tol, message) {
    const ML = root.ML;
    const t = tol == null ? 1e-8 : tol;
    const got = ML.Matrix.isMatrix(actual) ? actual.toFloat() : actual;
    const want = ML.Matrix.isMatrix(expected) ? expected.toFloat() : expected;
    if (!Array.isArray(got) || got.length !== want.length || got[0].length !== want[0].length) {
      this._fail(message, 'shape mismatch: expected ' + JSON.stringify(want) + ', got ' + JSON.stringify(got));
      return;
    }
    for (let i = 0; i < want.length; i++) {
      for (let j = 0; j < want[i].length; j++) {
        const a = got[i][j];
        const b = typeof want[i][j] === 'number' ? want[i][j] : Number(want[i][j]);
        if (!(Math.abs(a - b) <= t * Math.max(1, Math.abs(b)))) {
          this._fail(
            message,
            'entry (' + (i + 1) + ',' + (j + 1) + ') expected ≈ ' + b + ', got ' + a +
              '\nfull result: ' + JSON.stringify(got)
          );
          return;
        }
      }
    }
    this._pass(message);
  };

  /** Assert the function throws an MLError (optionally matching a substring). */
  Asserter.prototype.throws = function (fn, expectedSubstring, message) {
    let threw = null;
    try {
      fn();
    } catch (err) {
      threw = err;
    }
    if (!threw) {
      this._fail(message, 'expected an error to be thrown, but the call succeeded');
      return;
    }
    if (expectedSubstring && threw.message.indexOf(expectedSubstring) < 0) {
      this._fail(message, 'error message did not contain “' + expectedSubstring + '”: ' + threw.message);
      return;
    }
    this._pass(message);
  };

  const MLTest = {
    suites: suites,

    /**
     * @param {string} name
     * @param {(t: Asserter) => void} fn
     */
    suite: function (name, fn) {
      suites.push({ name: name, fn: fn });
    },

    /** Run everything; returns a structured report. */
    run: function (filter) {
      const report = { total: 0, passed: 0, failed: 0, suites: [] };
      suites.forEach(function (suite) {
        if (filter && suite.name.toLowerCase().indexOf(filter.toLowerCase()) < 0) return;
        const entry = { name: suite.name, assertions: [], error: null, passed: 0, failed: 0 };
        const asserter = new Asserter(function (result) {
          entry.assertions.push(result);
          if (result.ok) {
            entry.passed++;
            report.passed++;
          } else {
            entry.failed++;
            report.failed++;
          }
          report.total++;
        });
        try {
          suite.fn(asserter);
        } catch (err) {
          entry.error = err && err.stack ? err.stack : String(err);
          entry.failed++;
          report.failed++;
          report.total++;
        }
        report.suites.push(entry);
      });
      return report;
    },
  };

  root.MLTest = MLTest;
})(typeof globalThis !== 'undefined' ? globalThis : this);
