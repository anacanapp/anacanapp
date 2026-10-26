
-- Create crash_reports table
CREATE TABLE public.crash_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  component_stack TEXT,
  url TEXT,
  user_agent TEXT,
  app_version TEXT,
  platform TEXT,
  extra_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crash_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can insert crash reports (including anonymous/pre-auth crashes)
CREATE POLICY "Anyone can insert crash reports"
ON public.crash_reports
FOR INSERT
WITH CHECK (true);

-- Only admins can view crash reports
CREATE POLICY "Admins can view crash reports"
ON public.crash_reports
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete crash reports
CREATE POLICY "Admins can delete crash reports"
ON public.crash_reports
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Index for quick lookups
CREATE INDEX idx_crash_reports_created_at ON public.crash_reports (created_at DESC);
CREATE INDEX idx_crash_reports_platform ON public.crash_reports (platform);
