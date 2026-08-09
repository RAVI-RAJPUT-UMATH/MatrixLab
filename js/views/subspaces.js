/**
 * MatrixLab — Subspaces.
 *
 * The four fundamental subspaces of a matrix, plus the independence / span /
 * basis tools. All of it comes from one exact row reduction, which is the point
 * the view is built to make.
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
        rows: 3,
        cols: 4,
        values: ML.store.getValuesOrDefault('A', [['1', '2', '2', '2'], ['2', '4', '6', '8'], ['3', '6', '8', '10']]),
        hint: 'Rectangular matrices are the interesting case here — the four subspaces then live in different dimensions.',
      })
    );

    const tabs = ui.tabs(
      [
        { id: 'four', label: 'Four fundamental subspaces', build: function () { return buildFour(input); } },
        { id: 'independence', label: 'Independence & span', build: function () { return buildIndependence(input); } },
        { id: 'about', label: 'Rank–nullity', build: buildAbout },
      ],
      { rebuild: true }
    );

    return [ui.card({ title: 'The matrix', body: input.element }), tabs];
  }

  /* ------------------------------------------------------------------ *
   * Four fundamental subspaces
   * ------------------------------------------------------------------ */

  function buildFour(input) {
    const got = input.tryGetMatrix();
    if (!got.ok) return ui.errorPanel(got.error);
    const A = got.matrix;

    const steps = new ML.StepLog('Reading the four subspaces off one reduction');
    const report = ML.fourSubspaces(A, steps);
    const orthogonality = ML.verifySubspaceOrthogonality(report);

    const summary = ui.kpis([
      { label: 'Matrix', node: el('span', A.size()) },
      { label: 'Rank r', node: el('span', String(report.rank)) },
      { label: 'Nullity', node: el('span', String(report.nullity)), note: 'n − r = ' + report.cols + ' − ' + report.rank },
      { label: 'Left nullity', node: el('span', String(report.leftNullity)), note: 'm − r = ' + report.rows + ' − ' + report.rank },
    ]);

    const order = ['column', 'null', 'row', 'leftNull'];
    const spaceCards = order.map(function (key) {
      const space = report.spaces[key];
      return ui.card({
        title: space.name + '  ' + space.symbol,
        subtitle: 'dimension ' + space.dimension + ' inside ' + space.ambientText,
        body: el('div.stack', [
          el('p.small.muted', space.meaning),
          space.basis.length
            ? el('div', [
                ui.sectionLabel('Basis (' + space.basis.length + ' vector' + (space.basis.length === 1 ? '' : 's') + ')'),
                el(
                  'div.vector-list',
                  space.basis.map(function (vector, index) {
                    return ui.renderMatrix(vector, { label: subscriptLabel(key, index) });
                  })
                ),
              ])
            : ui.alert('info', 'This subspace contains only the zero vector, so it has no basis vectors and dimension 0.'),
        ]),
      });
    });

    const relations = el(
      'div.stack-sm',
      report.relations.map(function (relation) {
        return el('div.row.row--tight', [
          ui.badge(relation.holds ? '✓' : '✗', relation.holds ? 'ok' : 'err'),
          el('span.small', relation.text),
          el('span.formula.tiny', relation.math),
        ]);
      })
    );

    return ui.resultBlock({
      result: el('div.stack-lg', [
        summary,
        el('div.row.row--top', [
          ui.renderMatrix(A, { label: 'A =' }),
          el('span.matrix-row__op', '→'),
          ui.renderMatrix(report.rref, { label: 'rref(A) =', highlight: { pivots: report.pivots } }),
        ]),
        el('div.grid-2', spaceCards),
        ui.card({
          title: 'The relationships',
          body: el('div.stack', [
            relations,
            orthogonality.checks.length
              ? el('div', [
                  ui.sectionLabel('Perpendicularity, checked exactly'),
                  el(
                    'ul.step__list',
                    orthogonality.checks.slice(0, 10).map(function (check) {
                      return el('li', check.pair + ' = ' + ML.fmt(check.value));
                    })
                  ),
                  ui.alert(
                    orthogonality.allZero ? 'ok' : 'error',
                    orthogonality.allZero
                      ? 'Every dot product is exactly zero: the row space really is perpendicular to the null space, and ' +
                        'the column space to the left null space. Exact arithmetic makes this a proof, not an impression.'
                      : 'A dot product that should be zero is not — please report this matrix.'
                  ),
                ])
              : null,
          ]),
        }),
      ]),
      steps: steps,
      explanation: buildAbout(),
    });
  }

  function subscriptLabel(key, index) {
    const prefix = { column: 'c', row: 'r', null: 'n', leftNull: 'y' }[key] || 'v';
    return prefix + ML.operations.subscript(index + 1);
  }

  /* ------------------------------------------------------------------ *
   * Independence and span
   * ------------------------------------------------------------------ */

  function buildIndependence(input) {
    const got = input.tryGetMatrix();
    if (!got.ok) return ui.errorPanel(got.error);
    const A = got.matrix;
    const columns = A.columns();

    const steps = new ML.StepLog('Testing the columns for independence');
    const report = ML.linearIndependence(columns, steps);
    const basis = ML.basisOfSpan(columns);

    const targetInput = new ui.MatrixInput({
      name: 'b',
      rows: A.rows,
      cols: 1,
      fixedCols: true,
      values: ML.store.getValuesOrDefault('b', A.columns()[0].map(function (v) { return [v.toString()]; })),
      showTools: false,
      allowResize: false,
    });

    const spanHost = el('div');

    function checkSpan() {
      ui.safeRender(spanHost, function () {
        const target = targetInput.getMatrix();
        const spanSteps = new ML.StepLog('Is b in the span?');
        const result = ML.spanContains(columns, target, spanSteps);
        return el('div.stack', [
          ui.alert(result.inSpan ? 'ok' : 'warn', result.text, result.inSpan ? 'In the span' : 'Outside the span'),
          result.inSpan && result.solution.solution
            ? el('div.stack-sm', [
                el('p.small.muted', 'The coefficients that build b from the columns of A:'),
                el(
                  'div.row.row--tight',
                  result.solution.solution.colAt(0).map(function (value, index) {
                    return el('span.formula', 'c' + ML.operations.subscript(index + 1) + ' = ' + ML.fmt(value));
                  })
                ),
              ])
            : null,
          ui.disclosure('Show the working', function () { return ui.renderSteps(spanSteps); }),
        ]);
      });
    }

    return el('div.stack-lg', [
      ui.resultBlock({
        formula: 'independent  ⟺  every column has a pivot  ⟺  Ax = 0 only for x = 0',
        result: el('div.stack', [
          ui.alert(
            report.independent ? 'ok' : 'warn',
            report.independent
              ? 'All ' + report.count + ' columns are linearly independent: the rank equals the number of columns, so no ' +
                'column can be built from the others.'
              : 'The columns are dependent. The rank is ' + report.rank + ' but there are ' + report.count +
                ' columns, so ' + (report.count - report.rank) + ' of them are redundant.',
            report.independent ? 'Independent' : 'Dependent'
          ),
          report.dependencies.length
            ? el('div', [
                ui.sectionLabel('The redundancies, written out'),
                el('div.stack-sm', report.dependencies.map(function (dependency) {
                  return el('div.formula', dependency.text);
                })),
                el('p.small.muted', 'These are exact: the coefficients come straight from the reduced matrix.'),
              ])
            : null,
          el('div', [
            ui.sectionLabel('A basis for the span (dimension ' + basis.dimension + ')'),
            el(
              'div.vector-list',
              basis.basis.map(function (vector, index) {
                return ui.renderMatrix(vector, {
                  label: 'column ' + (basis.indices[index] + 1),
                });
              })
            ),
            el('p.small.muted', [
              'A basis is an independent spanning set: enough vectors to reach everything in the span, with none to ' +
                'spare. Its size is the dimension, and every basis of the same space has the same size.',
            ]),
          ]),
        ]),
        steps: steps,
      }),
      ui.card({
        title: 'Is a particular vector in the span?',
        subtitle: 'Equivalent to asking whether Ax = b has a solution',
        actions: [ui.button('Check', { variant: 'primary', size: 'sm', onClick: checkSpan })],
        body: el('div.stack', [
          el('div.row.row--top', [targetInput.element, spanHost]),
        ]),
      }),
    ]);
  }

  /* ------------------------------------------------------------------ *
   * Explanation
   * ------------------------------------------------------------------ */

  function buildAbout() {
    return [
      el('h3', 'Four subspaces, one reduction'),
      el('p', [
        'A matrix that is m×n connects two spaces: it takes vectors from ℝⁿ and produces vectors in ℝᵐ. Each of those ' +
          'spaces splits into two pieces, giving four subspaces in total.',
      ]),
      el('ul', [
        el('li', [el('strong', 'Column space C(A) '), '— everything A can produce. Lives in ℝᵐ, dimension r.']),
        el('li', [el('strong', 'Left null space N(Aᵗ) '), '— what A can never produce. Lives in ℝᵐ, dimension m − r.']),
        el('li', [el('strong', 'Row space R(A) '), '— the inputs that matter. Lives in ℝⁿ, dimension r.']),
        el('li', [el('strong', 'Null space N(A) '), '— the inputs A destroys. Lives in ℝⁿ, dimension n − r.']),
      ]),
      el('h3', 'Rank–nullity, and why it is obvious'),
      el('div.formula.formula--block', 'rank(A) + nullity(A) = n   (the number of columns)'),
      el('p', [
        'Reduce A and look at the columns. Each one either contains a pivot or it does not. Pivot columns contribute a ' +
          'dimension to the column space; free columns contribute a dimension to the null space. There is no third ' +
          'possibility, and every column is counted exactly once — so the two dimensions must add to the number of ' +
          'columns. That is the whole theorem.',
      ]),
      el('p', [
        'Applying the same argument to Aᵗ gives rank + dim N(Aᵗ) = m. And since rank(A) = rank(Aᵗ), the same r appears ' +
          'in both — which is the surprising fact that the number of independent rows always equals the number of ' +
          'independent columns.',
      ]),
      el('h3', 'The perpendicularity'),
      el('p', [
        'The four subspaces are not just four separate things. Inside ℝⁿ the row space and null space are perpendicular ' +
          'complements: every row-space vector is at right angles to every null-space vector, and together their ' +
          'dimensions fill ℝⁿ. The reason is immediate once you look at what Ax = 0 says — each entry of Ax is a row of ' +
          'A dotted with x, so x is in the null space exactly when it is perpendicular to every row.',
      ]),
      el('p', 'The same holds in ℝᵐ for the column space and the left null space, by applying the argument to Aᵗ.'),
      el('div.callout', [
        el('div.callout__title', 'What this buys you'),
        el('p', [
          'These dimensions answer practical questions immediately. Does Ax = b always have a solution? Only if the ' +
            'column space fills ℝᵐ, i.e. r = m. Is the solution unique when it exists? Only if the null space is ' +
            'trivial, i.e. r = n. A square matrix satisfies both exactly when it is invertible.',
        ]),
      ]),
    ];
  }

  ML.registerView({
    id: 'subspaces',
    title: 'Subspaces',
    heading: 'Subspaces & Rank–Nullity',
    tagline: 'Column space, row space, null space, left null space — and the independence, span and basis tools.',
    icon: '⊂',
    build: buildView,
  });
})((globalThis.ML = globalThis.ML || {}));
