import { sql, ensureSchema } from "../_db";
import { verifyPassword, createSessionCookie } from "../_auth";

type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!sql) {
    res.status(503).json({ error: "Accounts are not configured yet." });
    return;
  }

  const body = (req.body ?? {}) as { email?: string; password?: string };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    res.status(400).json({ error: "Enter your email and password." });
    return;
  }

  try {
    await ensureSchema();
    const rows = await sql`SELECT id, password_hash FROM users WHERE email = ${email}`;
    const user = rows[0] as { id: string; password_hash: string } | undefined;
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      res.status(401).json({ error: "Incorrect email or password." });
      return;
    }
    res.setHeader("Set-Cookie", createSessionCookie(user.id));
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Login error", error);
    res.status(500).json({ error: "Could not sign you in." });
  }
}
