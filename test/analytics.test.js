// Psychometric engines (reliability, EFA, CFA, Rasch) verified on a deterministic,
// seeded synthetic cohort built with the same 3-block latent structure as the seeder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAssessment } from '../src/assessment.js';
import { analyseCohort } from '../src/psychometrics.js';
import { runEFA } from '../src/efa.js';
import { runCFA } from '../src/cfa.js';
import { calibrateDimension } from '../src/irt.js';
import { DIMENSIONS } from '../src/capabilities.js';

// deterministic PRNG (mulberry32) + Box–Muller normal
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randn = (r) => {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const BLOCK = {
  knowledge: 0, cognitive: 0, learning_agility: 0, digital: 0,
  value_creation: 1, initiative: 1, entrepreneurial: 1, ai_partnership: 1,
  exposure: 2, identity: 2, collaboration: 2, wellbeing: 2,
};
const assessment = buildAssessment();

function cohort(n, seed) {
  const r = rng(seed);
  const recs = [];
  for (let p = 0; p < n; p++) {
    const general = randn(r) * 0.55;
    const group = [randn(r), randn(r), randn(r)];
    const responses = {};
    for (const sec of assessment.sections) {
      const b = BLOCK[sec.dimensionId];
      const dimShift = randn(r) * 0.35;
      for (const it of sec.items) {
        const latent = general + group[b] + dimShift + randn(r) * 0.7;
        let v = Math.round(4 + latent * 1.25);
        v = Math.max(1, Math.min(7, v));
        if (it.reverse) v = 8 - v;
        responses[it.id] = v;
      }
    }
    recs.push({ responses });
  }
  return recs;
}

const COHORT = cohort(180, 1736428);

test('reliability: per-dimension Cronbach alpha is computed and bounded', () => {
  const out = analyseCohort(COHORT);
  assert.equal(out.dimensions.length, 12);
  assert.ok(out.overallAlpha <= 1 && out.overallAlpha > 0);
  for (const d of out.dimensions) {
    assert.ok(d.alpha <= 1, `${d.short} alpha ${d.alpha}`);
    assert.equal(d.items, 5); // item count
    assert.equal(d.itemStats.length, 5); // per-item descriptives
  }
});

test('EFA: eigenvalues sum to the trace and KMO is a valid index', () => {
  const efa = runEFA(COHORT);
  assert.equal(efa.variables, 12);
  const trace = efa.scree.reduce((a, s) => a + s.eigenvalue, 0);
  assert.ok(Math.abs(trace - 12) < 0.05, `trace ${trace}`); // 12x12 correlation matrix
  assert.ok(efa.kmo >= 0 && efa.kmo <= 1);
  assert.ok(efa.retainedFactors >= 1 && efa.retainedFactors <= 4);
  // the 3-block latent structure should surface ~3 factors
  assert.equal(efa.retainedFactors, 3);
});

test('CFA: fit indices fall in valid ranges and AVE is bounded', () => {
  const cfa = runCFA(COHORT);
  assert.equal(cfa.factors.length, 3);
  assert.ok(cfa.fit.cfi >= 0 && cfa.fit.cfi <= 1.001);
  assert.ok(cfa.fit.rmsea >= 0);
  assert.ok(cfa.fit.srmr >= 0 && cfa.fit.srmr <= 1);
  for (const f of cfa.factors) {
    assert.ok(f.ave >= 0 && f.ave <= 1, `AVE ${f.ave}`);
    assert.ok(f.cr >= 0 && f.cr <= 1, `CR ${f.cr}`);
  }
});

test('Rasch: thresholds are ordered and reliabilities are bounded', () => {
  const r = calibrateDimension(COHORT, DIMENSIONS[0].id);
  assert.equal(r.items.length, 5);
  assert.equal(r.thresholdsOrdered, true);
  const taus = r.thresholds.map((t) => t.value);
  for (let k = 1; k < taus.length; k++) assert.ok(taus[k] >= taus[k - 1]);
  assert.ok(r.reliability.personReliability >= 0 && r.reliability.personReliability <= 1);
});

test('engines return empty (not throw) on an undersized cohort', () => {
  const tiny = cohort(8, 1);
  assert.equal(runEFA(tiny).empty, true);
  assert.equal(runCFA(tiny).empty, true);
  assert.equal(calibrateDimension(tiny, DIMENSIONS[0].id).empty, true);
});
