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

  const id = firstValue(req.query?.id);

  try {
    if (id) {
      // The list endpoint below only returns {id, name} for filter-only browsing (by design,
      // to avoid shipping video URLs for every candidate) -- full detail needs a per-id fetch.
      const upstreamResponse = await fetch(`https://api.musclewiki.com/exercises/${encodeURIComponent(id)}`, {
        headers: { "X-API-Key": apiKey },
      });

      if (!upstreamResponse.ok) {
        const errorText = await upstreamResponse.text();
        console.error("MuscleWiki request failed", upstreamResponse.status, errorText.slice(0, 500));
        res.status(502).json({ error: "Exercise catalog is temporarily unavailable." });
        return;
      }

      const raw = (await upstreamResponse.json()) as MuscleWikiExercise;
      res.status(200).json({ exercise: mapExercise(raw) });
      return;
    }

    const search = firstValue(req.query?.search);
    const limit = firstValue(req.query?.limit) ?? "20";

    // /search is a dedicated text-search endpoint that returns full exercise data (videos,
    // steps, muscles) in one call. /exercises (below) is the structured-filter browse endpoint,
    // which only returns {id, name} for filter-only queries -- confirmed by testing both.
    let upstreamUrl: string;
    if (search) {
      const searchParams = new URLSearchParams({ q: search, limit });
      const difficulty = firstValue(req.query?.difficulty);
      if (difficulty) searchParams.set("difficulty", difficulty);
      upstreamUrl = `https://api.musclewiki.com/search?${searchParams.toString()}`;
    } else {
      const params = new URLSearchParams({ limit });
      for (const key of ["offset", "muscles", "category", "difficulty", "force", "mechanic", "grips", "gender"] as const) {
        const value = firstValue(req.query?.[key]);
        if (value) params.set(key, value);
      }
      upstreamUrl = `https://api.musclewiki.com/exercises?${params.toString()}`;
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      headers: { "X-API-Key": apiKey },
    });

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      console.error("MuscleWiki request failed", upstreamResponse.status, errorText.slice(0, 500));
      res.status(502).json({ error: "Exercise catalog is temporarily unavailable." });
      return;
    }

    const body = await upstreamResponse.json();
    const raw: unknown = Array.isArray(body)
      ? body
      : (body as Record<string, unknown>)?.results ??
        (body as Record<string, unknown>)?.exercises ??
        (body as Record<string, unknown>)?.data ??
        (body as Record<string, unknown>)?.items;

    if (!Array.isArray(raw)) {
      console.error("Unexpected MuscleWiki response shape", JSON.stringify(body).slice(0, 800));
      res.status(502).json({ error: "Exercise catalog returned an unexpected response." });
      return;
    }

    // Filter-only browsing (no search text) returns minimal {id, name} objects by design --
    // callers should fetch full detail per-id (via ?id=) for the exercises they actually select.
    const exercises = (raw as Array<Partial<MuscleWikiExercise>>).map((entry) =>
      entry.primary_muscles ? mapExercise(entry as MuscleWikiExercise) : { id: `musclewiki-${entry.id}`, name: entry.name },
    );
    res.status(200).json({ exercises });
  } catch (error) {
    console.error("Exercise catalog error", error);
    res.status(500).json({ error: "Exercise catalog could not complete the request." });
  }
}
