import { BLOG_MODULES, type BlogModule } from './blog-editorial';

export const BLOG_MODULE_EVENT = 'anacan:open-blog-module';
const KEY = 'anacan-blog-module-navigation-v1';
export const isBlogModule = (value: unknown): value is BlogModule => typeof value === 'string' && BLOG_MODULES.some(module => module === value);
export function rememberBlogModule(module: BlogModule) {
  if (!isBlogModule(module)) return;
  try { sessionStorage.setItem(KEY, JSON.stringify({ module, at: Date.now() })); } catch { /* Same-page event still works. */ }
}
export function consumeBlogModule(): BlogModule | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    sessionStorage.removeItem(KEY);
    return isBlogModule(value?.module) && Number.isFinite(value.at) && Date.now() - value.at >= 0 && Date.now() - value.at < 86400000 ? value.module : null;
  } catch { return null; }
}
export function openBlogModule(module: BlogModule) {
  if (!isBlogModule(module)) return;
  rememberBlogModule(module);
  window.dispatchEvent(new CustomEvent(BLOG_MODULE_EVENT, { detail: { module } }));
}
