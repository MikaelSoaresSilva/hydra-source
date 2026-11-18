-- Titan — onde a sessão foi feita (academia ou em casa, só com o peso do corpo)
alter table public.workout_sessions add column if not exists location text not null default 'gym' check (location in ('gym','home'));
