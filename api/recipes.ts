type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type RecipesRequest = {
  proteinRemaining?: number;
  profile?: Record<string, string>;
  unitSystem?: "metric" | "imperial";
};

// Gym equipment says nothing about what someone should eat -- it was noise
// in the prompt, carried over from the endpoints that genuinely need it.
const allowedProfileFields = ["goal", "sex"] as const;

function safeProfile(input: unknown) {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  return Object.fromEntries(
    allowedProfileFields.flatMap((field) => {
      const value = source[field];
      return typeof value === "string" ? [[field, value.slice(0, 60)]] : [];
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "Recipe suggestions are not configured yet." });
    return;
  }

  const body = (req.body ?? {}) as RecipesRequest;
  const proteinRemaining =
    typeof body.proteinRemaining === "number" && Number.isFinite(body.proteinRemaining)
      ? Math.max(0, Math.min(300, Math.round(body.proteinRemaining)))
      : 0;
  if (proteinRemaining <= 0) {
    res.status(400).json({ error: "No remaining protein target to suggest recipes for." });
    return;
  }

  const profile = safeProfile(body.profile);
  const unitSystem = body.unitSystem === "imperial" ? "imperial" : "metric";
  const unitInstruction =
    unitSystem === "imperial"
      ? "US customary units (cups, tbsp, tsp, oz, lb) or whole pieces where natural (e.g. \"2 eggs\")"
      : "metric units (g, ml) or whole pieces where natural (e.g. \"2 eggs\")";

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
        max_output_tokens: 900,
        instructions: [
          "You are Project G's recipe assistant.",
          "Suggest simple, realistic recipes a home cook can make to help close today's remaining protein gap.",
          "Prefer whole foods and common ingredients. Keep each recipe achievable in under 30 minutes unless it is clearly a slow-cook dish.",
          "Respect the user's stated goal when relevant.",
          "Never claim medical, nutritional, or weight-loss guarantees; this is general food inspiration only.",
          "Keep descriptions under 20 words. List 3-8 ingredients per recipe.",
          `Each ingredient must start with a realistic single-serving quantity, using ${unitInstruction}, followed by the ingredient name (e.g. "200g Greek yogurt" or "3/4 cup rolled oats").`,
          "Return only JSON matching the requested schema.",
        ].join(" "),
        input: `USER PROFILE:\n${JSON.stringify(profile)}\n\nREMAINING PROTEIN TARGET FOR TODAY: ${proteinRemaining}g`,
        text: {
          format: {
            type: "json_schema",
            name: "recipe_suggestions",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                recipes: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      minutes: { type: "integer" },
                      ingredients: {
                        type: "array",
                        minItems: 3,
                        maxItems: 8,
                        items: { type: "string" },
                      },
                      calories: { type: "integer" },
                      protein: { type: "integer" },
                      carbs: { type: "integer" },
                      fat: { type: "integer" },
                    },
                    required: ["name", "description", "minutes", "ingredients", "calories", "protein", "carbs", "fat"],
                  },
                },
              },
              required: ["recipes"],
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
      console.error("Recipe suggestion request failed", openAIResponse.status, errorText.slice(0, 500));
      res.status(502).json({
        error: "Recipe suggestions are temporarily unavailable.",
        providerStatus: openAIResponse.status,
        providerCode,
      });
      return;
    }

    const responseData = await openAIResponse.json();
    const outputText = readOutputText(responseData);
    const result = JSON.parse(outputText) as {
      recipes: Array<{
        name: string;
        description: string;
        minutes: number;
        ingredients: string[];
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
      }>;
    };

    res.status(200).json(result);
  } catch (error) {
    console.error("Recipe suggestion error", error);
    res.status(500).json({ error: "Recipe suggestions could not be generated." });
  }
}
