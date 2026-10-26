import { Minus, Plus, Check } from 'lucide-react';
import { addCalendarDays, newOnboardingChild, todayCalendarDate, pregnancyDates, calendarDay, onboardingDataError,
  type OnboardingDraft, type OnboardingChild } from '@/lib/onboarding-model';
import { onboardingText, onboardingNumber, onboardingDate, type OnboardingCopyKey } from '@/lib/onboarding-i18n';

type Props = { draft: OnboardingDraft; language: string; onChange: (draft: OnboardingDraft) => void; disabled?: boolean };
export function OnboardingFields({ draft, language, onChange, disabled = false }: Props) {
  const t = (key: OnboardingCopyKey, params?: Record<string, string | number>) => onboardingText(language, key, params);
  const today = todayCalendarDate();
  const update = (fields: Partial<OnboardingDraft>) => onChange({ ...draft, ...fields });
  const updateChild = (index: number, fields: Partial<OnboardingChild>) => update({ children: draft.children.map((child, i) => i === index ? { ...child, ...fields } : child) });
  const dateField = (id: string, label: string, value: string, change: (value: string) => void, min?: string, max = today) =>
    <label className="onb-field" htmlFor={id}>{label}<input id={id} type="date" value={value} onChange={event => change(event.target.value)} min={min} max={max} disabled={disabled} required dir="ltr" /></label>;
  const counter = (key: OnboardingCopyKey, value: number, change: (value: number) => void, min: number, max: number, id: string) =>
    <div className="onb-counter"><span id={`${id}-label`}>{t(key)}</span><div>
      <button type="button" aria-label={t('decrease', { field: t(key) })} onClick={() => change(value - 1)} disabled={disabled || value <= min}><Minus size={17} /></button>
      <output id={id} aria-labelledby={`${id}-label`}>{onboardingNumber(language, value)}</output>
      <button type="button" aria-label={t('increase', { field: t(key) })} onClick={() => change(value + 1)} disabled={disabled || value >= max}><Plus size={17} /></button>
    </div></div>;

  let pregnancySummary: React.ReactNode = null;
  if (draft.stage === 'bump' && draft.pregnancyDate && !onboardingDataError(draft)) {
    const dates = pregnancyDates(draft), week = Math.floor((calendarDay(today)! - calendarDay(dates.lastPeriod)!) / 7);
    pregnancySummary = <p className="onb-feedback">{t('bump_summary', { week: onboardingNumber(language, week), date: onboardingDate(language, dates.due) })}</p>;
  }
  return <div className="onb-fields">
    {draft.stage !== 'flow' && <fieldset className="onb-fieldset"><legend>{t(draft.stage === 'bump' ? 'count_bump' : 'count_mommy')}</legend>
      <div className="onb-chips">{[1, 2, 3, 4].map(count => <button key={count} type="button" aria-pressed={draft.babyCount === count}
        data-testid={`baby-count-${count}`} disabled={disabled || draft.saveStarted && count !== draft.babyCount} onClick={() => update({ babyCount: count,
          children: Array.from({ length: count }, (_, index) => draft.children[index] ?? newOnboardingChild()) })}>{onboardingNumber(language, count)}</button>)}</div>
    </fieldset>}
    {draft.stage === 'bump' && <>
      <fieldset className="onb-fieldset"><legend>{t('data_bump_title')}</legend><div className="onb-chips">
        {(['lmp', 'due'] as const).map(mode => <button type="button" key={mode} data-date-mode={mode} disabled={disabled} aria-pressed={draft.dateMode === mode}
          onClick={() => update({ dateMode: mode, pregnancyDate: '' })}>{t(mode === 'lmp' ? 'date_lmp' : 'date_due')}</button>)}
      </div></fieldset>
      {dateField('onb-pregnancy-date', t(draft.dateMode === 'due' ? 'due' : 'lmp'), draft.pregnancyDate, pregnancyDate => update({ pregnancyDate }),
        addCalendarDays(today, draft.dateMode === 'lmp' ? -308 : -28), draft.dateMode === 'lmp' ? today : addCalendarDays(today, 280))}
      {pregnancySummary}<p className="onb-note">{t('date_estimate')}</p>
    </>}
    {draft.stage === 'mommy' && <>
      {draft.children.map((child, index) => <fieldset key={child.id} className="onb-child" data-testid={`child-${index}`}>
        <legend>{t('child_number', { n: onboardingNumber(language, index + 1) })}</legend>
        <label className="onb-field" htmlFor={`onb-child-name-${index}`}>{t('child_name')}<input id={`onb-child-name-${index}`} value={child.name}
          maxLength={80} autoComplete="off" disabled={disabled} required onChange={event => updateChild(index, { name: event.target.value })} /></label>
        {dateField(`onb-birth-${index}`, t('birth_date'), child.birthDate, birthDate => updateChild(index, { birthDate }))}
        <fieldset className="onb-fieldset"><legend>{t('gender')}</legend><div className="onb-chips">
          {(['girl','boy'] as const).map(gender => <button type="button" key={gender} data-child-gender={gender} disabled={disabled} aria-pressed={child.gender === gender}
            onClick={() => updateChild(index, { gender })}>{t(gender)}{child.gender === gender && <Check size={14} aria-hidden="true" />}</button>)}
        </div></fieldset>
        <fieldset className="onb-fieldset"><legend>{t('term_question')}</legend><div className="onb-chips">
          {(['term', 'preterm', ''] as const).map(term => <button type="button" key={term} data-term-choice={term || 'unknown'} disabled={disabled} aria-pressed={child.term === term}
            onClick={() => updateChild(index, { term })}>{t(term || 'unknown')}</button>)}
        </div></fieldset>
        {child.term === 'preterm' && counter('gestation', child.gestationalWeeks, gestationalWeeks => updateChild(index, { gestationalWeeks }), 22, 36, `onb-gestation-${index}`)}
      </fieldset>)}
      <label className="onb-field" htmlFor="onb-delivery">{t('delivery')}<select id="onb-delivery" value={draft.deliveryType} disabled={disabled}
        onChange={event => update({ deliveryType: event.target.value as OnboardingDraft['deliveryType'] })}>
        {(['', 'natural', 'cesarean', 'assisted'] as const).map(value => <option key={value} value={value}>{t(value || 'unknown')}</option>)}
      </select></label>
    </>}
    {draft.stage === 'flow' && <>
      {dateField('onb-last-period', t('lmp'), draft.lastPeriodDate, lastPeriodDate => update({ lastPeriodDate }))}
      {counter('cycle_length', draft.cycleLength, cycleLength => update({ cycleLength }), 10, 50, 'onb-cycle-length')}
      {counter('period_length', draft.periodLength, periodLength => update({ periodLength }), 2, Math.min(10, draft.cycleLength), 'onb-period-length')}
      <p className="onb-note">{t('cycle_note')}</p><p className="onb-note">{t('date_estimate')}</p>
    </>}
  </div>;
}
