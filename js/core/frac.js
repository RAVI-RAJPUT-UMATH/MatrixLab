/**
 * MatrixLab — exact rational arithmetic.
 *
 * Frac is an immutable fraction n/d backed by BigInt, always stored in lowest
 * terms with a positive denominator. Every value a user can type (3, -2.5,
 * 3/4, 1.2e-3) is exactly representable, so the algorithms built on Frac
 * (elimination, determinant, inverse, rank, solving) are exact: no rounding
 * error, no epsilon guessing when deciding whether a pivot is zero.
 *
 * Floating point is used only where the mathematics genuinely leaves the
 * rationals (square roots, eigenvectors of irrational eigenvalues, QR, SVD).
 */
(function (ML) {
  'use strict';

  const MLError = ML.MLError;

  /* ------------------------------------------------------------------ *
   * BigInt helpers
   * ------------------------------------------------------------------ */

  function bigAbs(a) {
    return a < 0n ? -a : a;
  }

  function bigGcd(a, b) {
    a = bigAbs(a);
    b = bigAbs(b);
    while (b) {
      const t = a % b;
      a = b;
      b = t;
    }
    return a;
  }

  /** Integer square root (floor) for n >= 0, via Newton's method. */
  function bigISqrt(n) {
    if (n < 0n) throw new MLError('Cannot take the square root of a negative number here.');
    if (n < 2n) return n;
    let x = n;
    let y = (x + 1n) / 2n;
    while (y < x) {
      x = y;
      y = (x + n / x) / 2n;
    }
    return x;
  }

  /**
   * Guard against runaway growth. Exact arithmetic on a badly conditioned
   * matrix can grow numerators without bound; ~900 bits (≈270 digits) is far
   * beyond any hand-checkable example, so hitting it means something is wrong
   * and we say so instead of hanging the browser.
   */
  const LIMIT = 1n << 900n;

  const DECIMAL_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

  /* ------------------------------------------------------------------ *
   * Frac
   * ------------------------------------------------------------------ */

  class Frac {
    /**
     * @param {bigint|number|string} num
     * @param {bigint|number|string} [den=1]
     */
    constructor(num, den) {
      let n = typeof num === 'bigint' ? num : BigInt(num);
      let d = den === undefined ? 1n : typeof den === 'bigint' ? den : BigInt(den);

      if (d === 0n) {
        throw new MLError('Division by zero: a fraction cannot have 0 as its denominator.');
      }
      if (d < 0n) {
        n = -n;
        d = -d;
      }
      if (n === 0n) {
        d = 1n;
      } else {
        const g = bigGcd(n, d);
        if (g > 1n) {
          n /= g;
          d /= g;
        }
      }
      if (bigAbs(n) > LIMIT || d > LIMIT) {
        throw new MLError(
          'Exact fraction arithmetic grew too large to continue. Try smaller entries, ' +
            'or switch the number format to decimals in Settings.'
        );
      }

      this.n = n;
      this.d = d;
      Object.freeze(this);
    }

    /* ------------------------- construction ------------------------- */

    /**
     * Convert anything reasonable into a Frac.
     * @param {Frac|number|bigint|string} value
     * @returns {Frac}
     */
    static of(value) {
      if (value instanceof Frac) return value;
      if (typeof value === 'bigint') return new Frac(value);
      if (typeof value === 'number') return Frac.fromNumber(value);
      if (typeof value === 'string') return Frac.parse(value);
      throw new MLError('Expected a number but received ' + typeof value + '.');
    }

    /** Exact conversion of a finite JS number (uses its shortest decimal form). */
    static fromNumber(x) {
      if (typeof x !== 'number' || !Number.isFinite(x)) {
        throw new MLError('“' + x + '” is not a finite number.');
      }
      if (Number.isInteger(x)) return new Frac(BigInt(x));
      return parseDecimal(x.toString());
    }

    /**
     * Parse user input. Accepts integers, decimals, scientific notation and
     * fractions such as "3/4", "-1/2", "2.5/10".
     * @param {string} text
     * @returns {Frac}
     */
    static parse(text) {
      let s = String(text).trim();
      // Normalise unicode minus / dashes and strip spaces so "1 / 2" works.
      s = s.replace(/[−–—]/g, '-').replace(/\s+/g, '');
      if (!s) throw new MLError('This entry is empty. Please type a number.');

      const slash = s.indexOf('/');
      if (slash >= 0) {
        const top = s.slice(0, slash);
        const bottom = s.slice(slash + 1);
        if (!top || !bottom || bottom.indexOf('/') >= 0) {
          throw new MLError('“' + text + '” is not a valid fraction. Write it as 3/4 or -1/2.');
        }
        const a = parseDecimal(top, text);
        const b = parseDecimal(bottom, text);
        if (b.isZero()) {
          throw new MLError('“' + text + '” divides by zero. The bottom of a fraction cannot be 0.');
        }
        return a.div(b);
      }
      return parseDecimal(s, text);
    }

    /**
     * Best rational approximation of a float with denominator <= maxDen,
     * using continued fractions. Returns null when no approximation is within
     * `tol`. Used only for *display* of numeric results — never to replace a
     * value inside a calculation.
     */
    static approximate(x, maxDen, tol) {
      maxDen = maxDen || 10000;
      tol = tol == null ? 1e-9 : tol;
      if (!Number.isFinite(x)) return null;
      const sign = x < 0 ? -1 : 1;
      let v = Math.abs(x);
      let p0 = 0n;
      let q0 = 1n;
      let p1 = 1n;
      let q1 = 0n;
      let value = v;
      for (let i = 0; i < 40; i++) {
        const a = Math.floor(value);
        if (!Number.isFinite(a) || a > 1e15) break;
        const ab = BigInt(a);
        const p2 = ab * p1 + p0;
        const q2 = ab * q1 + q0;
        if (q2 > BigInt(maxDen)) break;
        p0 = p1;
        q0 = q1;
        p1 = p2;
        q1 = q2;
        const approx = Number(p1) / Number(q1);
        if (Math.abs(approx - v) <= tol * Math.max(1, v)) {
          return new Frac(BigInt(sign) * p1, q1);
        }
        const frac = value - a;
        if (frac < 1e-15) break;
        value = 1 / frac;
      }
      if (q1 === 0n) return null;
      const approx = Number(p1) / Number(q1);
      if (Math.abs(approx - v) <= tol * Math.max(1, v)) return new Frac(BigInt(sign) * p1, q1);
      return null;
    }

    /* --------------------------- arithmetic -------------------------- */

    add(other) {
      const o = Frac.of(other);
      return new Frac(this.n * o.d + o.n * this.d, this.d * o.d);
    }

    sub(other) {
      const o = Frac.of(other);
      return new Frac(this.n * o.d - o.n * this.d, this.d * o.d);
    }

    mul(other) {
      const o = Frac.of(other);
      return new Frac(this.n * o.n, this.d * o.d);
    }

    div(other) {
      const o = Frac.of(other);
      if (o.isZero()) throw new MLError('Division by zero.');
      return new Frac(this.n * o.d, this.d * o.n);
    }

    neg() {
      return new Frac(-this.n, this.d);
    }

    abs() {
      return this.n < 0n ? this.neg() : this;
    }

    inv() {
      if (this.isZero()) throw new MLError('Zero has no reciprocal.');
      return new Frac(this.d, this.n);
    }

    /** Integer power (negative exponents allowed for non-zero values). */
    pow(k) {
      k = Number(k);
      if (!Number.isInteger(k)) throw new MLError('Fractions can only be raised to whole-number powers here.');
      if (k === 0) return Frac.ONE;
      if (k < 0) return this.inv().pow(-k);
      let base = this;
      let result = Frac.ONE;
      let e = k;
      while (e > 0) {
        if (e & 1) result = result.mul(base);
        e >>= 1;
        if (e > 0) base = base.mul(base);
      }
      return result;
    }

    /* --------------------------- comparison -------------------------- */

    /** @returns {-1|0|1} */
    cmp(other) {
      const o = Frac.of(other);
      const left = this.n * o.d;
      const right = o.n * this.d;
      return left < right ? -1 : left > right ? 1 : 0;
    }

    eq(other) {
      const o = Frac.of(other);
      return this.n === o.n && this.d === o.d;
    }

    lt(other) { return this.cmp(other) < 0; }
    lte(other) { return this.cmp(other) <= 0; }
    gt(other) { return this.cmp(other) > 0; }
    gte(other) { return this.cmp(other) >= 0; }

    isZero() { return this.n === 0n; }
    isOne() { return this.n === 1n && this.d === 1n; }
    isNegative() { return this.n < 0n; }
    isPositive() { return this.n > 0n; }
    isInteger() { return this.d === 1n; }

    /** @returns {-1|0|1} */
    sign() {
      return this.n < 0n ? -1 : this.n > 0n ? 1 : 0;
    }

    /**
     * Exact square root, or null when the result is irrational.
     * Lets MatrixLab print √ terms exactly when it can (e.g. ‖v‖ = 5).
     */
    sqrtExact() {
      if (this.n < 0n) return null;
      const sn = bigISqrt(this.n);
      const sd = bigISqrt(this.d);
      if (sn * sn === this.n && sd * sd === this.d) return new Frac(sn, sd);
      return null;
    }

    /* ----------------------------- output ---------------------------- */

    /** Nearest double. Falls back to decimal expansion for huge values. */
    toNumber() {
      const n = Number(this.n);
      const d = Number(this.d);
      if (Number.isFinite(n) && Number.isFinite(d) && d !== 0) return n / d;
      return parseFloat(this.toDecimalString(20));
    }

    /** "n" or "n/d". */
    toString() {
      return this.d === 1n ? this.n.toString() : this.n.toString() + '/' + this.d.toString();
    }

    /**
     * Round-half-away-from-zero decimal expansion with exactly `places`
     * digits after the point. Computed with BigInt, so it is exact.
     */
    toDecimalString(places) {
      places = Math.max(0, Math.min(40, Math.floor(places == null ? 6 : places)));
      const negative = this.n < 0n;
      const n = bigAbs(this.n);
      const d = this.d;
      const scaled = n * 10n ** BigInt(places);
      let q = scaled / d;
      const r = scaled % d;
      if (r * 2n >= d) q += 1n;
      let digits = q.toString();
      if (places > 0) {
        digits = digits.padStart(places + 1, '0');
        const cut = digits.length - places;
        digits = digits.slice(0, cut) + '.' + digits.slice(cut);
      }
      return (negative && q !== 0n ? '-' : '') + digits;
    }

    toJSON() {
      return this.toString();
    }
  }

  /* ------------------------------------------------------------------ *
   * Decimal parsing
   * ------------------------------------------------------------------ */

  function parseDecimal(s, original) {
    if (!DECIMAL_RE.test(s)) {
      throw new MLError(
        '“' + (original == null ? s : original) + '” is not a valid number. ' +
          'Use forms like 7, -2.5, 3/4 or 1.5e-3.'
      );
    }
    let mantissa = s;
    let exponent = 0;
    const eAt = s.search(/[eE]/);
    if (eAt >= 0) {
      mantissa = s.slice(0, eAt);
      exponent = parseInt(s.slice(eAt + 1), 10);
    }
    let sign = 1n;
    if (mantissa[0] === '+') mantissa = mantissa.slice(1);
    else if (mantissa[0] === '-') {
      sign = -1n;
      mantissa = mantissa.slice(1);
    }
    const dot = mantissa.indexOf('.');
    let intPart = mantissa;
    let fracPart = '';
    if (dot >= 0) {
      intPart = mantissa.slice(0, dot);
      fracPart = mantissa.slice(dot + 1);
    }
    const digits = (intPart || '0') + fracPart;
    let num = BigInt(digits || '0') * sign;
    let den = 10n ** BigInt(fracPart.length);
    if (exponent > 0) num *= 10n ** BigInt(exponent);
    else if (exponent < 0) den *= 10n ** BigInt(-exponent);
    return new Frac(num, den);
  }

  Frac.ZERO = new Frac(0n);
  Frac.ONE = new Frac(1n);
  Frac.MINUS_ONE = new Frac(-1n);

  ML.Frac = Frac;
  ML.frac = Frac.of;
  ML.bigGcd = bigGcd;
  ML.bigAbs = bigAbs;
  ML.bigISqrt = bigISqrt;
})((globalThis.ML = globalThis.ML || {}));
