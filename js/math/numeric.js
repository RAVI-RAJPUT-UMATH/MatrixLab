/**
 * MatrixLab — floating-point numerics.
 *
 * Exact rational arithmetic covers elimination, determinants, inverses and
 * solving. But square roots are irrational, so orthonormal bases, QR, Cholesky
 * and SVD genuinely cannot stay in the rationals. Those live here, in float64,
 * with the algorithms chosen for stability rather than brevity.
 *
 * Everything in this file works on plain number[][] arrays.
 */
(function (ML) {
  'use strict';

  const MLError = ML.MLError;

  /* ------------------------------------------------------------------ *
   * Small array utilities
   * ------------------------------------------------------------------ */

  function zeros(rows, cols) {
    const out = new Array(rows);
    for (let i = 0; i < rows; i++) out[i] = new Array(cols).fill(0);
    return out;
  }

  function identity(n) {
    const out = zeros(n, n);
    for (let i = 0; i < n; i++) out[i][i] = 1;
    return out;
  }

  function copy(A) {
    return A.map(function (row) { return row.slice(); });
  }

  function transpose(A) {
    const rows = A.length;
    const cols = A[0].length;
    const out = zeros(cols, rows);
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) out[j][i] = A[i][j];
    return out;
  }

  function multiply(A, B) {
    const m = A.length;
    const n = B[0].length;
    const inner = B.length;
    if (A[0].length !== inner) throw new MLError('Inner dimensions do not match for this product.');
    const out = zeros(m, n);
    for (let i = 0; i < m; i++) {
      for (let k = 0; k < inner; k++) {
        const a = A[i][k];
        if (a === 0) continue;
        for (let j = 0; j < n; j++) out[i][j] += a * B[k][j];
      }
    }
    return out;
  }

  function dot(u, v) {
    let sum = 0;
    for (let i = 0; i < u.length; i++) sum += u[i] * v[i];
    return sum;
  }

  function norm(v) {
    return Math.sqrt(dot(v, v));
  }

  function scaleVector(v, k) {
    return v.map(function (x) { return x * k; });
  }

  function subVectors(u, v) {
    return u.map(function (x, i) { return x - v[i]; });
  }

  function columnOf(A, j) {
    return A.map(function (row) { return row[j]; });
  }

  function setColumn(A, j, v) {
    for (let i = 0; i < A.length; i++) A[i][j] = v[i];
  }

  /** Snap float artefacts so results display cleanly. */
  function cleanArray(A) {
    return A.map(function (row) {
      return row.map(function (x) { return ML.cleanFloat(x); });
    });
  }

  function toMatrix(A) {
    return ML.Matrix.from(cleanArray(A));
  }

  /* ------------------------------------------------------------------ *
   * Symmetric eigenproblem — the cyclic Jacobi rotation method
   * ------------------------------------------------------------------ */

  /**
   * Eigenvalues and orthonormal eigenvectors of a real symmetric matrix.
   * Jacobi repeatedly zeroes the largest off-diagonal entry with a rotation;
   * it converges reliably and produces eigenvectors that are orthogonal to
   * machine precision, which is exactly what SVD and PCA need.
   *
   * @param {number[][]} input symmetric
   * @returns {{values: number[], vectors: number[][], sweeps: number, converged: boolean}}
   *          vectors[i][j] is entry i of eigenvector j (eigenvectors are columns)
   */
  function jacobiSymmetric(input, options) {
    const opts = options || {};
    const n = input.length;
    const A = copy(input);
    let V = identity(n);
    const maxSweeps = opts.maxSweeps || 100;
    const tol = opts.tol || 1e-14;
    let sweeps = 0;
    let converged = false;

    for (; sweeps < maxSweeps; sweeps++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
      if (Math.sqrt(2 * off) <= tol * frobeniusOf(A)) {
        converged = true;
        break;
      }
      for (let p = 0; p < n - 1; p++) {
        for (let q = p + 1; q < n; q++) {
          if (Math.abs(A[p][q]) <= 1e-300) continue;
          // Choose the rotation that annihilates A[p][q].
          const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
          const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
          const c = 1 / Math.sqrt(t * t + 1);
          const s = t * c;
          for (let k = 0; k < n; k++) {
            const akp = A[k][p];
            const akq = A[k][q];
            A[k][p] = c * akp - s * akq;
            A[k][q] = s * akp + c * akq;
          }
          for (let k = 0; k < n; k++) {
            const apk = A[p][k];
            const aqk = A[q][k];
            A[p][k] = c * apk - s * aqk;
            A[q][k] = s * apk + c * aqk;
          }
          for (let k = 0; k < n; k++) {
            const vkp = V[k][p];
            const vkq = V[k][q];
            V[k][p] = c * vkp - s * vkq;
            V[k][q] = s * vkp + c * vkq;
          }
        }
      }
    }

    const values = [];
    for (let i = 0; i < n; i++) values.push(A[i][i]);

    // Sort by descending eigenvalue, keeping vectors with their values.
    const order = values.map(function (_, i) { return i; }).sort(function (a, b) { return values[b] - values[a]; });
    const sortedValues = order.map(function (i) { return values[i]; });
    const sortedVectors = zeros(n, n);
    order.forEach(function (source, target) {
      for (let i = 0; i < n; i++) sortedVectors[i][target] = V[i][source];
    });

    return { values: sortedValues, vectors: sortedVectors, sweeps: sweeps, converged: converged };
  }

  function frobeniusOf(A) {
    let sum = 0;
    A.forEach(function (row) {
      row.forEach(function (x) { sum += x * x; });
    });
    return Math.sqrt(sum) || 1;
  }

  /* ------------------------------------------------------------------ *
   * QR
   * ------------------------------------------------------------------ */

  /**
   * Householder QR. Returns the full Q (m×m) and R (m×n); the thin factors are
   * the first n columns of Q and first n rows of R.
   * @returns {{Q: number[][], R: number[][]}}
   */
  function householderQR(input) {
    const m = input.length;
    const n = input[0].length;
    const R = copy(input);
    let Q = identity(m);

    for (let k = 0; k < Math.min(m - 1, n); k++) {
      // Reflect the sub-column below the diagonal onto the first axis.
      let normX = 0;
      for (let i = k; i < m; i++) normX += R[i][k] * R[i][k];
      normX = Math.sqrt(normX);
      if (normX < 1e-300) continue;

      const alpha = R[k][k] >= 0 ? -normX : normX;
      const v = new Array(m).fill(0);
      for (let i = k; i < m; i++) v[i] = R[i][k];
      v[k] -= alpha;
      const vNorm = norm(v);
      if (vNorm < 1e-300) continue;
      for (let i = k; i < m; i++) v[i] /= vNorm;

      // R ← (I − 2vvᵗ)R  and  Q ← Q(I − 2vvᵗ)
      for (let j = 0; j < n; j++) {
        let s = 0;
        for (let i = k; i < m; i++) s += v[i] * R[i][j];
        s *= 2;
        for (let i = k; i < m; i++) R[i][j] -= s * v[i];
      }
      for (let i = 0; i < m; i++) {
        let s = 0;
        for (let j = k; j < m; j++) s += Q[i][j] * v[j];
        s *= 2;
        for (let j = k; j < m; j++) Q[i][j] -= s * v[j];
      }
    }

    // Zero the below-diagonal noise that reflections leave behind.
    for (let i = 0; i < m; i++) for (let j = 0; j < Math.min(i, n); j++) R[i][j] = 0;
    return { Q: Q, R: R };
  }

  /**
   * Modified Gram–Schmidt QR (thin). Kept separate from Householder because it
   * is the version students derive by hand, and the orthogonality view shows
   * its steps.
   * @returns {{Q: number[][], R: number[][], rank: number, dependent: number[]}}
   */
  function gramSchmidtQR(input, tol) {
    const m = input.length;
    const n = input[0].length;
    const epsilon = tol == null ? 1e-10 : tol;
    const Q = zeros(m, n);
    const R = zeros(n, n);
    const dependent = [];
    let rank = 0;

    for (let j = 0; j < n; j++) {
      let v = columnOf(input, j);
      const scale = norm(v);
      // Two passes of orthogonalisation: the second recovers accuracy lost to
      // cancellation when columns are nearly parallel.
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < j; i++) {
          const qi = columnOf(Q, i);
          if (norm(qi) === 0) continue;
          const projection = dot(qi, v);
          R[i][j] += projection;
          v = subVectors(v, scaleVector(qi, projection));
        }
      }
      const length = norm(v);
      R[j][j] = length;
      if (length <= epsilon * Math.max(1, scale)) {
        // This column added nothing new: it lies in the span of the earlier ones.
        dependent.push(j);
        setColumn(Q, j, new Array(m).fill(0));
      } else {
        setColumn(Q, j, scaleVector(v, 1 / length));
        rank++;
      }
    }
    return { Q: Q, R: R, rank: rank, dependent: dependent };
  }

  /* ------------------------------------------------------------------ *
   * Cholesky
   * ------------------------------------------------------------------ */

  /**
   * A = LLᵗ for symmetric positive definite A.
   * @returns {{L: number[][], ok: boolean, reason?: string, failedAt?: number}}
   */
  function cholesky(input) {
    const n = input.length;
    const L = zeros(n, n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = input[i][j];
        for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
        if (i === j) {
          if (sum <= 0) {
            return {
              L: L,
              ok: false,
              failedAt: i,
              reason:
                'At row ' + (i + 1) + ' the value under the square root is ' + ML.fmtFixed(sum, 6) +
                ', which is not positive. That is precisely the test failing: A is not positive definite.',
            };
          }
          L[i][j] = Math.sqrt(sum);
        } else {
          L[i][j] = sum / L[j][j];
        }
      }
    }
    return { L: L, ok: true };
  }

  /* ------------------------------------------------------------------ *
   * SVD — one-sided Jacobi
   * ------------------------------------------------------------------ */

  /**
   * Thin singular value decomposition A = UΣVᵗ.
   *
   * One-sided Jacobi rotates pairs of columns until they are orthogonal. The
   * resulting column norms are the singular values, and the normalised columns
   * are U. It is slower than the bidiagonal algorithms used by LAPACK but far
   * simpler and very accurate — a good trade for a teaching tool.
   *
   * @returns {{U: number[][], singular: number[], V: number[][], rank: number, sweeps: number, converged: boolean}}
   */
  function svd(input, options) {
    const opts = options || {};
    const m0 = input.length;
    const n0 = input[0].length;
    // The algorithm needs at least as many rows as columns; otherwise work on Aᵗ.
    const flipped = m0 < n0;
    const A = flipped ? transpose(input) : copy(input);
    const m = A.length;
    const n = A[0].length;

    const B = copy(A);
    let V = identity(n);
    const tol = opts.tol || 1e-14;
    const maxSweeps = opts.maxSweeps || 60;
    let sweeps = 0;
    let converged = false;

    for (; sweeps < maxSweeps; sweeps++) {
      let rotations = 0;
      for (let p = 0; p < n - 1; p++) {
        for (let q = p + 1; q < n; q++) {
          let alpha = 0;
          let beta = 0;
          let gamma = 0;
          for (let i = 0; i < m; i++) {
            alpha += B[i][p] * B[i][p];
            beta += B[i][q] * B[i][q];
            gamma += B[i][p] * B[i][q];
          }
          if (Math.abs(gamma) <= tol * Math.sqrt(alpha * beta) || gamma === 0) continue;
          rotations++;
          const zeta = (beta - alpha) / (2 * gamma);
          const t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
          const c = 1 / Math.sqrt(1 + t * t);
          const s = c * t;
          for (let i = 0; i < m; i++) {
            const bip = B[i][p];
            const biq = B[i][q];
            B[i][p] = c * bip - s * biq;
            B[i][q] = s * bip + c * biq;
          }
          for (let i = 0; i < n; i++) {
            const vip = V[i][p];
            const viq = V[i][q];
            V[i][p] = c * vip - s * viq;
            V[i][q] = s * vip + c * viq;
          }
        }
      }
      if (!rotations) {
        converged = true;
        break;
      }
    }

    // Column norms are the singular values.
    const singular = [];
    for (let j = 0; j < n; j++) singular.push(norm(columnOf(B, j)));

    const order = singular.map(function (_, j) { return j; }).sort(function (a, b) { return singular[b] - singular[a]; });
    const sortedSingular = order.map(function (j) { return singular[j]; });
    const largest = sortedSingular[0] || 1;
    const rankTol = Math.max(m, n) * largest * 2.3e-16;

    const U = zeros(m, n);
    const Vs = zeros(n, n);
    let rank = 0;
    order.forEach(function (source, target) {
      for (let i = 0; i < n; i++) Vs[i][target] = V[i][source];
      const value = singular[source];
      if (value > rankTol) {
        rank++;
        for (let i = 0; i < m; i++) U[i][target] = B[i][source] / value;
      }
    });

    // Columns of U belonging to zero singular values are unconstrained; fill
    // them with any orthonormal completion so U really has orthonormal columns.
    completeColumns(U, rank);

    // Sign convention: make the largest-magnitude entry of each U column
    // positive, so repeated runs and hand calculations agree.
    for (let j = 0; j < Math.min(rank, n); j++) {
      let index = 0;
      let best = 0;
      for (let i = 0; i < m; i++) {
        if (Math.abs(U[i][j]) > best) {
          best = Math.abs(U[i][j]);
          index = i;
        }
      }
      if (U[index][j] < 0) {
        for (let i = 0; i < m; i++) U[i][j] = -U[i][j];
        for (let i = 0; i < n; i++) Vs[i][j] = -Vs[i][j];
      }
    }

    return flipped
      ? { U: Vs, singular: sortedSingular, V: U, rank: rank, sweeps: sweeps, converged: converged }
      : { U: U, singular: sortedSingular, V: Vs, rank: rank, sweeps: sweeps, converged: converged };
  }

  /** Fill zero columns from `start` onwards with an orthonormal completion. */
  function completeColumns(U, start) {
    const m = U.length;
    const total = U[0].length;
    for (let j = start; j < total; j++) {
      let candidate = null;
      for (let axis = 0; axis < m && !candidate; axis++) {
        const trial = new Array(m).fill(0);
        trial[axis] = 1;
        let v = trial;
        for (let k = 0; k < j; k++) {
          const qk = columnOf(U, k);
          v = subVectors(v, scaleVector(qk, dot(qk, v)));
        }
        if (norm(v) > 1e-8) candidate = scaleVector(v, 1 / norm(v));
      }
      setColumn(U, j, candidate || new Array(m).fill(0));
    }
  }

  /* ------------------------------------------------------------------ *
   * Float elimination (for eigenvectors of irrational eigenvalues)
   * ------------------------------------------------------------------ */

  /**
   * Reduced row echelon form with a tolerance, plus the null-space basis.
   * Used only where exact arithmetic is impossible — never as a substitute for
   * the exact path.
   * @returns {{rref: number[][], pivots: number[], nullspace: number[][]}}
   */
  function floatNullspace(input, tol) {
    const m = input.length;
    const n = input[0].length;
    const A = copy(input);
    const scale = Math.max(1, frobeniusOf(A));
    const epsilon = (tol == null ? 1e-9 : tol) * scale;
    const pivots = [];
    let row = 0;

    for (let col = 0; col < n && row < m; col++) {
      let best = row;
      for (let i = row + 1; i < m; i++) if (Math.abs(A[i][col]) > Math.abs(A[best][col])) best = i;
      if (Math.abs(A[best][col]) <= epsilon) continue;
      const temp = A[row];
      A[row] = A[best];
      A[best] = temp;
      const pivot = A[row][col];
      for (let j = 0; j < n; j++) A[row][j] /= pivot;
      for (let i = 0; i < m; i++) {
        if (i === row) continue;
        const factor = A[i][col];
        if (factor === 0) continue;
        for (let j = 0; j < n; j++) A[i][j] -= factor * A[row][j];
      }
      pivots.push(col);
      row++;
    }

    const pivotSet = new Set(pivots);
    const nullspace = [];
    for (let free = 0; free < n; free++) {
      if (pivotSet.has(free)) continue;
      const vector = new Array(n).fill(0);
      vector[free] = 1;
      pivots.forEach(function (col, index) { vector[col] = -A[index][free]; });
      nullspace.push(vector);
    }
    return { rref: A, pivots: pivots, nullspace: nullspace };
  }

  /** Largest-magnitude entry scaled to 1, then unit length — tidy display. */
  function normalizeVector(v) {
    const length = norm(v);
    if (length < 1e-300) return v.slice();
    return scaleVector(v, 1 / length);
  }

  const api = {
    zeros: zeros,
    identityFloat: identity,
    copyFloat: copy,
    transposeFloat: transpose,
    multiplyFloat: multiply,
    dotFloat: dot,
    normFloat: norm,
    scaleVectorFloat: scaleVector,
    subVectorsFloat: subVectors,
    columnOf: columnOf,
    setColumn: setColumn,
    cleanArray: cleanArray,
    floatToMatrix: toMatrix,
    jacobiSymmetric: jacobiSymmetric,
    householderQR: householderQR,
    gramSchmidtQR: gramSchmidtQR,
    choleskyFloat: cholesky,
    svd: svd,
    floatNullspace: floatNullspace,
    normalizeVectorFloat: normalizeVector,
  };

  ML.numeric = api;
  Object.assign(ML, api);
})((globalThis.ML = globalThis.ML || {}));
