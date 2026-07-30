type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type CoachRequest = {
  message?: string;
  profile?: Record<string, string>;
  memory?: string;
};

const allowedProfileFields = [
  "goal",
  "sex",
  "age",
  "experience",
  "days",
  "duration",
  "equipment",
  "injuries",
] as const;

function safeProfile(input: unknown) {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  return Object.fromEntries(
    allowedProfileFields.flatMap((field) => {
      const value = source[field];
      return typeof value === "string" ? [[field, value.slice(0, 120)]] : [];
    }),
  );
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

const safeScenarioChanges = {
  tired: ["Reduce working volume by 20%", "Keep technique-focused sets", "Add 30 seconds recovery"],
  pain: ["Stop the aggravating movement", "Use only pain-free alternatives", "Request human coach review"],
  time: ["Keep three priority exercises", "Remove low-priority accessory work", "Target 30 minutes total"],
  equipment: ["Use available-equipment alternatives", "Preserve the planned movement patterns", "Match the planned effort"],
  general: ["Keep today’s planned session", "Prioritize controlled technique", "Review progress after training"],
} as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "AI Coach is not configured yet." });
    return;
  }

  const body = (req.body ?? {}) as CoachRequest;
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 600) : "";
  if (!message) {
    res.status(400).json({ error: "A message is required." });
    return;
  }

  const profile = safeProfile(body.profile);
  const memory = typeof body.memory === "string" ? body.memory.slice(0, 500) : "No workouts logged yet.";

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
        max_output_tokens: 500,
        instructions: [
          "You are Project G AI Coach, a concise, supportive fitness coach backed by a real human coach.",
          "You have an ongoing coaching relationship with this user: use their training history to sound like a coach who remembers their progress, not a stranger meeting them for the first time. Reference specific numbers or trends from it when relevant (e.g. workout count, recent working weights), but only if the current message calls for it -- don't force it in.",
          "Adapt training conservatively using the user's profile, training history, and current message.",
          "Never diagnose an injury or disease. For severe, sudden, worsening, chest-related, neurological, or unexplained pain, tell the user to stop training and seek qualified medical help.",
          "For ordinary discomfort, recommend stopping the aggravating movement, a pain-free alternative, and human coach review.",
          "Do not prescribe medication, supplements, or extreme calorie restriction.",
          "Reply in the same language as the user's message.",
          "Keep the reply under 80 words and each proposed change under 12 words.",
          "Do not include drafting notes, self-critique, alternatives, or hidden reasoning.",
          "Return only JSON matching the requested schema.",
        ].join(" "),
        input: `USER PROFILE:\n${JSON.stringify(profile)}\n\nTRAINING HISTORY:\n${memory}\n\nCURRENT MESSAGE:\n${message}`,
        text: {
          format: {
            type: "json_schema",
            name: "coach_adaptation",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                reply: { type: "string" },
                scenario: {
                  type: "string",
                  enum: ["tired", "pain", "time", "equipment", "general"],
                },
                changes: {
                  type: "array",
                  minItems: 2,
                  maxItems: 3,
                  items: { type: "string" },
                },
                requiresHumanReview: { type: "boolean" },
              },
              required: ["reply", "scenario", "changes", "requiresHumanReview"],
            },
          },
        },
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      let providerCode = "unknown";
      try {
        const providerError = JSON.parse(errorText) as {
          error?: { code?: string; type?: string };
        };
        providerCode = providerError.error?.code ?? providerError.error?.type ?? "unknown";
      } catch {
        // Keep the public error generic when the provider returns a non-JSON response.
      }
      console.error("OpenAI request failed", openAIResponse.status, errorText.slice(0, 500));
      res.status(502).json({
        error: "AI Coach is temporarily unavailable.",
        providerStatus: openAIResponse.status,
        providerCode,
      });
      return;
    }

    const responseData = await openAIResponse.json();
    const outputText = readOutputText(responseData);
    const result = JSON.parse(outputText) as {
      reply: string;
      scenario: "tired" | "pain" | "time" | "equipment" | "general";
      changes: string[];
      requiresHumanReview: boolean;
    };

    res.status(200).json({
      ...result,
      changes: safeScenarioChanges[result.scenario],
    });
  } catch (error) {
    console.error("AI Coach error", error);
    res.status(500).json({ error: "AI Coach could not complete the request." });
  }
}
