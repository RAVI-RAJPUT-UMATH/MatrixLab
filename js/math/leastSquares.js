/**
 * MatrixLab — least squares.
 *
 * When Ax = b has no solution, the next best thing is the x making Ax as close
 * to b as possible. The normal equations AᵗAx = Aᵗb express exactly that, and
 * because MatrixLab solves them in exact rational arithmetic the fitted line
 * for integer data comes out as exact fractions rather than decimals.
 */
(function (ML) {
  'use strict';

  const Matrix = ML.Matrix;
  const Frac = ML.Frac;
  const MLError = ML.MLError;
  const fmt = function (v) { return ML.fmt(v); };
  const sub = function (n) { return ML.operations.subscript(n); };

  /**
   * Solve Ax ≈ b in the least-squares sense.
   *
   * @returns {{solution: ML.Matrix|null, type: 'unique'|'infinite', normalMatrix: ML.Matrix,
   *            normalVector: ML.Matrix, projection: ML.Matrix, residual: ML.Matrix,
   *            residualNormSquared: ML.Frac, exactFit: boolean, rank: number,
   *            orthogonalityCheck: ML.Matrix, general: object|null}}
   */
  function leastSquares(A, b, steps) {
    ML.operations.requireMatrix(A, 'A');
    ML.operations.requireMatrix(b, 'b');
    if (b.cols !== 1) throw new MLError('The right-hand side b must be a single column.');
    if (A.rows !== b.rows) {
      throw new MLError(
        'A has ' + A.rows + ' rows but b has ' + b.rows + ' entries. There must be one equation per data point.'
      );
    }

    const transposed = ML.transposeMatrix(A);
    const normalMatrix = ML.multiplyMatrices(transposed, A);
    const normalVector = ML.multiplyMatrices(transposed, b);
    const rank = ML.matrixRank(A);

    if (steps) {
      steps.add('Step 1 — why an exact solution may not exist', {
        text:
          'Ax can only ever land inside the column space of A. If b lies outside that subspace no x solves Ax = b, so ' +
          'instead we look for the x whose Ax is closest to b.',
        matrix: ML.augment(A, b),
        label: '[A | b]',
        augmentAt: A.cols,
      });
      steps.add('Step 2 — the closest point is a projection', {
        text:
          'The closest point in the column space is the perpendicular projection of b onto it. That means the error ' +
          'b − Ax must be perpendicular to every column of A, which is written Aᵗ(b − Ax) = 0. Rearranged, this gives ' +
          'the normal equations.',
        math: 'AᵗA x = Aᵗb',
      });
      steps.add('Step 3 — build the normal equations', {
        matrices: [
          { matrix: normalMatrix, label: 'AᵗA' },
          { matrix: normalVector, label: 'Aᵗb' },
        ],
      });
    }

    const normalSolution = ML.solveLinearSystem(normalMatrix, normalVector, steps, {
      names: A.cols <= 4 ? ML.variableNames(A.cols) : null,
    });

    if (normalSolution.type === 'none') {
      // Impossible: the normal equations are always consistent. Guard anyway.
      throw new MLError(
        'The normal equations came out inconsistent, which cannot happen mathematically — the result has been withheld.'
      );
    }

    const solution = normalSolution.type === 'unique' ? normalSolution.solution : normalSolution.particular;
    const projection = ML.multiplyMatrices(A, solution);
    const residual = ML.subtractMatrices(b, projection);
    let residualNormSquared = Frac.ZERO;
    residual.colAt(0).forEach(function (value) { residualNormSquared = residualNormSquared.add(value.mul(value)); });
    const orthogonalityCheck = ML.multiplyMatrices(transposed, residual);
    const exactFit = residualNormSquared.isZero();

    if (steps) {
      steps.add('Step 4 — the fitted values and the error', {
        matrices: [
          { matrix: projection, label: 'Ax̂', caption: 'the projection of b' },
          { matrix: residual, label: 'b − Ax̂', caption: 'the error' },
        ],
        math: '‖b − Ax̂‖² = ' + fmt(residualNormSquared),
      });
      steps.result('Check — the error is perpendicular to every column', {
        matrix: orthogonalityCheck,
        label: 'Aᵗ(b − Ax̂)',
        text: ML.isZeroMatrix(orthogonalityCheck)
          ? 'Exactly zero, confirming x̂ really is the least-squares solution: no other x can do better, because the ' +
            'error cannot be reduced in any direction available to A.'
          : 'This should be zero — treat the result with suspicion.',
      });
      if (exactFit) {
        steps.add('A perfect fit', {
          text: 'The error is exactly zero, so b was already in the column space and Ax = b has a genuine solution.',
        });
      }
      if (normalSolution.type === 'infinite') {
        steps.add('Not a unique answer', {
          text:
            'The columns of A are dependent, so AᵗA is singular and infinitely many x give the same closest point. ' +
            'One of them is shown; adding anything from the null space of A changes x without changing Ax.',
          kind: 'warn',
        });
      }
    }

    return {
      A: A,
      b: b,
      solution: solution,
      type: normalSolution.type,
      normalMatrix: normalMatrix,
      normalVector: normalVector,
      normalSolution: normalSolution,
      projection: projection,
      residual: residual,
      residualNormSquared: residualNormSquared,
      residualNorm: Math.sqrt(residualNormSquared.toNumber()),
      exactFit: exactFit,
      rank: rank,
      fullColumnRank: rank === A.cols,
      orthogonalityCheck: orthogonalityCheck,
      general: normalSolution.type === 'infinite' ? normalSolution : null,
    };
  }

  /**
   * Fit y = c₀ + c₁x + … + c_d xᵈ through the given points by least squares.
   *
   * @param {Array<[*, *]>} points
   * @param {number} degree 1 for a straight line
   * @returns {object}
   */
  function fitPolynomial(points, degree, steps) {
    if (!points || points.length < 2) throw new MLError('At least two data points are needed for a fit.');
    const d = Math.max(0, Math.floor(degree == null ? 1 : degree));
    if (d + 1 > points.length) {
      throw new MLError(
        'Fitting a degree-' + d + ' polynomial needs at least ' + (d + 1) + ' points, but only ' + points.length +
          ' were given. With exactly ' + (d + 1) + ' points the curve passes through them all and there is nothing ' +
          'left to fit.'
      );
    }

    const xs = points.map(function (point, i) {
      try {
        return Frac.of(point[0]);
      } catch (error) {
        throw new MLError('Point ' + (i + 1) + ': the x value is not a number. ' + error.message);
      }
    });
    const ys = points.map(function (point, i) {
      try {
        return Frac.of(point[1]);
      } catch (error) {
        throw new MLError('Point ' + (i + 1) + ': the y value is not a number. ' + error.message);
      }
    });

    // Design matrix: one row per point, columns 1, x, x², …
    const rows = xs.map(function (x) {
      const row = [];
      for (let power = 0; power <= d; power++) row.push(x.pow(power));
      return row;
    });
    const A = Matrix.from(rows);
    const b = Matrix.column(ys);

    if (steps) {
      steps.add('Set up the design matrix', {
        text:
          'Each data point gives one equation. For a straight line y = c₀ + c₁x, the row for a point is [1, x] and the ' +
          'right-hand side is that point’s y. With more points than unknowns the system is normally unsolvable, which ' +
          'is exactly the situation least squares is for.',
        matrix: ML.augment(A, b),
        label: '[A | b]',
        augmentAt: A.cols,
      });
    }

    const result = leastSquares(A, b, steps);
    const coefficients = result.solution.colAt(0);

    // R² = 1 − SSres/SStot, exact.
    let mean = Frac.ZERO;
    ys.forEach(function (y) { mean = mean.add(y); });
    mean = mean.div(Frac.of(ys.length));
    let totalSum = Frac.ZERO;
    ys.forEach(function (y) {
      const deviation = y.sub(mean);
      totalSum = totalSum.add(deviation.mul(deviation));
    });
    const rSquared = totalSum.isZero() ? null : Frac.ONE.sub(result.residualNormSquared.div(totalSum));

    const equation = polynomialEquation(coefficients);

    if (steps) {
      steps.add('The fitted curve', {
        math: equation,
        text:
          rSquared
            ? 'R² = ' + fmt(rSquared) + ' ≈ ' + ML.fmtFixed(rSquared.toNumber(), 4) +
              '. This is the fraction of the variation in y that the fit accounts for; 1 would be a perfect fit.'
            : 'Every y value is identical, so R² is undefined (there is no variation to explain).',
      });
    }

    return {
      degree: d,
      coefficients: coefficients,
      equation: equation,
      points: points.map(function (point, i) { return { x: xs[i], y: ys[i] }; }),
      design: A,
      target: b,
      leastSquares: result,
      residuals: result.residual.colAt(0),
      residualNormSquared: result.residualNormSquared,
      rSquared: rSquared,
      /** Evaluate the fitted polynomial at a numeric x (for drawing). */
      evaluate: function (x) {
        let total = 0;
        for (let power = coefficients.length - 1; power >= 0; power--) {
          total = total * x + coefficients[power].toNumber();
        }
        return total;
      },
    };
  }

  function polynomialEquation(coefficients) {
    const parts = [];
    coefficients.forEach(function (c, power) {
      if (c.isZero() && coefficients.length > 1) return;
      const magnitude = c.abs();
      const coefficientText = magnitude.isOne() && power > 0 ? '' : fmt(magnitude);
      let body;
      if (power === 0) body = coefficientText;
      else if (power === 1) body = coefficientText + 'x';
      else body = coefficientText + 'x' + ML.operations.superscript(power);
      if (!parts.length) parts.push((c.isNegative() ? '−' : '') + body);
      else parts.push((c.isNegative() ? ' − ' : ' + ') + body);
    });
    return 'y = ' + (parts.length ? parts.join('') : '0');
  }

  /** Straight-line fit, with slope and intercept named. */
  function fitLine(points, steps) {
    const fit = fitPolynomial(points, 1, steps);
    return Object.assign(fit, {
      intercept: fit.coefficients[0],
      slope: fit.coefficients[1],
    });
  }

  const api = {
    leastSquares: leastSquares,
    fitPolynomial: fitPolynomial,
    fitLine: fitLine,
  };

  ML.leastSquaresModule = api;
  Object.assign(ML, api);
})((globalThis.ML = globalThis.ML || {}));
