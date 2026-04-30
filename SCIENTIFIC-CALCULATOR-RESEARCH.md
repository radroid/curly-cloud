# Scientific Calculator — Wolfram Feature Research

**Purpose.** Grounding document for adding a Scientific Calculator mode to the existing Mac OS 1984–themed Calculator app (`app/components/apps/calculator.tsx`). Captures the universe of capabilities surveyed across Wolfram Alpha and the Wolfram Language so we can pick a coherent v1 scope and a future roadmap.

**Companion file.** Raw search excerpts and per-category source URLs live in `SCIENTIFIC-CALCULATOR-SOURCES.md`. Use it whenever you need to verify a claim or look up an example query.

**How to read this doc.**
- §1 — full feature universe (what Wolfram does), grouped by category.
- §2 — feasibility tiers for our app (what's realistic in pure-JS, in-browser, no API calls).
- §3 — proposed v1 / v2 / v3 scope.
- §4 — UX considerations specific to the existing Mac 1984 theme.
- §5 — open questions for the user.

---

## 1. Feature Universe (Wolfram-derived)

Each entry lists the category, what Wolfram offers, and concrete example operations.

### 1.1 Elementary Arithmetic & Numbers
- Basic arithmetic (`+ − × ÷`), parentheses, order of operations
- Powers, roots (square, cube, nth)
- Reciprocals, percentages, absolute value, sign
- Factorial, double factorial
- Floor, ceiling, round, truncate, fractional part
- Min / max / range across a list

### 1.2 Fractions
- Convert decimals ↔ fractions; simplify improper → mixed
- Add / subtract / multiply / divide fractions exactly
- Pie-chart / tape-diagram visualization (Wolfram-only; not for v1)
- **Continued fractions:** rational approximations, expansion of irrationals

### 1.3 Number Theory
- Prime factorization (`FactorInteger`)
- Primality test, next prime, prime counting
- GCD, LCM (pairs and lists)
- Divisors of a number, divisor sum
- Modular arithmetic (`a mod n`, modular inverse, modular exponent)
- Base conversions (binary, octal, decimal, hex, arbitrary base via `b^^digits`)

### 1.4 Algebra
- Solve equations (single var, multi-var, symbolic + numeric)
- Polynomial operations: expand, factor, divide, GCD/LCM of polynomials
- Roots of polynomials, partial fraction decomposition
- Simplify / rewrite expressions; complete the square
- Rational function manipulation
- Systems of equations

### 1.5 Trigonometry
- `sin cos tan csc sec cot` and inverses (degrees and radians)
- Hyperbolic: `sinh cosh tanh` and inverses
- Identity expansion (`expand sin 4x`, `expand sin(x+y+z)`)
- Triangle solving (SSS, SAS, ASA, SSA — laws of sines/cosines)
- Polar ↔ rectangular coordinate conversion

### 1.6 Logarithms & Exponentials
- Natural log (`ln`), log base 10, log base 2, log base b
- Exponential `e^x`, general `a^b`
- Logarithmic plotting (Wolfram-only)

### 1.7 Calculus & Analysis
- **Derivatives:** ordinary, partial, higher-order; with step-by-step rules (power, product, quotient, chain)
- **Integrals:** indefinite, definite, multi-variable; symbolic + numeric
- **Limits:** at a point, at infinity, one-sided
- **Series:** Taylor / Maclaurin expansion, convergence tests
- **Sums:** finite, infinite, indexed, geometric series closed forms
- **Differential equations:** ODEs of any order, with initial conditions
- **Vector calculus:** gradient, divergence, curl, line/surface integrals
- **Integral transforms:** Laplace, Fourier
- Domain, range, continuity analysis

### 1.8 Linear Algebra & Matrices
- Matrix add / subtract / multiply, scalar multiply
- Transpose, trace, determinant
- Inverse (and pseudoinverse for non-square)
- Eigenvalues, eigenvectors
- Rank, null space, reduced row echelon form (RREF)
- Solve `Ax = b`
- Vector ops: dot, cross, norm, projection
- Quaternions

### 1.9 Complex Numbers
- Rectangular form `a + bi`, polar form `r e^(iθ)`
- `Re`, `Im`, `Abs` (magnitude), `Arg` (phase), `Conjugate`
- Convert rectangular ↔ polar (`AbsArg`, `FromPolarCoordinates`)
- All elementary ops, powers, roots, transcendentals on complex inputs
- Phasor arithmetic (useful for EE: `100 e^(i 45°) + 25 e^(i 30°)`)

### 1.10 Statistics
- **Descriptive:** mean, median, mode, variance, std dev, range, IQR, quartiles, skewness, kurtosis, outliers
- **Distributions:** normal, binomial, Poisson, exponential, uniform, t, χ², F, beta, gamma, log-normal, geometric — PDF / CDF / inverse CDF, moments
- **Regression:** linear, polynomial, exponential, logarithmic fit with diagnostics
- **Inference:** confidence intervals, hypothesis tests, p-values, sample-size estimation
- **Data viz:** histograms, box plots, scatter plots (Wolfram-only)

### 1.11 Probability
- Coin / dice / card / lottery / poker probability
- Birthday problem and similar combinatorial scenarios
- Combinations `C(n,k)`, permutations `P(n,k)`
- Conditional probability, Bayes
- Expected value, variance from a distribution
- Random sampling

### 1.12 Sequences & Series
- Arithmetic, geometric, Fibonacci, Lucas
- Pattern recognition for incompletely specified sequences
- nth term formulas, partial sums, convergence
- Recurrence relations

### 1.13 Units & Physical Constants
- Convert between thousands of units across SI / US / historical systems
- Unit-aware arithmetic, dimensional analysis
- Physical constants (c, G, h, ℏ, k_B, N_A, ε₀, μ₀, e, m_e, m_p, …)

### 1.14 Financial
- Compound interest (varying compounding frequency)
- Loan / mortgage payment schedules, amortization
- Time-value-of-money: PV, FV, annuities

### 1.15 Plotting (out of scope for v1, noted for future)
- 2D function plots, parametric, polar, contour
- 3D surface plots
- Step-by-step solution rendering

---

## 2. Feasibility Tiers (Pure JS, In-Browser)

Tier scale: **A** = trivial in JS / one-liner with a small library, **B** = doable with a focused library or modest custom code, **C** = needs a heavy library (e.g., `mathjs`, `nerdamer`, `ml-matrix`), **D** = effectively requires a server / WASM CAS (e.g., SymPy via Pyodide, or Wolfram API).

| Category | Tier | Notes |
| --- | --- | --- |
| Elementary arithmetic | A | Already implemented; needs richer expression parser. |
| Trig / log / exp | A | Native `Math.*`. Hyperbolic in `Math` too. |
| Fractions (exact) | A/B | `mathjs` `Fraction`, or hand-rolled BigInt-backed. |
| Continued fractions | B | Small algorithm, no library needed. |
| Number theory (primes, GCD, factorization) | A/B | Hand-rolled trial division up to ~10^12 in JS. |
| Base conversions | A | `Number.toString(base)` for bases 2–36 + custom display. |
| Complex numbers | A/B | `mathjs` `Complex` or hand-rolled. |
| Matrices, determinants, inverse | B | `mathjs` covers it; eigenvalues need `ml-matrix` or numeric.js. |
| Eigenvalues / SVD | C | Stable algorithms are non-trivial. |
| Statistics (descriptive, distributions PDF/CDF) | B | `simple-statistics` or `jstat` or `mathjs`. |
| Regression (linear / polynomial) | B | `simple-statistics` / `ml-regression`. |
| Probability (combinatorics) | A | Trivial closed-form. |
| Sums / series (closed-form numeric) | B | Numeric works; symbolic needs CAS. |
| Symbolic algebra (expand, factor, simplify) | C/D | `nerdamer` is the lightest option; limited vs. SymPy. |
| Symbolic derivatives | C | `nerdamer` / `mathjs` `derivative`. |
| Symbolic integrals | D | `nerdamer` covers some; full coverage is research-grade. |
| Limits | C/D | Best-effort with `nerdamer`; many cases require CAS. |
| ODEs | D | Realistically need a CAS. |
| Unit conversion | B | `mathjs` units; or a curated unit table. |
| Physical constants | A | Static table. |
| Financial (compound interest, amortization) | A | Closed-form. |
| Plotting | B | Function plotter is straightforward; reuse later if Graph app is desired. |

**Recommended core library: `mathjs`** — it covers expression parsing, fractions, complex, matrices, units, basic symbolic derivatives, and statistics in one ~150 KB (gzipped) bundle. Tradeoff: that's significant for a "coming soon" portfolio site, so we should code-split the scientific mode and lazy-load it.

---

## 3. Proposed Scope

Ladder the scope so each tier is shippable on its own.

### v1 — "Solid Scientific" (target for this branch)
Match a TI-30X-style scientific calculator. All Tier A / lightweight B features.
- Mode toggle in the calculator window (Standard ↔ Scientific)
- Expression-style input (typed line) **and** button entry
- **Trig** (sin/cos/tan + inverses + hyperbolic), DEG / RAD / GRAD switch
- **Log/exp** (ln, log₁₀, log₂, eˣ, 10ˣ, 2ˣ, yˣ)
- **Powers & roots** (x², x³, xʸ, √, ∛, ʸ√x)
- **Constants** (π, e, φ, basic physical constants)
- **Memory** (M+, M−, MR, MC) and **history** (last 5–10 results, tap to insert `Ans`)
- **Factorial, nCr, nPr, |x|, mod, gcd, lcm**
- **Fractions** (a b/c entry, exact arithmetic, decimal ↔ fraction toggle)
- **Base conversion** (DEC / BIN / OCT / HEX) with bitwise AND/OR/XOR/NOT/shift
- **Complex numbers** in rectangular form, with polar display toggle

### v2 — "Stats & Calc Lite"
- **Stats panel:** enter a list, get mean / median / σ / variance / quartiles; linear regression on (x,y) pairs
- **Distributions:** normal / binomial / Poisson PDF, CDF, inverse CDF
- **Probability helpers:** combinations, permutations, dice/coin shortcuts
- **Numeric calculus:** definite integral (Simpson's rule), numeric derivative at a point, root finding (Newton/bisection)
- **Unit conversion** (length, mass, time, temperature, energy, pressure, common engineering units)
- **Financial:** compound interest, loan payment, amortization table

### v3 — "Symbolic & Matrices"
- **Matrices:** entry grid, det, inverse, multiply, transpose, RREF, solve `Ax=b`, eigenvalues for ≤ 4×4
- **Symbolic algebra (best-effort with `nerdamer`):** simplify, expand, factor, symbolic derivative, symbolic indefinite integral where supported, equation solver
- **Function plotter** (small inline canvas) — reuses code that may also feed a future Graph app
- **Sequences/series:** arithmetic & geometric helpers, Fibonacci, basic closed-form sums

### Explicitly Out of Scope
- ODEs, Laplace/Fourier transforms, full CAS — would require a Pyodide/SymPy or remote API approach. Worth a "Powered by Wolfram" link in the menu instead.
- Step-by-step solution rendering — Wolfram's edge; we shouldn't try to mimic.

---

## 4. UX Notes (Mac OS 1984 Theme)

- The current Standard calculator is **4 cols × 5 rows**. Scientific needs ~6–7 cols × 8–10 rows. Either the window grows in scientific mode (preferred — matches real Mac behavior of changing window size when switching modes) or we add modal "pages" of buttons (cluttered).
- Stick to **Chicago bitmap font**, 1px black borders, white background, 2px borders for operator/function keys. No colors beyond black/white/gray crosshatch.
- Mode switch lives in the **menu bar** (`View > Standard / Scientific`) — period-correct. Persist mode in `localStorage`.
- Expression-style input line above the existing display: small Chicago text showing the in-progress expression, big Chicago text for the result.
- History is a small scrollable region or a `Window > History` palette window.
- Keyboard support should expand: `s/c/t` for sin/cos/tan with shift for inverse, `^` for power, `!` for factorial, `(` `)` etc.
- `useReducedMotion` already exists — respect it for any new transitions (e.g., mode switch).

---

## 5. Decisions Log

### Resolved (round 1)

1. **Math library / bundle strategy** — **Lazy-load `mathjs`** only when the Calculator app is opened *and* the user enters Scientific mode. The "coming soon" landing page and Standard mode must not pay the bundle cost. Rationale: only some users will open Scientific, so the page-load budget for the rest of the site is preserved.
2. **PR scope** — **Ship the full feature set in one PR**, not split across multiple. The original product ask spans fractions → integration/derivatives → statistics → probability → complex numbers, and we will deliver all of it together.
3. **Window resize on mode switch** — **Low priority.** Don't invest in animated resize; pick a single larger fixed `defaultSize` for Scientific mode and leave it at that.

### Open (round 2 — pending answers)

See the chat thread for the round-2 questions; once answered they will move into "Resolved" above.

---

## 6. Source Map

Detailed source URLs and raw search excerpts → `SCIENTIFIC-CALCULATOR-SOURCES.md`.

Top-level Wolfram entry points (all paywalled to direct fetch but reachable via search):

- Mathematics index — https://www.wolframalpha.com/examples/mathematics/
- Calculus & Analysis — https://www.wolframalpha.com/examples/mathematics/calculus-and-analysis
- Algebra — https://www.wolframalpha.com/examples/mathematics/algebra
- Statistics — https://www.wolframalpha.com/examples/mathematics/statistics
- Probability — https://www.wolframalpha.com/examples/mathematics/probability
- Number Theory & Numbers — https://www.wolframalpha.com/examples/mathematics/numbers
- Trigonometry — https://www.wolframalpha.com/examples/mathematics/trigonometry
- Matrices — https://www.wolframalpha.com/examples/mathematics/algebra/matrices
- Complex Numbers — https://www.wolframalpha.com/examples/mathematics/numbers/complex-numbers
- Continued Fractions — https://www.wolframalpha.com/examples/mathematics/number-theory/continued-fractions/
- Base Conversions — https://www.wolframalpha.com/examples/mathematics/numbers/base-conversions
- Sequences & Sums — https://www.wolframalpha.com/examples/mathematics/calculus-and-analysis/sums
- Units & Measures — https://www.wolframalpha.com/examples/science-and-technology/units-and-measures
- Physical Constants — https://www.wolframalpha.com/examples/science-and-technology/physics/physical-constants
- Mortgages & Loans — https://www.wolframalpha.com/examples/everyday-life/personal-finance/mortgages-and-loans

Wolfram Language reference (for behavior to mirror):
- Complex Numbers — https://reference.wolfram.com/language/guide/ComplexNumbers.html
- Descriptive Statistics — https://reference.wolfram.com/language/guide/DescriptiveStatistics.html
- Matrices and Linear Algebra — https://reference.wolfram.com/language/guide/MatricesAndLinearAlgebra.html
- Units & Quantities — https://reference.wolfram.com/language/guide/Units.html
- Continued Fractions & Rational Approximations — https://reference.wolfram.com/language/guide/ContinuedFractionsAndRationalApproximations.html
