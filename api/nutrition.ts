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

  const body = (req.body ?? {}) as { image?: unknown; correction?: unknown; previousResult?: unknown };
  const image = typeof body.image === "string" ? body.image : "";
  if (!image.startsWith("data:image/") || image.length > 5_500_000) {
    res.status(400).json({ error: "Please upload a valid food photo under 4 MB." });
    return;
  }
  const correction = typeof body.correction === "string" ? body.correction.trim().slice(0, 400) : "";
  const previousResult =
    body.previousResult && typeof body.previousResult === "object" ? JSON.stringify(body.previousResult).slice(0, 3000) : "";

  try {
    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        reasoning: { effort: "low" },
        max_output_tokens: 1400,
        instructions: [
          "You are Project G Nutrition AI.",
          "Do not rely on what foods commonly appear together (e.g. a typical fruit salad list). Ground every item strictly in this specific photo -- before finalizing, re-check each candidate item against the actual pixels and drop any item you added from expectation rather than direct visual evidence.",
          "Analyze only foods visibly present in the image. Never invent an item that is not clearly identifiable -- if part of a pile looks ambiguous (e.g. pale fruit flesh that could be mistaken for a different fruit), treat it as part of the same item you already identified rather than reporting it as a separate food.",
          "Each distinct pile or component gets exactly one entry. Do not split a single visible pile into two guesses at what it might be -- pick the single most likely identity.",
          "Look closely before naming a food: distinguish similar-looking staples carefully (e.g. rice vs bulgur vs couscous vs quinoa vs orzo; grilled vs fried vs baked vs boiled; a whole egg fried in oil vs an egg baked/set on top of a dish).",
          "List every visually distinguishable component separately, including mixed-in vegetables, herbs, and sauces, not just the dominant ingredient.",
          "Estimate each portion's mass from its visual volume relative to the plate, board, or hand also in frame. Do not default to a small conservative portion when a pile visibly fills a large share of that surface -- undercounting a large pile is as much an error as overcounting a small one.",
          "State uncertainty in the note field rather than by shrinking portions.",
          "If the user provides a correction, treat their stated facts as ground truth for that detail, re-estimate the affected macros accordingly, and keep the rest of the analysis unless the correction implies more changes.",
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
                text: correction
                  ? `Here is your previous analysis of this same photo:\n${previousResult}\n\nThe user says: "${correction}"\n\nRe-analyze the meal in the photo, applying this correction, and return the corrected full analysis.`
                  : "Identify this meal and estimate portions, calories, protein, carbohydrates, and fat. The user will confirm or edit the result.",
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
