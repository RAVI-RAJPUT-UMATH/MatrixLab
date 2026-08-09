/**
 * Suite 6 — numeric kernel and matrix factorisations.
 *
 * Factorisations are checked by reconstruction (does LU give back A?) and by
 * their defining properties (is Q really orthonormal? is L really triangular?),
 * which catches errors that comparing against a memorised answer would miss.
 */
(function (ML, MLTest) {
  'use strict';

  const M = ML.Matrix;

  function isLowerTriangular(X, tol) {
    const t = tol == null ? 1e-12 : tol;
    for (let i = 0; i < X.rows; i++) {
      for (let j = i + 1; j < X.cols; j++) if (Math.abs(X.get(i, j).toNumber()) > t) return false;
    }
    return true;
  }

  function isUpperTriangular(X, tol) {
    const t = tol == null ? 1e-12 : tol;
    for (let i = 0; i < X.rows; i++) {
      for (let j = 0; j < Math.min(i, X.cols); j++) if (Math.abs(X.get(i, j).toNumber()) > t) return false;
    }
    return true;
  }

  MLTest.suite('Numeric kernel — symmetric eigenproblem', function (t) {
    // [[2,1],[1,2]] has eigenvalues 3 and 1.
    const jacobi = ML.jacobiSymmetric([[2, 1], [1, 2]]);
    t.ok(jacobi.converged, 'Jacobi converged');
    t.close(jacobi.values[0], 3, 1e-12, 'largest eigenvalue 3');
    t.close(jacobi.values[1], 1, 1e-12, 'smallest eigenvalue 1');
    // Eigenvectors must be orthonormal.
    const V = jacobi.vectors;
    t.close(V[0][0] * V[0][1] + V[1][0] * V[1][1], 0, 1e-12, 'eigenvectors are orthogonal');
    t.close(V[0][0] * V[0][0] + V[1][0] * V[1][0], 1, 1e-12, 'and unit length');
    // Av = λv for each column.
    for (let j = 0; j < 2; j++) {
      const v = [V[0][j], V[1][j]];
      const Av = [2 * v[0] + 1 * v[1], 1 * v[0] + 2 * v[1]];
      t.close(Av[0], jacobi.values[j] * v[0], 1e-10, 'Av = λv (component 1, eigenvector ' + (j + 1) + ')');
      t.close(Av[1], jacobi.values[j] * v[1], 1e-10, 'Av = λv (component 2, eigenvector ' + (j + 1) + ')');
    }
    // A 3×3 case, checked against the exact eigenvalues MatrixLab finds separately.
    const three = ML.jacobiSymmetric([[2, 0, 0], [0, 3, 4], [0, 4, 9]]);
    t.close(three.values[0], 11, 1e-10, '3×3 largest eigenvalue');
    t.close(three.values[1], 2, 1e-10, '3×3 middle eigenvalue');
    t.close(three.values[2], 1, 1e-10, '3×3 smallest eigenvalue');
  });

  MLTest.suite('LU decomposition', function (t) {
    const A = M.from([[4, 3], [6, 3]]);
    const lu = ML.luDecomposition(A);
    t.matrix(lu.L, [[1, 0], ['3/2', 1]], 'L is unit lower triangular, exact');
    t.matrix(lu.U, [[4, 3], [0, '-3/2']], 'U is upper triangular, exact');
    t.matrix(ML.multiplyMatrices(lu.L, lu.U), A.toJSON(), 'LU = A exactly');
    t.ok(lu.exact, 'flagged as exact');

    // A 3×3 that needs no pivoting.
    const B = M.from([[2, -1, -2], [-4, 6, 3], [-4, -2, 8]]);
    const lu3 = ML.luDecomposition(B);
    t.matrix(ML.multiplyMatrices(lu3.L, lu3.U), B.toJSON(), '3×3 LU = A exactly');
    t.ok(isLowerTriangular(lu3.L, 0), 'L really is lower triangular');
    t.ok(isUpperTriangular(lu3.U, 0), 'U really is upper triangular');
    for (let i = 0; i < 3; i++) t.frac(lu3.L.get(i, i), 1, 'L has 1 on the diagonal (row ' + (i + 1) + ')');

    // det(A) = product of U's diagonal, since det(L) = 1.
    let product = ML.Frac.ONE;
    for (let i = 0; i < 3; i++) product = product.mul(lu3.U.get(i, i));
    t.frac(product, ML.determinant(B).toString(), 'the diagonal of U multiplies to det(A)');

    // Needs a swap → refused with a pointer to PLU.
    t.throws(
      function () { ML.luDecomposition(M.from([[0, 1], [1, 0]])); },
      'PLU decomposition',
      'a zero pivot is reported honestly, pointing at PLU'
    );
    t.throws(function () { ML.luDecomposition(M.from([[1, 2, 3], [4, 5, 6]])); }, 'square', 'non-square is refused');
  });

  MLTest.suite('PLU decomposition', function (t) {
    // The matrix that plain LU cannot handle.
    const A = M.from([[0, 1], [1, 0]]);
    const plu = ML.pluDecomposition(A);
    t.matrix(ML.multiplyMatrices(plu.P, A), ML.multiplyMatrices(plu.L, plu.U).toJSON(), 'PA = LU exactly');
    t.eq(plu.swaps, 1, 'one row swap was needed');
    t.ok(ML.isPermutationMatrix(plu.P), 'P is a genuine permutation matrix');

    [
      M.from([[1, 2], [3, 4]]),
      M.from([[0, 0, 1], [0, 2, 0], [3, 0, 0]]),
      M.from([[2, -1, -2], [-4, 6, 3], [-4, -2, 8]]),
      M.from([[1, 2], [2, 4]]), // singular, but PLU still exists
      M.identity(4),
    ].forEach(function (X, index) {
      const result = ML.pluDecomposition(X);
      t.matrix(
        ML.multiplyMatrices(result.P, X),
        ML.multiplyMatrices(result.L, result.U).toJSON(),
        'matrix ' + (index + 1) + ': PA = LU'
      );
      t.ok(isLowerTriangular(result.L, 0), 'matrix ' + (index + 1) + ': L is lower triangular');
      t.ok(isUpperTriangular(result.U, 0), 'matrix ' + (index + 1) + ': U is upper triangular');
      t.frac(result.determinant, ML.determinant(X).toString(), 'matrix ' + (index + 1) + ': det from PLU matches');
    });
  });

  MLTest.suite('QR decomposition', function (t) {
    ['householder', 'gram-schmidt'].forEach(function (method) {
      [
        M.from([[1, 0], [0, 1]]),
        M.from([[12, -51], [6, 167], [-4, 24]]),
        M.from([[1, 1], [1, 2], [1, 3]]),
        M.from([[2, 1], [1, 3], [0, 1], [1, 1]]),
      ].forEach(function (A, index) {
        const qr = ML.qrDecomposition(A, null, { method: method });
        t.ok(qr.error < 1e-9, method + ' matrix ' + (index + 1) + ': QR = A (error ' + qr.error.toExponential(2) + ')');
        t.ok(
          qr.orthogonalityError < 1e-9,
          method + ' matrix ' + (index + 1) + ': QᵗQ = I (error ' + qr.orthogonalityError.toExponential(2) + ')'
        );
        t.ok(isUpperTriangular(qr.R, 1e-9), method + ' matrix ' + (index + 1) + ': R is upper triangular');
      });
    });

    // The classic Householder example: R's leading entry is ±14.
    const known = ML.qrDecomposition(M.from([[12, -51], [6, 167], [-4, 24]]));
    t.close(Math.abs(known.R.get(0, 0).toNumber()), 14, 1e-9, '‖first column‖ = 14 appears in R');

    // QR gives |det| for a square matrix, since |det Q| = 1.
    const square = M.from([[4, 3], [6, 3]]);
    const qrSquare = ML.qrDecomposition(square);
    const detFromR = qrSquare.R.get(0, 0).toNumber() * qrSquare.R.get(1, 1).toNumber();
    t.close(Math.abs(detFromR), Math.abs(ML.determinant(square).toNumber()), 1e-9, '|det A| = |det R|');

    t.throws(function () { ML.qrDecomposition(M.from([[1, 2, 3], [4, 5, 6]])); }, 'at least as many rows', 'a wide matrix is refused with a reason');
  });

  MLTest.suite('Cholesky decomposition', function (t) {
    const A = M.from([[4, 2], [2, 3]]);
    const chol = ML.choleskyDecomposition(A);
    t.ok(chol.error < 1e-12, 'LLᵗ = A (error ' + chol.error.toExponential(2) + ')');
    t.ok(isLowerTriangular(chol.L, 1e-12), 'L is lower triangular');
    t.close(chol.L.get(0, 0).toNumber(), 2, 1e-12, 'first diagonal entry is √4 = 2');

    // A 3×3 positive definite matrix.
    const B = M.from([[4, 12, -16], [12, 37, -43], [-16, -43, 98]]);
    const chol3 = ML.choleskyDecomposition(B);
    t.ok(chol3.error < 1e-9, '3×3 LLᵗ = A');
    t.close(chol3.L.get(0, 0).toNumber(), 2, 1e-12, 'known L₁₁ = 2');
    t.close(chol3.L.get(1, 0).toNumber(), 6, 1e-12, 'known L₂₁ = 6');
    t.close(chol3.L.get(2, 0).toNumber(), -8, 1e-12, 'known L₃₁ = −8');

    // AᵗA is always positive semi-definite; with full rank it is definite.
    const G = ML.multiplyMatrices(ML.transposeMatrix(M.from([[1, 1], [1, 2], [1, 3]])), M.from([[1, 1], [1, 2], [1, 3]]));
    t.ok(ML.choleskyDecomposition(G).error < 1e-9, 'AᵗA factors by Cholesky');

    t.throws(function () { ML.choleskyDecomposition(M.from([[1, 2], [3, 4]])); }, 'symmetric', 'a non-symmetric matrix is refused, naming the entries');
    t.throws(function () { ML.choleskyDecomposition(M.from([[1, 2], [2, 1]])); }, 'not positive definite', 'an indefinite matrix is refused with the failing minor');
    t.throws(function () { ML.choleskyDecomposition(M.zeros(2, 2)); }, 'not positive definite', 'the zero matrix is refused');
    t.throws(function () { ML.choleskyDecomposition(M.from([[1, 2, 3], [4, 5, 6]])); }, 'square', 'non-square is refused');
  });

  MLTest.suite('Singular value decomposition', function (t) {
    // Diagonal matrix: singular values are the absolute diagonal entries.
    const diagonal = ML.svdDecomposition(M.diagonal([3, -5, 1]));
    t.close(diagonal.singular[0], 5, 1e-10, 'largest singular value 5');
    t.close(diagonal.singular[1], 3, 1e-10, 'then 3');
    t.close(diagonal.singular[2], 1, 1e-10, 'then 1');
    t.eq(diagonal.rank, 3, 'rank 3');

    [
      M.from([[1, 0], [0, 1]]),
      M.from([[3, 0], [0, -2]]),
      M.from([[1, 2], [3, 4]]),
      M.from([[1, 1], [1, 2], [1, 3]]),
      M.from([[1, 2, 3], [4, 5, 6]]),
      M.from([[2, 0], [0, 0]]),
      M.from([[1, 2], [2, 4]]), // rank 1
    ].forEach(function (A, index) {
      const svd = ML.svdDecomposition(A);
      t.ok(svd.error < 1e-9, 'matrix ' + (index + 1) + ': UΣVᵗ = A (error ' + svd.error.toExponential(2) + ')');
      // Singular values are non-negative and in descending order.
      let ordered = true;
      for (let i = 1; i < svd.singular.length; i++) if (svd.singular[i] > svd.singular[i - 1] + 1e-12) ordered = false;
      t.ok(ordered, 'matrix ' + (index + 1) + ': singular values are in descending order');
      t.ok(svd.singular.every(function (value) { return value >= -1e-12; }), 'matrix ' + (index + 1) + ': none are negative');
      // V has orthonormal columns.
      const VtV = ML.multiplyMatrices(ML.transposeMatrix(svd.V), svd.V);
      let orthoError = 0;
      for (let i = 0; i < VtV.rows; i++) {
        for (let j = 0; j < VtV.cols; j++) {
          orthoError = Math.max(orthoError, Math.abs(VtV.get(i, j).toNumber() - (i === j ? 1 : 0)));
        }
      }
      t.ok(orthoError < 1e-9, 'matrix ' + (index + 1) + ': VᵗV = I');
      // The rank from SVD must match the exact rank.
      t.eq(svd.rank, ML.matrixRank(A), 'matrix ' + (index + 1) + ': SVD rank matches the exact rank');
    });

    // Singular values squared are the eigenvalues of AᵗA.
    const A = M.from([[1, 2], [3, 4]]);
    const svd = ML.svdDecomposition(A);
    const gram = ML.multiplyMatrices(ML.transposeMatrix(A), A);
    const gramEigen = ML.jacobiSymmetric(gram.toFloat());
    t.close(svd.singular[0] * svd.singular[0], gramEigen.values[0], 1e-8, 'σ₁² is the largest eigenvalue of AᵗA');
    t.close(svd.singular[1] * svd.singular[1], gramEigen.values[1], 1e-8, 'σ₂² is the next eigenvalue of AᵗA');

    // Low-rank approximation: Eckart–Young says the error is the tail of σ.
    const rankOne = svd.lowRank(1);
    t.eq(rankOne.rank, 1, 'rank-1 approximation requested');
    t.eq(ML.matrixRank(rankOne.matrix) <= 1, true, 'and really has rank at most 1');
    t.close(rankOne.frobeniusError, svd.singular[1], 1e-8, 'its Frobenius error is exactly σ₂');
    const full = svd.lowRank(2);
    t.ok(full.frobeniusError < 1e-9, 'keeping every singular value reproduces A');

    // A rank-1 matrix has one non-zero singular value.
    const deficient = ML.svdDecomposition(M.from([[1, 2], [2, 4]]));
    t.eq(deficient.rank, 1, 'rank 1 detected');
    t.close(deficient.singular[1], 0, 1e-10, 'the second singular value is zero');
    t.eq(deficient.condition, Infinity, 'a singular matrix has infinite condition number');

    t.close(ML.svdDecomposition(M.identity(3)).condition, 1, 1e-10, 'the identity has condition number 1');
  });
})(globalThis.ML, globalThis.MLTest);
