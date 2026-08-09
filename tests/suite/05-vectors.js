/**
 * Suite 5 — vectors, subspaces, orthogonality, least squares.
 */
(function (ML, MLTest) {
  'use strict';

  const M = ML.Matrix;

  MLTest.suite('Vectors — arithmetic and products', function (t) {
    const u = M.column([1, 2, 3]);
    const v = M.column([4, -5, 6]);
    t.matrix(ML.vectorAdd(u, v), [[5], [-3], [9]], 'u + v');
    t.matrix(ML.vectorSubtract(u, v), [[-3], [7], [-3]], 'u − v');
    t.matrix(ML.vectorScale(u, '1/2'), [['1/2'], [1], ['3/2']], 'exact scaling by ½');

    t.frac(ML.dotProduct(u, v), 12, 'u · v = 4 − 10 + 18');
    t.frac(ML.dotProduct(M.column([1, 0]), M.column([0, 1])), 0, 'perpendicular axes give 0');
    t.frac(ML.dotProduct(u, u), 14, 'u · u = ‖u‖²');
    t.frac(ML.dotProduct(v, u), 12, 'the dot product is symmetric');

    // Standard result: (1,2,3) × (4,-5,6) = (27, 6, -13)
    t.matrix(ML.crossProduct(u, v), [[27], [6], [-13]], 'u × v');
    t.frac(ML.dotProduct(ML.crossProduct(u, v), u), 0, 'the cross product is perpendicular to u');
    t.frac(ML.dotProduct(ML.crossProduct(u, v), v), 0, 'and perpendicular to v');
    t.matrix(ML.crossProduct(v, u), [[-27], [-6], [13]], 'v × u = −(u × v)');
    t.matrix(ML.crossProduct(u, ML.vectorScale(u, 2)), [[0], [0], [0]], 'parallel vectors give the zero vector');
    t.matrix(ML.crossProduct(M.column([1, 0, 0]), M.column([0, 1, 0])), [[0], [0], [1]], 'i × j = k');
    t.throws(function () { ML.crossProduct(M.column([1, 2]), M.column([3, 4])); }, 'three dimensions', '2-D cross product is refused with an explanation');
    t.throws(function () { ML.dotProduct(u, M.column([1, 2])); }, 'same number of components', 'mismatched lengths are reported');

    // Triple product = determinant.
    t.frac(
      ML.tripleProduct(M.column([1, 0, 0]), M.column([0, 1, 0]), M.column([0, 0, 1])),
      1,
      'the unit cube has volume 1'
    );
  });

  MLTest.suite('Vectors — length, angle, projection', function (t) {
    t.frac(ML.vectorNorm(M.column([3, 4])).exact, 5, '‖(3,4)‖ = 5 exactly');
    t.frac(ML.vectorNorm(M.column([1, 2, 2])).exact, 3, '‖(1,2,2)‖ = 3 exactly');
    t.frac(ML.vectorNorm(M.column([1, 1])).squared, 2, '‖(1,1)‖² = 2');
    t.eq(ML.vectorNorm(M.column([1, 1])).exact, null, 'but √2 is irrational');
    t.eq(ML.vectorNorm(M.column([1, 1])).text, '√2', 'shown in surd form');
    t.close(ML.vectorNorm(M.column([1, 1])).value, Math.SQRT2, 1e-12, 'with a correct decimal value');
    t.frac(ML.vectorNorm(M.column([0, 0])).squared, 0, 'the zero vector has length 0');

    t.frac(ML.vectorDistance(M.column([1, 1]), M.column([4, 5])).exact, 5, 'distance from (1,1) to (4,5) is 5');

    const unit = ML.normalizeVector(M.column([3, 4]));
    t.ok(unit.exact, 'a rational length gives an exact unit vector');
    t.matrix(unit.vector, [['3/5'], ['4/5']], 'unit vector is (3/5, 4/5)');
    t.frac(ML.dotProduct(unit.vector, unit.vector), 1, 'and it really has length 1');
    t.notOk(ML.normalizeVector(M.column([1, 1])).exact, 'an irrational length is flagged as inexact');
    t.throws(function () { ML.normalizeVector(M.column([0, 0])); }, 'no direction', 'the zero vector cannot be normalised');

    const right = ML.vectorAngle(M.column([1, 0]), M.column([0, 1]));
    t.close(right.degrees, 90, 1e-9, 'perpendicular vectors are 90° apart');
    t.ok(right.perpendicular, 'flagged as perpendicular');
    const same = ML.vectorAngle(M.column([1, 1]), M.column([2, 2]));
    t.close(same.degrees, 0, 1e-7, 'parallel vectors are 0° apart');
    t.ok(same.parallel, 'flagged as parallel');
    const opposite = ML.vectorAngle(M.column([1, 0]), M.column([-1, 0]));
    t.close(opposite.degrees, 180, 1e-7, 'opposite vectors are 180° apart');
    const known = ML.vectorAngle(M.column([1, 0]), M.column([1, 1]));
    t.close(known.degrees, 45, 1e-9, '(1,0) and (1,1) are 45° apart');
    t.frac(ML.vectorAngle(M.column([3, 4]), M.column([4, 3])).cosine, '24/25', 'cos θ is exact when the lengths are rational');

    // Projection of (3,4) onto (1,0) is (3,0).
    const projected = ML.projection(M.column([3, 4]), M.column([1, 0]));
    t.matrix(projected.projection, [[3], [0]], 'projection onto the x-axis drops the y component');
    t.matrix(projected.rejection, [[0], [4]], 'the leftover is the y component');
    t.frac(ML.dotProduct(projected.rejection, M.column([1, 0])), 0, 'the leftover is perpendicular to the direction');
    const oblique = ML.projection(M.column([4, 1]), M.column([1, 1]));
    t.matrix(oblique.projection, [['5/2'], ['5/2']], 'exact fractional projection');
    t.frac(ML.dotProduct(oblique.rejection, M.column([1, 1])), 0, 'still exactly perpendicular');
    t.throws(function () { ML.projection(M.column([1, 2]), M.column([0, 0])); }, 'zero vector', 'cannot project onto nothing');

    t.matrix(
      ML.linearCombination([M.column([1, 0]), M.column([0, 1])], [3, -2]),
      [[3], [-2]],
      '3e₁ − 2e₂'
    );
  });

  MLTest.suite('Independence, span and basis', function (t) {
    const independent = ML.linearIndependence([[1, 0], [0, 1]]);
    t.ok(independent.independent, 'the standard basis of ℝ² is independent');
    t.eq(independent.rank, 2, 'rank 2');

    const dependent = ML.linearIndependence([[1, 2], [2, 4]]);
    t.notOk(dependent.independent, 'proportional vectors are dependent');
    t.eq(dependent.rank, 1, 'rank 1');
    t.eq(dependent.dependencies[0].text, 'v₂ = 2v₁', 'the dependency is stated explicitly');

    // v₃ = v₁ + v₂
    const three = ML.linearIndependence([[1, 0, 0], [0, 1, 0], [1, 1, 0]]);
    t.notOk(three.independent, 'three vectors in a plane are dependent');
    t.eq(three.dependencies[0].text, 'v₃ = v₁ + v₂', 'names the exact combination');
    t.eq(three.basisIndices.join(','), '0,1', 'the first two form a basis of the span');

    // More vectors than dimensions must be dependent.
    t.notOk(ML.linearIndependence([[1, 0], [0, 1], [1, 1]]).independent, '3 vectors in ℝ² cannot be independent');

    const span = ML.spanContains([[1, 0], [0, 1]], [3, 5]);
    t.ok(span.inSpan, '(3,5) is in the span of the standard basis');
    t.ok(span.unique, 'and expressed uniquely');
    const outside = ML.spanContains([[1, 0], [2, 0]], [0, 1]);
    t.notOk(outside.inSpan, '(0,1) is not in the span of two x-axis vectors');
    const many = ML.spanContains([[1, 0], [2, 0]], [3, 0]);
    t.ok(many.inSpan && !many.unique, 'reachable, but in infinitely many ways');

    const basis = ML.basisOfSpan([[1, 1], [2, 2], [1, 0]]);
    t.eq(basis.dimension, 2, 'the span is 2-dimensional');
    t.eq(basis.indices.join(','), '0,2', 'the redundant middle vector is left out');
  });

  MLTest.suite('The four fundamental subspaces', function (t) {
    // A classic rank-2 example.
    const A = M.from([[1, 2, 2, 2], [2, 4, 6, 8], [3, 6, 8, 10]]);
    const four = ML.fourSubspaces(A);
    t.eq(four.rank, 2, 'rank 2');
    t.eq(four.nullity, 2, 'nullity 2 (4 columns − rank)');
    t.eq(four.leftNullity, 1, 'left nullity 1 (3 rows − rank)');

    t.eq(four.spaces.column.dimension, 2, 'column space is 2-dimensional');
    t.eq(four.spaces.column.ambient, 3, 'and lives in ℝ³');
    t.eq(four.spaces.row.dimension, 2, 'row space is 2-dimensional');
    t.eq(four.spaces.row.ambient, 4, 'and lives in ℝ⁴');
    t.eq(four.spaces.null.dimension, 2, 'null space is 2-dimensional');
    t.eq(four.spaces.leftNull.dimension, 1, 'left null space is 1-dimensional');

    // Every null-space basis vector must satisfy Ax = 0.
    four.spaces.null.basis.forEach(function (vector, index) {
      t.matrix(ML.multiplyMatrices(A, vector), [[0], [0], [0]], 'null basis vector ' + (index + 1) + ' satisfies Ax = 0');
    });
    // Every left-null basis vector must satisfy Aᵗy = 0.
    four.spaces.leftNull.basis.forEach(function (vector, index) {
      t.matrix(
        ML.multiplyMatrices(ML.transposeMatrix(A), vector),
        [[0], [0], [0], [0]],
        'left-null basis vector ' + (index + 1) + ' satisfies Aᵗy = 0'
      );
    });

    // Column-space basis vectors are genuine columns of A and independent.
    t.eq(ML.linearIndependence(four.spaces.column.basis).rank, 2, 'the column-space basis is independent');
    t.eq(ML.linearIndependence(four.spaces.row.basis).rank, 2, 'the row-space basis is independent');

    // The orthogonality relations, verified exactly.
    const orthogonality = ML.verifySubspaceOrthogonality(four);
    t.ok(orthogonality.allZero, 'row space ⊥ null space and column space ⊥ left null space, exactly');
    t.ok(four.relations.every(function (relation) { return relation.holds; }), 'all four stated relations hold');

    // Rank–nullity on several shapes.
    [M.identity(3), M.zeros(2, 5), M.from([[1, 2, 3]]), M.from([[1], [2], [3]])].forEach(function (X, index) {
      const report = ML.fourSubspaces(X);
      t.eq(report.rank + report.nullity, X.cols, 'matrix ' + (index + 1) + ': rank + nullity = columns');
      t.eq(report.rank + report.leftNullity, X.rows, 'matrix ' + (index + 1) + ': rank + left nullity = rows');
    });

    // An invertible matrix has trivial null spaces.
    const invertible = ML.fourSubspaces(M.from([[2, 1], [5, 3]]));
    t.eq(invertible.spaces.null.dimension, 0, 'an invertible matrix has only the zero vector in its null space');
    t.eq(invertible.spaces.leftNull.dimension, 0, 'and in its left null space');
  });

  MLTest.suite('Orthogonality and Gram–Schmidt', function (t) {
    t.ok(ML.isOrthogonalSet([[1, 0], [0, 1]]), 'the standard basis is orthogonal');
    t.ok(ML.isOrthonormalSet([[1, 0], [0, 1]]), 'and orthonormal');
    t.ok(ML.isOrthogonalSet([[3, 0], [0, 5]]), 'orthogonal without being unit length');
    t.notOk(ML.isOrthonormalSet([[3, 0], [0, 5]]), 'but not orthonormal');
    t.notOk(ML.isOrthogonalSet([[1, 1], [1, 0]]), 'a non-perpendicular pair is rejected');

    // The textbook example: (1,1,0), (1,0,1), (0,1,1)
    const gs = ML.gramSchmidt([[1, 1, 0], [1, 0, 1], [0, 1, 1]]);
    t.eq(gs.dimension, 3, 'three independent vectors give three orthogonal ones');
    t.ok(gs.allOrthogonal, 'every pair is exactly perpendicular');
    t.matrix(gs.orthogonal[0], [[1], [1], [0]], 'u₁ is v₁ unchanged');
    t.matrix(gs.orthogonal[1], [['1/2'], ['-1/2'], [1]], 'u₂ is exact with fractions');
    t.eq(gs.dropped.length, 0, 'nothing was dropped');
    // The span is preserved: the orthogonal set has the same rank as the input.
    t.eq(ML.linearIndependence(gs.orthogonal).rank, 3, 'the orthogonal set spans the same 3-dimensional space');

    // Dependent input: the redundant vector is dropped, not silently mangled.
    const withDependent = ML.gramSchmidt([[1, 0], [2, 0], [0, 1]]);
    t.eq(withDependent.dimension, 2, 'only two independent directions survive');
    t.eq(withDependent.dropped.join(','), '1', 'the dependent vector is reported as dropped');
    t.ok(withDependent.allOrthogonal, 'the survivors are perpendicular');

    // Already-orthogonal input should come out unchanged.
    const already = ML.gramSchmidt([[1, 0], [0, 1]]);
    t.matrix(already.orthogonal[0], [[1], [0]], 'orthogonal input is left alone (first)');
    t.matrix(already.orthogonal[1], [[0], [1]], 'orthogonal input is left alone (second)');
    t.ok(already.exact, 'and unit lengths make the orthonormal set exact');

    // Projection onto a subspace.
    const projected = ML.projectOntoSubspace([[1, 0, 0], [0, 1, 0]], [3, 4, 5]);
    t.matrix(projected.projection, [[3], [4], [0]], 'projecting onto the xy-plane drops z');
    t.matrix(projected.residual, [[0], [0], [5]], 'the error is the z component');

    // Projection matrix P = A(AᵗA)⁻¹Aᵗ.
    const pm = ML.projectionMatrix(M.from([[1], [1]]));
    t.matrix(pm.P, [['1/2', '1/2'], ['1/2', '1/2']], 'projection onto the line y = x');
    t.matrix(ML.multiplyMatrices(pm.P, pm.P), pm.P.toJSON(), 'P² = P exactly');
    t.matrix(ML.transposeMatrix(pm.P), pm.P.toJSON(), 'P is symmetric');
    t.throws(
      function () { ML.projectionMatrix(M.from([[1, 2], [1, 2]])); },
      'dependent',
      'dependent columns make the formula inapplicable, and it says so'
    );

    // Orthogonal complement.
    const complement = ML.orthogonalComplement([[1, 1, 0]]);
    t.eq(complement.dimension, 2, 'the complement of a line in ℝ³ is a plane');
    complement.basis.forEach(function (vector, index) {
      t.frac(ML.dotProduct(vector, M.column([1, 1, 0])), 0, 'complement basis vector ' + (index + 1) + ' is perpendicular');
    });
  });

  MLTest.suite('Least squares', function (t) {
    // Points (1,1), (2,2), (3,2) — the classic fit with slope 1/2, intercept 2/3.
    const fit = ML.fitLine([[1, 1], [2, 2], [3, 2]]);
    t.frac(fit.slope, '1/2', 'slope is exactly 1/2');
    t.frac(fit.intercept, '2/3', 'intercept is exactly 2/3');
    t.frac(fit.residualNormSquared, '1/6', 'sum of squared errors is 1/6');
    t.eq(fit.equation, 'y = 2/3 + 1/2x', 'the equation is written exactly');
    t.ok(ML.isZeroMatrix(fit.leastSquares.orthogonalityCheck), 'the residual is exactly perpendicular to the columns');
    t.close(fit.evaluate(2), 2 / 3 + 1, 1e-12, 'evaluating the fit works');

    // Collinear points must fit perfectly.
    const perfect = ML.fitLine([[0, 1], [1, 3], [2, 5]]);
    t.frac(perfect.slope, 2, 'slope 2 through collinear points');
    t.frac(perfect.intercept, 1, 'intercept 1');
    t.frac(perfect.residualNormSquared, 0, 'no error at all');
    t.ok(perfect.leastSquares.exactFit, 'flagged as an exact fit');
    t.frac(perfect.rSquared, 1, 'R² = 1');

    // A quadratic through 4 points.
    const quadratic = ML.fitPolynomial([[0, 1], [1, 0], [2, 1], [3, 4]], 2);
    t.frac(quadratic.coefficients[0], 1, 'constant term');
    t.frac(quadratic.coefficients[1], -2, 'linear term');
    t.frac(quadratic.coefficients[2], 1, 'quadratic term: y = x² − 2x + 1 passes through all four');
    t.frac(quadratic.residualNormSquared, 0, 'a perfect quadratic fit');

    // Least squares on an inconsistent system.
    const A = M.from([[1, 0], [0, 1], [1, 1]]);
    const b = M.column([1, 1, 0]);
    const ls = ML.leastSquares(A, b);
    t.eq(ls.type, 'unique', 'full column rank gives a unique least-squares solution');
    t.matrix(ls.solution, [['1/3'], ['1/3']], 'the exact least-squares solution');
    t.ok(ML.isZeroMatrix(ls.orthogonalityCheck), 'Aᵗ(b − Ax̂) = 0 exactly');
    t.notOk(ls.exactFit, 'and it is not an exact fit');
    // residual = b − Ax̂ = (2/3, 2/3, −2/3), so ‖r‖² = 3·(4/9) = 4/3
    t.frac(ls.residualNormSquared, '4/3', 'the minimum squared error');

    // Any other candidate must do worse — the defining property of least squares.
    [[0, 0], [1, 0], ['1/2', '1/2'], [1, 1]].forEach(function (candidate) {
      const x = M.column(candidate);
      const residual = ML.subtractMatrices(b, ML.multiplyMatrices(A, x));
      let squared = ML.Frac.ZERO;
      residual.colAt(0).forEach(function (value) { squared = squared.add(value.mul(value)); });
      t.ok(
        squared.gte(ls.residualNormSquared),
        'candidate (' + candidate.join(', ') + ') has error ' + squared.toString() + ' ≥ the minimum'
      );
    });

    // Rank-deficient least squares is reported, not faked.
    const deficient = ML.leastSquares(M.from([[1, 1], [1, 1]]), M.column([1, 3]));
    t.eq(deficient.type, 'infinite', 'dependent columns give infinitely many least-squares solutions');
    t.notOk(deficient.fullColumnRank, 'flagged as not full column rank');
    t.ok(ML.isZeroMatrix(deficient.orthogonalityCheck), 'the returned solution is still a genuine minimiser');

    t.throws(function () { ML.fitLine([[1, 1]]); }, 'At least two data points', 'one point is not a fit');
    t.throws(function () { ML.fitPolynomial([[1, 1], [2, 2]], 5); }, 'needs at least 6 points', 'too high a degree is refused');
    t.throws(function () { ML.leastSquares(M.from([[1, 0]]), M.column([1, 2])); }, 'one equation per data point', 'shape mismatch is reported');
  });
})(globalThis.ML, globalThis.MLTest);
