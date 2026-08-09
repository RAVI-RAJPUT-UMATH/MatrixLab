/**
 * MatrixLab — Eigenvalues, Eigenvectors and Diagonalisation.
 *
 * Shows the characteristic polynomial, every eigenvalue with its eigenspace,
 * whether the matrix can be diagonalised, and the two independent checks
 * (trace and determinant) that confirm the answers.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;

  function buildView() {
    const input = ML.store.bind(
      'A',
      new ui.MatrixInput({
        name: 'A',
        rows: 2,
        cols: 2,
        square: true,
        max: 8,
        values: ML.store.getValuesOrDefault('A', [['4', '1'], ['2', '3']]),
        hint: 'Square matrices only. Eigenvalues are exact whenever they are rational or come from a quadratic.',
      })
    );

    const tabs = ui.tabs(
      [
        { id: 'spectrum', label: 'Eigenvalues & eigenvectors', build: function () { return buildSpectrum(input); } },
        { id: 'diagonal', label: 'Diagonalisation', build: function () { return buildDiagonalisation(input); } },
        { id: 'about', label: 'What eigenvalues mean', build: buildAbout },
      ],
      { rebuild: true }
    );

    return [
      ui.card({
        title: 'The matrix',
        actions: [
          ui.button('Recompute', { variant: 'primary', size: 'sm', onClick: function () { ML.router.render(); } }),
        ],
        body: input.element,
      }),
      tabs,
    ];
  }

  /* ------------------------------------------------------------------ *
   * Eigenvalues and eigenvectors
   * ------------------------------------------------------------------ */

  function buildSpectrum(input) {
    const got = input.tryGetMatrix();
    if (!got.ok) return ui.errorPanel(got.error);
    const A = got.matrix;

    const steps = new ML.StepLog('Finding the eigenvalues and eigenvectors');
    const analysis = ML.eigenAnalysis(A, steps);

    const polynomial = el('div.stack-sm', [
      el('div.formula.formula--block', 'p(λ) = det(A − λI) = ' + analysis.polynomial.text),
      el('p.small.muted', [
        'The eigenvalues are the roots of this polynomial. Its coefficients are computed in exact fractions, so they ' +
          'carry no rounding error at all.',
      ]),
    ]);

    const cards = analysis.pairs.map(function (pair, index) {
      return buildPairCard(pair, index, A);
    });

    const checks = el('div.stack-sm', [
      ui.kpis([
        {
          label: 'Sum of eigenvalues',
          node: el('span', analysis.checks.eigenvalueSum.toString()),
          note: 'tr(A) = ' + ML.fmt(analysis.checks.trace) + (analysis.checks.traceMatches ? ' ✓' : ' ✗'),
        },
        {
          label: 'Product of eigenvalues',
          node: el('span', analysis.checks.eigenvalueProduct.toString()),
          note: 'det(A) = ' + ML.fmt(analysis.checks.determinant) + (analysis.checks.detMatches ? ' ✓' : ' ✗'),
        },
        { label: 'Algebraic total', node: el('span', String(analysis.totalAlgebraic) + ' / ' + A.rows) },
        { label: 'Independent eigenvectors', node: el('span', String(analysis.totalGeometric) + ' / ' + A.rows) },
      ]),
      analysis.checks.traceMatches && analysis.checks.detMatches
        ? ui.alert('ok', 'The eigenvalues add up to the trace and multiply to the determinant — both independent checks pass.')
        : ui.alert('error', 'A consistency check failed. Treat these eigenvalues with suspicion and please report the matrix.'),
    ]);

    const notes = analysis.notes.length
      ? el('div.stack-sm', analysis.notes.map(function (note) { return ui.alert('info', note); }))
      : null;

    return ui.resultBlock({
      result: el('div.stack-lg', [
        polynomial,
        notes,
        el('div', [ui.sectionLabel('Eigenvalues and their eigenspaces'), el('div.stack', cards)]),
        el('div', [ui.sectionLabel('Consistency checks'), checks]),
      ]),
      steps: steps,
      explanation: buildAbout(),
    });
  }

  function buildPairCard(pair, index, A) {
    const value = pair.eigenvalue;
    const badges = [
      ui.badge('λ' + ML.operations.subscript(index + 1), 'brand'),
      value.exact ? ui.badge('exact', 'ok') : ui.badge('numerical', 'warn'),
      ui.badge('algebraic multiplicity ' + pair.algebraic),
      ui.badge('geometric multiplicity ' + pair.geometric, pair.defective ? 'err' : 'ok'),
    ];

    const vectorDisplay = pair.vectors
      ? el(
          'div.vector-list',
          pair.vectors.map(function (vector, k) {
            return ui.renderMatrix(vector, { label: 'v' + ML.operations.subscript(k + 1) });
          })
        )
      : el(
          'div.vector-list',
          pair.numericVectors.map(function (vector, k) {
            return el('figure.matrix-figure', [
              el('figcaption.matrix-figure__label', 'v' + ML.operations.subscript(k + 1)),
              ui.renderColumn(vector),
            ]);
          })
        );

    const residual = pair.residuals.length
      ? Math.max.apply(null, pair.residuals.map(function (r) { return r === Infinity ? 1 : r; }))
      : 0;

    return ui.card({
      title: 'λ = ' + value.text,
      subtitle: value.kind === 'complex' ? 'complex eigenvalue' : value.kind === 'radical' ? 'irrational eigenvalue' : null,
      body: el('div.stack', [
        el('div.row.row--tight', badges),
        el('div.row.row--top', [
          vectorDisplay,
          el('div.small.muted', { style: { maxWidth: '44ch' } }, [
            el('p', pair.note),
            el('p', [
              'Check: ',
              el('span.math', 'A·v = ' + value.text + '·v'),
              residual === 0
                ? ' holds exactly.'
                : ' holds to within ' + ML.fmtFixed(residual, 3) + '.',
            ]),
            pair.defective
              ? el('p', [
                  el('strong', 'Defective: '),
                  'this eigenvalue repeats ' + pair.algebraic + ' times but its eigenspace is only ' + pair.geometric +
                    '-dimensional, so there are not enough eigenvectors to diagonalise A.',
                ])
              : null,
          ]),
        ]),
      ]),
    });
  }

  /* ------------------------------------------------------------------ *
   * Diagonalisation
   * ------------------------------------------------------------------ */

  function buildDiagonalisation(input) {
    const got = input.tryGetMatrix();
    if (!got.ok) return ui.errorPanel(got.error);
    const A = got.matrix;

    const steps = new ML.StepLog('Diagonalising A');
    const result = ML.diagonalizeMatrix(A, steps);

    if (!result.diagonalizable) {
      return el('div.stack', [
        ui.alert('warn', result.reason, 'Not diagonalisable'),
        el('div.lesson', [
          el('h3', 'What goes wrong'),
          el('p', [
            'Diagonalising means finding a basis made entirely of eigenvectors. When an eigenvalue repeats but does not ' +
              'bring enough independent eigenvectors with it, no such basis exists and the matrix cannot be written as ' +
              'PDP⁻¹.',
          ]),
          el('p', [
            'The shear [[1, 1], [0, 1]] is the standard example: 1 is a double eigenvalue, but every eigenvector points ' +
              'along the x-axis. There is no second independent direction that the matrix merely stretches.',
          ]),
          el('p', [
            'Such matrices are called defective. They still have a canonical form — the Jordan form — which keeps the ' +
              'eigenvalues on the diagonal and puts 1s just above it. MatrixLab does not compute Jordan forms.',
          ]),
        ]),
      ]);
    }

    if (!result.overReals) {
      return el('div.stack', [
        ui.alert('info', result.reason, 'Diagonalisable over ℂ only'),
        ui.button('See the complex eigenvalues', {
          onClick: function () { ML.router.navigate('eigen'); },
        }),
      ]);
    }

    if (!result.P) {
      return ui.alert('warn', result.reason, 'Could not assemble P');
    }

    const reconstructed = ML.multiplyMatrices(ML.multiplyMatrices(result.P, result.D), result.Pinv);

    return ui.resultBlock({
      formula: 'A = P D P⁻¹',
      result: el('div.stack-lg', [
        result.exact
          ? ui.alert('ok', 'A is diagonalisable, and because every eigenvalue is rational the factors below are exact.')
          : ui.alert(
              'warn',
              'A is diagonalisable, but its eigenvalues are irrational, so P and D hold decimal approximations. ' +
                'Largest reconstruction error: ' + ML.fmtFixed(result.reconstructionError || 0, 3) + '.'
            ),
        el('div.scroll-x', [
          ui.renderExpression([
            { matrix: A, label: 'A' },
            '=',
            { matrix: result.P, label: 'P' },
            '·',
            { matrix: result.D, label: 'D' },
            '·',
            { matrix: result.Pinv, label: 'P⁻¹' },
          ]),
        ]),
        el('div', [
          ui.sectionLabel('Verification'),
          el('div.scroll-x', [
            ui.renderExpression([
              { matrix: reconstructed, label: 'P D P⁻¹' },
              reconstructed.equals(A) ? '=' : '≈',
              { matrix: A, label: 'A' },
            ]),
          ]),
          el('p.small.muted', [
            reconstructed.equals(A)
              ? 'Multiplying the three factors back out reproduces A exactly.'
              : 'Multiplying the factors back out reproduces A to within rounding error.',
          ]),
        ]),
        el('div', [
          ui.sectionLabel('Why this is useful'),
          el('div.lesson', [
            el('p', [
              'Once A = PDP⁻¹, powers become easy: A² = PD²P⁻¹, and in general Aᵏ = PDᵏP⁻¹. Raising a diagonal matrix ' +
                'to a power just raises each diagonal entry to that power, so a calculation that would need k matrix ' +
                'multiplications collapses to raising a few numbers to the power k.',
            ]),
            el('p', [
              'Read in the other direction, P is a change of basis. In the coordinate system given by the eigenvectors, ' +
                'A does nothing more complicated than stretching each axis by its eigenvalue. P⁻¹ translates into those ' +
                'coordinates, D does the stretching, and P translates back.',
            ]),
          ]),
        ]),
      ]),
      steps: steps,
    });
  }

  /* ------------------------------------------------------------------ *
   * Explanation
   * ------------------------------------------------------------------ */

  function buildAbout() {
    return [
      el('h3', 'The idea in one sentence'),
      el('p', [
        'Most vectors change direction when a matrix acts on them. An ',
        el('strong', 'eigenvector'),
        ' is one of the rare directions that does not: the matrix only stretches or shrinks it. The stretch factor is ' +
          'the ',
        el('strong', 'eigenvalue'),
        '.',
      ]),
      el('div.formula.formula--block', 'A v = λ v,   v ≠ 0'),
      el('h3', 'How they are found'),
      el('p', [
        'Rewrite Av = λv as (A − λI)v = 0. A non-zero solution v exists only if A − λI squashes something to zero — ' +
          'that is, only if A − λI is singular. So the eigenvalues are exactly the values of λ making det(A − λI) = 0. ' +
          'That determinant, expanded, is the characteristic polynomial.',
      ]),
      el('p', [
        'Having found a λ, substitute it back and solve (A − λI)v = 0. The solution set is the eigenspace: a whole ' +
          'subspace, so eigenvectors are never unique — any non-zero multiple of one is another.',
      ]),
      el('h3', 'Multiplicity, and why it matters'),
      el('p', [
        'A repeated root of the characteristic polynomial has ',
        el('strong', 'algebraic multiplicity'),
        ' greater than one. The dimension of its eigenspace is its ',
        el('strong', 'geometric multiplicity'),
        '. Geometric never exceeds algebraic, and when they are equal for every eigenvalue the matrix is ' +
          'diagonalisable. When geometric falls short, the matrix is called defective.',
      ]),
      el('div.callout', [
        el('div.callout__title', 'Two free checks'),
        el('p', [
          'For any square matrix the eigenvalues add up to the trace and multiply to the determinant. Both are quick ' +
            'to compute independently, which makes them an excellent way to catch a mistake — MatrixLab reports both ' +
            'every time.',
        ]),
      ]),
      el('h3', 'Complex eigenvalues are normal'),
      el('p', [
        'A rotation of the plane sends no direction to a multiple of itself, so it has no real eigenvector — and ' +
          'correspondingly its eigenvalues are complex. This is not a defect or an error. Real symmetric matrices are ' +
          'the special case that is guaranteed real eigenvalues, and moreover perpendicular eigenvectors.',
      ]),
      el('div.callout.callout--try', [
        el('div.callout__title', 'Try these'),
        el('ul', [
          el('li', '[[4, 1], [2, 3]] — distinct eigenvalues 5 and 2, cleanly diagonalisable.'),
          el('li', '[[2, 1], [1, 2]] — symmetric, so the eigenvectors come out perpendicular.'),
          el('li', '[[1, 1], [0, 1]] — a defective matrix: eigenvalue 1 twice, but only one eigenvector.'),
          el('li', '[[0, -1], [1, 0]] — a 90° rotation, with eigenvalues ±i.'),
          el('li', '[[1, 1], [1, 0]] — eigenvalues involving √5, the golden ratio.'),
        ]),
      ]),
    ];
  }

  ML.registerView({
    id: 'eigen',
    title: 'Eigenvalues',
    heading: 'Eigenvalues & Eigenvectors',
    tagline: 'Characteristic polynomial, eigenvalues, eigenspaces and diagonalisation — exact wherever the mathematics allows.',
    icon: 'λ',
    build: buildView,
  });
})((globalThis.ML = globalThis.ML || {}));
