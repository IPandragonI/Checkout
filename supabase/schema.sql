-- Checkout: online rooms schema. Run in the Supabase SQL editor (or any Postgres client).
-- Game state is never stored directly: every client replays the ordered visit log.
-- Safe to re-run. Uses single-quoted function bodies (no $$) so clients that split on ";" cope.

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{4}$'),
  start_score int not null check (start_score between 101 and 1001),
  double_out boolean not null default true,
  legs_to_win int not null default 1 check (legs_to_win between 1 and 11),
  status text not null default 'lobby' check (status in ('lobby', 'playing')),
  -- Incremented for each rematch; visits belong to one match.
  match_no int not null default 1,
  -- Bumped on deletes so clients know to refetch (Realtime DELETE events can't be filtered).
  version int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  device_id text not null,
  position int not null,
  created_at timestamptz not null default now(),
  unique (room_id, position)
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  match_no int not null,
  -- Position in the match's visit log; the unique key rejects two phones scoring the same turn.
  seq int not null check (seq >= 0),
  player_id uuid not null references public.players (id) on delete cascade,
  score int not null check (score between 0 and 180),
  darts jsonb,
  darts_thrown int not null check (darts_thrown between 1 and 3),
  bust boolean not null default false,
  checkout boolean not null default false,
  created_at timestamptz not null default now(),
  unique (room_id, match_no, seq)
);

create index if not exists players_room_idx on public.players (room_id);

create or replace function public.bump_room_version()
returns trigger
language plpgsql
security definer
set search_path = public
as 'begin update public.rooms set version = version + 1 where id = old.room_id; return old; end;';

drop trigger if exists visits_bump_room on public.visits;
create trigger visits_bump_room after delete on public.visits
  for each row execute function public.bump_room_version();

drop trigger if exists players_bump_room on public.players;
create trigger players_bump_room after delete on public.players
  for each row execute function public.bump_room_version();

-- Realtime: add each table to the publication unless it is already there.
do 'declare t text; begin
  foreach t in array array[''rooms'', ''players'', ''visits''] loop
    if not exists (select 1 from pg_publication_tables where pubname = ''supabase_realtime'' and schemaname = ''public'' and tablename = t) then
      execute format(''alter publication supabase_realtime add table public.%I'', t);
    end if;
  end loop;
end;';

-- Row Level Security: rooms are open to anyone holding the code (no accounts).
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.visits enable row level security;

drop policy if exists "rooms readable" on public.rooms;
drop policy if exists "rooms creatable" on public.rooms;
drop policy if exists "rooms updatable" on public.rooms;
create policy "rooms readable" on public.rooms for select using (true);
create policy "rooms creatable" on public.rooms for insert with check (true);
create policy "rooms updatable" on public.rooms for update using (true) with check (true);

drop policy if exists "players readable" on public.players;
drop policy if exists "players creatable" on public.players;
drop policy if exists "players removable" on public.players;
create policy "players readable" on public.players for select using (true);
create policy "players creatable" on public.players for insert with check (true);
create policy "players removable" on public.players for delete using (true);

drop policy if exists "visits readable" on public.visits;
drop policy if exists "visits creatable" on public.visits;
drop policy if exists "visits removable" on public.visits;
create policy "visits readable" on public.visits for select using (true);
create policy "visits creatable" on public.visits for insert with check (true);
create policy "visits removable" on public.visits for delete using (true);

-- Optional housekeeping with pg_cron (enable the extension first): drop rooms older than 2 days.
-- select cron.schedule('purge-rooms', '0 4 * * *', 'delete from public.rooms where created_at < now() - interval ''2 days''');
