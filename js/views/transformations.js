/**
 * MatrixLab — Matrix Transformation Visualiser.
 *
 * A 2×2 matrix is a recipe for bending the plane. This view shows that
 * directly: where the grid goes, where the unit square goes, what happens to
 * the two basis vectors, and how the determinant shows up as the change in
 * area. The morph slider makes the deformation continuous rather than a jump.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;
  const viz = ML.viz;

  /** Kept in module scope so a re-render keeps your settings. */
  const state = {
    entries: ML.store.getSetting('viz.matrix', ['1', '1', '0', '1']),
    probe: ML.store.getSetting('viz.probe', ['1', '2']),
    t: 1,
    show: Object.assign(
      { grid: true, square: true, basis: true, probe: true, eigen: true, original: true },
      ML.store.getSetting('viz.show', {})
    ),
  };

  const PRESETS = [
    { label: 'Identity', entries: ['1', '0', '0', '1'], note: 'changes nothing' },
    { label: 'Rotate 90°', entries: ['0', '-1', '1', '0'], note: 'det = 1, no real eigenvector' },
    { label: 'Scale ×2', entries: ['2', '0', '0', '2'], note: 'det = 4, areas quadruple' },
    { label: 'Stretch x', entries: ['3', '0', '0', '1'], note: 'det = 3' },
    { label: 'Shear', entries: ['1', '1', '0', '1'], note: 'det = 1, area preserved' },
    { label: 'Reflect in x-axis', entries: ['1', '0', '0', '-1'], note: 'det = −1, orientation flips' },
    { label: 'Reflect in y = x', entries: ['0', '1', '1', '0'], note: 'det = −1' },
    { label: 'Project onto x-axis', entries: ['1', '0', '0', '0'], note: 'det = 0, the plane collapses' },
    { label: 'Squash (singular)', entries: ['1', '2', '2', '4'], note: 'det = 0, everything lands on a line' },
    { label: 'Rotate + scale', entries: ['1', '-1', '1', '1'], note: 'det = 2, complex eigenvalues' },
  ];

  function buildView() {
    const canvasHost = el('div');
    const readoutHost = el('div');

    const plot = new viz.Plot({
      span: 4.5,
      aspect: 1.15,
      ariaLabel: 'The unit square and grid before and after the transformation',
      footer: [
        { color: ui.cssVar('--viz-original', '#94a3b8'), label: 'before' },
        { color: ui.cssVar('--viz-grid-strong', '#cfd6e4'), label: 'transformed grid' },
        { color: ui.cssVar('--viz-shape-line', '#4f46e5'), label: 'image of the unit square', box: true },
        { color: ui.cssVar('--viz-v1', '#4f46e5'), label: 'first column (î ↦)' },
        { color: ui.cssVar('--viz-v2', '#0d9488'), label: 'second column (ĵ ↦)' },
        { color: ui.cssVar('--viz-eigen1', '#db2777'), label: 'eigenvector directions' },
      ],
    });

    /* ------------------------------- inputs ---------------------------- */

    const input = new ui.MatrixInput({
      name: 'A',
      rows: 2,
      cols: 2,
      square: true,
      min: 2,
      max: 2,
      allowResize: false,
      showTools: false,
      values: [
        [state.entries[0], state.entries[1]],
        [state.entries[2], state.entries[3]],
      ],
      onChange: function (self) {
        state.entries = [self.values[0][0], self.values[0][1], self.values[1][0], self.values[1][1]];
        ML.store.setSetting('viz.matrix', state.entries);
        syncSliders();
        redraw();
      },
    });

    const sliders = [];
    const SLIDER_LABELS = ['a  (row 1, col 1)', 'b  (row 1, col 2)', 'c  (row 2, col 1)', 'd  (row 2, col 2)'];

    function buildSlider(index) {
      const value = Number(state.entries[index]);
      const slider = el('input.range', {
        type: 'range',
        min: '-3',
        max: '3',
        step: '0.25',
        value: String(Number.isFinite(value) ? value : 0),
        'aria-label': SLIDER_LABELS[index],
        onInput: function (event) {
          state.entries[index] = event.target.value;
          ML.store.setSetting('viz.matrix', state.entries);
          input.setValues([
            [state.entries[0], state.entries[1]],
            [state.entries[2], state.entries[3]],
          ]);
          redraw();
        },
      });
      sliders.push(slider);
      return el('div.field', [el('span.label.tiny', SLIDER_LABELS[index]), slider]);
    }

    function syncSliders() {
      sliders.forEach(function (slider, index) {
        const value = Number(state.entries[index]);
        if (Number.isFinite(value)) slider.value = String(value);
      });
    }

    const morph = el('input.range', {
      type: 'range',
      min: '0',
      max: '1',
      step: '0.02',
      value: String(state.t),
      'aria-label': 'Morph from the identity to A',
      onInput: function (event) {
        state.t = Number(event.target.value);
        redraw();
      },
    });

    const probeInputs = [0, 1].map(function (index) {
      return ui.numberInput({
        value: state.probe[index],
        ariaLabel: index === 0 ? 'Probe vector x component' : 'Probe vector y component',
        onInput: function (value) {
          state.probe[index] = value;
          ML.store.setSetting('viz.probe', state.probe);
          redraw();
        },
      });
    });

    const toggles = [
      ['original', 'Original grid'],
      ['grid', 'Transformed grid'],
      ['square', 'Unit square'],
      ['basis', 'Basis vectors'],
      ['probe', 'Probe vector'],
      ['eigen', 'Eigenvector directions'],
    ].map(function (pair) {
      return el('label.checkbox', [
        el('input', {
          type: 'checkbox',
          checked: state.show[pair[0]],
          onChange: function (event) {
            state.show[pair[0]] = event.target.checked;
            ML.store.setSetting('viz.show', state.show);
            redraw();
          },
        }),
        pair[1],
      ]);
    });

    const presetButtons = PRESETS.map(function (preset) {
      return ui.button(preset.label, {
        size: 'sm',
        variant: 'ghost',
        title: preset.note,
        onClick: function () {
          state.entries = preset.entries.slice();
          state.t = 1;
          morph.value = '1';
          ML.store.setSetting('viz.matrix', state.entries);
          input.setValues([
            [state.entries[0], state.entries[1]],
            [state.entries[2], state.entries[3]],
          ]);
          syncSliders();
          redraw();
        },
      });
    });

    /* ------------------------------ drawing ---------------------------- */

    function redraw() {
      const got = input.tryGetMatrix();
      if (!got.ok) {
        ui.clear(readoutHost);
        readoutHost.appendChild(ui.errorPanel(got.error));
        return;
      }
      const A = got.matrix;
      const flat = viz.flat2(A);
      const current = viz.lerpFromIdentity(flat, state.t);

      plot.setDraw(function (p, ctx) {
        if (state.show.original) {
          p.drawGrid(ctx, { step: 1 });
        }
        if (state.show.grid) {
          p.drawTransformedGrid(ctx, current, { color: p.colors.gridStrong, alpha: 1 });
        }
        p.drawAxes(ctx, { step: 1 });

        // The unit square, before and after.
        const unit = [[0, 0], [1, 0], [1, 1], [0, 1]];
        if (state.show.square) {
          if (state.show.original) {
            p.drawPolygon(ctx, unit, { fill: false, stroke: p.colors.original, dashed: true, width: 1.5 });
          }
          p.drawPolygon(ctx, unit.map(function (point) { return viz.apply2(current, point); }), {
            fill: p.colors.shape,
            stroke: p.colors.shapeLine,
            width: 2,
          });
        }

        // Eigenvector directions: the lines the transformation leaves alone.
        if (state.show.eigen && state.t > 0.98) {
          drawEigenLines(p, ctx, A);
        }

        if (state.show.basis) {
          const i = viz.apply2(current, [1, 0]);
          const j = viz.apply2(current, [0, 1]);
          if (state.show.original) {
            p.drawArrow(ctx, [0, 0], [1, 0], { color: p.colors.original, width: 1.5, alpha: 0.75, dashed: true });
            p.drawArrow(ctx, [0, 0], [0, 1], { color: p.colors.original, width: 1.5, alpha: 0.75, dashed: true });
          }
          p.drawArrow(ctx, [0, 0], i, { color: p.colors.v1, label: 'A î' });
          p.drawArrow(ctx, [0, 0], j, { color: p.colors.v2, label: 'A ĵ' });
        }

        if (state.show.probe) {
          const probe = readProbe();
          if (probe) {
            const image = viz.apply2(current, probe);
            p.drawArrow(ctx, [0, 0], probe, { color: p.colors.original, dashed: true, width: 2, label: 'v' });
            p.drawArrow(ctx, [0, 0], image, { color: p.colors.eigen2, width: 2.5, label: 'A v' });
          }
        }

        if (state.t < 0.999) {
          p.drawBadge(ctx, 'morph t = ' + state.t.toFixed(2), 10, 10, p.colors.shapeLine);
        }
      });
      plot.refresh();

      ui.safeRender(readoutHost, function () { return buildReadout(A, flat); });
    }

    function readProbe() {
      try {
        return [ML.Frac.parse(state.probe[0]).toNumber(), ML.Frac.parse(state.probe[1]).toNumber()];
      } catch (error) {
        return null;
      }
    }

    function drawEigenLines(p, ctx, A) {
      let analysis;
      try {
        analysis = ML.eigenAnalysis(A);
      } catch (error) {
        return;
      }
      const colors = [p.colors.eigen1, p.colors.eigen2];
      let used = 0;
      analysis.pairs.forEach(function (pair) {
        if (ML.isComplexEigenvalue(pair.eigenvalue)) return;
        const vectors = pair.vectors
          ? pair.vectors.map(function (v) { return [v.get(0, 0).toNumber(), v.get(1, 0).toNumber()]; })
          : (pair.numericVectors || []).map(function (v) { return [v[0].re, v[1].re]; });
        vectors.forEach(function (direction) {
          const color = colors[used % colors.length];
          used++;
          p.drawSpanLine(ctx, direction, { color: color, dashed: [4, 4], width: 1.5 });
          const length = Math.hypot(direction[0], direction[1]);
          if (length > 1e-9) {
            const unit = [direction[0] / length, direction[1] / length];
            const scale = pair.eigenvalue.complex.re;
            p.drawArrow(ctx, [0, 0], unit, { color: color, width: 2 });
            p.drawArrow(ctx, [0, 0], [unit[0] * scale, unit[1] * scale], {
              color: color,
              width: 3,
              alpha: 0.65,
              label: 'λ = ' + pair.eigenvalue.text,
            });
          }
        });
      });
    }

    /* ----------------------------- readouts ---------------------------- */

    function buildReadout(A, flat) {
      const determinant = ML.determinant(A);
      const rank = ML.matrixRank(A);
      const classification = classify(A, flat);
      const probe = readProbe();

      const kpis = ui.kpis([
        { label: 'Determinant', value: determinant, note: 'signed area factor' },
        {
          label: 'Area of the image',
          node: el('span', ML.fmt(determinant.abs())),
          note: 'the unit square had area 1',
        },
        {
          label: 'Orientation',
          node: el('span', determinant.isZero() ? 'collapsed' : determinant.isNegative() ? 'flipped' : 'preserved'),
        },
        { label: 'Rank', node: el('span', String(rank)), note: rank < 2 ? 'not invertible' : 'invertible' },
      ]);

      const probeRow = probe
        ? el('div.row.row--top', [
            ui.renderMatrix(ML.Matrix.column([state.probe[0], state.probe[1]]), { label: 'v' }),
            el('span.matrix-row__op', '↦'),
            ui.renderMatrix(ML.multiplyMatrices(A, ML.Matrix.column([state.probe[0], state.probe[1]])), { label: 'A v' }),
          ])
        : el('p.small', { style: { color: 'var(--err-fg)' } }, 'The probe vector has an entry that cannot be read.');

      return el('div.stack', [
        ui.alert(determinant.isZero() ? 'warn' : 'info', classification.text, classification.title),
        kpis,
        el('div', [ui.sectionLabel('Where a chosen vector goes'), probeRow]),
        determinant.isZero()
          ? ui.alert(
              'warn',
              'Because the determinant is 0, the whole plane is squashed onto a ' +
                (rank === 0 ? 'single point' : 'line') +
                '. Different starting vectors land on the same place, so the transformation cannot be undone — this is ' +
                'exactly what "singular" means.'
            )
          : null,
      ]);
    }

    /* ------------------------------- layout ---------------------------- */

    canvasHost.appendChild(plot.mount());

    const controls = ui.card({
      title: 'The matrix',
      subtitle: 'Type the entries, or drag the sliders',
      body: el('div.stack', [
        el('div.row.row--top', [
          input.element,
          el('div.stack-sm', { style: { flex: '1', minWidth: '220px' } }, [buildSlider(0), buildSlider(1), buildSlider(2), buildSlider(3)]),
        ]),
        el('div.field', [
          el('span.label', 'Morph from the identity to A'),
          morph,
          el('span.tiny.muted', 'Slide to watch the plane deform continuously. Eigenvector lines appear at t = 1.'),
        ]),
        el('div.field', [
          el('span.label', 'Probe vector v'),
          el('div.row.row--tight', [probeInputs[0], probeInputs[1]]),
        ]),
        el('div', [ui.sectionLabel('Show'), el('div.row.row--tight', toggles)]),
        el('div', [ui.sectionLabel('Presets'), el('div.row.row--tight', presetButtons)]),
      ]),
    });

    redraw();

    return [
      el('div.grid-2', [
        el('div.stack', [ui.card({ title: 'The plane, transformed', tight: true, body: canvasHost }), readoutHost]),
        controls,
      ]),
      ui.card({ title: 'What you are looking at', body: buildExplanation() }),
    ];
  }

  /**
   * Name the transformation when it is one of the recognisable kinds. This is
   * decided from exact properties, not from appearances.
   */
  function classify(A, flat) {
    const determinant = ML.determinant(A);
    const [a, b, c, d] = flat;

    if (ML.isIdentity(A)) {
      return { title: 'The identity', text: 'Every vector is left exactly where it was.' };
    }
    if (ML.isZeroMatrix(A)) {
      return { title: 'The zero map', text: 'Every vector is sent to the origin. Nothing survives.' };
    }
    if (ML.isOrthogonal(A)) {
      if (determinant.isOne()) {
        const angle = (Math.atan2(c, a) * 180) / Math.PI;
        return {
          title: 'A rotation',
          text:
            'The columns are perpendicular unit vectors and the determinant is 1, so this is a pure rotation — about ' +
            ML.fmtFixed(angle, 2) + '° anticlockwise. Lengths and angles are unchanged, and no real direction is fixed ' +
            '(which is why the eigenvalues are complex).',
        };
      }
      return {
        title: 'A reflection',
        text:
          'The columns are perpendicular unit vectors but the determinant is −1, so this is a reflection. Lengths are ' +
          'preserved, orientation is reversed, and there is a mirror line that stays put — the eigenvector for λ = 1.',
      };
    }
    if (ML.isDiagonal(A)) {
      return {
        title: 'A scaling',
        text:
          'The axes are stretched independently: x by ' + ML.fmt(A.get(0, 0)) + ' and y by ' + ML.fmt(A.get(1, 1)) +
          '. The coordinate axes are the eigenvector directions, and the diagonal entries are the eigenvalues.',
      };
    }
    if ((a === 1 && d === 1 && c === 0 && b !== 0) || (a === 1 && d === 1 && b === 0 && c !== 0)) {
      return {
        title: 'A shear',
        text:
          'One axis stays fixed while points are slid parallel to it by an amount proportional to their distance from ' +
          'it. The determinant is 1, so areas are unchanged even though shapes are distorted.',
      };
    }
    if (determinant.isZero()) {
      const rank = ML.matrixRank(A);
      return {
        title: rank === 0 ? 'Collapses to a point' : 'Collapses to a line',
        text:
          'The determinant is 0, so the plane is flattened. The image is the column space — ' +
          (rank === 1 ? 'a single line through the origin' : 'just the origin') +
          ' — and the null space is the set of directions crushed to zero.',
      };
    }
    if (ML.isSymmetric(A)) {
      return {
        title: 'A symmetric transformation',
        text:
          'Because A is symmetric, it stretches along two perpendicular directions. Those directions are its ' +
          'eigenvectors, and they always come out at right angles for a symmetric matrix.',
      };
    }
    return {
      title: 'A general linear map',
      text:
        'Straight lines stay straight, parallel lines stay parallel, and the origin stays put — that is all a linear ' +
        'map ever does. Areas are multiplied by ' + ML.fmt(determinant.abs()) +
        (determinant.isNegative() ? ' with orientation reversed.' : '.'),
    };
  }

  function buildExplanation() {
    return el('div.lesson', [
      el('h3', 'Columns are destinations'),
      el('p', [
        'The single most useful fact about a matrix: its columns tell you where the basis vectors land. Column 1 is the ' +
          'image of î = (1, 0), column 2 is the image of ĵ = (0, 1). Because the map is linear, that is enough to ' +
          'determine everything — any vector (x, y) goes to x·(column 1) + y·(column 2).',
      ]),
      el('p', [
        'Watch the transformed grid: the lines stay straight and evenly spaced, and lines that were parallel stay ' +
          'parallel. Linear maps cannot bend or curve anything. What they can do is stretch, rotate, reflect, shear and ' +
          'flatten.',
      ]),
      el('h3', 'The determinant is the area factor'),
      el('p', [
        'The unit square has area 1. After the transformation it becomes a parallelogram whose area is |det A|. If the ' +
          'determinant is negative, the parallelogram has been flipped over — the corners now run the other way round. ' +
          'If it is zero, the square has been squashed flat and the area is gone, which is exactly why a zero ' +
          'determinant means no inverse.',
      ]),
      el('h3', 'Eigenvectors are the directions that survive'),
      el('p', [
        'Most arrows change direction. Turn on the eigenvector lines and you will see the exceptions: directions the ' +
          'matrix only lengthens or shortens. The factor is the eigenvalue. A rotation has none (in real terms), a ' +
          'scaling has two obvious ones, and a shear has just one.',
      ]),
      el('div.callout.callout--try', [
        el('div.callout__title', 'Worth trying'),
        el('ul', [
          el('li', 'Set the shear preset and watch the area stay the same while the shape distorts.'),
          el('li', 'Set “Squash (singular)” and notice the whole plane land on one line.'),
          el('li', 'Set “Reflect in y = x” and find the mirror line among the eigenvector lines.'),
          el('li', 'Use the morph slider on “Rotate 90°” to see the square turn without ever changing size.'),
        ]),
      ]),
    ]);
  }

  ML.registerView({
    id: 'transformations',
    title: 'Transformations',
    heading: 'Matrix Transformation Visualiser',
    tagline: 'See what a 2×2 matrix does to the plane: the grid, the unit square, the basis vectors and the area.',
    icon: '⟳',
    build: buildView,
  });
})((globalThis.ML = globalThis.ML || {}));
