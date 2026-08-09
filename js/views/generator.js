/**
 * MatrixLab — Special Matrix Generator.
 *
 * Builds matrices of a chosen kind and size, ready to send to any tool. Useful
 * for practice, and for producing a matrix with a property you want to study
 * (guaranteed invertible, guaranteed symmetric, and so on).
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;

  const state = {
    kind: ML.store.getSetting('gen.kind', 'random'),
    rows: Number(ML.store.getSetting('gen.rows', 3)),
    cols: Number(ML.store.getSetting('gen.cols', 3)),
    min: ML.store.getSetting('gen.min', '-9'),
    max: ML.store.getSetting('gen.max', '9'),
    density: Number(ML.store.getSetting('gen.density', 30)),
    result: null,
  };

  const KINDS = {
    zero: { label: 'Zero', square: false, note: 'Every entry 0. Rank 0, and it sends every vector to the origin.' },
    identity: { label: 'Identity', square: true, note: 'The multiplicative identity: AI = IA = A.' },
    random: { label: 'Random', square: false, range: true, note: 'Whole numbers in the range you choose. Usually invertible if square, but not guaranteed.' },
    diagonal: { label: 'Diagonal', square: true, range: true, note: 'Entries only on the diagonal, which are then the eigenvalues.' },
    symmetric: { label: 'Symmetric', square: true, range: true, note: 'A = Aᵗ, so the eigenvalues are real and the eigenvectors perpendicular.' },
    upperTriangular: { label: 'Upper triangular', square: true, range: true, note: 'Zeros below the diagonal. The determinant is the product of the diagonal.' },
    lowerTriangular: { label: 'Lower triangular', square: true, range: true, note: 'Zeros above the diagonal.' },
    sparse: { label: 'Sparse', square: false, range: true, density: true, note: 'Mostly zeros. Real-world large matrices are almost always like this.' },
    invertible: { label: 'Guaranteed invertible', square: true, note: 'Built as a product of unit triangular matrices, so the determinant is exactly 1 and the inverse has whole-number entries.' },
  };

  function buildView() {
    const resultHost = el('div');
    const kind = KINDS[state.kind] || KINDS.random;

    const kindPicker = el(
      'div.op-picker',
      Object.keys(KINDS).map(function (key) {
        return el('button.chip', {
          type: 'button',
          text: KINDS[key].label,
          title: KINDS[key].note,
          'aria-pressed': key === state.kind ? 'true' : 'false',
          onClick: function () {
            state.kind = key;
            ML.store.setSetting('gen.kind', key);
            state.result = null;
            ML.router.render();
          },
        });
      })
    );

    const rowStepper = ui.stepper({
      label: 'Rows',
      value: state.rows,
      min: 1,
      max: ML.MAX_DIM,
      onChange: function (value) {
        state.rows = value;
        ML.store.setSetting('gen.rows', value);
        if (kind.square) {
          state.cols = value;
          ML.store.setSetting('gen.cols', value);
          if (colStepper) colStepper.mlSet(value);
        }
        generate();
      },
    });

    const colStepper = ui.stepper({
      label: 'Columns',
      value: kind.square ? state.rows : state.cols,
      min: 1,
      max: ML.MAX_DIM,
      onChange: function (value) {
        state.cols = value;
        ML.store.setSetting('gen.cols', value);
        generate();
      },
    });

    const minField = ui.numberInput({
      label: 'Minimum',
      value: state.min,
      onInput: function (value) {
        state.min = value;
        ML.store.setSetting('gen.min', value);
      },
      onEnter: generate,
    });

    const maxField = ui.numberInput({
      label: 'Maximum',
      value: state.max,
      onInput: function (value) {
        state.max = value;
        ML.store.setSetting('gen.max', value);
      },
      onEnter: generate,
    });

    const densitySlider = el('input.range', {
      type: 'range',
      min: '5',
      max: '90',
      step: '5',
      value: String(state.density),
      'aria-label': 'Percentage of non-zero entries',
      onInput: function (event) {
        state.density = Number(event.target.value);
        ML.store.setSetting('gen.density', state.density);
        generate();
      },
    });

    function generate() {
      ui.safeRender(resultHost, function () {
        const options = {};
        if (kind.range) {
          const min = Math.round(ML.Frac.parse(state.min).toNumber());
          const max = Math.round(ML.Frac.parse(state.max).toNumber());
          if (min > max) {
            throw new ML.MLError('The minimum (' + min + ') must not be greater than the maximum (' + max + ').');
          }
          options.min = min;
          options.max = max;
        }
        if (kind.density) options.density = state.density / 100;

        const rows = state.rows;
        const cols = kind.square ? state.rows : state.cols;

        let matrix;
        switch (state.kind) {
          case 'zero':
            matrix = ML.generate.zero(rows, cols);
            break;
          case 'identity':
            matrix = ML.generate.identity(rows);
            break;
          case 'random':
            matrix = ML.generate.random(rows, cols, options);
            break;
          case 'diagonal':
            matrix = ML.generate.diagonal(rows, options);
            break;
          case 'symmetric':
            matrix = ML.generate.symmetric(rows, options);
            break;
          case 'upperTriangular':
            matrix = ML.generate.upperTriangular(rows, options);
            break;
          case 'lowerTriangular':
            matrix = ML.generate.lowerTriangular(rows, options);
            break;
          case 'sparse':
            matrix = ML.generate.sparse(rows, cols, options);
            break;
          case 'invertible':
            matrix = ML.generate.invertible(rows, {});
            break;
          default:
            throw new ML.MLError('Unknown matrix kind.');
        }
        state.result = matrix;
        return buildResult(matrix);
      });
    }

    function buildResult(matrix) {
      const facts = [['Size', matrix.size()], ['Rank', String(ML.matrixRank(matrix))]];
      if (matrix.isSquare()) {
        const determinant = ML.determinant(matrix);
        facts.push(['Determinant', ML.fmt(determinant)]);
        facts.push(['Trace', ML.fmt(ML.traceMatrix(matrix))]);
        facts.push(['Invertible', determinant.isZero() ? 'no' : 'yes']);
        facts.push(['Symmetric', ML.isSymmetric(matrix) ? 'yes' : 'no']);
      }

      const targets = [
        ['calculator', 'Calculator'],
        ['analysis', 'Analysis'],
        ['properties', 'Properties'],
        ['row-reduction', 'Row reduce'],
        ['eigen', 'Eigenvalues'],
        ['decompositions', 'Decompose'],
      ].filter(function (pair) { return ML.getView(pair[0]); });

      return el('div.stack', [
        el('div.row.row--top', [
          ui.renderMatrix(matrix, { label: 'Generated' }),
          el('div.stack-sm', { style: { flex: '1', minWidth: '200px' } }, [
            ui.readout(facts.map(function (pair) { return [pair[0], el('span', pair[1])]; })),
          ]),
        ]),
        el('div.row.row--tight', [
          ui.button('Generate again', { variant: 'primary', onClick: generate }),
          ui.copyButton(function () { return ui.matrixToText(matrix); }, 'Copy'),
        ]),
        el('div', [
          ui.sectionLabel('Send it to'),
          el(
            'div.row.row--tight',
            targets.map(function (pair) {
              return ui.button(pair[1], {
                size: 'sm',
                variant: 'ghost',
                onClick: function () {
                  ML.store.setMatrix('A', matrix);
                  ML.router.navigate(pair[0]);
                },
              });
            })
          ),
        ]),
      ]);
    }

    generate();

    return [
      ui.card({
        title: 'Generate a matrix',
        subtitle: kind.note,
        actions: [ui.button('Generate', { variant: 'primary', size: 'sm', onClick: generate })],
        body: el('div.stack', [
          el('div', [ui.sectionLabel('Kind'), kindPicker]),
          el('div.row', [
            el('div.field.field--inline', [el('span.label', 'Rows'), rowStepper]),
            kind.square
              ? el('span.badge', 'square: columns = rows')
              : el('div.field.field--inline', [el('span.label', 'Columns'), colStepper]),
          ]),
          kind.range ? el('div.row', [minField, maxField]) : null,
          kind.density
            ? el('div.field', [
                el('span.label', 'Non-zero entries: about ' + state.density + '%'),
                densitySlider,
              ])
            : null,
        ]),
      }),
      resultHost,
      ui.card({
        title: 'Why generate matrices?',
        body: el('div.lesson', [
          el('p', [
            'Practising on random matrices is how the operations become automatic. But random matrices also mislead: a ' +
              'random square matrix is almost always invertible, has distinct eigenvalues and is well behaved — so if ' +
              'you only ever test on random input, you never meet the interesting cases.',
          ]),
          el('p', [
            'That is what the other kinds are for. Generate a singular matrix to see elimination produce a zero row, a ' +
              'symmetric one to see perpendicular eigenvectors appear, a triangular one to read the determinant off the ' +
              'diagonal. The Examples library goes further, with specific matrices chosen to demonstrate specific ideas.',
          ]),
          el('p', [
            'The “guaranteed invertible” option is built by multiplying a unit lower triangular matrix by a unit upper ' +
              'triangular one. Both have determinant 1, so the product does too — which means its inverse has ' +
              'whole-number entries, making it excellent for practising inversion by hand.',
          ]),
        ]),
      }),
    ];
  }

  ML.registerView({
    id: 'generator',
    title: 'Generator',
    heading: 'Special Matrix Generator',
    tagline: 'Build zero, identity, diagonal, symmetric, triangular, sparse or guaranteed-invertible matrices.',
    icon: '✧',
    build: buildView,
  });
})((globalThis.ML = globalThis.ML || {}));
