// ============================================================================
//  THE PLANNER
//  Generates a structured mini-days plan inside the app — no chat required.
//  Takes a date + mode + brief context, returns plan JSON ready to schedule.
// ============================================================================
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.PLANNER_MODEL || process.env.COACH_MODEL || "claude-sonnet-4-6";

const SYSTEM = `You are the planner for Bobby's mini-days framework. You generate ONE day's structured plan and output it as STRICT JSON only.

THE FRAMEWORK — every day has FOUR mini-days, each a full arc:
- Mind: solo deep work; cognitively demanding.
- People: client meetings, sales, collaborative work.
- Hands: admin, execution, body-engaged tasks, low cognitive load.
- Heart: rest, family, restoration, integration.

Each mini-day has five sub-beats: Open, Peak, Biz, Close, Sleep (NSDR pulse).

DIURNAL default windows: Mind 06:00–10:00, People 11:00–14:00, Hands 15:00–18:00, Heart 19:00–22:00.
NOCTURNAL default windows (~19:30 start): Mind 19:30–23:30, People 23:30–03:30, Hands 03:30–07:30 (runs through the 3–5 AM dip — body-engaged only, no deep work), Heart 07:30–11:30 (active wind-down toward day sleep).

If the user gives a startTime later than a block's default, compress or skip that block. Always include all four blocks at minimum as Biz beats unless the day is genuinely too short.

CHECK-INS — generate 4 to 8 per day. Quality over quantity.
- One at the START of each mini-day's Peak (is he starting?).
- One at the CLOSE of each mini-day (did he finish + protect the boundary?).
- Optionally one mid-Peak on the longest block.
- "task" must be SPECIFIC — name the actual commitment in his words.
- "intent" is the why behind the check-in.

OUTPUT — strict JSON, nothing else. No markdown, no code fences, no preamble. Match this schema exactly:

{
  "date": "YYYY-MM-DD",
  "mode": "diurnal" | "nocturnal",
  "tz": "America/New_York",
  "blocks": [
    { "name": "Mind"|"People"|"Hands"|"Heart", "window": "HH:MM-HH:MM", "task": "string" }
  ],
  "checkins": [
    {
      "time": "HH:MM",
      "block": "Mind"|"People"|"Hands"|"Heart",
      "kind": "Peak"|"Close"|"Open"|"Biz",
      "task": "specific commitment in his words",
      "intent": "what is this check-in really asking?"
    }
  ]
}

Times are 24-hour HH:MM in the given timezone. Never include trailing commentary or wrap the JSON in anything.`;

export async function generatePlan({ date, mode, tz, startTime, context }) {
  const userMsg = `Generate the plan.
Date: ${date}
Mode: ${mode || "diurnal"}
Timezone: ${tz || "America/New_York"}
${startTime ? `Start time: ${startTime}` : ""}

What's on today:
${context || "(no specific context — plan a standard day)"}

Output strict JSON only.`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [
      { role: "user", content: userMsg },
    ],
  });

  const raw = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  // Extract the JSON object, ignoring any stray prose before or after it.
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  const jsonStr = (firstBrace >= 0 && lastBrace > firstBrace) ? raw.slice(firstBrace, lastBrace + 1) : raw;
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("[planner] JSON parse failed:", e.message, "raw:", raw.slice(0, 500));
    throw new Error("planner returned invalid JSON");
  }
}
