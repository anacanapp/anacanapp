-- Create healthcare provider reviews table
CREATE TABLE public.healthcare_provider_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.healthcare_providers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(provider_id, user_id)
);

-- Enable RLS
ALTER TABLE public.healthcare_provider_reviews ENABLE ROW LEVEL SECURITY;

-- Everyone can read active reviews
CREATE POLICY "Anyone can view active reviews"
ON public.healthcare_provider_reviews
FOR SELECT
USING (is_active = true);

-- Authenticated users can create reviews
CREATE POLICY "Authenticated users can create reviews"
ON public.healthcare_provider_reviews
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
ON public.healthcare_provider_reviews
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews"
ON public.healthcare_provider_reviews
FOR DELETE
USING (auth.uid() = user_id);

-- Create function to update provider rating when review is added/updated/deleted
CREATE OR REPLACE FUNCTION public.update_provider_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.healthcare_providers
    SET 
      rating = COALESCE((SELECT AVG(rating)::NUMERIC(2,1) FROM public.healthcare_provider_reviews WHERE provider_id = OLD.provider_id AND is_active = true), 0),
      review_count = (SELECT COUNT(*) FROM public.healthcare_provider_reviews WHERE provider_id = OLD.provider_id AND is_active = true)
    WHERE id = OLD.provider_id;
    RETURN OLD;
  ELSE
    UPDATE public.healthcare_providers
    SET 
      rating = COALESCE((SELECT AVG(rating)::NUMERIC(2,1) FROM public.healthcare_provider_reviews WHERE provider_id = NEW.provider_id AND is_active = true), 0),
      review_count = (SELECT COUNT(*) FROM public.healthcare_provider_reviews WHERE provider_id = NEW.provider_id AND is_active = true)
    WHERE id = NEW.provider_id;
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger
CREATE TRIGGER update_provider_rating_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.healthcare_provider_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_provider_rating();

-- Enable realtime for reviews
ALTER PUBLICATION supabase_realtime ADD TABLE public.healthcare_provider_reviews;