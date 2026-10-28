-- Titan — esquema principal
-- Toda tabela de dados pessoais tem user_id + Row Level Security:
-- cada usuário só lê/escreve as próprias linhas.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- perfil
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  display_name text check (char_length(display_name) <= 80),
  age int check (age between 13 and 100),
  sex text check (sex in ('male','female')),
  height_cm numeric(5,1) check (height_cm between 120 and 230),
  training jsonb not null default '{}'::jsonb,
  nutrition jsonb not null default '{}'::jsonb,
  skin jsonb not null default '{}'::jsonb,
  hair jsonb not null default '{}'::jsonb,
  grooming jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- treino
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 120),
  start_date date not null,
  weeks int not null default 8 check (weeks between 1 and 16),
  config jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.programs (user_id, status);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  week int not null check (week between 1 and 16),
  day_index int not null check (day_index between 0 and 6),
  sequence int not null check (sequence >= 0),
  scheduled_date date,
  status text not null default 'in_progress' check (status in ('in_progress','done','skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  fatigue int check (fatigue between 1 and 5),
  session_rpe numeric(3,1) check (session_rpe between 1 and 10),
  pain_notes text check (char_length(pain_notes) <= 1000),
  notes text check (char_length(notes) <= 2000),
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, sequence)
);
create index on public.workout_sessions (user_id, started_at desc);

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_key text not null check (char_length(exercise_key) <= 80),
  exercise_name text not null check (char_length(exercise_name) <= 120),
  muscle text not null check (char_length(muscle) <= 40),
  set_index int not null check (set_index between 0 and 30),
  kind text not null default 'working' check (kind in ('warmup','working')),
  load_kg numeric(6,2) not null check (load_kg between 0 and 1000),
  reps int not null check (reps between 0 and 100),
  rir numeric(3,1) check (rir between 0 and 10),
  technique_ok boolean not null default true,
  pain int not null default 0 check (pain between 0 and 10),
  notes text check (char_length(notes) <= 500),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.set_logs (user_id, exercise_key, logged_at desc);
create index on public.set_logs (session_id);

create table public.exercise_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_key text not null check (char_length(exercise_key) <= 80),
  replacement_key text not null check (char_length(replacement_key) <= 80),
  reason text check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_key)
);

-- ---------------------------------------------------------------- recuperação e medidas
create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  sleep_hours numeric(3,1) check (sleep_hours between 0 and 24),
  sleep_quality int check (sleep_quality between 1 and 5),
  recovery int check (recovery between 1 and 5),
  soreness int check (soreness between 1 and 5),
  stress int check (stress between 1 and 5),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric(5,2) check (weight_kg between 30 and 300),
  arm_right_cm numeric(4,1) check (arm_right_cm between 15 and 80),
  arm_left_cm numeric(4,1) check (arm_left_cm between 15 and 80),
  chest_cm numeric(5,1) check (chest_cm between 50 and 200),
  waist_cm numeric(5,1) check (waist_cm between 40 and 200),
  thigh_cm numeric(4,1) check (thigh_cm between 30 and 110),
  shoulders_cm numeric(5,1) check (shoulders_cm between 70 and 200),
  conditions jsonb not null default '{}'::jsonb,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.body_metrics (user_id, date);

-- ---------------------------------------------------------------- nutrição
create table public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  effective_from date not null,
  kcal int not null check (kcal between 1000 and 7000),
  protein_g int not null check (protein_g between 0 and 500),
  carbs_g int not null check (carbs_g between 0 and 1200),
  fat_g int not null check (fat_g between 0 and 400),
  rationale text check (char_length(rationale) <= 2000),
  inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.nutrition_targets (user_id, effective_from desc);

create table public.user_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 120),
  kcal_100g numeric(6,1) not null check (kcal_100g between 0 and 950),
  protein_100g numeric(5,1) not null check (protein_100g between 0 and 100),
  carbs_100g numeric(5,1) not null check (carbs_100g between 0 and 100),
  fat_100g numeric(5,1) not null check (fat_100g between 0 and 100),
  source text check (char_length(source) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  meal text not null check (char_length(meal) <= 40),
  food_key text not null check (char_length(food_key) <= 80),
  food_name text not null check (char_length(food_name) <= 120),
  grams numeric(6,1) not null check (grams between 0 and 5000),
  kcal numeric(7,1) not null check (kcal >= 0),
  protein_g numeric(6,1) not null check (protein_g >= 0),
  carbs_g numeric(6,1) not null check (carbs_g >= 0),
  fat_g numeric(6,1) not null check (fat_g >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.food_logs (user_id, date);

create table public.food_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  food_key text not null check (char_length(food_key) <= 80),
  price_brl numeric(8,2) not null check (price_brl > 0 and price_brl < 100000),
  package_g numeric(8,1) not null check (package_g > 0),
  store text check (char_length(store) <= 120),
  source text check (char_length(source) <= 300),
  observed_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- pele, cabelo, barba
create table public.care_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  area text not null check (area in ('skin','hair','beard','brows')),
  name text not null check (char_length(name) <= 160),
  brand text check (char_length(brand) <= 120),
  category text not null check (char_length(category) <= 40),
  ingredients text check (char_length(ingredients) <= 5000),
  actives text[] not null default '{}',
  concentration text check (char_length(concentration) <= 200),
  status text not null default 'active' check (status in ('active','introducing','paused','suspended')),
  started_on date,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.routine_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  area text not null check (area in ('skin','hair','beard','brows')),
  slot text not null check (slot in ('am','pm','wash','non_wash','scalp','weekly')),
  product_id uuid references public.care_products(id) on delete set null,
  step text not null check (char_length(step) <= 160),
  step_order int not null default 0,
  days int[] not null default '{0,1,2,3,4,5,6}',
  amount text check (char_length(amount) <= 120),
  notes text check (char_length(notes) <= 500),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.care_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  area text not null check (area in ('skin','hair','beard','brows')),
  slot text not null check (char_length(slot) <= 20),
  completed boolean not null default true,
  product_id uuid references public.care_products(id) on delete set null,
  reaction text not null default 'none' check (reaction in ('none','mild','moderate','severe')),
  itch int check (itch between 0 and 10),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.care_logs (user_id, date);

-- ---------------------------------------------------------------- fotos (metadados; arquivo fica no Storage privado)
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null check (category in ('face','hair','physique','label','other')),
  storage_path text not null check (char_length(storage_path) <= 300),
  taken_at timestamptz not null default now(),
  lighting text check (char_length(lighting) <= 60),
  distance text check (char_length(distance) <= 60),
  pose text check (char_length(pose) <= 60),
  time_of_day text check (char_length(time_of_day) <= 30),
  pump boolean not null default false,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- triggers + RLS
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','programs','workout_sessions','set_logs','exercise_overrides','daily_checkins',
    'body_metrics','nutrition_targets','user_foods','food_logs','food_prices','care_products',
    'routine_items','care_logs','photos'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy "own_select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "own_insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own_update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own_delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Uma sessão só pode referenciar programa do próprio usuário (e série só sessão própria).
create or replace function public.assert_same_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if tg_table_name = 'workout_sessions' then
    select user_id into owner from public.programs where id = new.program_id;
  elsif tg_table_name = 'set_logs' then
    select user_id into owner from public.workout_sessions where id = new.session_id;
  end if;
  if owner is distinct from new.user_id then
    raise exception 'referência a registro de outro usuário' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger workout_sessions_owner before insert or update on public.workout_sessions
  for each row execute function public.assert_same_owner();
create trigger set_logs_owner before insert or update on public.set_logs
  for each row execute function public.assert_same_owner();

-- Exclusão definitiva da conta (apaga auth.users; o resto cai em cascata).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
