// Seed synthetic cohort data so the Institutional Intelligence dashboard has
// something to aggregate on first run. Generates N users each with a randomised
// but plausible response set, scored through the real engine.

import { store, initStore } from '../src/store.js';
import { buildAssessment, scoreResponses } from '../src/assessment.js';
import { buildProfile } from '../src/hci.js';

const N = Number(process.argv[2] || 40);
const ORG = process.argv[3] || 'Demo University';

const FIRST = ['Jordan', 'Amara', 'Chen', 'Priya', 'Diego', 'Fatima', 'Liam', 'Noor', 'Kwame', 'Sofia', 'Yuki', 'Omar', 'Lena', 'Tariq', 'Aria'];
const LAST = ['Mensah', 'Okafor', 'Wang', 'Patel', 'Garcia', 'Hassan', 'Murphy', 'Khan', 'Asante', 'Rossi', 'Tanaka', 'Said', 'Novak', 'Aziz', 'Cole'];

const assessment = buildAssessment();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randn = () => { // Box–Muller standard normal
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Three latent group factors over the 12 dimensions, plus a weaker general factor.
// This block structure makes the cohort genuinely 3-dimensional so EFA extracts and
// rotates ~3 interpretable factors (rather than a single general factor).
const BLOCK = {
  knowledge: 0, cognitive: 0, learning_agility: 0, digital: 0,        // Cognitive–Learning
  value_creation: 1, initiative: 1, entrepreneurial: 1, ai_partnership: 1, // Execution–Venture
  exposure: 2, identity: 2, collaboration: 2, wellbeing: 2,           // Human–Wellbeing
};

// Each respondent draws a general ability and three group abilities; an item's
// score blends the general factor, its block factor and item noise.
function randomResponses() {
  const general = randn() * 0.55;
  const group = [randn(), randn(), randn()];
  const responses = {};
  for (const sec of assessment.sections) {
    const block = BLOCK[sec.dimensionId];
    const dimShift = randn() * 0.35;
    for (const item of sec.items) {
      const latent = general + group[block] + dimShift + randn() * 0.7;
      let v = Math.round(4 + latent * 1.25); // centre at 4 on the 1..7 scale
      v = Math.max(1, Math.min(7, v));
      if (item.reverse) v = 8 - v; // store the raw response the user would give
      responses[item.id] = v;
    }
  }
  return responses;
}

async function main() {
  await initStore();
  await store.reset();
  for (let i = 0; i < N; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const user = await store.upsertUser({ name, email: `user${i}@demo.edu`, role: 'student', org: ORG });
    const responses = randomResponses();
    const scored = scoreResponses(responses);
    await store.saveResponses(user.id, responses);
    await store.saveProfile(user.id, buildProfile(scored));
  }
  const profiles = await store.allProfiles();
  const avg = Math.round((profiles.reduce((a, p) => a + p.hci, 0) / profiles.length) * 10) / 10;
  console.log(`Seeded ${N} profiles for "${ORG}" (${store.backend}). Average HCI: ${avg}`);
  process.exit(0);
}

main().catch((e) => { console.error('Seed failed:', e); process.exit(1); });
