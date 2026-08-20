-- Scorekeeper private accounts schema
-- Run after the original Scorekeeper schema.
-- IMPORTANT: In Supabase Dashboard, Authentication > Providers > Email, turn OFF
-- "Confirm email" because the app presents username + password and does not expose email.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

alter table public.players add column if not exists owner_id uuid;
alter table public.games add column if not exists owner_id uuid;
alter table public.game_players add column if not exists owner_id uuid;
alter table public.score_changes add column if not exists owner_id uuid;

create index if not exists idx_players_owner on public.players(owner_id);
create index if not exists idx_games_owner on public.games(owner_id);
create index if not exists idx_game_players_owner on public.game_players(owner_id);
create index if not exists idx_score_changes_owner on public.score_changes(owner_id);

alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.score_changes enable row level security;

-- Remove the old public policies.
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='public' and tablename in ('players','games','game_players','score_changes','profiles') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "Profiles are private" on public.profiles
for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Users own players" on public.players
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Users own games" on public.games
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Users own game players" on public.game_players
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Users own score changes" on public.score_changes
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Automatically create a profile when a new auth account is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1))))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- New accounts can only see rows they own. Any old rows with NULL owner_id are intentionally
-- hidden after this migration. If you need to keep an old game, create/login to your account
-- first, then we can provide a one-time migration query to assign those legacy rows.
