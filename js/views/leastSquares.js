/**
 * MatrixLab — Least Squares.
 *
 * Fit a line or curve to data, or solve a general overdetermined system, with
 * the normal equations shown and the fit drawn. Exact rational arithmetic means
 * the fitted slope for integer data comes out as a fraction, not 0.5000001.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;
  const viz = ML.viz;

  const state = {
    mode: ML.store.getSetting('ls.mode', 'fit'),
    degree: Number(ML.store.getSetting('ls.degree', 1)),
    points: ML.store.getSetting('ls.points', '1, 1\n2, 2\n3, 2\n4, 4\n5, 4'),
  };

  function buildView() {
    const tabs = ui.tabs(
      [
        { id: 'fit', label: 'Fit a curve to data', build: buildFit },
        { id: 'system', label: 'Solve Ax ≈ b', build: buildSystem },
        { id: 'about', label: 'How it works', build: buildAbout },
      ],
      {
        initial: state.mode,
        rebuild: true,
        onChange: function (item) {
          state.mode = item.id;
          ML.store.setSetting('ls.mode', item.id);
        },
      }
    );
    return [tabs];
  }

  /* ------------------------------------------------------------------ *
   * Curve fitting
   * ------------------------------------------------------------------ */

  function buildFit() {
    const resultHost = el('div');

    const textArea = el('textarea.input', {
      rows: 7,
      spellcheck: 'false',
      'aria-label': 'Data points, one per line',
      value: state.points,
      placeholder: '1, 1\n2, 2\n3, 2',
      onInput: function (event) {
        state.points = event.target.value;
        ML.store.setSetting('ls.points', state.points);
      },
    });

    const degreePicker = ui.segmented({
      label: 'Model',
      value: String(state.degree),
      options: [
        { value: '1', label: 'Line', title: 'y = c₀ + c₁x' },
        { value: '2', label: 'Quadratic', title: 'y = c₀ + c₁x + c₂x²' },
        { value: '3', label: 'Cubic' },
      ],
      onChange: function (value) {
        state.degree = Number(value);
        ML.store.setSetting('ls.degree', state.degree);
        run();
      },
    });

    function parsePoints(text) {
      const lines = String(text)
        .split(/[\n;]+/)
        .map(function (line) { return line.trim(); })
        .filter(function (line) { return line.length > 0; });
      if (!lines.length) throw new ML.MLError('Enter at least two data points, one per line, as "x, y".');
      return lines.map(function (line, index) {
        const parts = line.split(/[\s,]+/).filter(function (part) { return part.length > 0; });
        if (parts.length !== 2) {
          throw new ML.MLError(
            'Line ' + (index + 1) + ' (“' + line + '”) should have exactly two numbers: an x value and a y value.'
          );
        }
        return [parts[0], parts[1]];
      });
    }

    function run() {
      ui.safeRender(resultHost, function () {
        const points = parsePoints(textArea.value);
        const steps = new ML.StepLog('Fitting by least squares');
        const fit = ML.fitPolynomial(points, state.degree, steps);
        return buildFitResult(fit, steps);
      });
    }

    run();

    return el('div.stack-lg', [
      ui.card({
        title: 'The data',
        actions: [ui.button('Fit', { variant: 'primary', size: 'sm', onClick: run })],
        body: el('div.stack', [
          degreePicker,
          textArea,
          el('p.small.muted', [
            'One point per line, written as ',
            el('code', 'x, y'),
            '. Values may be integers, decimals or fractions. With integer data the fitted coefficients come out as ' +
              'exact fractions.',
          ]),
        ]),
      }),
      resultHost,
    ]);
  }

  function buildFitResult(fit, steps) {
    const coefficients = fit.coefficients;
    const plot = buildFitPlot(fit);

    const table = ui.table(
      ['x', 'y (data)', 'y (fitted)', 'residual'],
      fit.points.map(function (point, index) {
        const fitted = fit.evaluate(point.x.toNumber());
        return [
          { num: true, node: ui.renderValue(point.x) },
          { num: true, node: ui.renderValue(point.y) },
          { num: true, node: el('span', ML.fmtFixed(fitted, ML.config.decimals)) },
          { num: true, node: ui.renderValue(fit.residuals[index]) },
        ];
      })
    );

    return ui.resultBlock({
      formula: 'minimise ‖b − Ax‖²   ⟺   AᵗAx = Aᵗb',
      result: el('div.stack-lg', [
        el('div.result-hero', [
          el('div', [
            el('div.result-hero__label', 'Best fit'),
            el('div.value.value--big', fit.equation),
          ]),
          el('div.small.muted', { style: { maxWidth: '30ch' } }, [
            fit.rSquared
              ? 'R² = ' + ML.fmt(fit.rSquared) + ' ≈ ' + ML.fmtFixed(fit.rSquared.toNumber(), 4)
              : 'R² is undefined because every y value is the same.',
          ]),
        ]),
        plot,
        ui.kpis([
          { label: 'Data points', node: el('span', String(fit.points.length)) },
          { label: 'Model degree', node: el('span', String(fit.degree)) },
          { label: 'Σ residual²', value: fit.residualNormSquared, note: 'the quantity minimised' },
          {
            label: 'Root mean square error',
            node: el('span', ML.fmtFixed(Math.sqrt(fit.residualNormSquared.toNumber() / fit.points.length), 4)),
          },
        ]),
        el('div', [
          ui.sectionLabel('Coefficients — exact'),
          el(
            'div.row.row--tight',
            coefficients.map(function (value, power) {
              return el('span.formula', 'c' + ML.operations.subscript(power) + ' = ' + ML.fmt(value));
            })
          ),
        ]),
        el('div', [ui.sectionLabel('Point by point'), table]),
        ML.isZeroMatrix(fit.leastSquares.orthogonalityCheck)
          ? ui.alert(
              'ok',
              'Aᵗ(b − Ax̂) is exactly zero: the residual vector is perpendicular to every column of the design matrix. ' +
                'That is the certificate that no other coefficients can do better.'
            )
          : ui.alert('error', 'The orthogonality check failed — please report this data set.'),
      ]),
      steps: steps,
      explanation: buildAbout(),
    });
  }

  function buildFitPlot(fit) {
    const xs = fit.points.map(function (point) { return point.x.toNumber(); });
    const ys = fit.points.map(function (point) { return point.y.toNumber(); });
    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);
    const padX = Math.max(1, (maxX - minX) * 0.2);
    const padY = Math.max(1, (maxY - minY) * 0.25);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const span = Math.max((maxX - minX) / 2 + padX, (maxY - minY) / 2 + padY);

    const plot = new viz.Plot({
      span: span,
      aspect: 1.6,
      center: [centerX, centerY],
      ariaLabel: 'Scatter plot of the data with the fitted curve',
      footer: [
        { color: ui.cssVar('--viz-point', '#1e293b'), label: 'data', box: true },
        { color: ui.cssVar('--viz-shape-line', '#4f46e5'), label: 'best fit' },
        { color: ui.cssVar('--viz-eigen1', '#db2777'), label: 'residuals' },
      ],
    });

    plot.setDraw(function (p, ctx) {
      const step = niceStep(span);
      p.drawGrid(ctx, { step: step });
      p.drawAxes(ctx, { step: step });

      // The fitted curve, sampled across the visible range.
      const samples = [];
      for (let i = 0; i <= 120; i++) {
        const x = p.xMin + ((p.xMax - p.xMin) * i) / 120;
        samples.push([x, fit.evaluate(x)]);
      }
      p.drawCurve(ctx, samples, { color: p.colors.shapeLine, width: 2.5 });

      // Residuals as vertical segments: the distances being squared and summed.
      fit.points.forEach(function (point) {
        const x = point.x.toNumber();
        const y = point.y.toNumber();
        p.drawLine(ctx, [x, y], [x, fit.evaluate(x)], { color: p.colors.eigen1, width: 1.5, dashed: true });
      });

      fit.points.forEach(function (point) {
        p.drawPoint(ctx, [point.x.toNumber(), point.y.toNumber()], { color: p.colors.point, radius: 4.5, ring: true });
      });
    });

    return ui.card({
      title: 'The fit',
      subtitle: 'Dashed segments are the residuals — least squares makes the sum of their squares as small as possible',
      tight: true,
      body: plot.mount(),
    });
  }

  function niceStep(span) {
    const raw = span / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const normalised = raw / magnitude;
    const step = normalised >= 5 ? 5 : normalised >= 2 ? 2 : 1;
    return step * magnitude;
  }

  /* ------------------------------------------------------------------ *
   * General overdetermined system
   * ------------------------------------------------------------------ */

  function buildSystem() {
    const resultHost = el('div');

    const inputA = new ui.MatrixInput({
      name: 'A',
      rows: 3,
      cols: 2,
      values: ML.store.getValuesOrDefault('lsA', [['1', '0'], ['0', '1'], ['1', '1']]),
      hint: 'More rows than columns is the usual case — more equations than unknowns.',
      onChange: function (self) {
        ML.store.setValues('lsA', self.values);
        if (inputB.rows !== self.rows) inputB.setSize(self.rows, 1);
      },
    });

    const inputB = new ui.MatrixInput({
      name: 'b',
      rows: 3,
      cols: 1,
      fixedCols: true,
      values: ML.store.getValuesOrDefault('lsB', [['1'], ['1'], ['0']]),
      onChange: function (self) { ML.store.setValues('lsB', self.values); },
    });

    function run() {
      ui.safeRender(resultHost, function () {
        const A = inputA.getMatrix();
        const b = inputB.getMatrix();
        const steps = new ML.StepLog('Least squares via the normal equations');
        const result = ML.leastSquares(A, b, steps);

        const exact = ML.solveLinearSystem(A, b);

        return ui.resultBlock({
          formula: 'AᵗAx̂ = Aᵗb',
          result: el('div.stack-lg', [
            exact.type === 'none'
              ? ui.alert(
                  'info',
                  'Ax = b has no exact solution — b lies outside the column space of A. The least-squares answer below ' +
                    'is the closest MatrixLab can get.'
                )
              : ui.alert(
                  'ok',
                  'This system actually has an exact solution, so least squares reproduces it and the residual is zero.'
                ),
            el('div.row.row--top', [
              ui.renderMatrix(result.solution, { label: 'x̂' }),
              ui.renderMatrix(result.projection, { label: 'Ax̂', caption: 'the projection of b' }),
              ui.renderMatrix(result.residual, { label: 'b − Ax̂', caption: 'the error' }),
            ]),
            ui.kpis([
              { label: '‖error‖²', value: result.residualNormSquared },
              { label: '‖error‖', node: el('span', ML.fmtFixed(result.residualNorm, ML.config.decimals)) },
              { label: 'rank(A)', node: el('span', String(result.rank)) },
              {
                label: 'Unique?',
                node: el('span', result.type === 'unique' ? 'yes' : 'no'),
                note: result.type === 'unique' ? 'A has independent columns' : 'columns are dependent',
              },
            ]),
            el('div', [
              ui.sectionLabel('The normal equations'),
              el('div.row.row--top', [
                ui.renderMatrix(result.normalMatrix, { label: 'AᵗA' }),
                ui.renderMatrix(result.normalVector, { label: 'Aᵗb' }),
              ]),
            ]),
            result.type === 'infinite'
              ? ui.alert(
                  'warn',
                  'The columns of A are dependent, so infinitely many x achieve the same minimum error. One of them is ' +
                    'shown; adding any null-space vector gives another. A minimum-norm choice would need the ' +
                    'pseudoinverse from the SVD.'
                )
              : null,
          ]),
          steps: steps,
          explanation: buildAbout(),
        });
      });
    }

    run();

    return el('div.stack-lg', [
      ui.card({
        title: 'Solve Ax ≈ b',
        actions: [ui.button('Compute', { variant: 'primary', size: 'sm', onClick: run })],
        body: el('div.row.row--top', [inputA.element, inputB.element]),
      }),
      resultHost,
    ]);
  }

  /* ------------------------------------------------------------------ *
   * Explanation
   * ------------------------------------------------------------------ */

  function buildAbout() {
    return [
      el('h3', 'When there is no solution, ask for the closest thing'),
      el('p', [
        'Five data points and a straight line to fit means five equations and two unknowns. Almost always no line passes ' +
          'through all five points, so Ax = b has no solution. Rather than give up, we look for the x that makes Ax as ' +
          'close to b as possible — measuring closeness by the sum of squared errors.',
      ]),
      el('h3', 'Why squares, and why it becomes geometry'),
      el('p', [
        'Ax always lands in the column space of A, whatever x is. So the question becomes: which point of that subspace ' +
          'is nearest to b? The answer is the perpendicular projection. And "perpendicular" means the error b − Ax must ' +
          'have zero dot product with every column of A — which is written Aᵗ(b − Ax) = 0.',
      ]),
      el('div.formula.formula--block', 'Aᵗ(b − Ax̂) = 0   ⟹   AᵗA x̂ = Aᵗb'),
      el('p', [
        'Those are the normal equations. They are always consistent, and when the columns of A are independent AᵗA is ' +
          'invertible and the answer is unique. MatrixLab solves them in exact rational arithmetic, so the fitted ' +
          'coefficients for integer data are exact fractions — and it reports Aᵗ(b − Ax̂) so you can see the ' +
          'perpendicularity is exactly zero rather than nearly zero.',
      ]),
      el('h3', 'Reading R²'),
      el('p', [
        'R² compares the error left by the fit with the error you would have had by just predicting the mean of the y ' +
          'values. R² = 1 means the curve passes through every point; R² = 0 means the fit is no better than the mean. ' +
          'It says nothing about whether the model is sensible — a high R² from an over-flexible curve is a warning, ' +
          'not a triumph.',
      ]),
      el('div.callout', [
        el('div.callout__title', 'The same idea in machine learning'),
        el('p', [
          'Linear regression is exactly this calculation. The "features" are the columns of A, the "targets" are b, and ' +
            'the fitted weights are x̂ = (AᵗA)⁻¹Aᵗb. Everything later — regularisation, gradient descent, ' +
            'generalised linear models — is a variation on projecting onto a subspace.',
        ]),
      ]),
      el('div.callout.callout--try', [
        el('div.callout__title', 'Try this'),
        el('p', [
          'Fit a line to points that lie exactly on a line and watch the residuals vanish and R² become exactly 1. Then ' +
            'move one point and see how the whole line shifts — least squares spreads the disagreement across all the ' +
            'data rather than honouring any single point.',
        ]),
      ]),
    ];
  }

  ML.registerView({
    id: 'least-squares',
    title: 'Least Squares',
    tagline: 'Fit a line or curve to data, or solve an overdetermined system, by projecting onto the column space.',
    icon: '≈',
    build: buildView,
  });
})((globalThis.ML = globalThis.ML || {}));
