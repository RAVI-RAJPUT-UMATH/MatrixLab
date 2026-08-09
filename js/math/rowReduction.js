/**
 * MatrixLab — elementary row operations, REF and RREF.
 *
 * One engine does the elimination and every other module leans on it: rank,
 * determinant, inverse, solving, null spaces and LU all come from here.
 * Arithmetic is exact rational, so a pivot is zero or it is not — there is no
 * tolerance to tune and no risk of calling a singular matrix invertible.
 */
(function (ML) {
  'use strict';

  const Matrix = ML.Matrix;
  const Frac = ML.Frac;
  const MLError = ML.MLError;
  const fmt = function (v) { return ML.fmt(v); };

  /* ------------------------------------------------------------------ *
   * The three elementary row operations
   * ------------------------------------------------------------------ */

  function checkRow(A, i, label) {
    if (!Number.isInteger(i) || i < 0 || i >= A.rows) {
      throw new MLError(
        'There is no row ' + (i + 1) + ' in a ' + A.size() + ' matrix' + (label ? ' (' + label + ')' : '') + '.'
      );
    }
  }

  /** Rᵢ ↔ Rⱼ */
  function rowSwap(A, i, j) {
    checkRow(A, i);
    checkRow(A, j);
    const data = A.toArray();
    const temp = data[i];
    data[i] = data[j];
    data[j] = temp;
    return Matrix.fromGrid(data);
  }

  /** Rᵢ → k·Rᵢ (k must be non-zero to stay reversible) */
  function rowScale(A, i, k) {
    checkRow(A, i);
    const scalar = Frac.of(k);
    if (scalar.isZero()) {
      throw new MLError(
        'Multiplying a row by 0 is not an elementary row operation: it destroys information and cannot be undone. ' +
          'Use a non-zero number.'
      );
    }
    const data = A.toArray();
    data[i] = data[i].map(function (v) { return v.mul(scalar); });
    return Matrix.fromGrid(data);
  }

  /** Rᵢ → Rᵢ + k·Rⱼ */
  function rowAdd(A, target, source, k) {
    checkRow(A, target, 'target row');
    checkRow(A, source, 'source row');
    if (target === source) {
      throw new MLError('Adding a multiple of a row to itself is not an elementary row operation. Pick two different rows.');
    }
    const scalar = Frac.of(k);
    const data = A.toArray();
    data[target] = data[target].map(function (v, col) { return v.add(scalar.mul(data[source][col])); });
    return Matrix.fromGrid(data);
  }

  /** Human-readable name of an operation, e.g. "R2 → R2 − 3R1". */
  function describeOperation(op) {
    const r = function (i) { return 'R' + (i + 1); };
    if (op.type === 'swap') return r(op.i) + ' ↔ ' + r(op.j);
    if (op.type === 'scale') {
      return r(op.i) + ' → ' + coefficientLabel(op.k) + r(op.i);
    }
    if (op.type === 'add') {
      const k = op.k;
      const sign = k.isNegative() ? ' − ' : ' + ';
      const magnitude = k.abs();
      const coefficient = magnitude.isOne() ? '' : fmt(magnitude);
      return r(op.target) + ' → ' + r(op.target) + sign + coefficient + r(op.source);
    }
    return '';
  }

  function coefficientLabel(k) {
    if (k.isOne()) return '';
    if (k.eq(Frac.MINUS_ONE)) return '−';
    return '(' + fmt(k) + ')';
  }

  /** Apply a recorded operation to a matrix. */
  function applyOperation(A, op) {
    if (op.type === 'swap') return rowSwap(A, op.i, op.j);
    if (op.type === 'scale') return rowScale(A, op.i, op.k);
    if (op.type === 'add') return rowAdd(A, op.target, op.source, op.k);
    throw new MLError('Unknown row operation.');
  }

  /* ------------------------------------------------------------------ *
   * The elimination engine
   * ------------------------------------------------------------------ */

  /**
   * Gaussian / Gauss–Jordan elimination.
   *
   * @param {ML.Matrix} A
   * @param {object} [options]
   * @param {boolean} [options.full=false]      Also clear above each pivot (RREF).
   * @param {boolean} [options.normalize]       Scale pivots to 1 (default: same as `full`).
   * @param {number}  [options.pivotColumns]    Only search for pivots in the first N columns
   *                                            (used for augmented matrices).
   * @param {ML.StepLog} [options.steps]
   * @param {string} [options.label='A']
   * @returns {{matrix: ML.Matrix, pivots: Array<[number,number]>, rank: number,
   *            freeColumns: number[], swaps: number, pivotProduct: ML.Frac,
   *            operations: object[]}}
   */
  function eliminate(A, options) {
    ML.operations.requireMatrix(A, 'A');
    const opts = options || {};
    const full = !!opts.full;
    const normalize = opts.normalize == null ? full : !!opts.normalize;
    const searchCols = opts.pivotColumns == null ? A.cols : Math.min(opts.pivotColumns, A.cols);
    const steps = opts.steps || null;
    const label = opts.label || 'A';

    let current = A;
    const pivots = [];
    const operations = [];
    let swaps = 0;
    let pivotProduct = Frac.ONE;
    let row = 0;

    if (steps) {
      steps.add('Step 1 — start from the matrix', {
        text:
          full
            ? 'Gauss–Jordan elimination: work left to right, make each pivot a 1, and clear every other entry in the ' +
              'pivot’s column — above as well as below.'
            : 'Gaussian elimination: work left to right and use each pivot to clear the entries beneath it, ' +
              'producing a staircase (echelon) shape.',
        matrix: current,
        label: label + ' =',
        augmentAt: opts.augmentAt,
      });
    }

    for (let col = 0; col < searchCols && row < A.rows; col++) {
      const pivotRow = choosePivotRow(current, row, col);

      if (pivotRow < 0) {
        if (steps) {
          steps.add(steps.nextLabel('column ' + (col + 1) + ' has no pivot'), {
            text:
              'Every entry from row ' + (row + 1) + ' downwards in column ' + (col + 1) + ' is already zero, so no ' +
              'pivot is available here. This column belongs to a free variable; move on to the next column without ' +
              'moving down a row.',
            highlight: { cols: [col] },
            matrix: current,
          });
        }
        continue;
      }

      if (pivotRow !== row) {
        const op = { type: 'swap', i: row, j: pivotRow };
        current = applyOperation(current, op);
        operations.push(op);
        swaps++;
        if (steps) {
          steps.add(steps.nextLabel('bring a non-zero entry into the pivot position'), {
            text:
              'Position (' + (row + 1) + ', ' + (col + 1) + ') held a zero, so rows ' + (row + 1) + ' and ' +
              (pivotRow + 1) + ' are exchanged. Swapping rows only reorders the equations — it changes nothing about ' +
              'the solutions (though it does flip the sign of the determinant).',
            math: describeOperation(op),
            matrix: current,
            label: 'after ' + describeOperation(op),
            highlight: { pivots: [[row, col]] },
            augmentAt: opts.augmentAt,
          });
        }
      }

      const pivotValue = current.get(row, col);
      pivotProduct = pivotProduct.mul(pivotValue);

      if (normalize && !pivotValue.isOne()) {
        const op = { type: 'scale', i: row, k: pivotValue.inv() };
        current = applyOperation(current, op);
        operations.push(op);
        if (steps) {
          steps.add(steps.nextLabel('make the pivot 1'), {
            text:
              'Divide row ' + (row + 1) + ' by its pivot ' + fmt(pivotValue) + ' so the leading entry becomes 1. ' +
              'A leading 1 is what makes the final read-off of the answer immediate.',
            math: describeOperation(op),
            matrix: current,
            label: 'after ' + describeOperation(op),
            highlight: { pivots: [[row, col]] },
            augmentAt: opts.augmentAt,
          });
        }
      }

      // Clear the rest of this column.
      const cleared = [];
      for (let i = 0; i < A.rows; i++) {
        if (i === row) continue;
        if (!full && i < row) continue;
        const entry = current.get(i, col);
        if (entry.isZero()) continue;
        const factor = entry.div(current.get(row, col)).neg();
        const op = { type: 'add', target: i, source: row, k: factor };
        current = applyOperation(current, op);
        operations.push(op);
        cleared.push(describeOperation(op));
      }

      if (steps && cleared.length) {
        steps.add(steps.nextLabel('clear column ' + (col + 1) + (full ? '' : ' below the pivot')), {
          text:
            'Subtract the right multiple of row ' + (row + 1) + ' from each other row so that column ' + (col + 1) +
            ' becomes 0 ' + (full ? 'everywhere except the pivot' : 'below the pivot') +
            '. Adding a multiple of one row to another never changes the solution set.',
          list: cleared,
          matrix: current,
          label: 'after clearing column ' + (col + 1),
          highlight: { pivots: [[row, col]] },
          augmentAt: opts.augmentAt,
        });
      }

      pivots.push([row, col]);
      row++;
    }

    const freeColumns = [];
    const pivotColumnSet = new Set(pivots.map(function (p) { return p[1]; }));
    for (let c = 0; c < searchCols; c++) if (!pivotColumnSet.has(c)) freeColumns.push(c);

    if (steps) {
      steps.result(full ? 'Reduced row echelon form' : 'Row echelon form', {
        matrix: current,
        label: (full ? 'rref(' : 'ref(') + label + ')',
        augmentAt: opts.augmentAt,
        highlight: { pivots: pivots },
        text:
          'There are ' + pivots.length + ' pivot' + (pivots.length === 1 ? '' : 's') +
          (pivots.length ? ' (highlighted), in column' + (pivots.length === 1 ? ' ' : 's ') +
            pivots.map(function (p) { return p[1] + 1; }).join(', ') : '') +
          '. The number of pivots is the rank: ' + pivots.length + '.',
      });
    }

    return {
      matrix: current,
      pivots: pivots,
      rank: pivots.length,
      freeColumns: freeColumns,
      swaps: swaps,
      pivotProduct: pivotProduct,
      operations: operations,
    };
  }

  /**
   * Pick the pivot row. With exact arithmetic any non-zero entry works, so we
   * choose the one that keeps the numbers small: prefer ±1, then the simplest
   * fraction. This is what keeps hand-checkable output readable.
   */
  function choosePivotRow(A, fromRow, col) {
    let best = -1;
    let bestScore = Infinity;
    for (let i = fromRow; i < A.rows; i++) {
      const value = A.get(i, col);
      if (value.isZero()) continue;
      const isUnit = value.abs().isOne();
      const size = value.n.toString().length + value.d.toString().length;
      const score = (isUnit ? 0 : 100) + size;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  /* ------------------------------------------------------------------ *
   * Public entry points
   * ------------------------------------------------------------------ */

  /** Row echelon form. Pivots are left as they are unless `leadingOnes`. */
  function ref(A, steps, options) {
    const opts = options || {};
    return eliminate(A, {
      full: false,
      normalize: !!opts.leadingOnes,
      steps: steps,
      label: opts.label,
      augmentAt: opts.augmentAt,
      pivotColumns: opts.pivotColumns,
    }).matrix;
  }

  /** Reduced row echelon form. */
  function rref(A, steps, options) {
    const opts = options || {};
    return eliminate(A, {
      full: true,
      steps: steps,
      label: opts.label,
      augmentAt: opts.augmentAt,
      pivotColumns: opts.pivotColumns,
    }).matrix;
  }

  /** Named aliases matching the usual textbook vocabulary. */
  function gaussianElimination(A, steps, options) {
    return ref(A, steps, options);
  }

  function gaussJordan(A, steps, options) {
    return rref(A, steps, options);
  }

  /** rank(A) — the number of pivots. */
  function matrixRank(A, steps) {
    const result = eliminate(A, { full: false, steps: steps, label: 'A' });
    if (steps) {
      steps.add('What the rank tells you', {
        text:
          'The rank is ' + result.rank + ': that many rows of A are genuinely independent, and equally that many ' +
          'columns are. Since A is ' + A.size() + ', the largest possible rank is ' + Math.min(A.rows, A.cols) +
          ', so this matrix is ' + (result.rank === Math.min(A.rows, A.cols) ? 'of full rank' : 'rank deficient') + '.',
      });
    }
    return result.rank;
  }

  /** Indices of the pivot columns of A. */
  function pivotColumns(A) {
    return eliminate(A, { full: true }).pivots.map(function (p) { return p[1]; });
  }

  /** Convenience: the full elimination record, used by other modules. */
  function reduceRecord(A, options) {
    return eliminate(A, options);
  }

  const api = {
    rowSwap: rowSwap,
    rowScale: rowScale,
    rowAdd: rowAdd,
    applyOperation: applyOperation,
    describeOperation: describeOperation,
    eliminate: eliminate,
    reduceRecord: reduceRecord,
    ref: ref,
    rref: rref,
    gaussianElimination: gaussianElimination,
    gaussJordan: gaussJordan,
    matrixRank: matrixRank,
    pivotColumns: pivotColumns,
  };

  ML.rowReduction = api;
  Object.assign(ML, api);
})((globalThis.ML = globalThis.ML || {}));
