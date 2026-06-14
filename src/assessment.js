// Capability Assessment Engine
// A psychometric instrument: 5 items per dimension (60 items total), 7-point Likert.
// Items are a mix of self-efficacy, behavioural-frequency and situational-judgement framings.
// Reverse-scored items (reverse: true) guard against acquiescence bias.

import { DIMENSIONS } from './capabilities.js';

export const LIKERT = {
  points: 7,
  anchors: [
    'Strongly disagree',
    'Disagree',
    'Slightly disagree',
    'Neutral',
    'Slightly agree',
    'Agree',
    'Strongly agree',
  ],
};

// Question bank keyed by dimension id.
const BANK = {
  knowledge: [
    'I can explain the core concepts of my field clearly to a non-expert.',
    'I actively keep my knowledge current with the latest developments in my domain.',
    'I can connect ideas across different disciplines to solve problems.',
    'I often feel my knowledge is shallow compared to what my work demands.',
    'People come to me as a reliable source of expertise in my area.',
  ],
  value_creation: [
    'I consistently turn ideas into finished, usable outcomes.',
    'I focus on the measurable impact of my work, not just activity.',
    'The quality of what I produce is recognised by others.',
    'I struggle to finish things I start.',
    'I find practical solutions to problems others get stuck on.',
  ],
  initiative: [
    'I start meaningful projects without being asked.',
    'I keep a documented record of my work, results and achievements.',
    'I take full ownership of outcomes, including when things go wrong.',
    'I rarely have concrete evidence to show for my contributions.',
    'I pursue goals persistently even when no one is monitoring me.',
  ],
  exposure: [
    'I have worked or studied across diverse cultures or contexts.',
    'I actively seek perspectives different from my own.',
    'My experience spans more than one industry or domain.',
    'My view of the world is mostly shaped by a single environment.',
    'I am comfortable operating in unfamiliar settings.',
  ],
  identity: [
    'Others see me as credible and trustworthy in my field.',
    'I have a strong professional network I can mobilise.',
    'I can influence decisions and bring people along with my ideas.',
    'I have little visible professional presence or reputation.',
    'My personal brand reflects the value I create.',
  ],
  cognitive: [
    'I rigorously question assumptions before drawing conclusions.',
    'I can see how parts of a complex system interact.',
    'I reason carefully through problems rather than jumping to answers.',
    'I often rely on gut feeling instead of structured thinking.',
    'I update my views readily when the evidence changes.',
  ],
  collaboration: [
    'I communicate clearly and adapt my message to my audience.',
    'I read and respond well to other people’s emotions.',
    'I help teams perform better than the sum of their members.',
    'I tend to avoid or escalate conflict rather than resolve it.',
    'People find me easy and productive to work with.',
  ],
  learning_agility: [
    'I learn new skills faster than most people around me.',
    'I adapt quickly when circumstances change unexpectedly.',
    'I am genuinely curious and seek out new things to learn.',
    'I find it hard to let go of outdated ways of working.',
    'I deliberately reflect on experience to improve.',
  ],
  digital: [
    'I am fluent with the digital tools my work requires.',
    'I can interpret and work with data confidently.',
    'I quickly pick up new software and platforms.',
    'New technology often makes me feel out of my depth.',
    'I use digital tools to work far more effectively.',
  ],
  ai_partnership: [
    'I use AI tools to amplify the quality and speed of my work.',
    'I can craft effective prompts and instructions for AI systems.',
    'I know when to trust AI output and when to override it.',
    'I find it hard to integrate AI into how I actually work.',
    'I orchestrate AI as a genuine partner, not just a search box.',
  ],
  entrepreneurial: [
    'I spot opportunities that others overlook.',
    'I am willing to take calculated risks to create value.',
    'I can build something valuable with limited resources.',
    'I wait for certainty before acting on an opportunity.',
    'I have created or helped create a new product, venture or revenue stream.',
  ],
  wellbeing: [
    'I sustain my energy and focus across demanding periods.',
    'I recover quickly from setbacks and stress.',
    'I manage my mental health proactively.',
    'I frequently feel burnt out or depleted.',
    'I perform well under pressure without losing my balance.',
  ],
};

// Items where high agreement indicates LOW capability (reverse scored).
const REVERSE_INDEX = new Set([3]); // the 4th item (index 3) in every dimension is reverse-keyed

export function buildAssessment() {
  const sections = DIMENSIONS.map((dim) => ({
    dimensionId: dim.id,
    dimension: dim.name,
    short: dim.short,
    summary: dim.summary,
    color: dim.color,
    items: BANK[dim.id].map((text, i) => ({
      id: `${dim.id}_${i + 1}`,
      dimensionId: dim.id,
      text,
      reverse: REVERSE_INDEX.has(i),
    })),
  }));
  return {
    likert: LIKERT,
    totalItems: sections.reduce((n, s) => n + s.items.length, 0),
    sections,
  };
}

// Convert a raw 1..7 Likert response to a 0..100 scale, honouring reverse keys.
function normalise(raw, reverse) {
  const r = Math.max(1, Math.min(7, Number(raw)));
  const v = reverse ? 8 - r : r;
  return ((v - 1) / 6) * 100;
}

// Score a full set of responses: { itemId: 1..7 }.
// Returns per-dimension scores (0..100) and item-level coverage.
export function scoreResponses(responses) {
  const assessment = buildAssessment();
  const perDimension = {};
  let answered = 0;

  for (const section of assessment.sections) {
    const vals = [];
    for (const item of section.items) {
      const raw = responses[item.id];
      if (raw == null || raw === '') continue;
      answered += 1;
      vals.push(normalise(raw, item.reverse));
    }
    perDimension[section.dimensionId] =
      vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
  }

  return {
    perDimension,
    answered,
    totalItems: assessment.totalItems,
    completion: Math.round((answered / assessment.totalItems) * 100),
  };
}
