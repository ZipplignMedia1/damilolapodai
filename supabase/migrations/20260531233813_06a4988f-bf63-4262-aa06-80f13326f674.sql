CREATE TABLE public.library_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image','video','storyboard')),
  title TEXT,
  prompt TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_items TO authenticated;
GRANT ALL ON public.library_items TO service_role;

ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own library items"
ON public.library_items FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own library items"
ON public.library_items FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own library items"
ON public.library_items FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own library items"
ON public.library_items FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_library_items_user_created ON public.library_items(user_id, created_at DESC);