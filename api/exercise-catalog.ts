import { mapExercise, type MuscleWikiExercise, type ExerciseTag } from "../lib/exerciseCatalog";

type VercelRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.MUSCLEWIKI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "Exercise catalog is not configured yet." });
    return;
  }

  const search = firstValue(req.query?.search);
  const limit = firstValue(req.query?.limit) ?? "20";

  const upstreamUrl = search
    ? `https://api.musclewiki.com/search?q=${encodeURIComponent(search)}&limit=${encodeURIComponent(limit)}`
    : `https://api.musclewiki.com/exercises?limit=${encodeURIComponent(limit)}`;

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: { "X-API-Key": apiKey },
    });

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      console.error("MuscleWiki request failed", upstreamResponse.status, errorText.slice(0, 500));
      res.status(502).json({ error: "Exercise catalog is temporarily unavailable." });
      return;
    }

    const raw = (await upstreamResponse.json()) as MuscleWikiExercise[];
    const exercises: ExerciseTag[] = raw.map(mapExercise);
    res.status(200).json({ exercises });
  } catch (error) {
    console.error("Exercise catalog error", error);
    res.status(500).json({ error: "Exercise catalog could not complete the request." });
  }
}
