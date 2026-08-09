/**
 * MatrixLab — Orthogonality.
 *
 * Gram–Schmidt with every step shown, projection onto a subspace, and
 * orthogonal complements. The orthogonal vectors are exact; only the final
 * normalisation needs decimals, and that boundary is made explicit.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;
  const viz = ML.viz;

  const state = {
    tool: ML.store.getSetting('orth.tool', 'gram-schmidt'),
  };

  function buildView() {
    const input = ML.store.bind(
      'A',
      new ui.MatrixInput({
        name: 'V',
        rows: 3,
        cols: 3,
        values: ML.store.getValuesOrDefault('A', [['1', '1', '0'], ['1', '0', '1'], ['0', '1', '1']]),
        hint: 'Each column is one vector. Gram–Schmidt processes them left to right.',
      })
    );

    const tabs = ui.tabs(
      [
        { id: 'gram-schmidt', label: 'Gram–Schmidt', build: function () { return buildGramSchmidt(input); } },
        { id: 'projection', label: 'Projection onto a subspace', build: function () { return buildProjection(input); } },
        { id: 'complement', label: 'Orthogonal complement', build: function () { return buildComplement(input); } },
        { id: 'about', label: 'Why orthogonality helps', build: buildAbout },
      ],
      {
        initial: state.tool,
        rebuild: true,
        onChange: function (item) {
          state.tool = item.id;
          ML.store.setSetting('orth.tool', item.id);
        },
      }
    );

    return [
      ui.card({
        title: 'The vectors',
        subtitle: 'Given as the columns of a matrix',
        body: input.element,
      }),
      tabs,
    ];
  }

  /* ------------------------------------------------------------------ *
   * Gram–Schmidt
   * ------------------------------------------------------------------ */

  function buildGramSchmidt(input) {
    const got = input.tryGetMatrix();
    if (!got.ok) return ui.errorPanel(got.error);
    const A = got.matrix;
    const columns = A.columns();

    const steps = new ML.StepLog('The Gram–Schmidt process');
    const result = ML.gramSchmidt(columns, steps);

    const before = el('div.vector-list', columns.map(function (column, index) {
      return ui.renderMatrix(ML.Matrix.column(column), {
        label: 'v' + ML.operations.subscript(index + 1),
        caption: result.dropped.indexOf(index) >= 0 ? 'dependent — dropped' : null,
      });
    }));

    const orthogonal = el('div.vector-list', result.orthogonal.map(function (vector, index) {
      return ui.renderMatrix(vector, { label: 'u' + ML.operations.subscript(index + 1), caption: 'exact' });
    }));

    const orthonormal = el('div.vector-list', result.orthonormal.map(function (entry, index) {
      return ui.renderMatrix(entry.vector, {
        label: 'ê' + ML.operations.subscript(index + 1),
        caption: '‖u' + ML.operations.subscript(index + 1) + '‖ = ' + entry.normText + (entry.exact ? '' : ' (irrational)'),
      });
    }));

    const picture = A.rows === 2 ? buildGramSchmidtPicture(columns, result) : null;

    return el('div.stack-lg', [
      ui.resultBlock({
        formula: 'uₖ = vₖ − Σᵢ₌₁..ₖ₋₁ proj_{uᵢ}(vₖ),    êₖ = uₖ / ‖uₖ‖',
        result: el('div.stack-lg', [
          result.dropped.length
            ? ui.alert(
                'warn',
                'Vector' + (result.dropped.length === 1 ? ' ' : 's ') +
                  result.dropped.map(function (i) { return i + 1; }).join(', ') +
                  ' turned out to be dependent — nothing was left after removing the projections, so ' +
                  (result.dropped.length === 1 ? 'it was' : 'they were') + ' dropped. The remaining ' +
                  result.dimension + ' vectors span the same subspace.'
              )
            : ui.alert('ok', 'All ' + columns.length + ' vectors were independent, so the process produced ' + result.dimension +
                ' orthogonal directions spanning the same subspace.'),
          el('div', [ui.sectionLabel('Input vectors'), before]),
          el('div', [
            ui.sectionLabel('Orthogonal set — exact'),
            orthogonal,
            el('p.small.muted', [
              'Every pair has dot product exactly zero. Because the arithmetic is rational throughout, these vectors ' +
                'are perpendicular as a matter of fact, not to within a tolerance.',
            ]),
          ]),
          el('div', [
            ui.sectionLabel('Orthonormal set' + (result.exact ? ' — exact' : ' — decimals')),
            orthonormal,
            el('p.small.muted', [
              result.exact
                ? 'Every length happened to be rational, so even the unit vectors are exact.'
                : 'Normalising divides by a length, and lengths are usually irrational — so these components are ' +
                  'decimal approximations. Quote the exact orthogonal vectors above when you need exactness.',
            ]),
          ]),
          el('div', [
            ui.sectionLabel('Verification'),
            el(
              'ul.step__list',
              result.orthogonalityChecks.map(function (check) {
                return el('li', 'u' + ML.operations.subscript(check.i + 1) + ' · u' +
                  ML.operations.subscript(check.j + 1) + ' = ' + ML.fmt(check.value));
              })
            ),
          ]),
        ]),
        steps: steps,
        explanation: buildAbout(),
      }),
      picture,
    ]);
  }

  function buildGramSchmidtPicture(columns, result) {
    const points = columns.map(function (column) {
      return [column[0].toNumber(), column[1].toNumber()];
    });
    const orthogonalPoints = result.orthogonal.map(function (vector) {
      return [vector.get(0, 0).toNumber(), vector.get(1, 0).toNumber()];
    });
    const span = Math.max(
      3,
      Math.ceil(Math.max.apply(null, points.concat(orthogonalPoints).map(function (point) {
        return Math.max(Math.abs(point[0]), Math.abs(point[1]));
      })) * 1.6)
    );

    const plot = new viz.Plot({
      span: span,
      aspect: 1.3,
      ariaLabel: 'The original vectors and the orthogonal set produced from them',
      footer: [
        { color: ui.cssVar('--viz-original', '#94a3b8'), label: 'original vᵢ', dashed: true },
        { color: ui.cssVar('--viz-v1', '#4f46e5'), label: 'orthogonal uᵢ' },
        { color: ui.cssVar('--viz-eigen1', '#db2777'), label: 'projection removed' },
      ],
    });

    plot.setDraw(function (p, ctx) {
      p.drawGrid(ctx, { step: 1 });
      p.drawAxes(ctx, { step: 1 });
      points.forEach(function (point, index) {
        p.drawArrow(ctx, [0, 0], point, {
          color: p.colors.original,
          dashed: true,
          width: 2,
          label: 'v' + (index + 1),
        });
      });
      // The correction that turns v₂ into u₂ is the interesting part.
      if (points.length > 1 && orthogonalPoints.length > 1) {
        p.drawLine(ctx, points[1], orthogonalPoints[1], { color: p.colors.eigen1, dashed: true, width: 1.5 });
      }
      orthogonalPoints.forEach(function (point, index) {
        p.drawArrow(ctx, [0, 0], point, { color: p.colors.v1, width: 3, label: 'u' + (index + 1) });
      });
    });

    return ui.card({
      title: 'In the plane',
      subtitle: 'The dashed correction is the projection being removed',
      tight: true,
      body: plot.mount(),
    });
  }

  /* ------------------------------------------------------------------ *
   * Projection onto a subspace
   * ------------------------------------------------------------------ */

  function buildProjection(input) {
    const got = input.tryGetMatrix();
    if (!got.ok) return ui.errorPanel(got.error);
    const A = got.matrix;
    const columns = A.columns();

    const targetInput = new ui.MatrixInput({
      name: 'b',
      rows: A.rows,
      cols: 1,
      fixedCols: true,
      allowResize: false,
      showTools: false,
      values: ML.store.getValuesOrDefault('projTarget', defaultTarget(A.rows)),
      onChange: function (self) { ML.store.setValues('projTarget', self.values); },
    });

    const host = el('div');

    function run() {
      ui.safeRender(host, function () {
        const target = targetInput.getMatrix();
        const steps = new ML.StepLog('Projecting onto the subspace');
        const result = ML.projectOntoSubspace(columns, target, steps);

        let matrixPanel = null;
        try {
          const pm = ML.projectionMatrix(A);
          matrixPanel = el('div', [
            ui.sectionLabel('The projection matrix'),
            el('div.row.row--top', [
              ui.renderMatrix(pm.P, { label: 'P = A(AᵗA)⁻¹Aᵗ' }),
              el('div.small.muted', { style: { maxWidth: '40ch' } }, [
                el('p', [
                  'Multiplying any vector by P projects it onto the column space. P is symmetric and satisfies P² = P — ' +
                    'projecting something that is already in the subspace changes nothing.',
                ]),
                el('p', [
                  'Pb gives the same answer as the sum of one-dimensional projections above, which is a useful check ' +
                    'that both routes agree.',
                ]),
              ]),
            ]),
          ]);
        } catch (error) {
          matrixPanel = ui.alert('info', error.message, 'No projection matrix formula here');
        }

        return ui.resultBlock({
          formula: 'proj(b) = Σₖ ((b · uₖ)/(uₖ · uₖ)) uₖ',
          result: el('div.stack-lg', [
            el('div.row.row--top', [
              ui.renderMatrix(target, { label: 'b' }),
              el('span.matrix-row__op', '→'),
              ui.renderMatrix(result.projection, { label: 'proj(b)', caption: 'closest point in the subspace' }),
              ui.renderMatrix(result.residual, { label: 'b − proj(b)', caption: 'the error, perpendicular' }),
            ]),
            ui.alert(
              'ok',
              'The error is exactly perpendicular to every direction in the subspace — which is precisely what makes ' +
                'this the closest point. Any other point in the subspace is further from b.'
            ),
            matrixPanel,
          ]),
          steps: steps,
          explanation: [
            el('p', [
              'Projecting onto a subspace answers "what is the closest thing in here to b?". The answer is characterised ' +
                'by its error: the difference b − proj(b) must be perpendicular to the whole subspace. If it were not, ' +
                'you could slide along the subspace and get closer.',
            ]),
            el('p', [
              'With a perpendicular basis this is easy — project onto each direction separately and add. That is why ' +
                'Gram–Schmidt is worth the effort, and it is the same calculation that underlies least squares.',
            ]),
          ],
        });
      });
    }

    run();

    return el('div.stack', [
      ui.card({
        title: 'The vector to project',
        actions: [ui.button('Project', { variant: 'primary', size: 'sm', onClick: run })],
        body: targetInput.element,
      }),
      host,
    ]);
  }

  function defaultTarget(rows) {
    const preferred = ['3', '4', '5', '1', '0', '0', '0', '0', '0', '0'];
    const values = [];
    for (let i = 0; i < rows; i++) values.push([preferred[i] || '0']);
    return values;
  }

  /* ------------------------------------------------------------------ *
   * Orthogonal complement
   * ------------------------------------------------------------------ */

  function buildComplement(input) {
    const got = input.tryGetMatrix();
    if (!got.ok) return ui.errorPanel(got.error);
    const A = got.matrix;
    const columns = A.columns();

    const steps = new ML.StepLog('Finding the orthogonal complement');
    const result = ML.orthogonalComplement(columns, steps);

    const verification = [];
    result.basis.forEach(function (vector, i) {
      columns.forEach(function (column, j) {
        verification.push(
          'w' + ML.operations.subscript(i + 1) + ' · v' + ML.operations.subscript(j + 1) + ' = ' +
            ML.fmt(ML.dotProduct(vector, ML.Matrix.column(column)))
        );
      });
    });

    return ui.resultBlock({
      formula: 'S⊥ = { x : v · x = 0 for every v in S } = N(Vᵗ)',
      result: el('div.stack-lg', [
        ui.kpis([
          { label: 'Ambient space', node: el('span', 'ℝ' + ML.operations.superscript(result.ambient)) },
          { label: 'dim(span)', node: el('span', String(result.spanDimension)) },
          { label: 'dim(complement)', node: el('span', String(result.dimension)) },
        ]),
        el('p.small.muted', result.relation),
        result.basis.length
          ? el('div', [
              ui.sectionLabel('A basis for the complement'),
              el(
                'div.vector-list',
                result.basis.map(function (vector, index) {
                  return ui.renderMatrix(vector, { label: 'w' + ML.operations.subscript(index + 1) });
                })
              ),
            ])
          : ui.alert(
              'info',
              'The complement contains only the zero vector: these vectors already span the whole of ℝ' +
                ML.operations.superscript(result.ambient) + ', so there is no direction left that is perpendicular to all of them.'
            ),
        verification.length
          ? el('div', [
              ui.sectionLabel('Verification — every pairing is zero'),
              el('ul.step__list', verification.slice(0, 12).map(function (line) { return el('li', line); })),
            ])
          : null,
      ]),
      steps: steps,
      explanation: [
        el('p', [
          'The orthogonal complement of a subspace is everything perpendicular to all of it. Turning that into a ' +
            'calculation is a nice trick: writing the spanning vectors as the rows of a matrix V, the condition ' +
            '"perpendicular to every one of them" is exactly Vx = 0 — so the complement is a null space.',
        ]),
        el('p', [
          'Dimensions always add up: dim(S) + dim(S⊥) equals the dimension of the whole space. And taking the ' +
            'complement twice gets you back where you started.',
        ]),
      ],
    });
  }

  /* ------------------------------------------------------------------ *
   * Explanation
   * ------------------------------------------------------------------ */

  function buildAbout() {
    return [
      el('h3', 'Why bother making things perpendicular?'),
      el('p', [
        'With an arbitrary basis, finding the coordinates of a vector means solving a linear system. With an ' +
          'orthogonal basis, each coordinate is a single dot product: the component of b along uₖ is (b·uₖ)/(uₖ·uₖ), ' +
          'independent of every other direction. Nothing has to be solved at all.',
      ]),
      el('p', [
        'That independence is the real prize. Changing one coordinate does not disturb the others, projections become ' +
          'sums of one-dimensional projections, and numerical calculations stop amplifying rounding error.',
      ]),
      el('h3', 'How Gram–Schmidt works'),
      el('p', [
        'Take the vectors in order. Keep the first. For each later one, subtract off its projection onto everything ' +
          'already accepted — what remains cannot have any component along those earlier directions, so it is ' +
          'perpendicular to all of them. Finally divide each by its length to get unit vectors.',
      ]),
      el('p', [
        'If a vector was already in the span of the earlier ones, subtracting the projections leaves exactly zero. ' +
          'That is not a failure — it is the process detecting a dependency, and MatrixLab reports which vector it was.',
      ]),
      el('div.callout', [
        el('div.callout__title', 'A caution worth knowing'),
        el('p', [
          'In floating-point arithmetic the classical Gram–Schmidt process loses orthogonality badly when vectors are ' +
            'nearly parallel, because subtracting two close quantities destroys precision. MatrixLab avoids this by ' +
            'working in exact fractions here, and by using Householder reflections for the QR decomposition. ' +
            'It is a good illustration of why numerical linear algebra is a subject in its own right.',
        ]),
      ]),
      el('h3', 'Where this leads'),
      el('p', [
        'Orthogonal projection onto a subspace is the whole content of least squares: fitting a line to data means ' +
          'projecting the data vector onto the column space of the design matrix. The QR decomposition is Gram–Schmidt ' +
          'written as a matrix factorisation. And orthogonal matrices — square matrices with orthonormal columns — are ' +
          'exactly the transformations that preserve lengths and angles.',
      ]),
    ];
  }

  ML.registerView({
    id: 'orthogonality',
    title: 'Orthogonality',
    tagline: 'Gram–Schmidt step by step, projection onto a subspace, and orthogonal complements.',
    icon: '⊥',
    build: buildView,
  });
})((globalThis.ML = globalThis.ML || {}));
