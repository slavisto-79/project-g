import { sql, ensureSchema } from "./_db";
import { getUserIdFromCookieHeader } from "./_auth";

type VercelRequest = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

type UserDataBody = {
  profile?: Record<string, string>;
  nutritionTotals?: { calories: number; protein: number; carbs: number; fat: number };
  coachAdjustment?: string | null;
  exerciseProgress?: Record<string, { weightKg: number; reps: number }>;
  workoutHistory?: unknown[];
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

  const userId = getUserIdFromCookieHeader(req.headers?.cookie);
  if (!userId) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }

  const body = (req.body ?? {}) as UserDataBody;

  try {
    await ensureSchema();
    await sql`
      UPDATE user_data
      SET
        profile = ${JSON.stringify(body.profile ?? {})}::jsonb,
        nutrition_totals = ${JSON.stringify(
          body.nutritionTotals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 },
        )}::jsonb,
        coach_adjustment = ${body.coachAdjustment ?? null},
        exercise_progress = ${JSON.stringify(body.exerciseProgress ?? {})}::jsonb,
        workout_history = ${JSON.stringify(body.workoutHistory ?? [])}::jsonb,
        updated_at = now()
      WHERE user_id = ${userId}
    `;
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Save user data error", error);
    res.status(500).json({ error: "Could not save your data." });
  }
}
