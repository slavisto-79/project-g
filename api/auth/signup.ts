import { randomUUID } from "crypto";
import { sql, ensureSchema } from "../_db";
import { hashPassword, createSessionCookie } from "../_auth";

type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  try {
    await ensureSchema();
    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }
    const passwordHash = await hashPassword(password);
    const userId = randomUUID();
    await sql`INSERT INTO users (id, email, password_hash) VALUES (${userId}, ${email}, ${passwordHash})`;
    await sql`INSERT INTO user_data (user_id) VALUES (${userId})`;
    res.setHeader("Set-Cookie", createSessionCookie(userId));
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Signup error", error);
    res.status(500).json({ error: "Could not create the account." });
  }
}
