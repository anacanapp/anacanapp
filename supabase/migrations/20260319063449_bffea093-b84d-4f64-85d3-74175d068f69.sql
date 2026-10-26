ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_data jsonb DEFAULT NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_type text DEFAULT NULL;