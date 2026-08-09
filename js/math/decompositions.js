/**
 * MatrixLab — matrix factorisations.
 *
 * LU and PLU stay in exact rational arithmetic. QR, Cholesky and SVD need
 * square roots, so they run in float64 and every result is returned with the
 * reconstruction error, so accuracy is visible rather than assumed.
 *
 * Each function states its preconditions and refuses politely when they fail,
 * rather than returning something that looks like an answer.
 */
(function (ML) {
  'use strict';

  const Matrix = ML.Matrix;
  const Frac = ML.Frac;
  const MLError = ML.MLError;
  const fmt = function (v) { return ML.fmt(v); };
  const sub = function (n) { return ML.operations.subscript(n); };

  /** Largest difference between two same-sized matrices, as a float. */
  function maxDifference(X, Y) {
    let worst = 0;
    for (let i = 0; i < X.rows; i++) {
      for (let j = 0; j < X.cols; j++) {
        worst = Math.max(worst, Math.abs(X.get(i, j).toNumber() - Y.get(i, j).toNumber()));
      }
    }
    return worst;
  }

  /* ------------------------------------------------------------------ *
   * LU — exact, no pivoting
   * ------------------------------------------------------------------ */

  /**
   * A = LU with L unit lower triangular and U upper triangular. Exact.
   * Fails when a leading principal submatrix is singular — that is precisely
   * when no LU factorisation without row swaps exists.
   */
  function luDecomposition(A, steps) {
    ML.operations.requireSquare(A, 'LU decomposition');
    const n = A.rows;
    const L = ML.grid(n, n, Frac.ZERO);
    const U = ML.grid(n, n, Frac.ZERO);

    if (steps) {
      steps.add('Step 1 — what LU means', {
        text:
          'LU splits A into a lower triangular L with 1s on its diagonal and an upper triangular U. It is exactly a ' +
          'bookkeeping of Gaussian elimination: U is the echelon form, and L records the multipliers used to get there. ' +
          'Once you have it, solving Ax = b becomes two easy triangular solves.',
        math: 'A = LU',
        matrix: A,
        label: 'A =',
      });
    }

    for (let k = 0; k < n; k++) {
      L[k][k] = Frac.ONE;
      for (let j = k; j < n; j++) {
        let sum = A.get(k, j);
        for (let p = 0; p < k; p++) sum = sum.sub(L[k][p].mul(U[p][j]));
        U[k][j] = sum;
      }
      if (U[k][k].isZero()) {
        throw new MLError(
          'A plain LU decomposition does not exist for this matrix: the pivot at position ' + (k + 1) + ', ' + (k + 1) +
            ' is zero, so elimination would need a row swap. Use the PLU decomposition, which allows exactly that.',
          { hint: 'PLU factors PA = LU, where P records the row swaps.' }
        );
      }
      for (let i = k + 1; i < n; i++) {
        let sum = A.get(i, k);
        for (let p = 0; p < k; p++) sum = sum.sub(L[i][p].mul(U[p][k]));
        L[i][k] = sum.div(U[k][k]);
      }
      if (steps) {
        steps.add('Step ' + (k + 2) + ' — column ' + (k + 1), {
          text:
            'Row ' + (k + 1) + ' of U is what remains of row ' + (k + 1) + ' of A after subtracting the contributions ' +
            'already accounted for. The entries below the pivot in L are the multipliers elimination would use: each ' +
            'is the entry to be cleared divided by the pivot ' + fmt(U[k][k]) + '.',
          matrices: [
            { matrix: Matrix.fromGrid(ML.cloneGrid(L)), label: 'L so far' },
            { matrix: Matrix.fromGrid(ML.cloneGrid(U)), label: 'U so far' },
          ],
        });
      }
    }

    const Lm = Matrix.fromGrid(L);
    const Um = Matrix.fromGrid(U);
    const product = ML.multiplyMatrices(Lm, Um);
    const verified = product.equals(A);
    if (!verified) throw new MLError('Internal check failed: LU did not reproduce A, so the result has been withheld.');

    if (steps) {
      steps.result('Check — LU = A', {
        text: 'Multiplying the factors reproduces A exactly, and because the arithmetic is rational this is certain.',
        matrices: [{ matrix: Lm, label: 'L' }, { matrix: Um, label: 'U' }, { matrix: product, label: 'LU' }],
      });
    }

    return { L: Lm, U: Um, exact: true, verified: true, product: product };
  }

  /* ------------------------------------------------------------------ *
   * PLU — exact, with partial pivoting
   * ------------------------------------------------------------------ */

  /**
   * PA = LU. Exists for every square matrix, singular ones included.
   * @returns {{P: ML.Matrix, L: ML.Matrix, U: ML.Matrix, permutation: number[], swaps: number}}
   */
  function pluDecomposition(A, steps) {
    ML.operations.requireSquare(A, 'PLU decomposition');
    const n = A.rows;
    const work = A.toArray();
    const L = ML.grid(n, n, Frac.ZERO);
    const permutation = [];
    for (let i = 0; i < n; i++) permutation.push(i);
    let swaps = 0;
    const swapLog = [];

    for (let k = 0; k < n; k++) {
      // Choose a non-zero pivot, preferring ±1 to keep the fractions small.
      let best = -1;
      let bestScore = Infinity;
      for (let i = k; i < n; i++) {
        if (work[i][k].isZero()) continue;
        const size = work[i][k].n.toString().length + work[i][k].d.toString().length;
        const score = (work[i][k].abs().isOne() ? 0 : 100) + size;
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      }
      if (best < 0) continue; // an all-zero column: A is singular, but PLU still exists

      if (best !== k) {
        const rowTemp = work[k];
        work[k] = work[best];
        work[best] = rowTemp;
        const lTemp = L[k];
        L[k] = L[best];
        L[best] = lTemp;
        const pTemp = permutation[k];
        permutation[k] = permutation[best];
        permutation[best] = pTemp;
        swaps++;
        swapLog.push('R' + (k + 1) + ' ↔ R' + (best + 1));
      }

      for (let i = k + 1; i < n; i++) {
        if (work[i][k].isZero()) continue;
        const multiplier = work[i][k].div(work[k][k]);
        L[i][k] = multiplier;
        for (let j = k; j < n; j++) work[i][j] = work[i][j].sub(multiplier.mul(work[k][j]));
      }
    }

    for (let i = 0; i < n; i++) L[i][i] = Frac.ONE;

    // P is the identity with its rows in the order recorded.
    const pData = ML.grid(n, n, Frac.ZERO);
    permutation.forEach(function (source, target) { pData[target][source] = Frac.ONE; });

    const P = Matrix.fromGrid(pData);
    const Lm = Matrix.fromGrid(L);
    const Um = Matrix.fromGrid(work);
    const left = ML.multiplyMatrices(P, A);
    const right = ML.multiplyMatrices(Lm, Um);
    const verified = left.equals(right);
    if (!verified) {
      throw new MLError('Internal check failed: PA did not equal LU, so the result has been withheld.');
    }

    if (steps) {
      steps.add('Step 1 — why P is needed', {
        text:
          'Plain LU breaks down as soon as a pivot is zero. Allowing row swaps fixes that, and the swaps are recorded ' +
          'in a permutation matrix P. The identity becomes PA = LU: the same factorisation, applied to a reordering of ' +
          'the rows of A.',
        math: 'PA = LU',
        matrix: A,
        label: 'A =',
      });
      steps.add('Step 2 — the row swaps used', {
        text: swaps ? 'Elimination needed ' + swaps + ' swap' + (swaps === 1 ? '' : 's') + '.' : 'No swaps were needed, so P is the identity.',
        list: swapLog.length ? swapLog : null,
        matrix: P,
        label: 'P',
      });
      steps.add('Step 3 — the factors', {
        matrices: [{ matrix: Lm, label: 'L' }, { matrix: Um, label: 'U' }],
      });
      steps.result('Check — PA = LU', {
        matrices: [{ matrix: left, label: 'PA' }, { matrix: right, label: 'LU' }],
        text: 'The two agree exactly.',
      });
    }

    return {
      P: P,
      L: Lm,
      U: Um,
      permutation: permutation,
      swaps: swaps,
      exact: true,
      verified: true,
      determinant: (function () {
        let product = swaps % 2 === 0 ? Frac.ONE : Frac.MINUS_ONE;
        for (let i = 0; i < n; i++) product = product.mul(Um.get(i, i));
        return product;
      })(),
    };
  }

  /* ------------------------------------------------------------------ *
   * QR — numeric
   * ------------------------------------------------------------------ */

  /**
   * A = QR with Q having orthonormal columns and R upper triangular.
   * Orthonormal columns need square roots, so this is computed in float64.
   *
   * @param {object} [options] {method: 'householder'|'gram-schmidt', full: boolean}
   */
  function qrDecomposition(A, steps, options) {
    ML.operations.requireMatrix(A, 'A');
    const opts = options || {};
    const method = opts.method === 'gram-schmidt' ? 'gram-schmidt' : 'householder';
    const m = A.rows;
    const n = A.cols;
    if (m < n) {
      throw new MLError(
        'QR as MatrixLab presents it needs at least as many rows as columns (this matrix is ' + A.size() + '). ' +
          'With more columns than rows the columns cannot be independent, so there is no orthonormal basis of n columns.'
      );
    }

    const floats = A.toFloat();
    let Q;
    let R;
    let rank = null;
    let dependent = [];

    if (method === 'gram-schmidt') {
      const result = ML.gramSchmidtQR(floats);
      Q = result.Q;
      R = result.R;
      rank = result.rank;
      dependent = result.dependent;
    } else {
      const result = ML.householderQR(floats);
      // Take the thin factors: the first n columns of Q, the first n rows of R.
      Q = result.Q.map(function (row) { return row.slice(0, n); });
      R = result.R.slice(0, n).map(function (row) { return row.slice(); });
    }

    const Qm = ML.floatToMatrix(Q);
    const Rm = ML.floatToMatrix(R);
    const product = ML.floatToMatrix(ML.multiplyFloat(Q, R));
    const orthogonality = ML.floatToMatrix(ML.multiplyFloat(ML.transposeFloat(Q), Q));
    const error = maxDifference(product, A);
    const orthogonalityError = maxDifference(orthogonality, Matrix.identity(n));

    if (steps) {
      steps.add('Step 1 — what QR does', {
        text:
          'QR replaces the columns of A by an orthonormal set spanning the same space. Q holds those perpendicular unit ' +
          'columns, and R records how to rebuild the original columns from them — which is why R comes out upper ' +
          'triangular: column k of A only needs the first k orthonormal directions.',
        math: 'A = QR,   QᵗQ = I,   R upper triangular',
        matrix: A,
        label: 'A =',
      });
      steps.add('Step 2 — the method', {
        text:
          method === 'gram-schmidt'
            ? 'Modified Gram–Schmidt: orthogonalise each column against the previous ones, then normalise. This is the ' +
              'version done by hand. MatrixLab runs the orthogonalisation twice per column, which recovers the accuracy ' +
              'the plain method loses when columns are nearly parallel.'
            : 'Householder reflections: each step reflects the remaining sub-column onto a coordinate axis, zeroing ' +
              'everything below the diagonal. This is what numerical libraries use, because reflections never amplify ' +
              'rounding error.',
      });
      steps.add('Step 3 — the factors', {
        matrices: [{ matrix: Qm, label: 'Q' }, { matrix: Rm, label: 'R' }],
        note: 'Square roots are unavoidable here, so these entries are decimal approximations.',
      });
      steps.result('Check', {
        matrices: [{ matrix: product, label: 'QR' }, { matrix: orthogonality, label: 'QᵗQ' }],
        text:
          'QR reproduces A to within ' + ML.fmtFixed(error, 3) + ', and QᵗQ differs from the identity by at most ' +
          ML.fmtFixed(orthogonalityError, 3) + '. Both are at the level of floating-point rounding.',
      });
    }

    return {
      Q: Qm,
      R: Rm,
      method: method,
      exact: false,
      product: product,
      orthogonality: orthogonality,
      error: error,
      orthogonalityError: orthogonalityError,
      verified: error < 1e-9,
      rank: rank,
      dependentColumns: dependent,
    };
  }

  /* ------------------------------------------------------------------ *
   * Cholesky — numeric, with exact preconditions
   * ------------------------------------------------------------------ */

  /**
   * A = LLᵗ for symmetric positive definite A. Symmetry and definiteness are
   * checked exactly first, so the verdict is certain even though L is numeric.
   */
  function choleskyDecomposition(A, steps) {
    ML.operations.requireSquare(A, 'Cholesky decomposition');

    if (steps) {
      steps.add('Step 1 — check the conditions', {
        text:
          'Cholesky applies only to symmetric positive definite matrices. Symmetry is easy to check by eye; positive ' +
          'definiteness is checked here by Sylvester’s criterion — every leading principal minor must be positive — ' +
          'computed in exact arithmetic so the verdict is certain.',
        matrix: A,
        label: 'A =',
      });
    }

    if (!ML.isSymmetric(A)) {
      const bad = ML.firstAsymmetry(A);
      throw new MLError(
        'Cholesky needs a symmetric matrix, but a' + sub(bad[0] + 1) + sub(bad[1] + 1) + ' = ' +
          fmt(A.get(bad[0], bad[1])) + ' while a' + sub(bad[1] + 1) + sub(bad[0] + 1) + ' = ' +
          fmt(A.get(bad[1], bad[0])) + '.',
        { hint: 'For a non-symmetric matrix use LU or QR instead.' }
      );
    }

    const minors = [];
    for (let k = 1; k <= A.rows; k++) minors.push(ML.determinant(A.slice(0, k, 0, k)));
    const badMinor = minors.findIndex(function (value) { return !value.isPositive(); });

    if (steps) {
      steps.add('Step 2 — leading principal minors', {
        list: minors.map(function (value, k) {
          return 'top-left ' + (k + 1) + '×' + (k + 1) + ' determinant = ' + fmt(value) +
            (value.isPositive() ? '  ✓' : '  ✗ not positive');
        }),
      });
    }

    if (badMinor >= 0) {
      throw new MLError(
        'A is symmetric but not positive definite: the leading ' + (badMinor + 1) + '×' + (badMinor + 1) +
          ' determinant is ' + fmt(minors[badMinor]) + ', which is not positive. Cholesky would need the square root ' +
          'of a non-positive number, so no real L exists.',
        {
          hint:
            'Positive definite matrices arise as AᵗA for a full-rank A, or as covariance matrices. Try [[4,2],[2,3]].',
        }
      );
    }

    const result = ML.choleskyFloat(A.toFloat());
    if (!result.ok) {
      throw new MLError('Cholesky failed unexpectedly: ' + result.reason);
    }

    const L = ML.floatToMatrix(result.L);
    const Lt = ML.transposeMatrix(L);
    const product = ML.multiplyMatrices(L, Lt);
    const error = maxDifference(product, A);

    if (steps) {
      steps.add('Step 3 — build L one row at a time', {
        text:
          'Comparing entries of A with entries of LLᵗ gives each entry of L in turn. The diagonal entries are square ' +
          'roots, which is where exactness is lost — everything above was exact.',
        math: 'ℓᵢᵢ = √(aᵢᵢ − Σₖ ℓᵢₖ²),    ℓᵢⱼ = (aᵢⱼ − Σₖ ℓᵢₖℓⱼₖ) / ℓⱼⱼ',
        matrix: L,
        label: 'L',
      });
      steps.result('Check — LLᵗ = A', {
        matrices: [{ matrix: L, label: 'L' }, { matrix: Lt, label: 'Lᵗ' }, { matrix: product, label: 'LLᵗ' }],
        text: 'Reproduces A to within ' + ML.fmtFixed(error, 3) + '.',
      });
      steps.add('Why it is worth having', {
        text:
          'Cholesky costs about half as much work as LU and is unconditionally stable for positive definite matrices. ' +
          'It is the standard tool for solving normal equations in least squares, for sampling from multivariate ' +
          'normal distributions, and anywhere a covariance matrix needs a square root.',
      });
    }

    return {
      L: L,
      Lt: Lt,
      product: product,
      error: error,
      exact: false,
      verified: error < 1e-9,
      minors: minors,
    };
  }

  /* ------------------------------------------------------------------ *
   * SVD — numeric
   * ------------------------------------------------------------------ */

  /**
   * A = UΣVᵗ (thin form), by one-sided Jacobi.
   * @returns {object}
   */
  function svdDecomposition(A, steps) {
    ML.operations.requireMatrix(A, 'A');
    const m = A.rows;
    const n = A.cols;
    const k = Math.min(m, n);

    if (steps) {
      steps.add('Step 1 — what SVD says', {
        text:
          'Every matrix, of any shape, factors as A = UΣVᵗ with U and V orthogonal and Σ diagonal with non-negative ' +
          'entries. Read right to left: Vᵗ rotates, Σ stretches each axis by a singular value, U rotates again. So every ' +
          'linear map is a rotation, then a scaling, then another rotation.',
        math: 'A = U Σ Vᵗ',
        matrix: A,
        label: 'A =',
      });
    }

    const result = ML.svd(A.toFloat());
    const singular = result.singular.slice(0, k).map(function (value) { return ML.cleanFloat(value, 1e-12); });

    const U = ML.floatToMatrix(result.U);
    const V = ML.floatToMatrix(result.V);
    const Vt = ML.transposeMatrix(V);
    const sigmaGrid = ML.grid(U.cols, V.cols, Frac.ZERO);
    for (let i = 0; i < Math.min(sigmaGrid.length, singular.length); i++) {
      sigmaGrid[i][i] = Frac.of(singular[i]);
    }
    const Sigma = Matrix.fromGrid(sigmaGrid);

    const product = ML.multiplyMatrices(ML.multiplyMatrices(U, Sigma), Vt);
    const error = maxDifference(product, A);
    const largest = singular[0] || 0;
    const smallest = singular[result.rank - 1];
    const condition = result.rank === k && smallest > 0 ? largest / smallest : Infinity;

    if (steps) {
      steps.add('Step 2 — the singular values', {
        text:
          'The singular values are the amounts by which A stretches its principal directions, always listed largest ' +
          'first. They are the square roots of the eigenvalues of AᵗA, and MatrixLab finds them by rotating pairs of ' +
          'columns until they are mutually perpendicular (one-sided Jacobi).',
        list: singular.map(function (value, index) {
          return 'σ' + sub(index + 1) + ' = ' + ML.fmtFixed(value, ML.config.decimals) +
            (value <= 1e-10 ? '   (effectively zero)' : '');
        }),
      });
      steps.add('Step 3 — the factors', {
        matrices: [
          { matrix: U, label: 'U' },
          { matrix: Sigma, label: 'Σ' },
          { matrix: Vt, label: 'Vᵗ' },
        ],
        note: 'Singular values are square roots, so these are decimal approximations.',
      });
      steps.result('Check — UΣVᵗ = A', {
        matrix: product,
        label: 'UΣVᵗ',
        text:
          'Reproduces A to within ' + ML.fmtFixed(error, 3) + '. The number of non-zero singular values is ' +
          result.rank + ', which is the rank of A — and this is the numerically reliable way to find a rank.',
      });
    }

    /** Best rank-r approximation: keep the r largest singular values. */
    const lowRank = function (r) {
      const limit = Math.max(0, Math.min(r, singular.length));
      const grid = ML.grid(U.cols, V.cols, Frac.ZERO);
      for (let i = 0; i < limit; i++) grid[i][i] = Frac.of(singular[i]);
      const truncated = Matrix.fromGrid(grid);
      const approximation = ML.multiplyMatrices(ML.multiplyMatrices(U, truncated), Vt);
      // Eckart–Young: the error in the Frobenius norm is the tail of the singular values.
      let tail = 0;
      for (let i = limit; i < singular.length; i++) tail += singular[i] * singular[i];
      return { rank: limit, matrix: approximation, frobeniusError: Math.sqrt(tail) };
    };

    return {
      U: U,
      Sigma: Sigma,
      V: V,
      Vt: Vt,
      singular: singular,
      rank: result.rank,
      condition: condition,
      product: product,
      error: error,
      exact: false,
      verified: error < 1e-8,
      converged: result.converged,
      sweeps: result.sweeps,
      lowRank: lowRank,
    };
  }

  const api = {
    luDecomposition: luDecomposition,
    pluDecomposition: pluDecomposition,
    qrDecomposition: qrDecomposition,
    choleskyDecomposition: choleskyDecomposition,
    svdDecomposition: svdDecomposition,
  };

  ML.decompositions = api;
  Object.assign(ML, api);
})((globalThis.ML = globalThis.ML || {}));
