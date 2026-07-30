type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type MealImageRequest = {
  name?: string;
  description?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "Meal photo generation is not configured yet." });
    return;
  }

  const body = (req.body ?? {}) as MealImageRequest;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) {
    res.status(400).json({ error: "A meal name is required." });
    return;
  }
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 200) : "";

  try {
    const openAIResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1-mini",
        prompt: `A single appetizing, realistic food photo of this home-cooked meal: ${name}. ${description} Overhead angle, natural daylight, simple plate or bowl, no text, no logos, no hands, no people.`,
        size: "1024x1024",
        quality: "low",
        n: 1,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error("Meal image request failed", openAIResponse.status, errorText.slice(0, 500));
      res.status(502).json({ error: "Meal photo is temporarily unavailable." });
      return;
    }

    const responseData = await openAIResponse.json();
    const b64 = responseData?.data?.[0]?.b64_json as string | undefined;
    if (!b64) {
      res.status(502).json({ error: "Meal photo could not be generated." });
      return;
    }

    res.status(200).json({ image: `data:image/png;base64,${b64}` });
  } catch (error) {
    console.error("Meal image error", error);
    res.status(500).json({ error: "The photo could not be generated." });
  }
}
