type VercelRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  send: (body: unknown) => void;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const ALLOWED_HOST = "api.musclewiki.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.MUSCLEWIKI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "Video proxy is not configured yet." });
    return;
  }

  const targetUrl = firstValue(req.query?.url);
  if (!targetUrl) {
    res.status(400).json({ error: "A url is required." });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    res.status(400).json({ error: "Invalid url." });
    return;
  }

  // Only ever proxy to MuscleWiki's own CDN -- never an arbitrary caller-supplied host.
  if (parsed.hostname !== ALLOWED_HOST) {
    res.status(400).json({ error: "Unsupported host." });
    return;
  }

  const range = firstValue(req.headers?.range);

  try {
    const upstreamResponse = await fetch(parsed.toString(), {
      headers: {
        "X-API-Key": apiKey,
        ...(range ? { Range: range } : {}),
      },
    });

    if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
      res.status(502).json({ error: "Video is temporarily unavailable." });
      return;
    }

    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Content-Type", upstreamResponse.headers.get("content-type") ?? "video/mp4");
    const contentLength = upstreamResponse.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    const contentRange = upstreamResponse.headers.get("content-range");
    if (contentRange) res.setHeader("Content-Range", contentRange);
    res.setHeader("Accept-Ranges", "bytes");

    res.status(upstreamResponse.status);
    const buffer = Buffer.from(await upstreamResponse.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    console.error("Video proxy error", error);
    res.status(500).json({ error: "Video proxy could not complete the request." });
  }
}
