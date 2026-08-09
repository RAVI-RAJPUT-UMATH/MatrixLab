/**
 * MatrixLab — subspaces: span, independence, basis, and the four fundamental
 * subspaces of a matrix.
 *
 * All of it comes out of one exact row reduction, which is the point worth
 * teaching: rank, nullity, column space, row space and null space are not five
 * separate calculations but five readings of the same reduced matrix.
 */
(function (ML) {
  'use strict';

  const Matrix = ML.Matrix;
  const Frac = ML.Frac;
  const MLError = ML.MLError;
  const fmt = function (v) { return ML.fmt(v); };
  const sub = function (n) { return ML.operations.subscript(n); };

  /* ------------------------------------------------------------------ *
   * Independence, span, basis
   * ------------------------------------------------------------------ */

  /**
   * Are the given vectors independent? If not, an explicit dependency is
   * reported: "v₃ = 2v₁ − v₂".
   *
   * @param {Array<ML.Frac[]|ML.Matrix>} vectors
   * @returns {{independent: boolean, rank: number, count: number,
   *            dependencies: Array<{index: number, text: string, coefficients: ML.Frac[]}>,
   *            basisIndices: number[], rref: ML.Matrix, matrix: ML.Matrix}}
   */
  function linearIndependence(vectors, steps) {
    if (!vectors || !vectors.length) throw new MLError('Provide at least one vector.');
    const columns = vectors.map(function (v, i) { return ML.asVector(v, 'v' + (i + 1)); });
    const length = columns[0].length;
    columns.forEach(function (column, i) {
      if (column.length !== length) {
        throw new MLError('All vectors must have the same number of components (vector ' + (i + 1) + ' differs).');
      }
    });

    const A = Matrix.fromColumns(columns);
    const record = ML.eliminate(A, { full: true, steps: steps, label: 'V' });
    const pivotColumns = record.pivots.map(function (p) { return p[1]; });
    const independent = record.rank === columns.length;

    // Each free column expresses one vector in terms of the pivot vectors.
    const dependencies = record.freeColumns.map(function (freeColumn) {
      const coefficients = new Array(columns.length).fill(Frac.ZERO);
      const terms = [];
      record.pivots.forEach(function (pivot) {
        const coefficient = record.matrix.get(pivot[0], freeColumn);
        coefficients[pivot[1]] = coefficient;
        if (coefficient.isZero()) return;
        const magnitude = coefficient.abs();
        const body = (magnitude.isOne() ? '' : fmt(magnitude)) + 'v' + sub(pivot[1] + 1);
        if (!terms.length) terms.push((coefficient.isNegative() ? '−' : '') + body);
        else terms.push((coefficient.isNegative() ? ' − ' : ' + ') + body);
      });
      return {
        index: freeColumn,
        coefficients: coefficients,
        text: 'v' + sub(freeColumn + 1) + ' = ' + (terms.length ? terms.join('') : '0'),
      };
    });

    if (steps) {
      steps.add('How to test independence', {
        text:
          'Put the vectors side by side as the columns of a matrix and row-reduce. The vectors are independent exactly ' +
          'when every column contains a pivot: that means no column can be built from the others. Here the rank is ' +
          record.rank + ' and there are ' + columns.length + ' vectors.',
      });
      steps.result(independent ? 'Independent' : 'Dependent', {
        text: independent
          ? 'Every column has a pivot, so the only combination giving the zero vector is the trivial one — the vectors ' +
            'are linearly independent and form a basis for their span.'
          : 'Columns ' + record.freeColumns.map(function (c) { return c + 1; }).join(', ') +
            ' have no pivot, so those vectors are combinations of the earlier ones.',
        list: independent ? null : dependencies.map(function (d) { return d.text; }),
        kind: independent ? 'result' : 'warn',
      });
    }

    return {
      independent: independent,
      rank: record.rank,
      count: columns.length,
      dimension: record.rank,
      dependencies: dependencies,
      basisIndices: pivotColumns,
      rref: record.matrix,
      matrix: A,
    };
  }

  /**
   * Is `target` in the span of `vectors`? Exact, via the consistency of the
   * system [v₁ … vₖ]c = target.
   */
  function spanContains(vectors, target, steps) {
    const columns = vectors.map(function (v, i) { return ML.asVector(v, 'v' + (i + 1)); });
    const A = Matrix.fromColumns(columns);
    const b = Matrix.column(ML.asVector(target, 'target'));
    if (A.rows !== b.rows) {
      throw new MLError(
        'The target vector has ' + b.rows + ' components but the spanning vectors have ' + A.rows + '.'
      );
    }
    const solution = ML.solveLinearSystem(A, b, steps, {
      names: columns.map(function (_, i) { return 'c' + sub(i + 1); }),
    });
    const inSpan = solution.type !== 'none';
    return {
      inSpan: inSpan,
      solution: solution,
      unique: solution.type === 'unique',
      text: inSpan
        ? solution.type === 'unique'
          ? 'Yes — and in exactly one way, because the spanning vectors are independent.'
          : 'Yes, and in infinitely many ways, because the spanning vectors are dependent.'
        : 'No — the target lies outside the span of these vectors.',
    };
  }

  /** A basis for the span: the independent subset picked out by the pivots. */
  function basisOfSpan(vectors, steps) {
    const report = linearIndependence(vectors, steps);
    const columns = vectors.map(function (v) { return ML.asVector(v); });
    return {
      basis: report.basisIndices.map(function (index) { return Matrix.column(columns[index]); }),
      indices: report.basisIndices,
      dimension: report.rank,
      report: report,
    };
  }

  /* ------------------------------------------------------------------ *
   * The four fundamental subspaces
   * ------------------------------------------------------------------ */

  /**
   * C(A) — the span of the columns, living in ℝᵐ.
   * The basis is taken from the *original* columns at the pivot positions:
   * elimination changes the column space, so the reduced columns are not a basis
   * for it, but which columns are independent is unchanged.
   */
  function columnSpace(A, steps) {
    const record = ML.eliminate(A, { full: true });
    const pivotColumns = record.pivots.map(function (p) { return p[1]; });
    const basis = pivotColumns.map(function (j) { return Matrix.column(A.colAt(j)); });
    if (steps) {
      steps.add('Column space C(A)', {
        text:
          'The column space is everything you can reach as a combination of the columns of A — that is, every possible ' +
          'value of Ax. It lives in ℝ' + ML.operations.superscript(A.rows) + ' and its dimension is the rank, ' +
          record.rank + '.',
        matrix: record.matrix,
        label: 'rref(A)',
        highlight: { pivots: record.pivots },
      });
      steps.add('Choosing a basis', {
        text:
          'Row operations change the column space, so the reduced columns are not a basis for it. What they do reveal ' +
          'is which columns are independent: take the columns of the original A in the pivot positions (' +
          pivotColumns.map(function (j) { return 'column ' + (j + 1); }).join(', ') + ').',
        matrices: basis.map(function (vector, k) {
          return { matrix: vector, label: 'c' + sub(k + 1) };
        }),
      });
    }
    return {
      name: 'Column space',
      symbol: 'C(A)',
      basis: basis,
      dimension: record.rank,
      ambient: A.rows,
      ambientText: 'ℝ' + ML.operations.superscript(A.rows),
      pivotColumns: pivotColumns,
      meaning:
        'All the vectors b for which Ax = b has a solution. Its dimension is the rank of A.',
    };
  }

  /** R(A) — the span of the rows, living in ℝⁿ. Non-zero rows of rref(A) are a basis. */
  function rowSpace(A, steps) {
    const record = ML.eliminate(A, { full: true });
    const basis = [];
    for (let i = 0; i < record.rank; i++) basis.push(Matrix.column(record.matrix.rowAt(i)));
    if (steps) {
      steps.add('Row space R(A)', {
        text:
          'The row space is the span of the rows of A, living in ℝ' + ML.operations.superscript(A.cols) + '. Unlike ' +
          'the column space, it is unchanged by row operations — every row of the reduced matrix is a combination of ' +
          'the original rows, and vice versa. So the non-zero rows of rref(A) form a particularly clean basis.',
        matrix: record.matrix,
        label: 'rref(A)',
        highlight: { rows: basis.map(function (_, i) { return i; }) },
      });
    }
    return {
      name: 'Row space',
      symbol: 'R(A) = C(Aᵗ)',
      basis: basis,
      dimension: record.rank,
      ambient: A.cols,
      ambientText: 'ℝ' + ML.operations.superscript(A.cols),
      meaning:
        'The span of the rows of A. Its dimension is also the rank — which is why row rank always equals column rank.',
    };
  }

  /** N(A) — the solutions of Ax = 0, living in ℝⁿ. */
  function nullSpace(A, steps) {
    const record = ML.eliminate(A, { full: true, steps: steps, label: 'A' });
    const basis = record.freeColumns.map(function (freeColumn) {
      const values = new Array(A.cols).fill(Frac.ZERO);
      values[freeColumn] = Frac.ONE;
      record.pivots.forEach(function (pivot) {
        values[pivot[1]] = record.matrix.get(pivot[0], freeColumn).neg();
      });
      return Matrix.column(values);
    });

    if (steps) {
      steps.add('Null space N(A)', {
        text:
          'The null space holds every x with Ax = 0 — the directions A destroys. Reduce A, then for each column ' +
          'without a pivot set that variable to 1 and the other free variables to 0; solving for the pivot variables ' +
          'gives one basis vector. There ' +
          (record.freeColumns.length === 1
            ? 'is 1 free column, so the null space is a line'
            : record.freeColumns.length === 0
            ? 'are no free columns, so the null space contains only the zero vector'
            : 'are ' + record.freeColumns.length + ' free columns, so the null space is ' +
              record.freeColumns.length + '-dimensional') + '.',
        matrices: basis.map(function (vector, k) {
          return { matrix: vector, label: 'n' + sub(k + 1) };
        }),
      });
      if (basis.length) {
        steps.add('Check', {
          text: 'Multiplying A by each basis vector gives the zero vector, as it must.',
          matrices: basis.map(function (vector, k) {
            return { matrix: ML.multiplyMatrices(A, vector), label: 'A·n' + sub(k + 1) };
          }),
        });
      }
    }

    return {
      name: 'Null space',
      symbol: 'N(A)',
      basis: basis,
      dimension: record.freeColumns.length,
      ambient: A.cols,
      ambientText: 'ℝ' + ML.operations.superscript(A.cols),
      freeColumns: record.freeColumns,
      meaning:
        'Every x with Ax = 0. Its dimension is the nullity, n − rank. If it contains only the zero vector, A is ' +
        'one-to-one and Ax = b never has more than one solution.',
    };
  }

  /** N(Aᵗ) — the left null space, living in ℝᵐ. */
  function leftNullSpace(A, steps) {
    const transposed = ML.transposeMatrix(A);
    const result = nullSpace(transposed, steps);
    return {
      name: 'Left null space',
      symbol: 'N(Aᵗ)',
      basis: result.basis,
      dimension: result.dimension,
      ambient: A.rows,
      ambientText: 'ℝ' + ML.operations.superscript(A.rows),
      meaning:
        'Every y with Aᵗy = 0, equivalently yᵗA = 0. These are the directions in the output space that no combination ' +
        'of the columns can reach — the orthogonal complement of the column space.',
    };
  }

  /**
   * All four subspaces plus the relationships between them.
   * @returns {object}
   */
  function fourSubspaces(A, steps) {
    ML.operations.requireMatrix(A, 'A');
    const record = ML.eliminate(A, { full: true });
    const rank = record.rank;
    const m = A.rows;
    const n = A.cols;

    const spaces = {
      column: columnSpace(A),
      row: rowSpace(A),
      null: nullSpace(A),
      leftNull: leftNullSpace(A),
    };

    if (steps) {
      steps.add('One reduction, four subspaces', {
        text:
          'Every one of the four fundamental subspaces can be read off a single reduced matrix. The rank is ' + rank +
          ', so the column space and row space are both ' + rank + '-dimensional, the null space is ' + (n - rank) +
          '-dimensional, and the left null space is ' + (m - rank) + '-dimensional.',
        matrix: record.matrix,
        label: 'rref(A)',
        highlight: { pivots: record.pivots },
      });
      steps.add('Rank–nullity', {
        math: 'rank(A) + nullity(A) = ' + rank + ' + ' + (n - rank) + ' = ' + n + ' = number of columns',
        text:
          'Each column either carries a pivot (contributing a dimension to the column space) or is free (contributing ' +
          'a dimension to the null space). There is no third option, which is the whole content of the theorem.',
      });
      steps.add('The same count on the other side', {
        math: 'rank(A) + dim N(Aᵗ) = ' + rank + ' + ' + (m - rank) + ' = ' + m + ' = number of rows',
        text: 'Applying the same argument to Aᵗ splits the output space ℝ' + ML.operations.superscript(m) + ' between ' +
          'the column space and the left null space.',
      });
    }

    return {
      matrix: A,
      rref: record.matrix,
      pivots: record.pivots,
      rank: rank,
      nullity: n - rank,
      leftNullity: m - rank,
      rows: m,
      cols: n,
      spaces: spaces,
      relations: [
        {
          text: 'rank + nullity = number of columns',
          math: rank + ' + ' + (n - rank) + ' = ' + n,
          holds: rank + (n - rank) === n,
        },
        {
          text: 'rank + dim(left null space) = number of rows',
          math: rank + ' + ' + (m - rank) + ' = ' + m,
          holds: rank + (m - rank) === m,
        },
        {
          text: 'The row space and null space are perpendicular complements inside ℝ' + ML.operations.superscript(n),
          math: 'R(A) ⊥ N(A),   dim R(A) + dim N(A) = ' + n,
          holds: true,
        },
        {
          text: 'The column space and left null space are perpendicular complements inside ℝ' + ML.operations.superscript(m),
          math: 'C(A) ⊥ N(Aᵗ),   dim C(A) + dim N(Aᵗ) = ' + m,
          holds: true,
        },
      ],
    };
  }

  /** Verify numerically-free, exactly: every row-space basis vector ⊥ every null-space basis vector. */
  function verifyOrthogonality(subspaces) {
    const checks = [];
    subspaces.spaces.row.basis.forEach(function (r, i) {
      subspaces.spaces.null.basis.forEach(function (n, j) {
        checks.push({
          pair: 'row basis ' + (i + 1) + ' · null basis ' + (j + 1),
          value: ML.dotProduct(r, n),
        });
      });
    });
    subspaces.spaces.column.basis.forEach(function (c, i) {
      subspaces.spaces.leftNull.basis.forEach(function (y, j) {
        checks.push({
          pair: 'column basis ' + (i + 1) + ' · left-null basis ' + (j + 1),
          value: ML.dotProduct(c, y),
        });
      });
    });
    return { checks: checks, allZero: checks.every(function (check) { return check.value.isZero(); }) };
  }

  const api = {
    linearIndependence: linearIndependence,
    spanContains: spanContains,
    basisOfSpan: basisOfSpan,
    columnSpace: columnSpace,
    rowSpace: rowSpace,
    nullSpace: nullSpace,
    leftNullSpace: leftNullSpace,
    fourSubspaces: fourSubspaces,
    verifySubspaceOrthogonality: verifyOrthogonality,
  };

  ML.subspaces = api;
  Object.assign(ML, api);
})((globalThis.ML = globalThis.ML || {}));
