/**
 * Suite 3 — elementary row operations, REF, RREF, rank.
 * RREF is unique for a given matrix, so these expectations are exact.
 */
(function (ML, MLTest) {
  'use strict';

  const M = ML.Matrix;

  MLTest.suite('Elementary row operations', function (t) {
    const A = M.from([[1, 2], [3, 4]]);
    t.matrix(ML.rowSwap(A, 0, 1), [[3, 4], [1, 2]], 'R1 ↔ R2');
    t.matrix(ML.rowScale(A, 0, 3), [[3, 6], [3, 4]], 'R1 → 3R1');
    t.matrix(ML.rowScale(A, 1, '1/2'), [[1, 2], ['3/2', 2]], 'R2 → ½R2 keeps fractions exact');
    t.matrix(ML.rowAdd(A, 1, 0, -3), [[1, 2], [0, -2]], 'R2 → R2 − 3R1');
    t.matrix(A, [[1, 2], [3, 4]], 'the original matrix is never mutated');

    t.throws(function () { ML.rowScale(A, 0, 0); }, 'cannot be undone', 'scaling by zero is refused');
    t.throws(function () { ML.rowAdd(A, 0, 0, 2); }, 'two different rows', 'adding a row to itself is refused');
    t.throws(function () { ML.rowSwap(A, 0, 5); }, 'no row 6', 'out-of-range row is reported clearly');

    // Row operations are reversible, which is why they preserve the solution set.
    const swapped = ML.rowSwap(A, 0, 1);
    t.matrix(ML.rowSwap(swapped, 0, 1), [[1, 2], [3, 4]], 'a swap undoes itself');
    const added = ML.rowAdd(A, 1, 0, -3);
    t.matrix(ML.rowAdd(added, 1, 0, 3), [[1, 2], [3, 4]], 'adding then subtracting restores A');

    t.eq(ML.describeOperation({ type: 'swap', i: 0, j: 1 }), 'R1 ↔ R2', 'swap is described in R-notation');
    t.eq(
      ML.describeOperation({ type: 'add', target: 1, source: 0, k: ML.Frac.of(-3) }),
      'R2 → R2 − 3R1',
      'subtraction is written with a minus, not "+ −3"'
    );
    t.eq(
      ML.describeOperation({ type: 'add', target: 1, source: 0, k: ML.Frac.of(-1) }),
      'R2 → R2 − R1',
      'a coefficient of 1 is left implicit'
    );
  });

  MLTest.suite('REF and RREF', function (t) {
    // RREF of this classic 3×3 is standard.
    t.matrix(
      ML.rref(M.from([[1, 2, 3], [4, 5, 6], [7, 8, 9]])),
      [[1, 0, -1], [0, 1, 2], [0, 0, 0]],
      'rank-2 matrix reduces to two pivots and a zero row'
    );
    t.matrix(ML.rref(M.from([[2, 1], [5, 3]])), [[1, 0], [0, 1]], 'invertible 2×2 reduces to I');
    t.matrix(ML.rref(M.identity(3)), [[1, 0, 0], [0, 1, 0], [0, 0, 1]], 'I is already reduced');
    t.matrix(ML.rref(M.zeros(2, 3)), [[0, 0, 0], [0, 0, 0]], 'the zero matrix is its own RREF');
    t.matrix(
      ML.rref(M.from([[0, 0, 1], [0, 2, 0], [3, 0, 0]])),
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      'reduction handles the row swaps it needs'
    );
    t.matrix(
      ML.rref(M.from([[1, 3, 1, 9], [1, 1, -1, 1], [3, 11, 5, 35]])),
      [[1, 0, -2, -3], [0, 1, 1, 4], [0, 0, 0, 0]],
      'a 3×4 system reduces to two pivots and one free column'
    );
    t.matrix(
      ML.rref(M.from([['1/2', '1/3'], ['1/4', '1/6']])),
      [[1, '2/3'], [0, 0]],
      'exact fractions: the second row is half the first, so it vanishes'
    );

    // REF keeps the staircase but not necessarily leading 1s.
    const ref = ML.ref(M.from([[2, 4, 6], [1, 3, 5], [1, 1, 1]]));
    t.ok(isEchelon(ref), 'REF output is in echelon form');
    const refOnes = ML.ref(M.from([[2, 4, 6], [1, 3, 5], [1, 1, 1]]), null, { leadingOnes: true });
    t.ok(isEchelon(refOnes), 'REF with leading 1s is still echelon');
    t.ok(leadingEntriesAreOne(refOnes), 'the leadingOnes option really produces leading 1s');

    // RREF is unique: reducing an already-reduced matrix changes nothing.
    const once = ML.rref(M.from([[1, 2, 3], [4, 5, 6], [7, 8, 9]]));
    t.matrix(ML.rref(once), once.toJSON(), 'RREF is idempotent');
  });

  MLTest.suite('Rank and pivots', function (t) {
    t.eq(ML.matrixRank(M.identity(4)), 4, 'rank of I₄');
    t.eq(ML.matrixRank(M.zeros(3, 4)), 0, 'rank of a zero matrix');
    t.eq(ML.matrixRank(M.from([[1, 2], [2, 4]])), 1, 'dependent rows give rank 1');
    t.eq(ML.matrixRank(M.from([[1, 2, 3], [4, 5, 6], [7, 8, 9]])), 2, 'rank 2');
    t.eq(ML.matrixRank(M.from([[1, 2, 3], [4, 5, 6]])), 2, 'a wide matrix can have rank 2');
    t.eq(ML.matrixRank(ML.transposeMatrix(M.from([[1, 2, 3], [4, 5, 6]]))), 2, 'rank(Aᵗ) = rank(A)');
    t.eq(ML.matrixRank(M.from([[1, 2, 3], [2, 4, 6], [3, 6, 9]])), 1, 'all rows proportional → rank 1');

    t.eq(ML.pivotColumns(M.from([[1, 2, 3], [4, 5, 6], [7, 8, 9]])).join(','), '0,1', 'pivot columns are 1 and 2');
    t.eq(ML.pivotColumns(M.from([[0, 1, 2], [0, 0, 3]])).join(','), '1,2', 'a zero first column has no pivot');

    const record = ML.eliminate(M.from([[1, 3, 1, 9], [1, 1, -1, 1], [3, 11, 5, 35]]), { full: true });
    t.eq(record.rank, 2, 'elimination record reports rank');
    t.eq(record.freeColumns.join(','), '2,3', 'free columns identified');
    t.ok(record.operations.length > 0, 'the operations actually applied are recorded');

    // The recorded operations must reproduce the reduction when replayed.
    let replay = M.from([[1, 3, 1, 9], [1, 1, -1, 1], [3, 11, 5, 35]]);
    record.operations.forEach(function (op) { replay = ML.applyOperation(replay, op); });
    t.matrix(replay, record.matrix.toJSON(), 'replaying the recorded steps reproduces the result');
  });

  MLTest.suite('Steps are generated from the real algorithm', function (t) {
    const steps = new ML.StepLog('RREF');
    ML.rref(M.from([[0, 2], [1, 1]]), steps);
    const text = steps.steps.map(function (s) { return [s.heading, s.text, s.math].join(' '); }).join(' ');
    t.ok(text.indexOf('R1 ↔ R2') >= 0, 'the swap this matrix needs appears in the steps');
    t.ok(steps.steps.some(function (s) { return s.matrix; }), 'steps carry matrix snapshots');
    const last = steps.steps[steps.steps.length - 1];
    t.eq(last.kind, 'result', 'the final step is flagged as the result');
    t.ok(last.highlight && last.highlight.pivots.length === 2, 'the result highlights both pivots');

    // A matrix needing no swap must not claim one.
    const clean = new ML.StepLog('RREF');
    ML.rref(M.from([[1, 0], [0, 1]]), clean);
    const cleanText = clean.steps.map(function (s) { return [s.heading, s.math].join(' '); }).join(' ');
    t.notOk(cleanText.indexOf('↔') >= 0, 'no swap is reported when none happened');
  });

  MLTest.suite('Solving Ax = b — the three outcomes', function (t) {
    // x + y + z = 6, 2y + 5z = -4, 2x + 5y - z = 27  →  (5, 3, -2)
    const A = M.from([[1, 1, 1], [0, 2, 5], [2, 5, -1]]);
    const b = M.column([6, -4, 27]);
    const unique = ML.solveLinearSystem(A, b);
    t.eq(unique.type, 'unique', 'a non-singular square system has one solution');
    t.matrix(unique.solution, [[5], [3], [-2]], 'the solution is (5, 3, −2)');
    t.matrix(ML.multiplyMatrices(A, unique.solution), b.toJSON(), 'substituting back gives b exactly');
    t.eq(unique.rank, 3, 'rank(A) = 3');
    t.eq(unique.rankAugmented, 3, 'rank[A|b] = 3');

    // Inconsistent: x + y = 1 and x + y = 2 cannot both hold.
    const none = ML.solveLinearSystem(M.from([[1, 1], [1, 1]]), M.column([1, 2]));
    t.eq(none.type, 'none', 'contradictory equations are detected');
    t.eq(none.solution, null, 'no solution vector is offered');
    t.ok(none.rankAugmented > none.rank, 'rank[A|b] exceeds rank(A), which is the test for inconsistency');
    t.ok(none.summary.indexOf('impossible') >= 0, 'the reason is stated plainly');

    // Under-determined: one equation, three unknowns.
    const many = ML.solveLinearSystem(M.from([[1, 1, 1], [2, 2, 2]]), M.column([3, 6]));
    t.eq(many.type, 'infinite', 'a dependent system has infinitely many solutions');
    t.eq(many.rank, 1, 'rank is 1');
    t.eq(many.nullBasis.length, 2, 'two free variables give two null-space directions');
    t.matrix(many.particular, [[3], [0], [0]], 'particular solution sets the free variables to zero');
    t.matrix(ML.multiplyMatrices(M.from([[1, 1, 1], [2, 2, 2]]), many.particular), [[3], [6]], 'xₚ really solves the system');
    many.nullBasis.forEach(function (vector, index) {
      t.matrix(
        ML.multiplyMatrices(M.from([[1, 1, 1], [2, 2, 2]]), vector),
        [[0], [0]],
        'null-space direction ' + (index + 1) + ' satisfies Ax = 0'
      );
    });
    t.ok(many.parametric.lines.length === 3, 'a parametric line is produced for each variable');

    // A wide system: fewer equations than unknowns can still be inconsistent-free.
    const wide = ML.solveLinearSystem(M.from([[1, 2, 3]]), M.column([6]));
    t.eq(wide.type, 'infinite', '1 equation with 3 unknowns is under-determined');
    t.eq(wide.nullBasis.length, 2, 'two directions of freedom');

    // A tall system with a unique solution (consistent overdetermined).
    const tall = ML.solveLinearSystem(M.from([[1, 0], [0, 1], [1, 1]]), M.column([2, 3, 5]));
    t.eq(tall.type, 'unique', 'an overdetermined but consistent system can still be unique');
    t.matrix(tall.solution, [[2], [3]], 'and gives the right answer');
  });

  MLTest.suite('Solving — the four methods agree', function (t) {
    const A = M.from([[1, 1, 1], [0, 2, 5], [2, 5, -1]]);
    const b = M.column([6, -4, 27]);
    const expected = [[5], [3], [-2]];
    t.matrix(ML.solveLinearSystem(A, b).solution, expected, 'Gauss–Jordan');
    t.matrix(ML.solveByBackSubstitution(A, b), expected, 'back-substitution');
    t.matrix(ML.solveByInverse(A, b), expected, 'inverse method');
    t.matrix(ML.solveByCramer(A, b), expected, "Cramer's rule");

    // Fractions must stay exact through every route.
    const F = M.from([[2, 3], [1, -1]]);
    const fb = M.column([5, 1]);
    t.matrix(ML.solveLinearSystem(F, fb).solution, [['8/5'], ['3/5']], 'exact fractions via Gauss–Jordan');
    t.matrix(ML.solveByCramer(F, fb), [['8/5'], ['3/5']], "exact fractions via Cramer's rule");

    const singular = M.from([[1, 2], [2, 4]]);
    t.throws(function () { ML.solveByCramer(singular, M.column([1, 2])); }, 'det(A) ≠ 0', "Cramer's rule refuses a singular matrix");
    t.throws(function () { ML.solveByInverse(singular, M.column([1, 2])); }, 'singular', 'inverse method refuses a singular matrix');
    t.throws(
      function () { ML.solveByBackSubstitution(M.from([[1, 2, 3]]), M.column([1])); },
      'square',
      'back-substitution refuses a non-square system'
    );
    t.throws(
      function () { ML.solveLinearSystem(A, M.column([1, 2])); },
      'must match',
      'a mismatched right-hand side is reported'
    );
    // Gauss–Jordan copes with the singular case rather than failing.
    t.eq(ML.solveLinearSystem(singular, M.column([1, 2])).type, 'infinite', 'Gauss–Jordan handles what the others refuse');
  });

  MLTest.suite('Reading equations written as text', function (t) {
    const parsed = ML.parseSystem('2x + 3y = 5\nx - y = 1');
    t.matrix(parsed.A, [[2, 3], [1, -1]], 'coefficients extracted');
    t.matrix(parsed.b, [[5], [1]], 'right-hand side extracted');
    t.eq(parsed.names.join(','), 'x,y', 'variables found in order of appearance');

    const moved = ML.parseSystem('2x = y + 1');
    t.matrix(moved.A, [[2, -1]], 'a variable on the right moves left with a sign change');
    t.matrix(moved.b, [[1]], 'the constant stays on the right');

    const fractions = ML.parseSystem('1/2x + 1/3y = 1\nx - y = 0');
    t.matrix(fractions.A, [['1/2', '1/3'], [1, -1]], 'fractional coefficients are exact');

    const implicit = ML.parseSystem('x + y + z = 6; 2y + 5z = -4; 2x + 5y - z = 27');
    t.eq(implicit.names.join(','), 'x,y,z', 'semicolons separate equations');
    t.matrix(implicit.A, [[1, 1, 1], [0, 2, 5], [2, 5, -1]], 'a missing variable becomes a zero coefficient');
    t.matrix(ML.solveLinearSystem(implicit.A, implicit.b).solution, [[5], [3], [-2]], 'and the parsed system solves correctly');

    const spaced = ML.parseSystem('a - 2b = -3\n3a + b = 5');
    t.eq(spaced.names.join(','), 'a,b', 'any letters may be used as variable names');
    t.matrix(spaced.A, [[1, -2], [3, 1]], 'implicit coefficient of 1 handled');

    t.throws(function () { ML.parseSystem('2x + 3y'); }, 'one “=” sign', 'a missing equals sign is reported');
    t.throws(function () { ML.parseSystem(''); }, 'at least one equation', 'empty input is reported');
    t.throws(function () { ML.parseSystem('5 = 5'); }, 'No variables', 'an equation with no unknowns is reported');
    t.throws(function () { ML.parseSystem('2$x = 4'); }, 'Could not read', 'unreadable text is reported with the offending term');
  });

  /* ------------------------------- helpers ------------------------------ */

  function leadingIndex(row) {
    for (let j = 0; j < row.length; j++) if (!row[j].isZero()) return j;
    return Infinity;
  }

  function isEchelon(matrix) {
    let previous = -1;
    for (let i = 0; i < matrix.rows; i++) {
      const index = leadingIndex(matrix.data[i]);
      if (index === Infinity) {
        // Once a zero row appears, everything below it must be a zero row too.
        for (let k = i + 1; k < matrix.rows; k++) {
          if (leadingIndex(matrix.data[k]) !== Infinity) return false;
        }
        return true;
      }
      if (index <= previous) return false;
      previous = index;
    }
    return true;
  }

  function leadingEntriesAreOne(matrix) {
    for (let i = 0; i < matrix.rows; i++) {
      const index = leadingIndex(matrix.data[i]);
      if (index !== Infinity && !matrix.data[i][index].isOne()) return false;
    }
    return true;
  }
})(globalThis.ML, globalThis.MLTest);
