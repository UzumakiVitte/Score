-- Scorekeeper V26.1 additive migration.
-- Run this only if the existing schema does not already contain these columns.
-- This migration does NOT modify any game scoring rules.

alter table if exists public.profiles
  add column if not exists last_login_at timestamptz;

-- Helpful indexes only. Existing data and scoring are untouched.
create index if not exists profiles_last_login_at_idx
  on public.profiles(last_login_at);

-- Optional activity tables are intentionally NOT created here.
-- Existing game/player relationships should be inspected before adding
-- duplicate structures to a live database.
