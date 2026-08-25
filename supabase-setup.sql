-- Run this once in the Supabase SQL Editor for project-g.

create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  nutrition_totals jsonb not null default '{}'::jsonb,
  coach_adjustment text,
  exercise_progress jsonb not null default '{}'::jsonb,
  workout_history jsonb not null default '[]'::jsonb,
  diet_plan jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "Users can view their own data" on public.user_data;
create policy "Users can view their own data"
  on public.user_data for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own data" on public.user_data;
create policy "Users can insert their own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own data" on public.user_data;
create policy "Users can update their own data"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Automatically create an empty user_data row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_data (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Safe to re-run: adds the diet_plan column for databases created before it existed.
alter table public.user_data add column if not exists diet_plan jsonb;

-- Safe to re-run: adds trial_started_at (defaults to now() for new rows via the
-- signup trigger above; backfills existing rows to now() as well).
alter table public.user_data add column if not exists trial_started_at timestamptz not null default now();

-- Safe to re-run: RLS policies above only control WHICH rows a role can touch --
-- the role also needs base table privileges, or every query 403s with
-- "permission denied" (Postgres error 42501) even though the policies are correct.
-- Without this, signed-in users can never load or save their profile, which looks
-- exactly like getting logged out on every reload.
grant usage on schema public to authenticated;
grant select, insert, update on public.user_data to authenticated;

-- Safe to re-run: adds coach_messages so the AI Coach chat thread persists
-- across reloads/devices instead of resetting every time the screen opens.
alter table public.user_data add column if not exists coach_messages jsonb not null default '[]'::jsonb;

-- Safe to re-run: adds daily_check_in so the pre-workout readiness check-in
-- (sleep/nutrition/fatigue/stress, each 1-10) survives reloads and follows the
-- user across devices. Nullable and date-stamped -- only a check-in dated today
-- affects the plan, so a stale row simply stops counting rather than needing a
-- scheduled reset.
alter table public.user_data add column if not exists daily_check_in jsonb;

-- Safe to re-run: adds earned_badges, a map of badge id -> the ISO date it was
-- first earned. Achievements are sealed on earning rather than recomputed from
-- live stats every render, so one can never be taken back: totals that shift
-- (bodyweight volume on old history is recomputed from the current profile
-- weight) would otherwise be able to drop a total back under a threshold the
-- user had already passed.
alter table public.user_data add column if not exists earned_badges jsonb not null default '{}'::jsonb;
