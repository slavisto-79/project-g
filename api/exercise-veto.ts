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
};

const MAX_EXERCISES = 12;
const MAX_NOTE_CHARS = 300;

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

  if (exercises.length === 0 || limitationNote.length === 0) {
    res.status(200).json({ remove: [] });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  // Not configured is not an error here -- it just means no veto is applied,
  // and the user gets the same session they would have got anyway.
  if (!apiKey) {
    res.status(200).json({ remove: [] });
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
        reasoning: { effort: "none" },
        max_output_tokens: 400,
        instructions: [
          "You are reviewing a strength training session for one user who has reported a physical limitation in their own words.",
          "Your only job is to decide which of the listed exercises that user should NOT perform today.",
          "Return exercise names EXACTLY as they appear in the provided list. Never invent, rename, or suggest exercises.",
          "Remove an exercise only when it directly loads or aggravates the reported area. Be conservative in both directions: do not strip a session bare over a vague complaint, and do not keep an exercise that clearly stresses the injured area.",
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
    const remove = requested.filter((name) => offered.has(name));

    // Vetoing the entire session is not a useful answer, it is a broken one.
    if (remove.length >= exercises.length) {
      res.status(200).json({ remove: [] });
      return;
    }

    res.status(200).json({ remove });
  } catch (error) {
    console.error("Exercise veto failed -- returning the session unchanged", error);
    // Fail open. Failing closed would mean no workout at all, and the three
    // built-in injury filters still applied before this point, so the user
    // gets exactly the session they would have had without this feature.
    res.status(200).json({ remove: [] });
  }
}
