/**
 * Suite 7 — integration.
 *
 * These tests do not check individual functions against remembered answers.
 * They check that independent parts of MatrixLab agree with each other: the
 * determinant from cofactor expansion against the one from PLU pivots against
 * the product of the eigenvalues; the rank from elimination against the rank
 * from the SVD; and so on. Agreement between routes that share no code is the
 * strongest evidence available that the mathematics is right.
 */
(function (ML, MLTest) {
  'use strict';

  const M = ML.Matrix;

  /** A spread of shapes and awkward cases, used by several suites below. */
  const SQUARE = [
    { name: 'plain 2×2', matrix: M.from([[1, 2], [3, 4]]) },
    { name: 'determinant 1', matrix: M.from([[2, 1], [5, 3]]) },
    { name: 'symmetric', matrix: M.from([[2, 1], [1, 2]]) },
    { name: 'rotation', matrix: M.from([[0, -1], [1, 0]]) },
    { name: 'shear (defective)', matrix: M.from([[1, 1], [0, 1]]) },
    { name: 'singular', matrix: M.from([[1, 2], [2, 4]]) },
    { name: 'identity 3', matrix: M.identity(3) },
    { name: 'classic 3×3', matrix: M.from([[6, 1, 1], [4, -2, 5], [2, 8, 7]]) },
    { name: 'tridiagonal', matrix: M.from([[2, -1, 0], [-1, 2, -1], [0, -1, 2]]) },
    { name: 'needs a swap', matrix: M.from([[0, 2, 1], [1, 0, 3], [2, 1, 0]]) },
    { name: 'fractions', matrix: M.from([['1/2', '1/3'], ['1/4', '1/5']]) },
    { name: 'zero 3×3', matrix: M.zeros(3, 3) },
    { name: 'triangular 4×4', matrix: M.from([[2, 9, -3, 4], [0, -1, 7, 1], [0, 0, 5, 8], [0, 0, 0, 3]]) },
    { name: '4×4', matrix: M.from([[1, 0, 2, -1], [3, 0, 0, 5], [2, 1, 4, -3], [1, 0, 5, 0]]) },
  ];

  const ALL_SHAPES = SQUARE.concat([
    { name: 'wide 2×3', matrix: M.from([[1, 2, 3], [4, 5, 6]]) },
    { name: 'tall 3×2', matrix: M.from([[1, 1], [1, 2], [1, 3]]) },
    { name: 'rank-2 3×4', matrix: M.from([[1, 2, 2, 2], [2, 4, 6, 8], [3, 6, 8, 10]]) },
    { name: 'single row', matrix: M.from([[1, 2, 3]]) },
    { name: 'single column', matrix: M.from([[1], [2], [3]]) },
    { name: 'zero 2×4', matrix: M.zeros(2, 4) },
  ]);

  MLTest.suite('Integration — the determinant, four different ways', function (t) {
    SQUARE.forEach(function (entry) {
      const A = entry.matrix;
      const viaDefault = ML.determinant(A);
      t.frac(ML.determinantByElimination(A), viaDefault.toString(), entry.name + ': elimination agrees');
      if (A.rows <= 5) {
        t.frac(ML.determinantByCofactor(A), viaDefault.toString(), entry.name + ': cofactor expansion agrees');
      }
      // PLU: det(A) = (−1)^swaps × product of U's diagonal.
      t.frac(ML.pluDecomposition(A).determinant, viaDefault.toString(), entry.name + ': PLU pivots agree');
      // The product of the eigenvalues, with multiplicity.
      if (A.rows <= 4) {
        const spectrum = ML.eigenvalues(A);
        let product = ML.Complex.ONE;
        spectrum.values.forEach(function (value) {
          for (let k = 0; k < value.multiplicity; k++) product = product.mul(value.complex);
        });
        t.close(product.re, viaDefault.toNumber(), 1e-7, entry.name + ': product of eigenvalues agrees');
        t.close(product.im, 0, 1e-7, entry.name + ': and has no imaginary part');
      }
    });
  });

  MLTest.suite('Integration — rank, three different ways', function (t) {
    ALL_SHAPES.forEach(function (entry) {
      const A = entry.matrix;
      const exact = ML.matrixRank(A);
      // From the reduced form directly.
      t.eq(ML.eliminate(A, { full: true }).rank, exact, entry.name + ': RREF pivot count agrees');
      // From the SVD — a completely independent numerical route.
      t.eq(ML.svdDecomposition(A).rank, exact, entry.name + ': SVD singular value count agrees');
      // rank(A) = rank(Aᵗ).
      t.eq(ML.matrixRank(ML.transposeMatrix(A)), exact, entry.name + ': rank(Aᵗ) = rank(A)');
      // Rank–nullity, both ways round.
      const four = ML.fourSubspaces(A);
      t.eq(four.rank + four.nullity, A.cols, entry.name + ': rank + nullity = columns');
      t.eq(four.rank + four.leftNullity, A.rows, entry.name + ': rank + left nullity = rows');
    });
  });

  MLTest.suite('Integration — inverses agree and verify', function (t) {
    SQUARE.forEach(function (entry) {
      const A = entry.matrix;
      const singular = ML.determinant(A).isZero();
      if (singular) {
        t.throws(function () { ML.inverseMatrix(A); }, 'singular', entry.name + ': singular matrix is refused');
        return;
      }
      const gaussJordan = ML.inverseByGaussJordan(A);
      t.matrix(ML.multiplyMatrices(A, gaussJordan), M.identity(A.rows).toJSON(), entry.name + ': A·A⁻¹ = I exactly');
      t.matrix(ML.multiplyMatrices(gaussJordan, A), M.identity(A.rows).toJSON(), entry.name + ': A⁻¹·A = I exactly');
      if (A.rows <= 5) {
        t.matrix(ML.inverseByAdjugate(A), gaussJordan.toJSON(), entry.name + ': adjugate route agrees exactly');
      }
      // det(A⁻¹) = 1/det(A)
      t.frac(ML.determinant(gaussJordan), ML.determinant(A).inv().toString(), entry.name + ': det(A⁻¹) = 1/det(A)');
      // Solving with the inverse must match solving by elimination.
      const b = M.column(A.rowAt(0).map(function (_, i) { return i + 1; }));
      t.matrix(
        ML.solveLinearSystem(A, b).solution,
        ML.multiplyMatrices(gaussJordan, b).toJSON(),
        entry.name + ': elimination and A⁻¹b agree'
      );
    });
  });

  MLTest.suite('Integration — eigenvalue identities hold everywhere', function (t) {
    SQUARE.filter(function (entry) { return entry.matrix.rows <= 4; }).forEach(function (entry) {
      const A = entry.matrix;
      const analysis = ML.eigenAnalysis(A);
      t.ok(analysis.checks.traceMatches, entry.name + ': eigenvalues sum to the trace');
      t.ok(analysis.checks.detMatches, entry.name + ': eigenvalues multiply to the determinant');
      t.eq(analysis.totalAlgebraic, A.rows, entry.name + ': algebraic multiplicities total n');

      // Cayley–Hamilton, exactly.
      const polynomial = ML.characteristicPolynomial(A);
      t.ok(
        ML.isZeroMatrix(ML.evaluatePolynomialAtMatrix(polynomial.coefficients, A)),
        entry.name + ': p(A) = 0 exactly'
      );

      // Every reported eigenpair really satisfies Av = λv.
      analysis.pairs.forEach(function (pair) {
        if (pair.vectors) {
          pair.vectors.forEach(function (v) {
            t.matrix(
              ML.multiplyMatrices(A, v),
              ML.scalarMultiply(v, pair.eigenvalue.frac).toJSON(),
              entry.name + ': Av = λv exactly for λ = ' + pair.eigenvalue.text
            );
          });
        } else {
          pair.residuals.forEach(function (residual, index) {
            t.ok(residual < 1e-7, entry.name + ': Av ≈ λv for numeric eigenvector ' + (index + 1));
          });
        }
      });

      // Diagonalisable matrices must reconstruct.
      const diagonalisation = ML.diagonalizeMatrix(A);
      if (diagonalisation.diagonalizable && diagonalisation.P) {
        const rebuilt = ML.multiplyMatrices(
          ML.multiplyMatrices(diagonalisation.P, diagonalisation.D),
          diagonalisation.Pinv
        );
        if (diagonalisation.exact) {
          t.matrix(rebuilt, A.toJSON(), entry.name + ': PDP⁻¹ = A exactly');
        } else {
          t.matrixClose(rebuilt, A, 1e-8, entry.name + ': PDP⁻¹ ≈ A');
        }
      }
    });
  });

  MLTest.suite('Integration — factorisations reconstruct', function (t) {
    ALL_SHAPES.forEach(function (entry) {
      const A = entry.matrix;

      if (A.isSquare()) {
        const plu = ML.pluDecomposition(A);
        t.matrix(
          ML.multiplyMatrices(plu.P, A),
          ML.multiplyMatrices(plu.L, plu.U).toJSON(),
          entry.name + ': PA = LU exactly'
        );
      }

      if (A.rows >= A.cols) {
        const qr = ML.qrDecomposition(A);
        t.ok(qr.error < 1e-9, entry.name + ': QR reconstructs A');
        t.ok(qr.orthogonalityError < 1e-9, entry.name + ': Q has orthonormal columns');
      }

      const svd = ML.svdDecomposition(A);
      t.ok(svd.error < 1e-8, entry.name + ': UΣVᵗ reconstructs A (error ' + svd.error.toExponential(2) + ')');
      // Singular values are non-negative and descending.
      let ordered = true;
      for (let i = 1; i < svd.singular.length; i++) {
        if (svd.singular[i] > svd.singular[i - 1] + 1e-10) ordered = false;
      }
      t.ok(ordered, entry.name + ': singular values are ordered');

      // AᵗA is symmetric positive semi-definite; if positive definite, Cholesky must work.
      const gram = ML.multiplyMatrices(ML.transposeMatrix(A), A);
      if (ML.isPositiveDefinite(gram)) {
        const chol = ML.choleskyDecomposition(gram);
        t.ok(chol.error < 1e-8, entry.name + ': Cholesky of AᵗA reconstructs it');
      }
    });
  });

  MLTest.suite('Integration — solving and least squares are consistent', function (t) {
    ALL_SHAPES.forEach(function (entry) {
      const A = entry.matrix;
      const b = M.column(A.rowAt(0).map(function (_, i) { return (i % 3) + 1; }).slice(0, A.rows));
      if (b.rows !== A.rows) return;

      const solution = ML.solveLinearSystem(A, b);
      if (solution.type === 'unique') {
        t.matrix(ML.multiplyMatrices(A, solution.solution), b.toJSON(), entry.name + ': the unique solution checks out');
      } else if (solution.type === 'infinite') {
        t.matrix(ML.multiplyMatrices(A, solution.particular), b.toJSON(), entry.name + ': the particular solution checks out');
        solution.nullBasis.forEach(function (vector, index) {
          t.ok(
            ML.isZeroMatrix(ML.multiplyMatrices(A, vector)),
            entry.name + ': null-space direction ' + (index + 1) + ' satisfies Ax = 0'
          );
        });
      }

      // Least squares always produces a residual perpendicular to the columns,
      // whether or not an exact solution exists.
      const ls = ML.leastSquares(A, b);
      t.ok(ML.isZeroMatrix(ls.orthogonalityCheck), entry.name + ': Aᵗ(b − Ax̂) = 0 exactly');
      if (solution.type !== 'none') {
        t.frac(ls.residualNormSquared, 0, entry.name + ': a solvable system has zero least-squares error');
      }
    });
  });

  MLTest.suite('Integration — subspaces are orthogonal and correct', function (t) {
    ALL_SHAPES.forEach(function (entry) {
      const A = entry.matrix;
      const four = ML.fourSubspaces(A);
      const orthogonality = ML.verifySubspaceOrthogonality(four);
      t.ok(orthogonality.allZero, entry.name + ': row ⊥ null and column ⊥ left-null, exactly');

      four.spaces.null.basis.forEach(function (vector, index) {
        t.ok(ML.isZeroMatrix(ML.multiplyMatrices(A, vector)), entry.name + ': null basis ' + (index + 1) + ' gives Ax = 0');
      });
      four.spaces.leftNull.basis.forEach(function (vector, index) {
        t.ok(
          ML.isZeroMatrix(ML.multiplyMatrices(ML.transposeMatrix(A), vector)),
          entry.name + ': left-null basis ' + (index + 1) + ' gives Aᵗy = 0'
        );
      });
      if (four.spaces.column.basis.length) {
        t.eq(
          ML.linearIndependence(four.spaces.column.basis).rank,
          four.rank,
          entry.name + ': the column-space basis is independent and the right size'
        );
      }

      // Gram–Schmidt on the columns must preserve the span.
      const gs = ML.gramSchmidt(A.columns());
      t.eq(gs.dimension, four.rank, entry.name + ': Gram–Schmidt keeps the dimension of the span');
      t.ok(gs.allOrthogonal, entry.name + ': and produces an exactly orthogonal set');
    });
  });

  MLTest.suite('Integration — the example library is sound', function (t) {
    t.ok(ML.examples.all.length >= 20, 'the library has a useful number of examples');
    const seen = {};
    ML.examples.all.forEach(function (example) {
      t.notOk(seen[example.id], 'example id "' + example.id + '" is unique');
      seen[example.id] = true;
      let matrix = null;
      try {
        matrix = ML.examples.matrixOf(example);
      } catch (error) {
        t.ok(false, example.id + ' builds a valid matrix (' + error.message + ')');
        return;
      }
      t.ok(matrix.rows >= 1 && matrix.cols >= 1, example.id + ' has a sensible shape');
      t.ok(matrix.rows <= ML.MAX_DIM && matrix.cols <= ML.MAX_DIM, example.id + ' is within the size limit');
      t.ok(!!example.teaches && example.teaches.length > 20, example.id + ' explains what it demonstrates');
      t.ok(ML.examples.categories.indexOf(example.category) >= 0, example.id + ' has a known category');
    });

    // Spot-check the specific claims made in the library text.
    t.frac(ML.determinant(ML.examples.matrixOf(ML.examples.byId('inverse-example'))), 1, 'the "integer inverse" example really has determinant 1');
    t.matrix(
      ML.inverseMatrix(ML.examples.matrixOf(ML.examples.byId('inverse-example'))),
      [[3, -1], [-5, 2]],
      'and the inverse is what the description claims'
    );
    t.frac(ML.determinant(ML.examples.matrixOf(ML.examples.byId('fractions'))), '1/60', 'the fractions example has determinant 1/60');
    t.eq(ML.matrixRank(ML.examples.matrixOf(ML.examples.byId('singular-3x3'))), 2, 'the rank-2 3×3 example really has rank 2');
    t.eq(ML.nilpotencyIndex(ML.examples.matrixOf(ML.examples.byId('nilpotent'))).index, 3, 'the nilpotent example has index 3');
    t.ok(ML.isPositiveDefinite(ML.examples.matrixOf(ML.examples.byId('positive-definite'))), 'the positive definite example is positive definite');
    t.ok(ML.isOrthogonal(ML.examples.matrixOf(ML.examples.byId('orthogonal-3'))), 'the permutation example is orthogonal');
    t.eq(
      ML.characteristicPolynomial(ML.examples.matrixOf(ML.examples.byId('cubic-eigen'))).text,
      'λ³ − λ − 1',
      'the irreducible cubic example has the polynomial it claims'
    );
    t.eq(
      ML.solveLinearSystem(
        ML.examples.matrixOf(ML.examples.byId('unique-system')).slice(0, 3, 0, 3),
        M.column([6, -4, 27])
      ).type,
      'unique',
      'the "one solution" system really has one solution'
    );
    t.eq(
      ML.solveLinearSystem(
        ML.examples.matrixOf(ML.examples.byId('inconsistent')).slice(0, 2, 0, 2),
        M.column([2, 5])
      ).type,
      'none',
      'the inconsistent system really is inconsistent'
    );
  });

  MLTest.suite('Integration — the lesson data is well formed', function (t) {
    t.eq(ML.lessons.levels.length, 8, 'there are eight levels');
    const ids = {};
    const KNOWN_BLOCKS = ['h', 'p', 'formula', 'list', 'note', 'callout', 'matrix', 'try', 'label'];
    ML.lessons.levels.forEach(function (level, index) {
      t.eq(level.number, index + 1, 'level ' + (index + 1) + ' is numbered correctly');
      t.ok(level.topics.length > 0, 'level ' + level.number + ' has topics');
      level.topics.forEach(function (topic) {
        t.notOk(ids[topic.id], 'topic id "' + topic.id + '" is unique');
        ids[topic.id] = true;
        t.ok(topic.content && topic.content.length >= 3, topic.id + ' has real content');
        topic.content.forEach(function (block) {
          const keys = Object.keys(block);
          const unknown = keys.filter(function (key) { return KNOWN_BLOCKS.indexOf(key) < 0; });
          t.eq(unknown.length, 0, topic.id + ' uses only known block types' + (unknown.length ? ' (found ' + unknown.join(', ') + ')' : ''));
          if (block.matrix) {
            let ok = true;
            try {
              ML.Matrix.from(block.matrix);
            } catch (error) {
              ok = false;
            }
            t.ok(ok, topic.id + ': the example matrix in the lesson is valid');
          }
          if (block.try) {
            t.ok(!!block.try.view && !!block.try.text, topic.id + ': the "try it" block is complete');
          }
        });
      });
    });
    t.ok(ML.lessons.topicCount >= 25, 'the course has a substantial number of topics');
    t.ok(!!ML.lessons.findTopic('svd'), 'findTopic locates a known topic');
    t.eq(ML.lessons.findTopic('does-not-exist'), null, 'findTopic returns null for an unknown id');
  });

  MLTest.suite('Integration — bad input always gives a friendly MLError', function (t) {
    const bad = [
      ['determinant of a rectangle', function () { ML.determinant(M.from([[1, 2, 3], [4, 5, 6]])); }],
      ['inverse of a rectangle', function () { ML.inverseMatrix(M.from([[1, 2, 3], [4, 5, 6]])); }],
      ['inverse of a singular matrix', function () { ML.inverseMatrix(M.from([[1, 1], [1, 1]])); }],
      ['trace of a rectangle', function () { ML.traceMatrix(M.from([[1, 2, 3], [4, 5, 6]])); }],
      ['mismatched addition', function () { ML.addMatrices(M.identity(2), M.identity(3)); }],
      ['mismatched multiplication', function () { ML.multiplyMatrices(M.from([[1, 2, 3]]), M.from([[1, 2, 3]])); }],
      ['power of a rectangle', function () { ML.matrixPower(M.from([[1, 2, 3]]), 2); }],
      ['fractional power', function () { ML.matrixPower(M.identity(2), 1.5); }],
      ['scaling a row by zero', function () { ML.rowScale(M.identity(2), 0, 0); }],
      ['eigenvalues of a rectangle', function () { ML.eigenAnalysis(M.from([[1, 2, 3], [4, 5, 6]])); }],
      ['cross product in 2-D', function () { ML.crossProduct(M.column([1, 2]), M.column([3, 4])); }],
      ['normalising the zero vector', function () { ML.normalizeVector(M.column([0, 0])); }],
      ['projecting onto zero', function () { ML.projection(M.column([1, 2]), M.column([0, 0])); }],
      ['angle with the zero vector', function () { ML.vectorAngle(M.column([1, 2]), M.column([0, 0])); }],
      ['LU needing a swap', function () { ML.luDecomposition(M.from([[0, 1], [1, 0]])); }],
      ['Cholesky of a non-symmetric matrix', function () { ML.choleskyDecomposition(M.from([[1, 2], [3, 4]])); }],
      ['Cholesky of an indefinite matrix', function () { ML.choleskyDecomposition(M.from([[1, 2], [2, 1]])); }],
      ['QR of a wide matrix', function () { ML.qrDecomposition(M.from([[1, 2, 3]])); }],
      ["Cramer's rule on a singular matrix", function () { ML.solveByCramer(M.from([[1, 1], [1, 1]]), M.column([1, 2])); }],
      ['a ragged matrix', function () { M.from([[1, 2], [3]]); }],
      ['a non-numeric entry', function () { M.from([[1, 'oops']]); }],
      ['an unparseable fraction', function () { ML.Frac.parse('1/2/3'); }],
      ['a system with the wrong b', function () { ML.solveLinearSystem(M.identity(3), M.column([1, 2])); }],
      ['fitting with one point', function () { ML.fitLine([[1, 1]]); }],
      ['parsing an equation with no =', function () { ML.parseSystem('2x + 3y'); }],
    ];

    bad.forEach(function (entry) {
      let error = null;
      try {
        entry[1]();
      } catch (err) {
        error = err;
      }
      if (!error) {
        t.ok(false, entry[0] + ' should have been refused');
        return;
      }
      t.eq(error.name, 'MLError', entry[0] + ' gives an MLError, not a raw crash');
      t.ok(error.message.length > 25, entry[0] + ' explains the problem in a full sentence');
      // Looks for interpolated internals ("= undefined", "[object Object]"),
      // not the ordinary English words "undefined" or "not defined".
      t.notOk(
        /\[object|NaN|[:=]\s*undefined|undefined\s+undefined/.test(error.message),
        entry[0] + ' has no leaked internals in its message'
      );
    });
  });

  MLTest.suite('Integration — display settings never change a result', function (t) {
    const A = M.from([['1/3', '2/7'], ['5', '-1/6']]);
    const original = { decimals: ML.config.decimals, format: ML.config.format };
    const exactInverse = ML.inverseMatrix(A);
    const exactDeterminant = ML.determinant(A);

    ['auto', 'fraction', 'decimal'].forEach(function (format) {
      [2, 4, 8].forEach(function (decimals) {
        ML.setConfig({ format: format, decimals: decimals });
        t.matrix(ML.inverseMatrix(A), exactInverse.toJSON(), 'inverse is identical with format=' + format + ', decimals=' + decimals);
        t.frac(ML.determinant(A), exactDeterminant.toString(), 'determinant is identical with format=' + format + ', decimals=' + decimals);
      });
    });

    ML.setConfig({ format: 'decimal', decimals: 2 });
    t.eq(ML.fmt(ML.Frac.parse('1/3')), '0.33', 'decimal format is honoured');
    ML.setConfig({ format: 'auto', decimals: 4 });
    t.eq(ML.fmt(ML.Frac.parse('1/3')), '1/3', 'auto format keeps the exact fraction');

    ML.setConfig(original);
    t.eq(ML.config.decimals, original.decimals, 'settings restored for later suites');
  });
})(globalThis.ML, globalThis.MLTest);
