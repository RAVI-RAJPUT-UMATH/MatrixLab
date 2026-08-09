/**
 * MatrixLab — Matrix Decompositions.
 *
 * LU, PLU, QR, Cholesky and SVD. Each panel states the conditions the
 * factorisation requires, shows the factors, and multiplies them back out so
 * the reconstruction can be seen rather than trusted.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;

  const state = {
    tab: ML.store.getSetting('dec.tab', 'lu'),
    qrMethod: ML.store.getSetting('dec.qrMethod', 'householder'),
    lowRank: 1,
  };

  function buildView() {
    const input = ML.store.bind(
      'A',
      new ui.MatrixInput({
        name: 'A',
        rows: 3,
        cols: 3,
        max: 8,
        values: ML.store.getValuesOrDefault('A', [['2', '-1', '-2'], ['-4', '6', '3'], ['-4', '-2', '8']]),
        hint: 'Each decomposition needs different conditions — the panels say which, and why.',
      })
    );

    const tabs = ui.tabs(
      [
        { id: 'lu', label: 'LU', build: function () { return panel(input, 'lu'); } },
        { id: 'plu', label: 'PLU', build: function () { return panel(input, 'plu'); } },
        { id: 'qr', label: 'QR', build: function () { return panel(input, 'qr'); } },
        { id: 'cholesky', label: 'Cholesky', build: function () { return panel(input, 'cholesky'); } },
        { id: 'svd', label: 'SVD', build: function () { return panel(input, 'svd'); } },
        { id: 'compare', label: 'Which one when?', build: buildComparison },
      ],
      {
        initial: state.tab,
        rebuild: true,
        onChange: function (item) {
          state.tab = item.id;
          ML.store.setSetting('dec.tab', item.id);
        },
      }
    );

    return [ui.card({ title: 'The matrix', body: input.element }), tabs];
  }

  const CONDITIONS = {
    lu: 'Square, and every leading principal submatrix non-singular (so no row swaps are needed).',
    plu: 'Square. Always exists — the permutation matrix absorbs any row swaps.',
    qr: 'At least as many rows as columns. Always exists.',
    cholesky: 'Symmetric and positive definite.',
    svd: 'Any matrix at all, of any shape. Always exists.',
  };

  const EXACTNESS = {
    lu: 'exact',
    plu: 'exact',
    qr: 'numeric',
    cholesky: 'numeric',
    svd: 'numeric',
  };

  function panel(input, kind) {
    const got = input.tryGetMatrix();
    if (!got.ok) return ui.errorPanel(got.error);
    const A = got.matrix;

    const header = el('div.stack-sm', [
      el('div.row.row--tight', [
        ui.badge(EXACTNESS[kind] === 'exact' ? 'exact arithmetic' : 'floating point', EXACTNESS[kind] === 'exact' ? 'ok' : 'warn'),
        ui.badge(A.size(), 'brand'),
      ]),
      el('p.small.muted', [el('strong', 'Requires: '), CONDITIONS[kind]]),
    ]);

    let result;
    const steps = new ML.StepLog();
    try {
      result = compute(kind, A, steps);
    } catch (error) {
      // A precondition that is not met is an expected outcome for this view,
      // not a failure: say which condition failed and offer a way forward.
      return el('div.stack', [
        header,
        ui.card({
          className: 'card--accent',
          body: el('div.stack', [
            ui.alert('warn', error.message, 'This decomposition does not apply here'),
            error.details && error.details.hint ? el('p.small.muted', error.details.hint) : null,
            suggestions(kind, A, input),
          ]),
        }),
      ]);
    }

    return el('div.stack-lg', [header, result]);
  }

  function compute(kind, A, steps) {
    if (kind === 'lu') {
      steps.title = 'LU decomposition';
      const lu = ML.luDecomposition(A, steps);
      return factorResult({
        formula: 'A = L U',
        factors: [
          { matrix: lu.L, label: 'L', caption: 'unit lower triangular' },
          { matrix: lu.U, label: 'U', caption: 'upper triangular' },
        ],
        check: { matrix: lu.product, label: 'LU', exact: true, matches: lu.product.equals(A) },
        A: A,
        steps: steps,
        explanation: luExplanation(),
        extras: el('p.small.muted', [
          'det(A) = product of the diagonal of U = ' + ML.fmt(ML.determinant(A)) +
            ', because det(L) = 1. This is how determinants are actually computed.',
        ]),
      });
    }
    if (kind === 'plu') {
      steps.title = 'PLU decomposition';
      const plu = ML.pluDecomposition(A, steps);
      const left = ML.multiplyMatrices(plu.P, A);
      const right = ML.multiplyMatrices(plu.L, plu.U);
      return factorResult({
        formula: 'P A = L U',
        factors: [
          { matrix: plu.P, label: 'P', caption: plu.swaps + ' row swap' + (plu.swaps === 1 ? '' : 's') },
          { matrix: plu.L, label: 'L', caption: 'unit lower triangular' },
          { matrix: plu.U, label: 'U', caption: 'upper triangular' },
        ],
        check: { matrix: right, label: 'LU', compare: left, compareLabel: 'PA', exact: true, matches: left.equals(right) },
        A: A,
        steps: steps,
        explanation: luExplanation(),
        extras: el('p.small.muted', [
          'det(A) = (−1)' + ML.operations.superscript(plu.swaps) + ' × product of the diagonal of U = ' +
            ML.fmt(plu.determinant) + '.',
        ]),
      });
    }
    if (kind === 'qr') {
      steps.title = 'QR decomposition';
      const methodPicker = ui.segmented({
        label: 'Method',
        value: state.qrMethod,
        options: [
          { value: 'householder', label: 'Householder', title: 'What numerical libraries use' },
          { value: 'gram-schmidt', label: 'Gram–Schmidt', title: 'The version done by hand' },
        ],
        onChange: function (value) {
          state.qrMethod = value;
          ML.store.setSetting('dec.qrMethod', value);
          ML.router.render();
        },
      });
      const qr = ML.qrDecomposition(A, steps, { method: state.qrMethod });
      return el('div.stack', [
        el('div.field', [el('span.label', 'Method'), methodPicker]),
        factorResult({
          formula: 'A = Q R,   QᵗQ = I',
          factors: [
            { matrix: qr.Q, label: 'Q', caption: 'orthonormal columns' },
            { matrix: qr.R, label: 'R', caption: 'upper triangular' },
          ],
          check: { matrix: qr.product, label: 'QR', error: qr.error, matches: qr.verified },
          A: A,
          steps: steps,
          explanation: qrExplanation(),
          extras: el('div.stack-sm', [
            el('div.row.row--top', [
              ui.renderMatrix(qr.orthogonality, { label: 'QᵗQ', compact: true }),
              el('p.small.muted', { style: { maxWidth: '40ch' } }, [
                'QᵗQ differs from the identity by at most ' + ML.fmtFixed(qr.orthogonalityError, 3) +
                  ' — the columns of Q really are perpendicular unit vectors, to the limit of floating point.',
              ]),
            ]),
          ]),
        }),
      ]);
    }
    if (kind === 'cholesky') {
      steps.title = 'Cholesky decomposition';
      const chol = ML.choleskyDecomposition(A, steps);
      return factorResult({
        formula: 'A = L Lᵗ',
        factors: [
          { matrix: chol.L, label: 'L', caption: 'lower triangular' },
          { matrix: chol.Lt, label: 'Lᵗ' },
        ],
        check: { matrix: chol.product, label: 'LLᵗ', error: chol.error, matches: chol.verified },
        A: A,
        steps: steps,
        explanation: choleskyExplanation(),
        extras: el('div.stack-sm', [
          ui.alert('ok', 'A is symmetric and every leading principal minor is positive, so it is positive definite — checked in exact arithmetic.'),
          el('div.row.row--tight', chol.minors.map(function (value, index) {
            return ui.badge('minor ' + (index + 1) + ': ' + ML.fmt(value), 'ok');
          })),
        ]),
      });
    }
    if (kind === 'svd') {
      steps.title = 'Singular value decomposition';
      const svd = ML.svdDecomposition(A, steps);
      return buildSvd(A, svd, steps);
    }
    throw new ML.MLError('Unknown decomposition.');
  }

  /** Shared layout: the factors, then the reconstruction check. */
  function factorResult(spec) {
    const checkRow = spec.check.compare
      ? ui.renderExpression([
          { matrix: spec.check.compare, label: spec.check.compareLabel },
          spec.check.matches ? '=' : '≈',
          { matrix: spec.check.matrix, label: spec.check.label },
        ])
      : ui.renderExpression([
          { matrix: spec.check.matrix, label: spec.check.label },
          spec.check.matches ? '=' : '≈',
          { matrix: spec.A, label: 'A' },
        ]);

    return ui.resultBlock({
      formula: spec.formula,
      result: el('div.stack-lg', [
        el('div.scroll-x', [
          ui.renderExpression(
            [{ matrix: spec.A, label: 'A' }, '=']
              .concat(
                spec.factors.reduce(function (all, factor, index) {
                  if (index) all.push('·');
                  all.push(factor);
                  return all;
                }, [])
              )
          ),
        ]),
        el('div', [
          ui.sectionLabel('Verification'),
          el('div.scroll-x', [checkRow]),
          el(
            'p.small.muted',
            spec.check.exact
              ? 'The factors multiply back to A exactly — rational arithmetic makes this certain.'
              : 'Largest difference from A: ' + ML.fmtFixed(spec.check.error || 0, 3) +
                ', which is floating-point rounding rather than a mistake.'
          ),
        ]),
        spec.extras,
      ]),
      steps: spec.steps,
      explanation: spec.explanation,
    });
  }

  /* ------------------------------------------------------------------ *
   * SVD gets its own layout — singular values and low-rank approximation
   * ------------------------------------------------------------------ */

  function buildSvd(A, svd, steps) {
    const approximationHost = el('div');
    const maxRank = svd.singular.length;

    function renderApproximation() {
      ui.safeRender(approximationHost, function () {
        const approximation = svd.lowRank(state.lowRank);
        return el('div.stack', [
          el('div.scroll-x', [
            ui.renderExpression([
              { matrix: approximation.matrix, label: 'rank-' + state.lowRank + ' approximation' },
              'vs',
              { matrix: A, label: 'A' },
            ]),
          ]),
          el('p.small.muted', [
            'Frobenius error ' + ML.fmtFixed(approximation.frobeniusError, 4) +
              '. The Eckart–Young theorem says no rank-' + state.lowRank + ' matrix can do better, and that this error ' +
              'is exactly √(σ' + ML.operations.subscript(state.lowRank + 1) + '² + … ) — the singular values you threw away.',
          ]),
        ]);
      });
    }

    const rankPicker = ui.segmented({
      label: 'Keep how many singular values?',
      value: String(state.lowRank),
      options: svd.singular.map(function (_, index) {
        return { value: String(index + 1), label: String(index + 1) };
      }),
      onChange: function (value) {
        state.lowRank = Number(value);
        renderApproximation();
      },
    });

    state.lowRank = Math.min(state.lowRank, maxRank) || 1;
    renderApproximation();

    return ui.resultBlock({
      formula: 'A = U Σ Vᵗ',
      result: el('div.stack-lg', [
        el('div.scroll-x', [
          ui.renderExpression([
            { matrix: A, label: 'A' },
            '=',
            { matrix: svd.U, label: 'U' },
            '·',
            { matrix: svd.Sigma, label: 'Σ' },
            '·',
            { matrix: svd.Vt, label: 'Vᵗ' },
          ]),
        ]),
        el('div', [
          ui.sectionLabel('Singular values'),
          el(
            'div.row.row--tight',
            svd.singular.map(function (value, index) {
              return ui.badge(
                'σ' + ML.operations.subscript(index + 1) + ' = ' + ML.fmtFixed(value, ML.config.decimals),
                value > 1e-10 ? 'brand' : 'no'
              );
            })
          ),
        ]),
        ui.kpis([
          { label: 'Rank', node: el('span', String(svd.rank)), note: 'non-zero singular values' },
          {
            label: 'Condition number',
            node: el('span', svd.condition === Infinity ? '∞' : ML.fmtFixed(svd.condition, 4)),
            note: 'σ₁ / σ_min',
          },
          { label: 'Largest σ', node: el('span', ML.fmtFixed(svd.singular[0], 4)), note: 'how much A can stretch' },
          { label: 'Reconstruction error', node: el('span', ML.fmtFixed(svd.error, 3)) },
        ]),
        svd.condition === Infinity
          ? ui.alert(
              'warn',
              'A singular value is zero, so A is singular: the condition number is infinite and the matrix cannot be ' +
                'inverted. The number of non-zero singular values, ' + svd.rank + ', is the rank — and this is the ' +
                'numerically reliable way to determine rank when entries are inexact measurements.'
            )
          : ui.alert(
              'info',
              'The condition number ' + ML.fmtFixed(svd.condition, 3) + ' measures how much A can amplify a relative ' +
                'error. Close to 1 is well behaved; very large means solving Ax = b in floating point will lose ' +
                'precision.'
            ),
        el('div', [
          ui.sectionLabel('Low-rank approximation'),
          rankPicker,
          approximationHost,
        ]),
      ]),
      steps: steps,
      explanation: svdExplanation(),
    });
  }

  /* ------------------------------------------------------------------ *
   * When a decomposition does not apply
   * ------------------------------------------------------------------ */

  function suggestions(kind, A, input) {
    const options = [];
    if (kind === 'lu') {
      options.push(['plu', 'Use PLU instead — it allows the row swaps LU cannot']);
    }
    if (kind === 'cholesky') {
      options.push(['lu', 'Use LU or PLU, which work for any square matrix']);
      options.push(['svd', 'Or SVD, which works for absolutely any matrix']);
    }
    if (kind === 'qr') {
      options.push(['svd', 'Use SVD, which handles any shape']);
    }
    return el('div.stack-sm', [
      options.length
        ? el('div.row.row--tight', options.map(function (pair) {
            return ui.button(pair[1], {
              size: 'sm',
              onClick: function () {
                state.tab = pair[0];
                ML.store.setSetting('dec.tab', pair[0]);
                ML.router.render();
              },
            });
          }))
        : null,
      kind === 'cholesky'
        ? ui.button('Load a positive definite example', {
            size: 'sm',
            variant: 'ghost',
            onClick: function () {
              input.setValues([['4', '12', '-16'], ['12', '37', '-43'], ['-16', '-43', '98']]);
              ML.router.render();
            },
          })
        : null,
    ]);
  }

  /* ------------------------------------------------------------------ *
   * Explanations
   * ------------------------------------------------------------------ */

  function luExplanation() {
    return [
      el('h3', 'LU is elimination, written down'),
      el('p', [
        'Gaussian elimination turns A into an upper triangular U. Every step subtracts a multiple of one row from ' +
          'another, and if you record those multipliers in a lower triangular L with 1s on the diagonal, then A = LU. ' +
          'Nothing new is happening — LU is a filing system for work you were doing anyway.',
      ]),
      el('h3', 'Why it is worth storing'),
      el('p', [
        'Solving Ax = b becomes two easy steps: solve Ly = b working downwards, then Ux = y working upwards. Each ' +
          'triangular solve is quick. The point is reuse: if you have twenty different right-hand sides with the same A, ' +
          'you factor once and do twenty cheap pairs of solves instead of twenty full eliminations.',
      ]),
      el('p', [
        'It also gives determinants almost free: det(A) = det(L)·det(U) = 1 × (product of U’s diagonal), with a sign ' +
          'flip for each row swap.',
      ]),
      el('h3', 'Why P is usually needed'),
      el('p', [
        'Plain LU fails the moment a pivot comes out zero, and in floating point it behaves badly whenever a pivot is ' +
          'merely small. Real implementations always pivot, choosing the largest available entry, which is why PLU ' +
          '(PA = LU) is the version in every numerical library.',
      ]),
    ];
  }

  function qrExplanation() {
    return [
      el('h3', 'Orthonormal columns, and a triangular recipe'),
      el('p', [
        'QR replaces the columns of A with an orthonormal set Q spanning the same space, and records in R how to rebuild ' +
          'the original columns from them. R is upper triangular because column k of A only ever needs the first k ' +
          'orthonormal directions — that is exactly the order Gram–Schmidt works in.',
      ]),
      el('h3', 'Two ways to compute it'),
      el('p', [
        'Gram–Schmidt is the one you derive by hand, and it makes the meaning obvious. But in floating point it loses ' +
          'orthogonality when columns are nearly parallel, because it subtracts nearly-equal quantities. Householder ' +
          'reflections avoid that: each step reflects a whole sub-column onto an axis, and reflections never amplify ' +
          'error. Both are offered above; compare their QᵗQ on a badly conditioned matrix.',
      ]),
      el('h3', 'What it is used for'),
      el('p', [
        'QR is the stable way to solve least squares: substituting A = QR into the normal equations reduces them to ' +
          'Rx = Qᵗb, a single triangular solve, without ever forming AᵗA (which squares the condition number). It is ' +
          'also the engine inside the standard eigenvalue algorithm.',
      ]),
    ];
  }

  function choleskyExplanation() {
    return [
      el('h3', 'A square root for matrices'),
      el('p', [
        'For a symmetric positive definite matrix, Cholesky writes A = LLᵗ with L lower triangular. It is LU adapted to ' +
          'symmetry: because A is symmetric there is no need to store both triangles, so it costs about half as much ' +
          'work and needs no pivoting at all.',
      ]),
      el('h3', 'The conditions are not red tape'),
      el('p', [
        'The diagonal entries of L are square roots of quantities computed from A. If A is not positive definite one of ' +
          'those quantities comes out negative or zero, and no real L exists. So attempting Cholesky is itself a test ' +
          'for positive definiteness — often the cheapest one available.',
      ]),
      el('h3', 'Where it appears'),
      el('p', [
        'Covariance matrices are symmetric positive semi-definite, so Cholesky is the standard way to generate ' +
          'correlated random samples. It also solves the normal equations of least squares, and appears throughout ' +
          'optimisation wherever a Hessian needs factorising.',
      ]),
    ];
  }

  function svdExplanation() {
    return [
      el('h3', 'The factorisation that always exists'),
      el('p', [
        'Every matrix — square or not, invertible or not — can be written as UΣVᵗ with U and V orthogonal and Σ ' +
          'diagonal with non-negative entries. No conditions, no exceptions. That universality is what makes SVD the ' +
          'most useful factorisation in applied mathematics.',
      ]),
      el('h3', 'Reading it geometrically'),
      el('p', [
        'Applied to a vector, Vᵗ rotates it, Σ stretches each axis by a singular value, and U rotates again. So every ' +
          'linear map, however complicated it looks, is nothing more than a rotation, then an axis-aligned stretch, ' +
          'then another rotation. The singular values say how much stretching, and in which principal directions.',
      ]),
      el('h3', 'Rank, condition and compression'),
      el('p', [
        'The number of non-zero singular values is the rank — and unlike counting pivots, this degrades gracefully when ' +
          'the entries are noisy measurements: a singular value of 10⁻⁸ tells you the matrix is nearly rank deficient, ' +
          'which exact elimination would never reveal. The ratio σ₁/σ_min is the condition number, predicting how much ' +
          'precision a linear solve will lose.',
      ]),
      el('p', [
        'Keeping only the largest few singular values gives the best possible approximation of that rank ' +
          '(the Eckart–Young theorem). This single fact underlies image compression, noise reduction, recommender ' +
          'systems and principal component analysis.',
      ]),
      el('div.callout', [
        el('div.callout__title', 'How MatrixLab computes it'),
        el('p', [
          'By one-sided Jacobi rotation: pairs of columns are rotated until they are mutually perpendicular, at which ' +
            'point the column lengths are the singular values. It is slower than the bidiagonalisation used by LAPACK ' +
            'but short, accurate and easy to trust — a reasonable trade for a teaching tool. The reported ' +
            'reconstruction error lets you confirm the result rather than take it on faith.',
        ]),
      ]),
    ];
  }

  /* ------------------------------------------------------------------ *
   * Comparison table
   * ------------------------------------------------------------------ */

  function buildComparison() {
    return el('div.stack-lg', [
      ui.table(
        ['Factorisation', 'Needs', 'Gives you', 'Exact in MatrixLab?'],
        [
          ['A = LU', 'square, no zero pivots', 'fast repeated solves, determinant', 'yes'],
          ['PA = LU', 'square (always exists)', 'the practical version of LU', 'yes'],
          ['A = QR', 'rows ≥ columns', 'stable least squares, orthonormal basis', 'no — square roots'],
          ['A = LLᵗ', 'symmetric positive definite', 'half the work of LU, a matrix square root', 'no — square roots'],
          ['A = UΣVᵗ', 'nothing at all', 'rank, condition number, best low-rank approximation', 'no — square roots'],
          ['A = PDP⁻¹', 'enough independent eigenvectors', 'powers, long-run behaviour', 'yes when eigenvalues are rational'],
        ].map(function (row) {
          return row.map(function (cell, index) {
            return index === 0 ? { node: el('span.math.strong', cell) } : cell;
          });
        })
      ),
      el('div.lesson', [
        el('h3', 'Choosing one'),
        el('p', [
          'The pattern is a trade between generality and cost. LU is cheapest and applies to square systems. Cholesky ' +
            'is cheaper still but demands symmetry and positive definiteness. QR gives up exactness for numerical ' +
            'stability and handles rectangular matrices. SVD asks for nothing and tells you the most, but costs the ' +
            'most to compute.',
        ]),
        el('p', [
          'A practical rule: solving a square system, use PLU. Solving least squares, use QR. Needing to know how ' +
            'close to singular something is, or wanting the best low-rank approximation, use SVD. Working with a ' +
            'covariance matrix, use Cholesky.',
        ]),
        el('h3', 'Why factorise at all?'),
        el('p', [
          'A factorisation replaces one hard problem with a chain of easy ones. Triangular systems are easy to solve, ' +
            'orthogonal matrices are easy to invert (Qᵗ = Q⁻¹), and diagonal matrices are easy to raise to powers. ' +
            'Every decomposition here is an attempt to express a general matrix in terms of those three easy kinds.',
        ]),
      ]),
    ]);
  }

  ML.registerView({
    id: 'decompositions',
    title: 'Decompositions',
    heading: 'Matrix Decompositions',
    tagline: 'LU, PLU, QR, Cholesky and SVD — with the conditions each one needs and the reconstruction checked.',
    icon: '⊞',
    build: buildView,
  });
})((globalThis.ML = globalThis.ML || {}));
