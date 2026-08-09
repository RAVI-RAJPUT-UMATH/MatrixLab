/**
 * Suite 1 — exact arithmetic, the Matrix type, and basic operations.
 * Every expected value here is verifiable by hand.
 */
(function (ML, MLTest) {
  'use strict';

  const Frac = ML.Frac;
  const M = ML.Matrix;

  MLTest.suite('Frac — parsing', function (t) {
    t.frac(Frac.parse('7'), 7, 'integer');
    t.frac(Frac.parse('-3'), -3, 'negative integer');
    t.frac(Frac.parse('2.5'), '5/2', 'decimal becomes an exact fraction');
    t.frac(Frac.parse('0.1'), '1/10', '0.1 is exactly one tenth (no float error)');
    t.frac(Frac.parse('3/4'), '3/4', 'fraction input');
    t.frac(Frac.parse('-6/8'), '-3/4', 'fractions are reduced');
    t.frac(Frac.parse('4/-8'), '-1/2', 'negative denominator normalises to the numerator');
    t.frac(Frac.parse(' 1 / 2 '), '1/2', 'spaces are ignored');
    t.frac(Frac.parse('1.5e-2'), '3/200', 'scientific notation');
    t.frac(Frac.parse('.5'), '1/2', 'leading dot');
    t.frac(Frac.parse('−3'), -3, 'unicode minus sign');
    t.throws(function () { Frac.parse(''); }, 'empty', 'empty input is rejected');
    t.throws(function () { Frac.parse('abc'); }, 'not a valid number', 'letters are rejected');
    t.throws(function () { Frac.parse('1/0'); }, 'divides by zero', 'division by zero is rejected');
    t.throws(function () { Frac.parse('1/2/3'); }, 'not a valid fraction', 'double fraction is rejected');
  });

  MLTest.suite('Frac — arithmetic', function (t) {
    const a = Frac.parse('1/3');
    const b = Frac.parse('1/6');
    t.frac(a.add(b), '1/2', '1/3 + 1/6 = 1/2');
    t.frac(a.sub(b), '1/6', '1/3 − 1/6 = 1/6');
    t.frac(a.mul(b), '1/18', '1/3 × 1/6 = 1/18');
    t.frac(a.div(b), 2, '1/3 ÷ 1/6 = 2');
    t.frac(a.pow(3), '1/27', '(1/3)³');
    t.frac(a.pow(-2), 9, '(1/3)⁻²');
    t.frac(a.neg().abs(), '1/3', 'absolute value');
    t.frac(Frac.parse('2/3').inv(), '3/2', 'reciprocal');
    t.ok(Frac.parse('0.3').add(Frac.parse('0.6')).eq(Frac.parse('0.9')), '0.3 + 0.6 = 0.9 exactly');
    t.notOk(0.3 + 0.6 === 0.9, 'the same sum in plain floats is wrong — which is why Frac exists');
    t.eq(a.cmp(b), 1, '1/3 > 1/6');
    t.eq(b.cmp(a), -1, '1/6 < 1/3');
    t.eq(a.cmp(Frac.parse('2/6')), 0, '1/3 = 2/6');
    t.throws(function () { a.div(Frac.ZERO); }, 'Division by zero', 'dividing by zero throws');
    t.frac(Frac.parse('9/4').sqrtExact(), '3/2', '√(9/4) = 3/2 exactly');
    t.eq(Frac.parse('2').sqrtExact(), null, '√2 is irrational, so no exact fraction');
  });

  MLTest.suite('Frac — display', function (t) {
    t.eq(Frac.parse('1/3').toDecimalString(6), '0.333333', 'rounds down correctly');
    t.eq(Frac.parse('2/3').toDecimalString(6), '0.666667', 'rounds up correctly');
    t.eq(Frac.parse('-1/8').toDecimalString(4), '-0.1250', 'negative decimal');
    t.eq(Frac.parse('5').toDecimalString(0), '5', 'zero decimal places');
    t.eq(ML.fmt(Frac.parse('1/3')), '1/3', 'auto format keeps the exact fraction');
    t.eq(ML.fmt(Frac.parse('4/2')), '2', 'reduces to an integer');
    t.eq(ML.fmt(Frac.parse('1/3'), { format: 'decimal', decimals: 4 }), '0.3333', 'decimal format on request');
    t.eq(ML.cleanFloat(0.9999999999999998), 1, 'float artefact 0.999…8 displays as 1');
    t.eq(ML.cleanFloat(2.7e-17), 0, 'tiny float artefact displays as 0');
    t.eq(ML.cleanFloat(0.5), 0.5, 'genuine values are left alone');
    t.frac(Frac.approximate(0.333333333333, 10000, 1e-9), '1/3', 'recognises 1/3 from a float');
    t.eq(Frac.approximate(Math.PI, 10, 1e-12), null, 'refuses a bad approximation of π');
  });

  MLTest.suite('Matrix — construction and validation', function (t) {
    const A = M.from([[1, 2], [3, 4]]);
    t.eq(A.rows, 2, 'row count');
    t.eq(A.cols, 2, 'column count');
    t.eq(A.size(), '2×2', 'size label');
    t.frac(A.get(1, 0), 3, 'entry access is row-major, 0-indexed');
    t.ok(A.isSquare(), '2×2 is square');
    t.ok(M.from([['1/2', '0.25']]).isRowVector(), 'single row is a row vector');
    t.matrix(M.identity(3), [[1, 0, 0], [0, 1, 0], [0, 0, 1]], 'identity');
    t.matrix(M.zeros(2, 3), [[0, 0, 0], [0, 0, 0]], 'zero matrix');
    t.matrix(M.diagonal([2, 5]), [[2, 0], [0, 5]], 'diagonal from a list');
    t.matrix(M.column([1, 2, 3]), [[1], [2], [3]], 'column vector');
    t.matrix(M.fromColumns([[1, 2], [3, 4]]), [[1, 3], [2, 4]], 'built from column vectors');
    t.throws(function () { M.from([[1, 2], [3]]); }, 'same number of entries', 'ragged rows are rejected');
    t.throws(function () { M.from([]); }, 'at least one row', 'empty matrix is rejected');
    t.throws(function () { M.from([[1, 'x']]); }, 'row 1, column 2', 'a bad entry names its position');
    t.throws(function () { A.get(5, 0); }, 'outside a 2×2 matrix', 'out-of-range access is reported clearly');
    t.ok(A.equals(M.from([[1, 2], [3, 4]])), 'equality by value');
    t.notOk(A.equals(M.from([[1, 2], [3, 5]])), 'inequality detected');
    // Immutability: withEntry must not disturb the original.
    const B = A.withEntry(0, 0, 99);
    t.frac(A.get(0, 0), 1, 'the original matrix is untouched');
    t.frac(B.get(0, 0), 99, 'the copy carries the change');
  });

  MLTest.suite('Operations — addition, subtraction, scaling', function (t) {
    const A = M.from([[1, 2], [3, 4]]);
    const B = M.from([[5, 6], [7, 8]]);
    t.matrix(ML.addMatrices(A, B), [[6, 8], [10, 12]], 'A + B');
    t.matrix(ML.subtractMatrices(B, A), [[4, 4], [4, 4]], 'B − A');
    t.matrix(ML.scalarMultiply(A, 3), [[3, 6], [9, 12]], '3A');
    t.matrix(ML.scalarMultiply(A, '1/2'), [['1/2', 1], ['3/2', 2]], '½A keeps exact fractions');
    t.matrix(ML.hadamardProduct(A, B), [[5, 12], [21, 32]], 'A ∘ B entry by entry');
    t.matrix(ML.negateMatrix(A), [[-1, -2], [-3, -4]], '−A');
    t.matrix(ML.addMatrices(A, ML.negateMatrix(A)), [[0, 0], [0, 0]], 'A + (−A) = 0');
    t.throws(
      function () { ML.addMatrices(A, M.from([[1, 2, 3]])); },
      'exactly the same size',
      'mismatched addition explains the requirement'
    );
  });

  MLTest.suite('Operations — multiplication', function (t) {
    const A = M.from([[1, 2], [3, 4]]);
    const B = M.from([[0, 1], [1, 0]]);
    t.matrix(ML.multiplyMatrices(A, B), [[2, 1], [4, 3]], 'AB swaps the columns of A');
    t.matrix(ML.multiplyMatrices(B, A), [[3, 4], [1, 2]], 'BA swaps the rows — multiplication is not commutative');
    // (2×3)(3×2) = 2×2, checked by hand.
    const C = M.from([[1, 2, 3], [4, 5, 6]]);
    const D = M.from([[7, 8], [9, 10], [11, 12]]);
    t.matrix(ML.multiplyMatrices(C, D), [[58, 64], [139, 154]], 'rectangular product');
    t.matrix(ML.multiplyMatrices(A, M.identity(2)), [[1, 2], [3, 4]], 'AI = A');
    t.matrix(
      ML.multiplyMatrices(M.from([['1/2', 0], [0, '1/3']]), M.from([[2, 0], [0, 3]])),
      [[1, 0], [0, 1]],
      'exact fractions multiply to the identity'
    );
    t.throws(
      function () { ML.multiplyMatrices(C, A); },
      'columns in A to equal the number of rows in B',
      'incompatible product gives the standard explanation'
    );
    // Associativity on a non-trivial triple.
    const left = ML.multiplyMatrices(ML.multiplyMatrices(A, B), A);
    const right = ML.multiplyMatrices(A, ML.multiplyMatrices(B, A));
    t.ok(left.equals(right), '(AB)C = A(BC)');
  });

  MLTest.suite('Operations — transpose, trace, power, equality', function (t) {
    const A = M.from([[1, 2, 3], [4, 5, 6]]);
    t.matrix(ML.transposeMatrix(A), [[1, 4], [2, 5], [3, 6]], 'Aᵗ');
    t.matrix(ML.transposeMatrix(ML.transposeMatrix(A)), [[1, 2, 3], [4, 5, 6]], '(Aᵗ)ᵗ = A');
    const S = M.from([[1, 2], [3, 4]]);
    t.frac(ML.traceMatrix(S), 5, 'trace = 1 + 4');
    t.throws(function () { ML.traceMatrix(A); }, 'square', 'trace needs a square matrix');
    // (AB)ᵗ = BᵗAᵗ
    const B = M.from([[2, 0], [1, 3]]);
    t.ok(
      ML.transposeMatrix(ML.multiplyMatrices(S, B)).equals(
        ML.multiplyMatrices(ML.transposeMatrix(B), ML.transposeMatrix(S))
      ),
      '(AB)ᵗ = BᵗAᵗ'
    );
    t.matrix(ML.matrixPower(S, 0), [[1, 0], [0, 1]], 'A⁰ = I');
    t.matrix(ML.matrixPower(S, 1), [[1, 2], [3, 4]], 'A¹ = A');
    t.matrix(ML.matrixPower(S, 2), [[7, 10], [15, 22]], 'A² by hand');
    t.matrix(ML.matrixPower(S, 3), [[37, 54], [81, 118]], 'A³ = A²·A');
    t.matrix(ML.matrixPower(M.from([[2, 0], [0, 3]]), 4), [[16, 0], [0, 81]], 'diagonal powers act entry-wise');
    t.throws(function () { ML.matrixPower(A, 2); }, 'square', 'powers need a square matrix');

    const eq = ML.matricesEqual(S, M.from([[1, 2], [3, 4]]));
    t.ok(eq.equal, 'identical matrices are equal');
    const neq = ML.matricesEqual(S, M.from([[1, 2], [3, 5]]));
    t.notOk(neq.equal, 'different matrices are not equal');
    t.eq(neq.differences.length, 1, 'exactly one entry differs');
    t.eq(neq.differences[0].join(','), '1,1', 'the differing position is reported');
    t.notOk(ML.matricesEqual(S, A).equal, 'different shapes are never equal');
  });

  MLTest.suite('Operations — augment and stack', function (t) {
    const A = M.from([[1, 2], [3, 4]]);
    t.matrix(ML.augment(A, M.column([5, 6])), [[1, 2, 5], [3, 4, 6]], '[A | b]');
    t.matrix(ML.augment(A, M.identity(2)), [[1, 2, 1, 0], [3, 4, 0, 1]], '[A | I]');
    t.matrix(ML.stack(A, M.row([9, 9])), [[1, 2], [3, 4], [9, 9]], 'stacking rows');
    t.throws(function () { ML.augment(A, M.row([1, 2])); }, 'same number of rows', 'augment checks the row count');
  });

  MLTest.suite('StepLog — records real work', function (t) {
    const steps = new ML.StepLog('Multiplication');
    ML.multiplyMatrices(M.from([[1, 2], [3, 4]]), M.from([[5, 6], [7, 8]]), steps);
    t.ok(steps.count >= 4, 'multiplication records several steps');
    const joined = steps.steps.map(function (s) { return (s.list || []).join(' '); }).join(' ');
    t.ok(joined.indexOf('(1)(5) + (2)(7) = 19') >= 0, 'the recorded arithmetic matches the real computation');
    t.ok(steps.steps[steps.steps.length - 1].kind === 'result', 'the last step is the result');
  });
})(globalThis.ML, globalThis.MLTest);
