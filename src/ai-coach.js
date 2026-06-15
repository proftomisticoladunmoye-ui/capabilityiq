// AI Capability Coach.
// Profile-grounded coaching. If an LLM API key is present (OPENAI_API_KEY or
// ANTHROPIC_API_KEY) the coach calls the model with the user's HCI profile as context;
// otherwise it falls back to a deterministic, profile-aware reasoning engine so the
// platform remains fully functional offline.

import { DIMENSION_BY_ID } from './capabilities.js';

const COACH_ROLES = {
  career: 'Career Coach',
  learning: 'Learning Coach',
  research: 'Research Coach',
  leadership: 'Leadership Coach',
  capability: 'Capability Development Coach',
  entrepreneurship: 'Entrepreneurship Coach',
};

function profileSnapshot(profile) {
  if (!profile) return 'No assessment has been completed yet.';
  const dims = profile.dimensions
    .filter((d) => d.score != null)
    .map((d) => `${d.short}: ${d.score}`)
    .join(', ');
  const gaps = profile.gaps.map((g) => g.short).join(', ');
  const strengths = profile.strengths.map((s) => s.short).join(', ');
  return [
    `HCI: ${profile.hci}/100 (${profile.level.label}).`,
    `Strengths: ${strengths}.`,
    `Priority gaps: ${gaps}.`,
    `Dimension scores — ${dims}.`,
    `Career readiness ${profile.readiness.career}, AI readiness ${profile.readiness.ai}, leadership ${profile.readiness.leadership}, entrepreneurship ${profile.readiness.entrepreneurship}.`,
  ].join(' ');
}

// ---- Deterministic fallback reasoning ----------------------------------
function fallbackAnswer(message, role, profile) {
  const roleLabel = COACH_ROLES[role] || 'Capability Coach';
  if (!profile) {
    return {
      role: roleLabel,
      answer:
        `I'm your ${roleLabel}. To give you precise, evidence-based guidance I need your ` +
        `Capability profile first. Complete the Capability Assessment and I'll analyse your ` +
        `12 dimensions, identify the exact gaps holding you back, and build you a roadmap.`,
      followups: ['Start my assessment', 'How is the HCI calculated?'],
    };
  }

  const top = profile.gaps[0];
  const topDim = top ? DIMENSION_BY_ID[top.id] : null;
  const q = message.toLowerCase();

  // Goal-detection: "what stops me from becoming X" style queries.
  const aspirational = /(become|reach|get to|path to|how do i|what.*stop|gap|prevent)/.test(q);

  const lines = [];
  lines.push(`Here's my read as your ${roleLabel}, grounded in your current profile.`);
  lines.push('');
  lines.push(`**Where you stand:** HCI ${profile.hci}/100 — ${profile.level.label}. Your strongest dimensions are ${profile.strengths.slice(0, 3).map((s) => s.short).join(', ')}.`);
  lines.push('');
  lines.push('**What is holding you back (in priority order):**');
  profile.gaps.forEach((g, i) => {
    const dim = DIMENSION_BY_ID[g.id];
    lines.push(`${i + 1}. **${g.name}** — currently ${g.score}/100. ${dim.summary}`);
  });
  lines.push('');
  if (topDim) {
    lines.push(`**Start here:** Your highest-leverage move is **${topDim.name}**. ${profile.recommendations[0]?.action || ''}`);
  }
  lines.push('');
  lines.push('**Roadmap:**');
  lines.push(`- **0–90 days:** Attack your top gap (${profile.gaps[0]?.short}) with a focused build — ${profile.recommendations[0]?.horizon}.`);
  lines.push(`- **3–12 months:** Compound into ${profile.gaps[1]?.short} and ${profile.gaps[2]?.short}, raising your projected HCI toward ${profile.growth.projected12mo}.`);
  lines.push(`- **Ongoing:** Protect ${profile.strengths[0]?.short} as your differentiator and convert it into visible evidence.`);

  if (aspirational) {
    lines.push('');
    lines.push(`At your learning-agility level (${profile.growth.agility}/100), this trajectory is realistic — your modelled 24-month ceiling is ${profile.forecast.optimistic.at(-1)}.`);
  }

  return {
    role: roleLabel,
    answer: lines.join('\n'),
    followups: [
      `How do I improve ${profile.gaps[0]?.short}?`,
      'Build me a 90-day plan',
      'How do I compare to my peers?',
    ],
  };
}

// ---- Optional LLM path --------------------------------------------------
async function llmAnswer(message, role, profile) {
  const roleLabel = COACH_ROLES[role] || 'Capability Coach';
  const system =
    `You are the Capability IQ ${roleLabel}, an expert human-capability development coach. ` +
    `You give precise, evidence-based, actionable guidance grounded ONLY in the user's ` +
    `Human Capability profile below. Be direct, structured and encouraging. Use markdown. ` +
    `User profile: ${profileSnapshot(profile)}`;

  // Anthropic (preferred per platform's AI layer).
  if (process.env.ANTHROPIC_API_KEY) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
        max_tokens: 900,
        system,
        messages: [{ role: 'user', content: message }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const data = await res.json();
    return { role: roleLabel, answer: data.content?.[0]?.text || '', followups: [] };
  }

  // OpenAI fallback.
  if (process.env.OPENAI_API_KEY) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        max_tokens: 900,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: message },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return { role: roleLabel, answer: data.choices?.[0]?.message?.content || '', followups: [] };
  }

  // OpenRouter (OpenAI-compatible gateway → access to frontier models).
  if (process.env.OPENROUTER_API_KEY) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
        'X-Title': 'Capability IQ',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-opus-4.8',
        max_tokens: 900,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: message },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const data = await res.json();
    return { role: roleLabel, answer: data.choices?.[0]?.message?.content || '', followups: [] };
  }

  throw new Error('no-llm');
}

function hasLLM() {
  return Boolean(
    process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY
  );
}

export async function coach({ message, role = 'capability', profile }) {
  try {
    if (hasLLM()) {
      const out = await llmAnswer(message, role, profile);
      // an empty completion shouldn't beat the deterministic engine
      if (out.answer && out.answer.trim()) return { ...out, source: 'llm' };
    }
  } catch (e) {
    if (process.env.CIQ_DEBUG) console.error('LLM coach failed, falling back:', e.message);
  }
  return { ...fallbackAnswer(message, role, profile), source: 'engine' };
}

export { COACH_ROLES };
