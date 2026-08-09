/**
 * MatrixLab — Example Library.
 *
 * Every example says what it demonstrates and loads in one click, either into
 * the shared workspace or straight into the tool where it is most interesting.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;

  const state = {
    category: ML.store.getSetting('ex.category', 'All'),
  };

  function buildView() {
    const filterRow = el(
      'div.row.row--tight',
      ['All'].concat(ML.examples.categories).map(function (category) {
        return el('button.chip', {
          type: 'button',
          text: category,
          'aria-pressed': state.category === category ? 'true' : 'false',
          onClick: function () {
            state.category = category;
            ML.store.setSetting('ex.category', category);
            ML.router.render();
          },
        });
      })
    );

    const list = state.category === 'All' ? ML.examples.all : ML.examples.byCategory(state.category);

    const cards = el(
      'div.grid-auto',
      list.map(function (example) { return buildCard(example); })
    );

    return [
      ui.card({
        title: 'Browse by theme',
        subtitle: list.length + ' example' + (list.length === 1 ? '' : 's'),
        body: el('div.stack', [
          filterRow,
          el('p.small.muted', [
            'Every matrix here is small and integer-friendly on purpose, so you can check MatrixLab’s working by hand. ' +
              'Loading an example puts it in the shared workspace, so it is waiting for you in every other tool.',
          ]),
        ]),
      }),
      cards,
    ];
  }

  function buildCard(example) {
    let matrix = null;
    let error = null;
    try {
      matrix = ML.examples.matrixOf(example);
    } catch (err) {
      error = err;
    }

    const targets = [
      ['calculator', 'Calculator'],
      ['analysis', 'Analysis'],
      ['properties', 'Properties'],
      ['row-reduction', 'Row reduce'],
      ['eigen', 'Eigenvalues'],
      ['subspaces', 'Subspaces'],
      ['decompositions', 'Decompose'],
    ].filter(function (pair) { return ML.getView(pair[0]); });

    const best = example.best && ML.getView(example.best) ? example.best : 'analysis';
    const bestLabel = (targets.filter(function (pair) { return pair[0] === best; })[0] || ['', 'Open'])[1];

    function load(target) {
      ML.store.setMatrix('A', matrix);
      ui.announce(example.name + ' loaded');
      if (target) ML.router.navigate(target);
    }

    return el('article.example-card', [
      el('div.example-card__top', [
        el('div', [
          el('div.example-card__name', example.name),
          el('div.tiny.muted', example.category),
        ]),
        matrix ? ui.badge(matrix.size(), 'brand') : ui.badge('invalid', 'err'),
      ]),
      error
        ? ui.errorPanel(error)
        : el('div.example-card__preview', [ui.renderMatrix(matrix, { compact: true })]),
      el('p.example-card__desc', example.teaches),
      el('div.row.row--tight', [
        ui.button('Load & open ' + bestLabel, {
          variant: 'primary',
          size: 'sm',
          disabled: !matrix,
          onClick: function () { load(best); },
        }),
        ui.button('Load only', {
          size: 'sm',
          variant: 'ghost',
          disabled: !matrix,
          title: 'Put it in the workspace without changing page',
          onClick: function () { load(null); },
        }),
      ]),
      matrix
        ? ui.disclosure('Quick facts', function () { return buildFacts(matrix); })
        : null,
    ]);
  }

  /** A few genuinely computed facts, so the card is not just prose. */
  function buildFacts(matrix) {
    const pairs = [['Size', matrix.size()], ['Rank', String(ML.matrixRank(matrix))]];
    if (matrix.isSquare()) {
      const determinant = ML.determinant(matrix);
      pairs.push(['Determinant', ML.fmt(determinant)]);
      pairs.push(['Trace', ML.fmt(ML.traceMatrix(matrix))]);
      pairs.push(['Invertible', determinant.isZero() ? 'no' : 'yes']);
      pairs.push(['Symmetric', ML.isSymmetric(matrix) ? 'yes' : 'no']);
      if (matrix.rows <= 6) {
        try {
          const spectrum = ML.eigenvalues(matrix);
          pairs.push([
            'Eigenvalues',
            spectrum.values
              .map(function (value) {
                return value.text + (value.multiplicity > 1 ? ' (×' + value.multiplicity + ')' : '');
              })
              .join(', ') + (spectrum.allExact ? '' : '  (numerical)'),
          ]);
        } catch (error) {
          pairs.push(['Eigenvalues', 'not computed: ' + error.message]);
        }
      }
    } else {
      pairs.push(['Nullity', String(matrix.cols - ML.matrixRank(matrix))]);
    }
    return ui.readout(pairs.map(function (pair) { return [pair[0], el('span', pair[1])]; }));
  }

  ML.registerView({
    id: 'examples',
    title: 'Examples',
    heading: 'Example Matrix Library',
    tagline: 'Matrices chosen to demonstrate one idea each — load any of them straight into a tool.',
    icon: '⁂',
    build: buildView,
  });
})((globalThis.ML = globalThis.ML || {}));
