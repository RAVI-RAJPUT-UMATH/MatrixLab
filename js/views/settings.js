/**
 * MatrixLab — Settings.
 *
 * Number display, theme, workspace management, and an honest statement of what
 * the application can and cannot do.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;

  function buildView() {
    const sample = ML.Matrix.from([['1/3', '2', '-0.5'], ['1000000', '1/7', '0'], ['22/7', '-3/4', '1']]);
    const preview = el('div');

    function refreshPreview() {
      ui.safeRender(preview, function () {
        return el('div.row.row--top', [
          ui.renderMatrix(sample, { label: 'preview' }),
          el('div.small.muted', { style: { maxWidth: '34ch' } }, [
            el('p', 'The same matrix, shown with the current settings. Internal calculations are unaffected — these controls change presentation only.'),
          ]),
        ]);
      });
    }

    const formatControl = ui.segmented({
      label: 'Number format',
      value: ML.config.format,
      options: [
        { value: 'auto', label: 'Automatic', title: 'Exact values as fractions, numeric ones as decimals' },
        { value: 'fraction', label: 'Prefer fractions', title: 'Also try to recognise decimals as fractions' },
        { value: 'decimal', label: 'Always decimals' },
      ],
      onChange: function (value) {
        ML.store.setSetting('format', value);
        ML.setConfig({ format: value });
      },
    });

    const decimalsControl = ui.segmented({
      label: 'Decimal places',
      value: String(ML.config.decimals),
      options: [
        { value: '2', label: '2' },
        { value: '4', label: '4' },
        { value: '6', label: '6' },
        { value: '8', label: '8' },
      ],
      onChange: function (value) {
        ML.store.setSetting('decimals', Number(value));
        ML.setConfig({ decimals: Number(value) });
      },
    });

    const themeControl = ML.theme.control();

    refreshPreview();

    const storageStatus = ML.store.available
      ? ui.alert('ok', 'Your matrices and preferences are being saved in this browser. Nothing leaves your device.')
      : ui.alert(
          'warn',
          'Local storage is unavailable in this browser context, so settings and matrices will not persist between ' +
            'visits. Everything still works for this session.'
        );

    return [
      ui.card({
        title: 'Numbers',
        subtitle: 'How results are displayed',
        body: el('div.stack', [
          el('div.field', [el('span.label', 'Format'), formatControl]),
          el('div.field', [el('span.label', 'Decimal places'), decimalsControl]),
          preview,
          el('p.small.muted', [
            'Changing these never changes an answer. Elimination, determinants, inverses, rank and solving all run in ' +
              'exact rational arithmetic regardless of what is displayed; the decimal setting only affects values that ' +
              'are genuinely irrational, such as lengths, eigenvectors of irrational eigenvalues, and the entries of ' +
              'QR, Cholesky and SVD factors.',
          ]),
        ]),
      }),

      ui.card({
        title: 'Appearance',
        body: el('div.stack', [
          el('div.field', [el('span.label', 'Colour theme'), themeControl]),
          el('p.small.muted', [
            'The button switches between light and dark, and shows the one it will switch to. Until you press it, ' +
              'MatrixLab follows your operating system, which currently prefers ',
            el('strong', ML.theme.systemPrefers()),
            '. After that your choice is remembered on this device.',
          ]),
        ]),
      }),

      ui.card({
        title: 'Workspace',
        subtitle: 'Matrices are shared between tools',
        body: el('div.stack', [
          storageStatus,
          el('p.small.muted', [
            'The matrix you type in one tool is waiting for you in the next. That is deliberate — analysing the same ' +
              'matrix from several angles is how the connections between rank, determinant, eigenvalues and subspaces ' +
              'become visible.',
          ]),
          el('div.row.row--tight', [
            ui.button('Clear saved matrices and settings', {
              onClick: function () {
                ML.store.clear();
                ML.setConfig({ decimals: 4, format: 'auto' });
                // The stored choice went with the workspace, so fall back to
                // the system preference again.
                ML.theme.apply(ML.theme.systemPrefers());
                ui.announce('Workspace cleared');
                ML.router.render();
              },
            }),
            ML.getView('examples')
              ? ui.button('Load an example instead', {
                  variant: 'ghost',
                  onClick: function () { ML.router.navigate('examples'); },
                })
              : null,
          ]),
        ]),
      }),

      ui.card({
        title: 'What MatrixLab can and cannot do',
        subtitle: 'Stated plainly, so you know when to reach for something else',
        body: el('div.stack', [
          el('div', [
            ui.sectionLabel('Exact — no rounding at all'),
            el('ul.small', [
              el('li', 'Addition, subtraction, multiplication, powers, transpose, trace'),
              el('li', 'Row reduction, REF, RREF, rank, and every solution of Ax = b'),
              el('li', 'Determinants, minors, cofactors, adjugate and inverses'),
              el('li', 'All four fundamental subspaces, independence, span and basis'),
              el('li', 'Dot products, cross products, projections and Gram–Schmidt’s orthogonal vectors'),
              el('li', 'Least squares via the normal equations, including R²'),
              el('li', 'LU and PLU factorisations'),
              el('li', 'Characteristic polynomials, and eigenvalues that are rational or come from a quadratic'),
            ]),
          ]),
          el('div', [
            ui.sectionLabel('Numeric — labelled wherever it appears'),
            el('ul.small', [
              el('li', 'Vector lengths and angles, and unit vectors with irrational lengths'),
              el('li', 'Eigenvectors belonging to irrational or complex eigenvalues'),
              el('li', 'Eigenvalues from a cubic or higher factor with no rational roots'),
              el('li', 'QR, Cholesky and SVD, which all require square roots'),
            ]),
          ]),
          el('div', [
            ui.sectionLabel('Deliberately not included'),
            el('ul.small', [
              el('li', 'Jordan normal form for defective matrices'),
              el('li', 'Complex-valued matrix input (complex numbers appear only as computed eigenvalues)'),
              el('li', 'Matrices larger than ' + ML.MAX_DIM + '×' + ML.MAX_DIM + ', and eigenvalue analysis beyond 8×8'),
              el('li', 'Symbolic entries — every value must be a number'),
            ]),
          ]),
          ui.alert(
            'info',
            'Where a result cannot be given exactly, MatrixLab says so and reports the residual rather than presenting ' +
              'an approximation as though it were exact. If an algorithm cannot deliver a trustworthy answer, it ' +
              'refuses and explains why.'
          ),
        ]),
      }),

      ui.card({
        title: 'About',
        body: el('div.lesson', [
          el('p', [
            el('strong', 'MatrixLab '),
            'version ' + ML.version + ' — an interactive linear algebra toolkit that runs entirely in your browser. ' +
              'No server, no account, no network requests, no dependencies. The page works offline once loaded, and ' +
              'can be opened straight from the file system.',
          ]),
          el('p', [
            'Topic organisation was guided by the standard sequence used in introductory linear algebra courses, ' +
              'notably the elimination-first approach popularised by Gilbert Strang. All explanations, examples, code ' +
              'and interface here are original to MatrixLab, which is not affiliated with or endorsed by any author or ' +
              'publisher.',
          ]),
          el('p.small.muted', [
            'Found a wrong answer? That is a serious bug, not a rounding quirk — the test suite covers every module ' +
              'with hand-verified values, so a mismatch means something is genuinely broken.',
          ]),
        ]),
      }),
    ];
  }

  ML.registerView({
    id: 'settings',
    title: 'Settings',
    tagline: 'Number display, theme, workspace, and an honest account of what this toolkit does.',
    icon: '⚙',
    build: buildView,
  });
})((globalThis.ML = globalThis.ML || {}));
