/**
 * MatrixLab — the Matrix type.
 *
 * A Matrix is an immutable rectangular grid of exact rationals (Frac).
 * Immutability keeps step-by-step histories honest: every step can hold on to
 * the matrix as it looked at that moment.
 *
 * Algorithms that need to mutate work on a plain Frac[][] from toArray() and
 * wrap the result with Matrix.fromGrid() at the end.
 */
(function (ML) {
  'use strict';

  const Frac = ML.Frac;
  const MLError = ML.MLError;

  /** Largest matrix the UI will accept, to keep the browser responsive. */
  ML.MAX_DIM = 10;

  /** Build an r×c grid filled with `value`. */
  function grid(r, c, value) {
    const out = new Array(r);
    for (let i = 0; i < r; i++) {
      const row = new Array(c);
      for (let j = 0; j < c; j++) row[j] = value;
      out[i] = row;
    }
    return out;
  }

  function cloneGrid(g) {
    return g.map(function (row) { return row.slice(); });
  }

  class Matrix {
    /**
     * @param {Frac[][]} data Already-validated grid of Frac. Use the static
     *   factories instead of calling this directly.
     */
    constructor(data) {
      this.data = data;
      this.rows = data.length;
      this.cols = data.length ? data[0].length : 0;
      Object.freeze(this.data);
      Object.freeze(this);
    }

    /* ---------------------------- factories --------------------------- */

    /**
     * Build a matrix from a 2-D array of numbers, strings or Fracs.
     * @param {Array<Array<*>>|Matrix} rows
     */
    static from(rows) {
      if (rows instanceof Matrix) return rows;
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new MLError('A matrix needs at least one row.');
      }
      const width = Array.isArray(rows[0]) ? rows[0].length : -1;
      if (width <= 0) {
        throw new MLError('A matrix needs at least one column. Expected an array of rows.');
      }
      const data = new Array(rows.length);
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!Array.isArray(row)) {
          throw new MLError('Row ' + (i + 1) + ' is not a list of numbers.');
        }
        if (row.length !== width) {
          throw new MLError(
            'Every row must have the same number of entries: row 1 has ' + width +
              ' but row ' + (i + 1) + ' has ' + row.length + '.'
          );
        }
        const out = new Array(width);
        for (let j = 0; j < width; j++) {
          try {
            out[j] = Frac.of(row[j]);
          } catch (err) {
            throw new MLError(
              'Entry in row ' + (i + 1) + ', column ' + (j + 1) + ' is invalid: ' + err.message,
              { row: i, col: j }
            );
          }
        }
        data[i] = out;
      }
      return new Matrix(data);
    }

    /** Wrap a grid that is already Frac[][] (no copying, no validation). */
    static fromGrid(data) {
      return new Matrix(data);
    }

    static zeros(r, c) {
      requireSize(r, c);
      return new Matrix(grid(r, c === undefined ? r : c, Frac.ZERO));
    }

    static ones(r, c) {
      requireSize(r, c);
      return new Matrix(grid(r, c === undefined ? r : c, Frac.ONE));
    }

    static identity(n) {
      requireSize(n, n);
      const data = grid(n, n, Frac.ZERO);
      for (let i = 0; i < n; i++) data[i][i] = Frac.ONE;
      return new Matrix(data);
    }

    /** Diagonal matrix from a list of values. */
    static diagonal(values) {
      const n = values.length;
      requireSize(n, n);
      const data = grid(n, n, Frac.ZERO);
      for (let i = 0; i < n; i++) data[i][i] = Frac.of(values[i]);
      return new Matrix(data);
    }

    /** n×n matrix with k on the diagonal. */
    static scalarMatrix(n, k) {
      const value = Frac.of(k);
      const data = grid(n, n, Frac.ZERO);
      for (let i = 0; i < n; i++) data[i][i] = value;
      return new Matrix(data);
    }

    /** Single-row matrix. */
    static row(values) {
      return Matrix.from([values.slice()]);
    }

    /** Single-column matrix. */
    static column(values) {
      return Matrix.from(values.map(function (v) { return [v]; }));
    }

    /** Build from column vectors (each an array of values). */
    static fromColumns(columns) {
      if (!columns.length) throw new MLError('At least one column is required.');
      const rowCount = columns[0].length;
      columns.forEach(function (col, index) {
        if (col.length !== rowCount) {
          throw new MLError('All columns must have the same number of entries (column ' + (index + 1) + ' differs).');
        }
      });
      const data = grid(rowCount, columns.length, Frac.ZERO);
      for (let j = 0; j < columns.length; j++) {
        for (let i = 0; i < rowCount; i++) data[i][j] = Frac.of(columns[j][i]);
      }
      return new Matrix(data);
    }

    static isMatrix(value) {
      return value instanceof Matrix;
    }

    /* ------------------------------ access ---------------------------- */

    get(i, j) {
      if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0 || i >= this.rows || j >= this.cols) {
        throw new MLError(
          'Position (' + (i + 1) + ', ' + (j + 1) + ') is outside a ' + this.size() + ' matrix.'
        );
      }
      return this.data[i][j];
    }

    /** Mutable deep copy of the underlying grid. */
    toArray() {
      return cloneGrid(this.data);
    }

    /** number[][] view for numeric algorithms. */
    toFloat() {
      return this.data.map(function (row) {
        return row.map(function (v) { return v.toNumber(); });
      });
    }

    /** Flat list of entries, row by row. */
    flat() {
      const out = [];
      for (let i = 0; i < this.rows; i++) for (let j = 0; j < this.cols; j++) out.push(this.data[i][j]);
      return out;
    }

    rowAt(i) {
      if (i < 0 || i >= this.rows) throw new MLError('There is no row ' + (i + 1) + ' in a ' + this.size() + ' matrix.');
      return this.data[i].slice();
    }

    colAt(j) {
      if (j < 0 || j >= this.cols) throw new MLError('There is no column ' + (j + 1) + ' in a ' + this.size() + ' matrix.');
      const out = new Array(this.rows);
      for (let i = 0; i < this.rows; i++) out[i] = this.data[i][j];
      return out;
    }

    /** Columns as arrays of Frac. */
    columns() {
      const out = [];
      for (let j = 0; j < this.cols; j++) out.push(this.colAt(j));
      return out;
    }

    /* --------------------------- derived info ------------------------- */

    size() {
      return this.rows + '×' + this.cols;
    }

    isSquare() {
      return this.rows === this.cols;
    }

    isRowVector() {
      return this.rows === 1;
    }

    isColumnVector() {
      return this.cols === 1;
    }

    /** True when every entry is a whole number. */
    isIntegral() {
      return this.data.every(function (row) {
        return row.every(function (v) { return v.isInteger(); });
      });
    }

    /* -------------------------- transformation ------------------------ */

    clone() {
      return new Matrix(cloneGrid(this.data));
    }

    /** @param {(value: Frac, i: number, j: number) => *} fn */
    map(fn) {
      const self = this;
      return Matrix.from(
        this.data.map(function (row, i) {
          return row.map(function (v, j) { return fn(v, i, j, self); });
        })
      );
    }

    /** Copy with one entry replaced. */
    withEntry(i, j, value) {
      this.get(i, j); // bounds check
      const data = cloneGrid(this.data);
      data[i][j] = Frac.of(value);
      return new Matrix(data);
    }

    /** Copy with one row replaced. */
    withRow(i, values) {
      if (values.length !== this.cols) {
        throw new MLError('A replacement row must have ' + this.cols + ' entries.');
      }
      const data = cloneGrid(this.data);
      data[i] = values.map(Frac.of);
      return new Matrix(data);
    }

    /** Sub-block [r0, r1) × [c0, c1). */
    slice(r0, r1, c0, c1) {
      const data = [];
      for (let i = r0; i < r1; i++) {
        const row = [];
        for (let j = c0; j < c1; j++) row.push(this.get(i, j));
        data.push(row);
      }
      if (!data.length || !data[0].length) throw new MLError('The requested sub-matrix is empty.');
      return new Matrix(data);
    }

    equals(other) {
      if (!(other instanceof Matrix)) return false;
      if (this.rows !== other.rows || this.cols !== other.cols) return false;
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          if (!this.data[i][j].eq(other.data[i][j])) return false;
        }
      }
      return true;
    }

    /** Plain-text rendering, mainly for tests and debugging. */
    toString() {
      const self = this;
      return this.data
        .map(function (row, i) {
          return '[ ' + row.map(function (v) { return v.toString(); }).join('  ') + ' ]' + (i < self.rows - 1 ? '\n' : '');
        })
        .join('');
    }

    toJSON() {
      return this.data.map(function (row) { return row.map(String); });
    }
  }

  function requireSize(r, c) {
    const rows = r;
    const cols = c === undefined ? r : c;
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
      throw new MLError('Matrix dimensions must be whole numbers of at least 1.');
    }
  }

  /* -------------------------------------------------------------------- *
   * Matrix generators (used by the Generator tool)
   * -------------------------------------------------------------------- */

  function randomInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  ML.generate = {
    zero: function (r, c) { return Matrix.zeros(r, c); },
    identity: function (n) { return Matrix.identity(n); },

    random: function (r, c, options) {
      const opts = options || {};
      const min = opts.min == null ? -9 : opts.min;
      const max = opts.max == null ? 9 : opts.max;
      if (min > max) throw new MLError('The minimum value must not be greater than the maximum.');
      const data = grid(r, c, Frac.ZERO);
      for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) data[i][j] = new Frac(BigInt(randomInt(min, max)));
      return new Matrix(data);
    },

    diagonal: function (n, options) {
      const opts = options || {};
      const values = [];
      for (let i = 0; i < n; i++) values.push(randomInt(opts.min == null ? 1 : opts.min, opts.max == null ? 9 : opts.max));
      return Matrix.diagonal(values);
    },

    symmetric: function (n, options) {
      const opts = options || {};
      const min = opts.min == null ? -9 : opts.min;
      const max = opts.max == null ? 9 : opts.max;
      const data = grid(n, n, Frac.ZERO);
      for (let i = 0; i < n; i++) {
        for (let j = i; j < n; j++) {
          const v = new Frac(BigInt(randomInt(min, max)));
          data[i][j] = v;
          data[j][i] = v;
        }
      }
      return new Matrix(data);
    },

    upperTriangular: function (n, options) {
      const opts = options || {};
      const min = opts.min == null ? -9 : opts.min;
      const max = opts.max == null ? 9 : opts.max;
      const data = grid(n, n, Frac.ZERO);
      for (let i = 0; i < n; i++) {
        for (let j = i; j < n; j++) data[i][j] = new Frac(BigInt(randomInt(min, max)));
      }
      return new Matrix(data);
    },

    lowerTriangular: function (n, options) {
      return ML.operations.transposeMatrix(ML.generate.upperTriangular(n, options));
    },

    /** Mostly zeros — `density` is the chance an entry is non-zero. */
    sparse: function (r, c, options) {
      const opts = options || {};
      const density = opts.density == null ? 0.25 : opts.density;
      const min = opts.min == null ? -9 : opts.min;
      const max = opts.max == null ? 9 : opts.max;
      const data = grid(r, c, Frac.ZERO);
      for (let i = 0; i < r; i++) {
        for (let j = 0; j < c; j++) {
          if (Math.random() < density) {
            let v = randomInt(min, max);
            if (v === 0) v = 1;
            data[i][j] = new Frac(BigInt(v));
          }
        }
      }
      return new Matrix(data);
    },

    /** Random matrix guaranteed to be invertible (unit-triangular product). */
    invertible: function (n, options) {
      const opts = options || {};
      const bound = opts.bound == null ? 3 : opts.bound;
      const L = grid(n, n, Frac.ZERO);
      const U = grid(n, n, Frac.ZERO);
      for (let i = 0; i < n; i++) {
        L[i][i] = Frac.ONE;
        U[i][i] = Frac.ONE;
        for (let j = 0; j < i; j++) L[i][j] = new Frac(BigInt(randomInt(-bound, bound)));
        for (let j = i + 1; j < n; j++) U[i][j] = new Frac(BigInt(randomInt(-bound, bound)));
      }
      return ML.operations.multiplyMatrices(new Matrix(L), new Matrix(U));
    },
  };

  ML.Matrix = Matrix;
  ML.grid = grid;
  ML.cloneGrid = cloneGrid;
})((globalThis.ML = globalThis.ML || {}));
