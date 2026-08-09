/**
 * MatrixLab — mathematical result renderer.
 *
 * Turns Matrix / Frac / Complex values into proper typeset HTML: real brackets,
 * stacked fractions, aligned columns. A user should never see [[1,2],[3,4]].
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;
  const Frac = ML.Frac;

  /**
   * Render a single value (Frac, number, Complex, string) as an inline node.
   * Fractions become a real stacked fraction rather than "1/3".
   */
  function renderValue(value, options) {
    const opts = options || {};
    const parts = ML.formatParts(value, opts);
    if (parts.kind === 'fraction' && !opts.plain) {
      return el('span.frac', { 'aria-label': (parts.negative ? 'negative ' : '') + parts.num + ' over ' + parts.den }, [
        parts.negative ? el('span.frac__sign', '−') : null,
        el('span.frac__stack', [el('span.frac__n', parts.num), el('span.frac__d', parts.den)]),
      ]);
    }
    return el('span.value', { text: parts.text, className: opts.className || '' });
  }

  /** Plain string version of a value, for aria-labels and copy/paste. */
  function valueText(value, options) {
    return ML.fmt(value, options);
  }

  /**
   * Render a matrix.
   *
   * @param {ML.Matrix} matrix
   * @param {object} [options]
   * @param {string} [options.label]      Shown above, e.g. "A" or "A⁻¹".
   * @param {string} [options.caption]    Small note underneath.
   * @param {boolean} [options.compact]
   * @param {number} [options.augmentAt]  Draw the augmented-matrix divider before this column.
   * @param {object} [options.highlight]  {cells, rows, cols, pivots, changed, dim}
   * @param {string} [options.name]       Name used in the accessible description.
   */
  function renderMatrix(matrix, options) {
    const opts = options || {};
    if (!ML.Matrix.isMatrix(matrix)) return el('span.muted', '—');
    return renderGrid(matrix.data, opts);
  }

  /**
   * Render any 2-D array of values (Frac, number, Complex) inside brackets.
   * Used for complex eigenvectors and other results that are not Matrix
   * instances, so everything in the app looks typeset the same way.
   */
  function renderGrid(rows, options) {
    const opts = options || {};
    const matrix = { rows: rows.length, cols: rows[0] ? rows[0].length : 0, data: rows };
    matrix.rowAt = function (i) { return rows[i]; };

    const hl = opts.highlight || {};
    const cellSet = keySet(hl.cells);
    const pivotSet = keySet(hl.pivots);
    const changedSet = keySet(hl.changed);
    const dimSet = keySet(hl.dim);
    const rowSet = new Set(hl.rows || []);
    const colSet = new Set(hl.cols || []);

    const grid = el('div.matrix__grid', {
      style: { gridTemplateColumns: 'repeat(' + matrix.cols + ', auto)' },
    });

    for (let i = 0; i < matrix.rows; i++) {
      for (let j = 0; j < matrix.cols; j++) {
        const value = matrix.data[i][j];
        const key = i + ',' + j;
        const classes = ['matrix__cell'];
        if (value instanceof Frac && value.isZero()) classes.push('is-zero');
        if (pivotSet.has(key)) classes.push('is-pivot');
        else if (changedSet.has(key)) classes.push('is-changed');
        else if (cellSet.has(key) || rowSet.has(i) || colSet.has(j)) classes.push('is-hl');
        if (dimSet.has(key)) classes.push('is-dim');
        if (opts.augmentAt != null && j === opts.augmentAt) classes.push('is-divider');
        grid.appendChild(el('div.' + classes.join('.'), [renderValue(value, opts)]));
      }
    }

    const box = el(
      'div.matrix' + (opts.compact ? '.matrix--compact' : '') + (opts.augmentAt != null ? '.matrix--augmented' : ''),
      { role: 'img', 'aria-label': describeMatrix(matrix, opts) },
      [el('span.matrix__br.matrix__br--l'), grid, el('span.matrix__br.matrix__br--r')]
    );

    if (!opts.label && !opts.caption) return box;

    return el('figure.matrix-figure', [
      opts.label ? el('figcaption.matrix-figure__label', opts.label) : null,
      box,
      opts.caption ? el('figcaption.matrix-figure__caption', opts.caption) : null,
    ]);
  }

  function keySet(pairs) {
    const set = new Set();
    (pairs || []).forEach(function (p) { set.add(p[0] + ',' + p[1]); });
    return set;
  }

  /** Spoken description so screen-reader users get the actual numbers. */
  function describeMatrix(matrix, opts) {
    const name = opts && opts.name ? opts.name : opts && opts.label ? String(opts.label).replace(/\s*=\s*$/, '') : 'Matrix';
    const rows = [];
    const limit = 8;
    for (let i = 0; i < Math.min(matrix.rows, limit); i++) {
      rows.push('row ' + (i + 1) + ': ' + matrix.rowAt(i).map(function (v) { return valueText(v); }).join(', '));
    }
    if (matrix.rows > limit) rows.push('…');
    return name + ', ' + matrix.rows + ' by ' + matrix.cols + '. ' + rows.join('; ') + '.';
  }

  /** A column vector, or an inline (x, y, z) when options.inline is set. */
  function renderVector(values, options) {
    const opts = options || {};
    if (opts.inline) {
      const inner = [];
      values.forEach(function (v, i) {
        if (i) inner.push(', ');
        inner.push(renderValue(v, opts));
      });
      return el('span.math', [opts.label ? opts.label + ' = ' : null, '(', inner, ')']);
    }
    return renderMatrix(ML.Matrix.column(values), opts);
  }

  /**
   * Lay out an expression made of matrices and operators:
   *   renderExpression([{matrix: A, label:'A'}, '×', {matrix: B, label:'B'}, '=', {matrix: C, label:'AB'}])
   */
  function renderExpression(items) {
    const row = el('div.matrix-row');
    items.forEach(function (item) {
      if (item == null) return;
      if (typeof item === 'string') {
        row.appendChild(el('span.matrix-row__op', item));
      } else if (item instanceof Node) {
        row.appendChild(item);
      } else if (item.matrix) {
        row.appendChild(renderMatrix(item.matrix, item));
      } else if (item.value !== undefined) {
        row.appendChild(el('span.value.value--big', [renderValue(item.value)]));
      }
    });
    return row;
  }

  /** Render a StepLog as a vertical timeline. */
  function renderSteps(stepLog, options) {
    const opts = options || {};
    if (!stepLog || stepLog.isEmpty()) {
      return el('p.muted.small', 'No steps were recorded for this calculation.');
    }
    const list = el('ol.steps');
    stepLog.steps.forEach(function (step) {
      const item = el(
        'li.step' + (step.kind === 'result' ? '.step--result' : step.kind === 'warn' ? '.step--warn' : '')
      );
      if (step.heading) item.appendChild(el('div.step__head', step.heading));
      if (step.text) item.appendChild(el('p.step__text', step.text));
      if (step.math) item.appendChild(el('div.step__math', step.math));
      if (step.list && step.list.length) {
        item.appendChild(
          el('ul.step__list', step.list.map(function (line) { return el('li', line); }))
        );
      }
      if (step.matrix) {
        item.appendChild(
          el('div.step__matrices', [
            renderMatrix(step.matrix, {
              label: step.label,
              highlight: step.highlight,
              augmentAt: step.augmentAt,
              compact: opts.compact !== false,
            }),
          ])
        );
      }
      if (step.matrices && step.matrices.length) {
        item.appendChild(
          el(
            'div.step__matrices',
            step.matrices.map(function (entry) {
              return renderMatrix(entry.matrix, {
                label: entry.label,
                caption: entry.caption,
                highlight: entry.highlight,
                compact: opts.compact !== false,
              });
            })
          )
        );
      }
      if (step.note) item.appendChild(el('div.step__note', step.note));
      list.appendChild(item);
    });
    return list;
  }

  /**
   * A polynomial in a readable form, from an array of Frac coefficients in
   * ascending powers: [c0, c1, c2] → "λ² − 3λ + 2".
   */
  function polynomialText(coefficients, variable) {
    const v = variable || 'λ';
    const terms = [];
    for (let power = coefficients.length - 1; power >= 0; power--) {
      const c = coefficients[power];
      if (c.isZero()) continue;
      const magnitude = c.abs();
      let body;
      const showCoefficient = !magnitude.isOne() || power === 0;
      const coefficientText = showCoefficient ? ML.fmt(magnitude) : '';
      if (power === 0) body = coefficientText;
      else if (power === 1) body = coefficientText + v;
      else body = coefficientText + v + ML.operations.superscript(power);

      if (!terms.length) terms.push((c.isNegative() ? '−' : '') + body);
      else terms.push((c.isNegative() ? ' − ' : ' + ') + body);
    }
    return terms.length ? terms.join('') : '0';
  }

  ML.ui.renderValue = renderValue;
  ML.ui.valueText = valueText;
  ML.ui.renderMatrix = renderMatrix;
  ML.ui.renderGrid = renderGrid;
  /** Column of arbitrary values (used for complex eigenvectors). */
  ML.ui.renderColumn = function (values, options) {
    return renderGrid(
      values.map(function (v) { return [v]; }),
      options
    );
  };
  ML.ui.renderVector = renderVector;
  ML.ui.renderExpression = renderExpression;
  ML.ui.renderSteps = renderSteps;
  ML.ui.polynomialText = polynomialText;
  ML.ui.describeMatrix = describeMatrix;
})((globalThis.ML = globalThis.ML || {}));
