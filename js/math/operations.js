/**
 * MatrixLab — basic matrix operations.
 *
 * Convention used across every math module: the last (optional) argument may
 * be a StepLog. When given, the algorithm records what it actually did while
 * computing, so the UI can show genuine steps.
 */
(function (ML) {
  'use strict';

  const Matrix = ML.Matrix;
  const Frac = ML.Frac;
  const MLError = ML.MLError;
  const fmt = function (v) { return ML.fmt(v); };

  /** Human-readable position, 1-indexed, e.g. "row 2, column 3". */
  function at(i, j) {
    return 'row ' + (i + 1) + ', column ' + (j + 1);
  }

  function requireMatrix(A, name) {
    if (!Matrix.isMatrix(A)) {
      throw new MLError('Expected matrix ' + (name || 'A') + ', but nothing valid was provided.');
    }
    return A;
  }

  function requireSameShape(A, B, verb) {
    requireMatrix(A, 'A');
    requireMatrix(B, 'B');
    if (A.rows !== B.rows || A.cols !== B.cols) {
      throw new MLError(
        'Matrix ' + verb + ' needs both matrices to be exactly the same size. ' +
          'A is ' + A.size() + ' but B is ' + B.size() + '.',
        { hint: 'Resize one of the matrices so the rows and columns match.' }
      );
    }
  }

  function requireSquare(A, what) {
    requireMatrix(A, 'A');
    if (!A.isSquare()) {
      throw new MLError(
        (what || 'This operation') + ' is only defined for square matrices (same number of rows and columns). ' +
          'This matrix is ' + A.size() + '.'
      );
    }
  }

  /* ------------------------------------------------------------------ *
   * Element-wise operations
   * ------------------------------------------------------------------ */

  function elementwise(A, B, op) {
    const data = ML.grid(A.rows, A.cols, Frac.ZERO);
    for (let i = 0; i < A.rows; i++) {
      for (let j = 0; j < A.cols; j++) data[i][j] = op(A.data[i][j], B.data[i][j]);
    }
    return Matrix.fromGrid(data);
  }

  function elementwiseSteps(steps, A, B, C, symbol, name) {
    if (!steps) return;
    steps.add('Step 1 — check the sizes', {
      text:
        'A is ' + A.size() + ' and B is ' + A.size() + '. ' + name +
        ' works entry by entry, so the two matrices must have identical dimensions.',
      math: 'A ' + symbol + ' B is ' + A.size(),
    });
    const shown = [];
    const limit = 12;
    let count = 0;
    for (let i = 0; i < A.rows && count < limit; i++) {
      for (let j = 0; j < A.cols && count < limit; j++) {
        shown.push(
          'c' + (i + 1) + (j + 1) + ' = ' + fmt(A.data[i][j]) + ' ' + symbol + ' ' + fmt(B.data[i][j]) +
            ' = ' + fmt(C.data[i][j])
        );
        count++;
      }
    }
    steps.add('Step 2 — combine matching entries', {
      text: 'Each entry of the answer uses only the entries in the same position of A and B.',
      list: shown,
      note: A.rows * A.cols > limit ? 'Showing the first ' + limit + ' of ' + A.rows * A.cols + ' entries.' : undefined,
    });
    steps.result('Result', { matrix: C, label: 'A ' + symbol + ' B' });
  }

  /**
   * A + B
   * @param {ML.Matrix} A @param {ML.Matrix} B @param {ML.StepLog} [steps]
   */
  function addMatrices(A, B, steps) {
    requireSameShape(A, B, 'addition');
    const C = elementwise(A, B, function (a, b) { return a.add(b); });
    elementwiseSteps(steps, A, B, C, '+', 'Addition');
    return C;
  }

  /** A − B */
  function subtractMatrices(A, B, steps) {
    requireSameShape(A, B, 'subtraction');
    const C = elementwise(A, B, function (a, b) { return a.sub(b); });
    elementwiseSteps(steps, A, B, C, '−', 'Subtraction');
    return C;
  }

  /** A ∘ B (Hadamard / entry-by-entry product) */
  function hadamardProduct(A, B, steps) {
    requireSameShape(A, B, 'element-wise (Hadamard) multiplication');
    const C = elementwise(A, B, function (a, b) { return a.mul(b); });
    elementwiseSteps(steps, A, B, C, '∘', 'Element-wise multiplication');
    return C;
  }

  /** kA */
  function scalarMultiply(A, k, steps) {
    requireMatrix(A, 'A');
    const scalar = Frac.of(k);
    const C = A.map(function (v) { return v.mul(scalar); });
    if (steps) {
      steps.add('Step 1 — what scalar multiplication does', {
        text: 'Multiplying a matrix by a number multiplies every single entry by that number. The size never changes.',
        math: '(kA)ᵢⱼ = k · aᵢⱼ',
      });
      const shown = [];
      const limit = 12;
      let count = 0;
      for (let i = 0; i < A.rows && count < limit; i++) {
        for (let j = 0; j < A.cols && count < limit; j++, count++) {
          shown.push(
            fmt(scalar) + ' · ' + fmt(A.data[i][j]) + ' = ' + fmt(C.data[i][j]) + '   (' + at(i, j) + ')'
          );
        }
      }
      steps.add('Step 2 — scale each entry', { list: shown });
      steps.result('Result', { matrix: C, label: fmt(scalar) + 'A' });
    }
    return C;
  }

  /** −A */
  function negateMatrix(A) {
    return scalarMultiply(A, Frac.MINUS_ONE);
  }

  /* ------------------------------------------------------------------ *
   * Matrix multiplication
   * ------------------------------------------------------------------ */

  /**
   * A × B — the real row-by-column product.
   * @param {ML.Matrix} A @param {ML.Matrix} B @param {ML.StepLog} [steps]
   */
  function multiplyMatrices(A, B, steps) {
    requireMatrix(A, 'A');
    requireMatrix(B, 'B');
    if (A.cols !== B.rows) {
      throw new MLError(
        'Matrix multiplication requires the number of columns in A to equal the number of rows in B. ' +
          'A is ' + A.size() + ' (so it has ' + A.cols + ' columns) but B is ' + B.size() +
          ' (so it has ' + B.rows + ' rows).',
        { hint: 'Try B × A instead, or resize so the inner dimensions agree.' }
      );
    }

    const data = ML.grid(A.rows, B.cols, Frac.ZERO);
    for (let i = 0; i < A.rows; i++) {
      for (let j = 0; j < B.cols; j++) {
        let sum = Frac.ZERO;
        for (let k = 0; k < A.cols; k++) sum = sum.add(A.data[i][k].mul(B.data[k][j]));
        data[i][j] = sum;
      }
    }
    const C = Matrix.fromGrid(data);

    if (steps) {
      steps.add('Step 1 — check the inner dimensions', {
        text:
          'A is ' + A.size() + ' and B is ' + B.size() + '. The inner numbers (' + A.cols + ' and ' + B.rows +
          ') match, so the product exists and the answer is ' + A.rows + '×' + B.cols + '.',
        math: '(' + A.rows + '×' + A.cols + ') · (' + B.rows + '×' + B.cols + ') → ' + A.rows + '×' + B.cols,
      });
      steps.add('Step 2 — the rule for one entry', {
        text:
          'Entry cᵢⱼ pairs row i of A with column j of B: multiply matching entries and add the results. ' +
          'This is the dot product of that row and that column.',
        math: dotProductFormula(A.cols),
      });

      const limit = 12;
      const lines = [];
      let count = 0;
      for (let i = 0; i < A.rows && count < limit; i++) {
        for (let j = 0; j < B.cols && count < limit; j++, count++) {
          const terms = [];
          for (let k = 0; k < A.cols; k++) {
            terms.push('(' + fmt(A.data[i][k]) + ')(' + fmt(B.data[k][j]) + ')');
          }
          lines.push('c' + (i + 1) + (j + 1) + ' = ' + terms.join(' + ') + ' = ' + fmt(C.data[i][j]));
        }
      }
      steps.add('Step 3 — work through the entries', {
        text: 'Row of A × column of B, one entry of the answer at a time.',
        list: lines,
        note:
          A.rows * B.cols > limit
            ? 'Showing the first ' + limit + ' of ' + A.rows * B.cols + ' entries; the result below is complete.'
            : undefined,
      });
      steps.result('Result', { matrix: C, label: 'AB' });
    }
    return C;
  }

  /**
   * Aᵏ for an integer k. k = 0 gives the identity; negative k uses the inverse.
   */
  function matrixPower(A, k, steps) {
    requireSquare(A, 'Raising a matrix to a power');
    const exponent = Number(k);
    if (!Number.isInteger(exponent)) {
      throw new MLError('A matrix power must be a whole number here (for example 2, 3 or −1).');
    }
    if (Math.abs(exponent) > 64) {
      throw new MLError('Powers above 64 are not supported — the entries grow enormously. Try a smaller exponent.');
    }

    if (exponent === 0) {
      const I = Matrix.identity(A.rows);
      if (steps) {
        steps.add('Step 1 — the zero power', {
          text: 'By definition A⁰ is the identity matrix of the same size, just as x⁰ = 1 for numbers.',
          matrix: I,
          label: 'A⁰ = I',
        });
      }
      return I;
    }

    if (exponent < 0) {
      if (typeof ML.inverseMatrix !== 'function') {
        throw new MLError('Negative powers need the inverse, which is not available.');
      }
      if (steps) {
        steps.add('Step 1 — negative exponent', {
          text: 'A negative power means "invert first, then raise to the positive power".',
          math: 'A^' + exponent + ' = (A⁻¹)^' + -exponent,
        });
      }
      const inv = ML.inverseMatrix(A);
      if (steps) steps.matrix('Step 2 — the inverse', inv, { label: 'A⁻¹' });
      return matrixPower(inv, -exponent, steps);
    }

    let result = A;
    if (steps) {
      steps.add('Step 1 — repeated multiplication', {
        text: 'A raised to a whole power means multiplying A by itself that many times.',
        math: 'A^' + exponent + ' = A · A · … · A  (' + exponent + ' copies)',
      });
      steps.matrix('A¹', A, { label: 'A' });
    }
    for (let p = 2; p <= exponent; p++) {
      result = multiplyMatrices(result, A);
      if (steps) {
        steps.matrix('A' + superscript(p), result, {
          label: 'A' + superscript(p),
          math: 'A' + superscript(p) + ' = A' + superscript(p - 1) + ' · A',
        });
      }
    }
    if (steps) steps.result('Result', { matrix: result, label: 'A' + superscript(exponent) });
    return result;
  }

  const SUPERSCRIPTS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
  const SUBSCRIPTS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

  /** 12 → "¹²" for readable powers. */
  function superscript(n) {
    const negative = n < 0;
    const digits = String(Math.abs(n))
      .split('')
      .map(function (d) { return SUPERSCRIPTS[Number(d)]; })
      .join('');
    return (negative ? '⁻' : '') + digits;
  }

  /** 12 → "₁₂" for readable indices. */
  function subscript(n) {
    return String(n)
      .split('')
      .map(function (d) { return SUBSCRIPTS[Number(d)] || d; })
      .join('');
  }

  /** The dot-product rule written out for the actual inner dimension. */
  function dotProductFormula(inner) {
    const terms = [];
    const shown = Math.min(inner, 3);
    for (let k = 1; k <= shown; k++) terms.push('aᵢ' + subscript(k) + 'b' + subscript(k) + 'ⱼ');
    if (inner > shown + 1) terms.push('…', 'aᵢ' + subscript(inner) + 'b' + subscript(inner) + 'ⱼ');
    else if (inner === shown + 1) terms.push('aᵢ' + subscript(inner) + 'b' + subscript(inner) + 'ⱼ');
    return 'cᵢⱼ = ' + terms.join(' + ');
  }

  /* ------------------------------------------------------------------ *
   * Structure
   * ------------------------------------------------------------------ */

  /** Aᵗ */
  function transposeMatrix(A, steps) {
    requireMatrix(A, 'A');
    const data = ML.grid(A.cols, A.rows, Frac.ZERO);
    for (let i = 0; i < A.rows; i++) {
      for (let j = 0; j < A.cols; j++) data[j][i] = A.data[i][j];
    }
    const T = Matrix.fromGrid(data);
    if (steps) {
      steps.add('Step 1 — what transposing does', {
        text:
          'The transpose reflects the matrix across its main diagonal: the entry in ' + at(0, 1) +
          ' moves to ' + at(1, 0) + ', and so on. A ' + A.size() + ' matrix becomes ' + T.size() + '.',
        math: '(Aᵗ)ᵢⱼ = aⱼᵢ',
      });
      const lines = [];
      for (let i = 0; i < Math.min(A.rows, 4); i++) {
        lines.push('Row ' + (i + 1) + ' of A → column ' + (i + 1) + ' of Aᵗ: [' + A.rowAt(i).map(fmt).join(', ') + ']');
      }
      steps.add('Step 2 — rows become columns', { list: lines });
      steps.result('Result', { matrix: T, label: 'Aᵗ' });
    }
    return T;
  }

  /** trace(A) — the sum of the diagonal. */
  function traceMatrix(A, steps) {
    requireSquare(A, 'The trace');
    let sum = Frac.ZERO;
    const terms = [];
    for (let i = 0; i < A.rows; i++) {
      sum = sum.add(A.data[i][i]);
      terms.push(fmt(A.data[i][i]));
    }
    if (steps) {
      steps.add('Step 1 — pick out the diagonal', {
        text: 'The trace only uses the entries a₁₁, a₂₂, … running from the top-left corner down to the bottom-right.',
        matrix: A,
        label: 'A',
        highlight: { cells: diagonalCells(A.rows) },
      });
      steps.result('Step 2 — add them up', {
        math: 'tr(A) = ' + terms.join(' + ') + ' = ' + fmt(sum),
        text: 'The trace also equals the sum of the eigenvalues, which makes it a quick sanity check later on.',
      });
    }
    return sum;
  }

  function diagonalCells(n) {
    const cells = [];
    for (let i = 0; i < n; i++) cells.push([i, i]);
    return cells;
  }

  /**
   * Are two matrices equal? Returns a report so the UI can point at the
   * disagreeing entries instead of just saying "no".
   */
  function matricesEqual(A, B) {
    requireMatrix(A, 'A');
    requireMatrix(B, 'B');
    if (A.rows !== B.rows || A.cols !== B.cols) {
      return {
        equal: false,
        reason:
          'The matrices are different sizes: A is ' + A.size() + ' and B is ' + B.size() +
          '. Two matrices can only be equal if they have the same shape.',
        differences: [],
      };
    }
    const differences = [];
    for (let i = 0; i < A.rows; i++) {
      for (let j = 0; j < A.cols; j++) {
        if (!A.data[i][j].eq(B.data[i][j])) differences.push([i, j]);
      }
    }
    if (!differences.length) {
      return { equal: true, reason: 'Every entry matches, so A = B.', differences: [] };
    }
    const first = differences[0];
    return {
      equal: false,
      reason:
        differences.length +
        (differences.length === 1 ? ' entry differs' : ' entries differ') + '. For example at ' + at(first[0], first[1]) +
        ': A has ' + fmt(A.get(first[0], first[1])) + ' but B has ' + fmt(B.get(first[0], first[1])) + '.',
      differences: differences,
    };
  }

  /** [A | B] side by side — used for augmented systems and Gauss–Jordan. */
  function augment(A, B) {
    requireMatrix(A, 'A');
    requireMatrix(B, 'B');
    if (A.rows !== B.rows) {
      throw new MLError(
        'To join two matrices side by side they need the same number of rows. A has ' + A.rows +
          ' and B has ' + B.rows + '.'
      );
    }
    const data = ML.grid(A.rows, A.cols + B.cols, Frac.ZERO);
    for (let i = 0; i < A.rows; i++) {
      for (let j = 0; j < A.cols; j++) data[i][j] = A.data[i][j];
      for (let j = 0; j < B.cols; j++) data[i][A.cols + j] = B.data[i][j];
    }
    return Matrix.fromGrid(data);
  }

  /** Stack A on top of B. */
  function stack(A, B) {
    requireMatrix(A, 'A');
    requireMatrix(B, 'B');
    if (A.cols !== B.cols) {
      throw new MLError('To stack two matrices they need the same number of columns.');
    }
    return Matrix.from(A.toArray().concat(B.toArray()));
  }

  const operations = {
    addMatrices: addMatrices,
    subtractMatrices: subtractMatrices,
    multiplyMatrices: multiplyMatrices,
    scalarMultiply: scalarMultiply,
    hadamardProduct: hadamardProduct,
    negateMatrix: negateMatrix,
    matrixPower: matrixPower,
    transposeMatrix: transposeMatrix,
    traceMatrix: traceMatrix,
    matricesEqual: matricesEqual,
    augment: augment,
    stack: stack,
    superscript: superscript,
    subscript: subscript,
    dotProductFormula: dotProductFormula,
    requireSquare: requireSquare,
    requireSameShape: requireSameShape,
    requireMatrix: requireMatrix,
  };

  ML.operations = operations;
  Object.assign(ML, operations);
})((globalThis.ML = globalThis.ML || {}));
