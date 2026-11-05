-- 2026-11-05 (owner decision): real card payments through Epoint go live.
--  * PDF books (app + anacan.az) and anacan.az cake orders are sold by card.
--  * card_simulated (marked cake orders paid without any payment) is switched off.
UPDATE public.app_settings SET value = 'true'::jsonb, updated_at = now()
 WHERE key IN ('books_payments_enabled', 'cakes_web_payments_enabled') AND value IS DISTINCT FROM 'true'::jsonb;
UPDATE public.payment_methods SET is_active = false, updated_at = now()
 WHERE method_key = 'card_simulated' AND is_active;
