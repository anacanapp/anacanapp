import { supabase } from '@/integrations/supabase/client';

interface CrashReport {
  error_message: string;
  error_stack?: string;
  component_stack?: string;
  url?: string;
  user_agent?: string;
  app_version?: string;
  platform?: string;
  extra_data?: Record<string, unknown>;
}

// Dedupe: skip if same message was reported in last 30s
let lastReport = { message: '', time: 0 };
const DEDUPE_MS = 30_000;

// Ignore noisy / non-actionable errors that don't represent real crashes.
// These are browser/network/storage transient conditions that pollute reports.
const IGNORED_PATTERNS: RegExp[] = [
  /signal is aborted/i,
  /the operation was aborted/i,
  /aborterror/i,
  /the user aborted a request/i,
  /load failed/i,                      // iOS Safari fetch cancellation
  /networkerror when attempting to fetch/i,
  /failed to fetch/i,                  // transient network
  /internal error was encountered in the indexed database/i,
  /write permission denied/i,          // Safari/WebView private mode storage
  /quotaexceedederror/i,
  /resizeobserver loop/i,
  /script error\.?$/i,                 // cross-origin opaque errors
  /non-error promise rejection captured/i,
  /cannot read properties of null \(reading 'useeffect'\)/i, // extension/HMR noise
  /cannot read properties of null \(reading 'getsnapshot'\)/i,
];

const shouldIgnore = (message: string): boolean => {
  if (!message) return true;
  return IGNORED_PATTERNS.some((re) => re.test(message));
};

const detectPlatform = (): string => {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  return 'web';
};

async function sendCrashReport(report: CrashReport) {
  if (shouldIgnore(report.error_message)) return;
  const now = Date.now();
  if (report.error_message === lastReport.message && now - lastReport.time < DEDUPE_MS) return;
  lastReport = { message: report.error_message, time: now };

  try {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('crash_reports').insert({
      user_id: user?.id || null,
      error_message: report.error_message.slice(0, 2000),
      error_stack: report.error_stack?.slice(0, 5000) || null,
      component_stack: report.component_stack?.slice(0, 3000) || null,
      url: report.url || window.location.href,
      user_agent: report.user_agent || navigator.userAgent,
      app_version: report.app_version || import.meta.env.VITE_APP_VERSION || 'unknown',
      platform: report.platform || detectPlatform(),
      extra_data: report.extra_data || null,
    } as any);
  } catch {
    // Silent fail — crash reporter must never crash the app
  }
}

export function initCrashReporter() {
  // Global JS errors
  window.addEventListener('error', (event) => {
    if (!event.error && !event.message) return;
    sendCrashReport({
      error_message: event.message || event.error?.message || 'Unknown error',
      error_stack: event.error?.stack,
      extra_data: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        type: 'uncaught_error',
      },
    });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason || 'Unhandled promise rejection');
    sendCrashReport({
      error_message: message,
      error_stack: reason instanceof Error ? reason.stack : undefined,
      extra_data: { type: 'unhandled_rejection' },
    });
  });
}

// For ErrorBoundary usage
export function reportComponentCrash(error: Error, componentStack?: string) {
  sendCrashReport({
    error_message: error.message,
    error_stack: error.stack,
    component_stack: componentStack,
    extra_data: { type: 'react_error_boundary' },
  });
}

/**
 * Apple/Google/email giriş xətalarını admin panelinə (Crash Reports) göndərir.
 * KRİTİK: login xətaları try/catch-lə tutulduğundan qlobal error handler-lərə
 * heç vaxt çatmır — cihazlarda nə baş verdiyini görmək mümkün olmurdu.
 * RLS anonim insert-ə icazə verir (user_id NULL) — login uğursuz olanda da işləyir.
 */
/**
 * Push çatdırılma problemlərini admin panelinə (Crash Reports) göndərir.
 * Community like/reply/DM push-ları arxa planda göndərilir və xətaları
 * yalnız console-a düşürdü — cihazlarda NƏYİN baş verdiyi görünmürdü
 * ("pushlar getmir" şikayətini araşdırmaq mümkün deyildi).
 * type filter: [push:community_like] Forbidden... kimi sətirlər.
 */
export function reportPushFailure(kind: string, reason: string, extra?: Record<string, unknown>) {
  sendCrashReport({
    error_message: `[push:${kind}] ${reason}`.slice(0, 500),
    extra_data: { type: 'push_delivery', kind, ...extra },
  });
}

export function reportAuthError(provider: string, error: unknown) {
  const err = error as any;
  const message = err?.message || err?.errorMessage || String(error || 'Unknown auth error');
  const code = err?.code || err?.error_code || err?.status || null;
  sendCrashReport({
    error_message: `[auth:${provider}] ${message}`,
    error_stack: err?.stack,
    extra_data: {
      type: 'auth_error',
      provider,
      code,
      // Supabase AuthError sahələri (varsa)
      error_name: err?.name || null,
      error_status: err?.status || null,
    },
  });
}
