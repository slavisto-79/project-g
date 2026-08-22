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
  budget?: string;
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
  quick: "under 15 minutes of active prep per meal",
  moderate: "15-30 minutes of active prep per meal",
  any: "no particular time limit per meal",
};

const prepTimeGuidance: Record<string, string> = {
  quick:
    "Every meal must realistically be ready in under 15 minutes of active prep. Only use no-cook or near-instant techniques: raw, pre-cooked, or canned proteins (eggs, Greek yogurt, canned tuna/salmon, pre-cooked or rotisserie chicken, deli meat, cottage cheese), microwaved or quick-boiled staples (instant/quick oats, pre-cooked rice pouches, quick-boil pasta), and simple no-heat assembly (wraps, bowls, sandwiches, salads, smoothies). Never require oven-roasting, marinating, slow-cooking, or pan-searing raw meat or fish from scratch. Prefer 5 or fewer ingredients per meal.",
  moderate:
    "Every meal should realistically be ready in 15-30 minutes of active prep. Simple stovetop cooking is fine (pan-searing thin cuts of raw meat/fish, sauteing vegetables, boiling pasta or rice), but avoid oven-roasting whole vegetables, marinating, slow-cooking, or multi-stage recipes.",
  any: "No particular time limit -- oven-roasting, slow-cooking, and multi-step recipes are all fine.",
};

const budgetLabels: Record<string, string> = {
  budget: "tight budget, affordable everyday ingredients only",
  moderate: "moderate budget, occasional pricier ingredients are fine",
  any: "no particular budget limit",
};

const budgetGuidance: Record<string, string> = {
  budget:
    "Every meal must be built from affordable, widely available staples: eggs, oats, rice, pasta, potatoes, canned tuna or beans, lentils, chicken thighs or drumsticks, ground meat, frozen or in-season vegetables, plain yogurt, and similar everyday basics. Never use premium proteins (salmon, steak, shrimp, lamb), out-of-season or exotic produce, or specialty/imported ingredients -- the whole week should be realistic for someone watching grocery spending closely.",
  moderate:
    "Favor affordable everyday staples but a moderately priced ingredient (chicken breast, salmon, ground beef) once or twice across the week is fine. Avoid consistently premium or luxury ingredients every day.",
  any: "No particular budget constraint -- any realistic grocery ingredients are fine.",
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
  const prepGuidance = prepTimeGuidance[body.prepTime ?? "any"] ?? prepTimeGuidance.any;
  const budget = budgetLabels[body.budget ?? "any"] ?? budgetLabels.any;
  const budgetGuidanceText = budgetGuidance[body.budget ?? "any"] ?? budgetGuidance.any;
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
          prepGuidance,
          budgetGuidanceText,
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
        input: `USER PROFILE:\n${JSON.stringify(profile)}\n\nMEALS PER DAY: ${mealsPerDay}\nDIETARY STYLE: ${dietaryStyle}\nPREP TIME: ${prepTime}\nBUDGET: ${budget}\nAVOID: ${avoid || "none"}\nCALORIE TARGET: ${calorieTarget} kcal\nPROTEIN TARGET: ${proteinTarget}g`,
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
