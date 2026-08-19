-- ScoreMate Classic database update
-- Safe to run after your original ScoreMate schema.
-- This file also works for a fresh project.

create extension if not exists pgcrypto;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active','completed')),
  round integer not null default 1,
  winning_score integer not null default 500,
  winner_rule text not null default 'higher' check (winner_rule in ('higher','lower')),
  sort_mode text not null default 'custom' check (sort_mode in ('custom','highest','lowest')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  score integer not null default 0,
  player_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(game_id, player_id)
);

create table if not exists public.score_changes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  round integer not null default 1,
  delta integer not null,
  created_at timestamptz not null default now()
);

alter table public.players add column if not exists avatar_url text;
alter table public.games add column if not exists sort_mode text;
alter table public.game_players add column if not exists player_order integer;

update public.games set sort_mode = 'custom' where sort_mode is null;
update public.game_players gp
set player_order = sub.rn - 1
from (
  select id, row_number() over (partition by game_id order by created_at, id) rn
  from public.game_players
) sub
where gp.id = sub.id and gp.player_order is null;

alter table public.games alter column sort_mode set default 'custom';
alter table public.games alter column sort_mode set not null;
alter table public.game_players alter column player_order set default 0;
alter table public.game_players alter column player_order set not null;

alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.score_changes enable row level security;

drop policy if exists "Public can read players" on public.players;
drop policy if exists "Public can create players" on public.players;
drop policy if exists "Public can update players" on public.players;
drop policy if exists "Public can delete players" on public.players;
create policy "Public can read players" on public.players for select using (true);
create policy "Public can create players" on public.players for insert with check (true);
create policy "Public can update players" on public.players for update using (true) with check (true);
create policy "Public can delete players" on public.players for delete using (true);

drop policy if exists "Public can read games" on public.games;
drop policy if exists "Public can create games" on public.games;
drop policy if exists "Public can update games" on public.games;
drop policy if exists "Public can delete games" on public.games;
create policy "Public can read games" on public.games for select using (true);
create policy "Public can create games" on public.games for insert with check (true);
create policy "Public can update games" on public.games for update using (true) with check (true);
create policy "Public can delete games" on public.games for delete using (true);

drop policy if exists "Public can read game players" on public.game_players;
drop policy if exists "Public can create game players" on public.game_players;
drop policy if exists "Public can update game players" on public.game_players;
drop policy if exists "Public can delete game players" on public.game_players;
create policy "Public can read game players" on public.game_players for select using (true);
create policy "Public can create game players" on public.game_players for insert with check (true);
create policy "Public can update game players" on public.game_players for update using (true) with check (true);
create policy "Public can delete game players" on public.game_players for delete using (true);

drop policy if exists "Public can read score changes" on public.score_changes;
drop policy if exists "Public can create score changes" on public.score_changes;
drop policy if exists "Public can delete score changes" on public.score_changes;
create policy "Public can read score changes" on public.score_changes for select using (true);
create policy "Public can create score changes" on public.score_changes for insert with check (true);
create policy "Public can delete score changes" on public.score_changes for delete using (true);

create index if not exists idx_game_players_game on public.game_players(game_id);
create index if not exists idx_game_players_order on public.game_players(game_id, player_order);
create index if not exists idx_score_changes_game on public.score_changes(game_id);
create index if not exists idx_score_changes_player on public.score_changes(game_id, player_id);
create index if not exists idx_score_changes_time on public.score_changes(created_at);

insert into storage.buckets (id, name, public)
values ('player-avatars','player-avatars',true)
on conflict (id) do update set public=true;

drop policy if exists "Public can view player avatars" on storage.objects;
drop policy if exists "Public can upload player avatars" on storage.objects;
drop policy if exists "Public can update player avatars" on storage.objects;
drop policy if exists "Public can delete player avatars" on storage.objects;

create policy "Public can view player avatars" on storage.objects
for select using (bucket_id='player-avatars');
create policy "Public can upload player avatars" on storage.objects
for insert with check (bucket_id='player-avatars');
create policy "Public can update player avatars" on storage.objects
for update using (bucket_id='player-avatars') with check (bucket_id='player-avatars');
create policy "Public can delete player avatars" on storage.objects
for delete using (bucket_id='player-avatars');
