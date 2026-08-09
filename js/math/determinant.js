/**
 * MatrixLab — determinant, minors, cofactors, adjugate.
 *
 * Two honest routes to the determinant:
 *   • cofactor expansion — how it is defined, and how it is done by hand;
 *   • elimination — the product of the pivots, which is what makes large
 *     determinants feasible (n³ work instead of n!).
 * Both run in exact rational arithmetic and must agree; the test suite checks
 * that they do.
 */
(function (ML) {
  'use strict';

  const Matrix = ML.Matrix;
  const Frac = ML.Frac;
  const MLError = ML.MLError;
  const fmt = function (v) { return ML.fmt(v); };
  const sub = function (n) { return ML.operations.subscript(n); };

  /** Cofactor expansion is factorial work; beyond this, insist on elimination. */
  const COFACTOR_LIMIT = 7;

  /* ------------------------------------------------------------------ *
   * Minors and cofactors
   * ------------------------------------------------------------------ */

  /**
   * The (i, j) minor matrix: A with row i and column j deleted.
   * @returns {ML.Matrix}
   */
  function getMinor(A, i, j) {
    ML.operations.requireMatrix(A, 'A');
    if (A.rows < 2 || A.cols < 2) {
      throw new MLError('Deleting a row and a column needs a matrix of at least 2×2.');
    }
    A.get(i, j); // bounds check with a friendly message
    const data = [];
    for (let r = 0; r < A.rows; r++) {
      if (r === i) continue;
      const row = [];
      for (let c = 0; c < A.cols; c++) {
        if (c === j) continue;
        row.push(A.data[r][c]);
      }
      data.push(row);
    }
    return Matrix.fromGrid(data);
  }

  /** Mᵢⱼ — the determinant of the (i, j) minor. */
  function minor(A, i, j) {
    ML.operations.requireSquare(A, 'Minors');
    if (A.rows === 1) return Frac.ONE;
    return determinant(getMinor(A, i, j));
  }

  /** The matrix of all minors. */
  function minorMatrix(A, steps) {
    ML.operations.requireSquare(A, 'The matrix of minors');
    if (A.rows === 1) {
      const result = Matrix.from([[1]]);
      if (steps) {
        steps.text('A 1×1 matrix', 'With nothing left to delete, the minor is taken to be 1 by convention.');
        steps.result('Matrix of minors', { matrix: result, label: 'M' });
      }
      return result;
    }
    const data = ML.grid(A.rows, A.cols, Frac.ZERO);
    const lines = [];
    for (let i = 0; i < A.rows; i++) {
      for (let j = 0; j < A.cols; j++) {
        data[i][j] = determinant(getMinor(A, i, j));
        if (lines.length < 9) {
          lines.push('M' + sub(i + 1) + sub(j + 1) + ' = ' + fmt(data[i][j]));
        }
      }
    }
    const result = Matrix.fromGrid(data);
    if (steps) {
      steps.add('Step 1 — what a minor is', {
        text:
          'The minor Mᵢⱼ is the determinant of what is left after deleting row i and column j. For a ' + A.size() +
          ' matrix each minor is the determinant of a ' + (A.rows - 1) + '×' + (A.cols - 1) + ' matrix.',
      });
      steps.add('Step 2 — one example', {
        matrices: [
          { matrix: A, label: 'A', highlight: { rows: [0], cols: [0] }, caption: 'delete row 1 and column 1' },
          { matrix: getMinor(A, 0, 0), label: 'minor at (1,1)', caption: 'determinant = ' + fmt(data[0][0]) },
        ],
      });
      steps.add('Step 3 — every minor', { list: lines, note: lines.length < A.rows * A.cols ? 'First 9 shown.' : undefined });
      steps.result('Matrix of minors', { matrix: result, label: 'M' });
    }
    return result;
  }

  /** Cᵢⱼ = (−1)^(i+j) · Mᵢⱼ */
  function cofactorMatrix(A, steps) {
    ML.operations.requireSquare(A, 'The cofactor matrix');
    if (A.rows === 1) {
      const result = Matrix.from([[1]]);
      if (steps) steps.result('Cofactor matrix', { matrix: result, label: 'C' });
      return result;
    }
    const minors = minorMatrix(A);
    const data = ML.grid(A.rows, A.cols, Frac.ZERO);
    for (let i = 0; i < A.rows; i++) {
      for (let j = 0; j < A.cols; j++) {
        const sign = (i + j) % 2 === 0 ? Frac.ONE : Frac.MINUS_ONE;
        data[i][j] = minors.data[i][j].mul(sign);
      }
    }
    const result = Matrix.fromGrid(data);
    if (steps) {
      steps.add('Step 1 — the sign pattern', {
        text:
          'A cofactor is a minor with a sign attached: Cᵢⱼ = (−1)^(i+j)·Mᵢⱼ. The signs form a chequerboard starting ' +
          'with + in the top-left corner.',
        math: signBoard(A.rows, A.cols),
      });
      steps.add('Step 2 — minors first', { matrix: minors, label: 'M' });
      steps.result('Cofactor matrix', {
        matrix: result,
        label: 'C',
        text: 'Each minor keeps its value where the sign is +, and flips where the sign is −.',
      });
    }
    return result;
  }

  function signBoard(rows, cols) {
    const lines = [];
    for (let i = 0; i < Math.min(rows, 4); i++) {
      const row = [];
      for (let j = 0; j < Math.min(cols, 4); j++) row.push((i + j) % 2 === 0 ? '+' : '−');
      lines.push(row.join(' '));
    }
    return lines.join('   /   ');
  }

  /** adj(A) = Cᵗ — the transpose of the cofactor matrix. */
  function adjointMatrix(A, steps) {
    ML.operations.requireSquare(A, 'The adjugate');
    if (A.rows === 1) {
      const result = Matrix.from([[1]]);
      if (steps) {
        steps.result('Adjugate', {
          matrix: result,
          label: 'adj(A)',
          text: 'For a 1×1 matrix [a] the adjugate is [1], which makes the inverse formula give 1/a as expected.',
        });
      }
      return result;
    }
    const cofactors = cofactorMatrix(A, steps);
    const result = ML.transposeMatrix(cofactors);
    if (steps) {
      steps.result('Adjugate (adjoint)', {
        matrix: result,
        label: 'adj(A) = Cᵗ',
        text:
          'Transposing the cofactor matrix gives the adjugate. Its defining property is A·adj(A) = det(A)·I, which is ' +
          'exactly why dividing the adjugate by the determinant produces the inverse.',
      });
    }
    return result;
  }

  /* ------------------------------------------------------------------ *
   * Determinant
   * ------------------------------------------------------------------ */

  /**
   * det(A).
   * @param {ML.Matrix} A
   * @param {ML.StepLog} [steps]
   * @param {object} [options] {method: 'auto'|'cofactor'|'elimination', row: number}
   * @returns {ML.Frac}
   */
  function determinant(A, steps, options) {
    ML.operations.requireSquare(A, 'The determinant');
    const opts = options || {};
    const n = A.rows;
    const method = opts.method || 'auto';

    if (n === 1) {
      if (steps) {
        steps.result('A 1×1 determinant', {
          math: 'det[' + fmt(A.get(0, 0)) + '] = ' + fmt(A.get(0, 0)),
          text: 'For a single number the determinant is that number.',
        });
      }
      return A.get(0, 0);
    }

    if (n === 2 && method !== 'elimination') return determinant2(A, steps);
    if (n === 3 && method === 'auto') return determinant3(A, steps);
    if (method === 'cofactor') return determinantByCofactor(A, steps, opts.row || 0);
    return determinantByElimination(A, steps);
  }

  function determinant2(A, steps) {
    const a = A.get(0, 0);
    const b = A.get(0, 1);
    const c = A.get(1, 0);
    const d = A.get(1, 1);
    const value = a.mul(d).sub(b.mul(c));
    if (steps) {
      steps.add('Step 1 — the 2×2 rule', {
        text: 'For a 2×2 matrix the determinant is the product of the main diagonal minus the product of the other diagonal.',
        math: 'det(A) = ad − bc',
        matrix: A,
        label: 'A =',
        highlight: { cells: [[0, 0], [1, 1]] },
      });
      steps.add('Step 2 — substitute the entries', {
        math:
          'det(A) = (' + fmt(a) + ')(' + fmt(d) + ') − (' + fmt(b) + ')(' + fmt(c) + ') = ' +
          fmt(a.mul(d)) + ' − ' + fmt(b.mul(c)) + ' = ' + fmt(value),
      });
      steps.result('Determinant', {
        math: 'det(A) = ' + fmt(value),
        text: geometricNote(value, 2),
      });
    }
    return value;
  }

  function determinant3(A, steps) {
    // Cofactor expansion along the first row, which is also the clearest to read.
    const terms = [];
    let value = Frac.ZERO;
    for (let j = 0; j < 3; j++) {
      const entry = A.get(0, j);
      const block = getMinor(A, 0, j);
      const blockDet = determinant2(block);
      const sign = j % 2 === 0 ? Frac.ONE : Frac.MINUS_ONE;
      const term = entry.mul(blockDet).mul(sign);
      value = value.add(term);
      terms.push({ j: j, entry: entry, block: block, blockDet: blockDet, sign: sign, term: term });
    }

    if (steps) {
      steps.add('Step 1 — expand along the first row', {
        text:
          'A 3×3 determinant reduces to three 2×2 determinants. Take each entry of the first row, delete its row and ' +
          'column, and take the determinant of the 2×2 block that remains — with alternating signs + − +.',
        math: 'det(A) = a₁₁M₁₁ − a₁₂M₁₂ + a₁₃M₁₃',
        matrix: A,
        label: 'A =',
        highlight: { rows: [0] },
      });
      terms.forEach(function (term) {
        steps.add('Step 2.' + (term.j + 1) + ' — the block for a₁' + sub(term.j + 1), {
          matrices: [
            {
              matrix: A,
              label: 'delete row 1, column ' + (term.j + 1),
              highlight: { rows: [0], cols: [term.j] },
            },
            { matrix: term.block, label: 'M₁' + sub(term.j + 1), caption: 'determinant = ' + fmt(term.blockDet) },
          ],
          math:
            (term.sign.isNegative() ? '− ' : '+ ') + '(' + fmt(term.entry) + ')(' + fmt(term.blockDet) + ') = ' +
            fmt(term.term),
        });
      });
      steps.result('Add the three terms', {
        math:
          'det(A) = ' + terms.map(function (t, index) {
            const text = fmt(t.term);
            if (index === 0) return text;
            return text.startsWith('-') ? '− ' + text.slice(1) : '+ ' + text;
          }).join(' ') + ' = ' + fmt(value),
        text: geometricNote(value, 3),
      });
    }
    return value;
  }

  /** Cofactor expansion along a chosen row — the definition, for any size. */
  function determinantByCofactor(A, steps, expandRow) {
    ML.operations.requireSquare(A, 'The determinant');
    const n = A.rows;
    if (n > COFACTOR_LIMIT) {
      throw new MLError(
        'Cofactor expansion on a ' + A.size() + ' matrix would need roughly ' + factorialText(n) +
          ' multiplications, which would freeze the page. Elimination gives the same answer with far less work — ' +
          'choose the elimination method instead.',
        { hint: 'Cofactor expansion is available up to ' + COFACTOR_LIMIT + '×' + COFACTOR_LIMIT + '.' }
      );
    }
    if (n === 1) return A.get(0, 0);
    if (n === 2) return determinant2(A, steps);

    const row = Math.max(0, Math.min(n - 1, expandRow || 0));
    let value = Frac.ZERO;
    const lines = [];
    for (let j = 0; j < n; j++) {
      const entry = A.get(row, j);
      if (entry.isZero()) {
        lines.push('a' + sub(row + 1) + sub(j + 1) + ' = 0, so this term contributes nothing');
        continue;
      }
      const blockDet = determinantByCofactor(getMinor(A, row, j), null, 0);
      const sign = (row + j) % 2 === 0 ? Frac.ONE : Frac.MINUS_ONE;
      const term = entry.mul(blockDet).mul(sign);
      value = value.add(term);
      lines.push(
        (sign.isNegative() ? '− ' : '+ ') + '(' + fmt(entry) + ')·M' + sub(row + 1) + sub(j + 1) + ' = ' +
          (sign.isNegative() ? '− ' : '+ ') + '(' + fmt(entry) + ')(' + fmt(blockDet) + ') = ' + fmt(term)
      );
    }

    if (steps) {
      steps.add('Step 1 — expansion along row ' + (row + 1), {
        text:
          'The determinant is defined by expansion: run along a row, and for each entry multiply it by the ' +
          'determinant of the matrix that remains when its row and column are removed, alternating signs. ' +
          'Choosing a row with zeros in it saves work.',
        matrix: A,
        label: 'A =',
        highlight: { rows: [row] },
      });
      steps.add('Step 2 — the terms', { list: lines });
      steps.result('Determinant', { math: 'det(A) = ' + fmt(value), text: geometricNote(value, n) });
    }
    return value;
  }

  /** Elimination: det = (−1)^swaps × product of pivots. */
  function determinantByElimination(A, steps) {
    ML.operations.requireSquare(A, 'The determinant');
    const n = A.rows;
    const record = ML.eliminate(A, { full: false, normalize: false, steps: steps, label: 'A' });

    if (record.rank < n) {
      if (steps) {
        steps.result('Determinant', {
          math: 'det(A) = 0',
          text:
            'Elimination produced a row of zeros: only ' + record.rank + ' of the ' + n + ' rows are independent. ' +
            'A matrix whose rows are dependent has determinant 0, so A is singular and has no inverse.',
        });
      }
      return Frac.ZERO;
    }

    const sign = record.swaps % 2 === 0 ? Frac.ONE : Frac.MINUS_ONE;
    const value = record.pivotProduct.mul(sign);

    if (steps) {
      const pivotValues = record.pivots.map(function (p) { return fmt(record.matrix.get(p[0], p[1])); });
      steps.add('Multiply the pivots', {
        text:
          'Adding a multiple of one row to another leaves the determinant unchanged, and the echelon form is ' +
          'triangular — so the determinant is simply the product of the diagonal entries.',
        math: 'product of pivots = ' + pivotValues.join(' × ') + ' = ' + fmt(record.pivotProduct),
      });
      steps.add('Account for the row swaps', {
        text:
          record.swaps === 0
            ? 'No rows were swapped, so no sign change is needed.'
            : 'Each row swap flips the sign of the determinant. There ' + (record.swaps === 1 ? 'was 1 swap' : 'were ' + record.swaps + ' swaps') +
              ', giving a factor of (−1)' + ML.operations.superscript(record.swaps) + ' = ' + fmt(sign) + '.',
        math: 'det(A) = (−1)' + ML.operations.superscript(record.swaps) + ' × ' + fmt(record.pivotProduct) + ' = ' + fmt(value),
      });
      steps.result('Determinant', { math: 'det(A) = ' + fmt(value), text: geometricNote(value, n) });
    }
    return value;
  }

  function factorialText(n) {
    let value = 1;
    for (let i = 2; i <= n; i++) value *= i;
    return value.toLocaleString('en-US');
  }

  /** A short, honest reading of what the number means. */
  function geometricNote(value, n) {
    const size = n === 2 ? 'area' : n === 3 ? 'volume' : n + '-dimensional volume';
    if (value.isZero()) {
      return 'A determinant of 0 means the transformation collapses ' + size + ' to nothing: the columns lie in a ' +
        'smaller subspace, the matrix is singular, and no inverse exists.';
    }
    const magnitude = value.abs();
    const orientation = value.isNegative() ? ' and it reverses orientation (a reflection is involved)' : '';
    return 'The transformation multiplies ' + size + ' by ' + fmt(magnitude) + orientation +
      '. Because the determinant is not zero, A is invertible.';
  }

  const api = {
    determinant: determinant,
    determinantByCofactor: determinantByCofactor,
    determinantByElimination: determinantByElimination,
    getMinor: getMinor,
    minor: minor,
    minorMatrix: minorMatrix,
    cofactorMatrix: cofactorMatrix,
    adjointMatrix: adjointMatrix,
    COFACTOR_LIMIT: COFACTOR_LIMIT,
  };

  ML.determinantModule = api;
  Object.assign(ML, api);
})((globalThis.ML = globalThis.ML || {}));
