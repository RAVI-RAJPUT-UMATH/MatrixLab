/**
 * Suite 4 — polynomials, eigenvalues, eigenvectors, diagonalisation.
 *
 * Eigenvalue code is the easiest place to be confidently wrong, so as well as
 * checking known answers these tests verify the structural identities: the sum
 * of the eigenvalues is the trace, the product is the determinant, Av = λv for
 * every reported pair, and PDP⁻¹ reproduces A.
 */
(function (ML, MLTest) {
  'use strict';

  const M = ML.Matrix;
  const F = ML.Frac;

  /** Eigenvalue display texts, sorted, for order-independent comparison. */
  function texts(result) {
    return result.values
      .map(function (v) { return v.text + (v.multiplicity > 1 ? '×' + v.multiplicity : ''); })
      .sort()
      .join(' | ');
  }

  MLTest.suite('Polynomials — basics', function (t) {
    const p = [F.of(-2), F.of(-5), F.of(1)]; // λ² − 5λ − 2
    t.eq(ML.polyDegree(p), 2, 'degree');
    t.eq(ML.polyText(p, 'λ'), 'λ² − 5λ − 2', 'readable text with a real minus sign');
    t.eq(ML.polyText([F.of(0), F.of(0), F.of(1)], 'λ'), 'λ²', 'a bare leading term');
    t.eq(ML.polyText([F.of(1), F.of(-2), F.of(1)], 'λ'), 'λ² − 2λ + 1', 'coefficient 1 is left implicit');
    t.frac(ML.polyEvalFrac(p, F.of(0)), -2, 'p(0) = constant term');
    t.frac(ML.polyEvalFrac(p, F.of(2)), -8, 'p(2) = 4 − 10 − 2');
    // (λ − 3)(λ + 1) = λ² − 2λ − 3, divided by (λ − 3) gives λ + 1
    t.eq(ML.polyText(ML.polyDeflate([F.of(-3), F.of(-2), F.of(1)], F.of(3)), 'λ'), 'λ + 1', 'synthetic division');
  });

  MLTest.suite('Polynomials — exact rational roots', function (t) {
    // λ² − 5λ + 6 = (λ − 2)(λ − 3)
    const found = ML.rationalRoots([F.of(6), F.of(-5), F.of(1)]);
    t.eq(found.roots.length, 2, 'two rational roots');
    t.eq(found.roots.map(function (r) { return r.value.toString(); }).sort().join(','), '2,3', 'roots are 2 and 3');
    t.eq(ML.polyDegree(found.remaining), 0, 'nothing left over');

    // Repeated root: (λ − 4)² = λ² − 8λ + 16
    const repeated = ML.rationalRoots([F.of(16), F.of(-8), F.of(1)]);
    t.eq(repeated.roots.length, 1, 'one distinct root');
    t.eq(repeated.roots[0].multiplicity, 2, 'with multiplicity 2');

    // Fractional root: 2λ − 1 = 0
    t.frac(ML.rationalRoots([F.of(-1), F.of(2)]).roots[0].value, '1/2', 'a fractional root is found exactly');

    // Root at zero: λ³ − λ = λ(λ − 1)(λ + 1)
    const zeroRoot = ML.rationalRoots([F.of(0), F.of(-1), F.of(0), F.of(1)]);
    t.eq(zeroRoot.roots.map(function (r) { return r.value.toString(); }).sort().join(','), '-1,0,1', 'includes the root at 0');

    // λ² − 2 has no rational roots.
    const irrational = ML.rationalRoots([F.of(-2), F.of(0), F.of(1)]);
    t.eq(irrational.roots.length, 0, 'no rational roots for λ² − 2');
    t.eq(ML.polyDegree(irrational.remaining), 2, 'the quadratic is left intact');
  });

  MLTest.suite('Polynomials — quadratics and radicals', function (t) {
    const rational = ML.quadraticRoots(F.of(1), F.of(-5), F.of(6));
    t.eq(rational.kind, 'rational', 'a perfect-square discriminant gives rational roots');
    t.eq(rational.roots.map(function (r) { return r.value.toString(); }).sort().join(','), '2,3', 'roots 2 and 3');

    const double = ML.quadraticRoots(F.of(1), F.of(-4), F.of(4));
    t.eq(double.roots.length, 1, 'a zero discriminant gives one root');
    t.eq(double.roots[0].multiplicity, 2, 'counted twice');

    // λ² − λ − 1: the golden ratio, (1 ± √5)/2
    const radical = ML.quadraticRoots(F.of(1), F.of(-1), F.of(-1));
    t.eq(radical.kind, 'radical', 'irrational roots are reported as radicals');
    t.frac(radical.discriminant, 5, 'discriminant is 5');
    t.close(radical.roots[0].complex.re, (1 + Math.sqrt(5)) / 2, 1e-12, 'first root is the golden ratio');
    t.close(radical.roots[1].complex.re, (1 - Math.sqrt(5)) / 2, 1e-12, 'second root');
    t.ok(ML.radicalText(radical.roots[0]).indexOf('√5') >= 0, 'the text shows √5 rather than a decimal');

    // λ² + 1: purely imaginary roots
    const complex = ML.quadraticRoots(F.of(1), F.of(0), F.of(1));
    t.eq(complex.kind, 'complex', 'a negative discriminant gives complex roots');
    t.close(complex.roots[0].complex.im, 1, 1e-12, 'root is +i');
    t.close(complex.roots[1].complex.im, -1, 1e-12, 'and −i');

    // √8 = 2√2
    const simplified = ML.simplifyRadical(8n);
    t.eq(String(simplified.outside), '2', 'perfect square pulled out of √8');
    t.eq(String(simplified.inside), '2', 'leaving √2');
    t.eq(String(ML.simplifyRadical(12n).outside) + '√' + String(ML.simplifyRadical(12n).inside), '2√3', '√12 = 2√3');

    // Durand–Kerner on a cubic with known roots 1, 2, 3.
    const numeric = ML.rootsNumeric([F.of(-6), F.of(11), F.of(-6), F.of(1)]);
    t.ok(numeric.converged, 'the numerical solver converged');
    t.ok(numeric.residual < 1e-8, 'residual is small: ' + numeric.residual);
    const reals = numeric.roots.map(function (z) { return Math.round(z.re * 1e6) / 1e6; }).sort(function (a, b) { return a - b; });
    t.eq(reals.join(','), '1,2,3', 'finds the roots 1, 2, 3');
  });

  MLTest.suite('Characteristic polynomial', function (t) {
    // det(A − λI) for [[1,2],[3,4]] = λ² − 5λ − 2
    const p = ML.characteristicPolynomial(M.from([[1, 2], [3, 4]]));
    t.eq(p.text, 'λ² − 5λ − 2', '2×2 characteristic polynomial');
    t.eq(ML.characteristicPolynomial(M.identity(2)).text, 'λ² − 2λ + 1', 'for the identity: (λ − 1)²');
    t.eq(ML.characteristicPolynomial(M.from([[5]])).text, 'λ − 5', '1×1 case');
    t.eq(
      ML.characteristicPolynomial(M.from([[2, 0, 0], [0, 3, 0], [0, 0, 4]])).text,
      'λ³ − 9λ² + 26λ − 24',
      'diagonal 3×3: (λ−2)(λ−3)(λ−4)'
    );

    // The two identities every characteristic polynomial satisfies.
    [
      M.from([[1, 2], [3, 4]]),
      M.from([[6, 1, 1], [4, -2, 5], [2, 8, 7]]),
      M.from([[1, 0, 2, -1], [3, 0, 0, 5], [2, 1, 4, -3], [1, 0, 5, 0]]),
    ].forEach(function (A, index) {
      const poly = ML.characteristicPolynomial(A);
      const n = A.rows;
      // Coefficient of λⁿ⁻¹ is −trace; constant term is (−1)ⁿ·det.
      t.frac(poly.coefficients[n - 1], ML.traceMatrix(A).neg().toString(), 'matrix ' + (index + 1) + ': λⁿ⁻¹ coefficient = −tr(A)');
      const expectedConstant = n % 2 === 0 ? ML.determinant(A) : ML.determinant(A).neg();
      t.frac(poly.coefficients[0], expectedConstant.toString(), 'matrix ' + (index + 1) + ': constant term = (−1)ⁿdet(A)');
      // Cayley–Hamilton: p(A) = 0, exactly.
      t.ok(
        ML.isZeroMatrix(ML.evaluatePolynomialAtMatrix(poly.coefficients, A)),
        'matrix ' + (index + 1) + ': Cayley–Hamilton p(A) = 0 holds exactly'
      );
    });
  });

  MLTest.suite('Eigenvalues — exact cases', function (t) {
    t.eq(texts(ML.eigenvalues(M.from([[2, 0], [0, 3]]))), '2 | 3', 'diagonal matrix: the diagonal entries');
    t.eq(texts(ML.eigenvalues(M.from([[4, 1], [2, 3]]))), '2 | 5', 'λ² − 7λ + 10 → 2 and 5');
    t.eq(texts(ML.eigenvalues(M.from([[2, 1], [1, 2]]))), '1 | 3', 'symmetric matrix, real eigenvalues');
    t.eq(texts(ML.eigenvalues(M.identity(3))), '1×3', 'identity: 1 with multiplicity 3');
    t.eq(texts(ML.eigenvalues(M.zeros(2, 2))), '0×2', 'zero matrix: 0 twice');
    t.eq(texts(ML.eigenvalues(M.from([[1, 1], [0, 1]]))), '1×2', 'shear: repeated eigenvalue 1');
    t.eq(texts(ML.eigenvalues(M.from([[2, 0, 0], [0, 3, 4], [0, 4, 9]]))), '1 | 11 | 2', '3×3 with integer eigenvalues');
    // Triangular matrices wear their eigenvalues on the diagonal.
    t.eq(texts(ML.eigenvalues(M.from([[3, 7, 2], [0, -1, 5], [0, 0, 4]]))), '-1 | 3 | 4', 'triangular: the diagonal');
    // Fractional eigenvalues stay exact.
    t.eq(texts(ML.eigenvalues(M.from([['1/2', 0], [0, '1/3']]))), '1/2 | 1/3', 'fractional eigenvalues remain fractions');

    const exact = ML.eigenvalues(M.from([[4, 1], [2, 3]]));
    t.ok(exact.allExact, 'flagged as exact');
    t.eq(exact.residual, 0, 'no numerical residual');
  });

  MLTest.suite('Eigenvalues — irrational and complex', function (t) {
    // [[1,1],[1,0]] has characteristic polynomial λ² − λ − 1.
    const golden = ML.eigenvalues(M.from([[1, 1], [1, 0]]));
    t.eq(golden.values.length, 2, 'two eigenvalues');
    t.ok(golden.allExact, 'a quadratic is still solved exactly (in closed form)');
    t.ok(golden.values.some(function (v) { return v.text.indexOf('√5') >= 0; }), 'shown with √5, not as a decimal');
    t.close(golden.values[0].complex.re, (1 + Math.sqrt(5)) / 2, 1e-12, 'numeric value is the golden ratio');
    t.eq(golden.values[0].kind, 'radical', 'kind is radical');

    // A rotation by 90° has no real eigenvalues.
    const rotation = ML.eigenvalues(M.from([[0, -1], [1, 0]]));
    t.eq(rotation.values.length, 2, 'two complex eigenvalues');
    t.eq(rotation.values[0].kind, 'complex', 'kind is complex');
    t.close(Math.abs(rotation.values[0].complex.im), 1, 1e-12, 'eigenvalues are ±i');
    t.ok(rotation.notes.join(' ').indexOf('rotation') >= 0, 'the note explains why a rotation has no real eigenvector');

    // Companion matrix of λ³ − λ − 1: irreducible cubic, so numerical roots.
    const cubic = ML.eigenvalues(M.from([[0, 0, 1], [1, 0, 1], [0, 1, 0]]));
    t.eq(cubic.polynomial.text, 'λ³ − λ − 1', 'characteristic polynomial is the intended cubic');
    t.notOk(cubic.allExact, 'honestly flagged as not exact');
    t.ok(cubic.residual < 1e-8, 'numerical residual is small');
    t.ok(cubic.notes.join(' ').indexOf('degree 3') >= 0, 'the note explains why a formula is not available');
    const realRoot = cubic.values.filter(function (v) { return Math.abs(v.complex.im) < 1e-8; })[0];
    t.close(realRoot.complex.re, 1.3247179572447458, 1e-8, 'the real root is the plastic number');
  });

  MLTest.suite('Eigenvectors', function (t) {
    const A = M.from([[4, 1], [2, 3]]);
    const analysis = ML.eigenAnalysis(A);
    t.eq(analysis.pairs.length, 2, 'two eigenpairs');

    const byValue = {};
    analysis.pairs.forEach(function (pair) { byValue[pair.eigenvalue.text] = pair; });
    t.matrix(byValue['5'].vectors[0], [[1], [1]], 'eigenvector for λ = 5 is (1, 1)');
    t.matrix(byValue['2'].vectors[0], [[1], [-2]], 'eigenvector for λ = 2 is (1, −2)');
    t.ok(byValue['5'].exact && byValue['2'].exact, 'both eigenvectors are exact');
    t.eq(byValue['5'].residuals[0], 0, 'Av = λv holds exactly for λ = 5');

    // Av = λv verified directly for every exact pair.
    analysis.pairs.forEach(function (pair) {
      pair.vectors.forEach(function (v) {
        t.matrix(
          ML.multiplyMatrices(A, v),
          ML.scalarMultiply(v, pair.eigenvalue.frac).toJSON(),
          'Av = λv for λ = ' + pair.eigenvalue.text
        );
      });
    });

    // Symmetric matrices have orthogonal eigenvectors.
    const symmetric = ML.eigenAnalysis(M.from([[2, 1], [1, 2]]));
    const v1 = symmetric.pairs[0].vectors[0];
    const v2 = symmetric.pairs[1].vectors[0];
    const dot = v1.get(0, 0).mul(v2.get(0, 0)).add(v1.get(1, 0).mul(v2.get(1, 0)));
    t.frac(dot, 0, 'eigenvectors of a symmetric matrix are perpendicular');

    // A repeated eigenvalue with a full eigenspace.
    const identity = ML.eigenAnalysis(M.identity(3));
    t.eq(identity.pairs[0].geometric, 3, 'the identity has a 3-dimensional eigenspace');
    t.eq(identity.pairs[0].algebraic, 3, 'algebraic multiplicity 3');
    t.notOk(identity.pairs[0].defective, 'not defective');

    // A repeated eigenvalue with a deficient eigenspace.
    const shear = ML.eigenAnalysis(M.from([[1, 1], [0, 1]]));
    t.eq(shear.pairs[0].algebraic, 2, 'shear: algebraic multiplicity 2');
    t.eq(shear.pairs[0].geometric, 1, 'but only one independent eigenvector');
    t.ok(shear.pairs[0].defective, 'flagged as defective');
    t.matrix(shear.pairs[0].vectors[0], [[1], [0]], 'its single eigenvector is (1, 0)');

    // Complex eigenvector, computed numerically.
    const rotation = ML.eigenAnalysis(M.from([[0, -1], [1, 0]]));
    t.eq(rotation.pairs.length, 2, 'two complex eigenpairs');
    t.notOk(rotation.pairs[0].exact, 'marked as numerical');
    t.ok(rotation.pairs[0].numericVectors.length === 1, 'one complex eigenvector each');
    t.ok(rotation.pairs[0].residuals[0] < 1e-8, 'Av − λv is numerically zero');
  });

  MLTest.suite('Eigen analysis — the honesty checks', function (t) {
    [
      M.from([[4, 1], [2, 3]]),
      M.from([[2, 1], [1, 2]]),
      M.from([[6, 1, 1], [4, -2, 5], [2, 8, 7]]),
      M.from([[0, -1], [1, 0]]),
      M.from([[1, 1], [1, 0]]),
      M.from([[1, 1], [0, 1]]),
      M.identity(4),
    ].forEach(function (A, index) {
      const analysis = ML.eigenAnalysis(A);
      t.ok(analysis.checks.traceMatches, 'matrix ' + (index + 1) + ': eigenvalues sum to the trace');
      t.ok(analysis.checks.detMatches, 'matrix ' + (index + 1) + ': eigenvalues multiply to the determinant');
      t.eq(analysis.totalAlgebraic, A.rows, 'matrix ' + (index + 1) + ': multiplicities add up to n');
    });

    t.throws(function () { ML.eigenAnalysis(M.from([[1, 2, 3], [4, 5, 6]])); }, 'square', 'non-square is refused');
    t.throws(function () { ML.eigenAnalysis(M.identity(9)); }, 'limited to 8×8', 'an unreasonable size is refused honestly');
  });

  MLTest.suite('Diagonalisation', function (t) {
    const A = M.from([[4, 1], [2, 3]]);
    const result = ML.diagonalizeMatrix(A);
    t.ok(result.diagonalizable, 'distinct eigenvalues → diagonalisable');
    t.ok(result.exact, 'rational eigenvalues → exact P and D');
    t.ok(result.verified, 'PDP⁻¹ = A verified');
    t.matrix(result.D, [[5, 0], [0, 2]], 'D holds the eigenvalues');
    t.matrix(ML.multiplyMatrices(ML.multiplyMatrices(result.P, result.D), result.Pinv), A.toJSON(), 'PDP⁻¹ reproduces A exactly');
    t.matrix(ML.multiplyMatrices(result.P, result.Pinv), M.identity(2).toJSON(), 'P·P⁻¹ = I');

    // A already-diagonal matrix diagonalises trivially.
    const diagonal = ML.diagonalizeMatrix(M.diagonal([3, 7]));
    t.ok(diagonal.diagonalizable && diagonal.exact, 'a diagonal matrix is already diagonalised');

    // Symmetric 3×3 with integer eigenvalues.
    const symmetric = M.from([[2, 0, 0], [0, 3, 4], [0, 4, 9]]);
    const symResult = ML.diagonalizeMatrix(symmetric);
    t.ok(symResult.verified, 'symmetric 3×3: PDP⁻¹ = A verified exactly');
    t.matrix(
      ML.multiplyMatrices(ML.multiplyMatrices(symResult.P, symResult.D), symResult.Pinv),
      symmetric.toJSON(),
      'reconstruction is exact'
    );

    // Defective matrix cannot be diagonalised, and says why.
    const shear = ML.diagonalizeMatrix(M.from([[1, 1], [0, 1]]));
    t.notOk(shear.diagonalizable, 'a defective matrix is not diagonalisable');
    t.ok(shear.reason.indexOf('only 1 independent eigenvector') >= 0, 'the reason names the deficiency');

    // Complex eigenvalues: diagonalisable over ℂ, declined over ℝ, explained.
    const rotation = ML.diagonalizeMatrix(M.from([[0, -1], [1, 0]]));
    t.ok(rotation.diagonalizable, 'a rotation is diagonalisable over ℂ');
    t.notOk(rotation.overReals, 'but not over ℝ');
    t.ok(rotation.reason.indexOf('complex numbers') >= 0, 'and that is stated rather than faked');

    // Regression: eigenvalues found by the *numerical* root finder are tagged
    // 'numeric', not 'complex', even when they genuinely have an imaginary
    // part. A check on the tag alone once let this 4×4 (whose four eigenvalues
    // are all complex) reach the real diagonalisation path, which then built P
    // out of the real parts of complex eigenvectors and produced nonsense.
    const allComplex = M.from([[1, 0, 2, -1], [3, 0, 0, 5], [2, 1, 4, -3], [1, 0, 5, 0]]);
    const spectrum = ML.eigenvalues(allComplex);
    t.ok(
      spectrum.values.every(function (v) { return Math.abs(v.complex.im) > 1e-6; }),
      'the 4×4 regression case really does have four complex eigenvalues'
    );
    t.ok(
      spectrum.values.every(function (v) { return ML.isComplexEigenvalue(v); }),
      'isComplexEigenvalue looks at the value, not just the kind tag'
    );
    const complexAnalysis = ML.eigenAnalysis(allComplex);
    t.ok(complexAnalysis.hasComplex, 'the analysis reports complex eigenvalues');
    const complex4 = ML.diagonalizeMatrix(allComplex);
    t.notOk(complex4.overReals, 'so diagonalisation is declined over the reals');
    t.eq(complex4.P, undefined, 'and no bogus real P is produced');

    // Irrational eigenvalues: numeric P and D, with the error reported.
    const golden = ML.diagonalizeMatrix(M.from([[1, 1], [1, 0]]));
    t.ok(golden.diagonalizable, 'irrational eigenvalues still give a diagonalisation');
    t.notOk(golden.exact, 'flagged as not exact');
    t.ok(golden.reconstructionError < 1e-9, 'reconstruction error is tiny: ' + golden.reconstructionError);
  });
})(globalThis.ML, globalThis.MLTest);
