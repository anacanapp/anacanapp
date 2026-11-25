import { tr } from "@/lib/tr";import { isNewAccount, PUSH_GRANTED_EVENT } from '@/lib/onboardingTour';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { isNative, isIOS, isAndroid } from '@/lib/native';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

// FirebaseMessaging listener handles are module-level: every registerDevice()
// (re-register, account switch, multiple mounts) replaces the previous set
// instead of stacking another tokenReceived/notificationReceived/action trio.
type PushListenerHandle = { remove: () => Promise<void> };
let firebasePushListenerHandles: Array<Promise<PushListenerHandle>> = [];
const replaceFirebasePushListeners = (next: Array<Promise<PushListenerHandle>>) => {
  const previous = firebasePushListenerHandles;
  firebasePushListenerHandles = next;
  for (const handle of previous) {
    void handle.then((h) => h.remove()).catch(() => {});
  }
};

let fallbackRegistrationHandles: Array<Promise<PushListenerHandle>> = [];

/**
 * Explains why before the OS prompt. 'prompt' (never asked): the toast's "Allow" opens the OS prompt.
 * 'denied': the OS no longer prompts, so it points to the device settings.
 */
function showPermissionToast(receive: string, ask: () => Promise<void>) {
  const title = tr("usedevicetoken_bildirislere_icaze_verin", "Bildirişlərə icazə verin");
  if (receive === 'denied') {
    toast(title, {
      description: tr("usedevicetoken_bildiris_izah", "Vacib məlumatları və xatırlatmaları almaq üçün cihaz ayarlarından tətbiqə bildiriş göndərməyə icazə verin."),
      duration: 8000,
    });
    return;
  }
  if (receive !== 'prompt' && receive !== 'prompt-with-rationale') return;
  toast(title, {
    description: tr("pushperm_reason", "Peyvənd və digər xatırlatmaları, yeni mesajları vaxtında almaq üçün bildirişlərə icazə verin."),
    duration: 12000,
    action: { label: tr("pushperm_allow", "İcazə ver"), onClick: () => { void ask().catch(() => {}); } },
  });
}

// The token this device last committed for an account. Logout runs outside this hook
// (AuthContext.signOut), so the row/token are tracked at module level.
let committedDeviceToken: { token: string; userId: string } | null = null;

const settleWithin = <T,>(work: Promise<T>, ms: number): Promise<T | undefined> =>
  Promise.race([work.catch(() => undefined), new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))]);

/**
 * Logout privacy cleanup. Runs BEFORE the session is cleared (RLS needs it): removes this
 * device's push row for this account, drops the FCM token and the push listeners so a
 * later token refresh cannot re-attach the device to the signed-out account. Every step is
 * bounded and best-effort; it never throws and never blocks logout for long.
 */
export async function unregisterDeviceForLogout(userId: string, timeoutMs = 2500): Promise<void> {
  if (!userId) return;
  // Stop tokenReceived from re-saving a refreshed token for the old account.
  replaceFirebasePushListeners([]);
  const known = committedDeviceToken?.userId === userId ? committedDeviceToken.token : null;
  committedDeviceToken = null;
  if (!isNative) return;
  let token = known;
  if (!token) {
    // Registered in an earlier app run: read the current token only when push is already
    // allowed (never prompts the user during logout).
    token = (await settleWithin((async () => {
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      const permission = await FirebaseMessaging.checkPermissions();
      if (permission.receive !== 'granted') return null;
      return (await FirebaseMessaging.getToken()).token || null;
    })(), timeoutMs)) ?? null;
  }
  if (token) {
    await settleWithin(Promise.resolve(supabase.from('device_tokens').delete().eq('user_id', userId).eq('token', token))
      .then(({ error }) => { if (error) console.warn('[DeviceToken] Logout unregister failed'); }), timeoutMs);
  }
  await settleWithin((async () => {
    try {
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      await FirebaseMessaging.deleteToken();
    } catch {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.unregister();
    }
  })(), timeoutMs);
  // Delivered pushes of the signed-out account leave the notification centre too.
  await settleWithin((async () => {
    try {
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      await FirebaseMessaging.removeAllDeliveredNotifications();
    } catch {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.removeAllDeliveredNotifications();
    }
  })(), timeoutMs);
}

export const useDeviceToken = () => {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registrationAttempted = useRef(false);
  const registeredUserId = useRef<string | null>(null);

  // Save token using safe upsert. Never delete other tokens until the new one is committed.
  const saveTokenToDatabase = useCallback(async (deviceToken: string, userId: string) => {
    try {
      const platform = Capacitor.getPlatform();
      const platformValue = platform === 'ios' ? 'ios' : 'android';
      const deviceName = `${platform} - ${navigator.userAgent.substring(0, 50)}`;

      console.log('[DeviceToken] Upserting token:', {
        userId,
        platform: platformValue,
        tokenSuffix: '...' + deviceToken.slice(-12)
      });

      // 1) Upsert on `token` (unique). If this physical device was previously bound
      //    to a different profile on the same device (multi-account testing),
      //    ownership transfers to the currently logged-in user — preventing
      //    the same push from arriving multiple times to one device.
      const { error: upsertError } = await supabase.
      from('device_tokens').
      upsert(
        {
          user_id: userId,
          token: deviceToken,
          platform: platformValue,
          device_name: deviceName,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'token' }
      );

      if (upsertError) {
        console.error('[DeviceToken] Upsert error:', upsertError);
        return false;
      }

      // 2) Clean up stale tokens for this user on this platform (different token strings).
      const { error: cleanupError } = await supabase.
      from('device_tokens').
      delete().
      eq('user_id', userId).
      eq('platform', platformValue).
      neq('token', deviceToken);

      if (cleanupError) {
        console.warn('[DeviceToken] Stale-token cleanup warning:', cleanupError);
      }

      committedDeviceToken = { token: deviceToken, userId };
      console.log('[DeviceToken] Token saved successfully');
      return true;
    } catch (err) {
      console.error('[DeviceToken] Exception saving token:', err);
      return false;
    }
  }, []);

  // Register device and save token using Firebase Messaging (returns FCM token on both iOS & Android)
  const registerDevice = useCallback(async () => {
    if (!user) {
      console.log('[DeviceToken] No user, skipping registration');
      return null;
    }

    if (!isNative) {
      console.log('[DeviceToken] Not native platform, skipping');
      return null;
    }

    if (registrationAttempted.current) {
      console.log('[DeviceToken] Registration already attempted');
      return token;
    }

    registrationAttempted.current = true;
    setLoading(true);
    setError(null);

    const platform = Capacitor.getPlatform();
    console.log('[DeviceToken] Starting registration. Platform:', platform, 'User:', user.id);

    try {
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

      const permStatus = await FirebaseMessaging.checkPermissions();
      console.log('[DeviceToken] Current permission:', permStatus.receive);

      const today = new Date().toDateString();
      const lastPrompt = localStorage.getItem('last_push_prompt_date');

      // Never shows the OS prompt on its own (this runs at app start). New accounts (< 24h): the onboarding
      // notifications step and the in-app tour explain and ask. Older accounts that were never asked get a
      // daily toast that explains why first; the OS prompt opens only when they tap "Allow". Devices that
      // already allowed register silently.
      if (permStatus.receive !== 'granted' && !isNewAccount(user.created_at) && lastPrompt !== today) {
        localStorage.setItem('last_push_prompt_date', today);
        showPermissionToast(permStatus.receive, async () => {
          const result = await FirebaseMessaging.requestPermissions();
          if (result.receive === 'granted') window.dispatchEvent(new Event(PUSH_GRANTED_EVENT));
        });
      }

      if (permStatus.receive !== 'granted') {
        const errorMsg = 'Push notification permission denied';
        console.log('[DeviceToken]', errorMsg);
        setError(errorMsg);
        setLoading(false);
        return null;
      }

      console.log('[DeviceToken] Getting FCM token...');
      const tokenResult = await FirebaseMessaging.getToken();
      const deviceToken = tokenResult.token;

      if (!deviceToken) {
        console.error('[DeviceToken] No token returned from FirebaseMessaging.getToken()');
        setError(tr("usedevicetoken_fcm_token_alina_bilmedi_10d88a", "FCM token al\u0131na bilm\u0259di"));
        setLoading(false);
        return null;
      }

      console.log('[DeviceToken] FCM token received: ...' + deviceToken.slice(-12));
      setToken(deviceToken);

      const saved = await saveTokenToDatabase(deviceToken, user.id);
      if (!saved) {
        setError(tr("usedevicetoken_token_alindi_amma_saxlanmadi_98a023", "Token al\u0131nd\u0131 amma saxlanmad\u0131"));
      }

      // Token refresh listener
      replaceFirebasePushListeners([
      FirebaseMessaging.addListener('tokenReceived', async (newTokenData) => {
        const newToken = newTokenData.token;
        console.log('[DeviceToken] Token refreshed: ...' + newToken.slice(-12));
        setToken(newToken);
        await saveTokenToDatabase(newToken, user.id);
      }),

      FirebaseMessaging.addListener('notificationReceived', (notification) => {
        console.log('[DeviceToken] Push received in foreground:', notification);
        // Show in-app toast so user is not blind to incoming notifications
        const title = notification?.notification?.title || tr("usedevicetoken_yeni_bildiris_c68787", "Yeni bildiri\u015F");
        const body = notification?.notification?.body || '';
        toast(title, { description: body });
      })
      // Taps (notificationActionPerformed) are handled from app start by notification-taps.ts.
      ]);

      setLoading(false);
      return deviceToken;

    } catch (err: any) {
      console.error('[DeviceToken] Registration exception:', err);

      // Fallback to @capacitor/push-notifications if Firebase Messaging fails
      console.log('[DeviceToken] Trying fallback with @capacitor/push-notifications...');
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        const permStatus = await PushNotifications.checkPermissions();
        const today = new Date().toDateString();
        const lastPrompt = localStorage.getItem('last_push_prompt_date');

        if (permStatus.receive !== 'granted' && !isNewAccount(user.created_at) && lastPrompt !== today) {
          localStorage.setItem('last_push_prompt_date', today);
          showPermissionToast(permStatus.receive, async () => {
            const result = await PushNotifications.requestPermissions();
            if (result.receive === 'granted') window.dispatchEvent(new Event(PUSH_GRANTED_EVENT));
          });
        }

        if (permStatus.receive !== 'granted') {
          setError('Push notification permission denied');
          setLoading(false);
          return null;
        }

        // Only this hook's own registration listeners are replaced: removeAllListeners() would also drop
        // the app-start tap listener (notification-taps.ts).
        for (const handle of fallbackRegistrationHandles.splice(0)) void handle.then((h) => h.remove()).catch(() => {});

        return new Promise<string | null>((resolve) => {
          const timeout = setTimeout(() => {
            console.log('[DeviceToken] Fallback registration timeout');
            setLoading(false);
            resolve(null);
          }, 15000);

          fallbackRegistrationHandles.push(PushNotifications.addListener('registration', async (tokenData) => {
            clearTimeout(timeout);
            const fallbackToken = tokenData.value;
            console.log('[DeviceToken] Fallback token received: ...' + fallbackToken.slice(-12));
            setToken(fallbackToken);
            await saveTokenToDatabase(fallbackToken, user.id);
            setLoading(false);
            resolve(fallbackToken);
          }));

          fallbackRegistrationHandles.push(PushNotifications.addListener('registrationError', (regErr) => {
            clearTimeout(timeout);
            console.error('[DeviceToken] Fallback registration error:', regErr);
            setError(regErr.error || 'Registration failed');
            setLoading(false);
            resolve(null);
          }));

          PushNotifications.register();
        });
      } catch (fallbackErr) {
        console.error('[DeviceToken] Fallback also failed:', fallbackErr);
        setError(err.message || 'Unknown error');
        setLoading(false);
        return null;
      }
    }
  }, [user, token, saveTokenToDatabase]);

  // Remove device token on logout (AuthContext.signOut calls unregisterDeviceForLogout directly)
  const unregisterDevice = useCallback(async () => {
    if (!user) return;
    if (token && committedDeviceToken?.token !== token) committedDeviceToken = { token, userId: user.id };
    await unregisterDeviceForLogout(user.id);
    setToken(null);
    registrationAttempted.current = false;
  }, [user, token]);

  // The in-app tour asked for push and the user allowed it: register this device now.
  useEffect(() => {
    const onGranted = () => { if (!isNative || !user) return; registrationAttempted.current = false; void registerDevice(); };
    window.addEventListener(PUSH_GRANTED_EVENT, onGranted);
    return () => window.removeEventListener(PUSH_GRANTED_EVENT, onGranted);
  }, [user, registerDevice]);

  // Auto-register on mount if native and user exists; reset on user change
  useEffect(() => {
    if (!user) {
      registrationAttempted.current = false;
      registeredUserId.current = null;
      setToken(null);
      return;
    }
    // If user changed (different account logged in), force re-register so token attaches to new user
    if (registeredUserId.current && registeredUserId.current !== user.id) {
      console.log('[DeviceToken] User changed, resetting registration');
      registrationAttempted.current = false;
    }
    // On-device reminders belong to this account; another account's leftovers are cancelled.
    if (isNative) void import('@/lib/local-notification-scheduler').then((m) => m.bindLocalNotificationOwner(user.id)).catch(() => {});
    if (isNative && !registrationAttempted.current) {
      registeredUserId.current = user.id;
      registerDevice();
    }
  }, [user, registerDevice]);

  return {
    token,
    loading,
    error,
    isNative,
    isIOS,
    isAndroid,
    registerDevice,
    unregisterDevice
  };
};