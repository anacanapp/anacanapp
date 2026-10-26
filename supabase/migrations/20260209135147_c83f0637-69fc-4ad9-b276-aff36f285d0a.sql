
ALTER TABLE public.cakes ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}'::text[];
