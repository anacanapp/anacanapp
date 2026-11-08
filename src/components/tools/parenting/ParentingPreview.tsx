import { useMemo } from 'react';
import type { ParentingContent, ParentingItemType } from '@/data/parenting/types';
import { EMPTY_PARENTING, EMPTY_SLOT } from '@/lib/parenting';
import { applyParentingOverrides } from '@/lib/parenting-overrides';
import { fillEmergencyNumber } from '@/lib/emergency';
import { useEmergencyNumber } from '@/hooks/useEmergencyNumber';
import { pf, pt } from '@/lib/parenting-copy';
import { type ParentingCtx, ArticleScreen, BandScreen, ProgrammeScreen, QuizScreen, SosScreen } from './ParentingScreens';

const noop = () => {};

/**
 * Admin CMS preview: the item as the app renders it, with the editor's patch applied over the bundled content
 * (same merge rules as published overrides). Shown as for a Premium user so every section is visible.
 */
export default function ParentingPreview({ content, type, id, patch }: {
  content: ParentingContent;
  type: ParentingItemType;
  id: string;
  patch: Record<string, unknown>;
}) {
  const emergency = useEmergencyNumber();
  const patched = useMemo(() => applyParentingOverrides(content, [{ item_type: type, item_id: id, patch }]), [content, type, id, patch]);
  const programmeId = type === 'programme_day' ? id.split(':')[0] : id;
  const dayIndex = type === 'programme_day' ? Number(id.split(':')[1]) - 1 : -1;
  const tipBand = type === 'tip' ? (id.split(':')[0] as keyof ParentingContent['tips']) : null;
  const band = (type === 'band' ? id : tipBand) ?? '1-3';
  const ctx: ParentingCtx = {
    content: patched, band: band as ParentingCtx['band'], childBand: null, childName: pt('par_child_fallback'), childAgeLabel: null, ageMonths: null,
    isPremium: true, emergency, today: '2026-01-01', local: EMPTY_PARENTING(), slot: EMPTY_SLOT(), updateSlot: noop, update: noop, updateLocal: noop,
    go: noop, track: noop, query: '', setQuery: noop, reminderAllowed: false,
  };

  let body: React.ReactNode = null;
  switch (type) {
    case 'article': body = <ArticleScreen ctx={ctx} id={id} />; break;
    case 'sos': body = <SosScreen ctx={ctx} id={id} />; break;
    case 'band': body = <BandScreen ctx={ctx} id={id as ParentingCtx['band']} />; break;
    case 'programme': body = <ProgrammeScreen ctx={ctx} id={id} />; break;
    case 'quiz': body = <QuizScreen ctx={ctx} id={id as 'style' | 'milestones'} />; break;
    case 'programme_day': {
      const p = patched.programmes.find((x) => x.id === programmeId);
      const day = p?.days[dayIndex];
      body = day ? (
        <div className="a-par">
          <p className="a-par-meta">{p!.title}</p>
          <div className="a-par-task">
            <small>{pf('par_prog_day', { n: dayIndex + 1 })}</small>
            <h3>{day.title}</h3>
            <p>{fillEmergencyNumber(day.task, emergency)}</p>
            <p className="why"><b>{pt('par_prog_why')}: </b>{fillEmergencyNumber(day.why, emergency)}</p>
          </div>
        </div>
      ) : null;
      break;
    }
    case 'tip': {
      const tip = tipBand ? patched.tips[tipBand]?.[Number(id.split(':')[1]) - 1] : undefined;
      body = tip ? (
        <div className="a-par">
          <section className="a-par-hero"><div className="top"><small>{pt('par_tip_title')}</small></div><h2>{tip.title}</h2><p>{tip.text}</p></section>
        </div>
      ) : null;
      break;
    }
    case 'area': {
      const area = patched.areas.find((x) => x.id === id);
      body = area ? <div className="a-par"><div className="a-par-grid"><div className="a-par-tile"><i>{area.emoji}</i><b>{area.title}</b></div></div></div> : null;
      break;
    }
  }
  return <div className="a-scope" data-testid="parenting-preview" style={{ maxWidth: 420, margin: '0 auto' }}>{body}</div>;
}
