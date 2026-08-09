/**
 * MatrixLab — example matrix library.
 *
 * Each entry was chosen because it demonstrates something specific, and the
 * `teaches` line says what. All examples are original to MatrixLab; the small
 * integers are deliberate, so the arithmetic can be checked by hand.
 */
(function (ML) {
  'use strict';

  /**
   * @typedef {object} Example
   * @property {string} id
   * @property {string} name
   * @property {string} category
   * @property {string[][]} matrix
   * @property {string} teaches   What this example is for.
   * @property {string} [best]    The view where it is most interesting.
   */

  const EXAMPLES = [
    /* ------------------------------- basics ------------------------------ */
    {
      id: 'simple-2x2',
      name: 'A plain 2×2',
      category: 'Starting out',
      matrix: [['1', '2'], ['3', '4']],
      teaches: 'Determinant −2, so it is invertible. The inverse has fractions, which is a good first look at exact arithmetic.',
      best: 'analysis',
    },
    {
      id: 'inverse-example',
      name: 'Integer inverse',
      category: 'Starting out',
      matrix: [['2', '1'], ['5', '3']],
      teaches: 'Determinant is exactly 1, so the inverse has whole-number entries: [[3, −1], [−5, 2]]. Ideal for checking the adjugate formula by hand.',
      best: 'analysis',
    },
    {
      id: 'identity-3',
      name: 'Identity',
      category: 'Starting out',
      matrix: [['1', '0', '0'], ['0', '1', '0'], ['0', '0', '1']],
      teaches: 'The do-nothing matrix. Its own inverse, its own transpose, determinant 1, and every vector is an eigenvector with λ = 1.',
      best: 'properties',
    },
    {
      id: 'fractions',
      name: 'Fractional entries',
      category: 'Starting out',
      matrix: [['1/2', '1/3'], ['1/4', '1/5']],
      teaches: 'Determinant 1/60 exactly. Shows that fractions stay fractions all the way through the inverse.',
      best: 'analysis',
    },
    {
      id: 'rectangular',
      name: 'Rectangular 2×3',
      category: 'Starting out',
      matrix: [['1', '2', '3'], ['4', '5', '6']],
      teaches: 'No determinant, no trace, no inverse — but rank 2, and four subspaces living in different dimensions.',
      best: 'subspaces',
    },

    /* ---------------------------- singularity --------------------------- */
    {
      id: 'singular-2x2',
      name: 'Singular 2×2',
      category: 'Singular and degenerate',
      matrix: [['1', '2'], ['2', '4']],
      teaches: 'Row 2 is twice row 1, so the determinant is 0 and there is no inverse. Rank 1, and a one-dimensional null space.',
      best: 'properties',
    },
    {
      id: 'singular-3x3',
      name: 'Rank-2 3×3',
      category: 'Singular and degenerate',
      matrix: [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']],
      teaches: 'Looks harmless but is singular: each row is the average of its neighbours. RREF is [[1,0,−1],[0,1,2],[0,0,0]].',
      best: 'row-reduction',
    },
    {
      id: 'needs-swap',
      name: 'Needs a row swap',
      category: 'Singular and degenerate',
      matrix: [['0', '2', '1'], ['1', '0', '3'], ['2', '1', '0']],
      teaches: 'The first pivot position holds a zero, so elimination must swap rows. Plain LU fails here; PLU handles it.',
      best: 'decompositions',
    },
    {
      id: 'nilpotent',
      name: 'Nilpotent',
      category: 'Singular and degenerate',
      matrix: [['0', '1', '0'], ['0', '0', '1'], ['0', '0', '0']],
      teaches: 'A³ = 0 although A ≠ 0. Every eigenvalue is 0, and it is as defective as a matrix can be.',
      best: 'properties',
    },
    {
      id: 'projection-matrix',
      name: 'Projection',
      category: 'Singular and degenerate',
      matrix: [['1', '0'], ['0', '0']],
      teaches: 'Idempotent: A² = A. Projects the plane onto the x-axis, so eigenvalues are 1 and 0.',
      best: 'transformations',
    },

    /* ------------------------------ symmetry ---------------------------- */
    {
      id: 'symmetric',
      name: 'Symmetric',
      category: 'Symmetry and orthogonality',
      matrix: [['2', '1'], ['1', '2']],
      teaches: 'Eigenvalues 3 and 1 with perpendicular eigenvectors (1,1) and (1,−1) — the hallmark of a symmetric matrix.',
      best: 'eigen',
    },
    {
      id: 'symmetric-3',
      name: 'Symmetric 3×3',
      category: 'Symmetry and orthogonality',
      matrix: [['2', '0', '0'], ['0', '3', '4'], ['0', '4', '9']],
      teaches: 'Integer eigenvalues 11, 2 and 1, so it diagonalises exactly with rational P and D.',
      best: 'eigen',
    },
    {
      id: 'skew',
      name: 'Skew-symmetric',
      category: 'Symmetry and orthogonality',
      matrix: [['0', '2', '-3'], ['-2', '0', '4'], ['3', '-4', '0']],
      teaches: 'Aᵗ = −A, and the diagonal must be zero. Every odd-sized skew-symmetric matrix is singular.',
      best: 'properties',
    },
    {
      id: 'rotation',
      name: 'Rotation by 90°',
      category: 'Symmetry and orthogonality',
      matrix: [['0', '-1'], ['1', '0']],
      teaches: 'Orthogonal with determinant 1. No real eigenvector at all — the eigenvalues are ±i.',
      best: 'visualizations',
    },
    {
      id: 'reflection',
      name: 'Reflection in y = x',
      category: 'Symmetry and orthogonality',
      matrix: [['0', '1'], ['1', '0']],
      teaches: 'Orthogonal with determinant −1, and involutory (A² = I). Eigenvalues 1 and −1: the mirror line and its normal.',
      best: 'visualizations',
    },
    {
      id: 'positive-definite',
      name: 'Positive definite',
      category: 'Symmetry and orthogonality',
      matrix: [['4', '12', '-16'], ['12', '37', '-43'], ['-16', '-43', '98']],
      teaches: 'Symmetric with all leading minors positive, so Cholesky succeeds and gives L with whole numbers in the first column.',
      best: 'decompositions',
    },
    {
      id: 'orthogonal-3',
      name: 'Permutation (orthogonal)',
      category: 'Symmetry and orthogonality',
      matrix: [['0', '1', '0'], ['0', '0', '1'], ['1', '0', '0']],
      teaches: 'Just reorders coordinates. Orthogonal, so its inverse is its transpose, and A³ = I.',
      best: 'properties',
    },

    /* ---------------------------- eigenvalues --------------------------- */
    {
      id: 'distinct-eigen',
      name: 'Distinct eigenvalues',
      category: 'Eigenvalues',
      matrix: [['4', '1'], ['2', '3']],
      teaches: 'Eigenvalues 5 and 2 with eigenvectors (1,1) and (1,−2). Diagonalises cleanly and exactly.',
      best: 'eigen',
    },
    {
      id: 'repeated-diagonalisable',
      name: 'Repeated but diagonalisable',
      category: 'Eigenvalues',
      matrix: [['3', '0'], ['0', '3']],
      teaches: 'λ = 3 twice, and a two-dimensional eigenspace. A repeated eigenvalue is not automatically a problem.',
      best: 'eigen',
    },
    {
      id: 'defective',
      name: 'Defective (shear)',
      category: 'Eigenvalues',
      matrix: [['1', '1'], ['0', '1']],
      teaches: 'λ = 1 twice but only one eigenvector, so it cannot be diagonalised. The standard counterexample.',
      best: 'eigen',
    },
    {
      id: 'golden',
      name: 'Irrational eigenvalues',
      category: 'Eigenvalues',
      matrix: [['1', '1'], ['1', '0']],
      teaches: 'Characteristic polynomial λ² − λ − 1, so the eigenvalues are (1 ± √5)/2 — the golden ratio, shown exactly as a surd.',
      best: 'eigen',
    },
    {
      id: 'complex-eigen',
      name: 'Complex eigenvalues',
      category: 'Eigenvalues',
      matrix: [['1', '-1'], ['1', '1']],
      teaches: 'A rotation combined with a scaling: eigenvalues 1 ± i. Determinant 2, and no real eigenvector.',
      best: 'eigen',
    },
    {
      id: 'markov',
      name: 'Transition matrix',
      category: 'Eigenvalues',
      matrix: [['0.9', '0.2'], ['0.1', '0.8']],
      teaches: 'Columns sum to 1, so λ = 1 is an eigenvalue and its eigenvector is the long-run steady state. Try raising it to a high power.',
      best: 'eigen',
    },
    {
      id: 'cubic-eigen',
      name: 'Irreducible cubic',
      category: 'Eigenvalues',
      matrix: [['0', '0', '1'], ['1', '0', '1'], ['0', '1', '0']],
      teaches: 'Characteristic polynomial λ³ − λ − 1 has no rational roots and no formula in radicals, so MatrixLab solves it numerically and says so.',
      best: 'eigen',
    },

    /* ------------------------------ systems ----------------------------- */
    {
      id: 'unique-system',
      name: 'System with one solution',
      category: 'Systems and elimination',
      matrix: [['1', '1', '1', '6'], ['0', '2', '5', '-4'], ['2', '5', '-1', '27']],
      teaches: 'An augmented matrix. Reduce it and read off x = 5, y = 3, z = −2.',
      best: 'row-reduction',
    },
    {
      id: 'infinite-system',
      name: 'System with a free variable',
      category: 'Systems and elimination',
      matrix: [['1', '3', '1', '9'], ['1', '1', '-1', '1'], ['3', '11', '5', '35']],
      teaches: 'Rank 2 with three unknowns, so the solution is a line: one particular solution plus a null-space direction.',
      best: 'row-reduction',
    },
    {
      id: 'inconsistent',
      name: 'Inconsistent system',
      category: 'Systems and elimination',
      matrix: [['1', '1', '2'], ['2', '2', '5']],
      teaches: 'Reduction produces the row 0 0 | 1, which reads 0 = 1. No solution exists, and the ranks differ.',
      best: 'row-reduction',
    },
    {
      id: 'four-subspaces',
      name: 'Four subspaces example',
      category: 'Systems and elimination',
      matrix: [['1', '2', '2', '2'], ['2', '4', '6', '8'], ['3', '6', '8', '10']],
      teaches: 'Rank 2, so nullity 2 and left nullity 1. Every one of the four subspaces is non-trivial.',
      best: 'subspaces',
    },
    {
      id: 'hilbert-3',
      name: 'Ill-conditioned',
      category: 'Systems and elimination',
      matrix: [['1', '1/2', '1/3'], ['1/2', '1/3', '1/4'], ['1/3', '1/4', '1/5']],
      teaches: 'Invertible, but only just: the inverse has huge entries and the condition number is large. Exact arithmetic handles it; floating point struggles.',
      best: 'decompositions',
    },
    {
      id: 'ready-for-lu',
      name: 'Ready for LU',
      category: 'Systems and elimination',
      matrix: [['2', '-1', '-2'], ['-4', '6', '3'], ['-4', '-2', '8']],
      teaches: 'No zero pivots, so plain LU works and the multipliers come out as tidy integers.',
      best: 'decompositions',
    },
  ];

  const CATEGORIES = [];
  EXAMPLES.forEach(function (example) {
    if (CATEGORIES.indexOf(example.category) < 0) CATEGORIES.push(example.category);
  });

  ML.examples = {
    all: EXAMPLES,
    categories: CATEGORIES,

    byId: function (id) {
      return EXAMPLES.filter(function (example) { return example.id === id; })[0] || null;
    },

    byCategory: function (category) {
      return EXAMPLES.filter(function (example) { return example.category === category; });
    },

    /** Build the Matrix for an example (throws only if the data file is wrong). */
    matrixOf: function (example) {
      return ML.Matrix.from(example.matrix);
    },
  };
})((globalThis.ML = globalThis.ML || {}));
