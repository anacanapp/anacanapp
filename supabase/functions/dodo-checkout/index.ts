// dodo-checkout — starts a Dodo Payments hosted checkout for Anacan Premium from the anacan.az website.
// Public (no Anacan session): only anacan.az may call it from a browser, the plan maps to a configured
// product id, and the return URL is always built here. Access is granted only by the signed webhook.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { dodoConfig, dodoRequest, WEBSITE_ORIGINS, type DodoPlan } from '../_shared/dodo.ts';
import { LANGUAGE_CODES } from '../_shared/languages.ts';

// Dodo checkout languages; the closest one for app languages it does not offer.
const CHECKOUT_LANGUAGE: Record<string, string> = { az: 'tr', kk: 'ru', uz: 'ru', hi: 'en', vi: 'en' };
const DODO_LANGUAGES = new Set(['ar', 'de', 'en', 'es', 'fr', 'id', 'ja', 'ka', 'ko', 'nl', 'pl', 'pt', 'ru', 'sv', 'tr', 'zh']);
export const FUNNEL_URL = 'https://anacan.az/website/premium/index.html';

// Anacan look for hosted, overlay and inline checkout (coral #FF5A5F on warm peach, Inter, soft corners).
function themeConfig(payLabel: string | null) {
  return {
    font_primary_url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
    font_size: 'md', font_weight: 'medium', radius: '14px',
    ...(payLabel ? { pay_button_text: payLabel } : {}),
    light: {
      bg_primary: '#ffffff', bg_secondary: '#fff4f1', text_primary: '#333333', text_secondary: '#8c8177',
      text_placeholder: '#c9c0b8', text_error: '#b3261e', text_success: '#1c7a4d',
      border_primary: '#f1e2dc', border_secondary: '#f7ebe6', input_focus_border: '#ff5a5f',
      button_primary: '#ff5a5f', button_primary_hover: '#e94a50', button_text_primary: '#ffffff',
      button_secondary: '#ffe7e1', button_secondary_hover: '#ffd9cf', button_text_secondary: '#7c2726',
    },
    dark: {
      bg_primary: '#161922', bg_secondary: '#22252f', text_primary: '#ffffff', text_secondary: '#c7c8ce',
      text_placeholder: '#71737e', text_error: '#ff8a80', text_success: '#7fd6a4',
      border_primary: '#3b3c41', border_secondary: '#2c2e36', input_focus_border: '#ff7a7f',
      button_primary: '#ff5a5f', button_primary_hover: '#ff7a7f', button_text_primary: '#ffffff',
      button_secondary: '#3b3c41', button_secondary_hover: '#4b4c53', button_text_secondary: '#ffffff',
    },
  };
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

function headersFor(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && WEBSITE_ORIGINS.includes(origin) ? origin : WEBSITE_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = headersFor(origin);
  const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (origin && !WEBSITE_ORIGINS.includes(origin)) return reply(403, { error: 'origin_not_allowed' });

  const config = dodoConfig();
  if (!config.ready) return reply(503, { error: 'payments_unavailable' });

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 2048) return reply(413, { error: 'payload_too_large' });
    body = JSON.parse(raw);
  } catch {
    return reply(400, { error: 'invalid_payload' });
  }
  const plan = body.plan === 'yearly' ? 'yearly' : body.plan === 'monthly' ? 'monthly' : null;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const language = typeof body.language === 'string' && (LANGUAGE_CODES as readonly string[]).includes(body.language) ? body.language : 'az';
  if (!plan) return reply(400, { error: 'invalid_plan' });
  if (email.length > 254 || !EMAIL.test(email)) return reply(400, { error: 'invalid_email' });
  const productId = config.products[plan as DodoPlan]!;
  const payLabel = typeof body.pay_label === 'string' ? body.pay_label.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40) || null : null;
  const checkoutLanguage = CHECKOUT_LANGUAGE[language] ?? (DODO_LANGUAGES.has(language) ? language : 'en');

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // Light abuse limit: at most 5 checkouts per email in 10 minutes.
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await admin.from('web_checkouts').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', since);
  if ((count ?? 0) >= 5) return reply(429, { error: 'too_many_requests' });

  const { data: checkout, error } = await admin.from('web_checkouts')
    .insert({ email, plan, product_id: productId, language, test_mode: config.testMode })
    .select('id').single();
  if (error || !checkout) return reply(500, { error: 'checkout_not_saved' });

  try {
    const session = await dodoRequest<{ session_id: string; checkout_url: string }>('/checkouts', {
      method: 'POST',
      body: {
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email },
        return_url: `${FUNNEL_URL}?lang=${language}&done=1`,
        customization: { theme: 'light', show_order_details: true, force_language: checkoutLanguage, theme_config: themeConfig(payLabel) },
        feature_flags: { allow_discount_code: true },
        metadata: { anacan_checkout: checkout.id, anacan_plan: plan, anacan_source: 'anacan.az' },
      },
    });
    if (!session?.checkout_url || !session.session_id) throw new Error('dodo_no_url');
    await admin.from('web_checkouts').update({ session_id: session.session_id }).eq('id', checkout.id);
    return reply(200, { checkout_url: session.checkout_url, test_mode: config.testMode });
  } catch (e) {
    console.error('[dodo-checkout] create failed:', e instanceof Error ? e.message : 'unknown');
    return reply(502, { error: 'checkout_unavailable' });
  }
});
