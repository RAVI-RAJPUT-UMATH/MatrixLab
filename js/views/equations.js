/**
 * MatrixLab — Systems of Linear Equations.
 *
 * Enter the system either as a coefficient matrix with a right-hand side, or
 * by typing the equations. Four methods are available, and the verdict —
 * unique, none, or infinitely many — is always stated with its reason.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;

  const state = {
    mode: ML.store.getSetting('eq.mode', 'matrix'),
    method: ML.store.getSetting('eq.method', 'gauss-jordan'),
    text: ML.store.getSetting('eq.text', 'x + y + z = 6\n2y + 5z = -4\n2x + 5y - z = 27'),
  };

  const METHODS = {
    'gauss-jordan': {
      label: 'Gauss–Jordan',
      note: 'Reduces [A | b] fully. Works for every shape and always classifies the outcome.',
    },
    back: {
      label: 'Back-substitution',
      note: 'Forward elimination to a staircase, then solve upwards. Square systems with a unique solution.',
    },
    inverse: {
      label: 'Inverse method',
      note: 'x = A⁻¹b. Square, non-singular systems only.',
    },
    cramer: {
      label: "Cramer's rule",
      note: 'Each unknown as a ratio of determinants. Square, non-singular, up to 5×5.',
    },
  };

  function buildView() {
    const resultHost = el('div');

    /* ------------------------------ inputs ---------------------------- */

    const inputA = ML.store.bind(
      'A',
      new ui.MatrixInput({
        name: 'A',
        rows: 3,
        cols: 3,
        values: ML.store.getValuesOrDefault('A', [['1', '1', '1'], ['0', '2', '5'], ['2', '5', '-1']]),
        hint: 'One row per equation, one column per unknown.',
        onChange: function (self) {
          if (inputB.rows !== self.rows) inputB.setSize(self.rows, 1);
          solve(false);
        },
      })
    );

    const inputB = ML.store.bind(
      'b',
      new ui.MatrixInput({
        name: 'b',
        rows: 3,
        cols: 1,
        fixedCols: true,
        values: ML.store.getValuesOrDefault('b', [['6'], ['-4'], ['27']]),
        hint: 'The right-hand side.',
        onChange: function () { solve(false); },
      })
    );

    const textArea = el('textarea.input', {
      rows: 5,
      spellcheck: 'false',
      'aria-label': 'System of equations',
      value: state.text,
      placeholder: '2x + 3y = 5\nx - y = 1',
      onInput: function (event) {
        state.text = event.target.value;
        ML.store.setSetting('eq.text', state.text);
      },
    });

    const modePicker = ui.segmented({
      label: 'How to enter the system',
      value: state.mode,
      options: [
        { value: 'matrix', label: 'Matrix form' },
        { value: 'text', label: 'Type equations' },
      ],
      onChange: function (value) {
        state.mode = value;
        ML.store.setSetting('eq.mode', value);
        ML.router.render();
      },
    });

    const methodPicker = ui.select({
      label: 'Method',
      value: state.method,
      options: Object.keys(METHODS).map(function (key) {
        return { value: key, label: METHODS[key].label };
      }),
      hint: METHODS[state.method].note,
      onChange: function (value) {
        state.method = value;
        ML.store.setSetting('eq.method', value);
        ML.router.render();
      },
    });

    /* ------------------------------ solving --------------------------- */

    function readSystem() {
      if (state.mode === 'text') {
        const parsed = ML.parseSystem(textArea.value);
        return { A: parsed.A, b: parsed.b, names: parsed.names };
      }
      const A = inputA.getMatrix();
      const b = inputB.getMatrix();
      return { A: A, b: b, names: ML.variableNames(A.cols) };
    }

    function solve(showErrors) {
      let system;
      try {
        system = readSystem();
      } catch (error) {
        ui.clear(resultHost);
        resultHost.appendChild(
          showErrors ? ui.errorPanel(error) : ui.emptyState('Complete the system, then press Solve.')
        );
        return;
      }
      ui.safeRender(resultHost, function () { return buildResult(system); });
    }

    function buildResult(system) {
      const A = system.A;
      const b = system.b;
      const names = system.names;

      // Gauss–Jordan always runs: it is the only method that classifies every
      // case, so its verdict frames whatever the chosen method produces.
      const classifySteps = new ML.StepLog('Gauss–Jordan elimination');
      const report = ML.solveLinearSystem(A, b, state.method === 'gauss-jordan' ? classifySteps : null, {
        names: names,
      });

      let steps = classifySteps;
      let extra = null;

      if (state.method !== 'gauss-jordan') {
        steps = new ML.StepLog(METHODS[state.method].label);
        try {
          if (state.method === 'back') ML.solveByBackSubstitution(A, b, steps);
          else if (state.method === 'inverse') ML.solveByInverse(A, b, steps);
          else if (state.method === 'cramer') ML.solveByCramer(A, b, steps);
        } catch (error) {
          extra = ui.alert('warn', error.message, METHODS[state.method].label + ' cannot be used here.');
          steps = new ML.StepLog(METHODS[state.method].label);
          ML.solveLinearSystem(A, b, steps, { names: names });
        }
      }

      const verdictKind = report.type === 'unique' ? 'ok' : report.type === 'none' ? 'error' : 'warn';
      const verdictTitle =
        report.type === 'unique' ? 'Exactly one solution' : report.type === 'none' ? 'No solution' : 'Infinitely many solutions';

      const answer =
        report.type === 'unique'
          ? el('div.stack', [
              el('div.row.row--top', [
                ui.renderMatrix(report.solution, { label: 'x =' }),
                el(
                  'div.stack-sm',
                  names.map(function (name, i) {
                    return el('div.formula', name + ' = ' + ML.fmt(report.solution.get(i, 0)));
                  })
                ),
              ]),
            ])
          : report.type === 'infinite'
          ? el('div.stack', [
              el('div.stack-sm', report.parametric.lines.map(function (line) { return el('div.formula', line); })),
              el('p.small.muted', [
                'Every choice of ' + report.parametric.parameters.join(', ') + ' gives another solution. ' +
                  'In vector form: one particular solution plus any combination of the null-space directions.',
              ]),
              el('div.scroll-x', [
                ui.renderExpression(
                  [{ matrix: report.particular, label: 'xₚ' }].concat(
                    report.nullBasis.map(function (vector, k) {
                      return [ '+ ' + report.parametric.parameters[k], { matrix: vector, label: null }];
                    }).reduce(function (all, pair) { return all.concat(pair); }, [])
                  )
                ),
              ]),
            ])
          : el('div.stack', [
              el('p', 'The equations contradict one another, so no choice of ' + names.join(', ') + ' can satisfy them all.'),
              ui.renderMatrix(report.rref, {
                label: 'rref[A | b] =',
                augmentAt: A.cols,
                highlight: { rows: inconsistentRows(report, A.cols) },
              }),
            ]);

      const rankInfo = ui.kpis([
        { label: 'Equations', node: el('span', String(report.equations)) },
        { label: 'Unknowns', node: el('span', String(report.variables)) },
        { label: 'rank(A)', node: el('span', String(report.rank)) },
        { label: 'rank[A|b]', node: el('span', String(report.rankAugmented)) },
        { label: 'Free variables', node: el('span', String(report.freeColumns.length)) },
      ]);

      return el('div.stack-lg', [
        ui.card({
          title: 'The system',
          body: el('div.stack', [
            el('div.stack-sm', ML.equationLines(A, b, names).map(function (line) { return el('div.formula', line); })),
            el('div.scroll-x', [
              ui.renderMatrix(ML.augment(A, b), { label: '[A | b] =', augmentAt: A.cols }),
            ]),
          ]),
        }),
        extra,
        ui.resultBlock({
          title: null,
          result: el('div.stack', [
            ui.alert(verdictKind, report.summary, verdictTitle),
            answer,
            rankInfo,
            el('p.small.muted', rouchéNote(report)),
          ]),
          steps: steps,
          explanation: explanation(report),
        }),
      ]);
    }

    function inconsistentRows(report, n) {
      const rows = [];
      for (let i = 0; i < report.rref.rows; i++) {
        let allZero = true;
        for (let j = 0; j < n; j++) {
          if (!report.rref.get(i, j).isZero()) {
            allZero = false;
            break;
          }
        }
        if (allZero && !report.rref.get(i, n).isZero()) rows.push(i);
      }
      return rows;
    }

    const inputs =
      state.mode === 'text'
        ? el('div.stack', [
            textArea,
            el('p.small.muted', [
              'One equation per line. Terms look like ',
              el('code', '2x'),
              ', ',
              el('code', '-3.5y'),
              ' or ',
              el('code', '1/2z'),
              '. Constants may sit on either side, and variables can be any letters — MatrixLab works out the ' +
                'unknowns and their order from what you type.',
            ]),
          ])
        : el('div.row.row--top', [
            el('div', { style: { flex: '1 1 320px', minWidth: '0' } }, [inputA.element]),
            el('div', { style: { flex: '0 0 auto' } }, [inputB.element]),
          ]);

    const controls = ui.card({
      title: 'Solve Ax = b',
      actions: [ui.button('Solve', { variant: 'primary', onClick: function () { solve(true); } })],
      body: el('div.stack', [
        el('div.row', [modePicker, methodPicker]),
        inputs,
      ]),
    });

    solve(false);
    return [controls, resultHost];
  }

  function rouchéNote(report) {
    if (report.type === 'none') {
      return 'rank(A) = ' + report.rank + ' but rank[A|b] = ' + report.rankAugmented +
        '. When adding b raises the rank, b lies outside the column space of A and the system is inconsistent.';
    }
    if (report.type === 'unique') {
      return 'rank(A) = rank[A|b] = ' + report.rank + ' = number of unknowns, which is exactly the condition for a ' +
        'single solution.';
    }
    return 'rank(A) = rank[A|b] = ' + report.rank + ', which is less than the ' + report.variables +
      ' unknowns. The system is consistent but under-determined, leaving ' + report.freeColumns.length +
      ' degree(s) of freedom.';
  }

  function explanation(report) {
    return [
      el('h3', 'Three possibilities, and how to tell them apart'),
      el('p', [
        'A system of linear equations has exactly one solution, no solutions, or infinitely many — never two, never ' +
          'five. Geometrically, each equation in three unknowns is a plane; planes can meet at a single point, meet ' +
          'along a line or in a whole plane, or fail to share any common point at all.',
      ]),
      el('p', [
        'Elimination settles which case you are in by comparing two ranks. Let r = rank(A) and R = rank[A | b], and ' +
          'let n be the number of unknowns:',
      ]),
      el('ul', [
        el('li', [el('strong', 'r < R'), ' — inconsistent. Some row reduces to 0 = (non-zero), which is impossible.']),
        el('li', [el('strong', 'r = R = n'), ' — exactly one solution. Every unknown has a pivot.']),
        el('li', [el('strong', 'r = R < n'), ' — infinitely many. The n − r columns without pivots are free.']),
      ]),
      el('div.callout', [
        el('div.callout__title', 'Reading the general solution'),
        el('p', [
          'When solutions are infinite, they always take the same shape: one particular solution plus anything in the ' +
            'null space of A. Set the free variables to zero to get the particular solution; set one free variable to 1 ' +
            'and the rest to 0 to get each null-space direction. Adding any combination of those directions moves you ' +
            'to another solution without changing Ax.',
        ]),
      ]),
      el('h3', 'Which method should you use?'),
      el('p', [
        'Gauss–Jordan is the honest default: it needs no assumptions, works for rectangular systems, and diagnoses all ' +
          'three cases. Back-substitution does slightly less work when you know the system is square with one ' +
          'solution. The inverse method and ' + "Cramer's" + ' rule are valuable for the insight they give, but both ' +
          'demand a square, non-singular matrix and cost far more arithmetic as the size grows.',
      ]),
    ];
  }

  ML.registerView({
    id: 'equations',
    title: 'Linear Equations',
    tagline: 'Solve Ax = b, and see which of the three possible outcomes you have — and why.',
    icon: '=',
    build: buildView,
  });
})((globalThis.ML = globalThis.ML || {}));
