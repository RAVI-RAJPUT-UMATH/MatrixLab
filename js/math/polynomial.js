/**
 * MatrixLab — polynomials with exact rational coefficients.
 *
 * Built for characteristic polynomials, so the priority is exactness where it
 * is achievable: rational roots are found exactly (rational root theorem),
 * quadratic factors are given in closed form with a real √ symbol, and only
 * genuinely irrational higher-degree roots fall back to a numerical solver.
 * Coefficients are stored in ascending powers: [c₀, c₁, c₂] means c₀ + c₁x + c₂x².
 */
(function (ML) {
  'use strict';

  const Frac = ML.Frac;
  const Complex = ML.Complex;
  const MLError = ML.MLError;
  const fmt = function (v) { return ML.fmt(v); };

  /** Above this magnitude, factorising for the rational root theorem is skipped. */
  const FACTOR_LIMIT = 10n ** 15n;
  const DIVISOR_STEP_LIMIT = 400000;

  /* ------------------------------------------------------------------ *
   * Basics
   * ------------------------------------------------------------------ */

  function degree(coefficients) {
    for (let i = coefficients.length - 1; i >= 0; i--) if (!coefficients[i].isZero()) return i;
    return -1;
  }

  function trim(coefficients) {
    const d = degree(coefficients);
    return d < 0 ? [Frac.ZERO] : coefficients.slice(0, d + 1);
  }

  function evalFrac(coefficients, x) {
    let result = Frac.ZERO;
    for (let i = coefficients.length - 1; i >= 0; i--) result = result.mul(x).add(coefficients[i]);
    return result;
  }

  function evalComplex(coefficients, z) {
    let result = Complex.ZERO;
    for (let i = coefficients.length - 1; i >= 0; i--) {
      result = result.mul(z).add(Complex.of(coefficients[i].toNumber()));
    }
    return result;
  }

  /** Readable form: "λ³ − 2λ² + 5". */
  function polyText(coefficients, variable) {
    const v = variable || 'λ';
    const terms = [];
    for (let power = coefficients.length - 1; power >= 0; power--) {
      const c = coefficients[power];
      if (c.isZero()) continue;
      const magnitude = c.abs();
      const showCoefficient = !magnitude.isOne() || power === 0;
      const coefficientText = showCoefficient ? fmt(magnitude) : '';
      let body;
      if (power === 0) body = coefficientText;
      else if (power === 1) body = coefficientText + v;
      else body = coefficientText + v + ML.operations.superscript(power);
      if (!terms.length) terms.push((c.isNegative() ? '−' : '') + body);
      else terms.push((c.isNegative() ? ' − ' : ' + ') + body);
    }
    return terms.length ? terms.join('') : '0';
  }

  /** Divide by (x − root); the root must be exact. */
  function deflate(coefficients, root) {
    const d = degree(coefficients);
    if (d < 1) throw new MLError('Cannot divide a constant polynomial by a linear factor.');
    const out = new Array(d).fill(Frac.ZERO);
    let carry = coefficients[d];
    out[d - 1] = carry;
    for (let i = d - 1; i >= 1; i--) {
      carry = coefficients[i].add(carry.mul(root));
      out[i - 1] = carry;
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Exact rational roots
   * ------------------------------------------------------------------ */

  /** All positive divisors of n, or null when n is too large to factor quickly. */
  function divisors(n) {
    let value = n < 0n ? -n : n;
    if (value === 0n) return null;
    if (value > FACTOR_LIMIT) return null;
    const small = [];
    const large = [];
    let steps = 0;
    for (let i = 1n; i * i <= value; i++) {
      if (++steps > DIVISOR_STEP_LIMIT) return null;
      if (value % i === 0n) {
        small.push(i);
        const other = value / i;
        if (other !== i) large.push(other);
      }
    }
    large.reverse();
    return small.concat(large);
  }

  /** Scale rational coefficients to integers (BigInt) without changing the roots. */
  function toIntegerCoefficients(coefficients) {
    let multiplier = 1n;
    coefficients.forEach(function (c) {
      const g = ML.bigGcd(multiplier, c.d);
      multiplier = (multiplier / g) * c.d;
    });
    const scaled = coefficients.map(function (c) { return c.n * (multiplier / c.d); });
    let common = 0n;
    scaled.forEach(function (value) { common = ML.bigGcd(common, value); });
    if (common > 1n) return scaled.map(function (value) { return value / common; });
    return scaled;
  }

  /**
   * Every rational root, with multiplicity, found exactly via the rational root
   * theorem. `remaining` is what is left after dividing them all out.
   * @returns {{roots: Array<{value: ML.Frac, multiplicity: number}>, remaining: ML.Frac[], complete: boolean}}
   */
  function rationalRoots(input) {
    let coefficients = trim(input);
    const roots = [];
    let complete = true;

    // Roots at zero come straight out of the constant term.
    while (degree(coefficients) >= 1 && coefficients[0].isZero()) {
      addRoot(roots, Frac.ZERO);
      coefficients = coefficients.slice(1);
    }

    let searching = true;
    while (searching && degree(coefficients) >= 1) {
      searching = false;
      if (degree(coefficients) === 1) {
        // c₀ + c₁x = 0
        addRoot(roots, coefficients[0].neg().div(coefficients[1]));
        coefficients = [Frac.ONE];
        break;
      }
      const integers = toIntegerCoefficients(coefficients);
      const constant = integers[0];
      const leading = integers[integers.length - 1];
      const numerators = divisors(constant);
      const denominators = divisors(leading);
      if (!numerators || !denominators) {
        complete = false;
        break;
      }

      let found = null;
      outer: for (let a = 0; a < numerators.length && !found; a++) {
        for (let b = 0; b < denominators.length; b++) {
          for (let sign = 0; sign < 2; sign++) {
            const candidate = new Frac(sign ? -numerators[a] : numerators[a], denominators[b]);
            if (evalFrac(coefficients, candidate).isZero()) {
              found = candidate;
              break outer;
            }
          }
        }
      }

      if (found) {
        addRoot(roots, found);
        coefficients = deflate(coefficients, found);
        searching = true;
      }
    }

    return { roots: roots, remaining: trim(coefficients), complete: complete };
  }

  function addRoot(roots, value) {
    for (let i = 0; i < roots.length; i++) {
      if (roots[i].value.eq(value)) {
        roots[i].multiplicity++;
        return;
      }
    }
    roots.push({ value: value, multiplicity: 1 });
  }

  /* ------------------------------------------------------------------ *
   * Radicals
   * ------------------------------------------------------------------ */

  /** √n = outside·√inside with inside square-free-ish (perfect squares pulled out). */
  function simplifyRadical(n) {
    let value = n < 0n ? -n : n;
    if (value === 0n) return { outside: 0n, inside: 1n };
    let outside = 1n;
    let inside = value;
    for (let factor = 2n; factor * factor <= inside; factor++) {
      while (inside % (factor * factor) === 0n) {
        inside /= factor * factor;
        outside *= factor;
      }
      if (factor > 100000n) break; // stop hunting; the remainder stays under the root
    }
    return { outside: outside, inside: inside };
  }

  /**
   * Roots of ax² + bx + c with exact coefficients, in closed form.
   * @returns {{kind:'rational'|'radical'|'complex', discriminant: ML.Frac, roots: object[]}}
   */
  function quadraticRoots(a, b, c) {
    if (a.isZero()) {
      if (b.isZero()) throw new MLError('This is not a quadratic (both x² and x coefficients are zero).');
      return { kind: 'rational', discriminant: Frac.ZERO, roots: [{ kind: 'rational', value: c.neg().div(b) }] };
    }
    const discriminant = b.mul(b).sub(a.mul(c).mul(4));
    const center = b.neg().div(a.mul(2));

    if (discriminant.isZero()) {
      return { kind: 'rational', discriminant: discriminant, roots: [{ kind: 'rational', value: center, multiplicity: 2 }] };
    }

    const exactRoot = discriminant.abs().sqrtExact();
    if (discriminant.isPositive() && exactRoot) {
      const offset = exactRoot.div(a.mul(2)).abs();
      return {
        kind: 'rational',
        discriminant: discriminant,
        roots: [
          { kind: 'rational', value: center.add(offset) },
          { kind: 'rational', value: center.sub(offset) },
        ],
      };
    }

    // √(p/q) = √(pq)/q, then pull perfect squares out of pq.
    const magnitude = discriminant.abs();
    const product = magnitude.n * magnitude.d;
    const simplified = simplifyRadical(product);
    const coefficient = new Frac(simplified.outside, magnitude.d).div(a.mul(2)).abs();
    const imaginary = discriminant.isNegative();
    const numericOffset = Math.sqrt(Number(simplified.inside)) * coefficient.toNumber();

    const build = function (sign) {
      return {
        kind: imaginary ? 'complex' : 'radical',
        center: center,
        coefficient: coefficient.mul(sign),
        radicand: simplified.inside,
        imaginary: imaginary,
        complex: imaginary
          ? new Complex(center.toNumber(), sign > 0 ? numericOffset : -numericOffset)
          : new Complex(center.toNumber() + sign * numericOffset, 0),
      };
    };

    return {
      kind: imaginary ? 'complex' : 'radical',
      discriminant: discriminant,
      roots: [build(1), build(-1)],
    };
  }

  /** "2 + 3√5" or "1 ± 2i" style text for a closed-form root. */
  function radicalText(root) {
    if (root.kind === 'rational') return fmt(root.value);
    const centerText = root.center.isZero() ? '' : fmt(root.center);
    const magnitude = root.coefficient.abs();
    const negative = root.coefficient.isNegative();
    const coefficientText = magnitude.isOne() ? '' : fmt(magnitude);
    const radical = root.radicand === 1n ? '' : '√' + root.radicand.toString();
    let body = coefficientText + (root.imaginary ? 'i' : '') + radical;
    if (!body) body = '1';
    if (!centerText) return (negative ? '−' : '') + body;
    return centerText + (negative ? ' − ' : ' + ') + body;
  }

  /* ------------------------------------------------------------------ *
   * Numerical roots — Durand–Kerner
   * ------------------------------------------------------------------ */

  /**
   * All complex roots of a polynomial, found simultaneously. Durand–Kerner is
   * short, needs no derivative and converges for well-separated roots; the
   * residual is reported so callers can be honest about accuracy.
   * @returns {{roots: ML.Complex[], residual: number, converged: boolean, iterations: number}}
   */
  function rootsNumeric(input, options) {
    const opts = options || {};
    const coefficients = trim(input);
    const d = degree(coefficients);
    if (d < 1) return { roots: [], residual: 0, converged: true, iterations: 0 };

    const leading = coefficients[d];
    const monic = coefficients.map(function (c) { return c.div(leading).toNumber(); });
    const maxIterations = opts.maxIterations || 500;
    const tol = opts.tol || 1e-13;

    // Spread the initial guesses around a circle so no two collide.
    let guesses = [];
    const seed = new Complex(0.4, 0.9);
    let current = new Complex(1, 0);
    for (let i = 0; i < d; i++) {
      current = current.mul(seed);
      guesses.push(current);
    }

    const evaluate = function (z) {
      let result = Complex.ZERO;
      for (let i = monic.length - 1; i >= 0; i--) result = result.mul(z).add(new Complex(monic[i], 0));
      return result;
    };

    let iterations = 0;
    let maxShift = Infinity;
    for (; iterations < maxIterations && maxShift > tol; iterations++) {
      maxShift = 0;
      const next = guesses.slice();
      for (let i = 0; i < d; i++) {
        let denominator = Complex.ONE;
        for (let j = 0; j < d; j++) {
          if (i === j) continue;
          denominator = denominator.mul(guesses[i].sub(guesses[j]));
        }
        if (denominator.abs() < 1e-300) continue;
        const shift = evaluate(guesses[i]).div(denominator);
        next[i] = guesses[i].sub(shift);
        maxShift = Math.max(maxShift, shift.abs());
      }
      guesses = next;
    }

    // Tidy up: snap negligible imaginary parts, then sort for stable output.
    const roots = guesses
      .map(function (z) {
        const re = ML.cleanFloat(z.re, 1e-9);
        const im = Math.abs(z.im) < 1e-8 * Math.max(1, Math.abs(z.re)) ? 0 : ML.cleanFloat(z.im, 1e-9);
        return new Complex(re, im);
      })
      .sort(function (p, q) {
        if (Math.abs(p.re - q.re) > 1e-9) return q.re - p.re;
        return q.im - p.im;
      });

    let residual = 0;
    roots.forEach(function (z) { residual = Math.max(residual, evaluate(z).abs()); });

    return { roots: roots, residual: residual, converged: maxShift <= tol, iterations: iterations };
  }

  const api = {
    polyDegree: degree,
    polyTrim: trim,
    polyEvalFrac: evalFrac,
    polyEvalComplex: evalComplex,
    polyText: polyText,
    polyDeflate: deflate,
    rationalRoots: rationalRoots,
    quadraticRoots: quadraticRoots,
    radicalText: radicalText,
    simplifyRadical: simplifyRadical,
    rootsNumeric: rootsNumeric,
    polyDivisors: divisors,
    toIntegerCoefficients: toIntegerCoefficients,
  };

  ML.polynomial = api;
  Object.assign(ML, api);
})((globalThis.ML = globalThis.ML || {}));
