import { useState } from 'react';
import { APP_LANGUAGES, type AppLanguageCode } from '@/lib/app-languages';
import { BLOG_MODULES, blogEditorial, type BlogEditorialMetadata, type BlogEditorialLocale } from '@/lib/blog-editorial';
import { blogText } from '@/lib/blog-i18n';
import { useUserStore } from '@/store/userStore';

const emptyLocale = (): BlogEditorialLocale => ({ seoTitle: '', seoDescription: '', coverAlt: '', tags: [], faq: [] });
export default function BlogSeoFields({ value, onChange }: { value: unknown; onChange: (value: BlogEditorialMetadata) => void }) {
  const uiLanguage = useUserStore(state => state.language);
  const [language, setLanguage] = useState<AppLanguageCode>('az');
  const metadata = blogEditorial(value) || { schema: 'anacan-blog-editorial-v1', lifeStages: [], modules: [], relatedSlugs: [], locales: {} };
  const locale = metadata.locales[language] || emptyLocale();
  const change = (updates: Partial<BlogEditorialLocale>) => onChange({ ...metadata, locales: { ...metadata.locales, [language]: { ...locale, ...updates } } });
  const t = (key: Parameters<typeof blogText>[0]) => blogText(key, uiLanguage);
  return <section className="rounded-xl border border-border p-4 space-y-4" data-admin-blog-seo>
    <div className="flex items-center justify-between gap-3"><h3 className="font-bold">{t('seo')}</h3>
      <select className="bg-background rounded-lg border p-2" value={language} aria-label={t('language')} onChange={event => setLanguage(event.target.value as AppLanguageCode)}>
        {APP_LANGUAGES.map(item => <option key={item.code} value={item.code}>{item.native_name}</option>)}
      </select>
    </div>
    <label className="block text-sm">{t('seoTitleField')}<input className="a-input mt-1" value={locale.seoTitle} onChange={event => change({ seoTitle: event.target.value })} /></label>
    <label className="block text-sm">{t('seoDescriptionField')}<textarea className="a-input mt-1 h-24" value={locale.seoDescription} onChange={event => change({ seoDescription: event.target.value })} /></label>
    <label className="block text-sm">{t('coverAltField')}<input className="a-input mt-1" value={locale.coverAlt} onChange={event => change({ coverAlt: event.target.value })} /></label>
    <label className="block text-sm">{t('keywords')}<input className="a-input mt-1" value={locale.tags.join(', ')} onChange={event => change({ tags: event.target.value.split(',').map(value => value.trim()).filter(Boolean) })} /></label>
    <fieldset className="space-y-2"><legend className="font-semibold text-sm">{t('modules')}</legend><div className="flex flex-wrap gap-3">{BLOG_MODULES.map(module => <label key={module} className="text-sm flex gap-2 items-center">
      <input type="checkbox" checked={metadata.modules.includes(module)} onChange={event => onChange({ ...metadata, modules: event.target.checked ? [...metadata.modules, module] : metadata.modules.filter(value => value !== module) })} />{t(module)}
    </label>)}</div></fieldset>
    <fieldset><legend className="font-semibold text-sm mb-2">{t('mommy')} / {t('bump')} / {t('flow')}</legend><div className="flex gap-4">{(['mommy','bump','flow'] as const).map(stage => <label key={stage} className="text-sm flex gap-2 items-center">
      <input type="checkbox" checked={metadata.lifeStages.includes(stage)} onChange={event => onChange({ ...metadata, lifeStages: event.target.checked ? [...metadata.lifeStages, stage] : metadata.lifeStages.filter(value => value !== stage) })} />{t(stage)}
    </label>)}</div></fieldset>
    {!!locale.faq.length && <fieldset className="space-y-3"><legend className="font-semibold text-sm">{t('faq')}</legend>{locale.faq.map((faq, index) => <div key={index} className="space-y-1">
      <input className="a-input" aria-label={`${t('faq')} ${index + 1}`} value={faq.question} onChange={event => change({ faq: locale.faq.map((item, number) => number === index ? { ...item, question: event.target.value } : item) })} />
      <textarea className="a-input h-24" aria-label={`${t('faq')} ${index + 1}`} value={faq.answer} onChange={event => change({ faq: locale.faq.map((item, number) => number === index ? { ...item, answer: event.target.value } : item) })} />
    </div>)}</fieldset>}
    {metadata.sourceDocument && <p className="text-xs"><a href={metadata.sourceDocument} className="underline" target="_blank" rel="noopener noreferrer">{t('source')}</a></p>}
    <div className="flex flex-wrap gap-2">{APP_LANGUAGES.map(item => <span key={item.code} title={item.native_name} className={`text-xs px-2 py-1 rounded ${metadata.locales[item.code]?.seoTitle && metadata.locales[item.code]?.seoDescription ? 'bg-green-100 text-green-900' : 'bg-muted'}`}>{item.code.toUpperCase()}</span>)}</div>
  </section>;
}
