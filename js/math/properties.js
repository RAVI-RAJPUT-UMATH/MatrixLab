/**
 * MatrixLab — matrix classification and properties.
 *
 * Each test returns a plain boolean, and the analyser additionally reports
 * *why*: the entries that make a matrix symmetric, or the specific pair that
 * stops it from being. Naming the witness is the difference between a checkbox
 * and an explanation.
 */
(function (ML) {
  'use strict';

  const Matrix = ML.Matrix;
  const Frac = ML.Frac;
  const fmt = function (v) { return ML.fmt(v); };
  const sub = function (n) { return ML.operations.subscript(n); };

  function entryName(i, j) {
    return 'a' + sub(i + 1) + sub(j + 1);
  }

  /* ------------------------------------------------------------------ *
   * Shape
   * ------------------------------------------------------------------ */

  function isSquare(A) {
    return A.rows === A.cols;
  }

  function isRectangular(A) {
    return A.rows !== A.cols;
  }

  function isRowMatrix(A) {
    return A.rows === 1;
  }

  function isColumnMatrix(A) {
    return A.cols === 1;
  }

  /* ------------------------------------------------------------------ *
   * Entry patterns
   * ------------------------------------------------------------------ */

  function isZeroMatrix(A) {
    return A.data.every(function (row) {
      return row.every(function (v) { return v.isZero(); });
    });
  }

  function isIdentity(A) {
    if (!isSquare(A)) return false;
    for (let i = 0; i < A.rows; i++) {
      for (let j = 0; j < A.cols; j++) {
        const value = A.data[i][j];
        if (i === j ? !value.isOne() : !value.isZero()) return false;
      }
    }
    return true;
  }

  function isDiagonal(A) {
    if (!isSquare(A)) return false;
    for (let i = 0; i < A.rows; i++) {
      for (let j = 0; j < A.cols; j++) {
        if (i !== j && !A.data[i][j].isZero()) return false;
      }
    }
    return true;
  }

  function isScalarMatrix(A) {
    if (!isDiagonal(A)) return false;
    const first = A.get(0, 0);
    for (let i = 1; i < A.rows; i++) if (!A.get(i, i).eq(first)) return false;
    return true;
  }

  /** First position where aᵢⱼ ≠ aⱼᵢ, or null. */
  function firstAsymmetry(A) {
    if (!isSquare(A)) return null;
    for (let i = 0; i < A.rows; i++) {
      for (let j = i + 1; j < A.cols; j++) {
        if (!A.data[i][j].eq(A.data[j][i])) return [i, j];
      }
    }
    return null;
  }

  function isSymmetric(A) {
    return isSquare(A) && firstAsymmetry(A) === null;
  }

  function isSkewSymmetric(A) {
    if (!isSquare(A)) return false;
    for (let i = 0; i < A.rows; i++) {
      if (!A.data[i][i].isZero()) return false; // the diagonal must vanish
      for (let j = i + 1; j < A.cols; j++) {
        if (!A.data[i][j].eq(A.data[j][i].neg())) return false;
      }
    }
    return true;
  }

  function isUpperTriangular(A) {
    if (!isSquare(A)) return false;
    for (let i = 1; i < A.rows; i++) {
      for (let j = 0; j < i; j++) if (!A.data[i][j].isZero()) return false;
    }
    return true;
  }

  function isLowerTriangular(A) {
    if (!isSquare(A)) return false;
    for (let i = 0; i < A.rows; i++) {
      for (let j = i + 1; j < A.cols; j++) if (!A.data[i][j].isZero()) return false;
    }
    return true;
  }

  function isTriangular(A) {
    return isUpperTriangular(A) || isLowerTriangular(A);
  }

  /** Exactly one 1 in every row and column, zeros elsewhere. */
  function isPermutationMatrix(A) {
    if (!isSquare(A)) return false;
    const columnUsed = new Set();
    for (let i = 0; i < A.rows; i++) {
      let ones = 0;
      let at = -1;
      for (let j = 0; j < A.cols; j++) {
        const value = A.data[i][j];
        if (value.isOne()) {
          ones++;
          at = j;
        } else if (!value.isZero()) return false;
      }
      if (ones !== 1 || columnUsed.has(at)) return false;
      columnUsed.add(at);
    }
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Behaviour under multiplication
   * ------------------------------------------------------------------ */

  function isSingular(A) {
    if (!isSquare(A)) return null; // undefined for non-square matrices
    return ML.determinant(A).isZero();
  }

  function isNonSingular(A) {
    const singular = isSingular(A);
    return singular === null ? null : !singular;
  }

  /** AᵗA = I — the columns are orthonormal. */
  function isOrthogonal(A) {
    if (!isSquare(A)) return false;
    return ML.multiplyMatrices(ML.transposeMatrix(A), A).equals(Matrix.identity(A.rows));
  }

  /** A² = A — projections are the standard example. */
  function isIdempotent(A) {
    if (!isSquare(A)) return false;
    return ML.multiplyMatrices(A, A).equals(A);
  }

  /** A² = I — the matrix is its own inverse. */
  function isInvolutory(A) {
    if (!isSquare(A)) return false;
    return ML.multiplyMatrices(A, A).equals(Matrix.identity(A.rows));
  }

  /**
   * Nilpotent: Aᵏ = 0 for some k. If it happens at all it happens by k = n.
   * @returns {{nilpotent: boolean, index: number|null}}
   */
  function nilpotencyIndex(A) {
    if (!isSquare(A)) return { nilpotent: false, index: null };
    if (isZeroMatrix(A)) return { nilpotent: true, index: 1 };
    let power = A;
    for (let k = 2; k <= A.rows; k++) {
      power = ML.multiplyMatrices(power, A);
      if (isZeroMatrix(power)) return { nilpotent: true, index: k };
    }
    return { nilpotent: false, index: null };
  }

  function isNilpotent(A) {
    return nilpotencyIndex(A).nilpotent;
  }

  /**
   * Sylvester's criterion, done exactly: a symmetric matrix is positive
   * definite exactly when every leading principal minor is positive.
   */
  function isPositiveDefinite(A) {
    if (!isSymmetric(A)) return false;
    for (let k = 1; k <= A.rows; k++) {
      if (!ML.determinant(A.slice(0, k, 0, k)).isPositive()) return false;
    }
    return true;
  }

  function isPositiveSemiDefinite(A) {
    if (!isSymmetric(A)) return false;
    // All principal minors (not just leading ones) must be ≥ 0.
    const n = A.rows;
    for (let mask = 1; mask < 1 << n; mask++) {
      const indices = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) indices.push(i);
      const data = indices.map(function (i) {
        return indices.map(function (j) { return A.data[i][j]; });
      });
      if (ML.determinant(Matrix.fromGrid(data)).isNegative()) return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Norms
   * ------------------------------------------------------------------ */

  /**
   * ‖A‖F = √(Σ aᵢⱼ²). The sum of squares is exact; the square root is given
   * exactly when it is rational and numerically otherwise.
   * @returns {{squared: ML.Frac, exact: ML.Frac|null, value: number}}
   */
  function frobeniusNorm(A) {
    let sum = Frac.ZERO;
    A.data.forEach(function (row) {
      row.forEach(function (v) { sum = sum.add(v.mul(v)); });
    });
    const exact = sum.sqrtExact();
    return { squared: sum, exact: exact, value: exact ? exact.toNumber() : Math.sqrt(sum.toNumber()) };
  }

  /** ‖A‖₁ — the largest absolute column sum. */
  function oneNorm(A) {
    let best = Frac.ZERO;
    for (let j = 0; j < A.cols; j++) {
      let sum = Frac.ZERO;
      for (let i = 0; i < A.rows; i++) sum = sum.add(A.data[i][j].abs());
      if (sum.gt(best)) best = sum;
    }
    return best;
  }

  /** ‖A‖∞ — the largest absolute row sum. */
  function infinityNorm(A) {
    let best = Frac.ZERO;
    A.data.forEach(function (row) {
      let sum = Frac.ZERO;
      row.forEach(function (v) { sum = sum.add(v.abs()); });
      if (sum.gt(best)) best = sum;
    });
    return best;
  }

  /** The largest absolute entry. */
  function maxNorm(A) {
    let best = Frac.ZERO;
    A.data.forEach(function (row) {
      row.forEach(function (v) {
        const magnitude = v.abs();
        if (magnitude.gt(best)) best = magnitude;
      });
    });
    return best;
  }

  /* ------------------------------------------------------------------ *
   * The analyser
   * ------------------------------------------------------------------ */

  /**
   * Full report on a matrix.
   * @param {ML.Matrix} A
   * @returns {object}
   */
  function analyzeMatrix(A) {
    ML.operations.requireMatrix(A, 'A');
    const square = isSquare(A);
    const record = ML.eliminate(A, { full: true });
    const rank = record.rank;
    const determinant = square ? ML.determinant(A) : null;
    const trace = square ? ML.traceMatrix(A) : null;
    const asymmetry = firstAsymmetry(A);
    const nilpotent = nilpotencyIndex(A);
    const zero = isZeroMatrix(A);
    const identity = isIdentity(A);
    const diagonal = isDiagonal(A);

    const properties = [];
    const add = function (key, name, value, why) {
      properties.push({ key: key, name: name, value: value, why: why });
    };

    add('square', 'Square', square, square ? A.rows + ' rows and ' + A.cols + ' columns' : A.size() + ' — rows ≠ columns');
    add('rectangular', 'Rectangular', !square, square ? 'it is square' : 'rows and columns differ');
    if (A.rows === 1 || A.cols === 1) {
      add('row', 'Row matrix', A.rows === 1, A.rows === 1 ? 'a single row of ' + A.cols : null);
      add('column', 'Column matrix', A.cols === 1, A.cols === 1 ? 'a single column of ' + A.rows : null);
    }
    add('zero', 'Zero matrix', zero, zero ? 'every entry is 0' : 'at least one entry is non-zero');

    if (square) {
      add('identity', 'Identity', identity, identity ? '1s on the diagonal, 0s elsewhere' : diagonal ? 'diagonal, but not all 1s' : 'not diagonal');
      add('diagonal', 'Diagonal', diagonal, diagonal ? 'every off-diagonal entry is 0' : firstOffDiagonal(A));
      add('scalar', 'Scalar matrix', isScalarMatrix(A), isScalarMatrix(A) ? 'diagonal with equal entries: ' + fmt(A.get(0, 0)) + '·I' : diagonal ? 'diagonal entries are not all equal' : null);
      add(
        'symmetric',
        'Symmetric',
        asymmetry === null,
        asymmetry === null
          ? 'A = Aᵗ — it mirrors across the diagonal'
          : entryName(asymmetry[0], asymmetry[1]) + ' = ' + fmt(A.get(asymmetry[0], asymmetry[1])) + ' but ' +
            entryName(asymmetry[1], asymmetry[0]) + ' = ' + fmt(A.get(asymmetry[1], asymmetry[0]))
      );
      add('skew', 'Skew-symmetric', isSkewSymmetric(A), isSkewSymmetric(A) ? 'Aᵗ = −A, and the diagonal is all 0' : 'needs Aᵗ = −A with a zero diagonal');
      add('upper', 'Upper triangular', isUpperTriangular(A), isUpperTriangular(A) ? 'everything below the diagonal is 0' : null);
      add('lower', 'Lower triangular', isLowerTriangular(A), isLowerTriangular(A) ? 'everything above the diagonal is 0' : null);
      add('singular', 'Singular', determinant.isZero(), 'det(A) = ' + fmt(determinant));
      add('nonsingular', 'Non-singular (invertible)', !determinant.isZero(), 'det(A) = ' + fmt(determinant));
      add('orthogonal', 'Orthogonal', isOrthogonal(A), isOrthogonal(A) ? 'AᵗA = I — columns are unit length and mutually perpendicular' : 'AᵗA ≠ I');
      add('idempotent', 'Idempotent', isIdempotent(A), isIdempotent(A) ? 'A² = A — applying it twice changes nothing' : 'A² ≠ A');
      add('involutory', 'Involutory', isInvolutory(A), isInvolutory(A) ? 'A² = I — it is its own inverse' : 'A² ≠ I');
      add('nilpotent', 'Nilpotent', nilpotent.nilpotent, nilpotent.nilpotent ? 'A' + ML.operations.superscript(nilpotent.index) + ' = 0' : 'no power of A up to A' + ML.operations.superscript(A.rows) + ' is zero');
      add('permutation', 'Permutation matrix', isPermutationMatrix(A), isPermutationMatrix(A) ? 'it just reorders rows' : null);
      if (asymmetry === null) {
        add('posdef', 'Positive definite', isPositiveDefinite(A), isPositiveDefinite(A) ? 'symmetric with every leading principal minor > 0' : 'a leading principal minor is not positive');
      }
    }

    const frobenius = frobeniusNorm(A);

    return {
      matrix: A,
      dimensions: A.size(),
      rows: A.rows,
      cols: A.cols,
      square: square,
      rank: rank,
      nullity: A.cols - rank,
      fullRank: rank === Math.min(A.rows, A.cols),
      trace: trace,
      determinant: determinant,
      rref: record.matrix,
      pivots: record.pivots,
      properties: properties,
      norms: {
        frobenius: frobenius,
        one: oneNorm(A),
        infinity: infinityNorm(A),
        max: maxNorm(A),
      },
      nilpotencyIndex: nilpotent.index,
    };
  }

  function firstOffDiagonal(A) {
    for (let i = 0; i < A.rows; i++) {
      for (let j = 0; j < A.cols; j++) {
        if (i !== j && !A.data[i][j].isZero()) {
          return entryName(i, j) + ' = ' + fmt(A.data[i][j]) + ' is off the diagonal and non-zero';
        }
      }
    }
    return null;
  }

  const api = {
    isSquare: isSquare,
    isRectangular: isRectangular,
    isRowMatrix: isRowMatrix,
    isColumnMatrix: isColumnMatrix,
    isZeroMatrix: isZeroMatrix,
    isIdentity: isIdentity,
    isDiagonal: isDiagonal,
    isScalar: isScalarMatrix,
    isScalarMatrix: isScalarMatrix,
    isSymmetric: isSymmetric,
    isSkewSymmetric: isSkewSymmetric,
    isUpperTriangular: isUpperTriangular,
    isLowerTriangular: isLowerTriangular,
    isTriangular: isTriangular,
    isPermutationMatrix: isPermutationMatrix,
    isSingular: isSingular,
    isNonSingular: isNonSingular,
    isOrthogonal: isOrthogonal,
    isIdempotent: isIdempotent,
    isInvolutory: isInvolutory,
    isNilpotent: isNilpotent,
    nilpotencyIndex: nilpotencyIndex,
    isPositiveDefinite: isPositiveDefinite,
    isPositiveSemiDefinite: isPositiveSemiDefinite,
    frobeniusNorm: frobeniusNorm,
    oneNorm: oneNorm,
    infinityNorm: infinityNorm,
    maxNorm: maxNorm,
    firstAsymmetry: firstAsymmetry,
    analyzeMatrix: analyzeMatrix,
  };

  ML.propertiesModule = api;
  Object.assign(ML, api);
})((globalThis.ML = globalThis.ML || {}));
