import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireAdmin } from '../_shared/auth.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,x-client-info,content-type', 'Cache-Control': 'no-store' };
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Account creation/reset is an administrator operation, never a public signup. */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const backend = Deno.env.get('SUPABASE_URL');
  const managed = Deno.env.get('BRAND_PORTAL_BACKEND') === 'managed-v1'
    && ['https://api.anacan.az', 'https://gcp.anacan.az'].includes(backend || '');
  if (backend !== 'https://tntbjulojatnrqmylorp.supabase.co' && !managed) return json({ error: 'brand_backend_required' }, 503);
  const admin = await requireAdmin(req); if (admin.error) return admin.error;
  try {
    const raw = await req.text(); if (raw.length > 4096) return json({ error: 'invalid_request' }, 400);
    const body = JSON.parse(raw);
    const { action, brandId, userId, requestId } = body;
    const password = body.password;
    if (!['create', 'reset_password'].includes(action) || !uuid.test(brandId || '') || !uuid.test(requestId || '')
      || typeof password !== 'string' || password.length < 12 || password.length > 128 || !password.trim()) return json({ error: 'invalid_request' }, 400);
    const url = Deno.env.get('SUPABASE_URL')!;
    const actor = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: req.headers.get('Authorization')! } } });
    const { data: workspace, error: denied } = await actor.rpc('admin_brand_workspace_v1', { p_brand: brandId });
    if (denied || !workspace?.brands?.some((brand: any) => brand.id === brandId)) return json({ error: 'brand_unavailable' }, 403);
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    if (action === 'reset_password') {
      if (!uuid.test(userId || '') || !workspace.members?.some((member: any) => member.user_id === userId && member.managed)) return json({ error: 'managed_brand_account_required' }, 403);
      const { data, error } = await service.auth.admin.getUserById(userId);
      if (error || data.user?.app_metadata?.brand_portal_managed !== true || data.user.app_metadata.brand_id !== brandId) return json({ error: 'managed_brand_account_required' }, 403);
      const changed = await service.auth.admin.updateUserById(userId, { password });
      if (changed.error) return json({ error: 'password_update_failed' }, 503);
      return json({ action: 'password_updated', brandId, userId });
    }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: 'invalid_request' }, 400);
    // A retry uses the same Auth UUID and trusted metadata. It cannot take over
    // an existing personal account or change the password of a prior request.
    const previous = await service.auth.admin.getUserById(requestId);
    let created = previous.data?.user;
    const replay = !!created;
    if (created && (created.email?.toLowerCase() !== email || created.app_metadata?.brand_portal_managed !== true
      || created.app_metadata.brand_id !== brandId || created.app_metadata.provision_request !== requestId
      || created.app_metadata.provisioned_by !== admin.userId)) return json({ error: 'request_conflict' }, 409);
    if (!created) {
      if (previous.error && previous.error.status !== 404) return json({ error: 'account_service_unavailable' }, 503);
      const result = await service.auth.admin.createUser({ id: requestId, email, password, email_confirm: true,
        app_metadata: { brand_portal_managed: true, brand_id: brandId, provision_request: requestId, provisioned_by: admin.userId },
        user_metadata: { name: workspace.brands.find((brand: any) => brand.id === brandId).name },
      } as any);
      if (result.error) return json({ error: result.error.status === 422 || result.error.status === 409 ? 'account_exists' : 'account_creation_failed' }, result.error.status === 422 || result.error.status === 409 ? 409 : 503);
      created = result.data.user;
      if (!created || created.id !== requestId) return json({ error: 'account_provision_pending' }, 503);
    }
    const linked = await actor.rpc('admin_brand_action_v1', { p_action: 'add_member', p_brand: brandId, p_target: created.id, p_payload: { email }, p_request: requestId });
    if (linked.error || linked.data?.target_id !== created.id) return json({ error: 'account_provision_pending' }, 503);
    return json({ action: 'account_created', brandId, userId: created.id, email, replay });
  } catch { return json({ error: 'account_operation_failed' }, 503); }
});
