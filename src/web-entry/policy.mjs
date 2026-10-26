/** Public navigation only. API paths and native identity are separate from this
 * browser-entry policy; a query never grants an administrative role. */
export const APP_ENTRY_HOSTS = ['app.anacan.az', 'gcp.anacan.az', 'api.anacan.az'];
export const APP_STORE_URL = 'https://apps.apple.com/app/id6758301924';
export const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.atlasoon.anacan';
export const ADMIN_WEB_QUERY = 'web';
export const ADMIN_WEB_VALUE = 'admin';
export const APP_PACKAGE = 'com.atlasoon.anacan';
const languages = ['az','en','tr','ru','de','ar','ka','kk','uz','zh','id','fr','es','pt','vi','hi','ja','ko','pl','nl','sv'];
const modules = ['sleep','feeding','diaper','babyGrowth','hospitalBag','calendar'];
const legalNames = new Set(['terms','terms-of-use','terms-of-service','terms_and_conditions','terms-and-conditions','terms_of_service','conditions',
  'privacy','privacy-policy','privacy_policy','privacy-policy.html','terms.html','cookie-policy','cookies','disclaimer',
  'istifade-sertleri','mexfilik-siyaseti','kullanim-kosullari','gizlilik-politikasi','условия-использования','политика-конфиденциальности',
  'nutzungsbedingungen','datenschutzerklaerung','شروط-الاستخدام','سياسة-الخصوصية','გამოყენების-პირობები','კონფიდენციალურობის-პოლიტიკა',
  'пайдалану-шарттары','құпиялық-саясаты','foydalanish-shartlari','maxfiylik-siyosati','使用条款','隐私政策','syarat-penggunaan','kebijakan-privasi',
  'conditions-utilisation','politique-confidentialite','condiciones-uso','politica-privacidad','termos-utilizacao','politica-privacidade',
  'dieu-khoan-su-dung','chinh-sach-bao-mat','उपयोग-की-शर्तें','गोपनीयता-नीति','利用規約','プライバシーポリシー','이용약관','개인정보-처리방침',
  'warunki-korzystania','polityka-prywatnosci','gebruiksvoorwaarden','privacybeleid','anvandarvillkor','integritetspolicy']);

function segments(path) {
  try { return path.split('/').filter(Boolean).map(value => decodeURIComponent(value)); } catch { return []; }
}
export function isLegalEntryPath(path) {
  const parts = segments(path);
  if (parts[0] === 'legal' && parts.length <= 2) return true;
  if (parts[0] === 'site') parts.shift();
  if (languages.includes(parts[0])) parts.shift();
  return parts.length === 1 && legalNames.has(parts[0]);
}
export function legalDocumentType(path) {
  const parts = segments(path), last = parts[parts.length - 1] || '';
  if (['gdpr_ccpa','disclaimer','refund_policy','data_usage'].includes(last)) return last;
  if (last === 'legal' || !last) return null;
  const privacy = new Set(['privacy','privacy-policy','privacy_policy','privacy-policy.html','mexfilik-siyaseti','gizlilik-politikasi',
    'политика-конфиденциальности','datenschutzerklaerung','سياسة-الخصوصية','კონფიდენციალურობის-პოლიტიკა','құпиялық-саясаты',
    'maxfiylik-siyosati','隐私政策','kebijakan-privasi','politique-confidentialite','politica-privacidad','politica-privacidade',
    'chinh-sach-bao-mat','गोपनीयता-नीति','プライバシーポリシー','개인정보-처리방침','polityka-prywatnosci','privacybeleid','integritetspolicy']);
  return privacy.has(last) ? 'privacy_policy' : 'terms_of_service';
}
export function entryDecision(input, { native = false } = {}) {
  let url; try { url = new URL(input); } catch { return 'unmanaged'; }
  if (native) return 'native';
  if (url.protocol !== 'https:' || !APP_ENTRY_HOSTS.includes(url.hostname) || url.username || url.password || url.port) return 'unmanaged';
  if (/^\/(?:rest|storage|functions|realtime)\/v1(?:\/|$)/.test(url.pathname)
    || /^\/(?:assets|blog-covers|website|\.well-known)(?:\/|$)/.test(url.pathname)
    || /\.(?:js|css|json|xml|txt|png|jpe?g|webp|svg|woff2?|ico|pdf)$/i.test(url.pathname) || url.pathname === '/healthz') return 'resource';
  if (isLegalEntryPath(url.pathname)) return 'legal';
  // Existing public account-recovery/provider handshakes must finish before
  // returning to the app; these are not consumer dashboard bypasses.
  if (/^\/auth(?:\/|$)/.test(url.pathname) || url.pathname === '/reset-password'
    || /^\/p\/v\/[^/]+\/?$/.test(url.pathname) || /^\/payment\/(?:success|error)\/?$/.test(url.pathname)) return 'system';
  if (/^\/brands(?:\/|$)/.test(url.pathname)) return 'brand';
  if (/^\/admin(?:\/|$)/.test(url.pathname)) return 'admin';
  if (/^\/moderator(?:\/|$)/.test(url.pathname)) return 'moderator';
  const values = url.searchParams.getAll(ADMIN_WEB_QUERY);
  if (values.length === 1 && values[0] === ADMIN_WEB_VALUE) return 'admin';
  return 'launch';
}
export function entryPlatform({ userAgent = '', platform = '', maxTouchPoints = 0 } = {}) {
  if (/iPhone|iPad|iPod/i.test(userAgent) || /Mac/i.test(platform) && maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return /Mac/i.test(userAgent + platform) ? 'mac' : 'desktop';
}
export function entryLanguage(input, fallback = 'az') {
  let url; try { url = new URL(input); } catch { return languages.includes(fallback) ? fallback : 'az'; }
  const path = segments(url.pathname);
  if (path[0] === 'site') path.shift();
  const code = url.searchParams.get('blog_language') || url.searchParams.get('language') || (path[0] === 'blog' ? path[1] : path[0]);
  return languages.includes(code) ? code : languages.includes(fallback) ? fallback : 'az';
}
export function appLaunchDestination(input) {
  let url; try { url = new URL(input, 'https://app.anacan.az'); } catch { return { path: '/', language: 'az' }; }
  if (url.username || url.password || url.port || !(['anacan:', 'com.atlasoon.anacan:'].includes(url.protocol)
    || url.protocol === 'https:' && APP_ENTRY_HOSTS.includes(url.hostname))) return { path: '/', language: 'az' };
  const pathname = ['anacan:', 'com.atlasoon.anacan:'].includes(url.protocol) ? '/' + url.hostname + url.pathname : url.pathname;
  const module = url.searchParams.get('blog_module');
  const language = entryLanguage(new URL(pathname + url.search, 'https://app.anacan.az').href);
  if (modules.includes(module)) return { path: module === 'hospitalBag' ? '/tool/hospital' : module === 'babyGrowth' ? '/tool/baby-growth'
    : module === 'calendar' ? '/calendar' : '/', language, module };
  const path = segments(pathname), normalized = '/' + path.map(encodeURIComponent).join('/');
  if (path[0] === 'blog') {
    if (languages.includes(path[1])) path.splice(1, 1);
    if (path.length === 1) return { path: '/blog', language };
    if (path.length === 2 && path[1].length <= 300 && !/[\s/\\\u0000-\u001f<>?#]/u.test(path[1]) && !['.','..'].includes(path[1])) return { path: '/blog/' + encodeURIComponent(path[1]), language };
  }
  if (path.length === 1 && ['tools','ai','community','profile','cakes','premium','settings','notifications','calendar','help','edit-profile','appearance','messages'].includes(path[0])) return { path: normalized, language };
  if (path.length === 2 && ['tool','user','messages'].includes(path[0]) && /^[A-Za-z0-9_-]{1,100}$/.test(path[1])) return { path: normalized, language };
  if (path.length === 3 && path[0] === 'community' && path[1] === 'post' && /^[A-Za-z0-9_-]{1,100}$/.test(path[2])) return { path: normalized, language };
  const tab = url.searchParams.get('tab');
  if (['home','tools','ai','community','profile'].includes(tab)) return { path: tab === 'home' ? '/' : '/' + tab, language };
  return { path: '/', language };
}
export function appLaunchLinks(input) {
  const destination = appLaunchDestination(input), query = new URLSearchParams({ language: destination.language });
  if (destination.module) { query.set('blog_module', destination.module); query.set('blog_language', destination.language); }
  const schemePath = destination.path === '/' ? '//' : destination.path;
  const scheme = 'anacan:/' + schemePath + '?' + query.toString();
  const fallback = GOOGLE_PLAY_URL;
  return { destination, scheme, appStore: APP_STORE_URL, googlePlay: fallback,
    androidIntent: 'intent:/' + schemePath + '?' + query.toString() + '#Intent;scheme=anacan;package=' + APP_PACKAGE
      + ';S.browser_fallback_url=' + encodeURIComponent(fallback) + ';end' };
}
export function safeAdminNext(value, origin) {
  try {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return '/admin?web=admin';
    const url = new URL(value, origin);
    if (url.origin !== origin || url.username || url.password || /^\/admin\/login\/?$/.test(url.pathname) || /(?:access_token|refresh_token|code)=/.test(url.search)) return '/admin?web=admin';
    url.searchParams.set(ADMIN_WEB_QUERY, ADMIN_WEB_VALUE); url.hash = '';
    return url.pathname + url.search;
  } catch { return '/admin?web=admin'; }
}
