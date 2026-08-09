/**
 * MatrixLab — Visualisations.
 *
 * Two pictures that carry a lot of the intuition in the subject: the
 * determinant as a signed area, and eigenvectors as the directions a
 * transformation leaves pointing the same way.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;
  const viz = ML.viz;

  const state = {
    tab: ML.store.getSetting('vizview.tab', 'determinant'),
    det: ML.store.getSetting('vizview.det', ['3', '1', '1', '2']),
    eig: ML.store.getSetting('vizview.eig', ['2', '1', '1', '2']),
    probeAngle: 30,
  };

  function buildView() {
    return [
      ui.tabs(
        [
          { id: 'determinant', label: 'Determinant as area', build: buildDeterminant },
          { id: 'eigen', label: 'Eigenvectors', build: buildEigen },
          { id: 'volume', label: '3×3 and volume', build: buildVolume },
        ],
        {
          initial: state.tab,
          rebuild: true,
          onChange: function (item) {
            state.tab = item.id;
            ML.store.setSetting('vizview.tab', item.id);
          },
        }
      ),
    ];
  }

  /* ------------------------------------------------------------------ *
   * Determinant as area
   * ------------------------------------------------------------------ */

  function buildDeterminant() {
    const readoutHost = el('div');
    const plot = new viz.Plot({
      span: 4.5,
      aspect: 1.15,
      ariaLabel: 'The unit square and the parallelogram formed by the columns of the matrix',
      footer: [
        { color: ui.cssVar('--viz-original', '#94a3b8'), label: 'unit square (area 1)', box: true },
        { color: ui.cssVar('--viz-shape-line', '#4f46e5'), label: 'image parallelogram', box: true },
        { color: ui.cssVar('--viz-v1', '#4f46e5'), label: 'column 1' },
        { color: ui.cssVar('--viz-v2', '#0d9488'), label: 'column 2' },
      ],
    });

    const input = new ui.MatrixInput({
      name: 'A',
      rows: 2,
      cols: 2,
      square: true,
      min: 2,
      max: 2,
      allowResize: false,
      showTools: false,
      values: [[state.det[0], state.det[1]], [state.det[2], state.det[3]]],
      onChange: function (self) {
        state.det = [self.values[0][0], self.values[0][1], self.values[1][0], self.values[1][1]];
        ML.store.setSetting('vizview.det', state.det);
        redraw();
      },
    });

    function redraw() {
      const got = input.tryGetMatrix();
      if (!got.ok) {
        ui.clear(readoutHost);
        readoutHost.appendChild(ui.errorPanel(got.error));
        return;
      }
      const A = got.matrix;
      const flat = viz.flat2(A);
      const determinant = ML.determinant(A);
      const column1 = [flat[0], flat[2]];
      const column2 = [flat[1], flat[3]];

      plot.options.span = Math.max(3, Math.ceil(Math.max(
        Math.abs(column1[0]) + Math.abs(column2[0]),
        Math.abs(column1[1]) + Math.abs(column2[1])
      ) * 0.8) + 1);

      plot.setDraw(function (p, ctx) {
        p.drawGrid(ctx, { step: 1 });
        p.drawAxes(ctx, { step: 1 });

        p.drawPolygon(ctx, [[0, 0], [1, 0], [1, 1], [0, 1]], {
          fill: 'transparent',
          stroke: p.colors.original,
          dashed: true,
          width: 1.5,
        });

        const corner = [column1[0] + column2[0], column1[1] + column2[1]];
        p.drawPolygon(ctx, [[0, 0], column1, corner, column2], {
          fill: p.colors.shape,
          stroke: p.colors.shapeLine,
          width: 2,
        });

        p.drawArrow(ctx, [0, 0], column1, { color: p.colors.v1, label: 'col 1' });
        p.drawArrow(ctx, [0, 0], column2, { color: p.colors.v2, label: 'col 2' });

        const centre = [corner[0] / 2, corner[1] / 2];
        if (!determinant.isZero()) {
          p.drawText(ctx, 'area = ' + ML.fmt(determinant.abs()), centre, {
            color: p.colors.shapeLine,
            font: '600 13px system-ui, sans-serif',
            align: 'center',
          });
        }
        p.drawBadge(ctx, 'det = ' + ML.fmt(determinant), 10, 10, p.colors.shapeLine);
      });
      plot.refresh();

      ui.safeRender(readoutHost, function () { return determinantReadout(A, determinant); });
    }

    const presets = [
      { label: 'Identity', entries: ['1', '0', '0', '1'] },
      { label: 'Double both axes', entries: ['2', '0', '0', '2'] },
      { label: 'Shear (area 1)', entries: ['1', '1', '0', '1'] },
      { label: 'Reflection', entries: ['1', '0', '0', '-1'] },
      { label: 'Singular', entries: ['2', '1', '4', '2'] },
      { label: 'Negative determinant', entries: ['0', '1', '1', '0'] },
    ].map(function (preset) {
      return ui.button(preset.label, {
        size: 'sm',
        variant: 'ghost',
        onClick: function () {
          state.det = preset.entries.slice();
          ML.store.setSetting('vizview.det', state.det);
          input.setValues([[state.det[0], state.det[1]], [state.det[2], state.det[3]]]);
          redraw();
        },
      });
    });

    redraw();

    return el('div.stack-lg', [
      el('div.grid-2', [
        el('div.stack', [ui.card({ title: 'Columns as a parallelogram', tight: true, body: plot.mount() }), readoutHost]),
        ui.card({
          title: 'The matrix',
          body: el('div.stack', [
            input.element,
            el('div', [ui.sectionLabel('Presets'), el('div.row.row--tight', presets)]),
          ]),
        }),
      ]),
      ui.card({ title: 'What the determinant measures', body: determinantExplanation() }),
    ]);
  }

  function determinantReadout(A, determinant) {
    const rank = ML.matrixRank(A);
    return el('div.stack', [
      ui.kpis([
        { label: 'det(A)', value: determinant },
        { label: 'Area of the parallelogram', node: el('span', ML.fmt(determinant.abs())) },
        {
          label: 'Orientation',
          node: el('span', determinant.isZero() ? 'flattened' : determinant.isNegative() ? 'reversed' : 'preserved'),
        },
        { label: 'Invertible', node: el('span', determinant.isZero() ? 'no' : 'yes') },
      ]),
      determinant.isZero()
        ? ui.alert(
            'warn',
            'The two columns are parallel, so they span no area at all — the parallelogram has collapsed to a ' +
              (rank === 0 ? 'point' : 'line') + '. This is what a determinant of zero means, and why such a matrix ' +
              'has no inverse: area (and therefore information) has been destroyed.'
          )
        : determinant.isNegative()
        ? ui.alert(
            'info',
            'The determinant is negative, so orientation has been reversed: going from column 1 to column 2 now turns ' +
              'the opposite way round compared with going from î to ĵ. The area is the absolute value, ' +
              ML.fmt(determinant.abs()) + '.'
          )
        : ui.alert(
            'ok',
            'The unit square of area 1 has become a parallelogram of area ' + ML.fmt(determinant) +
              ', and every other region in the plane has its area multiplied by the same factor.'
          ),
    ]);
  }

  function determinantExplanation() {
    return el('div.lesson', [
      el('h3', 'Area, not arithmetic'),
      el('p', [
        'The formula ad − bc looks arbitrary until you see what it measures. Put the two columns of the matrix at the ' +
          'origin and complete the parallelogram: ad − bc is its signed area. That single interpretation explains ' +
          'almost every property of determinants.',
      ]),
      el('ul', [
        el('li', [
          el('strong', 'Why zero means singular. '),
          'Zero area means the two columns are parallel, so the transformation squashes the plane onto a line. Different ' +
            'inputs land on the same output, and nothing can undo that.',
        ]),
        el('li', [
          el('strong', 'Why the sign matters. '),
          'A negative determinant means the parallelogram has been flipped over — the transformation includes a ' +
            'reflection. Areas are still measured by the absolute value.',
        ]),
        el('li', [
          el('strong', 'Why det(AB) = det(A)det(B). '),
          'Applying two transformations in a row multiplies areas twice, so the area factors multiply.',
        ]),
        el('li', [
          el('strong', 'Why adding a multiple of one row to another changes nothing. '),
          'Sliding one side of a parallelogram parallel to the other keeps the base and height, so the area is unchanged. ' +
            'That is exactly why elimination preserves the determinant.',
        ]),
      ]),
      el('h3', 'In higher dimensions'),
      el('p', [
        'In three dimensions the three columns span a parallelepiped and the determinant is its signed volume. In n ' +
          'dimensions it is the n-dimensional volume factor. The story never changes: the determinant tells you what ' +
          'happens to volume, and zero volume always means information has been lost.',
      ]),
      el('div.callout.callout--try', [
        el('div.callout__title', 'Try this'),
        el('p', [
          'Load the shear preset. The parallelogram leans right over, yet the determinant stays exactly 1 — because the ' +
            'base and the height are both unchanged. Then load the singular preset and watch the shape vanish entirely.',
        ]),
      ]),
    ]);
  }

  /* ------------------------------------------------------------------ *
   * Eigenvector visualisation
   * ------------------------------------------------------------------ */

  function buildEigen() {
    const readoutHost = el('div');
    const plot = new viz.Plot({
      span: 3.5,
      aspect: 1.15,
      ariaLabel: 'Vectors around a circle and their images, showing which directions are unchanged',
      footer: [
        { color: ui.cssVar('--viz-original', '#94a3b8'), label: 'unit vectors' },
        { color: ui.cssVar('--viz-shape-line', '#4f46e5'), label: 'their images Av' },
        { color: ui.cssVar('--viz-eigen1', '#db2777'), label: 'eigenvector 1' },
        { color: ui.cssVar('--viz-eigen2', '#ea580c'), label: 'eigenvector 2' },
      ],
    });

    const input = new ui.MatrixInput({
      name: 'A',
      rows: 2,
      cols: 2,
      square: true,
      min: 2,
      max: 2,
      allowResize: false,
      showTools: false,
      values: [[state.eig[0], state.eig[1]], [state.eig[2], state.eig[3]]],
      onChange: function (self) {
        state.eig = [self.values[0][0], self.values[0][1], self.values[1][0], self.values[1][1]];
        ML.store.setSetting('vizview.eig', state.eig);
        redraw();
      },
    });

    const angleSlider = el('input.range', {
      type: 'range',
      min: '0',
      max: '360',
      step: '1',
      value: String(state.probeAngle),
      'aria-label': 'Direction of the probe vector, in degrees',
      onInput: function (event) {
        state.probeAngle = Number(event.target.value);
        redraw();
      },
    });

    function redraw() {
      const got = input.tryGetMatrix();
      if (!got.ok) {
        ui.clear(readoutHost);
        readoutHost.appendChild(ui.errorPanel(got.error));
        return;
      }
      const A = got.matrix;
      const flat = viz.flat2(A);

      let analysis = null;
      try {
        analysis = ML.eigenAnalysis(A);
      } catch (error) {
        analysis = null;
      }

      const realDirections = [];
      if (analysis) {
        analysis.pairs.forEach(function (pair) {
          if (ML.isComplexEigenvalue(pair.eigenvalue)) return;
          const vectors = pair.vectors
            ? pair.vectors.map(function (v) { return [v.get(0, 0).toNumber(), v.get(1, 0).toNumber()]; })
            : (pair.numericVectors || []).map(function (v) { return [v[0].re, v[1].re]; });
          vectors.forEach(function (direction) {
            realDirections.push({ direction: direction, value: pair.eigenvalue });
          });
        });
      }

      const maxStretch = Math.max(1, Math.abs(flat[0]) + Math.abs(flat[1]), Math.abs(flat[2]) + Math.abs(flat[3]));
      plot.options.span = Math.max(2.5, maxStretch * 1.4);

      plot.setDraw(function (p, ctx) {
        p.drawGrid(ctx, { step: 1 });
        p.drawAxes(ctx, { step: 1 });

        // A ring of unit vectors and where each one goes: the eigenvector
        // directions are the ones whose image stays on the same line.
        const count = 24;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          const v = [Math.cos(angle), Math.sin(angle)];
          const image = viz.apply2(flat, v);
          p.drawArrow(ctx, [0, 0], v, { color: p.colors.original, width: 1, alpha: 0.35, head: false });
          p.drawArrow(ctx, [0, 0], image, { color: p.colors.shapeLine, width: 1, alpha: 0.4, head: false });
        }

        const eigenColors = [p.colors.eigen1, p.colors.eigen2];
        realDirections.forEach(function (entry, index) {
          const color = eigenColors[index % eigenColors.length];
          const length = Math.hypot(entry.direction[0], entry.direction[1]);
          if (length < 1e-12) return;
          const unit = [entry.direction[0] / length, entry.direction[1] / length];
          p.drawSpanLine(ctx, unit, { color: color, dashed: [4, 4], width: 1.5 });
          p.drawArrow(ctx, [0, 0], unit, { color: color, width: 2.5 });
          const scale = entry.value.complex.re;
          p.drawArrow(ctx, [0, 0], [unit[0] * scale, unit[1] * scale], {
            color: color,
            width: 3.5,
            alpha: 0.7,
            label: 'λ = ' + entry.value.text,
          });
        });

        // The user-chosen probe direction, so the "does it stay put?" question
        // can be explored by hand.
        const radians = (state.probeAngle * Math.PI) / 180;
        const probe = [Math.cos(radians), Math.sin(radians)];
        const image = viz.apply2(flat, probe);
        p.drawArrow(ctx, [0, 0], probe, { color: p.colors.v2, width: 2.5, dashed: true, label: 'v' });
        p.drawArrow(ctx, [0, 0], image, { color: p.colors.v2, width: 3, label: 'Av' });
      });
      plot.refresh();

      ui.safeRender(readoutHost, function () { return eigenReadout(A, analysis, flat); });
    }

    function eigenReadout(A, analysis, flat) {
      const radians = (state.probeAngle * Math.PI) / 180;
      const probe = [Math.cos(radians), Math.sin(radians)];
      const image = viz.apply2(flat, probe);
      const imageAngle = Math.atan2(image[1], image[0]);
      const turned = Math.abs(normaliseAngle(imageAngle - radians));
      const aligned = turned < 0.02 || Math.abs(turned - Math.PI) < 0.02;

      return el('div.stack', [
        ui.alert(
          aligned ? 'ok' : 'info',
          aligned
            ? 'At ' + state.probeAngle + '° the image lies on the same line as v — this direction is (very close to) an ' +
              'eigenvector, and the stretch factor is the eigenvalue.'
            : 'At ' + state.probeAngle + '° the image points ' + ML.fmtFixed((turned * 180) / Math.PI, 1) +
              '° away from v, so this is not an eigenvector direction. Sweep the slider to find the directions where ' +
              'the two arrows line up.',
          aligned ? 'Aligned' : 'Not aligned'
        ),
        analysis
          ? el('div.stack-sm', [
              ui.sectionLabel('Eigenvalues'),
              el(
                'div.row.row--tight',
                analysis.pairs.map(function (pair, index) {
                  return ui.badge(
                    'λ' + ML.operations.subscript(index + 1) + ' = ' + pair.eigenvalue.text,
                    pair.eigenvalue.kind === 'complex' ? 'warn' : 'brand'
                  );
                })
              ),
              analysis.hasComplex
                ? ui.alert(
                    'info',
                    'The eigenvalues are complex, which means no real direction is preserved — every arrow gets turned. ' +
                      'That is exactly what a rotation does, and it is why no eigenvector lines are drawn.'
                  )
                : null,
              el('p.small.muted', analysis.diagonalizableReason),
            ])
          : ui.alert('info', 'Eigenvalues could not be computed for this matrix.'),
      ]);
    }

    const presets = [
      { label: 'Symmetric', entries: ['2', '1', '1', '2'], note: 'perpendicular eigenvectors' },
      { label: 'Distinct λ', entries: ['4', '1', '2', '3'] },
      { label: 'Diagonal', entries: ['3', '0', '0', '1'], note: 'the axes are the eigenvectors' },
      { label: 'Shear (defective)', entries: ['1', '1', '0', '1'], note: 'only one eigenvector' },
      { label: 'Rotation', entries: ['0', '-1', '1', '0'], note: 'no real eigenvector' },
      { label: 'Reflection', entries: ['0', '1', '1', '0'], note: 'λ = 1 and λ = −1' },
      { label: 'Projection', entries: ['1', '0', '0', '0'], note: 'λ = 1 and λ = 0' },
    ].map(function (preset) {
      return ui.button(preset.label, {
        size: 'sm',
        variant: 'ghost',
        title: preset.note,
        onClick: function () {
          state.eig = preset.entries.slice();
          ML.store.setSetting('vizview.eig', state.eig);
          input.setValues([[state.eig[0], state.eig[1]], [state.eig[2], state.eig[3]]]);
          redraw();
        },
      });
    });

    redraw();

    return el('div.stack-lg', [
      el('div.grid-2', [
        el('div.stack', [ui.card({ title: 'Directions and their images', tight: true, body: plot.mount() }), readoutHost]),
        ui.card({
          title: 'The matrix',
          body: el('div.stack', [
            input.element,
            el('div.field', [
              el('span.label', 'Probe direction: ' + state.probeAngle + '°'),
              angleSlider,
              el('span.tiny.muted', 'Sweep round and watch for the angles where v and Av line up.'),
            ]),
            el('div', [ui.sectionLabel('Presets'), el('div.row.row--tight', presets)]),
          ]),
        }),
      ]),
      ui.card({ title: 'Seeing eigenvectors', body: eigenExplanation() }),
    ]);
  }

  function normaliseAngle(angle) {
    let value = angle;
    while (value > Math.PI) value -= Math.PI * 2;
    while (value < -Math.PI) value += Math.PI * 2;
    return value;
  }

  function eigenExplanation() {
    return el('div.lesson', [
      el('h3', 'The picture behind the formula'),
      el('p', [
        'The faint grey arrows are unit vectors pointing in every direction; the faint blue arrows are where the matrix ' +
          'sends them. Almost all of them get turned as well as stretched. The eigenvector directions are the ' +
          'exceptions: there, the blue arrow lies exactly along the grey one, only longer or shorter.',
      ]),
      el('p', [
        'That is all Av = λv says. The matrix does not rotate an eigenvector, it merely scales it — and λ is the scale ' +
          'factor. A negative λ means the arrow flips to point the opposite way along the same line; λ = 1 means the ' +
          'direction is completely fixed; λ = 0 means it is crushed to the origin.',
      ]),
      el('h3', 'What the presets show'),
      el('ul', [
        el('li', [el('strong', 'Symmetric. '), 'The two eigenvector lines meet at exactly 90°. This always happens for symmetric matrices, and is the reason they are so well behaved.']),
        el('li', [el('strong', 'Rotation. '), 'No grey and blue arrow ever line up. There is no real eigenvector at all — the eigenvalues are complex, and the picture shows why that is inevitable rather than a technicality.']),
        el('li', [el('strong', 'Shear. '), 'Only one line survives. The eigenvalue 1 is repeated but brings just one direction with it, which is what "defective" means and why this matrix cannot be diagonalised.']),
        el('li', [el('strong', 'Projection. '), 'One direction is fixed (λ = 1) and one is annihilated (λ = 0). The zero eigenvalue is the null space, made visible.']),
      ]),
      el('h3', 'Why anyone cares'),
      el('p', [
        'If you repeat a transformation many times, the eigenvector with the largest |λ| takes over: whatever you start ' +
          'with drifts towards that direction, growing by roughly λ each step. That single observation explains ' +
          'population models, the long-run behaviour of Markov chains, the stability of physical systems, and why ' +
          'principal component analysis picks out the directions it does.',
      ]),
    ]);
  }

  /* ------------------------------------------------------------------ *
   * 3×3 determinant as volume
   * ------------------------------------------------------------------ */

  function buildVolume() {
    const host = el('div');

    const input = ML.store.bind(
      'A',
      new ui.MatrixInput({
        name: 'A',
        rows: 3,
        cols: 3,
        square: true,
        min: 3,
        max: 3,
        allowResize: false,
        values: ML.store.getValuesOrDefault('A', [['2', '0', '1'], ['1', '3', '2'], ['1', '1', '4']]),
        onChange: run,
      })
    );

    function run() {
      ui.safeRender(host, function () {
        const A = input.getMatrix();
        const determinant = ML.determinant(A);
        const columns = A.columns();
        const cross = ML.crossProduct(ML.Matrix.column(columns[1]), ML.Matrix.column(columns[2]));
        const triple = ML.dotProduct(ML.Matrix.column(columns[0]), cross);

        return el('div.stack-lg', [
          ui.kpis([
            { label: 'det(A)', value: determinant },
            { label: 'Volume of the parallelepiped', node: el('span', ML.fmt(determinant.abs())) },
            {
              label: 'Handedness',
              node: el('span', determinant.isZero() ? 'flat' : determinant.isPositive() ? 'right-handed' : 'left-handed'),
            },
            { label: 'Rank', node: el('span', String(ML.matrixRank(A))) },
          ]),
          determinant.isZero()
            ? ui.alert(
                'warn',
                'The three columns are coplanar, so they enclose no volume — the parallelepiped is flat. The matrix is ' +
                  'singular and the three column directions do not span all of three-dimensional space.'
              )
            : ui.alert(
                'ok',
                'The unit cube of volume 1 becomes a parallelepiped of volume ' + ML.fmt(determinant.abs()) +
                  ', so every region of space has its volume multiplied by that factor.'
              ),
          el('div', [
            ui.sectionLabel('The same number three ways'),
            el('div.stack-sm', [
              el('div.formula', 'det(A) = ' + ML.fmt(determinant)),
              el('div.formula', 'col₁ · (col₂ × col₃) = ' + ML.fmt(triple) + '   (the scalar triple product)'),
              el('div.formula', 'signed volume of the parallelepiped = ' + ML.fmt(determinant)),
            ]),
            el('p.small.muted', [
              'The scalar triple product is the determinant. col₂ × col₃ is perpendicular to the base with length equal ' +
                'to the base area, so dotting with col₁ picks out the height — base × height = volume.',
            ]),
          ]),
          el('div.row.row--top', [
            ui.renderMatrix(A, { label: 'A =' }),
            el('div.vector-list', columns.map(function (column, index) {
              return ui.renderMatrix(ML.Matrix.column(column), { label: 'col ' + (index + 1) });
            })),
          ]),
          el('div.lesson', [
            el('h3', 'Why there is no picture here'),
            el('p', [
              'A believable three-dimensional parallelepiped needs rotation and depth cues to be readable, and a static ' +
                'projection tends to mislead more than it explains. Rather than draw something that could be ' +
                'misinterpreted, MatrixLab gives the numbers exactly and relies on the two-dimensional picture in the ' +
                'other tab to carry the intuition — the idea transfers directly: area becomes volume, and zero still ' +
                'means collapsed.',
            ]),
          ]),
        ]);
      });
    }

    run();

    return el('div.stack-lg', [
      ui.card({
        title: 'A 3×3 matrix',
        actions: [ui.button('Update', { variant: 'primary', size: 'sm', onClick: run })],
        body: input.element,
      }),
      host,
    ]);
  }

  ML.registerView({
    id: 'visualizations',
    title: 'Visualisations',
    heading: 'Determinants & Eigenvectors, Visually',
    tagline: 'The determinant as area and volume, and eigenvectors as the directions a matrix leaves alone.',
    icon: '◱',
    build: buildView,
  });
})((globalThis.ML = globalThis.ML || {}));
