/**
 * MatrixLab — Row Reduction.
 *
 * Three ways to work: drive the elementary row operations yourself with undo
 * and redo, ask for the next sensible step, or watch the whole elimination run
 * with commentary. The "suggest" button computes its advice from the current
 * state, so it stays useful no matter what detour you took.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;

  /**
   * Interactive session, kept outside build() so re-rendering the view (for
   * example after changing the decimal setting) does not throw away history.
   */
  const session = {
    key: null,
    states: [],
    ops: [],
    index: 0,
  };

  function sessionKey(matrix) {
    return matrix.toJSON().map(function (row) { return row.join(','); }).join(';');
  }

  function startSession(matrix) {
    session.key = sessionKey(matrix);
    session.states = [matrix];
    session.ops = [];
    session.index = 0;
  }

  function ensureSession(matrix) {
    if (session.key !== sessionKey(matrix) || !session.states.length) startSession(matrix);
  }

  function current() {
    return session.states[session.index];
  }

  function apply(op) {
    const next = ML.applyOperation(current(), op);
    session.states = session.states.slice(0, session.index + 1).concat([next]);
    session.ops = session.ops.slice(0, session.index).concat([op]);
    session.index = session.states.length - 1;
    return next;
  }

  function buildView() {
    const input = ML.store.bind(
      'A',
      new ui.MatrixInput({
        name: 'A',
        rows: 3,
        cols: 4,
        values: ML.store.getValuesOrDefault('A', [['1', '3', '1', '9'], ['1', '1', '-1', '1'], ['3', '11', '5', '35']]),
        hint: 'Any shape works. An augmented system such as [A | b] is a good thing to practise on.',
        onChange: function (self) {
          const got = self.tryGetMatrix();
          if (got.ok) ensureSession(got.matrix);
        },
      })
    );

    const tabs = ui.tabs(
      [
        { id: 'manual', label: 'Do it yourself', build: function () { return buildManual(input); } },
        { id: 'ref', label: 'Row echelon form', build: function () { return buildAuto(input, false); } },
        { id: 'rref', label: 'Reduced row echelon form', build: function () { return buildAuto(input, true); } },
      ],
      { rebuild: true }
    );

    return [
      ui.card({ title: 'The matrix to reduce', body: input.element }),
      tabs,
    ];
  }

  /* ------------------------------------------------------------------ *
   * Manual mode
   * ------------------------------------------------------------------ */

  function buildManual(input) {
    const got = input.tryGetMatrix();
    if (!got.ok) return ui.errorPanel(got.error);
    ensureSession(got.matrix);

    const host = el('div.stack');

    function refresh() {
      ui.safeRender(host, function () { return buildManualBody(refresh); });
    }
    refresh();
    return host;
  }

  function buildManualBody(refresh) {
    const matrix = current();
    const rows = matrix.rows;
    const record = ML.eliminate(matrix, { full: true });
    const suggestion = suggestNext(matrix);

    const controlState = {
      type: 'add',
      i: 0,
      j: rows > 1 ? 1 : 0,
      k: '1',
    };

    const rowOptions = [];
    for (let i = 0; i < rows; i++) rowOptions.push({ value: String(i), label: 'R' + (i + 1) });

    const preview = el('div.formula');
    const scalarField = ui.numberInput({
      value: controlState.k,
      ariaLabel: 'Multiplier k',
      onInput: function (value) {
        controlState.k = value;
        updatePreview();
      },
    });
    const firstSelect = ui.select({
      options: rowOptions,
      value: String(controlState.i),
      ariaLabel: 'First row',
      onChange: function (value) {
        controlState.i = Number(value);
        updatePreview();
      },
    });
    const secondSelect = ui.select({
      options: rowOptions,
      value: String(controlState.j),
      ariaLabel: 'Second row',
      onChange: function (value) {
        controlState.j = Number(value);
        updatePreview();
      },
    });

    function buildOp() {
      if (controlState.type === 'swap') return { type: 'swap', i: controlState.i, j: controlState.j };
      const k = ML.Frac.parse(controlState.k);
      if (controlState.type === 'scale') return { type: 'scale', i: controlState.i, k: k };
      return { type: 'add', target: controlState.i, source: controlState.j, k: k };
    }

    function updatePreview() {
      ui.clear(preview);
      try {
        preview.appendChild(document.createTextNode(ML.describeOperation(buildOp())));
        preview.style.color = '';
      } catch (error) {
        preview.appendChild(document.createTextNode(error.message));
        preview.style.color = 'var(--err-fg)';
      }
      secondSelect.style.display = controlState.type === 'scale' ? 'none' : '';
      scalarField.style.display = controlState.type === 'swap' ? 'none' : '';
    }

    const typePicker = ui.segmented({
      label: 'Operation',
      value: controlState.type,
      options: [
        { value: 'swap', label: 'Rᵢ ↔ Rⱼ', title: 'Swap two rows' },
        { value: 'scale', label: 'Rᵢ → kRᵢ', title: 'Multiply a row by a non-zero number' },
        { value: 'add', label: 'Rᵢ → Rᵢ + kRⱼ', title: 'Add a multiple of another row' },
      ],
      onChange: function (value) {
        controlState.type = value;
        updatePreview();
      },
    });

    const applyButton = ui.button('Apply', {
      variant: 'primary',
      onClick: function () {
        try {
          apply(buildOp());
          ui.announce('Applied ' + ML.describeOperation(session.ops[session.index - 1]));
          refresh();
        } catch (error) {
          ui.clear(preview);
          preview.appendChild(document.createTextNode(error.message));
          preview.style.color = 'var(--err-fg)';
        }
      },
    });

    updatePreview();

    const history = session.ops.length
      ? el(
          'ol.step__list',
          session.ops.map(function (op, index) {
            return el('li', {
              style: index >= session.index ? { opacity: '0.45' } : null,
            }, (index + 1) + '.  ' + ML.describeOperation(op) + (index >= session.index ? '   (undone)' : ''));
          })
        )
      : el('p.small.muted', 'No operations applied yet.');

    const status = record.rank === Math.min(matrix.rows, matrix.cols) && isRREF(matrix)
      ? ui.alert('ok', 'This matrix is now in reduced row echelon form. Rank = ' + record.rank + '.')
      : isEchelon(matrix)
      ? ui.alert('info', 'This is in row echelon form (a staircase of pivots). Clearing above the pivots and scaling them to 1 would make it reduced.')
      : null;

    return [
      ui.card({
        title: 'Current matrix',
        subtitle: 'Step ' + session.index + ' of ' + (session.states.length - 1),
        actions: [
          ui.button('Undo', {
            size: 'sm',
            disabled: session.index === 0,
            onClick: function () {
              if (session.index > 0) session.index--;
              refresh();
            },
          }),
          ui.button('Redo', {
            size: 'sm',
            disabled: session.index >= session.states.length - 1,
            onClick: function () {
              if (session.index < session.states.length - 1) session.index++;
              refresh();
            },
          }),
          ui.button('Reset', {
            size: 'sm',
            variant: 'ghost',
            onClick: function () {
              startSession(session.states[0]);
              refresh();
            },
          }),
        ],
        body: el('div.stack', [
          el('div.row.row--top', [
            ui.renderMatrix(matrix, { label: 'current', highlight: { pivots: record.pivots.length ? pivotsOf(matrix) : [] } }),
            session.index > 0
              ? el('div.small.muted', [
                  el('div', 'Started from:'),
                  ui.renderMatrix(session.states[0], { compact: true }),
                ])
              : null,
          ]),
          status,
          el('div.row.row--tight', [
            ui.badge('rank ' + record.rank, 'brand'),
            matrix.isSquare() ? ui.badge('det ' + ML.fmt(ML.determinant(matrix))) : null,
          ]),
        ]),
      }),

      ui.card({
        title: 'Apply an elementary row operation',
        subtitle: 'The three moves that never change the solution set',
        body: el('div.stack', [
          typePicker,
          el('div.row', [
            el('div.field.field--inline', [el('span.label', 'Row'), firstSelect]),
            el('div.field.field--inline', [el('span.label', 'and'), secondSelect]),
            el('div.field.field--inline', [el('span.label', 'k ='), scalarField]),
            applyButton,
          ]),
          preview,
          el('p.small.muted', [
            'Swapping rows reorders the equations. Scaling a row by a non-zero number rescales one equation. ' +
              'Adding a multiple of one row to another replaces an equation by a combination — all three are ' +
              'reversible, which is exactly why the solutions are untouched.',
          ]),
        ]),
      }),

      ui.card({
        title: 'Need a hint?',
        body: el('div.stack', [
          suggestion
            ? el('div.stack-sm', [
                el('p.small', [
                  'Working towards the reduced row echelon form, the next step would be ',
                  el('strong', ML.describeOperation(suggestion)),
                  '. ' + suggestionReason(matrix, suggestion),
                ]),
                el('div.row.row--tight', [
                  ui.button('Apply this step', {
                    onClick: function () {
                      apply(suggestion);
                      refresh();
                    },
                  }),
                  ui.button('Full reduction', {
                    variant: 'ghost',
                    title: 'Apply every remaining step at once',
                    onClick: function () {
                      let guard = 0;
                      let next = suggestNext(current());
                      while (next && guard++ < 200) {
                        apply(next);
                        next = suggestNext(current());
                      }
                      refresh();
                    },
                  }),
                ]),
              ])
            : ui.alert('ok', 'Nothing left to do — this matrix is already in reduced row echelon form.'),
        ]),
      }),

      ui.card({ title: 'Operations so far', body: history }),
    ];
  }

  /** The first operation a full Gauss–Jordan run would perform from here. */
  function suggestNext(matrix) {
    const record = ML.eliminate(matrix, { full: true });
    return record.operations.length ? record.operations[0] : null;
  }

  function suggestionReason(matrix, op) {
    if (op.type === 'swap') return 'A pivot position holds a zero, so a row with a non-zero entry is moved up.';
    if (op.type === 'scale') return 'Dividing by the pivot turns the leading entry into 1.';
    return 'This clears the entry in the pivot’s column so only the pivot remains.';
  }

  function pivotsOf(matrix) {
    const pivots = [];
    let row = 0;
    for (let col = 0; col < matrix.cols && row < matrix.rows; col++) {
      let found = -1;
      for (let i = row; i < matrix.rows; i++) {
        if (!matrix.get(i, col).isZero()) {
          found = i;
          break;
        }
      }
      if (found === row) {
        pivots.push([row, col]);
        row++;
      }
    }
    return pivots;
  }

  function leadingIndex(row) {
    for (let j = 0; j < row.length; j++) if (!row[j].isZero()) return j;
    return Infinity;
  }

  function isEchelon(matrix) {
    let previous = -1;
    for (let i = 0; i < matrix.rows; i++) {
      const index = leadingIndex(matrix.data[i]);
      if (index === Infinity) {
        for (let k = i + 1; k < matrix.rows; k++) if (leadingIndex(matrix.data[k]) !== Infinity) return false;
        return true;
      }
      if (index <= previous) return false;
      previous = index;
    }
    return true;
  }

  function isRREF(matrix) {
    if (!isEchelon(matrix)) return false;
    for (let i = 0; i < matrix.rows; i++) {
      const index = leadingIndex(matrix.data[i]);
      if (index === Infinity) continue;
      if (!matrix.data[i][index].isOne()) return false;
      for (let r = 0; r < matrix.rows; r++) {
        if (r !== i && !matrix.data[r][index].isZero()) return false;
      }
    }
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Automatic mode
   * ------------------------------------------------------------------ */

  function buildAuto(input, full) {
    const got = input.tryGetMatrix();
    if (!got.ok) return ui.errorPanel(got.error);
    const A = got.matrix;

    const options = { leadingOnes: ML.store.getSetting('reduce.leadingOnes', false) };
    const steps = new ML.StepLog(full ? 'Gauss–Jordan elimination' : 'Gaussian elimination');
    const result = full ? ML.rref(A, steps) : ML.ref(A, steps, options);
    const record = ML.eliminate(A, { full: full, normalize: full || options.leadingOnes });

    const leadingOnesToggle = !full
      ? el('label.checkbox', [
          el('input', {
            type: 'checkbox',
            checked: options.leadingOnes,
            onChange: function (event) {
              ML.store.setSetting('reduce.leadingOnes', event.target.checked);
              ML.router.render();
            },
          }),
          'Scale each pivot to 1',
        ])
      : null;

    return ui.resultBlock({
      formula: full ? 'rref(A) — pivots are 1, and every other entry in a pivot column is 0' : 'ref(A) — a staircase of pivots with zeros below',
      result: el('div.stack', [
        el('div.scroll-x', [
          ui.renderExpression([
            { matrix: A, label: 'A' },
            '→',
            { matrix: result, label: full ? 'rref(A)' : 'ref(A)', highlight: { pivots: record.pivots } },
          ]),
        ]),
        el('div.row.row--tight', [
          ui.badge('rank ' + record.rank, 'brand'),
          ui.badge(record.pivots.length + ' pivot' + (record.pivots.length === 1 ? '' : 's')),
          ui.badge(record.freeColumns.length + ' free column' + (record.freeColumns.length === 1 ? '' : 's')),
          ui.copyButton(function () { return ui.matrixToText(result); }, 'Copy'),
        ]),
        leadingOnesToggle,
        el('p.small.muted', [
          full
            ? 'The reduced row echelon form is unique: every route through the row operations arrives at the same ' +
              'matrix. That is what makes it safe to read answers straight off it.'
            : 'Row echelon form is not unique — different choices of pivot give different (equally valid) staircases. ' +
              'Continuing to the reduced form removes that ambiguity.',
        ]),
      ]),
      steps: steps,
      explanation: [
        el('h3', full ? 'What Gauss–Jordan elimination does' : 'What Gaussian elimination does'),
        el('p', [
          'Elimination is the workhorse of linear algebra. Using only the three reversible row operations, it drives a ' +
            'matrix into a shape where the answers can be read off. Because the operations are reversible, the reduced ' +
            'matrix has exactly the same solution set as the original.',
        ]),
        el('p', [
          'Row echelon form means: all-zero rows sit at the bottom, and each leading (pivot) entry is strictly to the ' +
            'right of the one above it — a staircase. This is enough to solve a system by back-substitution.',
        ]),
        el('p', [
          'The reduced form goes further: every pivot is 1 and is the only non-zero entry in its column. Now no ' +
            'substitution is needed at all; each row states the value of one variable.',
        ]),
        el('div.callout', [
          el('div.callout__title', 'Why the pivots matter'),
          el('p', [
            'The number of pivots is the rank. Columns with a pivot correspond to variables that are determined; ' +
              'columns without one correspond to free variables you may choose. That single observation answers ' +
              '"how many solutions does this system have?"',
          ]),
        ]),
      ],
    });
  }

  ML.registerView({
    id: 'row-reduction',
    title: 'Row Reduction',
    tagline: 'Elementary row operations by hand with undo and redo, or the full elimination with commentary.',
    icon: '⇅',
    build: buildView,
  });
})((globalThis.ML = globalThis.ML || {}));
