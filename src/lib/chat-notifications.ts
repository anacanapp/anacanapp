import { isNative } from "@/lib/native";

const CHAT_ID_BASE = 1_100_000_000;
const CHAT_ID_SPAN = 100_000_000;

/**
 * Check if current time is within silent hours
 * Silent hours are stored in localStorage per user
 */
const isInSilentHours = (userId?: string): boolean => {
  if (!userId) return false;
  
  try {
    const stored = localStorage.getItem(`silent_hours_${userId}`);
    if (!stored) return false;
    
    const settings = JSON.parse(stored);
    if (!settings.enabled) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [startH, startM] = (settings.startTime || '22:00').split(':').map(Number);
    const [endH, endM] = (settings.endTime || '08:00').split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Handle overnight ranges (e.g., 22:00 - 08:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
  } catch {
    return false;
  }
};

/**
 * Best-effort phone notification for incoming chat messages.
 * Respects silent hours setting.
 * Note: This is NOT true remote push (works when the app is running and receives realtime updates).
 */
export const notifyIncomingChatMessage = async (params: {
  title: string;
  body: string;
  idSeed?: number;
  userId?: string;
}) => {
  // Skip notification if in silent hours
  if (isInSilentHours(params.userId)) {
    console.log('Skipping notification - silent hours active');
    return;
  }

  // Avoid showing system notifications while user is actively viewing the app.
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;

  // Use native local notification
  if (isNative) {
    // Shown at once (never a pending slot). Ids live in their own range so a chat notification can never
    // replace a scheduled reminder; it never asks for permission (it arrives while the app is in the background).
    const id = CHAT_ID_BASE + Math.abs(Math.floor((params.idSeed ?? Date.now()) % CHAT_ID_SPAN));
    const { notifyNow } = await import("@/lib/local-notification-scheduler");
    await notifyNow({ id, title: params.title, body: params.body });
  } else {
    // Web fallback - use browser Notification API if granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(params.title, { body: params.body });
    }
  }
};
