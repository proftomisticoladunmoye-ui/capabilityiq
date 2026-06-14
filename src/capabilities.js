// Human Capability Intelligence Framework
// The 12 canonical capability dimensions that compose the Human Capability Index (HCI).
// Each dimension carries a weight used in the composite HCI computation.

export const DIMENSIONS = [
  {
    id: 'knowledge',
    index: 1,
    name: 'Knowledge Intelligence',
    short: 'Knowledge',
    icon: '◆',
    weight: 1.0,
    color: '#0B2545',
    summary:
      'Depth, breadth and currency of domain knowledge and the ability to apply it to real problems.',
    drivers: ['Domain mastery', 'Conceptual depth', 'Knowledge currency', 'Cross-domain transfer'],
  },
  {
    id: 'value_creation',
    index: 2,
    name: 'Value Creation Skills',
    short: 'Value Creation',
    icon: '◆',
    weight: 1.15,
    color: '#B8860B',
    summary:
      'Translating capability into tangible outcomes, products, services and measurable impact.',
    drivers: ['Execution', 'Problem solving', 'Outcome orientation', 'Quality of output'],
  },
  {
    id: 'initiative',
    index: 3,
    name: 'Initiative & Evidence Portfolio',
    short: 'Initiative',
    icon: '◆',
    weight: 1.1,
    color: '#5C677D',
    summary:
      'Track record of self-started work and a verifiable portfolio of evidence and achievement.',
    drivers: ['Self-direction', 'Evidence depth', 'Project ownership', 'Demonstrated results'],
  },
  {
    id: 'exposure',
    index: 4,
    name: 'Exposure & Perspective',
    short: 'Exposure',
    icon: '◆',
    weight: 0.9,
    color: '#0B2545',
    summary:
      'Breadth of experience across contexts, cultures, industries and global perspectives.',
    drivers: ['Global exposure', 'Cross-cultural fluency', 'Industry breadth', 'Worldview'],
  },
  {
    id: 'identity',
    index: 5,
    name: 'Identity, Reputation & Influence',
    short: 'Reputation',
    icon: '◆',
    weight: 0.95,
    color: '#B8860B',
    summary:
      'Professional identity, credibility, network and the ability to influence and mobilise others.',
    drivers: ['Credibility', 'Network strength', 'Influence', 'Personal brand'],
  },
  {
    id: 'cognitive',
    index: 6,
    name: 'Cognitive Architecture',
    short: 'Cognition',
    icon: '◆',
    weight: 1.1,
    color: '#5C677D',
    summary:
      'Reasoning, critical thinking, systems thinking and the underlying quality of mental models.',
    drivers: ['Critical thinking', 'Systems thinking', 'Reasoning', 'Mental models'],
  },
  {
    id: 'collaboration',
    index: 7,
    name: 'Human Collaboration Intelligence',
    short: 'Collaboration',
    icon: '◆',
    weight: 1.0,
    color: '#0B2545',
    summary:
      'Working effectively with others — communication, empathy, teaming and conflict navigation.',
    drivers: ['Communication', 'Empathy', 'Teaming', 'Conflict navigation'],
  },
  {
    id: 'learning_agility',
    index: 8,
    name: 'Learning Agility',
    short: 'Learning Agility',
    icon: '◆',
    weight: 1.2,
    color: '#B8860B',
    summary:
      'Speed and adaptability of learning — acquiring, unlearning and reapplying skill under change.',
    drivers: ['Learning speed', 'Adaptability', 'Curiosity', 'Unlearning'],
  },
  {
    id: 'digital',
    index: 9,
    name: 'Digital Intelligence',
    short: 'Digital',
    icon: '◆',
    weight: 1.05,
    color: '#5C677D',
    summary:
      'Fluency with digital tools, data and technology to operate in a digital-first world.',
    drivers: ['Digital fluency', 'Data literacy', 'Tooling', 'Tech adaptability'],
  },
  {
    id: 'ai_partnership',
    index: 10,
    name: 'AI Partnership Capability',
    short: 'AI Partnership',
    icon: '◆',
    weight: 1.25,
    color: '#0B2545',
    summary:
      'Ability to partner with AI systems — prompting, orchestration, judgement and augmentation.',
    drivers: ['AI fluency', 'Prompt design', 'Human-AI judgement', 'Augmentation'],
  },
  {
    id: 'entrepreneurial',
    index: 11,
    name: 'Entrepreneurial Value Creation',
    short: 'Entrepreneurial',
    icon: '◆',
    weight: 1.1,
    color: '#B8860B',
    summary:
      'Identifying opportunity, taking calculated risk and building ventures or new value streams.',
    drivers: ['Opportunity sensing', 'Risk taking', 'Venturing', 'Resourcefulness'],
  },
  {
    id: 'wellbeing',
    index: 12,
    name: 'Wellbeing & Resilience Capital',
    short: 'Resilience',
    icon: '◆',
    weight: 1.0,
    color: '#5C677D',
    summary:
      'Sustainable energy, mental health, resilience and the capacity to perform under pressure.',
    drivers: ['Resilience', 'Energy management', 'Mental health', 'Recovery'],
  },
];

export const DIMENSION_BY_ID = Object.fromEntries(DIMENSIONS.map((d) => [d.id, d]));

// HCI maturity bands.
export const LEVELS = [
  { id: 'foundational', label: 'Foundational', min: 0, max: 20, color: '#9AA5B1' },
  { id: 'emerging', label: 'Emerging', min: 21, max: 40, color: '#5C677D' },
  { id: 'developing', label: 'Developing', min: 41, max: 60, color: '#2D6A9F' },
  { id: 'advanced', label: 'Advanced', min: 61, max: 80, color: '#0B2545' },
  { id: 'elite', label: 'Elite', min: 81, max: 100, color: '#B8860B' },
];

export function levelFor(score) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return LEVELS.find((l) => s >= l.min && s <= l.max) || LEVELS[0];
}
