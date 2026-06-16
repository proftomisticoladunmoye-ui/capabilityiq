// Assessment scoring (incl. reverse keying) and the HCI engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAssessment, scoreResponses } from '../src/assessment.js';
import { computeHCI, computeReadiness, analyseGaps, buildProfile } from '../src/hci.js';
import { levelFor, DIMENSIONS } from '../src/capabilities.js';

const assessment = buildAssessment();

test('assessment has 12 sections and 60 items', () => {
  assert.equal(assessment.sections.length, 12);
  assert.equal(assessment.totalItems, 60);
  assert.equal(assessment.sections.every((s) => s.items.length === 5), true);
});

test('reverse-keyed item flips the score', () => {
  // Answer every item with the maximum (7). Non-reverse items → 100; the single
  // reverse item per dimension → 0. Mean per 5-item scale = (4*100 + 0)/5 = 80.
  const responses = {};
  for (const s of assessment.sections) for (const it of s.items) responses[it.id] = 7;
  const scored = scoreResponses(responses);
  for (const d of DIMENSIONS) assert.equal(scored.perDimension[d.id], 80);
  assert.equal(scored.completion, 100);
  assert.equal(scored.answered, 60);
});

test('computeHCI of an all-80 profile is 80 regardless of weights', () => {
  const per = Object.fromEntries(DIMENSIONS.map((d) => [d.id, 80]));
  assert.equal(computeHCI(per), 80);
});

test('levelFor maps scores to the five bands', () => {
  assert.equal(levelFor(10).label, 'Foundational');
  assert.equal(levelFor(30).label, 'Emerging');
  assert.equal(levelFor(50).label, 'Developing');
  assert.equal(levelFor(75).label, 'Advanced');
  assert.equal(levelFor(90).label, 'Elite');
  // clamps out-of-range
  assert.equal(levelFor(150).label, 'Elite');
  assert.equal(levelFor(-5).label, 'Foundational');
});

test('readiness composites stay within 0..100', () => {
  const per = Object.fromEntries(DIMENSIONS.map((d) => [d.id, 60]));
  const r = computeReadiness(per);
  for (const k of ['career', 'ai', 'leadership', 'entrepreneurship', 'research']) {
    assert.ok(r[k] >= 0 && r[k] <= 100, `${k}=${r[k]}`);
  }
});

test('gap analysis ranks low, high-weight dimensions first', () => {
  const per = Object.fromEntries(DIMENSIONS.map((d) => [d.id, 80]));
  per.ai_partnership = 30; // a low, high-weight dimension
  const { gaps, strengths } = analyseGaps(per);
  assert.equal(gaps[0].id, 'ai_partnership');
  assert.ok(strengths.length === 4 && gaps.length === 4);
});

test('buildProfile produces a coherent end-to-end profile', () => {
  const responses = {};
  let i = 0;
  for (const s of assessment.sections) for (const it of s.items) responses[it.id] = 2 + (i++ % 6);
  const profile = buildProfile(scoreResponses(responses));
  assert.ok(profile.hci >= 0 && profile.hci <= 100);
  assert.equal(profile.level.label, levelFor(profile.hci).label);
  assert.equal(profile.dimensions.length, 12);
  assert.equal(profile.gaps.length, 4);
  assert.equal(profile.benchmarks.length, 6);
  assert.equal(profile.forecast.expected.length, 25); // now + 24 months
  // forecast is monotonically non-decreasing
  for (let m = 1; m < profile.forecast.expected.length; m++) {
    assert.ok(profile.forecast.expected[m] >= profile.forecast.expected[m - 1]);
  }
});
