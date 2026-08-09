/**
 * MatrixLab — matrix inverse.
 *
 * Two genuine methods, both exact:
 *   • adjugate:  A⁻¹ = adj(A)/det(A) — the formula, best for 2×2 and 3×3;
 *   • Gauss–Jordan on [A | I] — the practical method for anything larger.
 * Whichever runs, the result is verified against A·A⁻¹ = I before it is
 * returned, and because the arithmetic is exact that check is decisive.
 */
(function (ML) {
  'use strict';

  const Matrix = ML.Matrix;
  const Frac = ML.Frac;
  const MLError = ML.MLError;
  const fmt = function (v) { return ML.fmt(v); };

  /** Refuse politely rather than freeze the page. */
  const ADJUGATE_LIMIT = 6;

  function singularError(A, det) {
    return new MLError(
      'This matrix is singular: its determinant is 0, so it has no inverse. ' +
        'Geometrically it squashes ' + (A.rows === 2 ? 'the plane onto a line (or a point)' : 'space into a lower dimension') +
        ', and that cannot be undone.',
      {
        hint:
          'Singular matrices have dependent rows or columns. Check whether one row is a multiple or a sum of the others.',
        determinant: det,
      }
    );
  }

  /**
   * A⁻¹
   * @param {ML.Matrix} A
   * @param {ML.StepLog} [steps]
   * @param {object} [options] {method: 'auto'|'adjugate'|'gauss-jordan', verify: boolean}
   * @returns {ML.Matrix}
   */
  function inverseMatrix(A, steps, options) {
    ML.operations.requireSquare(A, 'The inverse');
    const opts = options || {};
    const method = opts.method || 'auto';
    if (method === 'adjugate') return inverseByAdjugate(A, steps, opts);
    if (method === 'gauss-jordan') return inverseByGaussJordan(A, steps, opts);
    return A.rows <= 3 ? inverseByAdjugate(A, steps, opts) : inverseByGaussJordan(A, steps, opts);
  }

  /** A⁻¹ = adj(A) / det(A) */
  function inverseByAdjugate(A, steps, options) {
    ML.operations.requireSquare(A, 'The inverse');
    const n = A.rows;
    if (n > ADJUGATE_LIMIT) {
      throw new MLError(
        'The adjugate formula needs a determinant for every one of the ' + n * n + ' entries, which is far too slow ' +
          'at ' + A.size() + '. Use the Gauss–Jordan method instead — it gives the same exact answer.',
        { hint: 'The adjugate route is offered up to ' + ADJUGATE_LIMIT + '×' + ADJUGATE_LIMIT + '.' }
      );
    }

    const det = ML.determinant(A);
    if (steps) {
      steps.add('Step 1 — is it invertible?', {
        text:
          'A square matrix has an inverse exactly when its determinant is non-zero, so the determinant comes first.',
        math: 'det(A) = ' + fmt(det),
        matrix: A,
        label: 'A =',
      });
    }
    if (det.isZero()) throw singularError(A, det);

    if (n === 1) {
      const result = Matrix.from([[det.inv()]]);
      if (steps) {
        steps.result('Inverse', {
          matrix: result,
          label: 'A⁻¹',
          math: 'A⁻¹ = [1/' + fmt(det) + ']',
          text: 'For a 1×1 matrix the inverse is just the reciprocal.',
        });
      }
      return result;
    }

    if (steps) {
      steps.add('Step 2 — the formula', {
        text:
          'The adjugate route builds the inverse from determinants of smaller blocks. Find every minor, attach the ' +
          'chequerboard signs to get the cofactors, transpose them to get the adjugate, then divide by det(A).',
        math: 'A⁻¹ = (1 / det(A)) · adj(A)',
      });
    }

    const minors = ML.minorMatrix(A);
    if (steps) {
      steps.add('Step 3 — matrix of minors', {
        text: 'Mᵢⱼ is the determinant left after deleting row i and column j.',
        matrix: minors,
        label: 'M',
      });
    }

    const cofactors = A.map(function (value, i, j) {
      const sign = (i + j) % 2 === 0 ? Frac.ONE : Frac.MINUS_ONE;
      return minors.data[i][j].mul(sign);
    });
    if (steps) {
      steps.add('Step 4 — apply the signs to get cofactors', {
        text: 'Cᵢⱼ = (−1)^(i+j)·Mᵢⱼ — a chequerboard of + and − starting from + at the top-left.',
        matrix: cofactors,
        label: 'C',
      });
    }

    const adjugate = ML.transposeMatrix(cofactors);
    if (steps) {
      steps.add('Step 5 — transpose to get the adjugate', {
        text: 'adj(A) = Cᵗ. This matrix satisfies A·adj(A) = det(A)·I, which is the reason the next step works.',
        matrix: adjugate,
        label: 'adj(A)',
      });
    }

    const result = ML.scalarMultiply(adjugate, det.inv());
    if (steps) {
      steps.add('Step 6 — divide by the determinant', {
        text: 'Dividing every entry of the adjugate by det(A) = ' + fmt(det) + ' turns A·adj(A) = det(A)·I into A·A⁻¹ = I.',
        math: 'A⁻¹ = (1/' + fmt(det) + ')·adj(A)',
        matrix: result,
        label: 'A⁻¹',
      });
    }

    verify(A, result, steps, options);
    return result;
  }

  /** Row-reduce [A | I] until the left half is I; the right half is A⁻¹. */
  function inverseByGaussJordan(A, steps, options) {
    ML.operations.requireSquare(A, 'The inverse');
    const n = A.rows;
    const augmented = ML.augment(A, Matrix.identity(n));

    if (steps) {
      steps.add('Step 1 — set up [A | I]', {
        text:
          'Write A next to the identity matrix. Every row operation is applied to both halves at once. Whatever ' +
          'sequence of operations turns A into I does the same job as multiplying by A⁻¹ — so it turns I into A⁻¹.',
        matrix: augmented,
        label: '[A | I]',
        augmentAt: n,
      });
    }

    const record = ML.eliminate(augmented, {
      full: true,
      steps: steps,
      label: '[A | I]',
      augmentAt: n,
      pivotColumns: n,
    });

    if (record.rank < n) {
      throw singularError(A, Frac.ZERO);
    }

    const result = record.matrix.slice(0, n, n, 2 * n);
    if (steps) {
      steps.result('Read off the inverse', {
        text:
          'The left half is now the identity, so the right half is A⁻¹. This works for any size and needs about n³ ' +
          'operations — vastly less than the adjugate formula.',
        matrices: [
          { matrix: record.matrix.slice(0, n, 0, n), label: 'left half = I' },
          { matrix: result, label: 'A⁻¹' },
        ],
      });
    }

    verify(A, result, steps, options);
    return result;
  }

  /** Exact check that the answer really is the inverse. */
  function verify(A, inverse, steps, options) {
    const product = ML.multiplyMatrices(A, inverse);
    const identity = Matrix.identity(A.rows);
    if (!product.equals(identity)) {
      // Exact arithmetic makes this unreachable in practice; if it ever fires,
      // saying so is far better than returning a wrong inverse.
      throw new MLError(
        'Internal check failed: A·A⁻¹ did not come out as the identity matrix, so the result is not trustworthy ' +
          'and has been withheld.'
      );
    }
    if (steps && (!options || options.verify !== false)) {
      steps.add('Check', {
        text: 'Multiplying A by the result gives exactly the identity matrix, so the inverse is confirmed.',
        matrices: [{ matrix: product, label: 'A · A⁻¹ = I' }],
      });
    }
    return true;
  }

  /**
   * Solve A⁻¹ without forming it — used by the equation solver when the
   * inverse method is requested.
   */
  function inverseTimesVector(A, b, steps) {
    const inverse = inverseMatrix(A, steps);
    return ML.multiplyMatrices(inverse, b);
  }

  const api = {
    inverseMatrix: inverseMatrix,
    inverseByAdjugate: inverseByAdjugate,
    inverseByAdjoint: inverseByAdjugate,
    inverseByGaussJordan: inverseByGaussJordan,
    inverseTimesVector: inverseTimesVector,
    ADJUGATE_LIMIT: ADJUGATE_LIMIT,
  };

  ML.inverseModule = api;
  Object.assign(ML, api);
})((globalThis.ML = globalThis.ML || {}));
