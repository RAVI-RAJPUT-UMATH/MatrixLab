/**
 * MatrixLab — Matrix Calculator (basic operations).
 *
 * Addition, subtraction, matrix product, element-wise product, scalar
 * multiplication, powers and equality — each with real steps and a short
 * explanation of what the operation means.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;

  /** Kept in module scope so a settings change re-renders without losing state. */
  const state = {
    op: ML.store.getSetting('calc.op', 'multiply'),
    scalar: ML.store.getSetting('calc.scalar', '2'),
    power: ML.store.getSetting('calc.power', '2'),
    showedErrors: false,
  };

  const OPS = {
    add: {
      label: 'A + B',
      title: 'Addition',
      needsB: true,
      symbol: '+',
      formula: '(A + B)ᵢⱼ = aᵢⱼ + bᵢⱼ',
      compute: function (A, B, steps) { return ML.addMatrices(A, B, steps); },
      explain: [
        'Adding matrices means adding the numbers that sit in the same position. Nothing mixes across rows or columns, ' +
          'so the two matrices must have exactly the same shape and the answer keeps that shape.',
        'Because it works position by position, matrix addition behaves like ordinary addition: A + B = B + A, ' +
          'and (A + B) + C = A + (B + C). The zero matrix acts as the "do nothing" matrix: A + 0 = A.',
      ],
    },
    subtract: {
      label: 'A − B',
      title: 'Subtraction',
      needsB: true,
      symbol: '−',
      formula: '(A − B)ᵢⱼ = aᵢⱼ − bᵢⱼ',
      compute: function (A, B, steps) { return ML.subtractMatrices(A, B, steps); },
      explain: [
        'Subtraction is addition of the negative: A − B = A + (−B), where −B flips the sign of every entry of B. ' +
          'Again the shapes must match.',
        'A common use is measuring how far two matrices are apart — for example checking a computed inverse by looking ' +
          'at A·A⁻¹ − I and confirming every entry is zero.',
      ],
    },
    multiply: {
      label: 'A × B',
      title: 'Matrix multiplication',
      needsB: true,
      symbol: '×',
      formula: 'cᵢⱼ = (row i of A) · (column j of B)',
      compute: function (A, B, steps) { return ML.multiplyMatrices(A, B, steps); },
      explain: [
        'Matrix multiplication is not entry-by-entry. Entry cᵢⱼ of the product is the dot product of row i of A with ' +
          'column j of B: multiply the pairs and add them up. That is why the number of columns of A must equal the ' +
          'number of rows of B — those are the pairs being matched.',
        'The reason for this rule is composition. If B transforms a vector and then A transforms the result, the single ' +
          'matrix that does both at once is AB. Reading right to left is exactly how the sizes line up: ' +
          '(m×n)(n×p) → (m×p).',
        'Order matters: AB and BA are usually different matrices, and BA may not even exist. Multiplication is still ' +
          'associative, (AB)C = A(BC), and distributes over addition.',
      ],
    },
    hadamard: {
      label: 'A ∘ B',
      title: 'Element-wise (Hadamard) product',
      needsB: true,
      symbol: '∘',
      formula: '(A ∘ B)ᵢⱼ = aᵢⱼ · bᵢⱼ',
      compute: function (A, B, steps) { return ML.hadamardProduct(A, B, steps); },
      explain: [
        'The Hadamard product multiplies matching entries, the way addition adds matching entries. It is written A ∘ B ' +
          'to keep it clearly separate from the matrix product AB.',
        'This is not the multiplication of linear algebra — it does not correspond to composing transformations — but it ' +
          'appears constantly in data work and machine learning, where it is used to mask or re-weight a table of values.',
      ],
    },
    scalar: {
      label: 'k · A',
      title: 'Scalar multiplication',
      needsB: false,
      needsScalar: true,
      formula: '(kA)ᵢⱼ = k · aᵢⱼ',
      compute: function (A, B, steps, options) { return ML.scalarMultiply(A, options.scalar, steps); },
      explain: [
        'Multiplying by a number k stretches every entry by k. Geometrically, if A represents a transformation, then kA ' +
          'does the same transformation and then scales the result by k.',
        'Useful consequences: a negative k also reverses direction; k = 0 collapses everything to the zero matrix; and ' +
          'for an n×n matrix, det(kA) = kⁿ·det(A), because every one of the n directions is stretched.',
      ],
    },
    power: {
      label: 'Aⁿ',
      title: 'Matrix power',
      needsB: false,
      needsPower: true,
      formula: 'Aⁿ = A · A · … · A   (n copies)',
      compute: function (A, B, steps, options) { return ML.matrixPower(A, options.power, steps); },
      explain: [
        'Aⁿ means applying the same transformation n times in a row. Only square matrices can be raised to a power, ' +
          'because the output of A has to be a valid input for A again.',
        'A⁰ is defined as the identity matrix, and a negative power means "invert first": A⁻² = (A⁻¹)². Powers show up ' +
          'whenever a process repeats — for example a transition matrix applied step after step, where Aⁿ describes the ' +
          'state after n steps.',
        'Diagonal matrices make this easy: raising a diagonal matrix to a power just raises each diagonal entry to that ' +
          'power. That single observation is the whole motivation for diagonalisation.',
      ],
    },
    equality: {
      label: 'A = B ?',
      title: 'Matrix equality',
      needsB: true,
      formula: 'A = B  ⟺  same shape and aᵢⱼ = bᵢⱼ for every i, j',
      explain: [
        'Two matrices are equal only when they have the same dimensions and every corresponding entry agrees. ' +
          'There is no notion of "close enough" here — a single differing entry makes them different matrices.',
        'MatrixLab compares exact rational values, so 0.5 and 1/2 count as equal, while 0.333333 and 1/3 do not — ' +
          'they really are different numbers.',
      ],
    },
  };

  function buildView() {
    const op = OPS[state.op] || OPS.multiply;

    const resultHost = el('div');

    const inputA = ML.store.bind(
      'A',
      new ui.MatrixInput({
        name: 'A',
        rows: 2,
        cols: 2,
        values: ML.store.getValuesOrDefault('A'),
        square: state.op === 'power',
        onChange: function () { recalculate(false); },
      })
    );

    const inputB = ML.store.bind(
      'B',
      new ui.MatrixInput({
        name: 'B',
        rows: 2,
        cols: 2,
        values: ML.store.getValuesOrDefault('B'),
        onChange: function () { recalculate(false); },
      })
    );

    const scalarField = ui.numberInput({
      label: 'Scalar k',
      value: state.scalar,
      hint: 'Whole number, decimal or fraction',
      onInput: function (value) {
        state.scalar = value;
        ML.store.setSetting('calc.scalar', value);
        recalculate(false);
      },
      onEnter: function () { recalculate(true); },
    });

    const powerField = ui.numberInput({
      label: 'Exponent n',
      value: state.power,
      hint: 'Whole number; negative uses A⁻¹',
      inputmode: 'numeric',
      onInput: function (value) {
        state.power = value;
        ML.store.setSetting('calc.power', value);
        recalculate(false);
      },
      onEnter: function () { recalculate(true); },
    });

    /* ---------------------------- operation picker --------------------- */

    const picker = el(
      'div.op-picker',
      Object.keys(OPS).map(function (key) {
        return el('button.chip', {
          type: 'button',
          text: OPS[key].label,
          title: OPS[key].title,
          'aria-pressed': key === state.op ? 'true' : 'false',
          onClick: function () {
            state.op = key;
            ML.store.setSetting('calc.op', key);
            ML.router.render();
          },
        });
      })
    );

    /* ------------------------------- layout ---------------------------- */

    const shapeHint = el('div.small.muted');
    const inputs = el('div.stack', [
      el('div.grid-2', [
        el('div', [inputA.element]),
        op.needsB ? el('div', [inputB.element]) : null,
      ]),
      op.needsScalar || op.needsPower
        ? el('div.row', [op.needsScalar ? scalarField : null, op.needsPower ? powerField : null])
        : null,
      shapeHint,
    ]);

    function updateShapeHint() {
      ui.clear(shapeHint);
      if (state.op === 'multiply') {
        const ok = inputA.cols === inputB.rows;
        shapeHint.appendChild(
          el('span', [
            'A is ' + inputA.rows + '×' + inputA.cols + ' and B is ' + inputB.rows + '×' + inputB.cols + '. ',
            ok
              ? 'The inner dimensions match, so AB will be ' + inputA.rows + '×' + inputB.cols + '.'
              : 'For AB to exist, B needs ' + inputA.cols + ' rows.',
          ])
        );
        if (!ok) {
          shapeHint.appendChild(
            ui.button('Set B to ' + inputA.cols + ' rows', {
              size: 'sm',
              variant: 'ghost',
              onClick: function () { inputB.setSize(inputA.cols, inputB.cols); },
            })
          );
        }
      } else if (op.needsB) {
        const ok = inputA.rows === inputB.rows && inputA.cols === inputB.cols;
        if (!ok) {
          shapeHint.appendChild(el('span', 'This operation needs both matrices to be the same size. '));
          shapeHint.appendChild(
            ui.button('Match B to A (' + inputA.rows + '×' + inputA.cols + ')', {
              size: 'sm',
              variant: 'ghost',
              onClick: function () { inputB.setSize(inputA.rows, inputA.cols); },
            })
          );
        }
      } else if (state.op === 'power' && inputA.rows !== inputA.cols) {
        shapeHint.appendChild(el('span', 'Powers need a square matrix; the size control is locked to square here.'));
      }
    }

    /* ----------------------------- calculation ------------------------- */

    function recalculate(showErrors) {
      if (showErrors) state.showedErrors = true;
      updateShapeHint();

      const gotA = inputA.tryGetMatrix();
      const gotB = op.needsB ? inputB.tryGetMatrix() : { ok: true, matrix: null };

      if (!gotA.ok || !gotB.ok) {
        ui.clear(resultHost);
        if (showErrors) resultHost.appendChild(ui.errorPanel(gotA.ok ? gotB.error : gotA.error));
        else resultHost.appendChild(ui.emptyState('Fill in every entry, then press Calculate.'));
        return;
      }

      ui.safeRender(resultHost, function () {
        return buildResult(gotA.matrix, gotB.matrix);
      });
    }

    function buildResult(A, B) {
      if (state.op === 'equality') return buildEqualityResult(A, B);

      const steps = new ML.StepLog(op.title);
      let result;
      let options = {};
      if (op.needsScalar) {
        options.scalar = ML.Frac.parse(state.scalar);
      }
      if (op.needsPower) {
        const n = Number(state.power);
        if (!Number.isInteger(n)) {
          throw new ML.MLError('The exponent must be a whole number (for example 2, 3 or −1).');
        }
        options.power = n;
      }
      result = op.compute(A, B, steps, options);

      const expression = op.needsScalar
        ? ui.renderExpression([
            el('span.value.value--big', [ui.renderValue(options.scalar)]),
            '·',
            { matrix: A, label: 'A' },
            '=',
            { matrix: result, label: 'kA' },
          ])
        : op.needsPower
        ? ui.renderExpression([
            { matrix: A, label: 'A' },
            ML.operations.superscript(options.power),
            '=',
            { matrix: result, label: 'A' + ML.operations.superscript(options.power) },
          ])
        : ui.renderExpression([
            { matrix: A, label: 'A' },
            op.symbol,
            { matrix: B, label: 'B' },
            '=',
            { matrix: result, label: 'Result' },
          ]);

      return ui.resultBlock({
        formula: op.formula,
        result: el('div.stack', [
          el('div.scroll-x', [expression]),
          el('div.row.row--tight', [
            ui.badge(result.size(), 'brand'),
            ui.copyButton(function () { return ui.matrixToText(result); }, 'Copy result'),
          ]),
        ]),
        steps: steps,
        explanation: op.explain.map(function (paragraph) { return el('p', paragraph); }),
      });
    }

    function buildEqualityResult(A, B) {
      const report = ML.matricesEqual(A, B);
      return ui.resultBlock({
        formula: OPS.equality.formula,
        result: el('div.stack', [
          ui.alert(report.equal ? 'ok' : 'warn', report.reason, report.equal ? 'A = B' : 'A ≠ B'),
          el('div.scroll-x', [
            ui.renderExpression([
              { matrix: A, label: 'A', highlight: { cells: report.differences } },
              report.equal ? '=' : '≠',
              { matrix: B, label: 'B', highlight: { cells: report.differences } },
            ]),
          ]),
          report.differences.length
            ? el('p.small.muted', 'Highlighted positions are the ones that disagree.')
            : null,
        ]),
        explanation: OPS.equality.explain.map(function (paragraph) { return el('p', paragraph); }),
      });
    }

    const controls = ui.card({
      title: op.title,
      subtitle: op.formula,
      actions: [
        ui.button('Calculate', { variant: 'primary', onClick: function () { recalculate(true); } }),
        ui.button('Reset', {
          variant: 'ghost',
          onClick: function () {
            inputA.setValues([['1', '2'], ['3', '4']]);
            inputB.setValues([['0', '1'], ['1', '0']]);
            recalculate(false);
          },
        }),
      ],
      body: el('div.stack', [
        el('div', [ui.sectionLabel('Choose an operation'), picker]),
        inputs,
      ]),
    });

    recalculate(false);

    return [controls, resultHost];
  }

  ML.registerView({
    id: 'calculator',
    title: 'Matrix Calculator',
    heading: 'Matrix Calculator',
    tagline: 'The basic operations, with the arithmetic of every entry available on the Steps tab.',
    icon: '×',
    build: buildView,
  });
})((globalThis.ML = globalThis.ML || {}));
