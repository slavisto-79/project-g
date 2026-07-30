type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type DietPlanRequest = {
  profile?: Record<string, string>;
  dietaryStyle?: string;
  mealsPerDay?: string;
  prepTime?: string;
  avoid?: string;
  calorieTarget?: number;
  proteinTarget?: number;
  unitSystem?: "metric" | "imperial";
};

const allowedProfileFields = ["goal", "equipment"] as const;

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

const dietaryStyleLabels: Record<string, string> = {
  none: "no dietary restrictions",
  vegetarian: "vegetarian",
  vegan: "vegan",
  "low-carb": "low-carb",
};

const prepTimeLabels: Record<string, string> = {
  quick: "under 15 minutes of prep per meal",
  moderate: "15-30 minutes of prep per meal",
  any: "no particular time limit per meal",
};

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
    res.status(503).json({ error: "Diet plan generation is not configured yet." });
    return;
  }

  const body = (req.body ?? {}) as DietPlanRequest;
  const profile = safeProfile(body.profile);
  const dietaryStyle = dietaryStyleLabels[body.dietaryStyle ?? "none"] ?? dietaryStyleLabels.none;
  const mealsPerDay = ["3", "4", "5"].includes(body.mealsPerDay ?? "") ? body.mealsPerDay! : "3";
  const prepTime = prepTimeLabels[body.prepTime ?? "any"] ?? prepTimeLabels.any;
  const avoid = typeof body.avoid === "string" ? body.avoid.slice(0, 140) : "";
  const calorieTarget =
    typeof body.calorieTarget === "number" && Number.isFinite(body.calorieTarget)
      ? Math.max(1200, Math.min(4500, Math.round(body.calorieTarget)))
      : 2200;
  const proteinTarget =
    typeof body.proteinTarget === "number" && Number.isFinite(body.proteinTarget)
      ? Math.max(30, Math.min(300, Math.round(body.proteinTarget)))
      : 130;
  const unitSystem = body.unitSystem === "imperial" ? "imperial" : "metric";
  const unitInstruction =
    unitSystem === "imperial"
      ? "US customary portion sizes (cups, oz, tbsp) or whole pieces where natural"
      : "metric portion sizes (g, ml) or whole pieces where natural";

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
        max_output_tokens: 8000,
        instructions: [
          "You are Project G's nutrition assistant, building a full week (7 days) of varied sample meals so the user never has to eat the exact same thing every day.",
          `Build exactly ${mealsPerDay} meals per day, for 7 distinct days, following a ${dietaryStyle} eating style.`,
          "Make the 7 days meaningfully different from each other: rotate protein sources, cuisines, cooking methods, and ingredients. Do not reuse the same meal name or near-identical dish across days.",
          `Respect roughly ${prepTime}.`,
          avoid ? `Avoid these foods entirely: ${avoid}.` : "",
          `Size each day to approximately ${calorieTarget} kcal and ${proteinTarget}g of protein in total; distribute reasonably across that day's meals.`,
          "Use simple, realistic, common ingredients a home cook can find easily.",
          `Each meal's description must mention a realistic portion size using ${unitInstruction}.`,
          "Never claim medical, clinical, or weight-loss guarantees; this is general food inspiration only, not a prescribed diet.",
          "Keep each meal description under 22 words and each day's note under 16 words.",
          "Return only JSON matching the requested schema.",
        ]
          .filter(Boolean)
          .join(" "),
        input: `USER PROFILE:\n${JSON.stringify(profile)}\n\nMEALS PER DAY: ${mealsPerDay}\nDIETARY STYLE: ${dietaryStyle}\nPREP TIME: ${prepTime}\nAVOID: ${avoid || "none"}\nCALORIE TARGET: ${calorieTarget} kcal\nPROTEIN TARGET: ${proteinTarget}g`,
        text: {
          format: {
            type: "json_schema",
            name: "diet_plan_week",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                days: {
                  type: "array",
                  minItems: 7,
                  maxItems: 7,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      meals: {
                        type: "array",
                        minItems: 3,
                        maxItems: 5,
                        items: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            time: { type: "string" },
                            name: { type: "string" },
                            description: { type: "string" },
                            calories: { type: "integer" },
                            protein: { type: "integer" },
                            carbs: { type: "integer" },
                            fat: { type: "integer" },
                          },
                          required: ["time", "name", "description", "calories", "protein", "carbs", "fat"],
                        },
                      },
                      note: { type: "string" },
                    },
                    required: ["meals", "note"],
                  },
                },
              },
              required: ["days"],
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
      console.error("Diet plan request failed", openAIResponse.status, errorText.slice(0, 500));
      res.status(502).json({
        error: "Diet plan generation is temporarily unavailable.",
        providerStatus: openAIResponse.status,
        providerCode,
      });
      return;
    }

    const responseData = await openAIResponse.json();
    const outputText = readOutputText(responseData);
    const result = JSON.parse(outputText) as {
      days: Array<{
        meals: Array<{
          time: string;
          name: string;
          description: string;
          calories: number;
          protein: number;
          carbs: number;
          fat: number;
        }>;
        note: string;
      }>;
    };

    res.status(200).json(result);
  } catch (error) {
    console.error("Diet plan error", error);
    res.status(500).json({ error: "Diet plan could not be generated." });
  }
}
