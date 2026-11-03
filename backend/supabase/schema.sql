-- Tabela de relatórios sincronizados (somente texto/números; fotos NUNCA são enviadas).
create table if not exists public.analyses (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at_ms bigint not null,
  overall int not null,
  potential int not null,
  report jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.analyses enable row level security;

-- Cada usuário só enxerga e altera os próprios relatórios.
drop policy if exists "own rows select" on public.analyses;
drop policy if exists "own rows insert" on public.analyses;
drop policy if exists "own rows update" on public.analyses;
drop policy if exists "own rows delete" on public.analyses;
create policy "own rows select" on public.analyses for select using (auth.uid() = user_id);
create policy "own rows insert" on public.analyses for insert with check (auth.uid() = user_id);
create policy "own rows update" on public.analyses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows delete" on public.analyses for delete using (auth.uid() = user_id);
