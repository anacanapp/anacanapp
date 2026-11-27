// Ported from: src/components/tools/market/marketReasonLabel.ts
import '../../../core/i18n/tr.dart';

/// Localised label of a market report reason (user dialog and admin panel).
String marketReasonLabel(String reason) => switch (reason) {
      'spam' => tr('market_reason_spam', 'Spam'),
      'scam' => tr('market_reason_scam', 'Fırıldaqçılıq'),
      'inappropriate' => tr('market_reason_inappropriate', 'Uyğunsuz məzmun'),
      'harassment' => tr('market_reason_harassment', 'Təhqir və ya narahatçılıq'),
      'prohibited' => tr('market_reason_prohibited', 'Qadağan olunmuş əşya'),
      _ => tr('market_reason_other', 'Digər'),
    };
