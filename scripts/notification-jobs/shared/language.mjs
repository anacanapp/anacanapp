export const NOTIFICATION_LANGUAGES = Object.freeze(['az','en','tr','ru','de','ar','ka','kk','uz','zh','id','fr','es','pt','vi','hi','ja','ko','pl','nl','sv','ky','et']);
export function notificationLanguage(value) {
  const language = typeof value === 'string' ? value.trim().toLowerCase().replaceAll('_', '-').split('-')[0] : '';
  return NOTIFICATION_LANGUAGES.includes(language) ? language : 'az';
}
/** Never substitute another language's template or mix title/body locales. */
export function notificationCopy(row, value) {
  const language = notificationLanguage(value);
  const text = field => {
    const localized = row[`${field}_${language}`];
    if (typeof localized === 'string' && localized.trim()) return localized.trim();
    return language === 'az' && typeof row[field] === 'string' ? row[field].trim() : '';
  };
  const title = text('title'), body = text('body');
  return title && body ? { title, body, language } : null;
}
