import { tr } from '@/lib/tr';

/** Localised label of a market report reason (user dialog and admin panel). */
export const marketReasonLabel = (reason: string): string => {
  switch (reason) {
    case 'spam': return tr('market_reason_spam', 'Spam');
    case 'scam': return tr('market_reason_scam', 'Fırıldaqçılıq');
    case 'inappropriate': return tr('market_reason_inappropriate', 'Uyğunsuz məzmun');
    case 'harassment': return tr('market_reason_harassment', 'Təhqir və ya narahatçılıq');
    case 'prohibited': return tr('market_reason_prohibited', 'Qadağan olunmuş əşya');
    default: return tr('market_reason_other', 'Digər');
  }
};
