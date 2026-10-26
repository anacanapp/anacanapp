-- Drop the problematic unique indexes that prevent multiple records per week
DROP INDEX IF EXISTS public.idx_pregnancy_content_week_only;
DROP INDEX IF EXISTS public.idx_pregnancy_content_week_day;

-- Also try dropping with just the name
DROP INDEX IF EXISTS idx_pregnancy_content_week_only;
DROP INDEX IF EXISTS idx_pregnancy_content_week_day;