/**
 * MatrixLab — Matrix Analysis.
 *
 * Everything derived from a single matrix: transpose, trace, determinant,
 * minors, cofactors, adjugate, inverse and rank — each with the working shown
 * and, where more than one method exists, a choice of which to see.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;

  const state = {
    op: ML.store.getSetting('analysis.op', 'determinant'),
    detMethod: ML.store.getSetting('analysis.detMethod', 'auto'),
    invMethod: ML.store.getSetting('analysis.invMethod', 'auto'),
  };

  const OPS = {
    transpose: {
      label: 'Transpose',
      title: 'Transpose — Aᵗ',
      formula: '(Aᵗ)ᵢⱼ = aⱼᵢ',
      square: false,
      run: function (A, steps) {
        return { matrix: ML.transposeMatrix(A, steps), label: 'Aᵗ' };
      },
      explain: [
        'The transpose flips a matrix across its main diagonal: row 1 becomes column 1, row 2 becomes column 2, and so ' +
          'on. An m×n matrix becomes n×m.',
        'Two facts make it useful everywhere: (Aᵗ)ᵗ = A, and (AB)ᵗ = BᵗAᵗ — note the reversed order. A matrix equal to ' +
          'its own transpose is called symmetric, and symmetric matrices have unusually good properties (real ' +
          'eigenvalues, orthogonal eigenvectors).',
        'The transpose is also how the dot product is written with matrices: for column vectors u and v, u·v = uᵗv.',
      ],
    },
    trace: {
      label: 'Trace',
      title: 'Trace — tr(A)',
      formula: 'tr(A) = a₁₁ + a₂₂ + … + aₙₙ',
      square: true,
      run: function (A, steps) {
        return { value: ML.traceMatrix(A, steps), label: 'tr(A)' };
      },
      explain: [
        'The trace is simply the sum of the diagonal entries. It looks too simple to matter, but it carries real ' +
          'information: the trace equals the sum of the eigenvalues, counted with multiplicity.',
        'That gives a free check on eigenvalue calculations. It also satisfies tr(AB) = tr(BA) even when AB ≠ BA, and ' +
          'tr(A) = tr(Aᵗ).',
      ],
    },
    determinant: {
      label: 'Determinant',
      title: 'Determinant — det(A)',
      formula: 'det(A)',
      square: true,
      methods: 'det',
      run: function (A, steps) {
        return { value: ML.determinant(A, steps, { method: state.detMethod }), label: 'det(A)' };
      },
      explain: [
        'The determinant is a single number that measures how a matrix scales area (in 2D) or volume (in 3D and above). ' +
          'A determinant of 3 means the transformation triples areas; a determinant of −1 means areas are preserved but ' +
          'orientation is reversed, as in a reflection.',
        'The decisive case is 0. A determinant of 0 means the transformation squashes space into a lower dimension, so ' +
          'information is lost and the matrix cannot be inverted. Everything else about invertibility follows from this.',
        'Two routes to the same number: cofactor expansion is the definition and is what you do by hand for 2×2 and ' +
          '3×3, while elimination reduces to triangular form and multiplies the pivots. For a 10×10 matrix expansion ' +
          'would need over three million multiplications; elimination needs a few hundred.',
      ],
    },
    minors: {
      label: 'Minors',
      title: 'Matrix of minors',
      formula: 'Mᵢⱼ = det(A with row i and column j deleted)',
      square: true,
      run: function (A, steps) {
        return { matrix: ML.minorMatrix(A, steps), label: 'M' };
      },
      explain: [
        'The minor Mᵢⱼ is the determinant of the smaller matrix left when row i and column j are struck out. For a 3×3 ' +
          'matrix every minor is a 2×2 determinant.',
        'Minors are the raw material for cofactors, the adjugate, the determinant itself and the inverse formula — so ' +
          'this table is worth computing once and reusing.',
      ],
    },
    cofactor: {
      label: 'Cofactors',
      title: 'Cofactor matrix',
      formula: 'Cᵢⱼ = (−1)^(i+j) · Mᵢⱼ',
      square: true,
      run: function (A, steps) {
        return { matrix: ML.cofactorMatrix(A, steps), label: 'C' };
      },
      explain: [
        'A cofactor is a minor with a sign attached, following a chequerboard pattern that starts with + in the ' +
          'top-left corner.',
        'The alternating signs are not decoration. They are what makes expansion along any row or column give the same ' +
          'determinant, and what makes A·adj(A) collapse to det(A)·I.',
      ],
    },
    adjugate: {
      label: 'Adjugate',
      title: 'Adjugate (adjoint) — adj(A)',
      formula: 'adj(A) = Cᵗ,   A·adj(A) = det(A)·I',
      square: true,
      run: function (A, steps) {
        return { matrix: ML.adjointMatrix(A, steps), label: 'adj(A)' };
      },
      explain: [
        'The adjugate is the transpose of the cofactor matrix. Its defining property is A·adj(A) = det(A)·I.',
        'Read that identity again and the inverse formula falls out: divide both sides by det(A) and you have ' +
          'A·(adj(A)/det(A)) = I, so adj(A)/det(A) is A⁻¹ whenever det(A) ≠ 0.',
        'The older name "adjoint" is still common in school textbooks, though "adjugate" avoids confusion with the ' +
          'conjugate transpose used in complex linear algebra.',
      ],
    },
    inverse: {
      label: 'Inverse',
      title: 'Inverse — A⁻¹',
      formula: 'A·A⁻¹ = A⁻¹·A = I',
      square: true,
      methods: 'inv',
      run: function (A, steps) {
        return { matrix: ML.inverseMatrix(A, steps, { method: state.invMethod }), label: 'A⁻¹' };
      },
      explain: [
        'The inverse undoes what the matrix does. If A takes x to b, then A⁻¹ takes b back to x. Only square matrices ' +
          'can have one, and only when the determinant is non-zero.',
        'Why does a zero determinant rule it out? Because det(A) = 0 means A collapses space — two different inputs ' +
          'land on the same output. Nothing can undo that, because the information about which input it was is gone.',
        'The adjugate formula A⁻¹ = adj(A)/det(A) is the one to know for 2×2 and 3×3. For anything bigger, row-reduce ' +
          '[A | I] until the left half is the identity; the right half is then A⁻¹. MatrixLab checks its answer by ' +
          'multiplying A·A⁻¹ back out.',
      ],
    },
    rank: {
      label: 'Rank',
      title: 'Rank — rank(A)',
      formula: 'rank(A) = number of pivots in the row echelon form',
      square: false,
      run: function (A, steps) {
        const value = ML.matrixRank(A, steps);
        return { value: value, label: 'rank(A)', integer: true };
      },
      explain: [
        'The rank counts how much genuinely independent information a matrix holds. Row-reduce it and count the pivots: ' +
          'that is the rank.',
        'Remarkably, the number of independent rows always equals the number of independent columns — so rank(A) = ' +
          'rank(Aᵗ). The rank cannot exceed either dimension, and a square matrix is invertible exactly when its rank ' +
          'equals its size.',
        'Rank is also the bridge to the subspaces: rank is the dimension of the column space, and the ' +
          'rank–nullity theorem then fixes the dimension of the null space at (number of columns) − rank.',
      ],
    },
  };

  function buildView() {
    const op = OPS[state.op] || OPS.determinant;
    const resultHost = el('div');

    const input = ML.store.bind(
      'A',
      new ui.MatrixInput({
        name: 'A',
        rows: 3,
        cols: 3,
        values: ML.store.getValuesOrDefault('A'),
        square: op.square === true,
        hint: op.square ? 'This operation is only defined for square matrices.' : null,
        onChange: function () { recalculate(false); },
      })
    );

    const picker = el(
      'div.op-picker',
      Object.keys(OPS).map(function (key) {
        return el('button.chip', {
          type: 'button',
          text: OPS[key].label,
          'aria-pressed': key === state.op ? 'true' : 'false',
          onClick: function () {
            state.op = key;
            ML.store.setSetting('analysis.op', key);
            ML.router.render();
          },
        });
      })
    );

    const methodControl =
      op.methods === 'det'
        ? ui.segmented({
            label: 'Determinant method',
            value: state.detMethod,
            options: [
              { value: 'auto', label: 'Automatic', title: 'Cofactor expansion for small sizes, elimination for larger' },
              { value: 'cofactor', label: 'Cofactor expansion' },
              { value: 'elimination', label: 'Elimination' },
            ],
            onChange: function (value) {
              state.detMethod = value;
              ML.store.setSetting('analysis.detMethod', value);
              recalculate(true);
            },
          })
        : op.methods === 'inv'
        ? ui.segmented({
            label: 'Inverse method',
            value: state.invMethod,
            options: [
              { value: 'auto', label: 'Automatic' },
              { value: 'adjugate', label: 'Adjugate formula' },
              { value: 'gauss-jordan', label: 'Gauss–Jordan' },
            ],
            onChange: function (value) {
              state.invMethod = value;
              ML.store.setSetting('analysis.invMethod', value);
              recalculate(true);
            },
          })
        : null;

    function recalculate(showErrors) {
      const got = input.tryGetMatrix();
      if (!got.ok) {
        ui.clear(resultHost);
        resultHost.appendChild(
          showErrors ? ui.errorPanel(got.error) : ui.emptyState('Fill in every entry, then press Calculate.')
        );
        return;
      }
      ui.safeRender(resultHost, function () {
        const A = got.matrix;
        const steps = new ML.StepLog(op.title);
        const outcome = op.run(A, steps);

        const answer = outcome.matrix
          ? el('div.scroll-x', [
              ui.renderExpression([
                { matrix: A, label: 'A' },
                '→',
                { matrix: outcome.matrix, label: outcome.label },
              ]),
            ])
          : el('div.result-hero', [
              el('div', [
                el('div.result-hero__label', outcome.label),
                el('div.value.value--big', [
                  outcome.integer ? String(outcome.value) : ui.renderValue(outcome.value),
                ]),
              ]),
              el('div.small.muted', { style: { maxWidth: '38ch' } }, describeScalar(state.op, outcome.value, A)),
            ]);

        return ui.resultBlock({
          formula: op.formula,
          result: el('div.stack', [
            answer,
            outcome.matrix
              ? el('div.row.row--tight', [
                  ui.badge(outcome.matrix.size(), 'brand'),
                  ui.copyButton(function () { return ui.matrixToText(outcome.matrix); }, 'Copy result'),
                  ui.button('Use as A', {
                    size: 'sm',
                    variant: 'ghost',
                    title: 'Load this result back into the input',
                    onClick: function () {
                      input.setMatrix(outcome.matrix);
                      recalculate(true);
                    },
                  }),
                ])
              : null,
          ]),
          steps: steps,
          explanation: op.explain.map(function (paragraph) { return el('p', paragraph); }),
        });
      });
    }

    const controls = ui.card({
      title: op.title,
      subtitle: op.formula,
      actions: [ui.button('Calculate', { variant: 'primary', onClick: function () { recalculate(true); } })],
      body: el('div.stack', [
        el('div', [ui.sectionLabel('Choose what to compute'), picker]),
        methodControl ? el('div.field', [el('span.label', 'Method'), methodControl]) : null,
        input.element,
      ]),
    });

    recalculate(false);
    return [controls, resultHost];
  }

  function describeScalar(op, value, A) {
    if (op === 'determinant') {
      if (value.isZero()) return 'Zero, so A is singular: it has no inverse and its columns are dependent.';
      return 'Non-zero, so A is invertible. Areas and volumes are scaled by ' + ML.fmt(value.abs()) +
        (value.isNegative() ? ', with orientation reversed.' : '.');
    }
    if (op === 'trace') return 'This also equals the sum of the eigenvalues of A.';
    if (op === 'rank') {
      const maximum = Math.min(A.rows, A.cols);
      return value === maximum
        ? 'That is the largest possible for a ' + A.size() + ' matrix, so A has full rank.'
        : 'Below the maximum of ' + maximum + ', so A is rank deficient: ' + (A.cols - value) +
            ' dimension(s) collapse to zero.';
    }
    return '';
  }

  ML.registerView({
    id: 'analysis',
    title: 'Matrix Analysis',
    tagline: 'Transpose, trace, determinant, minors, cofactors, adjugate, inverse and rank — one matrix at a time.',
    icon: '∂',
    build: buildView,
  });
})((globalThis.ML = globalThis.ML || {}));
