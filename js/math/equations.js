/**
 * MatrixLab — systems of linear equations.
 *
 * Solves Ax = b and, just as importantly, says which of the three possible
 * outcomes occurred and why: exactly one solution, none at all, or infinitely
 * many. The verdict follows the Rouché–Capelli comparison of rank(A) with
 * rank([A|b]), computed exactly, so "no solution" is a fact rather than a
 * numerical guess.
 */
(function (ML) {
  'use strict';

  const Matrix = ML.Matrix;
  const Frac = ML.Frac;
  const MLError = ML.MLError;
  const fmt = function (v) { return ML.fmt(v); };
  const sub = function (n) { return ML.operations.subscript(n); };

  const DEFAULT_NAMES = ['x', 'y', 'z', 'w', 'v', 'u', 't', 's'];

  /** Sensible variable names for n unknowns: x, y, z, w … then x₅, x₆ … */
  function variableNames(n) {
    if (n <= DEFAULT_NAMES.length) return DEFAULT_NAMES.slice(0, n);
    const names = [];
    for (let i = 0; i < n; i++) names.push('x' + sub(i + 1));
    return names;
  }

  function checkSystem(A, b) {
    ML.operations.requireMatrix(A, 'A');
    ML.operations.requireMatrix(b, 'b');
    if (b.cols !== 1) {
      throw new MLError('The right-hand side b must be a single column of numbers, one per equation.');
    }
    if (A.rows !== b.rows) {
      throw new MLError(
        'The system has ' + A.rows + ' equation' + (A.rows === 1 ? '' : 's') + ' but b has ' + b.rows +
          ' entr' + (b.rows === 1 ? 'y' : 'ies') + '. They must match.'
      );
    }
  }

  /* ------------------------------------------------------------------ *
   * Main solver — Gauss–Jordan on the augmented matrix
   * ------------------------------------------------------------------ */

  /**
   * Solve Ax = b.
   *
   * @param {ML.Matrix} A
   * @param {ML.Matrix} b column vector
   * @param {ML.StepLog} [steps]
   * @param {object} [options] {names: string[]}
   * @returns {object} see the `result` object below
   */
  function solveLinearSystem(A, b, steps, options) {
    checkSystem(A, b);
    const opts = options || {};
    const n = A.cols;
    const names = opts.names || variableNames(n);
    const augmented = ML.augment(A, b);

    if (steps) {
      steps.add('Step 1 — write the augmented matrix', {
        text:
          'Each row is one equation; the columns hold the coefficients of ' + names.join(', ') +
          ', and the last column (after the divider) holds the right-hand side. Everything that follows is bookkeeping ' +
          'on this array.',
        matrix: augmented,
        label: '[A | b]',
        augmentAt: n,
      });
      steps.add('Step 2 — the equations being solved', { list: equationLines(A, b, names) });
    }

    const record = ML.eliminate(augmented, {
      full: true,
      steps: steps,
      label: '[A | b]',
      augmentAt: n,
      pivotColumns: n,
    });

    const reduced = record.matrix;
    const rankA = record.rank;
    const pivotColumns = record.pivots.map(function (p) { return p[1]; });
    const freeColumns = [];
    for (let j = 0; j < n; j++) if (pivotColumns.indexOf(j) < 0) freeColumns.push(j);

    // Inconsistency shows up as a row of zeros with a non-zero right-hand side.
    let badRow = -1;
    for (let i = 0; i < reduced.rows; i++) {
      let allZero = true;
      for (let j = 0; j < n; j++) {
        if (!reduced.get(i, j).isZero()) {
          allZero = false;
          break;
        }
      }
      if (allZero && !reduced.get(i, n).isZero()) {
        badRow = i;
        break;
      }
    }

    const result = {
      A: A,
      b: b,
      names: names,
      augmented: augmented,
      rref: reduced,
      rank: rankA,
      rankAugmented: badRow >= 0 ? rankA + 1 : rankA,
      variables: n,
      equations: A.rows,
      pivotColumns: pivotColumns,
      freeColumns: freeColumns,
      type: 'unique',
      solution: null,
      particular: null,
      nullBasis: [],
      summary: '',
      parametric: null,
    };

    if (badRow >= 0) {
      result.type = 'none';
      result.summary =
        'No solution. Row ' + (badRow + 1) + ' of the reduced matrix reads 0 = ' + fmt(reduced.get(badRow, n)) +
        ', which is impossible — the equations contradict each other.';
      if (steps) {
        steps.result('Verdict — no solution', {
          text: result.summary,
          math: '0·' + names.join(' + 0·') + ' = ' + fmt(reduced.get(badRow, n)),
          matrix: reduced,
          label: 'rref[A | b]',
          augmentAt: n,
          highlight: { rows: [badRow] },
          kind: 'warn',
        });
        steps.add('Why this happens', {
          text:
            'rank(A) = ' + rankA + ' but rank([A|b]) = ' + result.rankAugmented + '. Adding b to the picture raised ' +
            'the rank, meaning b lies outside the column space of A — no combination of the columns can reach it.',
        });
      }
      return result;
    }

    if (rankA === n) {
      const values = new Array(n);
      record.pivots.forEach(function (pivot) {
        values[pivot[1]] = reduced.get(pivot[0], n);
      });
      result.solution = Matrix.column(values);
      result.summary =
        'Exactly one solution: ' + names.map(function (name, i) { return name + ' = ' + fmt(values[i]); }).join(', ') + '.';

      if (steps) {
        steps.result('Verdict — exactly one solution', {
          text:
            'Every variable has a pivot, so nothing is left free. With the left block reduced to the identity, each ' +
            'row now reads off one variable directly.',
          matrix: reduced,
          label: 'rref[A | b]',
          augmentAt: n,
          highlight: { pivots: record.pivots },
        });
        steps.add('Read off the answer', {
          list: names.map(function (name, i) { return name + ' = ' + fmt(values[i]); }),
        });
        const check = ML.multiplyMatrices(A, result.solution);
        steps.add('Check by substitution', {
          text:
            check.equals(b)
              ? 'Substituting back gives exactly b, so the solution is confirmed.'
              : 'Substitution did not reproduce b — the result is not trustworthy.',
          matrices: [{ matrix: check, label: 'A·x' }, { matrix: b, label: 'b' }],
        });
      }
      return result;
    }

    // Under-determined: a particular solution plus the null-space directions.
    result.type = 'infinite';
    const particularValues = new Array(n).fill(Frac.ZERO);
    record.pivots.forEach(function (pivot) {
      particularValues[pivot[1]] = reduced.get(pivot[0], n);
    });
    result.particular = Matrix.column(particularValues);

    result.nullBasis = freeColumns.map(function (freeCol) {
      const values = new Array(n).fill(Frac.ZERO);
      values[freeCol] = Frac.ONE;
      record.pivots.forEach(function (pivot) {
        values[pivot[1]] = reduced.get(pivot[0], freeCol).neg();
      });
      return Matrix.column(values);
    });

    const parameterNames = freeColumns.map(function (_, i) { return 't' + sub(i + 1); });
    result.parametric = {
      parameters: parameterNames,
      freeNames: freeColumns.map(function (c) { return names[c]; }),
      lines: names.map(function (name, i) {
        const pieces = [fmt(particularValues[i])];
        result.nullBasis.forEach(function (vector, k) {
          const coefficient = vector.get(i, 0);
          if (coefficient.isZero()) return;
          const magnitude = coefficient.abs();
          pieces.push(
            (coefficient.isNegative() ? '− ' : '+ ') + (magnitude.isOne() ? '' : fmt(magnitude)) + parameterNames[k]
          );
        });
        let text = pieces.join(' ');
        if (pieces.length > 1 && particularValues[i].isZero()) {
          // Drop a leading "0 + " for readability.
          text = pieces.slice(1).join(' ').replace(/^\+\s*/, '');
        }
        return name + ' = ' + text;
      }),
    };

    result.summary =
      'Infinitely many solutions. There are ' + n + ' variables but only ' + rankA + ' pivot' +
      (rankA === 1 ? '' : 's') + ', leaving ' + freeColumns.length + ' free variable' +
      (freeColumns.length === 1 ? '' : 's') + ' (' + result.parametric.freeNames.join(', ') + ').';

    if (steps) {
      steps.result('Verdict — infinitely many solutions', {
        text: result.summary,
        matrix: reduced,
        label: 'rref[A | b]',
        augmentAt: n,
        highlight: { pivots: record.pivots, cols: freeColumns },
      });
      steps.add('Choose the free variables', {
        text:
          'Columns without a pivot (' + result.parametric.freeNames.join(', ') + ') can take any value. Give each one ' +
          'a parameter; the pivot variables are then forced by the remaining equations.',
      });
      steps.add('One particular solution', {
        text: 'Setting every free variable to 0 gives a single solution that satisfies the system.',
        matrix: result.particular,
        label: 'xₚ',
      });
      steps.add('The directions you can move in', {
        text:
          'Each free variable, set to 1 with the others at 0, gives a direction that solves Ax = 0. Adding any ' +
          'combination of these to xₚ still solves Ax = b.',
        matrices: result.nullBasis.map(function (vector, k) {
          return { matrix: vector, label: parameterNames[k] + ' direction' };
        }),
      });
      steps.add('General solution', { list: result.parametric.lines });
    }

    return result;
  }

  /** Readable form of the original equations. */
  function equationLines(A, b, names) {
    const lines = [];
    for (let i = 0; i < A.rows; i++) {
      const terms = [];
      for (let j = 0; j < A.cols; j++) {
        const coefficient = A.get(i, j);
        if (coefficient.isZero()) continue;
        const magnitude = coefficient.abs();
        const body = (magnitude.isOne() ? '' : fmt(magnitude)) + names[j];
        if (!terms.length) terms.push((coefficient.isNegative() ? '−' : '') + body);
        else terms.push((coefficient.isNegative() ? '− ' : '+ ') + body);
      }
      lines.push((terms.length ? terms.join(' ') : '0') + ' = ' + fmt(b.get(i, 0)));
    }
    return lines;
  }

  /* ------------------------------------------------------------------ *
   * Alternative methods
   * ------------------------------------------------------------------ */

  /** Forward elimination to REF, then back-substitution. */
  function solveByBackSubstitution(A, b, steps) {
    checkSystem(A, b);
    if (!A.isSquare()) {
      throw new MLError(
        'Back-substitution as shown here needs a square system (as many equations as unknowns). ' +
          'Use Gauss–Jordan for a ' + A.size() + ' system — it handles any shape.'
      );
    }
    const n = A.cols;
    const augmented = ML.augment(A, b);
    const record = ML.eliminate(augmented, {
      full: false,
      normalize: false,
      steps: steps,
      label: '[A | b]',
      augmentAt: n,
      pivotColumns: n,
    });
    if (record.rank < n) {
      throw new MLError(
        'This system does not have a unique solution, so back-substitution cannot finish. ' +
          'Use the Gauss–Jordan method, which reports the full solution set.'
      );
    }

    const U = record.matrix;
    const x = new Array(n);
    const lines = [];
    for (let i = n - 1; i >= 0; i--) {
      let sum = U.get(i, n);
      const subtracted = [];
      for (let j = i + 1; j < n; j++) {
        if (U.get(i, j).isZero()) continue;
        sum = sum.sub(U.get(i, j).mul(x[j]));
        subtracted.push(fmt(U.get(i, j)) + '·' + fmt(x[j]));
      }
      x[i] = sum.div(U.get(i, i));
      lines.push(
        'Row ' + (i + 1) + ':  ' + fmt(U.get(i, i)) + '·x' + sub(i + 1) +
          (subtracted.length ? ' = ' + fmt(U.get(i, n)) + ' − (' + subtracted.join(' + ') + ')' : ' = ' + fmt(U.get(i, n))) +
          '  →  x' + sub(i + 1) + ' = ' + fmt(x[i])
      );
    }
    const solution = Matrix.column(x);
    if (steps) {
      steps.add('Back-substitution', {
        text:
          'The echelon form is triangular, so the last equation involves only the last unknown. Solve it, substitute ' +
          'upwards, and each earlier equation then has just one unknown left.',
        list: lines.reverse(),
      });
      steps.result('Solution', { matrix: solution, label: 'x' });
    }
    return solution;
  }

  /** x = A⁻¹b. Correct, but the most work of the three. */
  function solveByInverse(A, b, steps) {
    checkSystem(A, b);
    if (!A.isSquare()) {
      throw new MLError('The inverse method needs a square coefficient matrix. This one is ' + A.size() + '.');
    }
    const det = ML.determinant(A);
    if (steps) {
      steps.add('Step 1 — check invertibility', {
        text: 'Multiplying both sides of Ax = b by A⁻¹ gives x = A⁻¹b, but only if A⁻¹ exists.',
        math: 'det(A) = ' + fmt(det),
      });
    }
    if (det.isZero()) {
      throw new MLError(
        'A is singular (det(A) = 0), so A⁻¹ does not exist and this method cannot be used. ' +
          'Gauss–Jordan still works: it will tell you whether there are no solutions or infinitely many.'
      );
    }
    const inverse = ML.inverseMatrix(A, steps);
    const solution = ML.multiplyMatrices(inverse, b, steps);
    if (steps) {
      steps.result('Solution', {
        matrix: solution,
        label: 'x = A⁻¹b',
        text:
          'This works, but forming A⁻¹ costs more arithmetic than elimination and is more sensitive to rounding in ' +
          'floating-point software. Elimination is the standard choice in practice.',
      });
    }
    return solution;
  }

  /**
   * Cramer's rule: xᵢ = det(Aᵢ)/det(A), where Aᵢ is A with column i replaced
   * by b. Elegant for small systems, hopeless for large ones.
   */
  function solveByCramer(A, b, steps) {
    checkSystem(A, b);
    if (!A.isSquare()) {
      throw new MLError("Cramer's rule needs a square system. This one is " + A.size() + '.');
    }
    if (A.rows > 5) {
      throw new MLError(
        "Cramer's rule would need " + (A.rows + 1) + ' determinants of ' + A.size() +
          ' matrices. It is offered up to 5×5; beyond that use elimination.'
      );
    }
    const n = A.rows;
    const names = variableNames(n);
    const det = ML.determinant(A);
    if (steps) {
      steps.add('Step 1 — the determinant of A', {
        text:
          "Cramer's rule expresses each unknown as a ratio of determinants. If det(A) = 0 the rule does not apply, " +
          'so it is checked first.',
        math: 'det(A) = ' + fmt(det),
        matrix: A,
        label: 'A =',
      });
    }
    if (det.isZero()) {
      throw new MLError(
        "Cramer's rule needs det(A) ≠ 0, but det(A) = 0 here. Use Gauss–Jordan, which also identifies whether the " +
          'system is inconsistent or has infinitely many solutions.'
      );
    }

    const values = [];
    for (let i = 0; i < n; i++) {
      const data = A.toArray();
      for (let r = 0; r < n; r++) data[r][i] = b.get(r, 0);
      const replaced = Matrix.fromGrid(data);
      const detI = ML.determinant(replaced);
      values.push(detI.div(det));
      if (steps) {
        steps.add('Step 2.' + (i + 1) + ' — replace column ' + (i + 1) + ' with b', {
          text: 'Column ' + (i + 1) + ' of A is swapped for b; its determinant divided by det(A) gives ' + names[i] + '.',
          matrix: replaced,
          label: 'A' + sub(i + 1),
          highlight: { cols: [i] },
          math:
            names[i] + ' = det(A' + sub(i + 1) + ') / det(A) = ' + fmt(detI) + ' / ' + fmt(det) + ' = ' +
            fmt(values[i]),
        });
      }
    }
    const solution = Matrix.column(values);
    if (steps) {
      steps.result('Solution', {
        matrix: solution,
        label: 'x',
        text:
          'The rule is exact and pleasingly explicit, but it needs n + 1 determinants — for a 10×10 system that is ' +
          'astronomically more work than elimination.',
      });
    }
    return solution;
  }

  /* ------------------------------------------------------------------ *
   * Reading equations written as text
   * ------------------------------------------------------------------ */

  /**
   * Parse a system typed in ordinary notation:
   *   2x + 3y = 5
   *   x - y = 1
   * @returns {{A: ML.Matrix, b: ML.Matrix, names: string[]}}
   */
  function parseSystem(text) {
    const lines = String(text)
      .split(/[\n;]+/)
      .map(function (line) { return line.trim(); })
      .filter(function (line) { return line.length > 0; });
    if (!lines.length) throw new MLError('Type at least one equation, for example 2x + 3y = 5.');

    const names = [];
    const parsed = lines.map(function (line, index) {
      const sides = line.split('=');
      if (sides.length !== 2) {
        throw new MLError(
          'Equation ' + (index + 1) + ' (“' + line + '”) needs exactly one “=” sign.'
        );
      }
      const left = parseSide(sides[0], line, index);
      const right = parseSide(sides[1], line, index);
      Object.keys(left.terms).concat(Object.keys(right.terms)).forEach(function (name) {
        if (names.indexOf(name) < 0) names.push(name);
      });
      return { left: left, right: right };
    });

    if (!names.length) {
      throw new MLError('No variables were found. Write equations such as 2x + 3y = 5.');
    }
    if (names.length > ML.MAX_DIM) {
      throw new MLError('MatrixLab handles up to ' + ML.MAX_DIM + ' variables in this tool; this system has ' + names.length + '.');
    }

    const rows = parsed.map(function (equation) {
      return names.map(function (name) {
        const left = equation.left.terms[name] || Frac.ZERO;
        const right = equation.right.terms[name] || Frac.ZERO;
        return left.sub(right);
      });
    });
    const constants = parsed.map(function (equation) {
      return [equation.right.constant.sub(equation.left.constant)];
    });

    return { A: Matrix.from(rows), b: Matrix.from(constants), names: names };
  }

  /** One side of an equation → coefficients per variable plus a constant. */
  function parseSide(text, line, index) {
    const cleaned = String(text).replace(/[−–—]/g, '-').replace(/\s+/g, '');
    const terms = {};
    const result = { terms: terms, constant: Frac.ZERO };
    if (!cleaned) return result;

    const tokens = cleaned.match(/[+-]?[^+-]+/g) || [];
    tokens.forEach(function (token) {
      let sign = Frac.ONE;
      let body = token;
      if (body[0] === '+') body = body.slice(1);
      else if (body[0] === '-') {
        sign = Frac.MINUS_ONE;
        body = body.slice(1);
      }
      if (!body) return;

      const match = body.match(/^([0-9]*(?:\.[0-9]+)?(?:\/[0-9]+(?:\.[0-9]+)?)?)\*?([a-zA-Z][a-zA-Z0-9_]*)?$/);
      if (!match) {
        throw new MLError(
          'Could not read “' + token + '” in equation ' + (index + 1) + ' (“' + line + '”). ' +
            'Terms should look like 2x, -3.5y, x/2 is not supported — write 0.5x or 1/2x instead.'
        );
      }
      const numberText = match[1];
      const variable = match[2];
      let coefficient;
      if (numberText === '') coefficient = Frac.ONE;
      else coefficient = Frac.parse(numberText);
      coefficient = coefficient.mul(sign);

      if (variable) {
        terms[variable] = (terms[variable] || Frac.ZERO).add(coefficient);
      } else {
        result.constant = result.constant.add(coefficient);
      }
    });
    return result;
  }

  const api = {
    solveLinearSystem: solveLinearSystem,
    solveByBackSubstitution: solveByBackSubstitution,
    solveByInverse: solveByInverse,
    solveByCramer: solveByCramer,
    parseSystem: parseSystem,
    equationLines: equationLines,
    variableNames: variableNames,
  };

  ML.equations = api;
  Object.assign(ML, api);
})((globalThis.ML = globalThis.ML || {}));
