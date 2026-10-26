-- Add admin_notes column for rejection reasons and moderation
ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS admin_notes text,
ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS reviewed_by uuid;

-- Update status default to 'pending' for new listings
ALTER TABLE public.marketplace_listings 
ALTER COLUMN status SET DEFAULT 'pending';

-- Create index for faster admin queries
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON public.marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_created_at ON public.marketplace_listings(created_at DESC);

-- Allow admins to manage all listings
CREATE POLICY "Admins can manage all marketplace listings"
ON public.marketplace_listings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));