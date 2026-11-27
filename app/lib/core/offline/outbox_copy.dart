// Ported from: src/lib/offline-outbox-copy.ts

import '../i18n/tr.dart';

/// Azerbaijani source copy for offline save and child loading states.
const Map<String, String> offlineOutboxCopy = {
  'outbox_saved_queued': 'Saxlanıldı, internet gələndə göndəriləcək',
  'outbox_save_failed_title': 'Yadda saxlanılmadı',
  'outbox_save_failed_desc': 'Məlumatınız itmədi. Yenidən cəhd edin.',
  'children_load_failed_title': 'Uşaq məlumatları yüklənmədi',
  'children_load_failed_desc': 'İnternet bağlantınızı yoxlayıb yenidən cəhd edin.',
  'children_load_retry': 'Yenidən cəhd et',
};

String outboxCopy(String key) => tr(key, offlineOutboxCopy[key]!);

/// Toast text of a write kept in the offline outbox.
({String title}) queuedToast() => (title: outboxCopy('outbox_saved_queued'));

/// Toast of a write the server rejected (destructive); the caller keeps the user's state for a retry.
({String title, String description, bool destructive}) saveFailedToast() => (
      title: outboxCopy('outbox_save_failed_title'),
      description: outboxCopy('outbox_save_failed_desc'),
      destructive: true,
    );

/// Text of the OfflineSyncIndicator pill.
String offlineIndicatorText() => tr('netsync_offline_indicator', 'Oflayn · internet gələndə sinxronlanacaq');
