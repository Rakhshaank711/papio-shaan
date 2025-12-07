-- Supabase schema for Paper-style multiplayer MVP
-- Run this in the Supabase SQL editor or include in migrations.

-- Users hold virtual coin balances.
create table if not exists public.users (
  id uuid primary key,
  username text,
  coins integer not null default 1000,
  created_at timestamptz not null default now()
);

-- Matches track each room game played.
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  status text not null,
  entry_cost integer not null,
  total_pool integer not null,
  created_at timestamptz not null default now()
);

-- Per-player results for a match.
create table if not exists public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete cascade,
  user_id uuid,
  player_id text not null,
  final_territory_cells integer not null default 0,
  final_reward integer not null default 0,
  is_winner boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists match_players_match_id_idx on public.match_players (match_id);
create index if not exists matches_room_id_idx on public.matches (room_id);

-- Helper to atomically adjust a user's coin balance.
create or replace function public.increment_user_coins(user_uuid uuid, amount integer)
returns void
language sql
as $$
  update public.users set coins = coins + amount where id = user_uuid;
$$;
