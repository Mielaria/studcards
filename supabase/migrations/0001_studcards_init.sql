-- ============================================================================
-- StudCards — esquema completo para un proyecto Supabase propio.
-- Pega este archivo entero en el SQL Editor de tu proyecto y ejecútalo una vez.
-- Antes o después, crea los buckets privados: card-images y avatars
-- (Storage → New bucket → Public = OFF). Las políticas de Storage están al final.
-- ============================================================================

-- ------------------------------------------------------------------ profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_user_id_key ON public.profiles(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY profiles_delete_own ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ------------------------------------------------------------------ subjects
CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'book',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subjects_user_id_idx ON public.subjects(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY subjects_select_own ON public.subjects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY subjects_insert_own ON public.subjects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY subjects_update_own ON public.subjects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY subjects_delete_own ON public.subjects FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------------------------------------------------------------- flashcards
CREATE TABLE public.flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  question text NOT NULL,
  option_1 text NOT NULL,
  option_2 text NOT NULL,
  option_3 text NOT NULL,
  option_4 text NOT NULL,
  correct_option smallint NOT NULL,
  explanation text,
  image_url text,               -- ruta en Storage: "<user_id>/<uuid>.jpg"
  image_crop_data jsonb,
  learning_stage smallint NOT NULL DEFAULT 1,
  next_review_at timestamptz NOT NULL DEFAULT now(),
  correct_answers_count integer NOT NULL DEFAULT 0,
  is_learned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX flashcards_user_subject_idx ON public.flashcards(user_id, subject_id);
CREATE INDEX flashcards_user_next_review_idx ON public.flashcards(user_id, next_review_at);
CREATE INDEX flashcards_user_learned_idx ON public.flashcards(user_id, is_learned);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO authenticated;
GRANT ALL ON public.flashcards TO service_role;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY flashcards_select_own ON public.flashcards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY flashcards_insert_own ON public.flashcards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY flashcards_update_own ON public.flashcards FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY flashcards_delete_own ON public.flashcards FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ------------------------------------------------------------ study_sessions
CREATE TABLE public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type text NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_seconds integer,
  cards_requested integer,
  cards_studied integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  incorrect_count integer NOT NULL DEFAULT 0,
  accuracy numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX study_sessions_user_started_idx ON public.study_sessions(user_id, started_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_sessions TO authenticated;
GRANT ALL ON public.study_sessions TO service_role;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY study_sessions_select_own ON public.study_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY study_sessions_insert_own ON public.study_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY study_sessions_update_own ON public.study_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY study_sessions_delete_own ON public.study_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ------------------------------------------------------- card_review_history
CREATE TABLE public.card_review_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  study_session_id uuid REFERENCES public.study_sessions(id) ON DELETE SET NULL,
  is_correct boolean NOT NULL,
  review_type text NOT NULL DEFAULT 'scheduled',
  previous_stage smallint,
  new_stage smallint,
  answered_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX card_review_history_user_answered_idx ON public.card_review_history(user_id, answered_at);
CREATE INDEX card_review_history_flashcard_idx ON public.card_review_history(flashcard_id);

GRANT SELECT, INSERT ON public.card_review_history TO authenticated;
GRANT ALL ON public.card_review_history TO service_role;
ALTER TABLE public.card_review_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY review_history_select_own ON public.card_review_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY review_history_insert_own ON public.card_review_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------- funciones y triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER subjects_updated_at BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER flashcards_updated_at BEFORE UPDATE ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Crea el perfil y las 6 materias por defecto al registrarse.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
BEGIN
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1),
    'usuario'
  );

  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, v_username);

  INSERT INTO public.subjects (user_id, name, icon, is_default) VALUES
    (NEW.id, 'Lectura crítica', 'book-open', true),
    (NEW.id, 'Matemáticas',     'sigma',     true),
    (NEW.id, 'Inglés',          'languages', true),
    (NEW.id, 'Física',          'atom',      true),
    (NEW.id, 'Química',         'flask',     true),
    (NEW.id, 'Biología',        'leaf',      true);

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------- Storage (imágenes)
-- Requiere que existan los buckets privados 'card-images' y 'avatars'.
-- Cada usuario sólo accede a la carpeta que lleva su propio id.
CREATE POLICY card_images_select_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'card-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY card_images_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'card-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY card_images_update_own ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'card-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'card-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY card_images_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'card-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY avatars_select_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_update_own ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
