-- Add unique constraint for daily_logs upsert functionality (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'daily_logs_user_date_unique'
  ) THEN
    ALTER TABLE public.daily_logs 
    ADD CONSTRAINT daily_logs_user_date_unique UNIQUE (user_id, log_date);
  END IF;
END $$;