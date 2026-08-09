/**
 * MatrixLab — centralised numeric settings and formatting.
 *
 * One place decides how every number in the app is displayed, so a matrix, a
 * step and a result never disagree. Internal calculations always use full
 * precision (exact rationals, or float64 where unavoidable); the settings here
 * only affect presentation.
 */
(function (ML) {
  'use strict';

  const Frac = ML.Frac;

  /** @type {{decimals:number, format:'auto'|'fraction'|'decimal', maxDenominator:number, epsilon:number}} */
  ML.config = {
    /** Digits shown after the decimal point. */
    decimals: 4,
    /**
     * 'auto'     — exact values print as fractions, numeric ones as decimals
     * 'fraction' — also try to recognise numeric results as fractions
     * 'decimal'  — always print decimals
     */
    format: 'auto',
    /** Fractions with a bigger denominator than this are shown as decimals. */
    maxDenominator: 100000,
    /** Tolerance used to clean float artefacts and to test floats for zero. */
    epsilon: 1e-10,
  };

  const listeners = [];

  /** Update settings and notify the UI. */
  ML.setConfig = function (patch) {
    Object.assign(ML.config, patch);
    listeners.forEach(function (fn) {
      try {
        fn(ML.config);
      } catch (err) {
        /* a broken listener must not break the maths */
      }
    });
  };

  ML.onConfigChange = function (fn) {
    listeners.push(fn);
  };

  /* ------------------------------------------------------------------ *
   * Float hygiene
   * ------------------------------------------------------------------ */

  /**
   * Remove floating point artefacts: 0.9999999999999998 → 1, 2.7e-17 → 0.
   * Only ever applied at the edge of a calculation, never mid-algorithm.
   */
  ML.cleanFloat = function (x, epsilon) {
    if (typeof x !== 'number' || !Number.isFinite(x)) return x;
    const eps = epsilon == null ? ML.config.epsilon : epsilon;
    if (Math.abs(x) < eps) return 0;
    const rounded = Math.round(x);
    if (Math.abs(x - rounded) < eps * Math.max(1, Math.abs(x))) return rounded;
    return x;
  };

  /** Is a float indistinguishable from zero at the given scale? */
  ML.nearZero = function (x, scale) {
    const s = scale == null ? 1 : Math.abs(scale);
    return Math.abs(x) <= ML.config.epsilon * Math.max(1, s);
  };

  /* ------------------------------------------------------------------ *
   * Formatting
   * ------------------------------------------------------------------ */

  function trimZeros(text) {
    if (text.indexOf('.') < 0) return text;
    let out = text.replace(/0+$/, '');
    if (out.endsWith('.')) out = out.slice(0, -1);
    if (out === '-0' || out === '') out = '0';
    return out;
  }

  /**
   * Break a value into display parts so renderers can draw a real stacked
   * fraction instead of "1/3".
   * @returns {{kind:'integer'|'fraction'|'decimal'|'complex', text:string, num?:string, den?:string, negative:boolean}}
   */
  ML.formatParts = function (value, options) {
    const opts = options || {};
    const decimals = opts.decimals == null ? ML.config.decimals : opts.decimals;
    const format = opts.format || ML.config.format;

    if (value instanceof Frac) {
      if (value.isInteger()) {
        return { kind: 'integer', text: value.n.toString(), negative: value.isNegative() };
      }
      if (format !== 'decimal' && value.d <= BigInt(ML.config.maxDenominator)) {
        const negative = value.isNegative();
        return {
          kind: 'fraction',
          text: value.toString(),
          num: ML.bigAbs(value.n).toString(),
          den: value.d.toString(),
          negative: negative,
        };
      }
      return { kind: 'decimal', text: trimZeros(value.toDecimalString(decimals)), negative: value.isNegative() };
    }

    if (ML.Complex && value instanceof ML.Complex) {
      return { kind: 'complex', text: value.toString(decimals), negative: false };
    }

    if (typeof value === 'number') {
      const x = ML.cleanFloat(value);
      if (!Number.isFinite(x)) {
        return { kind: 'decimal', text: Number.isNaN(x) ? 'undefined' : x > 0 ? '∞' : '-∞', negative: x < 0 };
      }
      if (Number.isInteger(x) && Math.abs(x) < 1e15) {
        return { kind: 'integer', text: String(x), negative: x < 0 };
      }
      if (format === 'fraction') {
        const f = Frac.approximate(x, ML.config.maxDenominator, Math.max(1e-12, Math.pow(10, -decimals - 2)));
        if (f && !f.isInteger()) {
          return {
            kind: 'fraction',
            text: f.toString(),
            num: ML.bigAbs(f.n).toString(),
            den: f.d.toString(),
            negative: f.isNegative(),
          };
        }
      }
      const magnitude = Math.abs(x);
      if (magnitude >= 1e9 || magnitude < Math.pow(10, -decimals) / 2) {
        return { kind: 'decimal', text: x.toExponential(Math.min(decimals, 6)), negative: x < 0 };
      }
      return { kind: 'decimal', text: trimZeros(x.toFixed(decimals)), negative: x < 0 };
    }

    if (typeof value === 'string') return { kind: 'decimal', text: value, negative: false };
    if (value == null) return { kind: 'decimal', text: '—', negative: false };
    return { kind: 'decimal', text: String(value), negative: false };
  };

  /** Plain-text formatting of any MatrixLab value. */
  ML.fmt = function (value, options) {
    const parts = ML.formatParts(value, options);
    if (parts.kind === 'fraction') return (parts.negative ? '-' : '') + parts.num + '/' + parts.den;
    return parts.text;
  };

  /** Format with a fixed number of decimals regardless of settings. */
  ML.fmtFixed = function (value, decimals) {
    return ML.fmt(value, { format: 'decimal', decimals: decimals });
  };

  /** Signed term for building readable expressions: "- 3" / "+ 3". */
  ML.signedTerm = function (value) {
    const text = ML.fmt(value);
    if (text.startsWith('-')) return '− ' + text.slice(1);
    return '+ ' + text;
  };
})((globalThis.ML = globalThis.ML || {}));
