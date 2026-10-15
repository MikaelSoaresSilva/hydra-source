-- Titan — prontidão (TQR), hidratação e análises de aparência

-- Prontidão antes do treino: {tqr: 6–20, adjusted: bool, note: text}
alter table public.workout_sessions add column if not exists readiness jsonb;
-- Água ingerida no dia (litros)
alter table public.daily_checkins add column if not exists water_l numeric(3,1) check (water_l between 0 and 15);

create table public.appearance_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null check (source in ('ai','questionnaire')),
  model text check (char_length(model) <= 80),
  photo_path text check (char_length(photo_path) <= 300),
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.appearance_analyses (user_id, created_at);

create trigger appearance_analyses_updated_at before update on public.appearance_analyses
  for each row execute function public.set_updated_at();
alter table public.appearance_analyses enable row level security;
alter table public.appearance_analyses force row level security;
create policy "own_select" on public.appearance_analyses for select to authenticated using (user_id = (select auth.uid()));
create policy "own_insert" on public.appearance_analyses for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own_update" on public.appearance_analyses for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own_delete" on public.appearance_analyses for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.appearance_analyses to authenticated;
revoke all on public.appearance_analyses from anon;
