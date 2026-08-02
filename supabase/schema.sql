-- Bitácora de Cine de Camaro — esquema de base de datos
-- Correr esto una vez en el SQL Editor de tu proyecto de Supabase.

create extension if not exists "pgcrypto";

create table if not exists movies (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer,
  title text not null,
  poster_path text,
  release_date date,
  director text,
  cast_names text,
  duration_minutes integer,
  budget bigint,
  revenue bigint,
  overview text,
  filming_locations text,
  countries_note text,
  watched_at date not null default current_date,
  added_by text check (added_by in ('cami', 'lauti')),
  original_title text,
  original_language text,
  trailer_key text,
  genre_names text,
  watched_where text default 'cine' check (watched_where in ('cine', 'casa')),
  created_at timestamptz default now()
);

create table if not exists ratings (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid references movies(id) on delete cascade not null,
  user_name text check (user_name in ('cami', 'lauti')) not null,
  score numeric check (score >= 1 and score <= 10) not null,
  comment text,
  created_at timestamptz default now(),
  unique (movie_id, user_name)
);

create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer not null,
  title text not null,
  poster_path text,
  release_date date,
  user_name text check (user_name in ('cami', 'lauti')) not null,
  expectation text check (expectation in ('top_asegurado', 'pinta_bien', 'indie_linda', 'va_patras')) not null,
  created_at timestamptz default now(),
  unique (tmdb_id, user_name)
);

create table if not exists shows (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer,
  title text not null,
  original_title text,
  poster_path text,
  first_air_date date,
  creator text,
  cast_names text,
  number_of_seasons integer,
  overview text,
  genre_names text,
  original_language text,
  trailer_key text,
  watched_at date not null default current_date,
  added_by text check (added_by in ('cami', 'lauti')),
  created_at timestamptz default now()
);

create table if not exists show_ratings (
  id uuid primary key default gen_random_uuid(),
  show_id uuid references shows(id) on delete cascade not null,
  user_name text check (user_name in ('cami', 'lauti')) not null,
  score numeric check (score >= 1 and score <= 10) not null,
  comment text,
  created_at timestamptz default now(),
  unique (show_id, user_name)
);

-- RLS: como es una app privada de dos personas sin login real,
-- habilitamos acceso completo con la clave "anon" (pública del lado del cliente).
-- No compartas el link de este proyecto públicamente.
alter table movies enable row level security;
alter table ratings enable row level security;
alter table predictions enable row level security;
alter table shows enable row level security;
alter table show_ratings enable row level security;

create policy "allow all movies" on movies
  for all using (true) with check (true);

create policy "allow all ratings" on ratings
  for all using (true) with check (true);

create policy "allow all predictions" on predictions
  for all using (true) with check (true);

create policy "allow all shows" on shows
  for all using (true) with check (true);

create policy "allow all show_ratings" on show_ratings
  for all using (true) with check (true);
