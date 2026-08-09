/**
 * Ordered list of MatrixLab source files, shared by the Node test runner and
 * the in-browser test page. Mathematical modules only — no DOM code — so the
 * whole engine can be exercised headlessly.
 *
 * Keep this in sync with the <script> tags in index.html. `npm test` is not
 * used; run `node tests/run-node.js` (Node is only a test harness, never a
 * runtime dependency of the app).
 */
const CORE_FILES = [
  'js/core/errors.js',
  'js/core/frac.js',
  'js/core/num.js',
  'js/core/complex.js',
  'js/core/matrix.js',
  'js/core/steps.js',
  'js/math/operations.js',
  'js/math/rowReduction.js',
  'js/math/determinant.js',
  'js/math/inverse.js',
  'js/math/properties.js',
  'js/math/equations.js',
  'js/math/subspaces.js',
  'js/math/vectors.js',
  'js/math/numeric.js',
  'js/math/polynomial.js',
  'js/math/eigen.js',
  'js/math/orthogonality.js',
  'js/math/leastSquares.js',
  'js/math/decompositions.js',
  'js/data/examples.js',
  'js/data/lessons.js',
];

const TEST_FILES = [
  'tests/suite/01-core.js',
  'tests/suite/02-analysis.js',
  'tests/suite/03-reduction.js',
  'tests/suite/04-eigen.js',
  'tests/suite/05-vectors.js',
  'tests/suite/06-decompositions.js',
  'tests/suite/07-integration.js',
];

if (typeof module !== 'undefined') {
  module.exports = { CORE_FILES, TEST_FILES };
}
