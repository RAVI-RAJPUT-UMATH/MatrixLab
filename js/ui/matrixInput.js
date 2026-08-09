/**
 * MatrixLab — matrix input engine.
 *
 * A resizable, keyboard-friendly grid of entries that produces an exact
 * Matrix. Accepts integers, decimals and fractions ("3/4"), reports a bad
 * entry by naming its row and column, and never silently substitutes a value
 * it could not read.
 *
 * Keyboard: ↑/↓ move between rows, ←/→ move between columns when the caret is
 * at the edge of the text, Enter moves down, Shift+Enter moves up.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;
  const Frac = ML.Frac;
  const Matrix = ML.Matrix;

  /** Values a user is halfway through typing — not yet an error. */
  const PENDING = /^[+-]?$|^[+-]?\.$|^[+-]?\d*\.?\d*\/$|^[+-]?\d*\.?\d*[eE][+-]?$/;

  class MatrixInput {
    /**
     * @param {object} [options]
     * @param {string} [options.name='A']        Display name.
     * @param {number} [options.rows=2]
     * @param {number} [options.cols=2]
     * @param {number} [options.min=1]
     * @param {number} [options.max=ML.MAX_DIM]
     * @param {boolean} [options.square=false]   Lock rows === cols.
     * @param {boolean} [options.allowResize=true]
     * @param {boolean} [options.showTools=true]
     * @param {string} [options.hint]
     * @param {Array<Array<*>>} [options.values] Initial contents.
     * @param {(input: MatrixInput) => void} [options.onChange]
     * @param {string} [options.colLabel]        e.g. 'variable' for systems.
     */
    constructor(options) {
      const opts = options || {};
      this.name = opts.name || 'A';
      this.min = opts.min == null ? 1 : opts.min;
      this.max = opts.max == null ? ML.MAX_DIM : opts.max;
      this.square = !!opts.square;
      this.fixedRows = !!opts.fixedRows;
      this.fixedCols = !!opts.fixedCols;
      this.allowResize = opts.allowResize !== false;
      this.showTools = opts.showTools !== false;
      this.hint = opts.hint;
      this.onChange = opts.onChange || null;
      this.extraTools = opts.extraTools || [];

      this.rows = clamp(opts.rows == null ? 2 : opts.rows, this.min, this.max);
      this.cols = clamp(opts.cols == null ? this.rows : opts.cols, this.min, this.max);
      if (this.square) this.cols = this.rows;

      /** @type {string[][]} */
      this.values = makeValues(this.rows, this.cols, opts.values);
      /** @type {HTMLInputElement[][]} */
      this.cells = [];

      this._notify = ui.debounce(
        () => { if (this.onChange) this.onChange(this); },
        opts.debounce == null ? 180 : opts.debounce
      );

      this.element = this._build();
      this._renderGrid();
    }

    /* ------------------------------- build ------------------------------ */

    _build() {
      this.dimsLabel = el('span.minput__dims', { text: this._dimsText() });
      this.gridNode = el('div.minput__grid');
      this.errorNode = el('div.minput__hint.small', { role: 'status', 'aria-live': 'polite' });

      const head = el('div.minput__head', [
        el('span.minput__name', this.name),
        this.dimsLabel,
        this.allowResize ? this._buildSizing() : null,
      ]);

      const body = el('div.minput__body', [
        el('div.minput__brackets', [
          el('span.matrix__br.matrix__br--l'),
          this.gridNode,
          el('span.matrix__br.matrix__br--r'),
        ]),
      ]);

      return el('div.minput', [
        head,
        body,
        this.hint ? el('div.minput__hint.small', this.hint) : null,
        this.errorNode,
        this.showTools ? this._buildTools() : null,
      ]);
    }

    _buildSizing() {
      const self = this;
      this.rowStepper = ui.stepper({
        label: this.name + ' rows',
        value: this.rows,
        min: this.min,
        max: this.max,
        onChange: function (value) { self.setSize(value, self.square ? value : self.cols); },
      });
      this.colStepper = ui.stepper({
        label: this.name + ' columns',
        value: this.cols,
        min: this.min,
        max: this.max,
        onChange: function (value) { self.setSize(self.square ? value : self.rows, value); },
      });
      return el('div.minput__sizing', [
        el('span', 'rows'),
        this.fixedRows ? el('span.badge', String(this.rows)) : this.rowStepper,
        el('span', '×'),
        el('span.sr-only', 'columns'),
        this.square
          ? el('span.badge', 'square')
          : this.fixedCols
          ? el('span.badge', String(this.cols))
          : this.colStepper,
      ]);
    }

    _buildTools() {
      const self = this;
      const tools = [
        ui.button('Clear', { size: 'sm', variant: 'ghost', onClick: function () { self.fill(''); } }),
        ui.button('Zeros', { size: 'sm', variant: 'ghost', onClick: function () { self.fill('0'); } }),
        ui.button('Identity', {
          size: 'sm',
          variant: 'ghost',
          title: 'Fill with 1 on the diagonal and 0 elsewhere',
          onClick: function () {
            self.setValues(
              self.values.map(function (row, i) {
                return row.map(function (_, j) { return i === j ? '1' : '0'; });
              })
            );
          },
        }),
        ui.button('Random', {
          size: 'sm',
          variant: 'ghost',
          title: 'Random whole numbers from −9 to 9',
          onClick: function () {
            self.setValues(
              self.values.map(function (row) {
                return row.map(function () { return String(Math.floor(Math.random() * 19) - 9); });
              })
            );
          },
        }),
        // Transposing would violate a locked dimension, so it is offered only
        // when both dimensions are free to change.
        this.fixedRows || this.fixedCols ? null : ui.button('Transpose', {
          size: 'sm',
          variant: 'ghost',
          title: 'Flip rows and columns',
          onClick: function () {
            const flipped = [];
            for (let j = 0; j < self.cols; j++) {
              const row = [];
              for (let i = 0; i < self.rows; i++) row.push(self.values[i][j]);
              flipped.push(row);
            }
            self.rows = flipped.length;
            self.cols = flipped[0].length;
            self.values = flipped;
            self._syncSteppers();
            self._renderGrid();
            self._changed();
          },
        }),
      ];
      this.extraTools.forEach(function (tool) { tools.push(tool); });
      tools.push(
        ui.disclosure(
          'Type or paste',
          function () {
            const area = el('textarea.input', {
              rows: 4,
              spellcheck: 'false',
              'aria-label': 'Matrix ' + self.name + ' as text',
              placeholder: '1 2 3\n4 5 6\n\nRows on separate lines (or separated by ;), entries separated by spaces or commas.',
              value: self.toText(),
            });
            const status = el('div.small.muted');
            return el('div.stack-sm', [
              area,
              el('div.row.row--tight', [
                ui.button('Apply', {
                  variant: 'primary',
                  size: 'sm',
                  onClick: function () {
                    try {
                      self.fromText(area.value);
                      status.className = 'small ok';
                      status.textContent = 'Applied — the grid above now holds ' + self.rows + '×' + self.cols + '.';
                    } catch (error) {
                      status.className = 'small';
                      status.style.color = 'var(--err-fg)';
                      status.textContent = error.message;
                    }
                  },
                }),
                ui.copyButton(function () { return self.toText(); }, 'Copy'),
              ]),
              status,
            ]);
          },
          {}
        )
      );
      return el('div.minput__tools', tools);
    }

    _dimsText() {
      return this.rows + ' × ' + this.cols;
    }

    _syncSteppers() {
      if (this.rowStepper) this.rowStepper.mlSet(this.rows);
      if (this.colStepper) this.colStepper.mlSet(this.cols);
      if (this.dimsLabel) this.dimsLabel.textContent = this._dimsText();
    }

    /* ------------------------------- grid ------------------------------- */

    _renderGrid() {
      const self = this;
      ui.clear(this.gridNode);
      this.gridNode.style.gridTemplateColumns = 'repeat(' + this.cols + ', auto)';
      this.cells = [];

      for (let i = 0; i < this.rows; i++) {
        const rowCells = [];
        for (let j = 0; j < this.cols; j++) {
          const cell = el('input.cell-input', {
            type: 'text',
            inputmode: 'text',
            autocomplete: 'off',
            spellcheck: 'false',
            value: this.values[i][j],
            'aria-label': this.name + ' row ' + (i + 1) + ', column ' + (j + 1),
            dataset: { row: i, col: j },
            onInput: function (event) { self._onInput(event.target); },
            onFocus: function (event) { event.target.select(); },
            onBlur: function (event) { self._validateCell(event.target, true); },
            onKeydown: function (event) { self._onKeydown(event); },
          });
          rowCells.push(cell);
          this.gridNode.appendChild(cell);
        }
        this.cells.push(rowCells);
      }
      if (this.dimsLabel) this.dimsLabel.textContent = this._dimsText();
    }

    _onInput(cell) {
      const i = Number(cell.dataset.row);
      const j = Number(cell.dataset.col);
      this.values[i][j] = cell.value;
      this._validateCell(cell, false);
      this._changed();
    }

    _validateCell(cell, strict) {
      const text = cell.value.trim();
      let bad = false;
      if (text === '') {
        bad = strict;
      } else if (!PENDING.test(text)) {
        try {
          Frac.parse(text);
        } catch (error) {
          bad = true;
        }
      }
      cell.classList.toggle('is-invalid', bad);
      if (bad) cell.setAttribute('aria-invalid', 'true');
      else cell.removeAttribute('aria-invalid');
      this._refreshError();
      return !bad;
    }

    _refreshError() {
      const invalid = this.element.querySelectorAll('.cell-input.is-invalid').length;
      if (invalid) {
        this.errorNode.textContent =
          invalid === 1
            ? 'One entry cannot be read. Use a number like 7, −2.5 or 3/4.'
            : invalid + ' entries cannot be read. Use numbers like 7, −2.5 or 3/4.';
        this.errorNode.style.color = 'var(--err-fg)';
      } else {
        this.errorNode.textContent = '';
      }
    }

    _onKeydown(event) {
      const cell = event.target;
      const i = Number(cell.dataset.row);
      const j = Number(cell.dataset.col);
      const atStart = cell.selectionStart === 0 && cell.selectionEnd === 0;
      const atEnd = cell.selectionStart === cell.value.length && cell.selectionEnd === cell.value.length;
      let target = null;

      switch (event.key) {
        case 'ArrowUp':
          target = [i - 1, j];
          break;
        case 'ArrowDown':
          target = [i + 1, j];
          break;
        case 'ArrowLeft':
          if (atStart) target = [i, j - 1];
          break;
        case 'ArrowRight':
          if (atEnd) target = [i, j + 1];
          break;
        case 'Enter':
          target = event.shiftKey ? [i - 1, j] : [i + 1, j];
          if (target[0] < 0 || target[0] >= this.rows) {
            // Wrap to the next/previous column so Enter walks the whole grid.
            target = event.shiftKey ? [this.rows - 1, j - 1] : [0, j + 1];
          }
          break;
        default:
          return;
      }
      if (!target) return;
      const moved = this.focusCell(target[0], target[1]);
      if (moved) event.preventDefault();
    }

    /* ------------------------------- public ----------------------------- */

    /** Move focus to a cell; returns false when the position does not exist. */
    focusCell(i, j) {
      if (i < 0 || j < 0 || i >= this.rows || j >= this.cols) return false;
      const cell = this.cells[i][j];
      cell.focus();
      cell.select();
      return true;
    }

    setSize(rows, cols) {
      const nextRows = clamp(rows, this.min, this.max);
      const nextCols = clamp(this.square ? nextRows : cols, this.min, this.max);
      if (nextRows === this.rows && nextCols === this.cols) return;
      const old = this.values;
      this.values = makeValues(nextRows, nextCols, null);
      for (let i = 0; i < Math.min(nextRows, old.length); i++) {
        for (let j = 0; j < Math.min(nextCols, old[i].length); j++) this.values[i][j] = old[i][j];
      }
      this.rows = nextRows;
      this.cols = nextCols;
      this._syncSteppers();
      this._renderGrid();
      ui.announce(this.name + ' is now ' + this.rows + ' by ' + this.cols);
      this._changed();
    }

    /** Replace all displayed values (strings). Resizes if the shape differs. */
    setValues(values) {
      const rows = values.length;
      const cols = values[0].length;
      this.rows = clamp(rows, this.min, this.max);
      this.cols = clamp(this.square ? this.rows : cols, this.min, this.max);
      this.values = makeValues(this.rows, this.cols, values);
      this._syncSteppers();
      this._renderGrid();
      this._changed();
    }

    /** Load a Matrix into the grid. */
    setMatrix(matrix) {
      this.setValues(
        matrix.data.map(function (row) {
          return row.map(function (value) { return value.toString(); });
        })
      );
    }

    fill(text) {
      this.setValues(
        this.values.map(function (row) {
          return row.map(function () { return text; });
        })
      );
    }

    /**
     * Build the exact Matrix. Throws MLError naming the offending cell.
     * @returns {ML.Matrix}
     */
    getMatrix() {
      const data = [];
      for (let i = 0; i < this.rows; i++) {
        const row = [];
        for (let j = 0; j < this.cols; j++) {
          const raw = this.cells[i][j] ? this.cells[i][j].value : this.values[i][j];
          const text = String(raw).trim();
          if (text === '') {
            this._markBad(i, j);
            throw new ML.MLError(
              'Matrix ' + this.name + ' has an empty entry at row ' + (i + 1) + ', column ' + (j + 1) + '. ' +
                'Every position needs a number — use 0 if you mean zero.',
              { row: i, col: j, hint: 'Tip: the “Zeros” button fills the whole grid with 0.' }
            );
          }
          try {
            row.push(Frac.parse(text));
          } catch (error) {
            this._markBad(i, j);
            throw new ML.MLError(
              'Matrix ' + this.name + ', row ' + (i + 1) + ', column ' + (j + 1) + ': ' + error.message,
              { row: i, col: j }
            );
          }
        }
        data.push(row);
      }
      return Matrix.fromGrid(data);
    }

    /** Non-throwing variant. @returns {{ok:boolean, matrix?:ML.Matrix, error?:Error}} */
    tryGetMatrix() {
      try {
        return { ok: true, matrix: this.getMatrix() };
      } catch (error) {
        return { ok: false, error: error };
      }
    }

    _markBad(i, j) {
      const cell = this.cells[i] && this.cells[i][j];
      if (!cell) return;
      cell.classList.add('is-invalid');
      cell.setAttribute('aria-invalid', 'true');
      this._refreshError();
      cell.focus();
    }

    /** Tab-separated text form, one row per line. */
    toText() {
      return this.values
        .map(function (row) {
          return row.map(function (v) { return v === '' ? '0' : v; }).join('  ');
        })
        .join('\n');
    }

    /** Parse a pasted block of text into the grid. */
    fromText(text) {
      const lines = String(text)
        .split(/[\n;]+/)
        .map(function (line) { return line.trim(); })
        .filter(function (line) { return line.length > 0; });
      if (!lines.length) throw new ML.MLError('There is nothing to read. Type at least one row of numbers.');
      const rows = lines.map(function (line) {
        return line.split(/[\s,]+/).filter(function (t) { return t.length > 0; });
      });
      const width = rows[0].length;
      rows.forEach(function (row, index) {
        if (row.length !== width) {
          throw new ML.MLError(
            'Row 1 has ' + width + ' entries but row ' + (index + 1) + ' has ' + row.length + '. ' +
              'Every row needs the same number of entries.'
          );
        }
      });
      // Validate before committing so a typo cannot half-load the grid.
      rows.forEach(function (row, i) {
        row.forEach(function (cellText, j) {
          try {
            Frac.parse(cellText);
          } catch (error) {
            throw new ML.MLError('Row ' + (i + 1) + ', column ' + (j + 1) + ': ' + error.message);
          }
        });
      });
      if (rows.length > this.max || width > this.max) {
        throw new ML.MLError('MatrixLab works with matrices up to ' + this.max + '×' + this.max + ' in this tool.');
      }
      this.setValues(rows);
    }

    _changed() {
      if (this.onChange) this._notify();
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Math.round(Number(value) || min)));
  }

  function makeValues(rows, cols, source) {
    const out = [];
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        let value = '0';
        if (source && source[i] != null && source[i][j] != null) value = String(source[i][j]);
        row.push(value);
      }
      out.push(row);
    }
    return out;
  }

  ML.ui.MatrixInput = MatrixInput;

  /**
   * Convenience: a labelled vector input (single row of entries).
   * Returns a MatrixInput restricted to one row or one column.
   */
  ML.ui.vectorInput = function (options) {
    const opts = Object.assign({ orientation: 'column' }, options || {});
    const size = opts.size == null ? 3 : opts.size;
    const isRow = opts.orientation === 'row';
    return new MatrixInput(
      Object.assign({}, opts, {
        rows: isRow ? 1 : size,
        cols: isRow ? size : 1,
        fixedRows: isRow,
        fixedCols: !isRow,
        min: 1,
        max: opts.max == null ? ML.MAX_DIM : opts.max,
        allowResize: opts.allowResize !== false,
      })
    );
  };
})((globalThis.ML = globalThis.ML || {}));
