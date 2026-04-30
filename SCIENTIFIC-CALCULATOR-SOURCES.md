# Scientific Calculator Research — Sources & Raw Excerpts

Companion to `SCIENTIFIC-CALCULATOR-RESEARCH.md`. This file preserves the raw search-result excerpts and source URLs that the grounding doc was distilled from, so the next agent (or a reviewer) can verify any specific claim without re-running the searches.

> **Method:** Wolfram Alpha pages return HTTP 403 to direct fetches. All material below was gathered via WebSearch summaries against `wolframalpha.com`, `reference.wolfram.com`, and `mathworld.wolfram.com`. Quotes are paraphrased summaries from the search-result snippets, not direct page captures.

---

## 1. Top-level Mathematics Index

**Source:** https://www.wolframalpha.com/examples/mathematics/

Categories listed by Wolfram on the math index:
- Elementary Math
- Algebra
- Calculus & Analysis
- Geometry
- Number Theory
- Discrete Mathematics
- Applied Mathematics
- Logic
- Mathematical Functions
- Plotting & Graphics
- Advanced Mathematics
- Definitions
- Famous Problems
- Continued Fractions
- Common Core Math

---

## 2. Calculus & Analysis

**Source:** https://www.wolframalpha.com/examples/mathematics/calculus-and-analysis

> "Wolfram Alpha provides calculus and analysis calculators with answers for **integrals, derivatives, limits, sequences, sums, products, series expansions, vector analysis, integral transforms, domain and range, and continuity**."

### Derivatives
**Source:** https://www.wolframalpha.com/examples/mathematics/calculus-and-analysis/derivatives/

> "Determining the differentiability of a function, calculating derivatives of trigonometric, logarithmic, exponential, polynomial and many other expressions. Step-by-step solutions using the **power, product, quotient, or chain rule**, including derivatives via the **limit definition**."

### Integrals
**Source:** https://www.wolframalpha.com/calculators/integral-calculator/

> "Compute **definite and indefinite integrals** of functions, integrating with respect to one or more variables."

### Limits
> "Explore the limit behavior of a function as it approaches a single point or **asymptotically approaches infinity**."

### Differential Equations
> "Solve differential equations of any order, examine solutions and plots of the solution families, and **specify initial conditions** to find exact solutions. Examples: `y' = y^2 x`, `y'' + y = sin(2x)`."

### Sums
**Source:** https://www.wolframalpha.com/examples/mathematics/calculus-and-analysis/sums

> "Compute an **indexed sum, sum an incompletely specified sequence, sum geometric series, sum over all integers, and test sum convergence**."

---

## 3. Algebra

**Source:** https://www.wolframalpha.com/examples/mathematics/algebra

> "Solving equations, exploring polynomials, studying fields, groups, vectors and matrices."

### Equation Solving
> "Solve equations in one or more variables both **symbolically and numerically**. Plots equations and their solutions."

### Polynomials
**Source:** https://www.wolframalpha.com/examples/mathematics/algebra/polynomials

> "Compute properties of polynomials including **extrema, roots, alternate forms, symmetry and parity**. Polynomials can be **factored, expanded or divided**. Expand using FOIL; factorize quadratics and higher; **complete the square**."

### Simplification
**Source:** https://www.wolframalpha.com/examples/mathematics/algebra/simplification

> "Multiplies, divides and finds **GCDs of pairs of polynomials**; determines values of polynomial roots; plots polynomials; finds **partial fraction decompositions**."

---

## 4. Statistics

**Source:** https://www.wolframalpha.com/examples/mathematics/statistics

> "Compute all manner of **descriptive and inferential statistical properties**, produce **regression analyses and equation fitting**, and analyze, interpret and visualize data."

### Descriptive Statistics
**Source:** https://www.wolframalpha.com/examples/mathematics/statistics/descriptive-statistics

> "**Measures of central tendency** (mean, median, mode), **dispersion** (variance, standard deviation), **skewness, kurtosis, outliers**."

### Regression
**Source:** https://www.wolframalpha.com/examples/mathematics/statistics/regression-analysis

> "Fit a **line, polynomial, exponential or logarithmic** model to data. Compute, diagnose and visualize the resulting regression model."

### Statistical Inference
**Source:** https://www.wolframalpha.com/examples/mathematics/statistics/statistical-inference

> "Compute the **validity of hypotheses, sample sizes** required for valid conclusions, and **confidence intervals**."

### Distributions
> "Descriptive measures, transformations, basic clustering, statistical distributions, parameter estimation and hypothesis testing."

---

## 5. Probability

**Source:** https://www.wolframalpha.com/examples/mathematics/probability

> "Compute the chances of winning various games driven by random chance, conduct and analyze experimental outcomes of random trials, **visualize and compute properties of probability distributions** and calculate event probabilities."

### Games of Chance
**Source:** https://www.wolframalpha.com/examples/mathematics/probability/games-of-chance

> "Coin tosses, **poker hands**, **lottery numbers**, dice rolls."

### Dice
**Source:** https://www.wolframalpha.com/examples/mathematics/probability/games-of-chance/dice/

> "Compute dice probabilities for **standard and non-cubical dice**; find probability of a specified outcome or **waiting-time** probability."

### Probability Distributions
**Source:** https://www.wolframalpha.com/examples/mathematics/probability/probability-distributions

> "Computational knowledge of **discrete probability mass functions and continuous probability distribution functions**. Visualize relative probabilities and compute **moments, expected values, standard deviations**. The **binomial distribution** distributes probability among the possible counts of heads in n flips with single-flip probability p."

---

## 6. Numbers, Fractions, Number Theory, Bases

### Number Type Arithmetic
**Source:** https://www.wolframalpha.com/examples/mathematics/numbers/number-type-arithmetic

### Fractions
**Source:** https://www.wolframalpha.com/examples/mathematics/elementary-math/fractions

> "Basic arithmetic on fractions, **converting between fractions and decimals**, simplifying improper fractions to **mixed fractions**. Addition, subtraction, multiplication and division on fractions. Visualize fractions with pie charts and tape diagrams."

### Continued Fractions
**Source:** https://www.wolframalpha.com/examples/mathematics/number-theory/continued-fractions/

> "The continued fraction representation `{a1,a2,a3,…}` corresponds to `a1 + 1/(a2 + 1/(a3 + …))`. **Rational numbers → finite** continued fractions; **irrationals → infinite**. Knowledge about symbolic continued fractions, related theorems and algorithms."

### Prime Numbers / Divisors
**Source:** https://www.wolframalpha.com/examples/mathematics/number-theory/prime-numbers
**Source:** https://www.wolframalpha.com/examples/mathematics/number-theory/divisors

> "**Prime factorization** via `FactorInteger[n]` (returns list of pairs). **GCD** (e.g. `gcd(56, 24)`, `gcd({12, 45, 72})`), **LCM** (e.g. `lcm(90, 342)`). Check primality, generate primes, lists of primes meeting conditions."

### Base Conversions
**Source:** https://www.wolframalpha.com/examples/mathematics/numbers/base-conversions

> "Algorithmic understanding of non-decimal number systems. Conversions: **binary↔hex**, **decimal→base 2/16**. Use `0x` prefix for hex input. **`base^^digits`** notation for arbitrary bases; for bases > 10, digits use letters a–z."

### Complex Numbers
**Source:** https://www.wolframalpha.com/examples/mathematics/numbers/complex-numbers
**Source:** https://reference.wolfram.com/language/guide/ComplexNumbers.html

> "Operations: **`Abs` (magnitude), `Arg` (phase angle in radians), `Conjugate`**. **`AbsArg[z]`** returns `{Abs[z], Arg[z]}`. Polar form `z = r(cos θ + i sin θ)`. **`FromPolarCoordinates`**, **`ToPolarCoordinates`**. Phasor input examples: `30 + 45i`, `100 e^(i 45 deg) + 25 e^(i 30 deg)`."

---

## 7. Trigonometry

**Source:** https://www.wolframalpha.com/examples/mathematics/trigonometry

> "Solving for missing measurements of triangles, evaluating trigonometric functions, manipulating trigonometric expressions. **Sine, cosine, tangent, secant, cosecant, cotangent**. Identity expansion: `expand sin 4x`, `expand sin(x+y+z)`. Examples: `sin(pi/5)`, `tan(60 deg)`. Pythagorean / negative-angle / sum-and-difference identities."

---

## 8. Logarithms & Exponentials

**Source:** https://reference.wolfram.com/language/ref/Log.html
**Source:** https://www.wolfram.com/language/fast-introduction-for-math-students/en/exponentials-and-logarithms/

> "`Log[x]` is the **natural logarithm** (equivalent to `Log[E, x]`). `Log[b, x]` is logarithm to base b. Note: Wolfram Alpha writes `log(x)` for natural log even though `log` more commonly refers to base-10. **Log base 2** also supported, plus log-scale plotting. `E` represents the exponential constant."

---

## 9. Matrices & Linear Algebra

**Source:** https://www.wolframalpha.com/examples/mathematics/algebra/matrices
**Source:** https://reference.wolfram.com/language/guide/MatricesAndLinearAlgebra.html

> "Matrix algebra, arithmetic and transformations. **Determinant** (det = 0 ⇒ singular ⇒ non-invertible). **Inverse** (and **pseudoinverse** for non-square). **Eigenvalues and eigenvectors**. **Trace**. Add/subtract/multiply vectors and matrices. **RREF**. Null space, kernel, linear independence."

---

## 10. Sequences & Series

**Source:** https://www.wolframalpha.com/examples/mathematics/discrete-mathematics/sequences

> "**Fibonacci, Lucas, arithmetic, geometric** sequences. Investigate properties, perform **convergence tests**, evaluate limits, find formulas for **incompletely specified sequences**, sum/multiply infinite series. **Geometric series**: ratio of consecutive terms is a constant; closed-form `a_k = a_0 r^k`."

---

## 11. Units & Physical Constants

**Source:** https://www.wolframalpha.com/examples/science-and-technology/units-and-measures
**Source:** https://www.wolframalpha.com/examples/science-and-technology/physics/physical-constants
**Source:** https://reference.wolfram.com/language/guide/Units.html

> "**World's most extensive unit converter** — inches↔km, pints↔L, psi↔N, etc. Thousands of common and obscure units across **US customary, metric SI, historical systems**. Comparisons to everyday scales, dimensional analysis. Physical constants: **Newtonian gravitational, Boltzmann, magnetic constants** — values, dimensionality, definitions."

---

## 12. Financial

**Source:** https://www.wolframalpha.com/examples/everyday-life/personal-finance/mortgages-and-loans
**Source:** https://www.wolframalpha.com/calculators/loan-calculator
**Source:** https://www.wolframalpha.com/calculators/interest-calculator
**Source:** https://www.wolframalpha.com/calculators/mortgage-calculator

> "**Compound interest** with options for compounding frequencies, maturity dates. Plots and tables visualize interest payments and rate effects. **Loans:** monthly payments, total interest, payoff times, credit-card payoff, car-loan scenarios. **Mortgages:** total cost, monthly payments, payoff times, amortization tables. **Fixed-rate** vs **adjustable-rate** mortgage modeling."

---

## 13. Step-by-Step Solutions (Pro feature, for reference)

**Source:** https://www.wolframalpha.com/examples/pro-features/step-by-step-solutions/

Pro tier includes: step-by-step **arithmetic, algebra, calculus, derivatives, linear algebra, trigonometry, discrete mathematics**. Useful as inspiration for what *not* to compete with — we should not promise step-by-step rendering.

---

## 14. Wolfram Language Functions Worth Mirroring

| Function | Purpose |
| --- | --- |
| `Abs`, `Arg`, `Conjugate`, `Re`, `Im`, `AbsArg` | Complex number operations |
| `FromPolarCoordinates`, `ToPolarCoordinates` | Polar ↔ rectangular |
| `FactorInteger`, `PrimeQ`, `Prime`, `Divisors`, `GCD`, `LCM` | Number theory |
| `BaseForm`, `IntegerDigits` | Base conversion |
| `D`, `Derivative`, `Integrate`, `Limit`, `Sum`, `Series` | Calculus |
| `Solve`, `NSolve`, `DSolve`, `Reduce` | Equation solving |
| `Mean`, `Median`, `StandardDeviation`, `Variance`, `Quantile` | Descriptive stats |
| `LinearModelFit`, `NonlinearModelFit` | Regression |
| `Probability`, `Expectation`, `PDF`, `CDF`, `InverseCDF` | Probability/distributions |
| `Det`, `Inverse`, `Eigenvalues`, `Eigenvectors`, `RowReduce`, `Transpose`, `Tr` | Linear algebra |
| `UnitConvert`, `Quantity` | Units |
| `ContinuedFraction`, `Convergents` | Continued fractions |
