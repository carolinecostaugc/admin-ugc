-- =====================================================================
-- 03b_storage.sql (opcional)
-- Pasta de arquivos (Storage) para a biblioteca de anexos.
-- Pública para leitura (o Instagram precisa baixar o arquivo pelo link),
-- mas só quem está logado envia ou apaga.
--
-- Se este script der erro de permissão ("must be owner"), crie pelo painel:
-- Storage > New bucket > nome "ig-assets" > marque "Public bucket".
-- Depois, em Storage > Policies, permita INSERT e DELETE para "authenticated".
-- Sem a pasta, dá pra anexar arquivo colando um link público.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('ig-assets', 'ig-assets', true)
on conflict (id) do nothing;

drop policy if exists "ig_assets_upload" on storage.objects;
create policy "ig_assets_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'ig-assets');

drop policy if exists "ig_assets_delete" on storage.objects;
create policy "ig_assets_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'ig-assets');
