import { useState } from 'react';
import { Check, ClipboardCheck, X } from 'lucide-react';
import { brandError } from '@/lib/brand-ads';
import NativeAdCard from '@/components/banners/NativeAdCard';
import { usePortalMutation, usePortalReviewQueue } from './queries';
import { BrandPanel, type BrandTranslate } from './Portal';

/** /brands/manage: approve brand drafts. Lead form copy is reviewed; lead answers are never shown here. */
export default function BrandReviewQueue({ t, language }: { t: BrandTranslate; language: string }) {
  const queue = usePortalReviewQueue(true), review = usePortalMutation('admin_brand_review_v1');
  const [notes, setNotes] = useState<Record<string, string>>({}), [error, setError] = useState(''), [feedback, setFeedback] = useState('');
  const decide = async (kind: 'creative' | 'lead_form', id: string, revision: number, approve: boolean) => {
    setError(''); setFeedback('');
    try {
      await review.mutateAsync({ p_kind: kind, p_id: id, p_revision: revision, p_approve: approve, p_note: notes[id]?.trim() || null });
      setFeedback(approve ? t(kind === 'creative' ? 'approved_creative' : 'approved') : t('rejected'));
    } catch (failure) { setError(brandError(failure, language)); }
  };
  const actions = (kind: 'creative' | 'lead_form', id: string, revision: number) => <div className="brand-form">
    <label>{t('review_note')}<input className="brand-input" maxLength={500} placeholder={t('review_note_placeholder')} value={notes[id] ?? ''} onChange={event => setNotes(old => ({ ...old, [id]: event.target.value }))} /></label>
    <div className="brand-actions"><button className="brand-button" disabled={review.isPending} onClick={() => { void decide(kind, id, revision, false); }}><X size={15} />{t('reject')}</button>
      <button className="brand-button primary" disabled={review.isPending} onClick={() => { void decide(kind, id, revision, true); }}><Check size={15} />{t('approve')}</button></div></div>;
  const items = (queue.data?.creatives.length ?? 0) + (queue.data?.lead_forms.length ?? 0);
  return <BrandPanel title={t('review_queue')} hint={t('review_hint')}>
    {error && <div className="brand-form-error" role="alert">{error}</div>}{feedback && <div className="brand-notice" role="status">{feedback}</div>}
    {queue.isError ? <p className="brand-hint" role="alert">{brandError(queue.error, language)}</p> : !items ? <div className="brand-empty"><ClipboardCheck size={28} /><p>{t('nothing_pending')}</p></div>
      : <div className="brand-review-list">
        {queue.data!.creatives.map(item => { const copy = item.payload.copy?.[language] || item.payload.copy?.en || item.payload.copy?.az || Object.values(item.payload.copy ?? {})[0] || {};
          return <article key={item.id} className="brand-review-item"><header><strong>{item.brand_name}</strong><small>{t('kind_creative')} · {t(item.payload.placement as any)} · {item.banner_id ? t('edit') : t('new_creative')}</small></header>
            <div className="brand-device">{item.payload.banner_type === 'image' ? <p className="brand-hint">{item.payload.image_url}</p>
              : <NativeAdCard preview ad={{ ...item.payload, title: copy.title || '—', description: copy.description, button_text: copy.button_text }} sponsorLabel={`${t('sponsored_by')} ${item.brand_name}`} codeLabel={t('offer_code')} />}</div>
            <dl className="brand-details-grid"><div><dt>{t('tiers')}</dt><dd>{(item.payload.audience_tiers ?? ['free']).map(tier => t(`tier_${tier}` as any)).join(', ')}</dd></div>
              <div><dt>{t('destination')}</dt><dd>{item.payload.link_type === 'lead_form' ? t('link_lead_form') : item.payload.link_url}</dd></div>
              <div><dt>{t('languages_filled')}</dt><dd>{Object.keys(item.payload.copy ?? {}).map(code => code.toUpperCase()).join(', ')}</dd></div>
              <div><dt>{t('targeting')}</dt><dd>{[item.payload.target_life_stages?.map(stage => t(`stage_${stage}` as any)).join(', '),
                item.payload.target_pregnancy_week_min != null || item.payload.target_pregnancy_week_max != null ? t('weeks_range', { range: `${item.payload.target_pregnancy_week_min ?? 1}–${item.payload.target_pregnancy_week_max ?? 42}` }) : '',
                item.payload.target_pregnancy_weeks?.length ? item.payload.target_pregnancy_weeks.join(', ') : ''].filter(Boolean).join(' · ') || t('all_languages')}</dd></div></dl>
            <p className="brand-hint">{t('activation_hint')}</p>{actions('creative', item.id, item.revision)}</article>; })}
        {queue.data!.lead_forms.map(item => <article key={item.id} className="brand-review-item"><header><strong>{item.brand_name}</strong><small>{t('kind_lead_form')} · {item.name} · {t('days_n', { n: item.retention_days })}</small></header>
          <dl className="brand-details-grid"><div><dt>{t('fields')}</dt><dd>{item.fields.map(field => field.key + (field.required ? '*' : '')).join(', ')}</dd></div>
            <div><dt>{t('privacy_url')}</dt><dd>{item.privacy_url || '—'}</dd></div></dl>
          {Object.entries(item.copy).map(([code, copy]) => <details key={code} className="brand-existing-account"><summary>{code.toUpperCase()} · {copy.title}</summary>
            <p className="brand-hint" dir={code === 'ar' ? 'rtl' : 'ltr'} lang={code}>{copy.intro}<br /><strong>{t('consent_field')}:</strong> {copy.consent}</p></details>)}
          {actions('lead_form', item.id, item.revision)}</article>)}
      </div>}
  </BrandPanel>;
}
