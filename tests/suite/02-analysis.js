/**
 * Suite 2 — determinant, minors, cofactors, adjugate, inverse, properties.
 * Expected values are either standard textbook results or provable identities
 * (triangular determinants, det(AB) = det(A)det(B), A·A⁻¹ = I).
 */
(function (ML, MLTest) {
  'use strict';

  const M = ML.Matrix;

  MLTest.suite('Determinant — small sizes', function (t) {
    t.frac(ML.determinant(M.from([[7]])), 7, '1×1');
    t.frac(ML.determinant(M.from([[1, 2], [3, 4]])), -2, '2×2: 1·4 − 2·3');
    t.frac(ML.determinant(M.from([[2, 1], [5, 3]])), 1, '2×2 with determinant 1');
    t.frac(ML.determinant(M.identity(4)), 1, 'det(I) = 1');
    t.frac(ML.determinant(M.from([[1, 2], [2, 4]])), 0, 'dependent rows give 0');
    // Standard worked example.
    t.frac(ML.determinant(M.from([[6, 1, 1], [4, -2, 5], [2, 8, 7]])), -306, '3×3 = −306');
    t.frac(ML.determinant(M.from([[2, -1, 0], [-1, 2, -1], [0, -1, 2]])), 4, '3×3 tridiagonal = 4');
    t.frac(ML.determinant(M.from([[1, 2, 3], [4, 5, 6], [7, 8, 9]])), 0, 'singular 3×3');
    // (1/2)(1/5) − (1/3)(1/4) = 1/10 − 1/12 = 1/60
    t.frac(ML.determinant(M.from([['1/2', '1/3'], ['1/4', '1/5']])), '1/60', 'exact fractions: 1/10 − 1/12');
    t.throws(function () { ML.determinant(M.from([[1, 2, 3], [4, 5, 6]])); }, 'square', 'non-square is rejected');
  });

  MLTest.suite('Determinant — larger sizes and both methods agree', function (t) {
    const A4 = M.from([[1, 0, 2, -1], [3, 0, 0, 5], [2, 1, 4, -3], [1, 0, 5, 0]]);
    t.frac(ML.determinant(A4), 30, '4×4 = 30');
    t.frac(ML.determinantByCofactor(A4), 30, 'cofactor expansion gives the same');
    t.frac(ML.determinantByElimination(A4), 30, 'elimination gives the same');

    // A triangular determinant must be the product of the diagonal.
    const U = M.from([[2, 9, -3, 4], [0, -1, 7, 1], [0, 0, 5, 8], [0, 0, 0, 3]]);
    t.frac(ML.determinant(U), 2 * -1 * 5 * 3, 'upper triangular = product of the diagonal');
    t.frac(ML.determinantByCofactor(U), -30, 'cofactor expansion agrees on the triangular case');

    // det(AB) = det(A)·det(B), a property no implementation bug survives.
    const A = M.from([[1, 2, 0], [3, -1, 4], [2, 0, 1]]);
    const B = M.from([[0, 1, 2], [1, 1, 0], [2, 3, 1]]);
    const detA = ML.determinant(A);
    const detB = ML.determinant(B);
    t.frac(ML.determinant(ML.multiplyMatrices(A, B)), detA.mul(detB).toString(), 'det(AB) = det(A)·det(B)');
    t.frac(ML.determinant(ML.transposeMatrix(A)), detA.toString(), 'det(Aᵗ) = det(A)');
    // det(kA) = kⁿ det(A) for n = 3.
    t.frac(ML.determinant(ML.scalarMultiply(A, 2)), detA.mul(8).toString(), 'det(2A) = 2³·det(A)');
    t.frac(ML.determinant(M.zeros(5, 5)), 0, 'the zero matrix has determinant 0');
    t.throws(
      function () { ML.determinantByCofactor(M.identity(9)); },
      'freeze the page',
      'cofactor expansion refuses an unreasonable size instead of hanging'
    );
  });

  MLTest.suite('Minors, cofactors and the adjugate', function (t) {
    const A = M.from([[1, 2], [3, 4]]);
    t.matrix(ML.getMinor(A, 0, 0), [[4]], 'minor block at (1,1)');
    t.matrix(ML.minorMatrix(A), [[4, 3], [2, 1]], 'matrix of minors');
    t.matrix(ML.cofactorMatrix(A), [[4, -3], [-2, 1]], 'cofactors apply the chequerboard signs');
    t.matrix(ML.adjointMatrix(A), [[4, -2], [-3, 1]], 'adjugate is the transposed cofactor matrix');

    // A·adj(A) = det(A)·I is the defining identity.
    const B = M.from([[6, 1, 1], [4, -2, 5], [2, 8, 7]]);
    const detB = ML.determinant(B);
    t.matrix(
      ML.multiplyMatrices(B, ML.adjointMatrix(B)),
      M.identity(3).map(function (v) { return v.mul(detB); }).toJSON(),
      'A·adj(A) = det(A)·I'
    );
    t.matrix(ML.getMinor(M.from([[1, 2, 3], [4, 5, 6], [7, 8, 9]]), 1, 1), [[1, 3], [7, 9]], 'middle minor of a 3×3');
    t.matrix(ML.adjointMatrix(M.from([[5]])), [[1]], 'adjugate of a 1×1 is [1] by convention');
    t.throws(function () { ML.getMinor(M.from([[5]]), 0, 0); }, 'at least 2×2', 'no minor exists for 1×1');
  });

  MLTest.suite('Inverse', function (t) {
    // The example from the project brief.
    t.matrix(ML.inverseMatrix(M.from([[2, 1], [5, 3]])), [[3, -1], [-5, 2]], '[[2,1],[5,3]]⁻¹');
    t.matrix(ML.inverseMatrix(M.from([[1, 2], [3, 4]])), [[-2, 1], ['3/2', '-1/2']], 'exact fractions in the inverse');
    t.matrix(ML.inverseMatrix(M.identity(3)), [[1, 0, 0], [0, 1, 0], [0, 0, 1]], 'I⁻¹ = I');
    t.matrix(
      ML.inverseMatrix(M.from([[2, -1, 0], [-1, 2, -1], [0, -1, 2]])),
      [['3/4', '1/2', '1/4'], ['1/2', 1, '1/2'], ['1/4', '1/2', '3/4']],
      '3×3 inverse with fractions'
    );
    t.matrix(ML.inverseMatrix(M.from([[4]])), [['1/4']], '1×1 inverse is the reciprocal');

    // Both methods must produce identical exact results.
    const A = M.from([[2, 0, 1], [1, 3, 2], [1, 1, 4]]); // det = 18
    const viaAdjugate = ML.inverseByAdjugate(A);
    const viaGaussJordan = ML.inverseByGaussJordan(A);
    t.ok(viaAdjugate.equals(viaGaussJordan), 'adjugate and Gauss–Jordan agree exactly');
    t.matrix(ML.multiplyMatrices(A, viaAdjugate), M.identity(3).toJSON(), 'A·A⁻¹ = I exactly');
    t.matrix(ML.multiplyMatrices(viaAdjugate, A), M.identity(3).toJSON(), 'A⁻¹·A = I exactly');

    // 4×4 through Gauss–Jordan, verified by multiplying back.
    const A4 = M.from([[1, 0, 2, -1], [3, 0, 0, 5], [2, 1, 4, -3], [1, 0, 5, 0]]);
    const inv4 = ML.inverseMatrix(A4);
    t.matrix(ML.multiplyMatrices(A4, inv4), M.identity(4).toJSON(), '4×4 inverse verified by A·A⁻¹ = I');
    t.matrix(ML.matrixPower(A4, -1), inv4.toJSON(), 'A⁻¹ via matrixPower(-1) matches');

    // (AB)⁻¹ = B⁻¹A⁻¹
    const B = M.from([[1, 1, 0], [0, 1, 1], [1, 0, 1]]);
    t.ok(
      ML.inverseMatrix(ML.multiplyMatrices(A, B)).equals(
        ML.multiplyMatrices(ML.inverseMatrix(B), ML.inverseMatrix(A))
      ),
      '(AB)⁻¹ = B⁻¹A⁻¹'
    );

    t.throws(function () { ML.inverseMatrix(M.from([[1, 2], [2, 4]])); }, 'singular', 'singular matrix is refused');
    t.throws(function () { ML.inverseMatrix(M.from([[1, 2, 3], [4, 5, 6]])); }, 'square', 'non-square is refused');
    t.throws(function () { ML.inverseMatrix(M.zeros(3, 3)); }, 'no inverse', 'the zero matrix has no inverse');
  });

  MLTest.suite('Properties — shape and pattern tests', function (t) {
    const symmetric = M.from([[1, 2, 3], [2, 5, 4], [3, 4, 9]]);
    const skew = M.from([[0, 2, -3], [-2, 0, 4], [3, -4, 0]]);
    const rotation = M.from([[0, -1], [1, 0]]);
    const projection = M.from([[1, 0], [0, 0]]);
    const swap = M.from([[0, 1], [1, 0]]);
    const shear = M.from([[0, 1], [0, 0]]);

    t.ok(ML.isSymmetric(symmetric), 'symmetric matrix recognised');
    t.notOk(ML.isSymmetric(M.from([[1, 2], [3, 1]])), 'asymmetric matrix rejected');
    t.notOk(ML.isSymmetric(M.from([[1, 2, 3], [4, 5, 6]])), 'non-square is not symmetric');
    t.ok(ML.isSkewSymmetric(skew), 'skew-symmetric recognised');
    t.notOk(ML.isSkewSymmetric(M.from([[1, 2], [-2, 0]])), 'a non-zero diagonal blocks skew-symmetry');
    t.ok(ML.isSkewSymmetric(M.zeros(3, 3)), 'the zero matrix is skew-symmetric');

    t.ok(ML.isIdentity(M.identity(4)), 'identity recognised');
    t.notOk(ML.isIdentity(M.from([[1, 0], [1, 1]])), 'not the identity');
    t.ok(ML.isDiagonal(M.diagonal([1, 2, 3])), 'diagonal recognised');
    t.ok(ML.isScalarMatrix(M.scalarMatrix(3, 5)), 'scalar matrix recognised');
    t.notOk(ML.isScalarMatrix(M.diagonal([1, 2])), 'unequal diagonal entries are not scalar');
    t.ok(ML.isUpperTriangular(M.from([[1, 2], [0, 3]])), 'upper triangular');
    t.ok(ML.isLowerTriangular(M.from([[1, 0], [2, 3]])), 'lower triangular');
    t.ok(ML.isUpperTriangular(M.diagonal([1, 2])) && ML.isLowerTriangular(M.diagonal([1, 2])), 'diagonal is both');
    t.ok(ML.isPermutationMatrix(swap), 'permutation matrix recognised');
    t.notOk(ML.isPermutationMatrix(M.from([[1, 1], [0, 1]])), 'two 1s in a row is not a permutation');

    t.ok(ML.isOrthogonal(rotation), 'rotation is orthogonal');
    t.ok(ML.isOrthogonal(M.identity(3)), 'identity is orthogonal');
    t.notOk(ML.isOrthogonal(M.from([[1, 1], [0, 1]])), 'shear is not orthogonal');
    t.ok(ML.isIdempotent(projection), 'projection is idempotent');
    t.ok(ML.isIdempotent(M.identity(2)), 'identity is idempotent');
    t.ok(ML.isInvolutory(swap), 'the swap matrix is its own inverse');
    t.ok(ML.isNilpotent(shear), 'nilpotent recognised');
    t.eq(ML.nilpotencyIndex(shear).index, 2, 'nilpotency index is 2');
    t.notOk(ML.isNilpotent(M.identity(2)), 'the identity is not nilpotent');
    t.eq(ML.nilpotencyIndex(M.from([[0, 1, 0], [0, 0, 1], [0, 0, 0]])).index, 3, 'index 3 for a 3×3 shift matrix');

    t.ok(ML.isSingular(M.from([[1, 2], [2, 4]])), 'singular detected');
    t.notOk(ML.isSingular(M.from([[1, 2], [3, 4]])), 'invertible detected');
    t.eq(ML.isSingular(M.from([[1, 2, 3], [4, 5, 6]])), null, 'singularity is undefined for non-square');

    t.ok(ML.isPositiveDefinite(M.from([[2, -1], [-1, 2]])), 'positive definite via leading minors');
    t.notOk(ML.isPositiveDefinite(M.from([[1, 2], [2, 1]])), 'indefinite matrix rejected');
    t.notOk(ML.isPositiveDefinite(M.from([[1, 1], [0, 1]])), 'non-symmetric is not positive definite here');
  });

  MLTest.suite('Properties — norms and the analyser', function (t) {
    t.frac(ML.frobeniusNorm(M.from([[3, 4]])).exact, 5, '‖[3 4]‖F = 5 exactly');
    t.frac(ML.frobeniusNorm(M.identity(4)).exact, 2, '‖I₄‖F = 2');
    t.eq(ML.frobeniusNorm(M.from([[1, 1]])).exact, null, '√2 has no exact fraction');
    t.close(ML.frobeniusNorm(M.from([[1, 1]])).value, Math.SQRT2, 1e-12, 'but the numeric value is right');
    t.frac(ML.oneNorm(M.from([[1, -7], [2, 3]])), 10, '‖A‖₁ = biggest column sum');
    t.frac(ML.infinityNorm(M.from([[1, -7], [2, 3]])), 8, '‖A‖∞ = biggest row sum');
    t.frac(ML.maxNorm(M.from([[1, -7], [2, 3]])), 7, 'largest absolute entry');

    const report = ML.analyzeMatrix(M.from([[2, -1, 0], [-1, 2, -1], [0, -1, 2]]));
    t.eq(report.dimensions, '3×3', 'analyser reports dimensions');
    t.eq(report.rank, 3, 'analyser reports rank');
    t.eq(report.nullity, 0, 'analyser reports nullity');
    t.frac(report.trace, 6, 'analyser reports trace');
    t.frac(report.determinant, 4, 'analyser reports determinant');
    const flags = {};
    report.properties.forEach(function (p) { flags[p.key] = p.value; });
    t.ok(flags.square && flags.symmetric && flags.nonsingular && flags.posdef, 'flags agree with the matrix');
    t.notOk(flags.diagonal || flags.orthogonal || flags.nilpotent, 'flags that should be false are false');
    const why = report.properties.filter(function (p) { return p.key === 'symmetric'; })[0].why;
    t.ok(why.indexOf('A = Aᵗ') >= 0, 'the analyser explains why, not just whether');

    const asym = ML.analyzeMatrix(M.from([[1, 2], [3, 4]]));
    const asymWhy = asym.properties.filter(function (p) { return p.key === 'symmetric'; })[0].why;
    t.ok(asymWhy.indexOf('a₁₂ = 2 but a₂₁ = 3') >= 0, 'names the exact pair that breaks symmetry');

    const rect = ML.analyzeMatrix(M.from([[1, 2, 3], [4, 5, 6]]));
    t.eq(rect.trace, null, 'no trace for a rectangular matrix');
    t.eq(rect.determinant, null, 'no determinant for a rectangular matrix');
    t.eq(rect.rank, 2, 'rank still works');
  });
})(globalThis.ML, globalThis.MLTest);
