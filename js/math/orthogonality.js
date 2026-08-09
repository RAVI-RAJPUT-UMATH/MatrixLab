/**
 * MatrixLab — orthogonality: orthogonal sets, projections onto subspaces,
 * orthogonal complements and the Gram–Schmidt process.
 *
 * The orthogonal vectors Gram–Schmidt produces are exact rationals — only the
 * final normalisation to unit length needs a square root, so MatrixLab shows
 * the exact orthogonal basis and then the unit vectors separately.
 */
(function (ML) {
  'use strict';

  const Matrix = ML.Matrix;
  const Frac = ML.Frac;
  const MLError = ML.MLError;
  const fmt = function (v) { return ML.fmt(v); };
  const sub = function (n) { return ML.operations.subscript(n); };

  /* ------------------------------------------------------------------ *
   * Tests
   * ------------------------------------------------------------------ */

  /** Every pair perpendicular? Exact. */
  function isOrthogonalSet(vectors) {
    const list = vectors.map(function (v, i) { return ML.asVector(v, 'v' + (i + 1)); });
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (!dot(list[i], list[j]).isZero()) return false;
      }
    }
    return true;
  }

  /** Orthogonal and every vector of length exactly 1. */
  function isOrthonormalSet(vectors) {
    const list = vectors.map(function (v, i) { return ML.asVector(v, 'v' + (i + 1)); });
    if (!isOrthogonalSet(vectors)) return false;
    return list.every(function (v) { return dot(v, v).isOne(); });
  }

  function dot(u, v) {
    let total = Frac.ZERO;
    for (let i = 0; i < u.length; i++) total = total.add(u[i].mul(v[i]));
    return total;
  }

  /* ------------------------------------------------------------------ *
   * Gram–Schmidt
   * ------------------------------------------------------------------ */

  /**
   * Turn a list of vectors into an orthogonal (and then orthonormal) set
   * spanning the same subspace.
   *
   * @returns {{orthogonal: ML.Matrix[], orthonormal: object[], dropped: number[],
   *            dimension: number, exact: boolean}}
   */
  function gramSchmidt(vectors, steps) {
    if (!vectors || !vectors.length) throw new MLError('Provide at least one vector.');
    const input = vectors.map(function (v, i) { return ML.asVector(v, 'v' + (i + 1)); });
    const length = input[0].length;
    input.forEach(function (v, i) {
      if (v.length !== length) {
        throw new MLError('All vectors must have the same number of components (vector ' + (i + 1) + ' differs).');
      }
    });

    if (steps) {
      steps.add('The idea', {
        text:
          'Take the vectors one at a time. Keep the first as it is. For each later vector, subtract off its projection ' +
          'onto everything already accepted — what remains is perpendicular to all of them. The result spans exactly ' +
          'the same subspace, but with perpendicular directions, which makes every subsequent calculation easier.',
        math: 'uₖ = vₖ − Σᵢ₌₁..ₖ₋₁ proj_{uᵢ}(vₖ)',
      });
    }

    const orthogonal = [];
    const dropped = [];

    input.forEach(function (v, k) {
      let residual = v.slice();
      const subtracted = [];
      orthogonal.forEach(function (u, i) {
        const uu = dot(u, u);
        if (uu.isZero()) return;
        const coefficient = dot(v, u).div(uu);
        if (coefficient.isZero()) return;
        residual = residual.map(function (value, index) { return value.sub(coefficient.mul(u[index])); });
        subtracted.push(
          'minus (' + fmt(dot(v, u)) + '/' + fmt(uu) + ')·u' + sub(i + 1) + '   = ' + fmt(coefficient) + '·u' + sub(i + 1)
        );
      });

      const isZero = residual.every(function (value) { return value.isZero(); });
      if (isZero) {
        dropped.push(k);
        if (steps) {
          steps.add('v' + sub(k + 1) + ' brings nothing new', {
            text:
              'After removing its projections, nothing is left: v' + sub(k + 1) + ' already lies in the span of the ' +
              'earlier vectors, so it is dependent and is dropped. The remaining vectors still span the same subspace.',
            kind: 'warn',
          });
        }
        return;
      }

      orthogonal.push(residual);
      if (steps) {
        steps.add(
          k === 0 ? 'Step 1 — keep the first vector' : 'Step ' + (k + 1) + ' — remove the projections from v' + sub(k + 1),
          {
            text:
              k === 0
                ? 'The first vector needs no adjustment; it becomes u₁ and sets the direction everything else is ' +
                  'measured against.'
                : 'Subtract the part of v' + sub(k + 1) + ' that lies along each earlier u. What survives is ' +
                  'perpendicular to all of them.',
            list: subtracted.length ? subtracted : null,
            matrix: Matrix.column(residual),
            label: 'u' + sub(orthogonal.length),
          }
        );
      }
    });

    // Confirm orthogonality exactly — a check no floating-point version can make.
    const checks = [];
    for (let i = 0; i < orthogonal.length; i++) {
      for (let j = i + 1; j < orthogonal.length; j++) {
        checks.push({ i: i, j: j, value: dot(orthogonal[i], orthogonal[j]) });
      }
    }
    const allOrthogonal = checks.every(function (check) { return check.value.isZero(); });

    // Normalise: exact when the length is rational, otherwise decimals.
    let allExact = true;
    const orthonormal = orthogonal.map(function (u) {
      const squared = dot(u, u);
      const exact = squared.sqrtExact();
      if (exact) {
        return {
          vector: Matrix.column(u.map(function (value) { return value.div(exact); })),
          exact: true,
          normSquared: squared,
          normText: fmt(exact),
        };
      }
      allExact = false;
      const value = Math.sqrt(squared.toNumber());
      const radical = ML.simplifyRadical(squared.n * squared.d);
      const normText =
        radical.inside !== 1n
          ? (new Frac(radical.outside, squared.d).eq(Frac.ONE) ? '' : fmt(new Frac(radical.outside, squared.d))) +
            '√' + radical.inside.toString()
          : ML.fmtFixed(value, ML.config.decimals);
      return {
        vector: Matrix.column(u.map(function (entry) { return ML.cleanFloat(entry.toNumber() / value); })),
        exact: false,
        normSquared: squared,
        normText: normText,
      };
    });

    if (steps) {
      if (checks.length) {
        steps.add('Check — every pair is perpendicular', {
          list: checks.map(function (check) {
            return 'u' + sub(check.i + 1) + ' · u' + sub(check.j + 1) + ' = ' + fmt(check.value);
          }),
          text: allOrthogonal
            ? 'Every dot product is exactly zero. Because the arithmetic is exact rational, this is a proof rather than ' +
              'a numerical impression.'
            : 'Some dot product is not zero, which should be impossible — do not trust this result.',
          kind: allOrthogonal ? 'info' : 'warn',
        });
      }
      steps.result('Normalise to unit length', {
        text:
          allExact
            ? 'Dividing each vector by its length gives an orthonormal basis, and here every length is rational so the ' +
              'result is exact.'
            : 'Dividing each vector by its length gives an orthonormal basis. Some lengths are irrational, so those ' +
              'unit vectors are shown as decimals — the exact orthogonal vectors above are the ones to quote.',
        matrices: orthonormal.map(function (entry, k) {
          return { matrix: entry.vector, label: 'ê' + sub(k + 1), caption: '‖u' + sub(k + 1) + '‖ = ' + entry.normText };
        }),
      });
    }

    return {
      orthogonal: orthogonal.map(function (u) { return Matrix.column(u); }),
      orthonormal: orthonormal,
      dropped: dropped,
      dimension: orthogonal.length,
      exact: allExact,
      orthogonalityChecks: checks,
      allOrthogonal: allOrthogonal,
    };
  }

  /* ------------------------------------------------------------------ *
   * Projection onto a subspace
   * ------------------------------------------------------------------ */

  /**
   * P = A(AᵗA)⁻¹Aᵗ — the matrix that projects onto the column space of A.
   * Exact, and requires A to have independent columns.
   */
  function projectionMatrix(A, steps) {
    ML.operations.requireMatrix(A, 'A');
    const transposed = ML.transposeMatrix(A);
    const gram = ML.multiplyMatrices(transposed, A);
    if (ML.determinant(gram).isZero()) {
      throw new MLError(
        'The columns of A are dependent, so AᵗA is singular and this formula cannot be used. ' +
          'Remove the redundant columns first — Gram–Schmidt will identify them.',
        { hint: 'A basis has no redundant vectors; the projection itself still exists, only this formula fails.' }
      );
    }
    const inverse = ML.inverseMatrix(gram);
    const P = ML.multiplyMatrices(ML.multiplyMatrices(A, inverse), transposed);

    if (steps) {
      steps.add('The projection matrix', {
        text:
          'To project onto the column space of A, the answer must be a combination Ax of the columns, and the error ' +
          'b − Ax must be perpendicular to every column: Aᵗ(b − Ax) = 0. Solving that gives x = (AᵗA)⁻¹Aᵗb, so the ' +
          'projection is P b with P = A(AᵗA)⁻¹Aᵗ.',
        math: 'P = A(AᵗA)⁻¹Aᵗ',
      });
      steps.add('Build the pieces', {
        matrices: [
          { matrix: gram, label: 'AᵗA' },
          { matrix: inverse, label: '(AᵗA)⁻¹' },
          { matrix: P, label: 'P' },
        ],
      });
      const squared = ML.multiplyMatrices(P, P);
      steps.add('Check — P is a projection', {
        text:
          (squared.equals(P) ? 'P² = P exactly, as it must be: ' : 'P² ≠ P, which should be impossible: ') +
          'projecting something that is already in the subspace changes nothing. P is also symmetric.',
        matrix: squared,
        label: 'P²',
      });
    }
    return { P: P, gram: gram, gramInverse: inverse };
  }

  /** Project a vector onto the span of the given vectors. Exact. */
  function projectOntoSubspace(vectors, target, steps) {
    const columns = vectors.map(function (v, i) { return ML.asVector(v, 'v' + (i + 1)); });
    const b = ML.asVector(target, 'b');
    const A = Matrix.fromColumns(columns);
    if (A.rows !== b.length) {
      throw new MLError(
        'The vector has ' + b.length + ' components but the subspace lives in ' + A.rows + ' dimensions.'
      );
    }

    // Use an orthogonal basis: it works even when the given vectors are dependent.
    const gs = gramSchmidt(vectors);
    let projected = new Array(b.length).fill(Frac.ZERO);
    const contributions = [];
    gs.orthogonal.forEach(function (uMatrix, k) {
      const u = uMatrix.colAt(0);
      const uu = dot(u, u);
      const coefficient = dot(b, u).div(uu);
      contributions.push({ index: k, coefficient: coefficient, vector: uMatrix });
      projected = projected.map(function (value, i) { return value.add(coefficient.mul(u[i])); });
    });
    const residual = b.map(function (value, i) { return value.sub(projected[i]); });

    if (steps) {
      steps.add('Project using an orthogonal basis', {
        text:
          'With a perpendicular basis the projection is just the sum of the projections onto each direction — no ' +
          'matrix inverse needed. That is exactly why Gram–Schmidt is worth doing first.',
        math: 'proj(b) = Σₖ ((b · uₖ)/(uₖ · uₖ)) uₖ',
        list: contributions.map(function (entry) {
          return 'along u' + sub(entry.index + 1) + ':  coefficient ' + fmt(entry.coefficient);
        }),
      });
      steps.add('The projection and the error', {
        matrices: [
          { matrix: Matrix.column(projected), label: 'proj(b)' },
          { matrix: Matrix.column(residual), label: 'b − proj(b)' },
        ],
      });
      steps.result('Check — the error is perpendicular to the subspace', {
        list: gs.orthogonal.map(function (uMatrix, k) {
          return '(b − proj(b)) · u' + sub(k + 1) + ' = ' + fmt(dot(residual, uMatrix.colAt(0)));
        }),
        text:
          'All zero, which is the defining property: the projection is the closest point in the subspace precisely ' +
          'because the leftover error is perpendicular to it.',
      });
    }

    return {
      projection: Matrix.column(projected),
      residual: Matrix.column(residual),
      basis: gs.orthogonal,
      coefficients: contributions,
      dimension: gs.dimension,
    };
  }

  /**
   * The orthogonal complement of the span of the given vectors: everything
   * perpendicular to all of them. This is the null space of the matrix whose
   * rows are the vectors.
   */
  function orthogonalComplement(vectors, steps) {
    const rows = vectors.map(function (v, i) { return ML.asVector(v, 'v' + (i + 1)); });
    const A = Matrix.from(rows);
    if (steps) {
      steps.add('Set it up as a null space', {
        text:
          'A vector x is perpendicular to all the given vectors exactly when vᵢ · x = 0 for every i. Stacking the ' +
          'vectors as the rows of a matrix A, that says Ax = 0 — so the orthogonal complement is the null space of A.',
        matrix: A,
        label: 'A (vectors as rows)',
      });
    }
    const result = ML.nullSpace(A, steps);
    const spanDimension = ML.matrixRank(A);
    return {
      basis: result.basis,
      dimension: result.dimension,
      ambient: A.cols,
      spanDimension: spanDimension,
      relation:
        'dim(span) + dim(complement) = ' + spanDimension + ' + ' + result.dimension + ' = ' + A.cols +
        ', the dimension of the whole space.',
    };
  }

  const api = {
    isOrthogonalSet: isOrthogonalSet,
    isOrthonormalSet: isOrthonormalSet,
    gramSchmidt: gramSchmidt,
    projectionMatrix: projectionMatrix,
    projectOntoSubspace: projectOntoSubspace,
    orthogonalComplement: orthogonalComplement,
  };

  ML.orthogonality = api;
  Object.assign(ML, api);
})((globalThis.ML = globalThis.ML || {}));
