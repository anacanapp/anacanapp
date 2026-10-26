import { entryDecision, entryLanguage, safeAdminNext } from './policy.mjs';
import { entryText } from './text';
import { mountAppLauncher } from './launcher';
import { guardSystemEntryNavigation } from './navigation';
import './entry.css';

export async function handleBrowserEntry(): Promise<boolean> {
  const decision = entryDecision(location.href);
  // A resource URL must never initialize the consumer SDK if a host's SPA
  // fallback accidentally serves its HTML shell for a missing static file.
  if (decision === 'resource') return true;
  if (decision === 'launch') { mountAppLauncher(); return true; }
  if (decision === 'legal') { const { startPublicLegal } = await import('./legal'); startPublicLegal(); return true; }
  if (decision === 'system') { guardSystemEntryNavigation(); return false; }
  if (decision !== 'admin' && decision !== 'moderator') return false;
  const role = decision === 'moderator' ? 'moderator' : 'admin';
  const { verifyStaffSession, mountAdminLogin, watchAdminWebAccess, mountAdminWebBar } = await import('./admin');
  if (/^\/admin\/login\/?$/.test(location.pathname)) { mountAdminLogin(); return true; }
  document.documentElement.classList.add('anacan-entry');
  const container = document.getElementById('root'), message = document.createElement('p');
  message.textContent = entryText('checking', entryLanguage(location.href)); message.setAttribute('role','status'); message.className = 'entry-card';
  container?.replaceChildren(message);
  let valid = false;
  try { valid = await verifyStaffSession(role); } catch { /* Failure never grants web access. */ }
  if (!valid) { mountAdminLogin(location.href, role); return true; }
  document.documentElement.classList.remove('anacan-entry');
  const next = safeAdminNext(location.pathname + location.search, location.origin);
  if (role === 'admin' && !location.search.includes('web=admin')) history.replaceState(history.state, '', next);
  if (/^\/site(?:\/|$)/.test(location.pathname)) {
    const { startWebsite } = await import('@/website/bootstrap'); await startWebsite();
  } else if (/^\/blog(?:\/|$)/.test(location.pathname)) {
    const { startPublicBlog } = await import('@/public-blog/bootstrap'); startPublicBlog();
  } else {
    const { startApp } = await import('@/bootstrap-app'); await startApp();
  }
  const lost = () => {
    const target = new URL('/admin/login', location.origin); target.searchParams.set('next', safeAdminNext(location.pathname + location.search, location.origin));
    location.replace(target.href);
  };
  watchAdminWebAccess(lost, role);
  if (role === 'admin') mountAdminWebBar();
  return true;
}
