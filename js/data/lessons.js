/**
 * MatrixLab — lesson content for Learn mode.
 *
 * All explanations are original to MatrixLab. The topic *organisation* follows
 * the order most linear algebra courses use — elimination before vector spaces,
 * orthogonality before eigenvalues, factorisations last — because each idea
 * genuinely depends on the ones before it. No text, figure or exercise is taken
 * from any book.
 *
 * Content is data, not markup: each block is {h|p|formula|list|callout|try|
 * matrix|note}, and js/views/learn.js turns it into HTML.
 */
(function (ML) {
  'use strict';

  const LEVELS = [
    /* ================================================================= *
     * LEVEL 1
     * ================================================================= */
    {
      number: 1,
      id: 'foundations',
      title: 'Foundations',
      summary: 'What the objects are, how they are written, and the operations that come for free.',
      topics: [
        {
          id: 'scalars-vectors-matrices',
          title: 'Scalars, vectors and matrices',
          blurb: 'Three kinds of object, one idea.',
          content: [
            { p: 'Linear algebra deals with three kinds of object, and the difference between them is just how many indices you need to pick out a number.' },
            {
              list: [
                'A **scalar** is a single number: 7, −2.5, 1/3. No index needed.',
                'A **vector** is an ordered list of numbers: (3, 4) or (1, 0, −2). One index picks out an entry.',
                'A **matrix** is a rectangular grid of numbers. Two indices — a row and a column — pick out an entry.',
              ],
            },
            { p: 'A vector can be pictured as an arrow from the origin to a point, and that picture is worth keeping in mind even in dimensions you cannot draw. The vector (3, 4) is the instruction "go 3 right and 4 up", and it has length 5.' },
            { p: 'A matrix has two quite different readings, and switching between them freely is most of the skill in this subject. Read as a table, it is just organised data. Read as a machine, it takes a vector in and produces a vector out — and that is where the interesting mathematics lives.' },
            {
              callout: {
                title: 'The key insight, stated early',
                text: 'Multiplying a matrix by a vector is not an arbitrary rule. The columns of the matrix tell you where the coordinate axes end up, and everything else follows from that. If you remember nothing else from Level 1, remember that columns are destinations.',
              },
            },
            { try: { view: 'vectors', text: 'Open the Vector Calculator and compute the length of (3, 4). Notice that MatrixLab reports it as exactly 5, not 5.0000.' } },
          ],
        },
        {
          id: 'dimensions-notation',
          title: 'Dimensions and notation',
          blurb: 'Rows before columns, always.',
          content: [
            { p: 'A matrix with m rows and n columns is called m×n — rows first, columns second. Getting this order the wrong way round is the single most common source of confusion early on, so it is worth being deliberate about it.' },
            { matrix: [['1', '2', '3'], ['4', '5', '6']], label: 'a 2×3 matrix' },
            { p: 'Individual entries are written with two subscripts, also row first: a₂₃ means the entry in row 2, column 3, which is 6 above. Matrices are conventionally named with capital letters, vectors with lower-case, and scalars with lower-case Greek or Latin letters.' },
            { p: 'Some shapes have their own names. A matrix with one row is a row vector; with one column, a column vector. When rows and columns are equal in number the matrix is square, and square matrices are special: they are the only ones with a determinant, a trace, eigenvalues, or a chance of an inverse.' },
            {
              note: 'In MatrixLab a vector is stored as a column matrix (n×1). That is not a technicality — writing vectors as columns is what makes the product Ax work out, and it is the convention almost all of linear algebra uses.',
            },
            { try: { view: 'properties', text: 'Load a rectangular matrix into the Properties analyser and see which tests it cannot answer. Determinant, trace and inverse all require square.' } },
          ],
        },
        {
          id: 'basic-operations',
          title: 'Addition and scalar multiplication',
          blurb: 'The easy operations, and why they are easy.',
          content: [
            { p: 'Two matrices of the same shape are added by adding the numbers that sit in the same position. Nothing mixes across rows or columns. Matrices of different shapes cannot be added at all — there is no sensible way to pair up the entries.' },
            { formula: '(A + B)ᵢⱼ = aᵢⱼ + bᵢⱼ' },
            { p: 'Multiplying by a scalar multiplies every entry. Both operations behave exactly like ordinary arithmetic: addition is commutative and associative, the zero matrix is the additive identity, and scalars distribute over sums.' },
            { p: 'It is worth noticing what these operations mean geometrically. Adding vectors is following one displacement after another. Scaling a vector by k stretches it by |k|, and reverses it if k is negative — but never turns it off its line.' },
            {
              callout: {
                title: 'Why "linear"?',
                text: 'A function f is linear when f(u + v) = f(u) + f(v) and f(ku) = k·f(u). These two rules are the whole subject in miniature: everything that follows is a consequence of respecting addition and scaling. Matrix multiplication is defined the way it is precisely so that Ax is linear in x.',
              },
            },
            { try: { view: 'calculator', text: 'In the Matrix Calculator, add two matrices and open the Steps tab. Then deliberately resize one of them and press Calculate to see the error message explain the requirement.' } },
          ],
        },
      ],
    },

    /* ================================================================= *
     * LEVEL 2
     * ================================================================= */
    {
      number: 2,
      id: 'operations',
      title: 'Matrix Operations',
      summary: 'Multiplication, transpose, determinant, inverse and rank — the working vocabulary.',
      topics: [
        {
          id: 'multiplication',
          title: 'Matrix multiplication',
          blurb: 'The rule that looks strange until you know why.',
          content: [
            { p: 'To multiply A by B, take row i of A and column j of B, multiply matching entries, and add: that single number is entry (i, j) of the product. This forces the inner dimensions to agree — the row and the column must have the same length — so an m×n matrix can only multiply an n×p one, giving an m×p result.' },
            { formula: 'cᵢⱼ = aᵢ₁b₁ⱼ + aᵢ₂b₂ⱼ + … + aᵢₙbₙⱼ' },
            { p: 'Why not just multiply entry by entry, as addition does? Because matrix multiplication is designed to represent doing one transformation after another. If B moves your vector and then A moves the result, the single matrix that does both at once is AB. That is the whole reason for the rule.' },
            { p: 'Reading right to left feels backwards at first, but it matches how function composition is written: f(g(x)) applies g first. Once you accept the order, the dimension rule becomes obvious rather than arbitrary.' },
            {
              list: [
                '**Order matters.** AB and BA are usually different matrices, and BA may not even exist. This is the biggest behavioural difference from ordinary numbers.',
                '**Associativity holds.** (AB)C = A(BC), so you can group however is convenient.',
                '**The identity does nothing.** AI = IA = A, which is exactly what a "1" should do.',
                '**Zero divisors exist.** Two non-zero matrices can multiply to give the zero matrix — impossible with ordinary numbers.',
              ],
            },
            { try: { view: 'calculator', text: 'Compute A × B and then B × A for A = [[1,2],[3,4]] and B = [[0,1],[1,0]]. The results are different, which is worth seeing once with your own eyes.' } },
          ],
        },
        {
          id: 'transpose',
          title: 'Transpose',
          blurb: 'Reflect across the diagonal.',
          content: [
            { p: 'The transpose Aᵗ flips a matrix across its main diagonal: row 1 becomes column 1, row 2 becomes column 2, and an m×n matrix becomes n×m. Entry (i, j) of Aᵗ is entry (j, i) of A.' },
            { formula: '(Aᵗ)ᵢⱼ = aⱼᵢ,     (Aᵗ)ᵗ = A,     (AB)ᵗ = BᵗAᵗ' },
            { p: 'That last identity deserves attention: transposing a product reverses the order. It is easy to check by looking at the dimensions — if A is m×n and B is n×p, then (AB)ᵗ is p×m, and the only way to build that from the transposes is Bᵗ (p×n) times Aᵗ (n×m).' },
            { p: 'A matrix equal to its own transpose is called symmetric. Symmetric matrices turn out to be unusually well behaved: their eigenvalues are always real and their eigenvectors always perpendicular. They arise naturally whenever a matrix records a relationship that has no direction — distances, covariances, mutual connections.' },
            { p: 'The transpose is also how the dot product is written in matrix language: for column vectors u and v, the dot product u·v is exactly uᵗv, a 1×1 matrix holding a single number.' },
            { try: { view: 'analysis', text: 'Compute a transpose in Matrix Analysis, then verify (AB)ᵗ = BᵗAᵗ for yourself using the calculator.' } },
          ],
        },
        {
          id: 'determinant',
          title: 'Determinant',
          blurb: 'One number that decides invertibility.',
          content: [
            { p: 'The determinant is a single number computed from a square matrix, and its meaning is geometric: it is the factor by which the matrix scales area (in two dimensions) or volume (in three or more).' },
            { formula: 'det [[a, b], [c, d]] = ad − bc' },
            { p: 'Take the two columns of a 2×2 matrix, place them at the origin, and complete the parallelogram. Its area is exactly |ad − bc|. If the determinant is negative, the parallelogram has been flipped over — the transformation includes a reflection.' },
            { p: 'The critical case is zero. A determinant of 0 means the parallelogram has collapsed: the columns are parallel, area has been destroyed, and the transformation has squashed the plane onto a line. Different inputs now land on the same output, so nothing can undo it. That is why a zero determinant means no inverse.' },
            {
              list: [
                'det(AB) = det(A)·det(B) — because scaling area twice multiplies the factors.',
                'det(Aᵗ) = det(A).',
                'det(kA) = kⁿ·det(A) for an n×n matrix, because all n directions are scaled.',
                'Adding a multiple of one row to another leaves the determinant unchanged; swapping two rows flips its sign.',
              ],
            },
            { p: 'Computing it is a different question from understanding it. Cofactor expansion is the definition and is fine for 2×2 and 3×3, but it needs roughly n! multiplications — hopeless beyond about 8×8. Elimination reduces the matrix to triangular form and multiplies the diagonal, needing only about n³ operations. Both are available in MatrixLab, and they always agree.' },
            { try: { view: 'visualizations', text: 'Open the Determinant visualisation and load the shear preset. The parallelogram leans right over, yet the area stays exactly 1.' } },
          ],
        },
        {
          id: 'inverse',
          title: 'Inverse',
          blurb: 'Undoing a transformation.',
          content: [
            { p: 'The inverse A⁻¹ undoes what A does: if A sends x to b, then A⁻¹ sends b back to x. It satisfies AA⁻¹ = A⁻¹A = I, and only square matrices with non-zero determinant have one.' },
            { formula: 'A⁻¹ = adj(A) / det(A)' },
            { p: 'The formula routes through minors and cofactors. A minor Mᵢⱼ is the determinant left after deleting row i and column j. Attaching a chequerboard of signs gives the cofactors, transposing them gives the adjugate, and dividing by the determinant gives the inverse. It is entirely mechanical, and it is the method to know for 2×2 and 3×3.' },
            { p: 'For anything larger, the adjugate route is a bad idea: it needs a determinant for every one of the n² entries. The practical method is to write [A | I] and row-reduce until the left half becomes the identity — whatever operations achieve that must have been multiplication by A⁻¹, so the right half becomes A⁻¹.' },
            {
              callout: {
                title: 'A habit worth forming',
                text: 'Inverses are rarely what you actually want. To solve Ax = b, do not compute A⁻¹ and multiply — it is more arithmetic and, in floating point, less accurate. Use elimination directly. The inverse is a concept to think with more often than an object to compute.',
              },
            },
            { p: 'A useful identity, and a good test of whether you have absorbed the order-reversing pattern: (AB)⁻¹ = B⁻¹A⁻¹. To undo "do B then A", you undo A first.' },
            { try: { view: 'analysis', text: 'Invert [[2,1],[5,3]] — the determinant is 1, so the inverse has whole numbers. Then try [[1,2],[2,4]] and read the error message.' } },
          ],
        },
        {
          id: 'rank',
          title: 'Rank',
          blurb: 'How much information is really there.',
          content: [
            { p: 'The rank of a matrix is the number of pivots in its row echelon form. Equivalently, it is the number of genuinely independent rows — or independent columns, which turns out to be the same number.' },
            { p: 'That equality is not obvious and is worth pausing on. Row rank equals column rank for every matrix, however lopsided. A 2×1000 matrix has rank at most 2, meaning that despite having a thousand columns, at most two of them are independent and all the rest are combinations.' },
            { p: 'Rank measures how much information a matrix carries. A rank-1 matrix, however large, is built from a single direction. A square matrix of full rank is invertible; one of deficient rank has collapsed some directions to nothing.' },
            {
              list: [
                'rank(A) ≤ min(rows, columns), always.',
                'rank(A) = rank(Aᵗ).',
                'A square n×n matrix is invertible exactly when its rank is n.',
                'rank measures the dimension of the column space — the set of outputs actually reachable.',
              ],
            },
            { p: 'One caution for later. Counting pivots gives an exact answer for exact input, and MatrixLab does exactly that. But if the entries are noisy measurements, "is this pivot zero?" becomes a judgement call, and the honest tool is the singular value decomposition, which reports how close to zero things are instead of ruling.' },
            { try: { view: 'row-reduction', text: 'Row-reduce [[1,2,3],[4,5,6],[7,8,9]] and watch the third row become all zeros. Rank 2, not 3.' } },
          ],
        },
      ],
    },

    /* ================================================================= *
     * LEVEL 3
     * ================================================================= */
    {
      number: 3,
      id: 'systems',
      title: 'Systems of Equations',
      summary: 'Elimination: the algorithm that quietly powers everything else.',
      topics: [
        {
          id: 'linear-systems',
          title: 'What a linear system is',
          blurb: 'Three possible outcomes, never more.',
          content: [
            { p: 'A system of linear equations asks for values of the unknowns satisfying several equations at once. Collecting the coefficients into a matrix A, the unknowns into a vector x and the right-hand sides into b, the whole system becomes a single statement: Ax = b.' },
            { formula: 'Ax = b' },
            { p: 'Geometrically, each equation in three unknowns describes a plane. Solving the system means finding the points common to all the planes. Three planes might meet at a single point, or along a whole line, or be arranged so that no point lies on all three.' },
            { p: 'Those are the only possibilities. A linear system has exactly one solution, no solutions, or infinitely many — never two, never seventeen. The reason is structural: if x and y are both solutions, then so is every point on the line between them, so as soon as there are two there are infinitely many.' },
            {
              list: [
                '**Consistent** means at least one solution exists.',
                '**Inconsistent** means none does — the equations contradict each other.',
                '**Homogeneous** means b = 0. Such a system is always consistent, because x = 0 always works.',
              ],
            },
            { try: { view: 'equations', text: 'Type a system in ordinary notation and solve it. Then change one right-hand side to make it inconsistent and watch the verdict change.' } },
          ],
        },
        {
          id: 'row-operations',
          title: 'Elementary row operations',
          blurb: 'Three moves that never change the answer.',
          content: [
            { p: 'A system can be manipulated using exactly three operations on its rows, and each corresponds to something obviously harmless when read as a statement about equations.' },
            {
              list: [
                '**Swap two rows.** Just writing the equations in a different order.',
                '**Multiply a row by a non-zero number.** Rescaling one equation. Zero is forbidden, because multiplying by zero destroys the equation and cannot be undone.',
                '**Add a multiple of one row to another.** Replacing an equation by a combination of it and another — a legitimate deduction.',
              ],
            },
            { p: 'The reason these are safe is that all three are reversible. Anything reversible cannot lose or gain solutions: whatever satisfied the old system satisfies the new one, and vice versa. So you can transform a messy system into a simple one and read the answer off the simple one.' },
            { p: 'These operations are usually applied to the augmented matrix [A | b], which holds the coefficients and the right-hand side side by side. That is just bookkeeping — the variable names are implicit in the columns — but it strips away the clutter and makes the pattern visible.' },
            {
              callout: {
                title: 'Do it by hand at least once',
                text: 'The Row Reduction tool lets you drive the operations yourself, with undo and redo, and will suggest the next step when you get stuck. Working through one 3×4 system by hand teaches more than watching ten automatic solutions.',
              },
            },
            { try: { view: 'row-reduction', text: 'Use the "Do it yourself" tab. Try reaching the reduced form your own way, then compare with the suggestion button.' } },
          ],
        },
        {
          id: 'elimination',
          title: 'Gaussian elimination, REF and RREF',
          blurb: 'The staircase, and then the clean version.',
          content: [
            { p: 'Gaussian elimination works left to right. Find the first column with a non-zero entry at or below the current row, move that row up if needed, and use it to clear everything beneath. Move down and right, and repeat. The result is a staircase: row echelon form.' },
            { p: 'In row echelon form, every leading entry — the first non-zero in its row, called a pivot — sits strictly to the right of the pivot above it, and any all-zero rows have sunk to the bottom. This is already enough to solve the system by working upwards from the last equation, substituting as you go.' },
            { p: 'Gauss–Jordan goes further. Scale every pivot to 1 and clear the entries above the pivots as well as below. The result is the reduced row echelon form, in which each pivot is the only non-zero entry in its column, and every row simply states the value of one variable.' },
            {
              note: 'Row echelon form is not unique — different pivot choices give different, equally valid staircases. The reduced form is unique: every route through the row operations arrives at exactly the same matrix. That uniqueness is what makes it safe to read answers straight off it.',
            },
            { p: 'The cost is about n³/3 operations for an n×n system. That is what makes elimination practical where cofactor expansion is not, and it is why essentially every numerical linear algebra routine has elimination somewhere inside it.' },
            { try: { view: 'row-reduction', text: 'Compare the REF and RREF tabs on the same matrix, and read the generated steps to see exactly which operation was applied at each stage.' } },
          ],
        },
        {
          id: 'classifying-solutions',
          title: 'Reading off the solution set',
          blurb: 'Pivots and free variables.',
          content: [
            { p: 'Once [A | b] is fully reduced, the answer can be read directly. Compare two ranks: r = rank(A) and R = rank[A | b], with n unknowns.' },
            {
              list: [
                '**r < R** — inconsistent. Some row reads 0 = (something non-zero), which is impossible. No solution.',
                '**r = R = n** — exactly one solution. Every variable has a pivot, so nothing is left free.',
                '**r = R < n** — infinitely many. The n − r columns without pivots correspond to free variables.',
              ],
            },
            { p: 'When solutions are infinite, they always have the same shape: one particular solution plus anything in the null space. Set the free variables to zero to get the particular solution; set one free variable to 1 and the rest to 0 to get each direction you can move in without changing Ax.' },
            { formula: 'x = xₚ + t₁v₁ + t₂v₂ + …' },
            { p: 'This is worth reading as a sentence: every solution is the particular solution shifted by something that A sends to zero. The null space is exactly the ambiguity in the answer — and if the null space is trivial, the answer is unique.' },
            { try: { view: 'equations', text: 'Solve a system with a free variable and study the parametric form. Then check that A times each direction really gives zero.' } },
          ],
        },
      ],
    },

    /* ================================================================= *
     * LEVEL 4
     * ================================================================= */
    {
      number: 4,
      id: 'spaces',
      title: 'Vector Spaces',
      summary: 'Span, independence, basis, dimension — the language for talking about "how much room".',
      topics: [
        {
          id: 'span',
          title: 'Span',
          blurb: 'Everything you can build.',
          content: [
            { p: 'Given some vectors, their span is the set of everything you can reach by scaling them and adding the results. It is the smallest subspace containing them.' },
            { formula: 'span{v₁, …, vₖ} = { c₁v₁ + … + cₖvₖ  :  cᵢ any scalars }' },
            { p: 'One non-zero vector in the plane spans a line through the origin. Two non-parallel vectors span the whole plane. Two parallel vectors still span only a line — the second adds nothing, because it was already reachable.' },
            { p: 'The span always contains the origin (take all coefficients zero) and is always closed under addition and scaling. Those two closure properties are the definition of a subspace, and they are what makes spans the natural objects of study rather than arbitrary sets of vectors.' },
            { p: 'Asking whether a particular vector b is in the span of some vectors is exactly asking whether a linear system has a solution. Put the spanning vectors in the columns of a matrix; then b is in the span precisely when Ax = b is consistent. Span questions and system questions are the same questions in different clothes.' },
            { try: { view: 'subspaces', text: 'Use the Independence & span tab to test whether a vector lies in the span of a matrix\'s columns, and see the coefficients that build it.' } },
          ],
        },
        {
          id: 'independence',
          title: 'Linear independence',
          blurb: 'No redundancy.',
          content: [
            { p: 'Vectors are linearly independent when the only way to combine them into the zero vector is to use all-zero coefficients. If some non-trivial combination gives zero, they are dependent — and then at least one of them can be written in terms of the others, so it was redundant.' },
            { formula: 'c₁v₁ + … + cₖvₖ = 0   only when   c₁ = … = cₖ = 0' },
            { p: 'The practical test is a rank computation. Put the vectors in the columns of a matrix and row-reduce. Independent exactly when every column contains a pivot; the columns without pivots are the redundant ones, and the reduced matrix even tells you the exact combination.' },
            {
              list: [
                'Any set containing the zero vector is dependent.',
                'Two vectors are dependent exactly when one is a multiple of the other.',
                'More than n vectors in n-dimensional space must be dependent — there simply is not room.',
                'Independence is about the whole set, not about pairs. Three vectors can be pairwise non-parallel yet still dependent, if they all lie in one plane.',
              ],
            },
            { p: 'That last point catches people out. Independence is not a property you can check two at a time; it is a statement about the set as a whole.' },
            { try: { view: 'subspaces', text: 'Test the columns of [[1,0,1],[0,1,1],[0,0,0]] for independence. MatrixLab will name the exact dependency: v₃ = v₁ + v₂.' } },
          ],
        },
        {
          id: 'basis-dimension',
          title: 'Basis and dimension',
          blurb: 'Exactly enough, and never more.',
          content: [
            { p: 'A basis for a subspace is an independent spanning set: enough vectors to reach everything, with none to spare. Independence stops it from being wasteful, spanning stops it from being incomplete.' },
            { p: 'Every vector in the space has exactly one expression in terms of a given basis. Spanning guarantees at least one; independence guarantees no more than one. That uniqueness is what makes coordinates meaningful.' },
            { p: 'A space has many different bases, but every basis has the same number of vectors. That common number is the dimension. The plane has dimension 2 whether you use the standard axes, two diagonal directions, or anything else independent.' },
            {
              callout: {
                title: 'Why dimension is a theorem, not a definition',
                text: 'It is not obvious that every basis must be the same size — it has to be proved. The proof rests on a counting argument: more than n vectors in a space spanned by n vectors must be dependent. Once established, dimension becomes a reliable way to compare subspaces, and rank–nullity becomes a statement about numbers rather than vectors.',
              },
            },
            { p: 'Choosing a basis is a practical decision. The standard basis is convenient for writing things down, but an orthogonal basis makes projections trivial, and a basis of eigenvectors makes a transformation look diagonal. Much of applied linear algebra is choosing the right basis for the job.' },
            { try: { view: 'subspaces', text: 'Find a basis for the span of some dependent vectors, and watch the redundant ones get left out.' } },
          ],
        },
        {
          id: 'four-subspaces',
          title: 'The four fundamental subspaces',
          blurb: 'Two spaces, each split in two.',
          content: [
            { p: 'An m×n matrix connects two spaces: it takes vectors from ℝⁿ and produces vectors in ℝᵐ. Each of those splits into two pieces, giving four subspaces that between them describe everything the matrix does.' },
            {
              list: [
                '**Column space C(A)** — everything A can produce. Inside ℝᵐ, dimension r.',
                '**Left null space N(Aᵗ)** — what A can never produce. Inside ℝᵐ, dimension m − r.',
                '**Row space R(A)** — the inputs that have an effect. Inside ℝⁿ, dimension r.',
                '**Null space N(A)** — the inputs A destroys. Inside ℝⁿ, dimension n − r.',
              ],
            },
            { p: 'The rank–nullity theorem falls straight out of the reduced matrix. Every column either carries a pivot or it does not: pivot columns contribute to the rank, free columns contribute to the null space, and every column is counted once. So rank + nullity = n. There is nothing more to the theorem than that.' },
            { formula: 'rank(A) + nullity(A) = n' },
            { p: 'The four are also related by perpendicularity. Inside ℝⁿ the row space and null space are orthogonal complements — the reason is immediate once you see that each entry of Ax is a row of A dotted with x, so Ax = 0 says exactly that x is perpendicular to every row. The same argument on Aᵗ relates the column space and the left null space.' },
            { try: { view: 'subspaces', text: 'Open the Four fundamental subspaces tab. Every dot product in the verification section is exactly zero — that is the perpendicularity, proved rather than approximated.' } },
          ],
        },
      ],
    },

    /* ================================================================= *
     * LEVEL 5
     * ================================================================= */
    {
      number: 5,
      id: 'transformations',
      title: 'Linear Transformations',
      summary: 'Matrices as functions: what they do to space, and what they lose.',
      topics: [
        {
          id: 'linear-transformations',
          title: 'What makes a transformation linear',
          blurb: 'Two rules, and everything follows.',
          content: [
            { p: 'A transformation T is linear when it respects addition and scaling: T(u + v) = T(u) + T(v) and T(ku) = k·T(u). That is the entire definition, and everything else in this subject is a consequence.' },
            { p: 'Three things follow immediately. The origin must stay put, because T(0) = T(0·0) = 0·T(0) = 0. Straight lines stay straight. And parallel lines stay parallel, with their spacing scaled uniformly.' },
            { p: 'This rules out a lot. Bending, curving, and translating are all non-linear. A shift of the whole plane by a fixed vector is not linear, because it moves the origin — which is why translations are handled separately, or by moving up a dimension.' },
            {
              callout: {
                title: 'Every linear transformation is a matrix',
                text: 'Here is the fact that makes matrices unavoidable. Write x = x₁e₁ + … + xₙeₙ using the standard basis. Linearity gives T(x) = x₁T(e₁) + … + xₙT(eₙ). So T is completely determined by where it sends the n basis vectors — and putting those n images in the columns of a matrix reproduces T exactly. Columns are destinations, and now you know why.',
              },
            },
            { p: 'The converse holds too: every matrix defines a linear transformation. Matrices and linear transformations are two descriptions of the same thing, and moving between them freely is the point of the whole framework.' },
            { try: { view: 'transformations', text: 'Open the Transformation Visualiser and watch the grid deform. Straight stays straight, parallel stays parallel, and the origin never moves.' } },
          ],
        },
        {
          id: 'geometry-of-2x2',
          title: 'The geometry of a 2×2 matrix',
          blurb: 'Rotation, scaling, reflection, shear, collapse.',
          content: [
            { p: 'Almost all two-dimensional intuition can be built from a handful of recognisable cases, and each is identified by a property rather than by appearance.' },
            {
              list: [
                '**Scaling** — a diagonal matrix. Each axis is stretched independently; the axes are the eigenvector directions.',
                '**Rotation** — orthogonal with determinant 1. Lengths and angles are preserved, and no real direction is fixed.',
                '**Reflection** — orthogonal with determinant −1. Lengths preserved, orientation reversed, and the mirror line is fixed.',
                '**Shear** — determinant 1 but not orthogonal. Areas preserved, shapes distorted, one direction fixed.',
                '**Projection** — idempotent (A² = A). Squashes onto a subspace; determinant 0.',
                '**Collapse** — determinant 0. The plane is flattened onto a line, and the transformation cannot be undone.',
              ],
            },
            { p: 'The determinant summarises the volume side of the story: its magnitude is the area factor and its sign says whether orientation survived. Zero means the transformation is not invertible, and the picture makes clear why — a flattened parallelogram cannot be unflattened.' },
            { p: 'A general matrix is some combination of these effects, and the singular value decomposition later makes that precise: every linear map is a rotation, then an axis-aligned stretch, then another rotation.' },
            { try: { view: 'transformations', text: 'Work through the presets and read the classification MatrixLab reports for each. Then try the morph slider on the rotation.' } },
          ],
        },
        {
          id: 'kernel-image',
          title: 'Kernel and image',
          blurb: 'What is lost, and what is reached.',
          content: [
            { p: 'The kernel (or null space) of a transformation is everything it sends to zero. The image (or range, or column space) is everything it can produce. Between them they say what the transformation loses and what it achieves.' },
            { p: 'A transformation is **one-to-one** exactly when its kernel is trivial — only the zero vector maps to zero. If any non-zero vector maps to zero, then x and x + (that vector) have the same image, so distinct inputs collide.' },
            { p: 'It is **onto** exactly when the image fills the whole target space, which means the rank equals the number of rows.' },
            { formula: 'dim(kernel) + dim(image) = n' },
            { p: 'This is rank–nullity again, now read as a conservation law: the n dimensions of input are split between those that survive into the image and those crushed into the kernel. Nothing is created or destroyed, only allocated.' },
            { p: 'For a square matrix the two conditions coincide: if the kernel is trivial then the rank is full, so the map is onto as well. That is why "invertible", "one-to-one", "onto", "full rank" and "non-zero determinant" are all the same condition for square matrices — and why they come apart for rectangular ones.' },
            { try: { view: 'subspaces', text: 'Compare the null space and column space of a rank-deficient matrix. The dimensions must add up to the number of columns.' } },
          ],
        },
      ],
    },

    /* ================================================================= *
     * LEVEL 6
     * ================================================================= */
    {
      number: 6,
      id: 'orthogonality',
      title: 'Orthogonality',
      summary: 'Perpendicularity, projection, and the best answer when there is no exact one.',
      topics: [
        {
          id: 'dot-product',
          title: 'The dot product',
          blurb: 'Where geometry enters the algebra.',
          content: [
            { p: 'The dot product multiplies matching components and adds them, turning two vectors into a single number. That number carries geometric information that the components alone do not display.' },
            { formula: 'u · v = u₁v₁ + u₂v₂ + … = ‖u‖‖v‖cos θ' },
            { p: 'The second form is the important one. Length comes out of it directly (‖u‖² = u·u), angle comes out of it by rearrangement, and perpendicularity becomes an algebraic condition: u·v = 0.' },
            { p: 'That last point is what lets the idea escape two and three dimensions. "Perpendicular" in ten dimensions has no picture, but u·v = 0 is perfectly meaningful, and it behaves exactly as perpendicularity should. Definitions that generalise are how mathematics travels.' },
            {
              list: [
                'Positive dot product: the angle is less than 90°.',
                'Zero: exactly perpendicular.',
                'Negative: the angle exceeds 90°.',
              ],
            },
            { note: 'Because MatrixLab computes dot products in exact rational arithmetic, "u · v = 0" is a fact rather than a rounding decision. In floating point, testing perpendicularity always means choosing a tolerance.' },
            { try: { view: 'vectors', text: 'Compute the angle between (1,0) and (1,1) — exactly 45°, and cos θ comes out as an exact fraction when the lengths cooperate.' } },
          ],
        },
        {
          id: 'projection',
          title: 'Projection',
          blurb: 'The closest point, and why perpendicular means closest.',
          content: [
            { p: 'The projection of u onto v is the part of u lying along v — the shadow u casts on the line through v. What is left over, u minus the projection, is perpendicular to v.' },
            { formula: 'proj_v(u) = ((u · v)/(v · v)) · v' },
            { p: 'That splitting is the useful part: any vector can be decomposed into a piece along a chosen direction and a piece across it, and the two pieces do not interfere. Because the formula is a ratio of dot products, the result stays exact in rational arithmetic.' },
            { p: 'Projecting onto a whole subspace works the same way, and the characterisation is what matters: the projection is the unique point of the subspace whose error is perpendicular to the entire subspace. If the error had any component along the subspace, you could slide that way and get closer — so perpendicular error means closest point.' },
            { p: 'With an orthogonal basis this is easy: project onto each direction separately and add. With an arbitrary basis you need the matrix P = A(AᵗA)⁻¹Aᵗ, which is more work — and a good reason to make bases orthogonal first.' },
            { try: { view: 'orthogonality', text: 'Project a vector onto a subspace and check the verification: every dot product of the error with the basis is exactly zero.' } },
          ],
        },
        {
          id: 'gram-schmidt',
          title: 'Orthogonal bases and Gram–Schmidt',
          blurb: 'Making a basis perpendicular.',
          content: [
            { p: 'With an arbitrary basis, finding coordinates means solving a linear system. With an orthogonal basis, each coordinate is one dot product: the component along uₖ is (b·uₖ)/(uₖ·uₖ), and it does not depend on any other direction. Nothing needs solving.' },
            { p: 'The Gram–Schmidt process manufactures such a basis. Take the vectors in order, keep the first, and for each later one subtract off its projection onto everything already accepted. What survives cannot have any component along the earlier directions, so it is perpendicular to all of them. Finally, divide each by its length for unit vectors.' },
            { formula: 'uₖ = vₖ − Σᵢ₌₁..ₖ₋₁ proj_{uᵢ}(vₖ),     êₖ = uₖ / ‖uₖ‖' },
            { p: 'If a vector was already in the span of the earlier ones, the subtraction leaves exactly zero. That is not a breakdown — it is the process detecting a dependency, and it tells you precisely which vector was redundant.' },
            {
              callout: {
                title: 'A genuine numerical trap',
                text: 'In floating point, classical Gram–Schmidt loses orthogonality badly when vectors are nearly parallel, because subtracting nearly-equal quantities destroys precision. MatrixLab sidesteps this by working in exact fractions here, and by offering Householder reflections for QR. It is a clean example of why numerical linear algebra exists as a subject.',
              },
            },
            { try: { view: 'orthogonality', text: 'Run Gram–Schmidt on three vectors and read the steps. The orthogonal vectors are exact fractions; only the unit vectors need decimals.' } },
          ],
        },
        {
          id: 'least-squares',
          title: 'Least squares',
          blurb: 'When Ax = b has no solution.',
          content: [
            { p: 'Five data points and a straight line to fit means five equations and two unknowns. Almost always no line passes through all five, so Ax = b has no solution. Instead of giving up, look for the x making Ax as close to b as possible.' },
            { p: 'Ax always lands in the column space of A, whatever x you choose. So the question becomes: which point of that subspace is nearest b? The answer is the perpendicular projection — and "perpendicular" means the error b − Ax must be orthogonal to every column of A.' },
            { formula: 'Aᵗ(b − Ax̂) = 0   ⟹   AᵗA x̂ = Aᵗb' },
            { p: 'Those are the normal equations. They are always consistent, and when the columns of A are independent AᵗA is invertible and the solution is unique. Notice that a fitting problem has become a projection problem, and a projection problem has become a linear system — the same machinery from Level 3, reused.' },
            { p: 'Squares rather than absolute values, because squares make the problem linear and the answer a projection. Other measures of error give other — sometimes better — answers, but they are not solved by linear algebra.' },
            { p: 'This calculation is linear regression. The columns of A are the features, b is the target, and x̂ = (AᵗA)⁻¹Aᵗb is the vector of fitted weights. Much of machine learning starts here.' },
            { try: { view: 'least-squares', text: 'Fit a line to data and look at the dashed residuals in the plot — least squares makes the sum of their squares as small as possible.' } },
          ],
        },
      ],
    },

    /* ================================================================= *
     * LEVEL 7
     * ================================================================= */
    {
      number: 7,
      id: 'eigenvalues',
      title: 'Eigenvalues and Eigenvectors',
      summary: 'The directions a transformation leaves alone, and what they reveal.',
      topics: [
        {
          id: 'eigen-idea',
          title: 'The idea',
          blurb: 'Directions that only stretch.',
          content: [
            { p: 'Most vectors change direction when a matrix acts on them. An eigenvector is one of the rare directions that does not: the matrix only stretches or shrinks it. The stretch factor is the eigenvalue.' },
            { formula: 'A v = λ v,   v ≠ 0' },
            { p: 'The requirement v ≠ 0 matters, since A·0 = λ·0 holds for every λ and would make the definition vacuous. Eigenvalues, on the other hand, are allowed to be zero — an eigenvalue of 0 means some non-zero direction is crushed to nothing, which is exactly a non-trivial null space.' },
            { p: 'Eigenvectors are never unique: scaling one gives another eigenvector with the same eigenvalue. What is really determined is a direction — or more precisely a whole eigenspace, the set of all vectors satisfying Av = λv for that λ.' },
            { p: 'Not every matrix has real eigenvectors. A rotation sends no direction to a multiple of itself, so it has none — and correspondingly its eigenvalues are complex. That is not a defect; it is the algebra correctly reporting the geometry.' },
            { try: { view: 'visualizations', text: 'Open the Eigenvector visualisation and sweep the probe slider. Watch for the angles where v and Av line up — those are the eigenvector directions.' } },
          ],
        },
        {
          id: 'characteristic-polynomial',
          title: 'The characteristic polynomial',
          blurb: 'Turning a matrix question into a root-finding question.',
          content: [
            { p: 'Rewrite Av = λv as (A − λI)v = 0. A non-zero solution exists only when A − λI squashes something to zero — that is, only when A − λI is singular. So the eigenvalues are exactly the λ making det(A − λI) = 0.' },
            { formula: 'p(λ) = det(A − λI) = 0' },
            { p: 'Expanding the determinant gives a polynomial of degree n. For a 2×2 matrix it is memorably short: λ² − tr(A)λ + det(A). The eigenvalues are its roots.' },
            { p: 'Two identities come free and make excellent checks. The eigenvalues sum to the trace, and multiply to the determinant. Both are quick to compute independently of the eigenvalues themselves, so they catch mistakes reliably — MatrixLab reports both every time.' },
            {
              callout: {
                title: 'What is honestly possible',
                text: 'MatrixLab computes the polynomial exactly, then finds rational roots exactly by the rational root theorem, which covers essentially every textbook example. A leftover quadratic is solved in closed form, so irrational and complex eigenvalues appear as √ and i expressions rather than decimals. Only a leftover cubic or higher falls back to a numerical solver — because degree 5 and above genuinely has no formula in radicals — and when that happens the result is labelled approximate.',
              },
            },
            { note: 'The characteristic polynomial is the right tool for understanding and for small matrices, but it is a poor way to compute eigenvalues numerically: tiny changes in the coefficients can move the roots a long way. Serious software uses QR iteration on the matrix directly.' },
            { try: { view: 'eigen', text: 'Compute eigenvalues of [[1,1],[1,0]] and see the golden ratio appear as an exact surd, not a decimal.' } },
          ],
        },
        {
          id: 'multiplicity',
          title: 'Multiplicity and defective matrices',
          blurb: 'When a repeated eigenvalue is a problem, and when it is not.',
          content: [
            { p: 'A repeated root of the characteristic polynomial has algebraic multiplicity greater than 1. The dimension of its eigenspace is its geometric multiplicity. Geometric never exceeds algebraic, but it can fall short.' },
            { p: 'The identity matrix has eigenvalue 1 with algebraic multiplicity n — and a full n-dimensional eigenspace, so geometric multiplicity n too. A repeated eigenvalue is not automatically trouble.' },
            { p: 'The shear [[1, 1], [0, 1]] tells a different story. Its eigenvalue 1 is doubled, but every eigenvector points along the x-axis: the eigenspace is only one-dimensional. Such a matrix is called defective, and it cannot be diagonalised — there are simply not enough independent eigenvectors to build a basis.' },
            { p: 'The gap between the two multiplicities is the defect, and it is exactly what obstructs diagonalisation. Defective matrices still have a canonical form — the Jordan form, with eigenvalues on the diagonal and 1s just above it — though MatrixLab does not compute Jordan forms.' },
            { try: { view: 'eigen', text: 'Compare [[3,0],[0,3]] and [[1,1],[0,1]]. Both have a repeated eigenvalue; only one is diagonalisable.' } },
          ],
        },
        {
          id: 'diagonalization',
          title: 'Diagonalisation',
          blurb: 'Choosing the basis in which a matrix is simple.',
          content: [
            { p: 'If A has n independent eigenvectors, put them in the columns of P and the matching eigenvalues down the diagonal of D. Then AP = PD, and since independent columns make P invertible, A = PDP⁻¹.' },
            { formula: 'A = P D P⁻¹' },
            { p: 'Read this as a change of basis. P⁻¹ translates into eigenvector coordinates, D does nothing but stretch each axis by its eigenvalue, and P translates back. In the right coordinate system, a diagonalisable matrix is no more complicated than a list of scale factors.' },
            { p: 'The immediate payoff is powers. Aᵏ = PDᵏP⁻¹, and raising a diagonal matrix to a power just raises each diagonal entry. A calculation that would need k matrix multiplications becomes a handful of scalar powers.' },
            { p: 'That is not merely a computational trick. It tells you the long-run behaviour of a repeated process: whichever eigenvalue has the largest magnitude eventually dominates, so the state drifts towards its eigenvector and grows by roughly that factor each step. Population models, Markov chains, and the stability of physical systems are all read off this way.' },
            {
              callout: {
                title: 'Symmetric matrices are the best case',
                text: 'A real symmetric matrix is always diagonalisable, always has real eigenvalues, and its eigenvectors can always be chosen perpendicular. So P can be taken orthogonal, which makes P⁻¹ = Pᵗ and the whole factorisation trivially invertible. This is the spectral theorem, and it is why symmetric matrices appear wherever people have a choice.',
              },
            },
            { try: { view: 'eigen', text: 'Diagonalise [[4,1],[2,3]] and check that PDP⁻¹ reproduces A exactly — rational eigenvalues make the whole factorisation exact.' } },
          ],
        },
      ],
    },

    /* ================================================================= *
     * LEVEL 8
     * ================================================================= */
    {
      number: 8,
      id: 'advanced',
      title: 'Factorisations and Applications',
      summary: 'Rewriting a matrix as a product of simple ones — and what that buys.',
      topics: [
        {
          id: 'why-factorise',
          title: 'Why factorise at all?',
          blurb: 'Three easy kinds of matrix.',
          content: [
            { p: 'Some matrices are easy to work with. Triangular systems solve by substitution. Orthogonal matrices invert by transposing. Diagonal matrices raise to powers entry by entry. Every factorisation in this level expresses a general matrix in terms of those easy kinds.' },
            {
              list: [
                '**A = LU** — two triangular factors. Fast repeated solves, and determinants.',
                '**PA = LU** — the same with row swaps allowed. Exists for every square matrix.',
                '**A = QR** — orthonormal times triangular. Stable least squares.',
                '**A = LLᵗ** — Cholesky, for symmetric positive definite matrices. Half the work of LU.',
                '**A = UΣVᵗ** — the SVD. Exists for absolutely every matrix.',
                '**A = PDP⁻¹** — diagonalisation, when enough eigenvectors exist.',
              ],
            },
            { p: 'The pattern is a trade between generality and cost. LU is cheapest but needs a square matrix and no zero pivots. Cholesky is cheaper still but demands symmetry and positive definiteness. QR gives up exactness for stability. SVD asks for nothing and tells you the most, and costs the most to compute.' },
            { try: { view: 'decompositions', text: 'Open the "Which one when?" tab for a side-by-side comparison, then try each factorisation on the same matrix.' } },
          ],
        },
        {
          id: 'lu-qr',
          title: 'LU and QR',
          blurb: 'Elimination and orthogonalisation, written as products.',
          content: [
            { p: 'LU is Gaussian elimination with the bookkeeping kept. U is the echelon form; L records the multipliers used to get there. Nothing new happens — LU is a filing system for work you were doing anyway.' },
            { p: 'The value is reuse. Solving Ax = b becomes solve Ly = b downwards, then Ux = y upwards: two quick triangular solves. With twenty right-hand sides and the same A, you factor once instead of eliminating twenty times. Determinants come free as the product of U’s diagonal.' },
            { p: 'Plain LU fails when a pivot is zero, and behaves badly in floating point when a pivot is merely small. Real implementations always pivot, which is why PA = LU is the version in every numerical library.' },
            { p: 'QR takes a different route: replace the columns of A by an orthonormal set Q spanning the same space, and record in R how to rebuild the originals. R comes out upper triangular because column k of A needs only the first k orthonormal directions — exactly the order Gram–Schmidt works in.' },
            { p: 'QR is the stable way to do least squares. Substituting A = QR reduces the normal equations to Rx = Qᵗb, one triangular solve, without ever forming AᵗA — which matters because AᵗA squares the condition number and can throw away half your precision.' },
            { try: { view: 'decompositions', text: 'Compare Householder and Gram–Schmidt QR on the same matrix and look at how close QᵗQ is to the identity in each case.' } },
          ],
        },
        {
          id: 'svd',
          title: 'Singular value decomposition',
          blurb: 'The factorisation that always exists.',
          content: [
            { p: 'Every matrix — any shape, any rank — can be written as UΣVᵗ with U and V orthogonal and Σ diagonal with non-negative entries. No conditions, no exceptions. That universality is what makes the SVD the most useful factorisation in applied mathematics.' },
            { formula: 'A = U Σ Vᵗ' },
            { p: 'Read geometrically: Vᵗ rotates, Σ stretches each axis by a singular value, U rotates again. So every linear map, however complicated, is a rotation, then an axis-aligned stretch, then another rotation. The singular values say how much stretching happens, and in which principal directions.' },
            { p: 'The number of non-zero singular values is the rank. Unlike counting pivots, this degrades gracefully: a singular value of 10⁻⁸ tells you the matrix is nearly rank deficient, which exact elimination would never reveal. The ratio σ₁/σ_min is the condition number, predicting how much precision a linear solve will lose.' },
            { p: 'Keeping only the largest few singular values gives the best possible approximation of that rank — the Eckart–Young theorem, and the error is exactly the tail of the singular values you discarded. This one fact underlies image compression, noise reduction, recommender systems, and principal component analysis.' },
            { note: 'MatrixLab computes the SVD by one-sided Jacobi rotation: pairs of columns are rotated until mutually perpendicular, at which point the column lengths are the singular values. It is slower than the algorithms in LAPACK but short and accurate, and the reported reconstruction error lets you verify it rather than trust it.' },
            { try: { view: 'decompositions', text: 'Compute the SVD of a rank-1 matrix like [[1,2],[2,4]] and watch the second singular value come out as zero. Then try the low-rank approximation slider.' } },
          ],
        },
        {
          id: 'applications',
          title: 'Where this all goes',
          blurb: 'The same few ideas, everywhere.',
          content: [
            { p: 'Linear algebra earns its central place because a small number of ideas keep reappearing in unrelated fields. It is worth naming a few, because recognising the pattern is more useful than any single application.' },
            {
              list: [
                '**Least squares fitting.** Regression in statistics and machine learning is projection onto a column space. Everything later — regularisation, feature engineering, generalised linear models — is a variation on it.',
                '**Principal component analysis.** The SVD of a centred data matrix finds the directions of greatest variance. Dimensionality reduction, compression and visualisation all follow.',
                '**Markov chains and steady states.** A transition matrix has eigenvalue 1, and its eigenvector is the long-run distribution. PageRank was this observation applied at scale.',
                '**Differential equations.** Diagonalising a linear system decouples it into independent scalar equations. The eigenvalues determine whether solutions grow, decay or oscillate.',
                '**Computer graphics.** Rotations, scalings and projections are matrices; composing them is matrix multiplication. Homogeneous coordinates make translation linear too.',
                '**Numerical stability.** The condition number, from the SVD, predicts how much precision a computation will lose — often the difference between a working program and a subtly wrong one.',
              ],
            },
            { p: 'The common thread is that linear problems are the ones we can actually solve completely. So a great deal of applied mathematics consists of approximating something complicated by something linear, solving that exactly, and then quantifying the error. Calculus does this locally with derivatives; linear algebra is what you do with the result.' },
            {
              callout: {
                title: 'Where to go next',
                text: 'Natural next steps are numerical linear algebra (how these algorithms behave in floating point, and why QR iteration replaced characteristic polynomials), the spectral theorem and quadratic forms, and abstract vector spaces, where "vector" stops meaning a list of numbers and starts meaning anything obeying the same rules — including functions, which is where Fourier analysis begins.',
              },
            },
          ],
        },
      ],
    },
  ];

  ML.lessons = {
    levels: LEVELS,

    topicCount: LEVELS.reduce(function (total, level) { return total + level.topics.length; }, 0),

    findTopic: function (topicId) {
      for (let i = 0; i < LEVELS.length; i++) {
        const level = LEVELS[i];
        for (let j = 0; j < level.topics.length; j++) {
          if (level.topics[j].id === topicId) {
            return { level: level, topic: level.topics[j], levelIndex: i, topicIndex: j };
          }
        }
      }
      return null;
    },

    /** Flat ordering, for previous/next navigation. */
    flat: function () {
      const out = [];
      LEVELS.forEach(function (level) {
        level.topics.forEach(function (topic) { out.push({ level: level, topic: topic }); });
      });
      return out;
    },
  };
})((globalThis.ML = globalThis.ML || {}));
