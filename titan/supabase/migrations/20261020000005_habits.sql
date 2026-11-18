-- Titan — hábitos manuais da Missão (dentes, postura, marmita…) no check-in diário
alter table public.daily_checkins add column if not exists habits jsonb not null default '{}'::jsonb;
