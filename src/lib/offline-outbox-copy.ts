import { tr } from './tr';

/** Azerbaijani source copy for offline save and child loading states (all 25 app languages). */
export const OFFLINE_OUTBOX_COPY = {
  outbox_saved_queued: 'Saxlanıldı, internet gələndə göndəriləcək',
  outbox_save_failed_title: 'Yadda saxlanılmadı',
  outbox_save_failed_desc: 'Məlumatınız itmədi. Yenidən cəhd edin.',
  children_load_failed_title: 'Uşaq məlumatları yüklənmədi',
  children_load_failed_desc: 'İnternet bağlantınızı yoxlayıb yenidən cəhd edin.',
  children_load_retry: 'Yenidən cəhd et',
} as const;

export type OfflineOutboxCopyKey = keyof typeof OFFLINE_OUTBOX_COPY;

export const outboxCopy = (key: OfflineOutboxCopyKey) => tr(key, OFFLINE_OUTBOX_COPY[key]);

/** Toast for a write kept in the offline outbox. */
export const queuedToast = () => ({ title: outboxCopy('outbox_saved_queued') });

/** Toast for a write the server rejected; the caller keeps the user's state for a retry. */
export const saveFailedToast = () => ({
  title: outboxCopy('outbox_save_failed_title'),
  description: outboxCopy('outbox_save_failed_desc'),
  variant: 'destructive' as const,
});
