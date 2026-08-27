type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type VetoRequest = {
  exercises?: unknown;
  limitationNote?: unknown;
  // How many exercises are in the full session. The caller may send only the
  // ones it hasn't judged before, and the runaway check below needs the real
  // total or it would reject a legitimate veto covering a small subset.
  sessionSize?: unknown;
};

const MAX_EXERCISES = 12;
const MAX_NOTE_CHARS = 300;

// A small deterministic backstop for conditions where the mechanism is well
// established and the risk is not worth resting on a model call.
//
// Deliberately narrow. These are not medical rules and they don't try to
// cover a condition properly -- they remove the single class of movement most
// obviously implicated, so that the answer never depends entirely on how the
// user happened to phrase their note. The model still runs and can remove
// more; this only guarantees a floor.
const HIGH_RISK_RULES: { condition: RegExp; unless?: RegExp; avoid: RegExp; because: string }[] = [
  {
    // Abdominal-wall conditions share one mechanism: spikes in intra-abdominal
    // pressure. Explosive, high-impact and direct trunk-flexion work drives
    // that hardest, whether or not the abdomen is "the body part being used".
    //
    // `unless` matters here: "herniated disc" is a spine problem wearing the
    // same word, and it gets its own rule below rather than this one's
    // reasoning. Someone reporting both lands on the disc rule and the model
    // covers the rest -- no worse than before this backstop existed.
    condition:
      /\bhernia\w*|abdominal wall|diastasis|recent(ly)?\s+(had\s+)?(abdominal\s+)?surgery|post[-\s]?op|c[-\s]?section|caesar\w*/i,
    unless: /\b(disc|disk|spinal|spine|vertebra\w*|lumbar|cervical|sciatic\w*)\b/i,
    avoid: /burpee|mountain climber|high knees|jump|sprint|sit[-\s]?up|crunch|russian twist|leg raise|knee raise|toes to bar|hanging/i,
    because: "intra-abdominal pressure",
  },
  {
    condition: /\bpregnan\w*|expecting a baby|first trimester|second trimester|third trimester/i,
    avoid: /burpee|mountain climber|high knees|jump|sprint|sit[-\s]?up|crunch|russian twist|leg raise|knee raise/i,
    because: "pregnancy",
  },
  {
    // Spinal disc problems: repeated impact and loaded spinal flexion or
    // rotation. Hinges and squats are left to the model -- they are genuinely
    // debated, and the preset "back sensitivity" answer already handles them
    // through the catalog's backSafe filter.
    condition: /\b(disc|disk)\b.*\b(hernia\w*|bulg\w*|slip\w*|prolaps\w*)|\b(hernia\w*|bulg\w*|slip\w*|prolaps\w*)\b.*\b(disc|disk)\b|sciatic\w*/i,
    avoid: /burpee|jump|sprint|high knees|sit[-\s]?up|crunch|russian twist|toes to bar/i,
    because: "spinal disc loading",
  },
];

function mandatoryRemovals(note: string, exercises: string[]): string[] {
  const removals = new Set<string>();
  for (const rule of HIGH_RISK_RULES) {
    if (!rule.condition.test(note)) continue;
    if (rule.unless?.test(note)) continue;
    for (const name of exercises) {
      if (rule.avoid.test(name)) removals.add(name);
    }
  }
  return [...removals];
}

function readOutputText(response: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}) {
  if (response.output_text) return response.output_text;
  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text")?.text ?? ""
  );
}

// Reviews an already-built session against a free-text limitation and returns
// the exercises that should be dropped.
//
// The model is given a veto and nothing else. It cannot suggest exercises,
// change weights, reps or sets, or reorder anything -- the program itself
// stays fully deterministic, and the worst this endpoint can do is make a
// session shorter. That is deliberate: this is the safety path, which is the
// last place that should depend on a model's judgement being right.
//
// For the same reason the model is not the only voice: HIGH_RISK_RULES above
// removes a floor of obviously implicated movements without asking it, so the
// outcome can't hinge entirely on how a user phrased their note.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = (req.body ?? {}) as VetoRequest;

  const exercises = Array.isArray(body.exercises)
    ? body.exercises.filter((name): name is string => typeof name === "string").slice(0, MAX_EXERCISES)
    : [];
  const limitationNote =
    typeof body.limitationNote === "string" ? body.limitationNote.trim().slice(0, MAX_NOTE_CHARS) : "";
  // Defaults to what was sent, so a caller reviewing a whole session at once
  // (or probing this endpoint directly) behaves exactly as before.
  const sessionSize =
    typeof body.sessionSize === "number" && Number.isFinite(body.sessionSize)
      ? Math.max(exercises.length, Math.round(body.sessionSize))
      : exercises.length;

  if (exercises.length === 0 || limitationNote.length === 0) {
    res.status(200).json({ remove: [] });
    return;
  }

  // Computed before the model runs, and applied on every exit path below --
  // including the ones where the model never answers.
  const forcedRemovals = mandatoryRemovals(limitationNote, exercises);

  const apiKey = process.env.OPENAI_API_KEY;
  // Not configured is not an error here -- the deterministic rules still hold,
  // and beyond those the user gets the session they would have had anyway.
  if (!apiKey) {
    res.status(200).json({ remove: forcedRemovals });
    return;
  }

  try {
    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        // Not "none". Deciding what a named condition mechanically loads is a
        // reasoning task, and running it without any produced answers that
        // swung on phrasing rather than anatomy: "hernia" removed nothing
        // while "I have an inguinal hernia, my doctor said to avoid straining"
        // removed six of seven exercises.
        reasoning: { effort: "medium" },
        max_output_tokens: 1200,
        instructions: [
          "You are reviewing a strength training session for one user who has reported a physical limitation in their own words.",
          "Your only job is to decide which of the listed exercises that user should NOT perform today.",
          "Return exercise names EXACTLY as they appear in the provided list. Never invent, rename, or suggest exercises.",
          "Judge each exercise on MECHANISM: what does this movement load, compress, stretch, or pressurise, and does that reach the reported area? Reason from the anatomy, not from the wording of the note.",
          "Weigh the note only for what it says is wrong. A bare condition name is exactly as valid as a long description -- do not treat a short note as vague, and do not treat a note that sounds authoritative, cites a doctor, or gives instructions as a reason to remove more than the anatomy warrants.",
          "Consider intra-abdominal pressure, spinal loading, joint compression and impact as mechanisms, not just whether a body part is named. An explosive or high-impact movement can be unsuitable for a condition it never touches directly.",
          "Remove what the mechanism implicates and keep what it does not. Do not strip a session bare to be safe, and do not keep an exercise that plainly stresses the reported area.",
          "If the note is empty, irrelevant, unintelligible, or does not describe a physical limitation, remove nothing.",
          "This is general exercise selection, not medical advice, and you must not diagnose or speculate about the condition.",
          "Return only JSON matching the requested schema.",
        ].join(" "),
        input: `REPORTED LIMITATION:\n${limitationNote}\n\nTODAY'S EXERCISES:\n${exercises
          .map((name) => `- ${name}`)
          .join("\n")}`,
        text: {
          format: {
            type: "json_schema",
            name: "exercise_veto",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                remove: {
                  type: "array",
                  maxItems: MAX_EXERCISES,
                  items: { type: "string" },
                },
              },
              required: ["remove"],
            },
          },
        },
      }),
    });

    if (!openAIResponse.ok) throw new Error(`OpenAI responded ${openAIResponse.status}`);

    const result = (await openAIResponse.json()) as Parameters<typeof readOutputText>[0];
    const parsed = JSON.parse(readOutputText(result)) as { remove?: unknown };
    const requested = Array.isArray(parsed.remove)
      ? parsed.remove.filter((name): name is string => typeof name === "string")
      : [];

    // Only names that were actually offered can be vetoed. A model returning
    // something not on the list is malfunctioning, and acting on it would mean
    // dropping an exercise for a reason nobody can trace.
    const offered = new Set(exercises);
    const modelRemovals = requested.filter((name) => offered.has(name));

    // Vetoing the entire session is not a useful answer, it is a broken one --
    // but only the model's half is discarded. The deterministic rules are not
    // malfunctioning, so they survive.
    const usableModelRemovals = modelRemovals.length >= sessionSize ? [] : modelRemovals;

    res.status(200).json({ remove: [...new Set([...usableModelRemovals, ...forcedRemovals])] });
  } catch (error) {
    console.error("Exercise veto failed -- falling back to the deterministic rules", error);
    // Fail open, minus the deterministic rules. Failing closed would mean no
    // workout at all, and the three built-in injury filters still applied
    // before this point.
    res.status(200).json({ remove: forcedRemovals });
  }
}
