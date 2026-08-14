-- Políticas por carpeta de usuario para los buckets card-images y avatars
CREATE POLICY "card_images_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'card-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "card_images_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'card-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "card_images_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'card-images' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'card-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "card_images_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'card-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);