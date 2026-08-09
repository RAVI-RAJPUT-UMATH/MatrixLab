/**
 * MatrixLab — eigenvalues, eigenvectors, diagonalisation.
 *
 * The strategy, in order of preference:
 *   1. The characteristic polynomial is computed exactly (Faddeev–LeVerrier),
 *      so its coefficients are rational — no rounding at all.
 *   2. Rational roots are found exactly by the rational root theorem, and their
 *      eigenvectors come from an exact null space. This covers essentially every
 *      textbook example, and the answers are exact fractions.
 *   3. A leftover quadratic is solved in closed form, so irrational and complex
 *      eigenvalues are shown as √ and i expressions rather than decimals.
 *   4. Only a leftover cubic or higher falls back to a numerical root finder,
 *      and when that happens the result is explicitly marked as approximate.
 *
 * Nothing is ever invented: if accuracy cannot be guaranteed, it says so.
 */
(function (ML) {
  'use strict';

  const Matrix = ML.Matrix;
  const Frac = ML.Frac;
  const Complex = ML.Complex;
  const MLError = ML.MLError;
  const fmt = function (v) { return ML.fmt(v); };

  /** Cayley–Hamilton is checked as a sanity test up to this size. */
  const CAYLEY_LIMIT = 6;

  /* ------------------------------------------------------------------ *
   * Characteristic polynomial
   * ------------------------------------------------------------------ */

  /**
   * det(A − λI) as exact rational coefficients in ascending powers.
   * Faddeev–LeVerrier builds them from traces of powers of A, which keeps
   * everything rational and costs only n matrix multiplications.
   *
   * @returns {{coefficients: ML.Frac[], text: string}}
   */
  function characteristicPolynomial(A, steps) {
    ML.operations.requireSquare(A, 'The characteristic polynomial');
    const n = A.rows;
    const coefficients = new Array(n + 1).fill(Frac.ZERO);
    coefficients[n] = Frac.ONE;

    let M = Matrix.zeros(n, n);
    for (let k = 1; k <= n; k++) {
      // Mₖ = A·Mₖ₋₁ + cₙ₋ₖ₊₁·I
      M = ML.addMatrices(ML.multiplyMatrices(A, M), ML.scalarMultiply(Matrix.identity(n), coefficients[n - k + 1]));
      const traced = ML.traceMatrix(ML.multiplyMatrices(A, M));
      coefficients[n - k] = traced.div(Frac.of(-k));
    }

    const text = ML.polyText(coefficients, 'λ');

    if (steps) {
      steps.add('Step 1 — what the characteristic polynomial is', {
        text:
          'An eigenvalue λ is a number for which Av = λv has a non-zero solution v. Rearranged, that says ' +
          '(A − λI)v = 0 has a non-zero solution, which happens exactly when A − λI is singular — that is, when ' +
          'det(A − λI) = 0. Expanding that determinant gives a polynomial in λ of degree ' + n + '.',
        math: 'det(A − λI) = 0',
        matrix: A,
        label: 'A =',
      });

      if (n === 2) {
        steps.add('Step 2 — the 2×2 shortcut', {
          text:
            'For a 2×2 matrix the expansion is short enough to memorise: the λ coefficient is minus the trace, and the ' +
            'constant term is the determinant.',
          math:
            'λ² − tr(A)λ + det(A) = λ² − (' + fmt(ML.traceMatrix(A)) + ')λ + (' + fmt(ML.determinant(A)) + ')',
        });
      } else if (n === 3) {
        let minorSum = Frac.ZERO;
        for (let i = 0; i < 3; i++) minorSum = minorSum.add(ML.determinant(ML.getMinor(A, i, i)));
        steps.add('Step 2 — the 3×3 pattern', {
          text:
            'For 3×3 the coefficients are the trace, the sum of the three principal 2×2 minors, and the determinant, ' +
            'with alternating signs.',
          math:
            'λ³ − tr(A)λ² + (M₁₁ + M₂₂ + M₃₃)λ − det(A) = λ³ − ' + fmt(ML.traceMatrix(A)) + 'λ² + ' +
            fmt(minorSum) + 'λ − ' + fmt(ML.determinant(A)),
        });
      } else {
        steps.add('Step 2 — computing the coefficients', {
          text:
            'Expanding a ' + n + '×' + n + ' determinant symbolically by hand is unpleasant. MatrixLab uses the ' +
            'Faddeev–LeVerrier recursion instead, which finds the coefficients from traces of powers of A. It stays in ' +
            'exact fractions and needs only ' + n + ' matrix multiplications.',
        });
      }

      steps.add('Step 3 — the characteristic equation', {
        math: 'p(λ) = ' + text + ' = 0',
        text: 'The eigenvalues are exactly the roots of this equation.',
      });

      // Cayley–Hamilton: p(A) must be the zero matrix. An exact check.
      if (n <= CAYLEY_LIMIT) {
        const evaluated = evaluatePolynomialAtMatrix(coefficients, A);
        steps.add('Check — Cayley–Hamilton', {
          text:
            ML.isZeroMatrix(evaluated)
              ? 'Substituting the matrix itself into its own characteristic polynomial gives exactly the zero matrix, ' +
                'as the Cayley–Hamilton theorem promises. Since the arithmetic here is exact, this confirms the ' +
                'coefficients are right.'
              : 'Substituting A into p should give the zero matrix but did not, so these coefficients are not ' +
                'trustworthy.',
          matrix: evaluated,
          label: 'p(A)',
        });
      }
    }

    return { coefficients: coefficients, text: text };
  }

  /** p(A) for exact coefficients — used for the Cayley–Hamilton check. */
  function evaluatePolynomialAtMatrix(coefficients, A) {
    const n = A.rows;
    let result = Matrix.zeros(n, n);
    let power = Matrix.identity(n);
    for (let k = 0; k < coefficients.length; k++) {
      if (!coefficients[k].isZero()) {
        result = ML.addMatrices(result, ML.scalarMultiply(power, coefficients[k]));
      }
      if (k < coefficients.length - 1) power = ML.multiplyMatrices(power, A);
    }
    return result;
  }

  /* ------------------------------------------------------------------ *
   * Eigenvalues
   * ------------------------------------------------------------------ */

  /**
   * @returns {{polynomial: object, values: object[], allExact: boolean,
   *            residual: number, notes: string[]}}
   *
   * Each entry of `values` has:
   *   kind            'rational' | 'radical' | 'complex' | 'numeric'
   *   multiplicity    algebraic multiplicity
   *   text            display form ("3", "1 + √2", "2 ± 3i", "1.4142…")
   *   frac            exact value when kind === 'rational'
   *   complex         numeric value, always present
   *   exact           whether the value is exact
   */
  function eigenvalues(A, steps) {
    ML.operations.requireSquare(A, 'Eigenvalues');
    const polynomial = characteristicPolynomial(A, steps);
    const found = ML.rationalRoots(polynomial.coefficients);
    const values = [];
    const notes = [];
    let allExact = true;
    let residual = 0;

    found.roots.forEach(function (root) {
      values.push({
        kind: 'rational',
        frac: root.value,
        complex: new Complex(root.value.toNumber(), 0),
        multiplicity: root.multiplicity,
        text: fmt(root.value),
        exact: true,
      });
    });

    const remainingDegree = ML.polyDegree(found.remaining);

    if (remainingDegree === 2) {
      const quadratic = ML.quadraticRoots(found.remaining[2], found.remaining[1], found.remaining[0]);
      quadratic.roots.forEach(function (root) {
        if (root.kind === 'rational') {
          values.push({
            kind: 'rational',
            frac: root.value,
            complex: new Complex(root.value.toNumber(), 0),
            multiplicity: root.multiplicity || 1,
            text: fmt(root.value),
            exact: true,
          });
        } else {
          values.push({
            kind: root.imaginary ? 'complex' : 'radical',
            frac: null,
            radical: root,
            complex: root.complex,
            multiplicity: 1,
            text: ML.radicalText(root),
            exact: true,
          });
        }
      });
      if (quadratic.kind === 'complex') {
        notes.push(
          'Two eigenvalues are complex. That is perfectly normal for a real matrix — a rotation has no real ' +
            'eigenvector, because it leaves no direction pointing the same way.'
        );
      } else if (quadratic.kind === 'radical') {
        notes.push('Two eigenvalues are irrational; they are shown exactly using a square root.');
      }
    } else if (remainingDegree >= 3) {
      // No closed form is being claimed here — solve numerically and say so.
      const numeric = ML.rootsNumeric(found.remaining);
      residual = numeric.residual;
      allExact = false;
      clusterNumericRoots(numeric.roots).forEach(function (entry) {
        values.push({
          kind: 'numeric',
          frac: null,
          complex: entry.value,
          multiplicity: entry.multiplicity,
          text: entry.value.toString(),
          exact: false,
        });
      });
      notes.push(
        'After removing the exact rational roots, a degree-' + remainingDegree + ' factor remained. Polynomials of ' +
          'degree 3 and above have no general formula in radicals, so those roots were found numerically ' +
          '(largest residual ' + ML.fmtFixed(numeric.residual, 3) + '). Treat them as accurate approximations, ' +
          'not exact values.'
      );
      if (!numeric.converged) {
        notes.push(
          'The numerical root finder did not fully converge, so these values may be unreliable — most likely because ' +
            'the matrix has closely repeated eigenvalues.'
        );
      }
    } else if (!found.complete) {
      allExact = false;
      notes.push(
        'The coefficients were too large to factor for exact rational roots, so any remaining eigenvalues could not ' +
          'be found exactly.'
      );
    }

    // Present them in a predictable order — largest first, matching the usual
    // convention for singular values and dominant eigenvalues.
    values.sort(function (a, b) {
      if (Math.abs(a.complex.re - b.complex.re) > 1e-12) return b.complex.re - a.complex.re;
      return b.complex.im - a.complex.im;
    });

    if (steps) {
      steps.add('Step 4 — solve for λ', {
        text: describeRootStrategy(found, remainingDegree),
        list: values.map(function (value) {
          return 'λ = ' + value.text + (value.multiplicity > 1 ? '   (repeated ' + value.multiplicity + ' times)' : '') +
            (value.exact ? '' : '   (numerical)');
        }),
      });
    }

    return { polynomial: polynomial, values: values, allExact: allExact, residual: residual, notes: notes };
  }

  function describeRootStrategy(found, remainingDegree) {
    const parts = [];
    if (found.roots.length) {
      parts.push(
        'The rational root theorem finds every rational root exactly: a rational root p/q must have p dividing the ' +
          'constant term and q dividing the leading coefficient, so only finitely many candidates need testing.'
      );
    }
    if (remainingDegree === 2) {
      parts.push('A quadratic factor remained, which the quadratic formula solves in closed form.');
    } else if (remainingDegree >= 3) {
      parts.push('A factor of degree ' + remainingDegree + ' remained, which was solved numerically.');
    } else if (found.roots.length) {
      parts.push('Every root was found exactly, so these eigenvalues are exact.');
    }
    return parts.join(' ');
  }

  /**
   * Is this eigenvalue genuinely complex?
   *
   * Not the same as `kind === 'complex'`: a root found numerically is tagged
   * 'numeric' whether or not it turns out to have an imaginary part, so the
   * value itself has to be inspected. Getting this wrong would let a complex
   * eigenvalue be treated as real, which is exactly the kind of silently-wrong
   * answer MatrixLab must never produce.
   */
  function isComplexEigenvalue(value) {
    if (value.kind === 'complex') return true;
    return Math.abs(value.complex.im) > 1e-9 * Math.max(1, Math.abs(value.complex.re));
  }

  /** Group numerically-equal roots so multiplicity is reported once. */
  function clusterNumericRoots(roots) {
    const clusters = [];
    roots.forEach(function (root) {
      const match = clusters.find(function (cluster) {
        return cluster.value.sub(root).abs() <= 1e-6 * Math.max(1, root.abs());
      });
      if (match) match.multiplicity++;
      else clusters.push({ value: root, multiplicity: 1 });
    });
    return clusters;
  }

  /* ------------------------------------------------------------------ *
   * Eigenvectors
   * ------------------------------------------------------------------ */

  /**
   * A basis for the eigenspace of one eigenvalue.
   * @returns {{vectors: ML.Matrix[]|null, numericVectors: object[]|null, exact: boolean,
   *            geometric: number, shifted: ML.Matrix|null, note: string}}
   */
  function eigenvectorsFor(A, eigenvalue, steps) {
    const n = A.rows;

    if (eigenvalue.kind === 'rational') {
      const shifted = ML.subtractMatrices(A, ML.scalarMultiply(Matrix.identity(n), eigenvalue.frac));
      const record = ML.eliminate(shifted, { full: true, steps: steps, label: 'A − λI' });
      const vectors = record.freeColumns.map(function (freeColumn) {
        const values = new Array(n).fill(Frac.ZERO);
        values[freeColumn] = Frac.ONE;
        record.pivots.forEach(function (pivot) {
          values[pivot[1]] = record.matrix.get(pivot[0], freeColumn).neg();
        });
        return Matrix.column(scaleToIntegers(values));
      });

      if (steps) {
        steps.add('Solve (A − λI)v = 0 for λ = ' + eigenvalue.text, {
          text:
            'Subtracting λ from the diagonal makes the matrix singular, so it has a non-trivial null space. ' +
            'The null space is exactly the eigenspace: every non-zero vector in it is an eigenvector. There ' +
            (record.freeColumns.length === 1 ? 'is 1 free column' : 'are ' + record.freeColumns.length + ' free columns') +
            ', so the eigenspace has dimension ' + record.freeColumns.length + '.',
          matrices: vectors.map(function (vector, index) {
            return { matrix: vector, label: 'v' + ML.operations.subscript(index + 1) };
          }),
        });
      }

      return {
        vectors: vectors,
        numericVectors: null,
        exact: true,
        geometric: vectors.length,
        shifted: shifted,
        note:
          'Exact: the eigenvalue is rational, so the eigenspace was found by exact elimination. Any non-zero multiple ' +
          'of these vectors is also an eigenvector.',
      };
    }

    // Irrational or complex eigenvalue: work in complex float arithmetic.
    const lambda = eigenvalue.complex;
    const shiftedComplex = [];
    for (let i = 0; i < n; i++) {
      const row = [];
      for (let j = 0; j < n; j++) {
        const entry = Complex.of(A.get(i, j).toNumber());
        row.push(i === j ? entry.sub(lambda) : entry);
      }
      shiftedComplex.push(row);
    }
    const nullBasis = complexNullspace(shiftedComplex);

    return {
      vectors: null,
      numericVectors: nullBasis.map(function (vector) { return tidyComplexVector(vector); }),
      exact: false,
      geometric: nullBasis.length,
      shifted: null,
      note:
        eigenvalue.kind === 'complex'
          ? 'Numerical: this eigenvalue is complex, so its eigenvector has complex entries and is computed in ' +
            'floating point. The conjugate eigenvalue has the conjugate eigenvector.'
          : 'Numerical: this eigenvalue is irrational, so its eigenvector cannot be written with exact fractions and ' +
            'is computed in floating point.',
    };
  }

  /** Gaussian elimination over ℂ, returning a basis for the null space. */
  function complexNullspace(input, tol) {
    const m = input.length;
    const n = input[0].length;
    const A = input.map(function (row) { return row.slice(); });
    let scale = 0;
    A.forEach(function (row) {
      row.forEach(function (z) { scale = Math.max(scale, z.abs()); });
    });
    const epsilon = (tol == null ? 1e-9 : tol) * Math.max(1, scale);

    const pivots = [];
    let row = 0;
    for (let col = 0; col < n && row < m; col++) {
      let best = row;
      for (let i = row + 1; i < m; i++) if (A[i][col].abs() > A[best][col].abs()) best = i;
      if (A[best][col].abs() <= epsilon) continue;
      const temp = A[row];
      A[row] = A[best];
      A[best] = temp;
      const pivot = A[row][col];
      for (let j = 0; j < n; j++) A[row][j] = A[row][j].div(pivot);
      for (let i = 0; i < m; i++) {
        if (i === row) continue;
        const factor = A[i][col];
        if (factor.abs() <= 1e-300) continue;
        for (let j = 0; j < n; j++) A[i][j] = A[i][j].sub(factor.mul(A[row][j]));
      }
      pivots.push(col);
      row++;
    }

    const pivotSet = new Set(pivots);
    const basis = [];
    for (let free = 0; free < n; free++) {
      if (pivotSet.has(free)) continue;
      const vector = new Array(n).fill(Complex.ZERO);
      vector[free] = Complex.ONE;
      pivots.forEach(function (col, index) { vector[col] = A[index][free].neg(); });
      basis.push(vector);
    }
    return basis;
  }

  /** Scale a complex vector so its largest entry is a positive real 1-ish value. */
  function tidyComplexVector(vector) {
    let index = 0;
    let best = 0;
    vector.forEach(function (z, i) {
      if (z.abs() > best) {
        best = z.abs();
        index = i;
      }
    });
    if (best < 1e-300) return vector;
    const pivot = vector[index];
    return vector.map(function (z) {
      const scaled = z.div(pivot);
      return new Complex(ML.cleanFloat(scaled.re, 1e-10), ML.cleanFloat(scaled.im, 1e-10));
    });
  }

  /**
   * Clear denominators and common factors so an eigenvector reads like the one
   * in a textbook: (1, −2, 3) rather than (1/3, −2/3, 1).
   */
  function scaleToIntegers(values) {
    let multiplier = 1n;
    values.forEach(function (v) {
      const g = ML.bigGcd(multiplier, v.d);
      multiplier = (multiplier / g) * v.d;
    });
    const scaled = values.map(function (v) { return v.mul(Frac.of(multiplier)); });
    let common = 0n;
    scaled.forEach(function (v) { common = ML.bigGcd(common, v.n); });
    let result = common > 1n ? scaled.map(function (v) { return v.div(Frac.of(common)); }) : scaled;
    // Prefer a positive leading entry.
    const leading = result.find(function (v) { return !v.isZero(); });
    if (leading && leading.isNegative()) result = result.map(function (v) { return v.neg(); });
    return result;
  }

  /* ------------------------------------------------------------------ *
   * Full analysis
   * ------------------------------------------------------------------ */

  /**
   * Everything about the eigenstructure of A, including the honesty checks.
   * @returns {object}
   */
  function eigenAnalysis(A, steps) {
    ML.operations.requireSquare(A, 'Eigenvalue analysis');
    const n = A.rows;
    if (n > 8) {
      throw new MLError(
        'Eigenvalue analysis is limited to 8×8 in MatrixLab. Beyond that, the characteristic polynomial approach ' +
          'becomes unreliable and a proper numerical library (QR iteration with shifts) is the right tool.'
      );
    }

    const spectrum = eigenvalues(A, steps);
    const pairs = spectrum.values.map(function (value) {
      const vectors = eigenvectorsFor(A, value);
      return {
        eigenvalue: value,
        algebraic: value.multiplicity,
        geometric: vectors.geometric,
        vectors: vectors.vectors,
        numericVectors: vectors.numericVectors,
        exact: vectors.exact,
        note: vectors.note,
        defective: vectors.geometric < value.multiplicity,
        residuals: eigenpairResiduals(A, value, vectors),
      };
    });

    const totalAlgebraic = pairs.reduce(function (sum, pair) { return sum + pair.algebraic; }, 0);
    const totalGeometric = pairs.reduce(function (sum, pair) { return sum + pair.geometric; }, 0);
    const hasComplex = pairs.some(function (pair) { return isComplexEigenvalue(pair.eigenvalue); });

    // Trace and determinant give two independent checks on the eigenvalues.
    let sum = Complex.ZERO;
    let product = Complex.ONE;
    pairs.forEach(function (pair) {
      for (let k = 0; k < pair.algebraic; k++) {
        sum = sum.add(pair.eigenvalue.complex);
        product = product.mul(pair.eigenvalue.complex);
      }
    });
    const trace = ML.traceMatrix(A);
    const determinant = ML.determinant(A);
    const traceError = Math.abs(sum.re - trace.toNumber()) + Math.abs(sum.im);
    const detError = Math.abs(product.re - determinant.toNumber()) + Math.abs(product.im);
    const tolerance = spectrum.allExact ? 1e-9 : 1e-6;

    const checks = {
      traceMatches: traceError <= tolerance * Math.max(1, Math.abs(trace.toNumber())),
      detMatches: detError <= tolerance * Math.max(1, Math.abs(determinant.toNumber())),
      trace: trace,
      determinant: determinant,
      eigenvalueSum: sum,
      eigenvalueProduct: product,
    };

    if (steps) {
      steps.add('Check — trace and determinant', {
        text:
          'Two identities hold for any square matrix: the eigenvalues add up to the trace, and they multiply to the ' +
          'determinant. Both are independent of how the eigenvalues were found, so they make a strong check.',
        list: [
          'sum of eigenvalues = ' + sum.toString() + '   and   tr(A) = ' + fmt(trace) +
            '   → ' + (checks.traceMatches ? 'agree ✓' : 'DISAGREE ✗'),
          'product of eigenvalues = ' + product.toString() + '   and   det(A) = ' + fmt(determinant) +
            '   → ' + (checks.detMatches ? 'agree ✓' : 'DISAGREE ✗'),
        ],
        kind: checks.traceMatches && checks.detMatches ? 'info' : 'warn',
      });
    }

    const diagonalizable = totalGeometric === n;
    const reason = diagonalizable
      ? hasComplex
        ? 'The eigenvectors span the space, but some eigenvalues are complex, so A is diagonalisable over the complex ' +
          'numbers rather than the real ones.'
        : 'The eigenvectors span all of ℝ' + ML.operations.superscript(n) + ' (' + totalGeometric + ' independent ' +
          'eigenvectors for a ' + n + '×' + n + ' matrix), so A can be diagonalised.'
      : 'A is not diagonalisable. The eigenvectors span only ' + totalGeometric + ' of the ' + n +
        ' dimensions needed, because ' +
        pairs
          .filter(function (pair) { return pair.defective; })
          .map(function (pair) {
            return 'λ = ' + pair.eigenvalue.text + ' repeats ' + pair.algebraic + ' times but has only ' +
              pair.geometric + ' independent eigenvector' + (pair.geometric === 1 ? '' : 's');
          })
          .join('; ') + '.';

    return {
      matrix: A,
      polynomial: spectrum.polynomial,
      pairs: pairs,
      allExact: spectrum.allExact && pairs.every(function (pair) { return pair.exact; }),
      hasComplex: hasComplex,
      totalAlgebraic: totalAlgebraic,
      totalGeometric: totalGeometric,
      diagonalizable: diagonalizable,
      diagonalizableReason: reason,
      defect: n - totalGeometric,
      checks: checks,
      notes: spectrum.notes,
      residual: spectrum.residual,
    };
  }

  /** ‖Av − λv‖ for each eigenvector, so accuracy is visible. */
  function eigenpairResiduals(A, eigenvalue, vectors) {
    const residuals = [];
    if (vectors.vectors) {
      vectors.vectors.forEach(function (v) {
        const left = ML.multiplyMatrices(A, v);
        const right = ML.scalarMultiply(v, eigenvalue.frac);
        residuals.push(left.equals(right) ? 0 : Infinity);
      });
    } else if (vectors.numericVectors) {
      vectors.numericVectors.forEach(function (v) {
        let worst = 0;
        for (let i = 0; i < v.length; i++) {
          let sum = Complex.ZERO;
          for (let j = 0; j < v.length; j++) sum = sum.add(Complex.of(A.get(i, j).toNumber()).mul(v[j]));
          worst = Math.max(worst, sum.sub(eigenvalue.complex.mul(v[i])).abs());
        }
        residuals.push(worst);
      });
    }
    return residuals;
  }

  /* ------------------------------------------------------------------ *
   * Diagonalisation
   * ------------------------------------------------------------------ */

  /**
   * A = PDP⁻¹.
   * Exact when every eigenvalue is rational; numeric when they are irrational;
   * declined (with an explanation) when they are complex, because MatrixLab's
   * matrix display holds real numbers only.
   */
  function diagonalizeMatrix(A, steps) {
    const analysis = eigenAnalysis(A, steps);
    const n = A.rows;

    if (!analysis.diagonalizable) {
      return { diagonalizable: false, analysis: analysis, reason: analysis.diagonalizableReason };
    }

    if (analysis.hasComplex) {
      return {
        diagonalizable: true,
        overReals: false,
        analysis: analysis,
        reason:
          'A is diagonalisable over the complex numbers but not over the reals. P and D would need complex entries, ' +
          'and MatrixLab displays real matrices only — so the eigenvalues and eigenvectors are listed instead of ' +
          'being assembled into P and D.',
      };
    }

    const allRational = analysis.pairs.every(function (pair) { return pair.eigenvalue.kind === 'rational'; });

    if (allRational) {
      const columns = [];
      const diagonal = [];
      analysis.pairs.forEach(function (pair) {
        pair.vectors.forEach(function (vector) {
          columns.push(vector.colAt(0));
          diagonal.push(pair.eigenvalue.frac);
        });
      });
      const P = Matrix.fromColumns(columns);
      const D = Matrix.diagonal(diagonal);
      const Pinv = ML.inverseMatrix(P);
      const reconstructed = ML.multiplyMatrices(ML.multiplyMatrices(P, D), Pinv);
      const verified = reconstructed.equals(A);

      if (steps) {
        steps.add('Build P from the eigenvectors', {
          text:
            'Place the eigenvectors side by side as the columns of P, and the matching eigenvalues down the diagonal ' +
            'of D. Because the eigenvectors are independent, P is invertible.',
          matrices: [{ matrix: P, label: 'P' }, { matrix: D, label: 'D' }],
        });
        steps.add('Invert P', { matrix: Pinv, label: 'P⁻¹' });
        steps.add('Why this works', {
          text:
            'Column by column, AP = PD: applying A to eigenvector k gives λₖ times that eigenvector, which is exactly ' +
            'what multiplying P by the diagonal D does. Multiplying on the right by P⁻¹ turns AP = PD into A = PDP⁻¹.',
          math: 'AP = PD  ⟹  A = PDP⁻¹',
        });
        steps.result('Check', {
          text: verified
            ? 'Multiplying PDP⁻¹ back out reproduces A exactly, so the diagonalisation is confirmed.'
            : 'PDP⁻¹ did not reproduce A, so this result is not trustworthy.',
          matrix: reconstructed,
          label: 'PDP⁻¹',
        });
      }

      if (!verified) {
        throw new MLError('Internal check failed: PDP⁻¹ did not reproduce A, so the result has been withheld.');
      }
      return { diagonalizable: true, overReals: true, exact: true, P: P, D: D, Pinv: Pinv, analysis: analysis, verified: true };
    }

    // Real but irrational eigenvalues: assemble numerically and report accuracy.
    const columns = [];
    const diagonal = [];
    analysis.pairs.forEach(function (pair) {
      const vectors = pair.vectors
        ? pair.vectors.map(function (v) { return v.colAt(0).map(function (x) { return x.toNumber(); }); })
        : pair.numericVectors.map(function (v) { return v.map(function (z) { return z.re; }); });
      vectors.forEach(function (vector) {
        columns.push(vector.map(function (x) { return ML.cleanFloat(x); }));
        diagonal.push(ML.cleanFloat(pair.eigenvalue.complex.re));
      });
    });
    const P = Matrix.fromColumns(columns);
    const D = Matrix.diagonal(diagonal);
    let Pinv;
    try {
      Pinv = ML.inverseMatrix(P);
    } catch (error) {
      return {
        diagonalizable: true,
        overReals: true,
        exact: false,
        analysis: analysis,
        reason:
          'The eigenvectors are irrational, and after rounding them to decimals the matrix P came out numerically ' +
          'singular, so P⁻¹ could not be formed reliably. The eigenvalues and eigenvectors above are still valid.',
      };
    }
    const reconstructed = ML.multiplyMatrices(ML.multiplyMatrices(P, D), Pinv);
    let worst = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        worst = Math.max(worst, Math.abs(reconstructed.get(i, j).toNumber() - A.get(i, j).toNumber()));
      }
    }

    if (steps) {
      steps.add('Build P and D', {
        text:
          'The eigenvalues here are irrational, so P and D are built from decimal approximations. The reconstruction ' +
          'error below shows how close PDP⁻¹ comes to A.',
        matrices: [{ matrix: P, label: 'P' }, { matrix: D, label: 'D' }, { matrix: Pinv, label: 'P⁻¹' }],
      });
      steps.result('Check', {
        matrix: reconstructed,
        label: 'PDP⁻¹',
        text: 'Largest difference from A: ' + ML.fmtFixed(worst, 3) + '.',
      });
    }

    return {
      diagonalizable: true,
      overReals: true,
      exact: false,
      P: P,
      D: D,
      Pinv: Pinv,
      analysis: analysis,
      verified: worst < 1e-6,
      reconstructionError: worst,
    };
  }

  /** Convenience wrapper matching the documented API name. */
  function calculateEigenvalues(A, steps) {
    return eigenvalues(A, steps).values;
  }

  function calculateEigenvectors(A, steps) {
    return eigenAnalysis(A, steps).pairs;
  }

  const api = {
    characteristicPolynomial: characteristicPolynomial,
    eigenvalues: eigenvalues,
    eigenvectorsFor: eigenvectorsFor,
    eigenAnalysis: eigenAnalysis,
    diagonalizeMatrix: diagonalizeMatrix,
    calculateEigenvalues: calculateEigenvalues,
    calculateEigenvectors: calculateEigenvectors,
    complexNullspace: complexNullspace,
    isComplexEigenvalue: isComplexEigenvalue,
    scaleToIntegers: scaleToIntegers,
    evaluatePolynomialAtMatrix: evaluatePolynomialAtMatrix,
  };

  ML.eigen = api;
  Object.assign(ML, api);
})((globalThis.ML = globalThis.ML || {}));
