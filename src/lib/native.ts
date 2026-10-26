import { Capacitor } from '@capacitor/core';
import { tr } from '@/lib/tr';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Filesystem, Directory } from '@capacitor/filesystem';

// Check if we're running on native platform
export const isNative = Capacitor.isNativePlatform();
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isAndroid = Capacitor.getPlatform() === 'android';

// Android-də Firebase (google-services.json) qurulmayanda PushNotifications.register()
// native tərəfdə crash verə bilir. Default olaraq Android push auto-register söndürülür.
// Firebase hazır olanda lokal build zamanı bunu aktiv edin:
//   VITE_ANDROID_PUSH_AUTO_REGISTER=true
const androidPushAutoRegister = (import.meta.env as any).VITE_ANDROID_PUSH_AUTO_REGISTER === 'true';

// Haptic Feedback
export const hapticFeedback = {
  light: async () => {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  },
  medium: async () => {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
  },
  heavy: async () => {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    }
  },
  vibrate: async () => {
    if (isNative) {
      await Haptics.vibrate();
    }
  }
};

// Status Bar
export const statusBar = {
  setLight: async () => {
    if (isNative) {
      await StatusBar.setStyle({ style: Style.Light });
    }
  },
  setDark: async () => {
    if (isNative) {
      await StatusBar.setStyle({ style: Style.Dark });
    }
  },
  hide: async () => {
    if (isNative) {
      await StatusBar.hide();
    }
  },
  show: async () => {
    if (isNative) {
      await StatusBar.show();
    }
  }
};

// Push Notifications - uses @capacitor-firebase/messaging for proper FCM tokens on iOS & Android
export const pushNotifications = {
  register: async () => {
    if (!isNative) return;

    if (isAndroid && !androidPushAutoRegister) {
      console.warn(
        tr("native_android_push_auto_register_dea_fcc9e3", "Android push auto-register deaktivdir (Firebase qurulmay\u0131b ola bil\u0259r). ") + tr("native_aktiv_etmek_ucun_vite_android__e20df2", "Aktiv etm\u0259k \xFC\xE7\xFCn: VITE_ANDROID_PUSH_AUTO_REGISTER=true")

      );
      return;
    }

    try {
      // Try Firebase Messaging first (returns proper FCM token on both platforms)
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

      let permStatus = await FirebaseMessaging.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await FirebaseMessaging.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.log('Push notification permission not granted');
        return;
      }

      const tokenResult = await FirebaseMessaging.getToken();
      console.log('Firebase Messaging token obtained:', tokenResult.token.substring(0, 30) + '...');
    } catch (error) {
      console.warn('Firebase Messaging not available, falling back to Capacitor PushNotifications:', error);

      // Fallback to @capacitor/push-notifications
      try {
        const { PushNotifications: CapPush } = await import('@capacitor/push-notifications');

        let permStatus = await CapPush.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await CapPush.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
          console.log('Push notification permission not granted');
          return;
        }
        await CapPush.register();
      } catch (fallbackError) {
        console.error('Push notification registration failed:', fallbackError);
      }
    }
  },

  addListeners: () => {
    if (!isNative) return;

    // Try Firebase Messaging listeners first
    // FirebaseMessaging tokenReceived / notificationReceived /
    // notificationActionPerformed listeners are owned by useDeviceToken (they
    // save refreshed tokens, show the foreground toast and route taps). The
    // log-only duplicates that used to be registered here are intentionally
    // omitted; only the import-failure fallback below remains.
    import('@capacitor-firebase/messaging').then(() => {
      // Listeners are registered by useDeviceToken.registerDevice().
    }).catch(() => {
      // Fallback to capacitor push listeners
      import('@capacitor/push-notifications').then(({ PushNotifications: CapPush }) => {
        CapPush.addListener('registration', (token) => {
          console.log('Push registration success, token: ' + token.value);
        });

        CapPush.addListener('registrationError', (err) => {
          console.error('Registration error: ', err.error);
        });

        CapPush.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received: ', notification);
        });

        CapPush.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push notification action performed', notification.actionId, notification.inputValue);
        });
      });
    });
  }
};

// Single stable id for the daily water reminder
const WATER_NOTIFICATION_ID = 101;

// Local Notifications
export const localNotifications = {
  checkPermissions: async () => {
    if (!isNative) return { display: 'granted' };
    return await LocalNotifications.checkPermissions();
  },

  requestPermissions: async () => {
    if (!isNative) return { display: 'granted' };
    return await LocalNotifications.requestPermissions();
  },

  schedule: async (notifications: {
    id: number;
    title: string;
    body: string;
    schedule?: {at?: Date;on?: {hour: number;minute: number;};repeats?: boolean;};
  }[]) => {
    if (!isNative) {
      console.log('Local notification scheduled (web mode):', notifications);
      return;
    }

    const permStatus = await LocalNotifications.requestPermissions();
    if (permStatus.display !== 'granted') {
      console.log('Local notification permission not granted');
      return;
    }

    await LocalNotifications.schedule({
      notifications: notifications.map((n) => ({
        ...n,
        sound: undefined,
        attachments: undefined,
        actionTypeId: '',
        extra: null
      }))
    });
  },

  // Cancel every pending water reminder (current id + the legacy every-2-hours ids 108..120)
  cancelWaterReminders: async () => {
    if (!isNative) return;
    try {
      const waterIds = [WATER_NOTIFICATION_ID, 108, 110, 112, 114, 116, 118, 120];
      const pending = await LocalNotifications.getPending();
      const toCancel = pending.notifications.filter((n) => waterIds.includes(n.id));
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel.map((n) => ({ id: n.id })) });
      }
    } catch (e) {
      console.warn('cancelWaterReminders failed:', e);
    }
  },

  // Schedule the water reminder — exactly ONE notification per day at 10:00
  // (repeats daily). Any legacy every-2-hours reminders are cancelled first.
  scheduleWaterReminder: async () => {
    await localNotifications.cancelWaterReminders();

    await localNotifications.schedule([{
      id: WATER_NOTIFICATION_ID,
      title: tr("notifications_water_daily_title", "Su vaxtı! 💧"),
      body: tr("notifications_water_daily_body", "Gündə ən azı 8 stəkan su içməyi unutmayın."),
      schedule: { on: { hour: 10, minute: 0 }, repeats: true }
    }]);
  },

  // Schedule pill reminder
  schedulePillReminder: async (time: Date) => {
    await localNotifications.schedule([{
      id: 200,
      title: tr("native_vitamin_vaxti_9bfc40", "Vitamin vaxtı! 💊"),
      body: tr("native_gundelik_vitaminlerinizi_qebul_6a3811", "G\xFCnd\u0259lik vitaminl\u0259rinizi q\u0259bul etm\u0259yi unutmay\u0131n."),
      schedule: { at: time }
    }]);
  },

  // Schedule appointment reminder
  scheduleAppointmentReminder: async (appointmentDate: Date, title: string) => {
    const reminderTime = new Date(appointmentDate);
    reminderTime.setDate(reminderTime.getDate() - 1);
    reminderTime.setHours(10, 0, 0, 0);

    await localNotifications.schedule([{
      id: 300,
      title: tr("appointments_sabah_randevunuz_var", 'Sabah randevunuz var!') + ' 📅',
      body: title,
      schedule: { at: reminderTime }
    }]);
  },

  cancelAll: async () => {
    if (!isNative) return;

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id }))
      });
    }
  }
};

// Native Share
export const nativeShare = async (data: {title?: string;text?: string;url?: string;}) => {
  if (isNative) {
    try { const { Share } = await import('@capacitor/share'); await Share.share(data); return true; }
    catch { return false; }
  }
  // Check if native share is available
  if (navigator.share) {
    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      // User cancelled or error
      console.log('Share cancelled or failed:', error);
      return false;
    }
  } else {
    // Fallback: copy to clipboard
    const textToCopy = [data.text, data.url && !data.text?.includes(data.url) ? data.url : null].filter(Boolean).join('\n\n');
    if (textToCopy) {
      await navigator.clipboard.writeText(textToCopy);
      return true;
    }
    return false;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// NATIVE IMAGE DOWNLOAD - Saves images to Photos app on iOS/Android
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Downloads an image and saves it to the device's photo gallery
 * On iOS: Opens share sheet for "Save to Photos" action
 * On Android: Saves to Pictures folder (visible in Gallery)
 * On Web: Falls back to browser download
 */
export const saveImageToGallery = async (imageUrl: string, fileName?: string): Promise<boolean> => {
  const finalFileName = fileName || `anacan-photo-${Date.now()}.jpg`;

  // Web fallback
  if (!isNative) {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = finalFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      return true;
    } catch (error) {
      console.error('Web download failed:', error);
      return false;
    }
  }

  try {
    console.log('Starting native image download:', imageUrl);

    // Fetch the image as blob
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();

    // Convert blob to base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remove the data:image/xxx;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    if (isIOS) {
      // iOS: Save to Documents then trigger share sheet for saving to Photos
      try {
        // First save to Documents directory
        const writeResult = await Filesystem.writeFile({
          path: finalFileName,
          data: base64Data,
          directory: Directory.Documents
        });
        console.log('iOS: File saved to Documents:', writeResult.uri);

        // Now read it back as a blob for sharing
        const readResult = await Filesystem.readFile({
          path: finalFileName,
          directory: Directory.Documents
        });

        // Convert base64 back to blob for sharing
        const byteCharacters = atob(readResult.data as string);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const shareBlob = new Blob([byteArray], { type: 'image/jpeg' });
        const file = new File([shareBlob], finalFileName, { type: 'image/jpeg' });

        // Open share sheet - user can "Save Image" from here
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: tr("native_sekli_yadda_saxla_dfbccd", "Şəkli yadda saxla")
          });
          console.log('iOS: Share sheet opened successfully');
        } else {
          console.log('iOS: Sharing files not supported, file saved to Documents');
        }

        return true;
      } catch (iosError) {
        console.error('iOS save error:', iosError);
        // Last resort: just save to Documents
        try {
          await Filesystem.writeFile({
            path: finalFileName,
            data: base64Data,
            directory: Directory.Documents
          });
          return true;
        } catch {
          return false;
        }
      }
    } else if (isAndroid) {
      // Android: Save to Downloads/Pictures - this will be visible in Gallery
      try {
        // Try saving to external storage first (Pictures folder)
        const result = await Filesystem.writeFile({
          path: `Pictures/${finalFileName}`,
          data: base64Data,
          directory: Directory.ExternalStorage
        });
        console.log('Android: File saved to Pictures:', result.uri);
        return true;
      } catch (extError) {
        console.log('External storage failed, trying Documents:', extError);
        // Fallback to Documents
        const result = await Filesystem.writeFile({
          path: finalFileName,
          data: base64Data,
          directory: Directory.Documents
        });
        console.log('Android: File saved to Documents:', result.uri);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Native image save failed:', error);

    // Final fallback: Try cache directory
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      await Filesystem.writeFile({
        path: finalFileName,
        data: base64Data,
        directory: Directory.Cache
      });

      console.log('Fallback: File saved to cache');
      return true;
    } catch (fallbackError) {
      console.error('All save attempts failed:', fallbackError);
      return false;
    }
  }
};

// Initialize native features
export const initializeNativeFeatures = async () => {
  if (!isNative) {
    console.log('Running in web mode - native features disabled');
    return;
  }

  console.log('Initializing native features...');

  // ScreenCaptureGuard owns route-aware native protection and an opaque curtain.

  // Set status bar style
  await statusBar.setDark();

  // App hides the native launch screen after React's first painted frame.

  // Register for push notifications
  await pushNotifications.register();
  pushNotifications.addListeners();

  // Schedule default reminders — respect the user's persisted toggle
  // (useNotificationSettings mirrors `water_reminder` into localStorage).
  let waterEnabled = true;
  try {
    waterEnabled = localStorage.getItem('anacan_water_reminder_enabled') !== 'false';
  } catch {
    // ignore storage errors
  }
  if (waterEnabled) {
    await localNotifications.scheduleWaterReminder();
  }

  console.log('Native features initialized');
};
