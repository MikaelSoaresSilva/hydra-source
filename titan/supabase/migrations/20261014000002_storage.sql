-- Bucket privado para fotos. Caminho obrigatório: <user_id>/<arquivo>.
insert into storage.buckets (id, name, public)
values ('titan-private', 'titan-private', false)
on conflict (id) do update set public = false;

create policy "titan_own_read" on storage.objects for select to authenticated
  using (bucket_id = 'titan-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "titan_own_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'titan-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "titan_own_update" on storage.objects for update to authenticated
  using (bucket_id = 'titan-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "titan_own_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'titan-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
