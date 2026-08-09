# MatrixLab

### Interactive Linear Algebra Toolkit

A matrix calculator that shows its work, plus visualisations and a structured
course — from "what is a matrix" to the singular value decomposition.

MatrixLab runs entirely in your browser. No server, no build step, no account,
no dependencies, no network requests. Open `index.html` and it works, including
offline.

---

## Why another matrix calculator?

Most matrix calculators give you a number. MatrixLab tries to answer three
questions every time:

1. **What is this?** — a short, plain-language explanation of the operation.
2. **How is it calculated?** — the real steps the algorithm took, generated as
   it ran.
3. **What is the result?** — typeset properly, with exact fractions where the
   mathematics allows them.

Two design decisions follow from that, and they shape the whole project.

### Exact arithmetic wherever it is possible

Matrix entries are stored as exact rationals backed by `BigInt`, not as floating
point numbers. Elimination, determinants, inverses, rank, solving, subspaces,
projections, least squares and LU factorisation are all computed **exactly**.

This is not cosmetic. It means:

- `1/3` stays `1/3` — it never becomes `0.3333333333333333`.
- A singular matrix is *never* mistaken for an invertible one. There is no
  tolerance to tune and no "is this pivot small enough to count as zero?"
  judgement call.
- Verification is decisive. When MatrixLab checks `A·A⁻¹ = I` or
  `Aᵗ(b − Ax̂) = 0`, the result is exactly the identity or exactly zero — a
  proof rather than an impression.

### Honesty about the rest

Some results genuinely cannot be exact: square roots, most angles, eigenvectors
of irrational eigenvalues, and the QR, Cholesky and SVD factorisations. For
those, MatrixLab uses carefully chosen floating-point algorithms, **labels the
result as numeric**, and reports the reconstruction error so you can see the
accuracy rather than assume it.

Where a result cannot be trusted at all, the operation refuses and explains why.
Nothing is ever faked to fill a gap.

---

## Features

### Calculate

| Tool | What it does |
| --- | --- |
| **Matrix Calculator** | Addition, subtraction, matrix product, element-wise (Hadamard) product, scalar multiplication, integer powers (including negative), equality |
| **Matrix Analysis** | Transpose, trace, determinant, minors, cofactors, adjugate, inverse, rank — with a choice of method where more than one exists |
| **Matrix Properties** | Twenty classifications with the *reason* for each verdict, plus rank, nullity, trace, determinant and four matrix norms |
| **Row Reduction** | Drive the elementary row operations yourself with undo/redo, ask for the next sensible step, or watch the full elimination with commentary |
| **Linear Equations** | Solve `Ax = b` by Gauss–Jordan, back-substitution, the inverse method or Cramer's rule — entered as matrices or typed as ordinary equations |

### Linear algebra

| Tool | What it does |
| --- | --- |
| **Eigenvalues** | Characteristic polynomial, eigenvalues, eigenspaces, algebraic vs geometric multiplicity, diagonalisation, with trace and determinant cross-checks |
| **Decompositions** | LU, PLU, QR (Householder or Gram–Schmidt), Cholesky, SVD — each with its preconditions stated and its reconstruction verified |
| **Subspaces** | The four fundamental subspaces, rank–nullity, linear independence, span and basis |
| **Least Squares** | Fit a line or polynomial to data with a plotted result, or solve any overdetermined system via the normal equations |

### Vectors

| Tool | What it does |
| --- | --- |
| **Vector Calculator** | Dot and cross products, magnitude, unit vectors, distance, angle, projection, orthogonality, linear combinations — drawn in the plane for 2-D input |
| **Orthogonality** | Gram–Schmidt step by step, projection onto a subspace, orthogonal complements |

### Visualise

| Tool | What it does |
| --- | --- |
| **Transformations** | Watch a 2×2 matrix deform the grid, the unit square and the basis vectors, with a morph slider and automatic classification (rotation / shear / reflection / projection / collapse) |
| **Visualisations** | The determinant as signed area (and volume in 3-D), and eigenvectors as the directions a transformation leaves alone |

### Learn

| Tool | What it does |
| --- | --- |
| **Learn** | Eight levels, 31 topics, ordered so each idea builds on the last. Every topic ends with something concrete to try in the tools |
| **Examples** | 30 curated matrices, each chosen to demonstrate one specific idea, loadable in one click |
| **Generator** | Zero, identity, random, diagonal, symmetric, triangular, sparse and guaranteed-invertible matrices |

---

## Screenshots

<!--
  Add screenshots here. Suggested set:
  docs/screenshot-dashboard.png    — the dashboard
  docs/screenshot-steps.png        — a result with the Steps tab open
  docs/screenshot-transform.png    — the transformation visualiser
  docs/screenshot-eigen.png        — eigenvalues with exact surds
  docs/screenshot-dark.png         — dark mode
-->

| | |
| --- | --- |
| _Dashboard_ | _Step-by-step working_ |
| _Transformation visualiser_ | _Eigenvalues and diagonalisation_ |

*(Screenshots to be added — run the app locally to see it in action.)*

---

## How to run

**Option 1 — just open it.**

```
Download or clone the repository, then open index.html in any modern browser.
```

That is genuinely all. There is no build, no install, no server. The `file://`
protocol works, which is why MatrixLab uses classic scripts and a global
namespace rather than ES modules (browsers block module loading over `file://`).

**Option 2 — serve it locally** (only needed if your browser is configured
unusually strictly):

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

**Browser support:** any browser with `BigInt` — Chrome/Edge 67+, Firefox 68+,
Safari 14+. That covers everything from 2020 onwards.

---

## Running the tests

MatrixLab has **1,843 assertions** across 54 suites. They run in two places.

**In the browser** — open `tests/index.html`. No tooling required.

**On the command line** — Node is used purely as a test harness here; the
application itself has no Node or npm dependency:

```bash
node tests/run-node.js              # the mathematics
node tests/run-node.js --verbose    # list every assertion
node tests/run-node.js eigen        # only suites matching "eigen"

node tests/run-views.js             # headless UI smoke test
```

`run-views.js` loads exactly the scripts `index.html` loads, against a minimal
DOM shim, then builds every view, opens every tab and presses every action
button — catching runtime errors in the interface without a browser.

### What the tests actually check

Expected values are either standard results verifiable by hand, or identities
that *must* hold. The most valuable suite is the integration one, which checks
that independent parts of the codebase agree:

- the determinant from cofactor expansion **=** from elimination **=** from PLU
  pivots **=** the product of the eigenvalues;
- the rank from RREF **=** the rank from the SVD **=** `rank(Aᵗ)`;
- the inverse via the adjugate **=** via Gauss–Jordan, and `A·A⁻¹ = I` exactly;
- Cayley–Hamilton: `p(A) = 0` exactly, for every test matrix;
- eigenvalues sum to the trace and multiply to the determinant;
- row space ⊥ null space and column space ⊥ left null space, exactly;
- every least-squares residual is exactly perpendicular to every column;
- every factorisation reconstructs its matrix;
- every documented claim in the example library is true;
- bad input always produces a friendly `MLError`, never a raw crash.

Agreement between routes that share no code is the strongest evidence available
that the mathematics is right.

---

## Project structure

```
MatrixLab/
├── index.html              Single page; loads everything in dependency order
│
├── css/
│   ├── themes.css          Design tokens, light/dark palettes
│   ├── style.css           Layout, typography, app shell
│   ├── components.css      Cards, controls, matrix rendering, steps
│   └── responsive.css      Breakpoints and print styles
│
├── js/
│   ├── core/               Types and infrastructure — no mathematics, no DOM
│   │   ├── errors.js       MLError: friendly, complete-sentence failures
│   │   ├── frac.js         Exact rationals on BigInt
│   │   ├── num.js          Precision settings and all number formatting
│   │   ├── complex.js      Complex numbers (for eigenvalues)
│   │   ├── matrix.js       Immutable Matrix type + generators
│   │   ├── steps.js        StepLog — how algorithms record their working
│   │   └── store.js        Shared workspace, persisted to localStorage
│   │
│   ├── math/               Pure mathematics. No DOM access anywhere.
│   │   ├── operations.js       add, subtract, multiply, scalar, Hadamard, power, transpose, trace
│   │   ├── rowReduction.js     elementary operations, REF, RREF, rank — the shared elimination engine
│   │   ├── determinant.js      determinant (two methods), minors, cofactors, adjugate
│   │   ├── inverse.js          inverse by adjugate and by Gauss–Jordan
│   │   ├── properties.js       20 classification tests, norms, the analyser
│   │   ├── equations.js        Ax = b by four methods, plus an equation-text parser
│   │   ├── numeric.js          float64 kernel: Jacobi, Householder, Cholesky, SVD
│   │   ├── polynomial.js       exact rational roots, closed-form quadratics, Durand–Kerner
│   │   ├── eigen.js            characteristic polynomial, eigenvalues, eigenvectors, diagonalisation
│   │   ├── subspaces.js        four fundamental subspaces, independence, span, basis
│   │   ├── vectors.js          all vector operations
│   │   ├── orthogonality.js    Gram–Schmidt, projection, orthogonal complement
│   │   ├── leastSquares.js     normal equations, curve fitting
│   │   └── decompositions.js   LU, PLU, QR, Cholesky, SVD
│   │
│   ├── ui/                 Presentation. Computes nothing.
│   │   ├── dom.js          Element helpers
│   │   ├── render.js       Matrix/value renderer — brackets, stacked fractions
│   │   ├── components.js   Cards, tabs, alerts, the Result/Steps/Explanation panel
│   │   ├── matrixInput.js  The matrix input engine
│   │   └── router.js       View registry and hash router
│   │
│   ├── viz/
│   │   └── plot.js         Canvas plotting: coordinates, grids, arrows, theming
│   │
│   ├── data/
│   │   ├── examples.js     The example matrix library
│   │   └── lessons.js      Learn-mode content, as structured data
│   │
│   ├── views/              One file per screen; the only files that know about both
│   │   └── …               mathematics and DOM
│   │
│   └── app.js              Bootstrap: theme, sidebar, settings, router start
│
├── tests/
│   ├── index.html          In-browser test runner
│   ├── run-node.js         Command-line runner
│   ├── run-views.js        Headless UI smoke test
│   ├── dom-shim.js         Minimal DOM, for the smoke test only
│   ├── framework.js        Assertions (exact for rationals, tolerance for floats)
│   ├── manifest.js         Ordered source list, shared by the runners
│   └── suite/              The seven test suites
│
└── assets/                 Favicon
```

### Architectural rules

1. **Mathematics never touches the DOM.** Everything in `js/math/` and
   `js/core/` is pure and runs headlessly — which is why the whole engine is
   testable from the command line.
2. **The UI never computes.** `js/ui/` formats and arranges; it does not decide
   anything mathematical.
3. **Steps are recorded, not written.** Algorithms take an optional `StepLog`
   and record what they actually did. If the algorithm swaps a row, the steps
   say so; if it does not, they do not. No step text is hardcoded prose about a
   hypothetical calculation.
4. **Failures are explanations.** Every precondition throws an `MLError` with a
   complete sentence a student can act on, often with a hint and a suggested
   alternative.

---

## Core API

Every mathematical function is a plain, testable function on the `ML` namespace.
The optional last argument is a `StepLog` to record the working.

```js
// Basic operations
addMatrices(A, B, steps)        subtractMatrices(A, B, steps)
multiplyMatrices(A, B, steps)   scalarMultiply(A, k, steps)
hadamardProduct(A, B, steps)    matrixPower(A, n, steps)
transposeMatrix(A, steps)       traceMatrix(A, steps)
matricesEqual(A, B)             augment(A, B)

// Analysis
determinant(A, steps, {method})     determinantByCofactor(A, steps, row)
determinantByElimination(A, steps)  getMinor(A, i, j)
minorMatrix(A, steps)               cofactorMatrix(A, steps)
adjointMatrix(A, steps)             inverseMatrix(A, steps, {method})
inverseByAdjugate(A, steps)         inverseByGaussJordan(A, steps)

// Elimination
rowSwap(A, i, j)      rowScale(A, i, k)      rowAdd(A, target, source, k)
ref(A, steps)         rref(A, steps)         matrixRank(A, steps)
gaussianElimination(A, steps)                gaussJordan(A, steps)
eliminate(A, options)   // the full record: pivots, rank, operations, swaps

// Properties
isSquare  isSymmetric  isSkewSymmetric  isIdentity  isDiagonal  isScalar
isOrthogonal  isSingular  isUpperTriangular  isLowerTriangular
isIdempotent  isInvolutory  isNilpotent  isPositiveDefinite
analyzeMatrix(A)   // the full report used by the Properties view

// Systems
solveLinearSystem(A, b, steps, {names})   // classifies unique / none / infinite
solveByBackSubstitution(A, b, steps)      solveByInverse(A, b, steps)
solveByCramer(A, b, steps)                parseSystem("2x + 3y = 5")

// Eigenvalues
characteristicPolynomial(A, steps)   eigenvalues(A, steps)
eigenvectorsFor(A, eigenvalue)       eigenAnalysis(A, steps)
diagonalizeMatrix(A, steps)

// Decompositions
luDecomposition(A, steps)        pluDecomposition(A, steps)
qrDecomposition(A, steps, {method})
choleskyDecomposition(A, steps)  svdDecomposition(A, steps)

// Vectors and orthogonality
dotProduct  crossProduct  vectorNorm  normalizeVector  vectorAngle
projection  linearCombination  vectorDistance
gramSchmidt(vectors, steps)      projectionMatrix(A, steps)
projectOntoSubspace(vectors, target, steps)   orthogonalComplement(vectors, steps)

// Subspaces and least squares
columnSpace  rowSpace  nullSpace  leftNullSpace  fourSubspaces
linearIndependence  spanContains  basisOfSpan
leastSquares(A, b, steps)   fitLine(points, steps)   fitPolynomial(points, degree, steps)
```

Example:

```js
const A = ML.Matrix.from([[2, 1], [5, 3]]);
const steps = new ML.StepLog('Inverting A');

const inverse = ML.inverseMatrix(A, steps);
console.log(inverse.toString());   // [ 3  -1 ]
                                   // [ -5  2 ]
console.log(steps.count);          // the working, ready to render
```

---

## Accuracy: what is exact and what is not

**Exact — no rounding at all:**
addition, subtraction, multiplication, powers, transpose, trace; row reduction,
REF, RREF, rank and every solution of `Ax = b`; determinants, minors, cofactors,
adjugate and inverses; all four fundamental subspaces, independence, span and
basis; dot and cross products, projections, Gram–Schmidt's orthogonal vectors;
least squares via the normal equations, including R²; LU and PLU; characteristic
polynomials, and eigenvalues that are rational or come from a quadratic factor.

**Numeric — always labelled in the interface:**
vector lengths and angles; eigenvectors of irrational or complex eigenvalues;
eigenvalues from a cubic or higher factor with no rational roots (degree 5 and
above provably has no formula in radicals); QR, Cholesky and SVD, which all
require square roots.

**Deliberately not implemented:** Jordan normal form, complex-valued *input*
matrices, symbolic entries, matrices above 10×10 (8×8 for eigenvalue analysis).

---

## Contributing

Contributions are welcome. The codebase is plain ES2020 with no build step, so
you can edit a file and refresh the page.

**Before opening a pull request:**

```bash
node tests/run-node.js      # must be 0 failures
node tests/run-views.js     # must be 0 failures
```

**Adding a mathematical function** — put it in the right `js/math/` module,
accept an optional `StepLog` as the last argument, throw `MLError` (never a bare
`Error`) with a complete-sentence message on bad input, and add tests to the
matching suite. Prefer an expected value you can verify by hand, and add an
identity check to `tests/suite/07-integration.js` if one applies.

**Adding a view** — create `js/views/<name>.js`, call `ML.registerView({...})`,
add the `<script>` tag to `index.html` and the id to the `NAV` array in
`js/app.js`. The smoke test will pick it up automatically.

**House style** — no dependencies, ever. Comments explain *why*, not *what*.
Never return a result the code cannot stand behind: if a precondition fails,
throw and explain.

---

## Future improvements

- Jordan normal form for defective matrices
- Complex-valued matrix input, not only complex results
- QR-algorithm eigenvalues, to replace the characteristic polynomial for larger
  matrices where it is numerically fragile
- An interactive 3-D visualisation for determinants as volume
- Exportable working (PDF or LaTeX) from any Steps panel
- Pseudoinverse and minimum-norm least-squares solutions via the SVD
- Practice mode: generated exercises with answer checking
- Translations

---

## Credits and references

MatrixLab is an independent educational project. All code, explanations,
examples and interface design are original.

The **organisation** of topics — elimination before vector spaces, the four
fundamental subspaces as a unifying framework, orthogonality before eigenvalues,
factorisations last — follows the sequence used in standard introductory linear
algebra courses, an approach most associated with **Gilbert Strang's** teaching
at MIT. That influence is on the ordering and emphasis only.

> MatrixLab is not affiliated with, endorsed by, or connected to Gilbert Strang,
> MIT, or any publisher. No text, figure, exercise or example from any book has
> been copied or adapted. Where a classical theorem is named (Cayley–Hamilton,
> Rouché–Capelli, Eckart–Young, Sylvester's criterion), the name is used as
> standard mathematical vocabulary.

Algorithms are standard and implemented from their mathematical definitions:
Gauss–Jordan elimination, Faddeev–LeVerrier for the characteristic polynomial,
the rational root theorem, Durand–Kerner for polynomial roots, Householder
reflections and modified Gram–Schmidt for QR, cyclic Jacobi for the symmetric
eigenproblem, and one-sided Jacobi for the SVD.

---

## Licence

MIT — free to use, modify and share, including in teaching.
