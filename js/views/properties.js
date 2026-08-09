/**
 * MatrixLab — Matrix Properties Analyser.
 *
 * One button, one dashboard: every classification MatrixLab can decide, the
 * key numbers, and a short reason for each verdict.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;

  /** Groups keep twenty checkboxes from becoming a wall. */
  const GROUPS = [
    { title: 'Shape', keys: ['square', 'rectangular', 'row', 'column'] },
    { title: 'Pattern', keys: ['zero', 'identity', 'diagonal', 'scalar', 'upper', 'lower', 'permutation'] },
    { title: 'Symmetry', keys: ['symmetric', 'skew'] },
    { title: 'Invertibility', keys: ['singular', 'nonsingular', 'orthogonal'] },
    { title: 'Special behaviour', keys: ['idempotent', 'involutory', 'nilpotent', 'posdef'] },
  ];

  function buildView() {
    const resultHost = el('div');

    const input = ML.store.bind(
      'A',
      new ui.MatrixInput({
        name: 'A',
        rows: 3,
        cols: 3,
        values: ML.store.getValuesOrDefault('A'),
        hint: 'Square matrices unlock the most tests; rectangular ones still report rank, norms and shape.',
        onChange: function () { analyse(false); },
      })
    );

    function analyse(showErrors) {
      const got = input.tryGetMatrix();
      if (!got.ok) {
        ui.clear(resultHost);
        resultHost.appendChild(
          showErrors ? ui.errorPanel(got.error) : ui.emptyState('Fill in every entry, then press Analyse.')
        );
        return;
      }
      ui.safeRender(resultHost, function () { return buildReport(got.matrix); });
    }

    function buildReport(A) {
      const report = ML.analyzeMatrix(A);
      const byKey = {};
      report.properties.forEach(function (property) { byKey[property.key] = property; });

      const numbers = ui.kpis([
        { label: 'Dimensions', node: el('span', report.dimensions) },
        { label: 'Rank', node: el('span', String(report.rank)) },
        { label: 'Nullity', node: el('span', String(report.nullity)), note: report.rank + ' + ' + report.nullity + ' = ' + report.cols + ' columns' },
        report.trace ? { label: 'Trace', value: report.trace } : null,
        report.determinant ? { label: 'Determinant', value: report.determinant } : null,
        {
          label: 'Frobenius norm',
          node: el('span', [
            report.norms.frobenius.exact
              ? ui.renderValue(report.norms.frobenius.exact)
              : el('span', '√' + ML.fmt(report.norms.frobenius.squared) + ' ≈ ' + ML.fmtFixed(report.norms.frobenius.value, ML.config.decimals)),
          ]),
          note: '√(sum of squares)',
        },
        { label: '‖A‖₁', value: report.norms.one, note: 'largest column sum' },
        { label: '‖A‖∞', value: report.norms.infinity, note: 'largest row sum' },
      ]);

      const groups = GROUPS.map(function (group) {
        const items = group.keys
          .map(function (key) { return byKey[key]; })
          .filter(Boolean)
          .map(function (property) {
            return { name: property.name, value: property.value, why: property.why };
          });
        if (!items.length) return null;
        return el('div', [ui.sectionLabel(group.title), ui.propGrid(items)]);
      }).filter(Boolean);

      const headline = summarise(report, byKey);

      return el('div.stack-lg', [
        ui.card({
          title: 'Matrix properties',
          subtitle: report.dimensions,
          actions: [
            ui.button('Row reduce this', {
              size: 'sm',
              onClick: function () { ML.router.navigate('row-reduction'); },
            }),
          ],
          body: el('div.stack', [
            el('div.row.row--top', [
              ui.renderMatrix(A, { label: 'A =' }),
              el('div.stack-sm', { style: { flex: '1', minWidth: '240px' } }, [
                ui.alert(headline.kind, headline.text),
                el('p.small.muted', headline.detail),
              ]),
            ]),
            numbers,
          ]),
        }),
        ui.card({
          title: 'Classification',
          subtitle: 'Each verdict comes with the reason',
          body: el('div.stack', groups),
        }),
        ui.card({
          title: 'Reduced row echelon form',
          subtitle: 'Where the rank comes from',
          body: el('div.stack', [
            el('div.row.row--top', [
              ui.renderMatrix(report.rref, {
                label: 'rref(A) =',
                highlight: { pivots: report.pivots },
              }),
              el('div.small.muted', { style: { maxWidth: '46ch' } }, [
                el('p', [
                  'Elimination leaves ' + report.rank + ' pivot' + (report.rank === 1 ? '' : 's') +
                    ' (highlighted). The rank is that count, and the nullity is the number of columns without a ' +
                    'pivot: ' + report.cols + ' − ' + report.rank + ' = ' + report.nullity + '.',
                ]),
                el('p', 'Because MatrixLab reduces in exact fractions, this pivot count is certain — there is no ' +
                  'rounding decision about whether a small number "counts as" zero.'),
              ]),
            ]),
          ]),
        }),
      ]);
    }

    const controls = ui.card({
      title: 'Analyse a matrix',
      actions: [ui.button('Analyse', { variant: 'primary', onClick: function () { analyse(true); } })],
      body: input.element,
    });

    analyse(false);
    return [controls, resultHost];
  }

  /** A one-line reading of the matrix, in plain language. */
  function summarise(report, byKey) {
    const yes = function (key) { return byKey[key] && byKey[key].value; };

    if (yes('zero')) {
      return { kind: 'info', text: 'This is the zero matrix.', detail: 'Every entry is 0, so it has rank 0 and sends every vector to the origin.' };
    }
    if (yes('identity')) {
      return { kind: 'ok', text: 'This is the identity matrix.', detail: 'It leaves every vector unchanged, and is its own inverse.' };
    }
    if (!report.square) {
      return {
        kind: 'info',
        text: 'A rectangular ' + report.dimensions + ' matrix.',
        detail:
          'It maps ' + report.cols + '-dimensional vectors to ' + report.rows + '-dimensional ones. Determinant, trace ' +
          'and inverse are not defined for rectangular matrices, but rank, norms and the four subspaces all are.',
      };
    }
    if (yes('singular')) {
      return {
        kind: 'warn',
        text: 'Square and singular — no inverse exists.',
        detail:
          'det(A) = 0 and the rank is ' + report.rank + ' out of ' + report.cols + ', so ' + report.nullity +
          ' dimension(s) are collapsed to zero. The null space is non-trivial, which means Ax = 0 has solutions ' +
          'other than x = 0.',
      };
    }
    const extras = [];
    if (yes('symmetric')) extras.push('symmetric');
    if (yes('orthogonal')) extras.push('orthogonal');
    if (yes('diagonal')) extras.push('diagonal');
    if (yes('upper') && !yes('diagonal')) extras.push('upper triangular');
    if (yes('lower') && !yes('diagonal')) extras.push('lower triangular');
    if (yes('posdef')) extras.push('positive definite');
    return {
      kind: 'ok',
      text: 'Square and invertible' + (extras.length ? ', and also ' + extras.join(', ') : '') + '.',
      detail:
        'det(A) = ' + ML.fmt(report.determinant) + ' ≠ 0 and the rank is full at ' + report.rank +
        ', so A⁻¹ exists and Ax = b has exactly one solution for every b.',
    };
  }

  ML.registerView({
    id: 'properties',
    title: 'Matrix Properties',
    tagline: 'Every classification MatrixLab can decide, with the reason for each verdict.',
    icon: '✓',
    build: buildView,
  });
})((globalThis.ML = globalThis.ML || {}));
