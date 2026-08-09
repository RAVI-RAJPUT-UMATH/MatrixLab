/**
 * MatrixLab — vector operations.
 *
 * Vectors are column matrices, so everything here composes with the rest of the
 * library. Results stay exact wherever they can: dot products, cross products,
 * projections and linear combinations are all rational. Lengths and angles
 * involve square roots and inverse cosines, so those report an exact value when
 * one exists and a clearly-labelled decimal otherwise.
 */
(function (ML) {
  'use strict';

  const Matrix = ML.Matrix;
  const Frac = ML.Frac;
  const MLError = ML.MLError;
  const fmt = function (v) { return ML.fmt(v); };
  const sub = function (n) { return ML.operations.subscript(n); };

  /* ------------------------------------------------------------------ *
   * Conversion helpers
   * ------------------------------------------------------------------ */

  /** Accept a column vector, a row vector or a plain array. @returns {ML.Frac[]} */
  function asVector(input, name) {
    if (Array.isArray(input)) return input.map(Frac.of);
    if (!Matrix.isMatrix(input)) throw new MLError('Expected a vector for ' + (name || 'v') + '.');
    if (input.cols === 1) return input.colAt(0);
    if (input.rows === 1) return input.rowAt(0);
    throw new MLError(
      (name || 'This value') + ' must be a single row or column of numbers, but it is ' + input.size() + '.'
    );
  }

  function toColumn(values) {
    return Matrix.column(values);
  }

  function requireSameLength(u, v, what) {
    if (u.length !== v.length) {
      throw new MLError(
        (what || 'This operation') + ' needs both vectors to have the same number of components. ' +
          'One has ' + u.length + ' and the other has ' + v.length + '.'
      );
    }
  }

  /** "(1, −2, 3)" */
  function vectorText(values) {
    return '(' + values.map(fmt).join(', ') + ')';
  }

  /* ------------------------------------------------------------------ *
   * Arithmetic
   * ------------------------------------------------------------------ */

  function vectorAdd(a, b, steps) {
    const u = asVector(a, 'u');
    const v = asVector(b, 'v');
    requireSameLength(u, v, 'Vector addition');
    const sum = u.map(function (value, i) { return value.add(v[i]); });
    if (steps) {
      steps.add('Add matching components', {
        text:
          'Vectors add component by component. Geometrically this is the parallelogram rule: place v at the tip of u, ' +
          'and the sum runs from the start of u to the tip of v.',
        list: u.map(function (value, i) {
          return 'component ' + (i + 1) + ': ' + fmt(value) + ' + ' + fmt(v[i]) + ' = ' + fmt(sum[i]);
        }),
      });
      steps.result('Result', { matrix: toColumn(sum), label: 'u + v' });
    }
    return toColumn(sum);
  }

  function vectorSubtract(a, b, steps) {
    const u = asVector(a, 'u');
    const v = asVector(b, 'v');
    requireSameLength(u, v, 'Vector subtraction');
    const difference = u.map(function (value, i) { return value.sub(v[i]); });
    if (steps) {
      steps.add('Subtract matching components', {
        text:
          'u − v is the vector that points from the tip of v to the tip of u. Its length is the distance between the ' +
          'two points.',
        list: u.map(function (value, i) {
          return 'component ' + (i + 1) + ': ' + fmt(value) + ' − ' + fmt(v[i]) + ' = ' + fmt(difference[i]);
        }),
      });
      steps.result('Result', { matrix: toColumn(difference), label: 'u − v' });
    }
    return toColumn(difference);
  }

  function vectorScale(a, k, steps) {
    const u = asVector(a, 'u');
    const scalar = Frac.of(k);
    const scaled = u.map(function (value) { return value.mul(scalar); });
    if (steps) {
      steps.add('Scale every component', {
        text:
          scalar.isZero()
            ? 'Multiplying by 0 collapses the vector to the origin.'
            : 'Multiplying by ' + fmt(scalar) + ' changes the length by a factor of ' + fmt(scalar.abs()) +
              (scalar.isNegative() ? ' and reverses the direction.' : ' while keeping the direction.'),
        math: 'k·u = (' + u.map(function (value) { return fmt(scalar) + '·' + fmt(value); }).join(', ') + ')',
      });
      steps.result('Result', { matrix: toColumn(scaled), label: fmt(scalar) + 'u' });
    }
    return toColumn(scaled);
  }

  /* ------------------------------------------------------------------ *
   * Products
   * ------------------------------------------------------------------ */

  /** u · v — exact. */
  function dotProduct(a, b, steps) {
    const u = asVector(a, 'u');
    const v = asVector(b, 'v');
    requireSameLength(u, v, 'The dot product');
    let total = Frac.ZERO;
    const terms = [];
    u.forEach(function (value, i) {
      total = total.add(value.mul(v[i]));
      terms.push('(' + fmt(value) + ')(' + fmt(v[i]) + ')');
    });
    if (steps) {
      steps.add('Multiply matching components and add', {
        text:
          'The dot product turns two vectors into a single number. It is the bridge between algebra and geometry: ' +
          'u·v = ‖u‖‖v‖cos θ, so its sign tells you whether the vectors point broadly the same way, and it is zero ' +
          'exactly when they are perpendicular.',
        math: 'u · v = ' + terms.join(' + ') + ' = ' + fmt(total),
      });
      steps.result('Result', {
        math: 'u · v = ' + fmt(total),
        text: total.isZero()
          ? 'Zero, so u and v are perpendicular.'
          : total.isPositive()
          ? 'Positive, so the angle between them is less than 90°.'
          : 'Negative, so the angle between them is more than 90°.',
      });
    }
    return total;
  }

  /** u × v — three dimensions only. Exact. */
  function crossProduct(a, b, steps) {
    const u = asVector(a, 'u');
    const v = asVector(b, 'v');
    if (u.length !== 3 || v.length !== 3) {
      throw new MLError(
        'The cross product is only defined in three dimensions. ' +
          'Here u has ' + u.length + ' component' + (u.length === 1 ? '' : 's') + ' and v has ' + v.length + '.',
        { hint: 'In two dimensions the closest analogue is the single number u₁v₂ − u₂v₁, the signed area.' }
      );
    }
    const result = [
      u[1].mul(v[2]).sub(u[2].mul(v[1])),
      u[2].mul(v[0]).sub(u[0].mul(v[2])),
      u[0].mul(v[1]).sub(u[1].mul(v[0])),
    ];
    if (steps) {
      steps.add('The determinant pattern', {
        text:
          'The cross product produces a vector perpendicular to both inputs. Each component is a 2×2 determinant of ' +
          'the other two coordinates, with the middle one negated.',
        math:
          'u × v = (u₂v₃ − u₃v₂,  u₃v₁ − u₁v₃,  u₁v₂ − u₂v₁)',
      });
      steps.add('Substitute', {
        list: [
          'first:  (' + fmt(u[1]) + ')(' + fmt(v[2]) + ') − (' + fmt(u[2]) + ')(' + fmt(v[1]) + ') = ' + fmt(result[0]),
          'second: (' + fmt(u[2]) + ')(' + fmt(v[0]) + ') − (' + fmt(u[0]) + ')(' + fmt(v[2]) + ') = ' + fmt(result[1]),
          'third:  (' + fmt(u[0]) + ')(' + fmt(v[1]) + ') − (' + fmt(u[1]) + ')(' + fmt(v[0]) + ') = ' + fmt(result[2]),
        ],
      });
      const zero = result.every(function (value) { return value.isZero(); });
      steps.result('Result', {
        matrix: toColumn(result),
        label: 'u × v',
        text: zero
          ? 'The result is the zero vector, which means u and v are parallel — they span no area, so there is no ' +
            'unique perpendicular direction.'
          : 'This vector is perpendicular to both u and v, and its length equals the area of the parallelogram they ' +
            'span.',
      });
      if (!zero) {
        steps.add('Check perpendicularity', {
          math:
            '(u × v) · u = ' + fmt(dotProduct(toColumn(result), toColumn(u))) +
            '     (u × v) · v = ' + fmt(dotProduct(toColumn(result), toColumn(v))),
          text: 'Both dot products are zero, confirming the result is perpendicular to each input.',
        });
      }
    }
    return toColumn(result);
  }

  /** u · (v × w) — the signed volume of the parallelepiped. */
  function tripleProduct(a, b, c) {
    const u = asVector(a, 'u');
    const v = asVector(b, 'v');
    const w = asVector(c, 'w');
    if (u.length !== 3 || v.length !== 3 || w.length !== 3) {
      throw new MLError('The scalar triple product needs three vectors in three dimensions.');
    }
    return ML.determinant(Matrix.from([u, v, w]));
  }

  /* ------------------------------------------------------------------ *
   * Length, distance, angle
   * ------------------------------------------------------------------ */

  /**
   * ‖v‖. The squared length is exact; the length itself is exact when it is
   * rational and numeric otherwise.
   * @returns {{squared: ML.Frac, exact: ML.Frac|null, value: number, text: string}}
   */
  function vectorNorm(a, steps) {
    const v = asVector(a, 'v');
    let squared = Frac.ZERO;
    v.forEach(function (value) { squared = squared.add(value.mul(value)); });
    const exact = squared.sqrtExact();
    const value = exact ? exact.toNumber() : Math.sqrt(squared.toNumber());
    const radical = exact ? null : ML.simplifyRadical(squared.n * squared.d);
    const text = exact
      ? fmt(exact)
      : radical && radical.inside !== 1n
      ? (new Frac(radical.outside, squared.d).eq(Frac.ONE) ? '' : fmt(new Frac(radical.outside, squared.d))) +
        '√' + radical.inside.toString()
      : ML.fmtFixed(value, ML.config.decimals);

    if (steps) {
      steps.add('Pythagoras in n dimensions', {
        text:
          'The length of a vector is the square root of the sum of the squares of its components — Pythagoras’ theorem, ' +
          'applied one coordinate at a time.',
        math:
          '‖v‖² = ' + v.map(function (value) { return '(' + fmt(value) + ')²'; }).join(' + ') + ' = ' + fmt(squared),
      });
      steps.result('Result', {
        math: '‖v‖ = √' + fmt(squared) + ' = ' + text + (exact ? '' : ' ≈ ' + ML.fmtFixed(value, ML.config.decimals)),
        text: exact
          ? 'The square root came out rational, so this length is exact.'
          : 'The square root is irrational, so it is shown in surd form with a decimal approximation.',
      });
    }
    return { squared: squared, exact: exact, value: value, text: text };
  }

  /** Distance between two points: ‖u − v‖. */
  function vectorDistance(a, b, steps) {
    const difference = vectorSubtract(a, b, steps ? new ML.StepLog() : null);
    const result = vectorNorm(difference, steps);
    if (steps) {
      steps.add('Why this is the distance', {
        text:
          'Subtracting gives the vector joining the two points, and the length of that vector is the distance ' +
          'between them.',
        matrix: difference,
        label: 'u − v',
      });
    }
    return result;
  }

  /**
   * v / ‖v‖ — the unit vector. Exact when the length is rational, otherwise
   * a labelled decimal approximation.
   */
  function normalizeVector(a, steps) {
    const v = asVector(a, 'v');
    const norm = vectorNorm(a);
    if (norm.squared.isZero()) {
      throw new MLError(
        'The zero vector has no direction, so it cannot be normalised — dividing by its length would mean dividing ' +
          'by zero.'
      );
    }
    if (norm.exact) {
      const unit = v.map(function (value) { return value.div(norm.exact); });
      if (steps) {
        steps.add('Divide by the length', {
          text: 'The length is ' + fmt(norm.exact) + ', which is rational, so the unit vector is exact.',
          matrix: toColumn(unit),
          label: 'v̂',
        });
      }
      return { vector: toColumn(unit), exact: true, norm: norm };
    }
    const unit = v.map(function (value) { return ML.cleanFloat(value.toNumber() / norm.value); });
    if (steps) {
      steps.add('Divide by the length', {
        text:
          'The length is ' + norm.text + ' ≈ ' + ML.fmtFixed(norm.value, ML.config.decimals) + ', which is irrational, ' +
          'so the unit vector is shown as decimals. Its exact form is (1/' + norm.text + ')·' + vectorText(v) + '.',
        matrix: Matrix.column(unit),
        label: 'v̂',
      });
    }
    return { vector: Matrix.column(unit), exact: false, norm: norm };
  }

  /**
   * The angle between two vectors.
   * @returns {{cosine: ML.Frac|null, cosineValue: number, radians: number, degrees: number,
   *            perpendicular: boolean, parallel: boolean, text: string}}
   */
  function vectorAngle(a, b, steps) {
    const u = asVector(a, 'u');
    const v = asVector(b, 'v');
    requireSameLength(u, v, 'The angle between two vectors');
    const dot = dotProduct(a, b);
    const normU = vectorNorm(a);
    const normV = vectorNorm(b);
    if (normU.squared.isZero() || normV.squared.isZero()) {
      throw new MLError('The angle is undefined when one of the vectors is the zero vector.');
    }

    // cos θ = (u·v)/(‖u‖‖v‖); the product of lengths is exact when ‖u‖²‖v‖² is a perfect square.
    const productSquared = normU.squared.mul(normV.squared);
    const exactProduct = productSquared.sqrtExact();
    const exactCosine = exactProduct ? dot.div(exactProduct) : null;
    const cosineValue = ML.cleanFloat(dot.toNumber() / (normU.value * normV.value));
    const clamped = Math.max(-1, Math.min(1, cosineValue));
    const radians = Math.acos(clamped);
    const degrees = (radians * 180) / Math.PI;

    if (steps) {
      steps.add('The formula', {
        text:
          'Rearranging u·v = ‖u‖‖v‖cos θ gives the angle. The dot product and both lengths are all computed first.',
        math: 'cos θ = (u · v) / (‖u‖ · ‖v‖)',
      });
      steps.add('Substitute', {
        math:
          'cos θ = ' + fmt(dot) + ' / (' + normU.text + ' · ' + normV.text + ') = ' +
          (exactCosine ? fmt(exactCosine) : ML.fmtFixed(cosineValue, 6)),
      });
      steps.result('Result', {
        math: 'θ = ' + ML.fmtFixed(degrees, 4) + '°  (' + ML.fmtFixed(radians, 6) + ' rad)',
        text: dot.isZero()
          ? 'The dot product is exactly zero, so the vectors are perpendicular — the angle is exactly 90°.'
          : 'Angles are generally irrational, so this value is a decimal approximation even though cos θ may be exact.',
      });
    }

    return {
      cosine: exactCosine,
      cosineValue: cosineValue,
      radians: radians,
      degrees: degrees,
      perpendicular: dot.isZero(),
      parallel: Math.abs(Math.abs(clamped) - 1) < 1e-12,
      dot: dot,
      normU: normU,
      normV: normV,
      text: ML.fmtFixed(degrees, 2) + '°',
    };
  }

  /* ------------------------------------------------------------------ *
   * Projection
   * ------------------------------------------------------------------ */

  /**
   * The projection of u onto v — exact, because it is a rational multiple of v.
   * @returns {{projection: ML.Matrix, rejection: ML.Matrix, coefficient: ML.Frac,
   *            scalarProjection: object}}
   */
  function projection(a, b, steps) {
    const u = asVector(a, 'u');
    const v = asVector(b, 'v');
    requireSameLength(u, v, 'Projection');
    const vv = dotProduct(b, b);
    if (vv.isZero()) {
      throw new MLError('Cannot project onto the zero vector: it defines no direction.');
    }
    const uv = dotProduct(a, b);
    const coefficient = uv.div(vv);
    const projected = v.map(function (value) { return value.mul(coefficient); });
    const rejection = u.map(function (value, i) { return value.sub(projected[i]); });

    // The signed length of the projection: (u·v)/‖v‖, generally irrational.
    const normV = vectorNorm(b);
    const scalar = { value: uv.toNumber() / normV.value, exact: normV.exact ? uv.div(normV.exact) : null };

    if (steps) {
      steps.add('What projection means', {
        text:
          'The projection of u onto v is the part of u that lies along v — the shadow u casts on the line through v. ' +
          'What is left over, u minus the projection, is perpendicular to v.',
        math: 'proj_v(u) = ((u · v) / (v · v)) · v',
      });
      steps.add('Compute the coefficient', {
        math:
          '(u · v) / (v · v) = ' + fmt(uv) + ' / ' + fmt(vv) + ' = ' + fmt(coefficient),
        text: 'This is a ratio of two exact dot products, so the projection stays exact.',
      });
      steps.add('Scale v by that coefficient', { matrix: toColumn(projected), label: 'proj_v(u)' });
      steps.add('The leftover part', {
        matrix: toColumn(rejection),
        label: 'u − proj_v(u)',
        math: '(u − proj_v(u)) · v = ' + fmt(dotProduct(toColumn(rejection), b)),
        text:
          'Its dot product with v is exactly zero, confirming that u has been split into a piece along v and a piece ' +
          'perpendicular to v.',
      });
    }

    return {
      projection: toColumn(projected),
      rejection: toColumn(rejection),
      coefficient: coefficient,
      scalarProjection: scalar,
      dot: uv,
    };
  }

  /* ------------------------------------------------------------------ *
   * Combinations and independence
   * ------------------------------------------------------------------ */

  /** c₁v₁ + c₂v₂ + … */
  function linearCombination(vectors, coefficients, steps) {
    if (!vectors.length) throw new MLError('Provide at least one vector.');
    if (vectors.length !== coefficients.length) {
      throw new MLError('There must be exactly one coefficient for each vector.');
    }
    const lists = vectors.map(function (v, i) { return asVector(v, 'v' + (i + 1)); });
    const length = lists[0].length;
    lists.forEach(function (list, i) {
      if (list.length !== length) {
        throw new MLError('All vectors must have the same number of components (vector ' + (i + 1) + ' differs).');
      }
    });
    const result = new Array(length).fill(Frac.ZERO);
    lists.forEach(function (list, k) {
      const c = Frac.of(coefficients[k]);
      for (let i = 0; i < length; i++) result[i] = result[i].add(c.mul(list[i]));
    });
    if (steps) {
      steps.add('Scale and add', {
        text:
          'A linear combination scales each vector and adds the results. Every vector reachable this way lies in the ' +
          'span of the originals.',
        math:
          lists
            .map(function (list, k) { return fmt(Frac.of(coefficients[k])) + '·v' + sub(k + 1); })
            .join(' + ') + ' = ' + vectorText(result),
      });
      steps.result('Result', { matrix: toColumn(result) });
    }
    return toColumn(result);
  }

  /**
   * Are these vectors independent? Uses the exact rank of the matrix whose
   * columns they are, and reports an explicit dependency when they are not.
   */
  function areLinearlyIndependent(vectors, steps) {
    const lists = vectors.map(function (v, i) { return asVector(v, 'v' + (i + 1)); });
    return ML.linearIndependence(lists, steps);
  }

  const api = {
    asVector: asVector,
    vectorText: vectorText,
    vectorAdd: vectorAdd,
    vectorSubtract: vectorSubtract,
    vectorScale: vectorScale,
    dotProduct: dotProduct,
    crossProduct: crossProduct,
    tripleProduct: tripleProduct,
    vectorNorm: vectorNorm,
    vectorDistance: vectorDistance,
    normalizeVector: normalizeVector,
    vectorAngle: vectorAngle,
    projection: projection,
    linearCombination: linearCombination,
    areLinearlyIndependent: areLinearlyIndependent,
  };

  ML.vectors = api;
  Object.assign(ML, api);
})((globalThis.ML = globalThis.ML || {}));
