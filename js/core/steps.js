/**
 * MatrixLab — step recorder.
 *
 * Every "Show Steps" panel in the app is built from a StepLog that the real
 * algorithm filled in while it ran. Nothing here is hardcoded prose about a
 * hypothetical calculation: if the algorithm takes a different path (a row
 * swap, an early exit on a zero column) the steps say so, because they were
 * written as it happened.
 */
(function (ML) {
  'use strict';

  /** Safety valve so a big reduction cannot exhaust memory. */
  const MAX_STEPS = 400;

  class StepLog {
    /**
     * @param {string} [title] Heading for the whole derivation.
     */
    constructor(title) {
      this.title = title || '';
      this.steps = [];
      this.truncated = false;
    }

    /**
     * @param {string} heading Short label, e.g. "Step 3 — eliminate below the pivot".
     * @param {object} [body]
     * @param {string} [body.text]      Sentence(s) of explanation.
     * @param {string} [body.math]      A formula line, e.g. "R2 → R2 − 3R1".
     * @param {ML.Matrix} [body.matrix] Matrix state after this step.
     * @param {string} [body.label]     Label for that matrix, e.g. "A".
     * @param {Array<{label:string, matrix:ML.Matrix, caption?:string}>} [body.matrices]
     * @param {string[]} [body.list]    Bullet points.
     * @param {object} [body.highlight] {cells:[[i,j]], rows:[i], cols:[j], pivot:[i,j]}
     * @param {string} [body.note]      Small muted footnote.
     * @param {'info'|'result'|'warn'} [body.kind]
     */
    add(heading, body) {
      if (this.steps.length >= MAX_STEPS) {
        if (!this.truncated) {
          this.truncated = true;
          this.steps.push({
            heading: 'Steps truncated',
            text:
              'This calculation produced more than ' + MAX_STEPS + ' steps, so the rest are not shown. ' +
              'The final answer is still computed in full.',
            kind: 'warn',
          });
        }
        return this;
      }
      this.steps.push(Object.assign({ heading: heading }, body || {}));
      return this;
    }

    /** Convenience: a step whose point is a matrix. */
    matrix(heading, matrix, body) {
      return this.add(heading, Object.assign({ matrix: matrix }, body || {}));
    }

    /** Convenience: a prose-only step. */
    text(heading, text, body) {
      return this.add(heading, Object.assign({ text: text }, body || {}));
    }

    /** Convenience: the closing step. */
    result(heading, body) {
      return this.add(heading, Object.assign({ kind: 'result' }, body || {}));
    }

    get count() {
      return this.steps.length;
    }

    isEmpty() {
      return this.steps.length === 0;
    }

    /** Auto-numbered heading helper: "Step 1", "Step 2", … */
    nextLabel(suffix) {
      const n = this.steps.filter(function (s) { return /^Step\s/.test(s.heading); }).length + 1;
      return 'Step ' + n + (suffix ? ' — ' + suffix : '');
    }
  }

  ML.StepLog = StepLog;
})((globalThis.ML = globalThis.ML || {}));
