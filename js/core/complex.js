/**
 * MatrixLab — minimal complex numbers.
 *
 * Needed because a real matrix can perfectly well have complex eigenvalues
 * (a rotation is the classic example). Rather than hide those cases or print
 * something wrong, MatrixLab computes and displays them.
 */
(function (ML) {
  'use strict';

  class Complex {
    constructor(re, im) {
      this.re = re || 0;
      this.im = im || 0;
      Object.freeze(this);
    }

    static of(value) {
      if (value instanceof Complex) return value;
      if (value instanceof ML.Frac) return new Complex(value.toNumber(), 0);
      if (typeof value === 'number') return new Complex(value, 0);
      throw new ML.MLError('Cannot treat this value as a complex number.');
    }

    add(o) { o = Complex.of(o); return new Complex(this.re + o.re, this.im + o.im); }
    sub(o) { o = Complex.of(o); return new Complex(this.re - o.re, this.im - o.im); }
    neg() { return new Complex(-this.re, -this.im); }
    conj() { return new Complex(this.re, -this.im); }

    mul(o) {
      o = Complex.of(o);
      return new Complex(this.re * o.re - this.im * o.im, this.re * o.im + this.im * o.re);
    }

    div(o) {
      o = Complex.of(o);
      const d = o.re * o.re + o.im * o.im;
      if (d === 0) throw new ML.MLError('Division by zero (complex).');
      return new Complex((this.re * o.re + this.im * o.im) / d, (this.im * o.re - this.re * o.im) / d);
    }

    /** Modulus |z|. */
    abs() { return Math.hypot(this.re, this.im); }

    /** Integer power by repeated multiplication. */
    pow(k) {
      let result = new Complex(1, 0);
      let base = this;
      let e = Math.abs(k);
      while (e > 0) {
        if (e & 1) result = result.mul(base);
        e >>= 1;
        if (e > 0) base = base.mul(base);
      }
      return k < 0 ? new Complex(1, 0).div(result) : result;
    }

    isZero(tol) { return this.abs() <= (tol == null ? 1e-12 : tol); }

    /** True when the imaginary part is negligible relative to the modulus. */
    isReal(tol) {
      const t = tol == null ? 1e-9 : tol;
      return Math.abs(this.im) <= t * Math.max(1, Math.abs(this.re));
    }

    toString(decimals) {
      const d = decimals == null ? ML.config.decimals : decimals;
      const fmt = function (x) { return ML.fmt(x, { format: 'decimal', decimals: d }); };
      if (this.isReal()) return fmt(this.re);
      const reText = ML.cleanFloat(this.re) === 0 ? '' : fmt(this.re);
      const imAbs = Math.abs(this.im);
      const imText = ML.cleanFloat(imAbs) === 1 ? 'i' : fmt(imAbs) + 'i';
      const sign = this.im < 0 ? '−' : '+';
      if (!reText) return (this.im < 0 ? '−' : '') + imText;
      return reText + ' ' + sign + ' ' + imText;
    }
  }

  Complex.ZERO = new Complex(0, 0);
  Complex.ONE = new Complex(1, 0);
  Complex.I = new Complex(0, 1);

  ML.Complex = Complex;
})((globalThis.ML = globalThis.ML || {}));
