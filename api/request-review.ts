type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type ReviewRequest = {
  message?: string;
  reply?: string;
  profile?: Record<string, string>;
};

const allowedProfileFields = [
  "goal",
  "sex",
  "age",
  "experience",
  "days",
  "duration",
  "equipment",
  "injuries",
] as const;

function safeProfile(input: unknown) {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  return Object.fromEntries(
    allowedProfileFields.flatMap((field) => {
      const value = source[field];
      return typeof value === "string" ? [[field, value.slice(0, 120)]] : [];
    }),
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.COACH_REVIEW_EMAIL;
  if (!apiKey || !recipient) {
    res.status(503).json({ error: "Coach review is not configured yet." });
    return;
  }

  const body = (req.body ?? {}) as ReviewRequest;
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 600) : "";
  const reply = typeof body.reply === "string" ? body.reply.trim().slice(0, 600) : "";
  if (!message) {
    res.status(400).json({ error: "A message is required." });
    return;
  }

  const profile = safeProfile(body.profile);
  const profileLines = Object.entries(profile)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n") || "No profile on file.";

  try {
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Project G Coach Requests <onboarding@resend.dev>",
        to: [recipient],
        subject: "Project G — coach review requested",
        text: `A user flagged a message for human coach review.\n\nUser message:\n${message}\n\nAI reply shown to user:\n${reply || "(none)"}\n\nProfile:\n${profileLines}`,
        html: `<p><strong>A user flagged a message for human coach review.</strong></p><p><strong>User message:</strong><br/>${escapeHtml(message)}</p><p><strong>AI reply shown to user:</strong><br/>${escapeHtml(reply || "(none)")}</p><p><strong>Profile:</strong><br/>${escapeHtml(profileLines).replace(/\n/g, "<br/>")}</p>`,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend request failed", emailResponse.status, errorText.slice(0, 500));
      res.status(502).json({ error: "Coach review could not be sent right now." });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Coach review error", error);
    res.status(500).json({ error: "Coach review could not be sent right now." });
  }
}
