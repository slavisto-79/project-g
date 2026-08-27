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

// Catalog content is effectively static -- exercise names, muscles and demo
// videos don't change day to day -- while the request pattern is the opposite:
// the same handful of keywords, on every workout build, for every user. Letting
// the CDN answer those is what keeps us under the upstream rate limit.
//
// stale-while-revalidate earns its place beyond the saving: when upstream does
// throttle us, the CDN keeps serving the last good answer instead of dropping
// everyone onto the built-in fallback roster.
const SUCCESS_CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=604800";

// Retrying a 429 only helps when the limit is a short burst window. If it's a
// spent quota, a retry is worse than useless -- it triples the requests we
// make during exactly the period we should be quiet, and pushes the reset
// further away. So: at most one retry, and only when upstream either says
// nothing about when to come back or says "soon".
const SHORT_RETRY_CEILING_MS = 2000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Whatever upstream is willing to say about the limit. Surfaced on failure so
// a burst window and an exhausted quota can be told apart from outside.
function rateLimitHints(response: Response): Record<string, string> {
  const hints: Record<string, string> = {};
  for (const header of [
    "retry-after",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
    "ratelimit-limit",
    "ratelimit-remaining",
    "ratelimit-reset",
  ]) {
    const value = response.headers.get(header);
    if (value) hints[header] = value.slice(0, 64);
  }
  return hints;
}

async function fetchUpstream(url: string, apiKey: string): Promise<Response> {
  const response = await fetch(url, { headers: { "X-API-Key": apiKey } });
  if (response.status !== 429) return response;

  const retryAfterSeconds = Number(response.headers.get("retry-after"));
  const hasRetryAfter = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0;
  // A long Retry-After is upstream telling us the quota is gone. Believe it.
  if (hasRetryAfter && retryAfterSeconds * 1000 > SHORT_RETRY_CEILING_MS) return response;

  await wait(hasRetryAfter ? retryAfterSeconds * 1000 : 400);
  return fetch(url, { headers: { "X-API-Key": apiKey } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Default for every path below. Success overrides it -- a failed or
  // unconfigured response must never be the thing the CDN holds onto.
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
      const upstreamResponse = await fetchUpstream(
        `https://api.musclewiki.com/exercises/${encodeURIComponent(id)}`,
        apiKey,
      );

      if (!upstreamResponse.ok) {
        const errorText = await upstreamResponse.text();
        console.error("MuscleWiki request failed", upstreamResponse.status, errorText.slice(0, 500));
        res.status(502).json({
          error: "Exercise catalog is temporarily unavailable.",
          // The upstream status, so this is diagnosable without log access:
          // 403 means the API key is invalid or expired, 429 means rate
          // limited, 5xx means their side is genuinely down. Only the code
          // is surfaced -- the upstream body stays in the server log.
          upstreamStatus: upstreamResponse.status,
          rateLimit: rateLimitHints(upstreamResponse),
        });
        return;
      }

      const raw = (await upstreamResponse.json()) as MuscleWikiExercise;
      res.setHeader("Cache-Control", SUCCESS_CACHE_CONTROL);
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

    const upstreamResponse = await fetchUpstream(upstreamUrl, apiKey);

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      console.error("MuscleWiki request failed", upstreamResponse.status, errorText.slice(0, 500));
      res.status(502).json({
          error: "Exercise catalog is temporarily unavailable.",
          // The upstream status, so this is diagnosable without log access:
          // 403 means the API key is invalid or expired, 429 means rate
          // limited, 5xx means their side is genuinely down. Only the code
          // is surfaced -- the upstream body stays in the server log.
          upstreamStatus: upstreamResponse.status,
          rateLimit: rateLimitHints(upstreamResponse),
        });
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
    res.setHeader("Cache-Control", SUCCESS_CACHE_CONTROL);
    res.status(200).json({ exercises });
  } catch (error) {
    console.error("Exercise catalog error", error);
    res.status(500).json({ error: "Exercise catalog could not complete the request." });
  }
}
