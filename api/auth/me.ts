import { sql, ensureSchema } from "../_db";
import { getUserIdFromCookieHeader } from "../_auth";

type VercelRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
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

  try {
    await ensureSchema();
    const rows = await sql`
      SELECT u.email, d.profile, d.nutrition_totals, d.coach_adjustment, d.exercise_progress, d.workout_history
      FROM users u
      JOIN user_data d ON d.user_id = u.id
      WHERE u.id = ${userId}
    `;
    const row = rows[0] as
      | {
          email: string;
          profile: Record<string, string>;
          nutrition_totals: { calories: number; protein: number; carbs: number; fat: number };
          coach_adjustment: string | null;
          exercise_progress: Record<string, { weightKg: number; reps: number }>;
          workout_history: unknown[];
        }
      | undefined;
    if (!row) {
      res.status(401).json({ error: "Not signed in." });
      return;
    }
    res.status(200).json({
      email: row.email,
      profile: row.profile ?? {},
      nutritionTotals: row.nutrition_totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 },
      coachAdjustment: row.coach_adjustment ?? null,
      exerciseProgress: row.exercise_progress ?? {},
      workoutHistory: row.workout_history ?? [],
    });
  } catch (error) {
    console.error("Me error", error);
    res.status(500).json({ error: "Could not load your data." });
  }
}
