type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type MealDetailRequest = {
  name?: string;
  description?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  unitSystem?: "metric" | "imperial";
  prepTime?: string;
  budget?: string;
};

const prepTimeGuidance: Record<string, string> = {
  quick:
    "The steps must realistically take under 15 minutes of active prep in total. Only use no-cook or near-instant techniques: raw, pre-cooked, or canned proteins, microwaved or quick-boiled staples, and simple no-heat assembly. Never include oven-roasting, marinating, slow-cooking, or pan-searing raw meat/fish from scratch. Use 5 or fewer ingredients.",
  moderate:
    "The steps must realistically take 15-30 minutes of active prep in total. Simple stovetop cooking is fine, but avoid oven-roasting whole vegetables, marinating, slow-cooking, or multi-stage techniques.",
  any: "No particular time limit -- oven-roasting, slow-cooking, and multi-step techniques are all fine.",
};

const budgetGuidance: Record<string, string> = {
  budget:
    "The ingredients must be affordable, widely available staples: eggs, oats, rice, pasta, potatoes, canned tuna or beans, lentils, chicken thighs or drumsticks, ground meat, frozen or in-season vegetables, plain yogurt, and similar everyday basics. Never use premium proteins (salmon, steak, shrimp, lamb), out-of-season or exotic produce, or specialty/imported ingredients.",
  moderate:
    "Favor affordable everyday staples; a moderately priced ingredient (chicken breast, salmon, ground beef) is fine, but avoid premium or luxury ingredients.",
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
    res.status(503).json({ error: "Meal detail generation is not configured yet." });
    return;
  }

  const body = (req.body ?? {}) as MealDetailRequest;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) {
    res.status(400).json({ error: "A meal name is required." });
    return;
  }
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 240) : "";
  const calories = typeof body.calories === "number" && Number.isFinite(body.calories) ? body.calories : 0;
  const protein = typeof body.protein === "number" && Number.isFinite(body.protein) ? body.protein : 0;
  const carbs = typeof body.carbs === "number" && Number.isFinite(body.carbs) ? body.carbs : 0;
  const fat = typeof body.fat === "number" && Number.isFinite(body.fat) ? body.fat : 0;
  const unitSystem = body.unitSystem === "imperial" ? "imperial" : "metric";
  const prepGuidance = prepTimeGuidance[body.prepTime ?? "any"] ?? prepTimeGuidance.any;
  const budgetGuidanceText = budgetGuidance[body.budget ?? "any"] ?? budgetGuidance.any;

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
        max_output_tokens: 700,
        instructions: [
          "You are Project G's nutrition assistant, building a full recipe (ingredient quantities and cooking steps) for one specific meal that was already named and macro-targeted.",
          "Build a realistic ingredient list with a home-cook-friendly quantity for each ingredient, given in both metric (g/ml) and US customary (cups/oz/tbsp) units.",
          "Build clear, numbered cooking steps a beginner could follow.",
          prepGuidance,
          budgetGuidanceText,
          "The ingredients and portions should roughly justify the given calories and macros for this meal -- use them as a sanity check, not a rigid formula.",
          "Use simple, common ingredients and equipment.",
          "Never claim medical, clinical, or weight-loss guarantees; this is general food inspiration only.",
          "Keep each step under 18 words.",
          "Return only JSON matching the requested schema.",
        ].join(" "),
        input: `MEAL: ${name}\nDESCRIPTION: ${description}\nTARGET MACROS: ${calories} kcal, P${protein}g, C${carbs}g, F${fat}g\nPREFERRED UNITS: ${unitSystem}`,
        text: {
          format: {
            type: "json_schema",
            name: "meal_detail",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                ingredients: {
                  type: "array",
                  minItems: 2,
                  maxItems: 8,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      name: { type: "string" },
                      metric: { type: "string" },
                      imperial: { type: "string" },
                    },
                    required: ["name", "metric", "imperial"],
                  },
                },
                steps: {
                  type: "array",
                  minItems: 2,
                  maxItems: 6,
                  items: { type: "string" },
                },
              },
              required: ["ingredients", "steps"],
            },
          },
        },
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error("Meal detail request failed", openAIResponse.status, errorText.slice(0, 500));
      res.status(502).json({ error: "Meal detail is temporarily unavailable." });
      return;
    }

    const responseData = await openAIResponse.json();
    const outputText = readOutputText(responseData);
    const result = JSON.parse(outputText) as {
      ingredients: Array<{ name: string; metric: string; imperial: string }>;
      steps: string[];
    };

    res.status(200).json(result);
  } catch (error) {
    console.error("Meal detail error", error);
    res.status(500).json({ error: "The recipe could not be generated." });
  }
}
