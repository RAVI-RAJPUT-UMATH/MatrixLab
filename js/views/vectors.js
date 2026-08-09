/**
 * MatrixLab — Vector Calculator.
 *
 * All the standard vector operations, exact where the mathematics allows, with
 * a picture whenever the vectors are two-dimensional.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;
  const viz = ML.viz;

  const state = {
    op: ML.store.getSetting('vec.op', 'dot'),
    scalar: ML.store.getSetting('vec.scalar', '2'),
    size: Number(ML.store.getSetting('vec.size', 3)),
  };

  const OPS = {
    add: { label: 'u + v', title: 'Vector addition', needsV: true },
    subtract: { label: 'u − v', title: 'Vector subtraction', needsV: true },
    scale: { label: 'k·u', title: 'Scalar multiplication', needsV: false, needsScalar: true },
    dot: { label: 'u · v', title: 'Dot product', needsV: true },
    cross: { label: 'u × v', title: 'Cross product', needsV: true, size: 3 },
    norm: { label: '‖u‖', title: 'Magnitude', needsV: false },
    unit: { label: 'û', title: 'Unit vector', needsV: false },
    distance: { label: 'distance', title: 'Distance between two vectors', needsV: true },
    angle: { label: 'angle', title: 'Angle between two vectors', needsV: true },
    projection: { label: 'proj', title: 'Projection of u onto v', needsV: true },
    orthogonal: { label: 'u ⊥ v ?', title: 'Orthogonality test', needsV: true },
    combination: { label: 'linear combination', title: 'Linear combination', needsV: true, needsScalar: true },
  };

  function buildView() {
    const op = OPS[state.op] || OPS.dot;
    const size = op.size ? op.size : state.size;
    const resultHost = el('div');

    const inputU = new ui.MatrixInput({
      name: 'u',
      rows: size,
      cols: 1,
      fixedCols: true,
      max: 8,
      values: ML.store.getValuesOrDefault('u', defaultColumn(size, ['3', '4', '0'])),
      onChange: function (self) {
        ML.store.setValues('u', self.values);
        if (!op.size) {
          state.size = self.rows;
          ML.store.setSetting('vec.size', self.rows);
          if (inputV.rows !== self.rows) inputV.setSize(self.rows, 1);
        }
        compute(false);
      },
    });

    const inputV = new ui.MatrixInput({
      name: 'v',
      rows: size,
      cols: 1,
      fixedCols: true,
      max: 8,
      values: ML.store.getValuesOrDefault('v', defaultColumn(size, ['1', '2', '2'])),
      onChange: function (self) {
        ML.store.setValues('v', self.values);
        if (self.rows !== inputU.rows) inputU.setSize(self.rows, 1);
        compute(false);
      },
    });

    const scalarField = ui.numberInput({
      label: state.op === 'combination' ? 'Coefficient for u' : 'Scalar k',
      value: state.scalar,
      onInput: function (value) {
        state.scalar = value;
        ML.store.setSetting('vec.scalar', value);
        compute(false);
      },
    });

    const scalarField2 = ui.numberInput({
      label: 'Coefficient for v',
      value: ML.store.getSetting('vec.scalar2', '-1'),
      onInput: function (value) {
        ML.store.setSetting('vec.scalar2', value);
        compute(false);
      },
    });

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
            ML.store.setSetting('vec.op', key);
            ML.router.render();
          },
        });
      })
    );

    function compute(showErrors) {
      const gotU = inputU.tryGetMatrix();
      const gotV = op.needsV ? inputV.tryGetMatrix() : { ok: true, matrix: null };
      if (!gotU.ok || !gotV.ok) {
        ui.clear(resultHost);
        resultHost.appendChild(
          showErrors ? ui.errorPanel(gotU.ok ? gotV.error : gotU.error) : ui.emptyState('Fill in every entry, then press Calculate.')
        );
        return;
      }
      ui.safeRender(resultHost, function () { return buildResult(gotU.matrix, gotV.matrix); });
    }

    function buildResult(u, v) {
      const steps = new ML.StepLog(op.title);
      const outcome = runOperation(state.op, u, v, steps);
      const picture = u.rows === 2 ? buildPicture(state.op, u, v, outcome) : null;

      return el('div.stack-lg', [
        ui.resultBlock({
          formula: outcome.formula,
          result: el('div.stack', [outcome.node, outcome.extra]),
          steps: steps,
          explanation: outcome.explanation,
        }),
        picture,
      ]);
    }

    function runOperation(key, u, v, steps) {
      switch (key) {
        case 'add':
          return matrixOutcome(ML.vectorAdd(u, v, steps), 'u + v', '(u + v)ᵢ = uᵢ + vᵢ', [
            el('p', [
              'Adding vectors component by component is the same as travelling along u and then along v. The result is ' +
                'the diagonal of the parallelogram they form.',
            ]),
          ]);
        case 'subtract':
          return matrixOutcome(ML.vectorSubtract(u, v, steps), 'u − v', '(u − v)ᵢ = uᵢ − vᵢ', [
            el('p', 'u − v is the arrow from the tip of v to the tip of u, so its length is the distance between the two points.'),
          ]);
        case 'scale':
          return matrixOutcome(ML.vectorScale(u, ML.Frac.parse(state.scalar), steps), state.scalar + '·u', '(k·u)ᵢ = k·uᵢ', [
            el('p', 'Scaling changes the length by |k| and reverses the direction when k is negative. The line through u is unchanged.'),
          ]);
        case 'dot': {
          const value = ML.dotProduct(u, v, steps);
          return {
            formula: 'u · v = u₁v₁ + u₂v₂ + … = ‖u‖‖v‖cos θ',
            node: heroValue('u · v', value, dotMeaning(value)),
            extra: null,
            explanation: [
              el('p', [
                'The dot product takes two vectors and returns a number. Its sign alone tells you a lot: positive means ' +
                  'the vectors broadly agree in direction, negative means they broadly oppose, and zero means they are ' +
                  'exactly perpendicular.',
              ]),
              el('p', [
                'It is the foundation for length (‖u‖² = u·u), for angle, for projection, and for the whole idea of ' +
                  'orthogonality. Written with matrices it is uᵗv.',
              ]),
            ],
          };
        }
        case 'cross':
          return matrixOutcome(ML.crossProduct(u, v, steps), 'u × v', 'u × v ⊥ u and v', [
            el('p', [
              'The cross product exists only in three dimensions. It returns a vector perpendicular to both inputs, ' +
                'with length equal to the area of the parallelogram they span, pointing according to the right-hand rule.',
            ]),
            el('p', 'It is zero exactly when the vectors are parallel — parallel vectors span no area.'),
          ]);
        case 'norm': {
          const norm = ML.vectorNorm(u, steps);
          return {
            formula: '‖u‖ = √(u₁² + u₂² + …)',
            node: heroValue(
              '‖u‖',
              norm.exact || norm.text,
              norm.exact
                ? 'The square root is rational, so this length is exact.'
                : 'Irrational, shown in surd form. Decimal: ' + ML.fmtFixed(norm.value, ML.config.decimals)
            ),
            extra: el('p.small.muted', '‖u‖² = ' + ML.fmt(norm.squared) + ' (always exact)'),
            explanation: [
              el('p', 'Length is Pythagoras applied one coordinate at a time, and it works in any number of dimensions.'),
              el('p', [
                'Lengths are usually irrational, which is why MatrixLab keeps ‖u‖² exact and shows the root separately — ' +
                  'squared lengths stay in the rationals and are what most formulas actually use.',
              ]),
            ],
          };
        }
        case 'unit': {
          const unit = ML.normalizeVector(u, steps);
          return {
            formula: 'û = u / ‖u‖,   ‖û‖ = 1',
            node: el('div.row.row--top', [
              ui.renderMatrix(u, { label: 'u' }),
              el('span.matrix-row__op', '→'),
              ui.renderMatrix(unit.vector, { label: 'û' }),
            ]),
            extra: el(
              'p.small.muted',
              unit.exact
                ? 'The length was rational, so the unit vector is exact.'
                : 'The length ' + unit.norm.text + ' is irrational, so these components are decimals.'
            ),
            explanation: [
              el('p', [
                'Normalising keeps the direction and throws away the length. Unit vectors are the natural way to talk ' +
                  'about direction on its own, and orthonormal bases are built from them.',
              ]),
            ],
          };
        }
        case 'distance': {
          const distance = ML.vectorDistance(u, v, steps);
          return {
            formula: 'd(u, v) = ‖u − v‖',
            node: heroValue(
              'd(u, v)',
              distance.exact || distance.text,
              distance.exact ? 'Exact.' : 'Decimal: ' + ML.fmtFixed(distance.value, ML.config.decimals)
            ),
            extra: null,
            explanation: [el('p', 'Subtract to get the arrow joining the two points, then measure its length.')],
          };
        }
        case 'angle': {
          const angle = ML.vectorAngle(u, v, steps);
          return {
            formula: 'cos θ = (u · v) / (‖u‖‖v‖)',
            node: heroValue(
              'θ',
              angle.text,
              angle.perpendicular
                ? 'Exactly 90°: the dot product is exactly zero.'
                : angle.parallel
                ? 'The vectors are parallel.'
                : 'cos θ = ' + (angle.cosine ? ML.fmt(angle.cosine) : ML.fmtFixed(angle.cosineValue, 6))
            ),
            extra: el('p.small.muted', ML.fmtFixed(angle.radians, 6) + ' radians'),
            explanation: [
              el('p', [
                'Rearranging u·v = ‖u‖‖v‖cos θ gives the angle. Even when the cosine is an exact fraction, the angle ' +
                  'itself is almost always irrational, so it is reported as a decimal.',
              ]),
            ],
          };
        }
        case 'projection': {
          const result = ML.projection(u, v, steps);
          return {
            formula: 'proj_v(u) = ((u · v)/(v · v)) v',
            node: el('div.row.row--top', [
              ui.renderMatrix(result.projection, { label: 'proj_v(u)' }),
              ui.renderMatrix(result.rejection, { label: 'u − proj_v(u)', caption: 'perpendicular to v' }),
            ]),
            extra: el('p.small.muted', 'Coefficient along v: ' + ML.fmt(result.coefficient) + ' — exact, because it is a ratio of dot products.'),
            explanation: [
              el('p', [
                'The projection is the shadow u casts on the line through v: the closest point on that line. What is ' +
                  'left over is perpendicular to v, which splits u cleanly into a part along v and a part across it.',
              ]),
              el('p', 'This single idea scales up to least squares, where you project onto a whole subspace instead of one line.'),
            ],
          };
        }
        case 'orthogonal': {
          const dot = ML.dotProduct(u, v, steps);
          const perpendicular = dot.isZero();
          return {
            formula: 'u ⊥ v  ⟺  u · v = 0',
            node: ui.alert(
              perpendicular ? 'ok' : 'info',
              perpendicular
                ? 'u · v = 0 exactly, so u and v are perpendicular.'
                : 'u · v = ' + ML.fmt(dot) + ', which is not zero, so the vectors are not perpendicular. ' +
                  'The angle between them is ' + ML.vectorAngle(u, v).text + '.',
              perpendicular ? 'Orthogonal' : 'Not orthogonal'
            ),
            extra: null,
            explanation: [
              el('p', [
                'Perpendicularity is defined by the dot product being zero — which is what lets the idea extend to ' +
                  'dimensions you cannot picture. Because MatrixLab computes the dot product exactly, this answer is ' +
                  'never a rounding judgement.',
              ]),
            ],
          };
        }
        case 'combination': {
          const c1 = ML.Frac.parse(state.scalar);
          const c2 = ML.Frac.parse(ML.store.getSetting('vec.scalar2', '-1'));
          const result = ML.linearCombination([u, v], [c1, c2], steps);
          return {
            formula: 'c₁u + c₂v',
            node: el('div.row.row--top', [
              ui.renderMatrix(result, { label: ML.fmt(c1) + 'u + ' + ML.fmt(c2) + 'v' }),
            ]),
            extra: null,
            explanation: [
              el('p', [
                'Every vector you can build by scaling and adding lies in the span of u and v. If u and v are ' +
                  'independent and two-dimensional, that span is the whole plane — every vector is reachable.',
              ]),
            ],
          };
        }
        default:
          throw new ML.MLError('Unknown vector operation.');
      }
    }

    function matrixOutcome(result, label, formula, explanation) {
      return {
        formula: formula,
        node: el('div.row.row--top', [ui.renderMatrix(result, { label: label })]),
        extra: el('div.row.row--tight', [ui.copyButton(function () { return ui.matrixToText(result); }, 'Copy')]),
        explanation: explanation,
      };
    }

    function heroValue(label, value, note) {
      return el('div.result-hero', [
        el('div', [
          el('div.result-hero__label', label),
          el('div.value.value--big', [typeof value === 'string' ? value : ui.renderValue(value)]),
        ]),
        note ? el('div.small.muted', { style: { maxWidth: '40ch' } }, note) : null,
      ]);
    }

    function dotMeaning(value) {
      if (value.isZero()) return 'Zero, so the vectors are exactly perpendicular.';
      return value.isPositive()
        ? 'Positive, so the angle between them is less than 90°.'
        : 'Negative, so the angle between them is more than 90°.';
    }

    /* --------------------------- 2-D picture --------------------------- */

    function buildPicture(key, u, v, outcome) {
      const plot = new viz.Plot({
        span: 6,
        aspect: 1.3,
        ariaLabel: 'The vectors drawn in the plane',
        footer: [
          { color: ui.cssVar('--viz-v1', '#4f46e5'), label: 'u' },
          { color: ui.cssVar('--viz-v2', '#0d9488'), label: 'v' },
          { color: ui.cssVar('--viz-eigen2', '#ea580c'), label: 'result' },
        ],
      });

      const uPoint = [u.get(0, 0).toNumber(), u.get(1, 0).toNumber()];
      const vPoint = v ? [v.get(0, 0).toNumber(), v.get(1, 0).toNumber()] : null;

      const span = Math.max(3, Math.ceil(Math.max(Math.abs(uPoint[0]), Math.abs(uPoint[1]),
        vPoint ? Math.abs(vPoint[0]) : 0, vPoint ? Math.abs(vPoint[1]) : 0) * 1.5));
      plot.options.span = span;

      plot.setDraw(function (p, ctx) {
        p.drawGrid(ctx, { step: 1 });
        p.drawAxes(ctx, { step: 1 });
        p.drawArrow(ctx, [0, 0], uPoint, { color: p.colors.v1, label: 'u' });
        if (vPoint) p.drawArrow(ctx, [0, 0], vPoint, { color: p.colors.v2, label: 'v' });

        if (key === 'add' && vPoint) {
          const sum = [uPoint[0] + vPoint[0], uPoint[1] + vPoint[1]];
          p.drawPolygon(ctx, [[0, 0], uPoint, sum, vPoint], { fill: p.colors.shape, stroke: false });
          p.drawArrow(ctx, uPoint, sum, { color: p.colors.v2, alpha: 0.5, dashed: true, width: 1.5 });
          p.drawArrow(ctx, [0, 0], sum, { color: p.colors.eigen2, label: 'u + v', width: 3 });
        } else if (key === 'subtract' && vPoint) {
          const difference = [uPoint[0] - vPoint[0], uPoint[1] - vPoint[1]];
          p.drawArrow(ctx, vPoint, uPoint, { color: p.colors.eigen2, label: 'u − v', width: 3 });
          p.drawArrow(ctx, [0, 0], difference, { color: p.colors.eigen2, alpha: 0.45, dashed: true, width: 2 });
        } else if (key === 'scale') {
          const k = safeNumber(state.scalar);
          if (k != null) {
            p.drawArrow(ctx, [0, 0], [uPoint[0] * k, uPoint[1] * k], {
              color: p.colors.eigen2,
              label: state.scalar + 'u',
              width: 3,
            });
            p.drawSpanLine(ctx, uPoint, { color: p.colors.original, dashed: [3, 3], width: 1 });
          }
        } else if (key === 'projection' && vPoint) {
          const projection = outcome && outcome.node ? null : null;
          const result = ML.projection(u, v);
          const projected = [result.projection.get(0, 0).toNumber(), result.projection.get(1, 0).toNumber()];
          p.drawSpanLine(ctx, vPoint, { color: p.colors.v2, dashed: [3, 3], width: 1 });
          p.drawLine(ctx, uPoint, projected, { color: p.colors.eigen1, dashed: true, width: 1.5 });
          p.drawArrow(ctx, [0, 0], projected, { color: p.colors.eigen2, label: 'proj', width: 3 });
        } else if (key === 'angle' && vPoint) {
          const angleU = Math.atan2(uPoint[1], uPoint[0]);
          const angleV = Math.atan2(vPoint[1], vPoint[0]);
          const radius = Math.min(1.2, span * 0.25) * p.scale;
          ctx.save();
          ctx.strokeStyle = p.colors.eigen1;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.px(0), p.py(0), radius, -Math.max(angleU, angleV), -Math.min(angleU, angleV));
          ctx.stroke();
          ctx.restore();
          const mid = (angleU + angleV) / 2;
          p.drawText(ctx, ML.vectorAngle(u, v).text, [Math.cos(mid) * span * 0.32, Math.sin(mid) * span * 0.32], {
            color: p.colors.eigen1,
            font: '600 12px system-ui, sans-serif',
          });
        } else if (key === 'combination' && vPoint) {
          const c1 = safeNumber(state.scalar);
          const c2 = safeNumber(ML.store.getSetting('vec.scalar2', '-1'));
          if (c1 != null && c2 != null) {
            const combined = [uPoint[0] * c1 + vPoint[0] * c2, uPoint[1] * c1 + vPoint[1] * c2];
            p.drawArrow(ctx, [0, 0], [uPoint[0] * c1, uPoint[1] * c1], { color: p.colors.v1, alpha: 0.4, dashed: true, width: 2 });
            p.drawArrow(ctx, [0, 0], combined, { color: p.colors.eigen2, label: 'result', width: 3 });
          }
        } else if (key === 'distance' && vPoint) {
          p.drawLine(ctx, uPoint, vPoint, { color: p.colors.eigen2, width: 2.5 });
          p.drawPoint(ctx, uPoint, { color: p.colors.v1, ring: true });
          p.drawPoint(ctx, vPoint, { color: p.colors.v2, ring: true });
        }
      });

      return ui.card({
        title: 'In the plane',
        subtitle: 'Available whenever the vectors are two-dimensional',
        tight: true,
        body: plot.mount(),
      });
    }

    function safeNumber(text) {
      try {
        return ML.Frac.parse(text).toNumber();
      } catch (error) {
        return null;
      }
    }

    const controls = ui.card({
      title: op.title,
      actions: [ui.button('Calculate', { variant: 'primary', onClick: function () { compute(true); } })],
      body: el('div.stack', [
        el('div', [ui.sectionLabel('Choose an operation'), picker]),
        op.size === 3 ? ui.alert('info', 'The cross product only exists in three dimensions, so both vectors are fixed at 3 components here.') : null,
        el('div.row.row--top', [
          inputU.element,
          op.needsV ? inputV.element : null,
        ]),
        op.needsScalar
          ? el('div.row', [scalarField, state.op === 'combination' ? scalarField2 : null])
          : null,
      ]),
    });

    compute(false);
    return [controls, resultHost];
  }

  function defaultColumn(size, preferred) {
    const values = [];
    for (let i = 0; i < size; i++) values.push([preferred[i] != null ? preferred[i] : '0']);
    return values;
  }

  ML.registerView({
    id: 'vectors',
    title: 'Vectors',
    heading: 'Vector Calculator',
    tagline: 'Dot and cross products, lengths, angles, projections and combinations — drawn in the plane where possible.',
    icon: '→',
    build: buildView,
  });
})((globalThis.ML = globalThis.ML || {}));
