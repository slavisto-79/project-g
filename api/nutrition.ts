type VercelRequest = { method?: string; body?: unknown };
type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
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
    res.status(503).json({ error: "Nutrition AI is not configured." });
    return;
  }

  const body = (req.body ?? {}) as { image?: unknown };
  const image = typeof body.image === "string" ? body.image : "";
  if (!image.startsWith("data:image/") || image.length > 5_500_000) {
    res.status(400).json({ error: "Please upload a valid food photo under 4 MB." });
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
        max_output_tokens: 900,
        instructions: [
          "You are Project G Nutrition AI.",
          "Analyze only foods visibly present in the image.",
          "Estimate portions conservatively and make uncertainty explicit.",
          "Never claim medical accuracy or provide medical advice.",
          "Use common English food names and metric grams.",
          "All calories and macros must be non-negative integers.",
          "Totals must equal the sum of item values.",
          "Return only JSON matching the requested schema.",
        ].join(" "),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Identify this meal and estimate portions, calories, protein, carbohydrates, and fat. The user will confirm or edit the result.",
              },
              { type: "input_image", image_url: image },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "nutrition_analysis",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                items: {
                  type: "array",
                  minItems: 1,
                  maxItems: 8,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      name: { type: "string" },
                      grams: { type: "integer" },
                      calories: { type: "integer" },
                      protein: { type: "integer" },
                      carbs: { type: "integer" },
                      fat: { type: "integer" },
                    },
                    required: ["name", "grams", "calories", "protein", "carbs", "fat"],
                  },
                },
                totals: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    calories: { type: "integer" },
                    protein: { type: "integer" },
                    carbs: { type: "integer" },
                    fat: { type: "integer" },
                  },
                  required: ["calories", "protein", "carbs", "fat"],
                },
                confidence: { type: "string", enum: ["low", "medium", "high"] },
                note: { type: "string" },
              },
              required: ["items", "totals", "confidence", "note"],
            },
          },
        },
      }),
    });

    if (!openAIResponse.ok) {
      console.error("Nutrition AI failed", openAIResponse.status, (await openAIResponse.text()).slice(0, 400));
      res.status(502).json({ error: "Nutrition AI is temporarily unavailable." });
      return;
    }

    const data = await openAIResponse.json();
    const result = JSON.parse(readOutputText(data));
    res.status(200).json(result);
  } catch (error) {
    console.error("Nutrition AI error", error);
    res.status(500).json({ error: "The meal could not be analyzed." });
  }
}
