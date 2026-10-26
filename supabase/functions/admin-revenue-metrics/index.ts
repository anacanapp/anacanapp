import { requireAdmin } from '../_shared/auth.ts';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,x-client-info,content-type', 'Cache-Control': 'no-store' };
Deno.serve(async (req: Request) => {
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const admin = await requireAdmin(req); if (admin.error) return admin.error;
  const checkedAt = new Date().toISOString();
  const unavailable = (reason: string) => json({ available: false, scope: 'project', checkedAt, reason });
  const key = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!key) return unavailable('not_configured');
  try {
    // Fixed existing project, no caller-controlled URL, identity or provider key.
    const response = await fetch('https://api.revenuecat.com/v2/projects/a3647ee8/metrics/overview', {
      headers: { Authorization: `Bearer ${key}` }, redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401 || response.status === 403) return unavailable('permission_required');
    if (!response.ok) return unavailable('provider_unavailable');
    const value = await response.json();
    if (!Array.isArray(value.metrics) || value.metrics.length > 50) return unavailable('invalid_provider_response');
    const metrics = value.metrics.filter((item: any) => typeof item.id === 'string' && /^[a-z0-9_]{1,80}$/.test(item.id)
      && typeof item.name === 'string' && Number.isFinite(item.value) && typeof item.unit === 'string')
      .map((item: any) => ({ id: item.id, name: item.name.slice(0, 100), value: item.value, unit: item.unit.slice(0, 24),
        ...(typeof item.description === 'string' ? { description: item.description.slice(0, 400) } : {}) }));
    if (!metrics.length) return unavailable('invalid_provider_response');
    return json({ available: true, scope: 'project', checkedAt, metrics });
  } catch { return unavailable('provider_unavailable'); }
});
