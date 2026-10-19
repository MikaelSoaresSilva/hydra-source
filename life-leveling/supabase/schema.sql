-- LIFE LEVELING — esquema da nuvem (Supabase / PostgreSQL)
-- Cole no SQL Editor do seu projeto Supabase e execute uma vez.

create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

-- Isolamento por usuário: cada conta só lê e escreve o próprio save.
alter table public.saves enable row level security;

drop policy if exists "dono le" on public.saves;
drop policy if exists "dono insere" on public.saves;
drop policy if exists "dono atualiza" on public.saves;
drop policy if exists "dono apaga" on public.saves;
create policy "dono le" on public.saves for select using (auth.uid() = user_id);
create policy "dono insere" on public.saves for insert with check (auth.uid() = user_id);
create policy "dono atualiza" on public.saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono apaga" on public.saves for delete using (auth.uid() = user_id);

-- Validação no servidor: tamanho máximo e formato mínimo do save.
create or replace function public.validate_save() returns trigger language plpgsql as $$
begin
  if pg_column_size(new.data) > 5 * 1024 * 1024 then raise exception 'save muito grande'; end if;
  if jsonb_typeof(new.data->'ledger') <> 'array' or jsonb_typeof(new.data->'missions') <> 'array' then
    raise exception 'save inválido';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_validate_save on public.saves;
create trigger trg_validate_save before insert or update on public.saves for each row execute function public.validate_save();

-- Histórico de versões (backup no servidor; mantém as últimas 10 por usuário).
create table if not exists public.save_history (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.save_history enable row level security;
drop policy if exists "dono le historico" on public.save_history;
create policy "dono le historico" on public.save_history for select using (auth.uid() = user_id);

create or replace function public.keep_history() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.save_history (user_id, data) values (new.user_id, new.data);
  delete from public.save_history where user_id = new.user_id and id not in (
    select id from public.save_history where user_id = new.user_id order by created_at desc limit 10);
  return new;
end $$;
drop trigger if exists trg_keep_history on public.saves;
create trigger trg_keep_history after insert or update on public.saves for each row execute function public.keep_history();

-- Exclusão de conta pelo próprio usuário.
create or replace function public.delete_my_account() returns void language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
