-- Create table to log Apple Sign In notifications
CREATE TABLE public.apple_auth_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  apple_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  email TEXT,
  is_private_email BOOLEAN,
  event_time TIMESTAMP WITH TIME ZONE,
  raw_payload TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.apple_auth_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can view notifications (for debugging)
CREATE POLICY "Admins can view apple notifications"
ON public.apple_auth_notifications
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Add Apple user tracking columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS apple_user_id TEXT,
ADD COLUMN IF NOT EXISTS apple_email_enabled BOOLEAN DEFAULT true;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_apple_user_id ON public.profiles(apple_user_id);
CREATE INDEX IF NOT EXISTS idx_apple_auth_notifications_apple_user_id ON public.apple_auth_notifications(apple_user_id);