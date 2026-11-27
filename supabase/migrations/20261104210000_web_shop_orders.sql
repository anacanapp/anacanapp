-- anacan.az web shop (Azerbaijani only): guest orders for printable books and cakes, paid with Epoint.
-- No new relation: book_orders and cake_orders are already CDC- and writer-guarded; this only relaxes
-- user_id for web (guest) orders and adds the web fields. Orders are written by the web-shop function
-- with the service role; the signed Epoint callback marks them paid.
BEGIN;

ALTER TABLE public.book_orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.book_orders ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'app';
ALTER TABLE public.book_orders ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.book_orders ADD COLUMN IF NOT EXISTS customer_phone text;
DO $$ BEGIN
  ALTER TABLE public.book_orders ADD CONSTRAINT book_orders_channel_chk CHECK (channel IN ('app', 'web'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.book_orders ADD CONSTRAINT book_orders_owner_chk CHECK (user_id IS NOT NULL OR channel = 'web');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.cake_orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.cake_orders ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'app';
ALTER TABLE public.cake_orders ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE public.cake_orders ADD COLUMN IF NOT EXISTS provider_transaction text;
ALTER TABLE public.cake_orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
DO $$ BEGIN
  ALTER TABLE public.cake_orders ADD CONSTRAINT cake_orders_channel_chk CHECK (channel IN ('app', 'web'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.cake_orders ADD CONSTRAINT cake_orders_owner_chk CHECK (user_id IS NOT NULL OR channel = 'web');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin order list shows the buyer's name for web orders too.
CREATE OR REPLACE FUNCTION public.admin_book_orders_v1(p_status text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, user_id uuid, name text, email text, book_ids text[], amount numeric, unit_price numeric, status text, provider text, language text, created_at timestamp with time zone, paid_at timestamp with time zone, email_sent_at timestamp with time zone, provider_transaction text, admin_note text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'BOOKS_ADMIN_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT o.id, o.user_id, coalesce(pr.name, o.customer_name) || CASE WHEN o.channel = 'web' THEN ' (sayt)' ELSE '' END,
         o.email, o.book_ids, o.amount, o.unit_price, o.status, o.provider, o.language,
         o.created_at, o.paid_at, o.email_sent_at, o.provider_transaction, o.admin_note, count(*) OVER ()
    FROM public.book_orders o
    LEFT JOIN public.profiles pr ON pr.user_id = o.user_id
   WHERE (p_status IS NULL OR o.status = p_status)
     AND (p_search IS NULL OR o.email ILIKE '%' || p_search || '%' OR coalesce(pr.name, o.customer_name, '') ILIKE '%' || p_search || '%' OR o.id::text = p_search)
   ORDER BY o.created_at DESC
   LIMIT greatest(1, least(coalesce(p_limit, 50), 200)) OFFSET greatest(0, coalesce(p_offset, 0));
END $function$;

-- Cake sales on anacan.az stay off until an admin switches them on (and Epoint is live).
INSERT INTO public.app_settings (key, value, description)
SELECT 'cakes_web_payments_enabled', 'false'::jsonb, 'anacan.az saytında tortların Epoint ilə satışı (true/false)'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'cakes_web_payments_enabled');

COMMIT;
