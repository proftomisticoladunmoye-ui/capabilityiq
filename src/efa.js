// Exploratory Factor Analysis (Research Analytics Module).
// Runs an EFA across the 12 capability-dimension scores of a cohort to test whether
// the dimensions collapse into a smaller set of latent "meta-capabilities".
//
// Pipeline: dimension-score matrix → correlation matrix → sampling-adequacy
// diagnostics (KMO, Bartlett) → eigendecomposition (Jacobi) → Kaiser factor
// retention → principal-component loadings → varimax rotation → communalities &
// variance explained. Pure JS linear algebra, deterministic and unit-testable.

import { DIMENSIONS } from './capabilities.js';
import { scoreResponses } from './assessment.js';

// ---- linear algebra primitives -----------------------------------------
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function pearson(xs, ys) {
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

// Respondents × 12 matrix of dimension scores (complete cases only). Shared by CFA.
export function dimensionScoreMatrix(responseRecords) {
  return dimensionMatrix(responseRecords);
}

// Symmetric eigendecomposition via the cyclic Jacobi rotation method.
// Returns eigenvalues (desc) and corresponding eigenvectors (columns).
export function jacobiEigen(A0, maxIter = 100, tol = 1e-10) {
  const n = A0.length;
  const A = A0.map((r) => r.slice());
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

  for (let iter = 0; iter < maxIter; iter++) {
    // largest off-diagonal magnitude
    let p = 0, q = 1, off = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (Math.abs(A[i][j]) > off) { off = Math.abs(A[i][j]); p = i; q = j; }
    if (off < tol) break;

    const app = A[p][p], aqq = A[q][q], apq = A[p][q];
    const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(phi), s = Math.sin(phi);

    for (let k = 0; k < n; k++) {
      const akp = A[k][p], akq = A[k][q];
      A[k][p] = c * akp - s * akq;
      A[k][q] = s * akp + c * akq;
    }
    for (let k = 0; k < n; k++) {
      const apk = A[p][k], aqk = A[q][k];
      A[p][k] = c * apk - s * aqk;
      A[q][k] = s * apk + c * aqk;
    }
    for (let k = 0; k < n; k++) {
      const vkp = V[k][p], vkq = V[k][q];
      V[k][p] = c * vkp - s * vkq;
      V[k][q] = s * vkp + c * vkq;
    }
  }

  const eig = Array.from({ length: n }, (_, i) => ({ value: A[i][i], vec: V.map((r) => r[i]) }));
  eig.sort((a, b) => b.value - a.value);
  return { values: eig.map((e) => e.value), vectors: eig.map((e) => e.vec) };
}

// Gauss-Jordan matrix inverse (for KMO partial correlations).
export function inverse(M) {
  const n = M.length;
  const A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-12) return null; // singular
    [A[col], A[piv]] = [A[piv], A[col]];
    const d = A[col][col];
    for (let j = 0; j < 2 * n; j++) A[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col];
      for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[col][j];
    }
  }
  return A.map((r) => r.slice(n));
}

const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

// ---- diagnostics --------------------------------------------------------
// Kaiser-Meyer-Olkin measure of sampling adequacy.
function kmo(R) {
  const inv = inverse(R);
  if (!inv) return null;
  const n = R.length;
  let sumR2 = 0, sumP2 = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const partial = -inv[i][j] / Math.sqrt(inv[i][i] * inv[j][j]);
      sumR2 += R[i][j] ** 2;
      sumP2 += partial ** 2;
    }
  return sumR2 / (sumR2 + sumP2);
}

function interpretKMO(v) {
  if (v == null) return 'undefined';
  if (v >= 0.9) return 'marvellous';
  if (v >= 0.8) return 'meritorious';
  if (v >= 0.7) return 'middling';
  if (v >= 0.6) return 'mediocre';
  if (v >= 0.5) return 'miserable';
  return 'unacceptable';
}

// Bartlett's test of sphericity (chi-square approximation).
function bartlett(eigenvalues, n, p) {
  // det(R) = product of eigenvalues; guard against tiny negatives from rounding.
  const det = eigenvalues.reduce((a, b) => a * Math.max(b, 1e-12), 1);
  const chi = -((n - 1) - (2 * p + 5) / 6) * Math.log(det);
  const df = (p * (p - 1)) / 2;
  return { chiSquare: round(chi, 1), df, det: round(det, 5) };
}

// Varimax rotation (Kaiser-normalised) of a p×m loading matrix.
function varimax(L, maxIter = 100, tol = 1e-9) {
  const p = L.length, m = L[0]?.length || 0;
  if (m < 2) return L.map((r) => r.slice());
  // Kaiser normalisation by communality.
  const h = L.map((row) => Math.sqrt(row.reduce((a, b) => a + b * b, 0)) || 1);
  let A = L.map((row, i) => row.map((v) => v / h[i]));

  for (let iter = 0; iter < maxIter; iter++) {
    let converged = true;
    for (let a = 0; a < m; a++)
      for (let b = a + 1; b < m; b++) {
        let u = 0, v = 0, sumU = 0, sumV = 0;
        for (let i = 0; i < p; i++) {
          const x = A[i][a], y = A[i][b];
          const uu = x * x - y * y, vv = 2 * x * y;
          u += uu; v += vv; sumU += uu * uu - vv * vv; sumV += 2 * uu * vv;
        }
        const num = sumV - (2 * u * v) / p;
        const den = sumU - (u * u - v * v) / p;
        const phi = 0.25 * Math.atan2(num, den);
        if (Math.abs(phi) > tol) converged = false;
        const c = Math.cos(phi), s = Math.sin(phi);
        for (let i = 0; i < p; i++) {
          const x = A[i][a], y = A[i][b];
          A[i][a] = c * x + s * y;
          A[i][b] = -s * x + c * y;
        }
      }
    if (converged) break;
  }
  // de-normalise
  return A.map((row, i) => row.map((v) => v * h[i]));
}

// ---- cohort matrix ------------------------------------------------------
// Build a respondents × 12 matrix of dimension scores (complete cases only).
function dimensionMatrix(responseRecords) {
  const rows = [];
  for (const rec of responseRecords) {
    const scored = scoreResponses(rec.responses || rec);
    const vec = DIMENSIONS.map((d) => scored.perDimension[d.id]);
    if (vec.every((v) => v != null)) rows.push(vec);
  }
  return rows;
}

// ---- public: run EFA ----------------------------------------------------
export function runEFA(responseRecords, { maxFactors = 4 } = {}) {
  const rows = dimensionMatrix(responseRecords);
  const n = rows.length;
  const p = DIMENSIONS.length;
  if (n < p + 1) return { empty: true, reason: 'insufficient sample (need > 12 complete cases)', n };

  // Correlation matrix of the 12 dimension scores.
  const cols = DIMENSIONS.map((_, j) => rows.map((r) => r[j]));
  const R = cols.map((ci) => cols.map((cj) => pearson(ci, cj)));

  const { values: eigenvalues, vectors } = jacobiEigen(R);

  // Kaiser criterion: retain factors with eigenvalue > 1 (capped at maxFactors).
  let retained = eigenvalues.filter((v) => v > 1).length;
  retained = Math.max(1, Math.min(retained, maxFactors));

  // Principal-component loadings: loading = eigenvector * sqrt(eigenvalue).
  const unrotated = DIMENSIONS.map((_, i) =>
    Array.from({ length: retained }, (_, f) => vectors[f][i] * Math.sqrt(Math.max(eigenvalues[f], 0)))
  );
  const rotated = varimax(unrotated);

  // Sign-normalise each factor so its dominant loadings are positive.
  for (let f = 0; f < retained; f++) {
    const signSum = rotated.reduce((a, row) => a + row[f] ** 3, 0);
    if (signSum < 0) for (const row of rotated) row[f] = -row[f];
  }

  const totalVar = p; // standardised → total variance = number of variables
  const factors = Array.from({ length: retained }, (_, f) => {
    const ssl = rotated.reduce((a, row) => a + row[f] ** 2, 0); // sum of squared loadings
    return {
      index: f + 1,
      eigenvalue: round(eigenvalues[f], 3),
      ssLoadings: round(ssl, 3),
      varianceExplained: round((ssl / totalVar) * 100, 1),
    };
  });
  // cumulative variance
  let cum = 0;
  for (const fa of factors) { cum += fa.varianceExplained; fa.cumulative = round(cum, 1); }

  const loadings = DIMENSIONS.map((d, i) => {
    const row = rotated[i].map((v) => round(v, 3));
    const communality = round(row.reduce((a, b) => a + b * b, 0), 3);
    // label the dimension's primary factor
    let primary = 0;
    row.forEach((v, f) => { if (Math.abs(v) > Math.abs(row[primary])) primary = f; });
    return { id: d.id, name: d.name, short: d.short, loadings: row, communality, primaryFactor: primary + 1 };
  });

  // Auto-name factors from their highest-loading dimensions.
  const factorNames = factors.map((fa, f) => {
    const top = loadings
      .map((l) => ({ short: l.short, w: l.loadings[f] }))
      .sort((a, b) => Math.abs(b.w) - Math.abs(a.w))
      .slice(0, 3)
      .map((x) => x.short);
    return { ...fa, name: `F${f + 1}: ${top.join(' · ')}` };
  });

  const kmoVal = kmo(R);
  const bart = bartlett(eigenvalues, n, p);

  return {
    n,
    variables: p,
    retainedFactors: retained,
    kmo: kmoVal == null ? null : round(kmoVal, 3),
    kmoInterpretation: interpretKMO(kmoVal),
    bartlett: bart,
    scree: eigenvalues.map((v, i) => ({ component: i + 1, eigenvalue: round(v, 3) })),
    factors: factorNames,
    loadings,
    correlation: R.map((r) => r.map((v) => round(v, 2))),
    dimensionLabels: DIMENSIONS.map((d) => d.short),
    generatedAt: new Date().toISOString(),
  };
}
