import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/database-types';
import { supabase } from '@/integrations/supabase/client';
import { safeAdminNext, entryLanguage } from './policy.mjs';
import { entryText } from './text';
import './entry.css';

export function getEntryAdminClient(): SupabaseClient<Database> {
  // Imported only for the explicit administrative browser entry; the full app
  // later uses this same backend-scoped singleton and durable session.
  return supabase;
}
export async function verifyAdminSession(client = getEntryAdminClient()): Promise<boolean> {
  // Never trust a stored flag, JWT role hint, cached profile or query parameter.
  const { data: session } = await client.auth.getSession();
  if (!session.session) return false;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.id !== session.session.user.id) return false;
  const role = await client.rpc('has_role', { _user_id: data.user.id, _role: 'admin' });
  return !role.error && role.data === true;
}
export async function verifyStaffSession(role: 'admin' | 'moderator', client = getEntryAdminClient()): Promise<boolean> {
  if (await verifyAdminSession(client)) return true;
  if (role === 'admin') return false;
  const { data, error } = await client.auth.getUser(); if (error || !data.user) return false;
  const result = await client.rpc('has_role', { _user_id: data.user.id, _role: 'moderator' });
  return !result.error && result.data === true;
}
export function mountAdminLogin(input = window.location.href, role: 'admin' | 'moderator' = 'admin') {
  const url = new URL(input), language = entryLanguage(input), next = role === 'moderator' ? '/moderator'
    : safeAdminNext(/^\/admin\/login\/?$/.test(url.pathname) ? url.searchParams.get('next') : url.pathname + url.search, url.origin);
  const client = getEntryAdminClient();
  document.documentElement.classList.remove('anacan-public-blog', 'anacan-public-website');
  document.documentElement.classList.add('anacan-entry');
  document.documentElement.lang = language; document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.title = 'Anacan — ' + entryText('adminLogin', language);
  const root = document.getElementById('root'); if (!root) return;
  const main = document.createElement('main'); main.className = 'entry-card'; main.dataset.adminEntryLogin = role;
  const logo = document.createElement('img'); logo.src = '/brand-mark.png'; logo.alt = ''; logo.width = 72; logo.height = 72;
  const title = document.createElement('h1'); title.textContent = 'Anacan';
  const heading = document.createElement('h2'); heading.textContent = entryText('adminLogin', language);
  const explanation = document.createElement('p'); explanation.textContent = entryText('adminOnly', language);
  const form = document.createElement('form');
  const inputs: HTMLInputElement[] = [];
  for (const [key, type] of [['email','email'], ['password','password']] as const) {
    const label = document.createElement('label'); label.className = 'entry-field'; label.textContent = entryText(key, language);
    const input = document.createElement('input'); input.type = type; input.required = true;
    input.autocomplete = type === 'email' ? 'username' : 'current-password'; input.name = key;
    label.append(input); form.append(label); inputs.push(input);
  }
  const error = document.createElement('p'); error.className = 'entry-error'; error.setAttribute('role', 'status');
  const submit = document.createElement('button'); submit.type = 'submit'; submit.className = 'entry-primary'; submit.textContent = entryText('signIn', language);
  const change = document.createElement('button'); change.type = 'button'; change.className = 'entry-link'; change.textContent = entryText('signOut', language);
  change.onclick = () => { void client.auth.signOut({ scope: 'local' }).then(() => { error.textContent = ''; }); };
  form.append(error, submit); main.append(logo, title, heading, explanation, form, change); root.replaceChildren(main);
  form.onsubmit = async event => {
    event.preventDefault(); submit.disabled = true; error.textContent = '';
    try {
      const result = await client.auth.signInWithPassword({ email: inputs[0].value.trim(), password: inputs[1].value });
      inputs[1].value = '';
      if (result.error) { error.textContent = entryText('loginFailed', language); return; }
      const authorized = await verifyStaffSession(role, client);
      if (!authorized) { await client.auth.signOut({ scope: 'local' }); error.textContent = entryText('accessDenied', language); return; }
      window.location.replace(next);
    } catch { error.textContent = entryText('loginFailed', language); }
    finally { submit.disabled = false; }
  };
}
export function watchAdminWebAccess(onLost: () => void, role: 'admin' | 'moderator' = 'admin') {
  const client = getEntryAdminClient(); let checking = false, stopped = false;
  const check = async () => {
    if (checking || stopped || document.hidden) return; checking = true;
    try { if (!(await verifyStaffSession(role, client)) && !stopped) { stopped = true; onLost(); } }
    catch { if (!stopped) { stopped = true; onLost(); } }
    finally { checking = false; }
  };
  const subscription = client.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT' && !stopped) { stopped = true; onLost(); } });
  const timer = window.setInterval(() => void check(), 30000); const focus = () => void check();
  window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
  return () => { stopped = true; window.clearInterval(timer); subscription.data.subscription.unsubscribe(); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
}
export function mountAdminWebBar(input = window.location.href) {
  const language = entryLanguage(input), bar = document.createElement('nav'); bar.className = 'entry-admin-bar'; bar.dataset.adminWebSession = 'verified';
  const panel = document.createElement('a'); panel.href = '/admin?web=admin'; panel.textContent = entryText('adminPanel', language);
  const preview = document.createElement('a'); preview.href = '/?web=admin'; preview.textContent = entryText('webPreview', language);
  const logout = document.createElement('button'); logout.textContent = entryText('signOut', language);
  logout.onclick = () => { void getEntryAdminClient().auth.signOut({ scope: 'local' }).finally(() => window.location.replace('/admin/login')); };
  bar.append(panel, preview, logout); document.body.append(bar);
}
