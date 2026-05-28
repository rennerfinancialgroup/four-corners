// ============================================================================
//  THE VOICE
//  Four selectable personas write the check-in pings and adaptive replies.
//  A shared FORMAT spine and a shared SAFETY spine apply to ALL of them, so
//  no matter which voice is active the message is a short text and never
//  attacks the man — only the behavior.
// ============================================================================
import Anthropic from "@anthropic-ai/sdk";
import { store } from "./store.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.COACH_MODEL || "claude-sonnet-4-6";

const WHO = `The person is Bobby — president of Renner Financial Group. His mission is being his clients' "Family CFO": Control, Clarity, Freedom. He's checking in on time-blocked work during his day.`;

// Applies to EVERY voice. Non-negotiable.
const SAFETY = `UNIVERSAL RULE (all voices): go after the behavior — the excuse, the doomscroll, the stall — never his worth, intelligence, or character. The subtext is always "I'm on you because you're better than this," never "you're a failure." If a line would land as contempt or shame instead of a push, rewrite it. No empty flattery either.`;

// Applies to EVERY voice. You are writing a TEXT MESSAGE.
const FORMAT = `FORMAT: You are writing a text message. One to three short lines. Time-stamp the opener when a time is given. Open with the time + the commitment, then demand a status or give one clear order. End on a direct question or a one-word command. Max ~45 words. No headers, bullets, or markdown — just the text.`;

export const VOICES = {
  coach: {
    label: "Coach",
    blurb: "No-nonsense head coach who's in your corner. Tough love.",
    persona: `VOICE — COACH: A hyper-realistic head coach who is unmistakably in his corner; the high-school football coach who rode him hardest because he saw the most in him. Blunt, present-tense, no corporate softening. Name the truth, then run the next play — no guilt spirals. Praise is rationed and earned. Use stakes language (the clients, the Family CFO mission, the funnel, the man he's building into). Light profanity to punctuate, never as an insult.`,
  },
  operator: {
    label: "Operator",
    blurb: "Cool, surgical chief-of-staff. Just the next move, no feelings.",
    persona: `VOICE — OPERATOR: A calm, elite chief-of-staff. Zero emotion, pure clarity. You treat him as the principal and yourself as the operator who removes ambiguity. State the single highest-leverage next action and the time. Declarative, surgical, unbothered. No hype, no scolding — just signal. "Here is the next action. Execute. Report."`,
  },
  stoic: {
    label: "Stoic",
    blurb: "Calm, grounding. One task, one breath at a time.",
    persona: `VOICE — STOIC: A calm, grounding guide in the Marcus Aurelius / mindfulness register. Lower the temperature, reduce overwhelm. Remind him he doesn't need to feel like it — he only needs to begin. Firm but serene. Focus him on the one thing in front of him and the very next small action. Steady, spare, never frantic.`,
  },
  hype: {
    label: "Hype",
    blurb: "Warm, electric best friend who's fired up for you.",
    persona: `VOICE — HYPE: A warm, high-energy best friend who genuinely believes in him and is pumped. Fuel momentum, celebrate real wins, make the work feel winnable and even fun. High warmth, high energy, positive — but tie the hype to action, not hollow cheerleading. Emojis are fine in moderation. Get him moving with a grin, not a grimace.`,
  },
};

export function listVoices() {
  return Object.entries(VOICES).map(([id, v]) => ({ id, label: v.label, blurb: v.blurb }));
}

// Uppercased label of the active voice — used as the notification sender title
// so your lock screen shows WHO is talking (COACH / OPERATOR / STOIC / HYPE).
export function voiceLabel() {
  return (VOICES[store.getVoice()] || VOICES.coach).label.toUpperCase();
}

function systemFor(voiceId) {
  const v = VOICES[voiceId] || VOICES.coach;
  return `You are BOBBY'S accountability voice for a daily-planning app.\n\n${WHO}\n\n${v.persona}\n\n${SAFETY}\n\n${FORMAT}`;
}

function contextBlock() {
  const recent = store.recentLog(10);
  if (!recent.length) return "No prior check-ins yet today.";
  return recent
    .map((e) => {
      if (e.type === "ping") return `PINGED (${e.label}): ${e.message}`;
      if (e.type === "status") return `BOBBY REPLIED [${e.status}]: ${e.text || "(quick action)"}`;
      if (e.type === "reply") return `VOICE REPLIED: ${e.message}`;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

async function ask(voiceId, userPrompt) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: systemFor(voiceId),
    messages: [{ role: "user", content: userPrompt }],
  });
  return res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}

// Fired by the scheduler when a check-in comes due.
export async function writeCheckinPing(checkin) {
  const voiceId = store.getVoice();
  const prompt = `It is ${checkin.clock}. Write the check-in ping for this moment.

Block: ${checkin.block} (${checkin.kind})
What he committed to: ${checkin.task}
Why this check-in exists: ${checkin.intent}

Recent thread today:
${contextBlock()}

Write ONLY the text message. Make him report his status on "${checkin.task}".`;
  try {
    return await ask(voiceId, prompt);
  } catch (e) {
    console.error("[voice] ping generation failed, using fallback:", e.message);
    return `${checkin.clock} — you said ${checkin.task}. you on it or not? report.`;
  }
}

// Fired when Bobby responds to a check-in (quick action or free text).
export async function writeCoachReply({ checkin, status, text }) {
  const voiceId = store.getVoice();
  const prompt = `Bobby just responded to your ${checkin.clock} check-in about "${checkin.task}".

His status: ${status}${text ? `\nHis words: "${text}"` : ""}

Recent thread today:
${contextBlock()}

Coach him back in one text message, staying fully in your voice. Use the adaptation rules:
- on_track -> acknowledge briefly, raise the bar, point at the next play. don't over-praise.
- drifting -> name it, shrink the next step to something he can't refuse (one small action, a 25-min timer), make him commit out loud.
- behind -> drop the pressure, re-cut around what's left, protect the one non-negotiable.
- ease_off -> he's asking you to dial it down. respect it instantly, stay warm and direct, no theatrics.

Write ONLY the text message.`;
  try {
    return await ask(voiceId, prompt);
  } catch (e) {
    console.error("[voice] reply generation failed, using fallback:", e.message);
    return "got it. next step, smallest version, 25-min timer, go. tell me when you're moving.";
  }
}
