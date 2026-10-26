-- Support ticket replies table for chat-like conversations
CREATE TABLE public.support_ticket_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;

-- Users can view replies on their own tickets
CREATE POLICY "Users can view replies on own tickets"
ON public.support_ticket_replies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets t 
    WHERE t.id = ticket_id AND t.user_id = auth.uid()
  )
);

-- Users can insert replies on their own tickets
CREATE POLICY "Users can insert replies on own tickets"
ON public.support_ticket_replies
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND 
  EXISTS (
    SELECT 1 FROM public.support_tickets t 
    WHERE t.id = ticket_id AND t.user_id = auth.uid()
  )
);

-- Admins can view all replies
CREATE POLICY "Admins can view all replies"
ON public.support_ticket_replies
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert replies
CREATE POLICY "Admins can insert replies"
ON public.support_ticket_replies
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add index for better performance
CREATE INDEX idx_support_ticket_replies_ticket_id ON public.support_ticket_replies(ticket_id);
CREATE INDEX idx_support_ticket_replies_created_at ON public.support_ticket_replies(created_at);

-- Insert default app settings for life stage toggles and dark mode
INSERT INTO public.app_settings (key, value, description)
VALUES 
  ('flow_mode_enabled', 'true', 'Enable/disable Flow life stage in onboarding'),
  ('bump_mode_enabled', 'true', 'Enable/disable Bump life stage in onboarding'),
  ('mommy_mode_enabled', 'true', 'Enable/disable Mommy life stage in onboarding'),
  ('dark_mode_enabled', 'true', 'Enable/disable dark mode feature')
ON CONFLICT (key) DO NOTHING;