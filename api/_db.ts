import { neon } from "@neondatabase/serverless";

const connectionString = process.env.POSTGRES_URL;

export const sql = connectionString ? neon(connectionString) : null;

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!sql) throw new Error("Database is not configured");
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS user_data (
          user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          profile JSONB NOT NULL DEFAULT '{}'::jsonb,
          nutrition_totals JSONB NOT NULL DEFAULT '{}'::jsonb,
          coach_adjustment TEXT,
          exercise_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
          workout_history JSONB NOT NULL DEFAULT '[]'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
    })();
  }
  return schemaReady;
}
