/**
 * MatrixLab — 2-D plotting on canvas.
 *
 * A small coordinate-aware wrapper shared by every visualisation: it handles
 * device pixel ratio, resizing, world-to-screen mapping and reads its colours
 * from the CSS custom properties so the drawings follow the light/dark theme.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;

  const viz = (ML.viz = ML.viz || {});

  class Plot {
    /**
     * @param {object} [options]
     * @param {number} [options.span=5]     Half-width of the visible world, in units.
     * @param {number} [options.aspect=1]   width / height.
     * @param {[number, number]} [options.center=[0,0]]
     * @param {string} [options.ariaLabel]
     * @param {Array} [options.footer]      Legend items shown under the canvas.
     */
    constructor(options) {
      this.options = Object.assign({ span: 5, aspect: 1, center: [0, 0] }, options || {});
      this.canvas = el('canvas.viz__canvas', {
        role: 'img',
        'aria-label': this.options.ariaLabel || 'Diagram',
      });
      this.footer = el('div.viz__foot');
      this.element = el('div.viz', [this.canvas, this.footer]);
      this.drawCallback = null;
      this.width = 640;
      this.height = 640;

      if (this.options.footer) this.setLegend(this.options.footer);

      // Keep the drawing crisp and correctly proportioned when the layout moves.
      const refresh = ui.debounce(() => this.refresh(), 120);
      if (typeof globalThis.addEventListener === 'function') {
        globalThis.addEventListener('resize', refresh);
      }
    }

    /** @param {Array<{color: string, label: string, box?: boolean, dashed?: boolean}>} items */
    setLegend(items) {
      ui.clear(this.footer);
      items.forEach((item) => {
        this.footer.appendChild(
          el('span.legend', [
            el('span.legend__swatch' + (item.box ? '.legend__swatch--box' : ''), {
              style: {
                background: item.color,
                opacity: item.dashed ? '0.55' : '1',
              },
            }),
            item.label,
          ])
        );
      });
    }

    /** @param {(plot: Plot, ctx: CanvasRenderingContext2D) => void} fn */
    setDraw(fn) {
      this.drawCallback = fn;
      return this;
    }

    /**
     * Return the element to insert, drawing once now and again on the next
     * tick — the second pass is when clientWidth is finally known.
     */
    mount() {
      this.refresh();
      if (typeof setTimeout === 'function') setTimeout(() => this.refresh(), 0);
      return this.element;
    }

    /** Recompute geometry and redraw. */
    refresh() {
      const cssWidth = Math.max(220, this.canvas.clientWidth || this.options.width || 640);
      const cssHeight = Math.round(cssWidth / this.options.aspect);
      const ratio = Math.min(3, globalThis.devicePixelRatio || 1);

      this.canvas.width = Math.round(cssWidth * ratio);
      this.canvas.height = Math.round(cssHeight * ratio);
      this.canvas.style.height = cssHeight + 'px';
      this.width = cssWidth;
      this.height = cssHeight;

      const ctx = this.canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      // Equal scale on both axes so angles and circles are not distorted.
      this.scale = cssWidth / (2 * this.options.span);
      this.xMin = this.options.center[0] - this.options.span;
      this.yMin = this.options.center[1] - cssHeight / 2 / this.scale;
      this.yMax = this.options.center[1] + cssHeight / 2 / this.scale;
      this.xMax = this.options.center[0] + this.options.span;

      this.colors = {
        background: ui.cssVar('--viz-bg', '#ffffff'),
        grid: ui.cssVar('--viz-grid', '#e6eaf2'),
        gridStrong: ui.cssVar('--viz-grid-strong', '#cfd6e4'),
        axis: ui.cssVar('--viz-axis', '#94a3b8'),
        shape: ui.cssVar('--viz-shape', 'rgba(99,102,241,0.18)'),
        shapeLine: ui.cssVar('--viz-shape-line', '#4f46e5'),
        original: ui.cssVar('--viz-original', '#94a3b8'),
        v1: ui.cssVar('--viz-v1', '#4f46e5'),
        v2: ui.cssVar('--viz-v2', '#0d9488'),
        eigen1: ui.cssVar('--viz-eigen1', '#db2777'),
        eigen2: ui.cssVar('--viz-eigen2', '#ea580c'),
        point: ui.cssVar('--viz-point', '#1e293b'),
        text: ui.cssVar('--text-soft', '#475569'),
      };

      ctx.fillStyle = this.colors.background;
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      if (this.drawCallback) this.drawCallback(this, ctx);
      return this;
    }

    /* ------------------------- coordinate mapping ------------------------ */

    /** World x → pixel x. */
    px(x) {
      return (x - this.xMin) * this.scale;
    }

    /** World y → pixel y (flipped, so y increases upwards). */
    py(y) {
      return this.height - (y - this.yMin) * this.scale;
    }

    /** Pixel position → world coordinates. */
    toWorld(pixelX, pixelY) {
      return [pixelX / this.scale + this.xMin, (this.height - pixelY) / this.scale + this.yMin];
    }

    /* ------------------------------ drawing ------------------------------ */

    /** Background grid of unit squares. */
    drawGrid(ctx, options) {
      const opts = options || {};
      const step = opts.step || 1;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = this.colors.grid;
      ctx.beginPath();
      const firstX = Math.ceil(this.xMin / step) * step;
      for (let x = firstX; x <= this.xMax; x += step) {
        ctx.moveTo(this.px(x), 0);
        ctx.lineTo(this.px(x), this.height);
      }
      const firstY = Math.ceil(this.yMin / step) * step;
      for (let y = firstY; y <= this.yMax; y += step) {
        ctx.moveTo(0, this.py(y));
        ctx.lineTo(this.width, this.py(y));
      }
      ctx.stroke();
      ctx.restore();
    }

    /**
     * The image of the grid under a 2×2 matrix: the lines that were horizontal
     * and vertical, after the transformation. This is what makes a linear map
     * visible — straight lines stay straight and evenly spaced.
     */
    drawTransformedGrid(ctx, matrix, options) {
      const opts = options || {};
      const [a, b, c, d] = matrix;
      const range = opts.range || Math.ceil(this.options.span) + 2;
      ctx.save();
      ctx.lineWidth = opts.width || 1;
      ctx.strokeStyle = opts.color || this.colors.gridStrong;
      ctx.globalAlpha = opts.alpha == null ? 0.9 : opts.alpha;
      ctx.beginPath();
      for (let k = -range; k <= range; k++) {
        // The image of the vertical line x = k.
        ctx.moveTo(this.px(a * k + b * -range), this.py(c * k + d * -range));
        ctx.lineTo(this.px(a * k + b * range), this.py(c * k + d * range));
        // The image of the horizontal line y = k.
        ctx.moveTo(this.px(a * -range + b * k), this.py(c * -range + d * k));
        ctx.lineTo(this.px(a * range + b * k), this.py(c * range + d * k));
      }
      ctx.stroke();
      ctx.restore();
    }

    drawAxes(ctx, options) {
      const opts = options || {};
      ctx.save();
      ctx.strokeStyle = this.colors.axis;
      ctx.fillStyle = this.colors.text;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, this.py(0));
      ctx.lineTo(this.width, this.py(0));
      ctx.moveTo(this.px(0), 0);
      ctx.lineTo(this.px(0), this.height);
      ctx.stroke();

      if (opts.ticks !== false) {
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const step = opts.step || 1;
        const firstX = Math.ceil(this.xMin / step) * step;
        for (let x = firstX; x <= this.xMax; x += step) {
          if (Math.abs(x) < 1e-9) continue;
          ctx.beginPath();
          ctx.moveTo(this.px(x), this.py(0) - 3);
          ctx.lineTo(this.px(x), this.py(0) + 3);
          ctx.stroke();
          if (Math.abs(x % (step * (this.options.span > 8 ? 2 : 1))) < 1e-9) {
            ctx.fillText(formatTick(x), this.px(x), this.py(0) + 6);
          }
        }
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const firstY = Math.ceil(this.yMin / step) * step;
        for (let y = firstY; y <= this.yMax; y += step) {
          if (Math.abs(y) < 1e-9) continue;
          ctx.beginPath();
          ctx.moveTo(this.px(0) - 3, this.py(y));
          ctx.lineTo(this.px(0) + 3, this.py(y));
          ctx.stroke();
          ctx.fillText(formatTick(y), this.px(0) - 6, this.py(y));
        }
      }
      ctx.restore();
    }

    /** An arrow from world point `from` to world point `to`. */
    drawArrow(ctx, from, to, options) {
      const opts = options || {};
      const x1 = this.px(from[0]);
      const y1 = this.py(from[1]);
      const x2 = this.px(to[0]);
      const y2 = this.py(to[1]);
      const length = Math.hypot(x2 - x1, y2 - y1);
      ctx.save();
      ctx.strokeStyle = opts.color || this.colors.v1;
      ctx.fillStyle = opts.color || this.colors.v1;
      ctx.lineWidth = opts.width || 2.5;
      ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
      if (opts.dashed) ctx.setLineDash([5, 4]);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (length > 6 && opts.head !== false) {
        const head = Math.min(11, Math.max(6, length * 0.22));
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(angle - 0.4), y2 - head * Math.sin(angle - 0.4));
        ctx.lineTo(x2 - head * Math.cos(angle + 0.4), y2 - head * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();
      }

      if (opts.label) {
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const offsetX = x2 >= x1 ? 8 : -8;
        ctx.textAlign = x2 >= x1 ? 'left' : 'right';
        ctx.fillText(opts.label, x2 + offsetX, y2 - 8);
      }
      ctx.restore();
    }

    /** A filled, outlined polygon from world points. */
    drawPolygon(ctx, points, options) {
      const opts = options || {};
      if (points.length < 2) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.px(points[0][0]), this.py(points[0][1]));
      for (let i = 1; i < points.length; i++) ctx.lineTo(this.px(points[i][0]), this.py(points[i][1]));
      ctx.closePath();
      if (opts.fill !== false) {
        ctx.fillStyle = opts.fill || this.colors.shape;
        ctx.fill();
      }
      if (opts.stroke !== false) {
        ctx.strokeStyle = opts.stroke || this.colors.shapeLine;
        ctx.lineWidth = opts.width || 2;
        if (opts.dashed) ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    drawLine(ctx, from, to, options) {
      const opts = options || {};
      ctx.save();
      ctx.strokeStyle = opts.color || this.colors.axis;
      ctx.lineWidth = opts.width || 1.5;
      if (opts.dashed) ctx.setLineDash(opts.dashed === true ? [5, 4] : opts.dashed);
      ctx.beginPath();
      ctx.moveTo(this.px(from[0]), this.py(from[1]));
      ctx.lineTo(this.px(to[0]), this.py(to[1]));
      ctx.stroke();
      ctx.restore();
    }

    /** A line through the origin in direction `direction`, spanning the view. */
    drawSpanLine(ctx, direction, options) {
      const length = Math.hypot(direction[0], direction[1]);
      if (length < 1e-12) return;
      const reach = (this.options.span + Math.abs(this.yMax)) * 2;
      const unit = [direction[0] / length, direction[1] / length];
      this.drawLine(ctx, [-unit[0] * reach, -unit[1] * reach], [unit[0] * reach, unit[1] * reach], options);
    }

    drawPoint(ctx, point, options) {
      const opts = options || {};
      ctx.save();
      ctx.fillStyle = opts.color || this.colors.point;
      ctx.beginPath();
      ctx.arc(this.px(point[0]), this.py(point[1]), opts.radius || 4, 0, Math.PI * 2);
      ctx.fill();
      if (opts.ring) {
        ctx.strokeStyle = this.colors.background;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (opts.label) {
        ctx.fillStyle = opts.labelColor || this.colors.text;
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(opts.label, this.px(point[0]) + 7, this.py(point[1]) - 5);
      }
      ctx.restore();
    }

    /** Polyline through world points — used for fitted curves. */
    drawCurve(ctx, points, options) {
      const opts = options || {};
      if (points.length < 2) return;
      ctx.save();
      ctx.strokeStyle = opts.color || this.colors.shapeLine;
      ctx.lineWidth = opts.width || 2;
      if (opts.dashed) ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(this.px(points[0][0]), this.py(points[0][1]));
      for (let i = 1; i < points.length; i++) ctx.lineTo(this.px(points[i][0]), this.py(points[i][1]));
      ctx.stroke();
      ctx.restore();
    }

    drawText(ctx, text, point, options) {
      const opts = options || {};
      ctx.save();
      ctx.fillStyle = opts.color || this.colors.text;
      ctx.font = opts.font || '11px system-ui, sans-serif';
      ctx.textAlign = opts.align || 'left';
      ctx.textBaseline = opts.baseline || 'alphabetic';
      ctx.fillText(text, this.px(point[0]) + (opts.dx || 0), this.py(point[1]) + (opts.dy || 0));
      ctx.restore();
    }

    /** Label placed at a fixed pixel offset from the top-left. */
    drawBadge(ctx, text, x, y, color) {
      ctx.save();
      ctx.font = '600 11px system-ui, sans-serif';
      const width = ctx.measureText(text).width + 12;
      ctx.fillStyle = this.colors.background;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y, width, 18);
      ctx.globalAlpha = 1;
      ctx.fillStyle = color || this.colors.text;
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + 6, y + 10);
      ctx.restore();
    }
  }

  function formatTick(value) {
    const rounded = Math.round(value * 100) / 100;
    return String(rounded);
  }

  /** Apply a 2×2 matrix [a,b,c,d] to a point. */
  viz.apply2 = function (matrix, point) {
    return [
      matrix[0] * point[0] + matrix[1] * point[1],
      matrix[2] * point[0] + matrix[3] * point[1],
    ];
  };

  /** Read a 2×2 Matrix into a flat [a,b,c,d] of floats. */
  viz.flat2 = function (M) {
    return [M.get(0, 0).toNumber(), M.get(0, 1).toNumber(), M.get(1, 0).toNumber(), M.get(1, 1).toNumber()];
  };

  /** Linear interpolation between the identity and a matrix. */
  viz.lerpFromIdentity = function (matrix, t) {
    return [
      1 + (matrix[0] - 1) * t,
      matrix[1] * t,
      matrix[2] * t,
      1 + (matrix[3] - 1) * t,
    ];
  };

  viz.Plot = Plot;
})((globalThis.ML = globalThis.ML || {}));
