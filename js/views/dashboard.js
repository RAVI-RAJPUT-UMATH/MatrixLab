/**
 * MatrixLab — Dashboard.
 * Entry point: what the toolkit contains and where to start.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;

  /** Tiles are filtered against the registry, so nothing links to a dead end. */
  const TILES = [
    { id: 'calculator', desc: 'Add, multiply, transpose, invert — with the working shown.' },
    { id: 'properties', desc: 'Symmetric? Singular? Orthogonal? Analyse any matrix at a glance.' },
    { id: 'row-reduction', desc: 'Do row operations yourself, or watch Gauss–Jordan run.' },
    { id: 'equations', desc: 'Solve Ax = b and see which of the three outcomes you get.' },
    { id: 'eigen', desc: 'Characteristic polynomial, eigenvalues, eigenvectors, diagonalisation.' },
    { id: 'decompositions', desc: 'Factor a matrix: LU, QR, Cholesky, SVD.' },
    { id: 'subspaces', desc: 'Column space, row space, null space and the rank–nullity theorem.' },
    { id: 'least-squares', desc: 'Fit a line to data the linear-algebra way.' },
    { id: 'vectors', desc: 'Dot and cross products, angles, projections, unit vectors.' },
    { id: 'orthogonality', desc: 'Projections, orthogonal complements, Gram–Schmidt.' },
    { id: 'transformations', desc: 'Watch a 2×2 matrix bend the plane.' },
    { id: 'visualizations', desc: 'See the determinant as area, and eigenvectors as fixed directions.' },
    { id: 'learn', desc: 'Eight levels from “what is a matrix” to SVD.' },
    { id: 'examples', desc: 'Ready-made matrices chosen to show something specific.' },
    { id: 'generator', desc: 'Build identity, diagonal, symmetric, triangular or random matrices.' },
  ];

  const PATH = [
    ['Level 1–2', 'Matrices and the basic operations', 'foundations'],
    ['Level 3', 'Elimination, REF and RREF, solving systems', 'systems'],
    ['Level 4–5', 'Vector spaces and linear transformations', 'spaces'],
    ['Level 6–7', 'Orthogonality, then eigenvalues', 'orthogonality'],
    ['Level 8', 'Factorisations and applications', 'advanced'],
  ];

  ML.registerView({
    id: 'dashboard',
    title: 'Dashboard',
    heading: 'MatrixLab',
    tagline: 'Interactive Linear Algebra Toolkit — a calculator that shows its work, plus visualisations and lessons.',
    icon: '▦',
    build: function () {
      const stored = ML.store.getMatrix('A');

      const intro = ui.card({
        className: 'card--accent',
        body: el('div.stack', [
          el('p', [
            'Every calculation here answers three questions: ',
            el('strong', 'what is this'),
            ', ',
            el('strong', 'how is it worked out'),
            ', and ',
            el('strong', 'what is the answer'),
            '. Results come with the real steps the algorithm took — not a canned script.',
          ]),
          el('p.small.muted', [
            'Entries can be whole numbers, decimals or fractions such as ',
            el('code', '3/4'),
            '. Elimination, determinants, inverses and solving all run in exact rational arithmetic, so ',
            el('code', '1/3'),
            ' stays ',
            el('code', '1/3'),
            ' and a singular matrix is never mistaken for an invertible one.',
          ]),
          el('div.row', [
            ui.button('Open the calculator', {
              variant: 'primary',
              onClick: function () { ML.router.navigate('calculator'); },
            }),
            ML.getView('learn')
              ? ui.button('Start learning', { onClick: function () { ML.router.navigate('learn'); } })
              : null,
            ML.getView('examples')
              ? ui.button('Browse examples', { onClick: function () { ML.router.navigate('examples'); } })
              : null,
          ]),
        ]),
      });

      const tiles = el(
        'div.tiles',
        TILES.map(function (tile) {
          const view = ML.getView(tile.id);
          if (!view) return null;
          return el('a.tile', { href: '#/' + tile.id }, [
            el('span.tile__icon', { 'aria-hidden': 'true' }, view.icon || '·'),
            el('span.tile__title', view.title),
            el('span.tile__desc', tile.desc),
          ]);
        }).filter(Boolean)
      );

      const workspace = stored
        ? ui.card({
            title: 'Your workspace',
            subtitle: 'The matrix you last worked with, kept between visits',
            actions: [
              ui.button('Open in calculator', { size: 'sm', onClick: function () { ML.router.navigate('calculator'); } }),
            ],
            body: el('div.row.row--top', [
              ui.renderMatrix(stored, { label: 'A =' }),
              el('div.stack-sm', [
                el('p.small.muted', 'Jump straight to a tool with this matrix already loaded:'),
                el(
                  'div.row.row--tight',
                  [
                    ['properties', 'Analyse properties'],
                    ['row-reduction', 'Row reduce'],
                    ['eigen', 'Eigenvalues'],
                    ['decompositions', 'Decompose'],
                  ]
                    .filter(function (pair) { return ML.getView(pair[0]); })
                    .map(function (pair) {
                      return ui.button(pair[1], {
                        size: 'sm',
                        onClick: function () { ML.router.navigate(pair[0]); },
                      });
                    })
                ),
              ]),
            ]),
          })
        : null;

      const path = ui.card({
        title: 'Suggested route through the subject',
        body: el('div.stack-sm', [
          el('p.small.muted', 'Linear algebra rewards taking the ideas in order. A workable sequence:'),
          el(
            'ol',
            PATH.map(function (row) {
              return el('li', [el('strong', row[0] + ' — '), row[1]]);
            })
          ),
          ML.getView('learn')
            ? ui.button('Go to Learn', { size: 'sm', onClick: function () { ML.router.navigate('learn'); } })
            : null,
        ]),
      });

      return [intro, workspace, el('div', [ui.sectionLabel('All tools'), tiles]), path];
    },
  });
})((globalThis.ML = globalThis.ML || {}));
