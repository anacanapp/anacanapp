import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bell, ChevronLeft, Crown, HeartHandshake, Lock, Phone, Search, Send, Share2, X } from 'lucide-react';
import PremiumBlurGate from '@/components/premium/PremiumBlurGate';
import { fillEmergencyNumber } from '@/lib/emergency';
import { bandKey, pf, pt } from '@/lib/parenting-copy';
import {
  type ChildSlot, type ParentingLocal, type ProgrammeProgress, type QuizNav,
  DEFAULT_REMINDER_TIME, FREE_PROGRAMME_DAYS, canCompleteToday, checkpointFor, completeDay, tooEarlyForMilestones, isDayLocked, isFinished, milestoneResult,
  milestoneCheckEnd, milestoneCheckOffered,
  nextDayIndex, programmeSummary, progressPercent, quizAnswer, quizBack, quizDone, readingMinutes, setProgrammeState, setSlotBand, startProgramme,
  startQuiz, styleResult, styleScores, suggestNextProgramme, toggleSaved, undoLastDay,
} from '@/lib/parenting';
import { searchParenting } from '@/lib/parenting-search';
import { canRemindDay } from '@/lib/parenting-reminders';
import { openMentalHealthTool } from '@/lib/parenting-nav';
import {
  type PartnerShare, type ShareItem, markPartnerShareRead, partnerShareText, plainShareText, readPartnerShares, sendParentingToPartner, shareParentingItem,
} from '@/lib/parenting-share';
import { S } from '@/data/parenting/az/sources';
import type {
  AgeBandId, Area, AreaId, Article, MilestoneAnswer, ParentingContent, Programme, SosCard, Source, SupportKind,
} from '@/data/parenting/types';
import { AGE_BANDS } from '@/data/parenting/types';

export type Route =
  | { s: 'home' }
  | { s: 'band'; id: AgeBandId; /** Scroll to the sources (the daily tip's "Mənbələr" link). */ focus?: 'sources' }
  | { s: 'topics'; area?: AreaId }
  | { s: 'article'; id: string }
  | { s: 'sosList' }
  | { s: 'sos'; id: string }
  | { s: 'programmes' }
  | { s: 'programme'; id: string }
  | { s: 'quiz'; id: 'style' | 'milestones' }
  | { s: 'saved' };

export interface ParentingCtx {
  content: ParentingContent;
  band: AgeBandId;
  childBand: AgeBandId | null;
  childName: string;
  childAgeLabel: string | null;
  ageMonths: number | null;
  isPremium: boolean;
  emergency: string;
  today: string;
  /** App language (dates in the programme summary). */
  locale?: string;
  local: ParentingLocal;
  /** The selected child's band choice, programme progress and quiz results. */
  slot: ChildSlot;
  /** Synced change of the selected child's slot. */
  updateSlot: (fn: (slot: ChildSlot) => ChildSlot) => void;
  /** Synced change (account copy). */
  update: (fn: (s: ParentingLocal) => ParentingLocal) => void;
  /** Device-only change (reminder preference). */
  updateLocal: (fn: (s: ParentingLocal) => ParentingLocal) => void;
  go: (r: Route) => void;
  track: (action: string, itemId?: string) => void;
  /** Home search text (kept while the parent opens a result and comes back). */
  query: string;
  setQuery: (q: string) => void;
  /** The tool switch is on: reminders can be turned on (free users for the free programme days). */
  reminderAllowed: boolean;
  /** Age for the milestone check: corrected for a preterm baby until 24 corrected months. */
  milestoneMonths?: number | null;
  milestoneCorrected?: boolean;
  /** The partner (father) app: no Tools tab, items come from the mother. */
  partner?: boolean;
  /** Signed-in user (the partner's received items). */
  userId?: string | null;
  /** The mother with a linked partner: "Send to partner" is offered. */
  shareActor?: { userId: string; partnerProfileId: string } | null;
}

const LOCK = { title: () => pt('par_lock_title'), text: () => pt('par_lock_text'), cta: () => pt('par_lock_cta') };
const AREA_TINT: Record<AreaId, string> = {
  emotions: 'is-peach', limits: 'is-mint', connection: 'is-sky', routines: 'is-lav', growth: 'is-amber',
  play: 'is-mint', behaviour: 'is-peach', parent: 'is-lav', school: 'is-sky',
};
/** Typical age for the milestone check when the child's birth date is unknown. */
const BAND_MONTHS: Record<AgeBandId, number> = { '0-1': 9, '1-3': 18, '3-6': 48, '6-12': 72 };

const bandLabel = (b: AgeBandId) => pt(bandKey(b));
const hasEmergency = (texts: (string | undefined)[]) => texts.some((t) => t?.includes('{emergency}'));
const articleMinutes = (a: Article) => readingMinutes([a.summary, ...a.science, ...a.tryToday, ...a.mistakes, ...Object.values(a.byAge || {}), ...a.specialist]);
export const canRead = (item: { free: boolean }, isPremium: boolean) => item.free || isPremium;

// ── Small pieces ─────────────────────────────────────────────────────────────────────────
const PremiumBadge = () => <span className="a-par-badge"><Crown size={10} strokeWidth={2.6} />{pt('par_premium')}</span>;
const FreeBadge = () => <span className="a-par-badge is-free">{pt('par_free')}</span>;

function Sec({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="a-par-sec">
      <h3>{title}</h3>
      {action && onAction && <button type="button" onClick={onAction}>{action}</button>}
    </div>
  );
}

function Box({ tone, label, children }: { tone: 'brain' | 'try' | 'warn' | 'red'; label: string; children: ReactNode }) {
  return (
    <section className={`a-par-box is-${tone}`} role={tone === 'red' ? 'alert' : undefined}>
      <b>{label}</b>
      {children}
    </section>
  );
}

function Bullets({ items, emergency }: { items: string[]; emergency: string }) {
  return <ul className="a-par-bullets">{items.map((t) => <li key={t}>{fillEmergencyNumber(t, emergency)}</li>)}</ul>;
}

function CallButton({ emergency }: { emergency: string }) {
  return <a className="a-par-call" href={`tel:${emergency}`}><Phone size={15} />{pf('par_call', { emergency })}</a>;
}

function Sources({ sources }: { sources: Source[] }) {
  return (
    <footer className="a-par-sources">
      <b>{pt('par_h_sources')}</b>
      <ol>{sources.map((s) => <li key={`${s.who}${s.title}`}>{s.who}{s.year ? ` (${s.year})` : ''}. <i>{s.title}</i></li>)}</ol>
    </footer>
  );
}

/** SOS source ids → the shared reference list (unknown ids are skipped). */
export function sourcesFor(ids: string[] | undefined): Source[] {
  const list = S as Record<string, Source>;
  return (ids ?? []).filter((id) => Object.prototype.hasOwnProperty.call(list, id)).map((id) => list[id]);
}

/** Small support card under safety content: the app's mood / support tool (not in the partner app) + emergency call. */
function SupportCard({ kind, ctx }: { kind: SupportKind | undefined; ctx: ParentingCtx }) {
  if (kind !== 'mental-health' && kind !== 'child-safety') return null;
  const mh = kind === 'mental-health';
  return (
    <section className="a-par-support" data-testid={`par-support-${kind}`}>
      <b><HeartHandshake size={15} aria-hidden />{pt(mh ? 'par_support_mh_title' : 'par_support_cs_title')}</b>
      <p>{pf(mh ? 'par_support_mh_text' : 'par_support_cs_text', { emergency: ctx.emergency })}</p>
      <div className="a-par-support-actions">
        {!ctx.partner && (
          <button type="button" className="a-par-btn ghost small" onClick={() => { ctx.track(`support_open_${kind}`); openMentalHealthTool(); }}>
            {pt('par_support_open')}
          </button>
        )}
        <CallButton emergency={ctx.emergency} />
      </div>
    </section>
  );
}

/** "Send to partner" (the mother with a linked partner) and the phone's share sheet. */
function ShareRow({ ctx, item }: { ctx: ParentingCtx; item: ShareItem }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const actor = ctx.shareActor;
  const send = async () => {
    if (!actor || status === 'sending') return;
    setStatus('sending');
    try {
      const ok = await sendParentingToPartner(actor, partnerShareText(item, pt('par_share_hint')));
      setStatus(ok ? 'sent' : 'failed');
      if (ok) ctx.track(`share_partner_${item.kind}`, item.id);
    } catch {
      setStatus('failed');
    }
  };
  const share = () => {
    ctx.track(`share_${item.kind}`, item.id);
    void shareParentingItem(plainShareText(item, pt('par_share_footer')), item.title);
  };
  return (
    <div className="a-par-share" data-testid="par-share">
      {actor && (
        <button type="button" className="a-par-btn small" onClick={send} disabled={status === 'sending' || status === 'sent'}>
          <Send size={14} aria-hidden />{pt('par_share_partner')}
        </button>
      )}
      <button type="button" className="a-par-btn ghost small" onClick={share}><Share2 size={14} aria-hidden />{pt('par_share')}</button>
      {(status === 'sent' || status === 'failed') && (
        <p className="a-par-small" role="status">{pt(status === 'sent' ? 'par_share_sent' : 'par_share_failed')}</p>
      )}
    </div>
  );
}

/** Partner app: the items the mother sent him (newest first); tapping opens the item. */
function PartnerShares({ ctx }: { ctx: ParentingCtx }) {
  const [shares, setShares] = useState<PartnerShare[]>([]);
  const uid = ctx.partner ? ctx.userId ?? null : null;
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    readPartnerShares(uid).then((list) => { if (alive) setShares(list); }).catch(() => {});
    return () => { alive = false; };
  }, [uid]);
  const rows = shares.map((s) => {
    const item = s.kind === 'sos' ? ctx.content.sos.find((c) => c.id === s.id) : ctx.content.articles.find((a) => a.id === s.id);
    return item ? { s, item } : null;
  }).filter(Boolean) as { s: PartnerShare; item: SosCard | Article }[];
  if (!uid || !rows.length) return null;
  return (
    <section className="a-par-shared" data-testid="par-partner-shares">
      <Sec title={pt('par_shared_title')} />
      {rows.map(({ s, item }) => (
        <button key={`${s.kind}:${s.id}`} type="button" className={s.read ? 'a-par-row' : 'a-par-row is-new'}
          onClick={() => { if (!s.read) void markPartnerShareRead(uid, s.messageId); ctx.track('partner_share_open', s.id); ctx.go({ s: s.kind, id: s.id } as Route); }}>
          <span className="ic">{item.emoji}</span>
          <span className="tx"><b>{item.title}</b><small>{'moment' in item ? item.moment : item.summary}</small></span>
        </button>
      ))}
    </section>
  );
}

function Ring({ percent, label, size = 52 }: { percent: number; label: string; size?: number }) {
  return (
    <div className="a-par-ring" style={{ width: size, height: size, background: `conic-gradient(var(--a-coral) 0 ${percent}%, var(--a-line-strong) ${percent}% 100%)` }}>
      <span>{label}</span>
    </div>
  );
}

function BandChips({ value, bands, onChange, segmented }: { value: AgeBandId; bands: AgeBandId[]; onChange: (b: AgeBandId) => void; segmented?: boolean }) {
  return (
    <div className={segmented ? 'a-par-seg' : 'a-par-chips'} role="group" aria-label={pt('par_band_pick')}>
      {bands.map((b) => (
        <button key={b} type="button" aria-pressed={b === value} onClick={() => onChange(b)}>{bandLabel(b)}</button>
      ))}
    </div>
  );
}

function EmergencyCard({ emergency }: { emergency: string }) {
  return (
    <Box tone="red" label={pt('par_emergency_title')}>
      <p>{pf('par_emergency_text', { emergency })}</p>
      <CallButton emergency={emergency} />
    </Box>
  );
}

function ArticleRow({ a, ctx }: { a: Article; ctx: ParentingCtx }) {
  const locked = !canRead(a, ctx.isPremium);
  return (
    <button type="button" className="a-par-row" onClick={() => ctx.go({ s: 'article', id: a.id })}>
      <span className="ic">{a.emoji}</span>
      <span className="tx"><b>{a.title}</b><small>{a.summary}</small><small className="meta">{pf('par_read_time', { n: articleMinutes(a) })}</small></span>
      {locked ? <Lock size={14} className="lk" aria-label={pt('par_premium')} /> : a.free && !ctx.isPremium ? <FreeBadge /> : null}
    </button>
  );
}

function SosTile({ c, ctx }: { c: SosCard; ctx: ParentingCtx }) {
  return (
    <button type="button" className="a-par-sostile" onClick={() => ctx.go({ s: 'sos', id: c.id })}>
      <em>{c.emoji}</em>
      <b>{c.title}</b>
      <small>{pt(c.free ? 'par_sos_meta_free' : 'par_sos_meta_premium')}</small>
    </button>
  );
}

// ── Home ─────────────────────────────────────────────────────────────────────────────────
export function HomeScreen({ ctx, tipIndex }: { ctx: ParentingCtx; tipIndex: number }) {
  const { content, band } = ctx;
  const tips = content.tips[band];
  const tip = tips[tipIndex % tips.length];
  const overview = content.bands.find((b) => b.id === band)!;
  const sos = content.sos.filter((c) => c.bands.includes(band));
  const articles = content.articles.filter((a) => a.bands.includes(band));
  const areas = content.areas.filter((ar) => articles.some((a) => a.area === ar.id));
  const setBand = (b: AgeBandId) => ctx.updateSlot((slot) => setSlotBand(slot, b, ctx.childBand));
  const overviewMin = readingMinutes([overview.lead, ...overview.brain, ...overview.needs, ...overview.normal, ...overview.tryThis]);
  const searching = ctx.query.trim().length >= 2;

  return (
    <div className="a-par">
      <SearchBox ctx={ctx} />
      {searching ? <SearchResults ctx={ctx} /> : (
      <>
      <section className="a-par-hero" aria-label={pt('par_tip_title')}>
        <div className="top">
          <small>{pt('par_tip_title')}</small>
          {ctx.childAgeLabel && <span className="tag">{`${ctx.childName} · ${ctx.childAgeLabel}`}</span>}
        </div>
        <h2>{tip.title}</h2>
        <p>{tip.text}</p>
        <button type="button" className="a-par-tip-src" onClick={() => ctx.go({ s: 'band', id: band, focus: 'sources' })}>{pt('par_tip_sources')}</button>
      </section>

      <PartnerShares ctx={ctx} />

      <BandChips value={band} bands={AGE_BANDS} onChange={setBand} />
      {ctx.childBand && band === ctx.childBand && <p className="a-par-small">{pf('par_band_from_child', { name: ctx.childName })}</p>}

      <Sec title={pt('par_band_open')} action={pt('par_see_all')} onAction={() => ctx.go({ s: 'band', id: band })} />
      <button type="button" className="a-par-feature" onClick={() => ctx.go({ s: 'band', id: band })}>
        <Ring percent={100} label="🧠" />
        <span><b>{overview.title}</b><small>{`${overview.lead} · ${pf('par_minutes', { n: overviewMin })}`}</small></span>
      </button>

      <Sec title={pt('par_sec_sos')} action={pf('par_count_cards', { n: sos.length })} onAction={() => ctx.go({ s: 'sosList' })} />
      <div className="a-par-hscroll">{sos.map((c) => <SosTile key={c.id} c={c} ctx={ctx} />)}</div>

      <Sec title={pt('par_sec_topics')} action={pf('par_count_articles', { n: articles.length })} onAction={() => ctx.go({ s: 'topics' })} />
      <div className="a-par-grid">
        {areas.map((ar) => <AreaTile key={ar.id} area={ar} articles={articles.filter((a) => a.area === ar.id)} ctx={ctx} />)}
      </div>

      <Sec title={pt('par_sec_programmes')} action={pt('par_see_all')} onAction={() => ctx.go({ s: 'programmes' })} />
      {content.programmes.filter((p) => p.bands.includes(band)).map((p) => <ProgrammeRow key={p.id} p={p} ctx={ctx} />)}

      <Sec title={pt('par_sec_quizzes')} />
      <QuizRows ctx={ctx} />

      <EmergencyCard emergency={ctx.emergency} />
      <p className="a-par-small">{pt('par_disclaimer')}</p>
      </>
      )}
    </div>
  );
}

// ── Search ───────────────────────────────────────────────────────────────────────────────
function SearchBox({ ctx }: { ctx: ParentingCtx }) {
  return (
    <div className="a-par-search" role="search">
      <Search size={16} aria-hidden />
      <input
        type="search"
        value={ctx.query}
        onChange={(e) => ctx.setQuery(e.target.value)}
        placeholder={pt('par_search_placeholder')}
        aria-label={pt('par_search_label')}
        enterKeyHint="search"
        autoComplete="off"
        maxLength={80}
      />
      {ctx.query && (
        <button type="button" aria-label={pt('par_search_clear')} onClick={() => ctx.setQuery('')}><X size={15} /></button>
      )}
    </div>
  );
}

function SearchResults({ ctx }: { ctx: ParentingCtx }) {
  const res = useMemo(() => searchParenting(ctx.content, ctx.query), [ctx.content, ctx.query]);
  useEffect(() => { if (res.total) ctx.track('search'); /* once per distinct query */ }, [ctx.query]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!res.total) return <p className="a-par-small" role="status">{pt('par_search_empty')}</p>;
  return (
    <div className="a-par-results" aria-live="polite">
      <p className="a-par-small" role="status">{pf('par_search_results', { n: res.total })}</p>
      {res.sos.length > 0 && (
        <section>
          <h3 className="a-par-rhead">{pt('par_search_sos')}</h3>
          {res.sos.map(({ item: c }) => (
            <button key={c.id} type="button" className="a-par-row" onClick={() => ctx.go({ s: 'sos', id: c.id })}>
              <span className="ic">{c.emoji}</span>
              <span className="tx"><b>{c.title}</b><small>{c.moment}</small></span>
              {!canRead(c, ctx.isPremium) ? <Lock size={14} className="lk" aria-label={pt('par_premium')} /> : c.free && !ctx.isPremium ? <FreeBadge /> : null}
            </button>
          ))}
        </section>
      )}
      {res.articles.length > 0 && (
        <section>
          <h3 className="a-par-rhead">{pt('par_search_articles')}</h3>
          {res.articles.map(({ item: a }) => <ArticleRow key={a.id} a={a} ctx={ctx} />)}
        </section>
      )}
      {res.programmes.length > 0 && (
        <section>
          <h3 className="a-par-rhead">{pt('par_search_programmes')}</h3>
          {res.programmes.map(({ item: p }) => <ProgrammeRow key={p.id} p={p} ctx={ctx} />)}
        </section>
      )}
    </div>
  );
}

function AreaTile({ area, articles, ctx }: { area: Area; articles: Article[]; ctx: ParentingCtx }) {
  const allLocked = !ctx.isPremium && !articles.some((a) => a.free);
  return (
    <button type="button" className="a-par-tile" onClick={() => ctx.go({ s: 'topics', area: area.id })}>
      {allLocked && <PremiumBadge />}
      <i className={AREA_TINT[area.id]}>{area.emoji}</i>
      <b>{area.title}</b>
      <small>{pf('par_count_articles', { n: articles.length })}</small>
    </button>
  );
}

function ProgrammeRow({ p, ctx }: { p: Programme; ctx: ParentingCtx }) {
  const prog = ctx.slot.programmes[p.id];
  const done = prog ? prog.done.length : 0;
  return (
    <button type="button" className="a-par-feature" onClick={() => ctx.go({ s: 'programme', id: p.id })}>
      <Ring percent={progressPercent(prog, p.days.length)} label={prog ? `${done}/${p.days.length}` : p.emoji} />
      <span>
        <b>{p.title}</b>
        <small>{prog ? pf('par_prog_progress', { done, total: p.days.length }) : `${pf('par_prog_days', { n: p.days.length })} · ${pt('par_prog_daily')}`}</small>
      </span>
      {/* Free users can follow the first days of every programme: say so instead of a bare "Premium". */}
      {!ctx.isPremium && <span className="a-par-badge is-free">{pf('par_prog_free_days', { n: FREE_PROGRAMME_DAYS })}</span>}
    </button>
  );
}

function QuizRows({ ctx }: { ctx: ParentingCtx }) {
  const { styleQuiz, milestoneQuiz } = ctx.content;
  return (
    <>
      {[styleQuiz, milestoneQuiz].filter((q) => q.id !== 'milestones' || milestoneCheckOffered(milestoneQuiz.checkpoints, milestoneMonthsOf(ctx), ctx.band)).map((q) => {
        const last = ctx.slot.quizzes[q.id];
        const lastTitle = last ? (q.id === 'style' ? styleQuiz.results[last.result as keyof typeof styleQuiz.results]?.title : milestoneQuiz.results[last.result as keyof typeof milestoneQuiz.results]?.title) : null;
        return (
          <button key={q.id} type="button" className="a-par-feature" onClick={() => ctx.go({ s: 'quiz', id: q.id })}>
            <span className="a-par-emoji">{q.emoji}</span>
            <span><b>{q.title}</b><small>{lastTitle ? pf('par_quiz_last', { result: lastTitle }) : pt('par_quiz_start')}</small></span>
          </button>
        );
      })}
    </>
  );
}

// ── Age band overview ────────────────────────────────────────────────────────────────────
export function BandScreen({ ctx, id, focus }: { ctx: ParentingCtx; id: AgeBandId; focus?: 'sources' }) {
  const b = ctx.content.bands.find((x) => x.id === id)!;
  useEffect(() => {
    if (focus !== 'sources') return;
    const el = typeof document !== 'undefined' ? document.getElementById('par-band-sources') : null;
    el?.scrollIntoView?.({ block: 'start' });
  }, [focus]);
  return (
    <div className="a-par">
      <p className="a-par-meta">{bandLabel(b.id)}</p>
      <h2 className="a-par-title">{b.emoji} {b.title}</h2>
      <p className="a-par-lead">{b.lead}</p>
      <Box tone="brain" label={`🧠 ${pt('par_h_brain')}`}>{b.brain.map((t) => <p key={t}>{t}</p>)}</Box>
      <div className="a-par-card"><h3>{pt('par_h_needs')}</h3><Bullets items={b.needs} emergency={ctx.emergency} /></div>
      <div className="a-par-card"><h3>{pt('par_h_normal')}</h3><Bullets items={b.normal} emergency={ctx.emergency} /></div>
      <Box tone="try" label={`✅ ${pt('par_h_try_age')}`}><Bullets items={b.tryThis} emergency={ctx.emergency} /></Box>
      <Box tone="warn" label={`⚠️ ${pt('par_h_specialist')}`}>
        <Bullets items={b.specialist} emergency={ctx.emergency} />
        {hasEmergency(b.specialist) && <CallButton emergency={ctx.emergency} />}
      </Box>
      <SupportCard kind={b.support} ctx={ctx} />
      <div id="par-band-sources"><Sources sources={b.sources} /></div>
    </div>
  );
}

// ── Topics library ───────────────────────────────────────────────────────────────────────
export function TopicsScreen({ ctx, area }: { ctx: ParentingCtx; area?: AreaId }) {
  const [current, setCurrent] = useState<AreaId | 'all'>(area ?? 'all');
  const [onlyBand, setOnlyBand] = useState(true);
  const list = ctx.content.articles.filter((a) => (current === 'all' || a.area === current) && (!onlyBand || a.bands.includes(ctx.band)));
  return (
    <div className="a-par">
      <div className="a-par-chips wrap" role="group">
        <button type="button" aria-pressed={onlyBand} onClick={() => setOnlyBand(true)}>{`${pt('par_filter_band')} · ${bandLabel(ctx.band)}`}</button>
        <button type="button" aria-pressed={!onlyBand} onClick={() => setOnlyBand(false)}>{pt('par_filter_all')}</button>
      </div>
      <div className="a-par-chips" role="group">
        <button type="button" aria-pressed={current === 'all'} onClick={() => setCurrent('all')}>{pt('par_filter_all')}</button>
        {ctx.content.areas.map((ar) => (
          <button key={ar.id} type="button" aria-pressed={current === ar.id} onClick={() => setCurrent(ar.id)}>{`${ar.emoji} ${ar.title}`}</button>
        ))}
      </div>
      {list.length ? list.map((a) => <ArticleRow key={a.id} a={a} ctx={ctx} />) : <p className="a-par-small">{pt('par_empty')}</p>}
    </div>
  );
}

// ── Article ──────────────────────────────────────────────────────────────────────────────
export function ArticleScreen({ ctx, id }: { ctx: ParentingCtx; id: string }) {
  const a = ctx.content.articles.find((x) => x.id === id);
  if (!a) return null;
  const area = ctx.content.areas.find((x) => x.id === a.area);
  const open = canRead(a, ctx.isPremium);
  const bands = a.bands.length === 4 ? '0–12' : a.bands.map(bandLabel).join(', ');
  const rest = (
    <>
      <Box tone="try" label={`✅ ${pt('par_h_try')}`}><Bullets items={a.tryToday} emergency={ctx.emergency} /></Box>
      <div className="a-par-card"><h3>{pt('par_h_mistakes')}</h3><Bullets items={a.mistakes} emergency={ctx.emergency} /></div>
      {a.byAge && (
        <div className="a-par-card">
          <h3>{pt('par_h_by_age')}</h3>
          {AGE_BANDS.filter((b) => a.byAge?.[b]).map((b) => (
            <p key={b} className={b === ctx.band ? 'a-par-agep is-on' : 'a-par-agep'}><b>{bandLabel(b)}</b>{a.byAge![b]}</p>
          ))}
        </div>
      )}
    </>
  );
  return (
    <article className="a-par">
      <p className="a-par-meta">{[area?.title, bands, pf('par_read_time', { n: articleMinutes(a) })].filter(Boolean).join(' · ')}</p>
      <h2 className="a-par-title">{a.title}</h2>
      <p className="a-par-lead">{a.summary}</p>
      <Box tone="brain" label={`🧠 ${pt('par_h_science')}`}><p>{a.science[0]}</p></Box>
      {a.science.slice(1).map((t) => <p key={t} className="a-par-p">{t}</p>)}
      {open ? rest : (
        <PremiumBlurGate feature="parenting_article" title={LOCK.title()} subtitle={LOCK.text()} cta={LOCK.cta()}>{rest}</PremiumBlurGate>
      )}
      <Box tone="warn" label={`⚠️ ${pt('par_h_specialist')}`}>
        <Bullets items={a.specialist} emergency={ctx.emergency} />
        {hasEmergency(a.specialist) && <CallButton emergency={ctx.emergency} />}
      </Box>
      <SupportCard kind={a.support} ctx={ctx} />
      <ShareRow ctx={ctx} item={{ kind: 'article', id: a.id, emoji: a.emoji, title: a.title, summary: a.summary }} />
      <Sources sources={a.sources} />
    </article>
  );
}

// ── SOS ──────────────────────────────────────────────────────────────────────────────────
export function SosListScreen({ ctx }: { ctx: ParentingCtx }) {
  const [band, setBand] = useState<AgeBandId>(ctx.band);
  const list = ctx.content.sos.filter((c) => c.bands.includes(band));
  return (
    <div className="a-par">
      <BandChips value={band} bands={AGE_BANDS} onChange={setBand} segmented />
      <div className="a-par-grid">{list.map((c) => <SosTile key={c.id} c={c} ctx={ctx} />)}</div>
      {!list.length && <p className="a-par-small">{pt('par_empty')}</p>}
    </div>
  );
}

export function SosScreen({ ctx, id }: { ctx: ParentingCtx; id: string }) {
  const c = ctx.content.sos.find((x) => x.id === id);
  const [band, setBand] = useState<AgeBandId | null>(null);
  if (!c) return null;
  const active = band ?? (c.bands.includes(ctx.band) ? ctx.band : c.bands[0]);
  const open = canRead(c, ctx.isPremium);
  const sources = sourcesFor(c.sources);
  const step = (i: number) => (
    <div className="a-par-step" key={i}>
      <i>{i + 1}</i>
      <div><b>{c.steps[i].title}</b><p>{c.steps[i].text}</p></div>
    </div>
  );
  const body = (
    <>
      {step(0)}
      {step(1)}
      <div className="a-par-say"><small>{pt('par_sos_say')}</small>{c.say.map((t) => <p key={t}>{t}</p>)}</div>
      {step(2)}
      {c.byAge?.[active] && <Box tone="try" label={bandLabel(active)}><p>{c.byAge[active]}</p></Box>}
      <Box tone="warn" label={pt('par_sos_avoid')}><Bullets items={c.avoid} emergency={ctx.emergency} /></Box>
    </>
  );
  return (
    <div className="a-par">
      {c.bands.length > 1 && <BandChips value={active} bands={c.bands} onChange={setBand} segmented />}
      <p className="a-par-lead">{c.moment}</p>
      {open ? body : <PremiumBlurGate feature="parenting_sos" title={LOCK.title()} subtitle={LOCK.text()} cta={LOCK.cta()}>{body}</PremiumBlurGate>}
      {c.redFlag && (
        <Box tone="red" label={pt('par_sos_red')}>
          <p>{fillEmergencyNumber(c.redFlag, ctx.emergency)}</p>
          {hasEmergency([c.redFlag]) && <CallButton emergency={ctx.emergency} />}
        </Box>
      )}
      <SupportCard kind={c.support} ctx={ctx} />
      <ShareRow ctx={ctx} item={{ kind: 'sos', id: c.id, emoji: c.emoji, title: c.title, summary: c.moment }} />
      {sources.length > 0 && <Sources sources={sources} />}
    </div>
  );
}

// ── Programmes ───────────────────────────────────────────────────────────────────────────
export function ProgrammesScreen({ ctx }: { ctx: ParentingCtx }) {
  return (
    <div className="a-par">
      {ctx.content.programmes.map((p) => (
        <div key={p.id} className="a-par-card">
          <ProgrammeRow p={p} ctx={ctx} />
          <p>{p.summary}</p>
        </div>
      ))}
    </div>
  );
}

export function ProgrammeScreen({ ctx, id }: { ctx: ParentingCtx; id: string }) {
  const p = ctx.content.programmes.find((x) => x.id === id);
  const prog: ProgrammeProgress | undefined = p ? ctx.slot.programmes[p.id] : undefined;
  const next = nextDayIndex(prog);
  const [picked, setPicked] = useState<number | null>(null);
  if (!p) return null;
  const total = p.days.length;
  const finished = isFinished(prog, total);
  const sel = Math.min(picked ?? Math.min(next, total - 1), total - 1);
  const day = p.days[sel];
  const locked = isDayLocked(sel, ctx.isPremium);
  const save = (fn: (cur: ProgrammeProgress) => ProgrammeProgress | null) => ctx.updateSlot((slot) => {
    const cur = slot.programmes[p.id] ?? startProgramme(ctx.today);
    const res = fn(cur);
    return res === cur ? slot : setProgrammeState(slot, p.id, res);
  });

  if (!prog) {
    return (
      <div className="a-par">
        <p className="a-par-lead">{p.summary}</p>
        {p.intro.map((t) => <p key={t} className="a-par-p">{t}</p>)}
        {!ctx.isPremium && <p className="a-par-small">{pf('par_prog_free_days', { n: FREE_PROGRAMME_DAYS })}</p>}
        <button type="button" className="a-par-btn" onClick={() => { save(() => startProgramme(ctx.today)); ctx.track(`programme_start_${p.id}`); }}>{pt('par_prog_start')}</button>
        <Sources sources={p.sources} />
      </div>
    );
  }

  const doneToday = prog.done[prog.done.length - 1] === ctx.today;
  const canDo = sel === next && canCompleteToday(prog, total, ctx.today) && !locked && !prog.paused;
  const task = (
    <div className="a-par-task">
      <small>{pf('par_prog_day', { n: sel + 1 })}</small>
      <h3>{day.title}</h3>
      <p>{day.task}</p>
      <p className="why"><b>{pt('par_prog_why')}: </b>{day.why}</p>
      {canDo && (
        <button type="button" className="a-par-btn" onClick={() => {
          save((cur) => completeDay(cur, total, ctx.today));
          ctx.track(`programme_day_${p.id}`);
          setPicked(null);
        }}>{pt('par_prog_done_today')}</button>
      )}
      {sel === next && doneToday && !finished && <p className="a-par-small">{pt('par_prog_come_back')}</p>}
    </div>
  );

  return (
    <div className="a-par">
      {prog.paused && !finished && <p className="a-par-small" role="status">{pt('par_prog_paused')}</p>}
      <div className="a-par-feature static">
        <Ring percent={progressPercent(prog, total)} label={`${prog.done.length}/${total}`} size={56} />
        <span>
          <b>{finished ? pt('par_prog_finished') : prog.done.length ? pt('par_prog_great') : p.title}</b>
          <small>{prog.done.length ? pf('par_prog_steps_done', { n: prog.done.length }) : pt('par_prog_daily')}</small>
        </span>
      </div>
      {finished && <ProgrammeDone ctx={ctx} p={p} prog={prog} />}
      <div className="a-par-days" role="group" aria-label={pt('par_prog_all_days')}>
        {p.days.map((_, i) => {
          const cls = [i < prog.done.length ? 'done' : '', i === next && !finished ? 'now' : '', isDayLocked(i, ctx.isPremium) ? 'locked' : '', i === sel ? 'sel' : ''].filter(Boolean).join(' ');
          return (
            <button key={i} type="button" className={cls} aria-pressed={i === sel} aria-label={pf('par_prog_day', { n: i + 1 })} onClick={() => setPicked(i)}>
              {i + 1}
            </button>
          );
        })}
      </div>
      {locked
        ? <PremiumBlurGate feature="parenting_programme" title={pt('par_prog_locked_title')} subtitle={ctx.content.programmes.map((x) => x.title).join(' · ')} cta={pt('par_prog_unlock')}>{task}</PremiumBlurGate>
        : task}
      {!finished && <ReminderCard ctx={ctx} paused={!!prog.paused} nextDay={next} />}
      <div className="a-par-row-btns">
        {prog.done.length > 0 && <button type="button" className="a-par-btn ghost small" onClick={() => save((cur) => undoLastDay(cur, ctx.today))}>{pt('par_prog_undo')}</button>}
        {!finished && (
          <button type="button" className="a-par-btn ghost small" aria-pressed={!!prog.paused}
            onClick={() => { save((cur) => ({ ...cur, paused: !cur.paused })); ctx.track(prog.paused ? 'programme_resume' : 'programme_pause'); }}>
            {pt(prog.paused ? 'par_prog_resume' : 'par_prog_pause')}
          </button>
        )}
        <button type="button" className="a-par-btn ghost small" onClick={() => { save(() => null); setPicked(null); }}>{pt('par_prog_restart')}</button>
      </div>
      <Sources sources={p.sources} />
    </div>
  );
}

/** A local calendar day ('YYYY-MM-DD') in the app language; the key itself when Intl cannot format it. */
export function formatParentingDay(day: string, locale?: string): string {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  try {
    return new Date(y, m - 1, d).toLocaleDateString(locale || undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return day;
  }
}

/** Finished programme: days done, the dates, and another programme for the band to try next. */
function ProgrammeDone({ ctx, p, prog }: { ctx: ParentingCtx; p: Programme; prog: ProgrammeProgress }) {
  const sum = programmeSummary(prog, p.days.length);
  const next = suggestNextProgramme(ctx.content.programmes, ctx.slot.programmes, ctx.band, p.id);
  if (!sum) return null;
  const from = formatParentingDay(sum.from, ctx.locale);
  const to = formatParentingDay(sum.to, ctx.locale);
  return (
    <section className="a-par-done" data-testid="par-programme-summary">
      <b>{pf('par_prog_summary_days', { n: sum.days })}</b>
      <small>{from === to ? from : `${from} – ${to}`}</small>
      {next && (
        <div className="a-par-next">
          <small>{pt('par_prog_next_title')}</small>
          <button type="button" className="a-par-feature" onClick={() => { ctx.track('programme_next', next.id); ctx.go({ s: 'programme', id: next.id }); }}>
            <span className="a-par-emoji">{next.emoji}</span>
            <span><b>{next.title}</b><small>{`${pf('par_prog_days', { n: next.days.length })} · ${pt('par_prog_next_open')}`}</small></span>
          </button>
        </div>
      )}
    </section>
  );
}

/** Daily programme reminder on this phone: on/off and the time (free users for the free days, Premium for all). */
function ReminderCard({ ctx, paused, nextDay }: { ctx: ParentingCtx; paused: boolean; nextDay: number }) {
  const pref = ctx.local.reminder ?? { on: false, time: DEFAULT_REMINDER_TIME };
  const allowed = ctx.reminderAllowed && canRemindDay(nextDay, ctx.isPremium);
  const freeOnly = allowed && !ctx.isPremium;
  const on = allowed && pref.on;
  const set = (patch: Partial<typeof pref>) => ctx.updateLocal((s) => ({ ...s, reminder: { ...pref, ...patch } }));
  return (
    <section className="a-par-remind" data-testid="parenting-reminder">
      <div className="top">
        <span className="ic" aria-hidden><Bell size={16} /></span>
        <span className="tx">
          <b id="par-reminder-label">{pt('par_reminder_title')}</b>
          <small>{allowed ? (paused && on ? pt('par_reminder_paused') : pt('par_reminder_text')) : pt('par_reminder_premium')}</small>
          {freeOnly && <small>{pf('par_reminder_free', { n: FREE_PROGRAMME_DAYS })}</small>}
        </span>
        {allowed ? (
          <button type="button" role="switch" aria-checked={on} aria-labelledby="par-reminder-label" className="a-par-switch"
            onClick={() => { set({ on: !pref.on }); ctx.track(pref.on ? 'reminder_off' : 'reminder_on'); }}>
            <i />
          </button>
        ) : <PremiumBadge />}
      </div>
      {on && (
        <label className="a-par-time">
          <span>{pt('par_reminder_time')}</span>
          <input type="time" value={pref.time} step={300}
            onChange={(e) => { if (/^\d{2}:\d{2}$/.test(e.target.value)) set({ time: e.target.value }); }} />
        </label>
      )}
    </section>
  );
}

// ── Quizzes ──────────────────────────────────────────────────────────────────────────────
export function QuizScreen({ ctx, id }: { ctx: ParentingCtx; id: 'style' | 'milestones' }) {
  return id === 'style' ? <StyleQuizScreen ctx={ctx} /> : <MilestoneQuizScreen ctx={ctx} />;
}

function QuizProgress({ n, total }: { n: number; total: number }) {
  return (
    <div className="a-par-qprog">
      <span>{pf('par_quiz_question', { n, total })}</span>
      <div><i style={{ width: `${Math.round(((n - 1) / total) * 100)}%` }} /></div>
    </div>
  );
}

function QuizBack({ onBack }: { onBack: () => void }) {
  return <button type="button" className="a-par-btn ghost small a-par-qback" onClick={onBack}><ChevronLeft size={14} className="rtl:rotate-180" aria-hidden />{pt('par_quiz_prev')}</button>;
}

function StyleQuizScreen({ ctx }: { ctx: ParentingCtx }) {
  const q = ctx.content.styleQuiz;
  const total = q.items.length;
  const [nav, setNav] = useState<QuizNav<number>>(startQuiz);
  const [started, setStarted] = useState(false);
  const done = quizDone(nav, total);
  const answers = nav.answers as number[];
  const resultId = useMemo(() => (done ? styleResult(styleScores(q.items, answers)) : null), [done, answers, q.items]);

  const answer = (v: number) => {
    const next = quizAnswer(nav, v, total);
    setNav(next);
    if (quizDone(next, total)) {
      const r = styleResult(styleScores(q.items, next.answers as number[]));
      ctx.updateSlot((slot) => ({ ...slot, quizzes: { ...slot.quizzes, style: { at: ctx.today, result: r } } }));
      ctx.track('quiz_style_done');
    }
  };

  if (!started) {
    return (
      <div className="a-par">
        <h2 className="a-par-title">{q.emoji} {q.title}</h2>
        <p className="a-par-lead">{q.intro}</p>
        <button type="button" className="a-par-btn" onClick={() => setStarted(true)}>{pt('par_quiz_start')}</button>
        <p className="a-par-small">{q.note}</p>
      </div>
    );
  }
  if (!done || !resultId) {
    const i = nav.pos;
    return (
      <div className="a-par">
        <QuizProgress n={i + 1} total={total} />
        <div className="a-par-card"><h3>{q.items[i].text}</h3></div>
        <div className="a-par-answers">
          {q.scale.map((label, v) => <button key={label} type="button" aria-pressed={nav.answers[i] === v} onClick={() => answer(v)}>{label}</button>)}
        </div>
        {i > 0 && <QuizBack onBack={() => setNav(quizBack)} />}
      </div>
    );
  }
  const r = q.results[resultId];
  const detail = (
    <div className="a-par-card">
      <h3>{pt('par_quiz_detail')}</h3>
      {r.detail.map((t) => <p key={t}>{t}</p>)}
      <Bullets items={r.next} emergency={ctx.emergency} />
    </div>
  );
  return (
    <div className="a-par">
      <section className="a-par-hero is-soft">
        <div className="top"><small>{pt('par_quiz_result')}</small></div>
        <h2>{r.title}</h2>
        <p>{r.short}</p>
      </section>
      {ctx.isPremium ? detail : <PremiumBlurGate feature="parenting_quiz" title={LOCK.title()} subtitle={LOCK.text()} cta={LOCK.cta()}>{detail}</PremiumBlurGate>}
      <button type="button" className="a-par-btn ghost" onClick={() => { setNav(startQuiz()); setStarted(true); }}>{pt('par_quiz_retake')}</button>
      <p className="a-par-small">{q.note}</p>
      <Sources sources={q.sources} />
    </div>
  );
}

/** The milestone check's age: corrected for a preterm baby (until 24 corrected months), else the calendar age. */
const milestoneMonthsOf = (ctx: ParentingCtx) => (ctx.milestoneMonths !== undefined ? ctx.milestoneMonths : ctx.ageMonths);

function MilestoneQuizScreen({ ctx }: { ctx: ParentingCtx }) {
  const q = ctx.content.milestoneQuiz;
  const months = milestoneMonthsOf(ctx);
  const cp = checkpointFor(q.checkpoints, months ?? BAND_MONTHS[ctx.band])!;
  // Items first, the regression question last; answers stay when the parent steps back.
  const [nav, setNav] = useState<QuizNav<MilestoneAnswer>>(startQuiz);
  const [started, setStarted] = useState(false);
  const total = cp.items.length + 1;
  const earlyFrom = tooEarlyForMilestones(q.checkpoints, months);
  const corrected = ctx.milestoneCorrected && months !== null
    ? <p className="a-par-small" data-testid="par-milestone-corrected">{pf('par_milestone_corrected', { n: months })}</p> : null;

  if (!milestoneCheckOffered(q.checkpoints, months, ctx.band)) {
    // No checkpoint after 6 years: older children (or the 6–12 band without a birth date) get a short note instead.
    return (
      <div className="a-par" data-testid="par-milestone-late">
        <h2 className="a-par-title">{q.emoji} {q.title}</h2>
        <p className="a-par-lead">{pf('par_milestone_late', { n: Math.round((milestoneCheckEnd(q.checkpoints) ?? 84) / 12) })}</p>
        <p className="a-par-small">{q.note}</p>
      </div>
    );
  }

  if (earlyFrom !== null) {
    // Newborns: a "not yet" on a 4-month red flag is normal, so the check is not offered before the first checkpoint.
    return (
      <div className="a-par" data-testid="par-milestone-early">
        <h2 className="a-par-title">{q.emoji} {q.title}</h2>
        <p className="a-par-lead">{pf('par_milestone_early', { n: earlyFrom })}</p>
        {corrected}
        <p className="a-par-small">{q.note}</p>
      </div>
    );
  }

  const answer = (a: MilestoneAnswer) => {
    const next = quizAnswer(nav, a, total);
    setNav(next);
    if (quizDone(next, total)) {
      const r = milestoneResult(cp, next.answers.slice(0, cp.items.length), next.answers[cp.items.length]);
      ctx.updateSlot((slot) => ({ ...slot, quizzes: { ...slot.quizzes, milestones: { at: ctx.today, result: r.id } } }));
      ctx.track('quiz_milestones_done');
    }
  };

  if (!started) {
    return (
      <div className="a-par">
        <h2 className="a-par-title">{q.emoji} {q.title}</h2>
        <p className="a-par-meta">{cp.title}</p>
        {corrected}
        <p className="a-par-lead">{q.intro}</p>
        <button type="button" className="a-par-btn" onClick={() => setStarted(true)}>{pt('par_quiz_start')}</button>
        <p className="a-par-small">{q.note}</p>
      </div>
    );
  }
  if (nav.pos < cp.items.length) {
    const i = nav.pos;
    return (
      <div className="a-par">
        <QuizProgress n={i + 1} total={total} />
        <p className="a-par-meta">{cp.title}</p>
        <div className="a-par-card"><h3>{cp.items[i].text}</h3></div>
        <div className="a-par-answers">
          {(['yes', 'no', 'unsure'] as MilestoneAnswer[]).map((k) => <button key={k} type="button" aria-pressed={nav.answers[i] === k} onClick={() => answer(k)}>{q.answers[k]}</button>)}
        </div>
        {i > 0 && <QuizBack onBack={() => setNav(quizBack)} />}
      </div>
    );
  }
  if (!quizDone(nav, total)) {
    const reg = nav.answers[cp.items.length];
    return (
      <div className="a-par">
        <QuizProgress n={total} total={total} />
        <div className="a-par-card"><h3>{q.regression}</h3></div>
        <div className="a-par-answers">
          <button type="button" aria-pressed={reg === 'yes'} onClick={() => answer('yes')}>{q.answers.yes}</button>
          <button type="button" aria-pressed={reg === 'no'} onClick={() => answer('no')}>{q.answers.no}</button>
        </div>
        <QuizBack onBack={() => setNav(quizBack)} />
      </div>
    );
  }
  const res = milestoneResult(cp, nav.answers.slice(0, cp.items.length), nav.answers[cp.items.length]);
  const r = q.results[res.id];
  const support = (
    <div className="a-par-card">
      <h3>{pt('par_quiz_support')}</h3>
      <ul className="a-par-bullets">{res.notYet.map((i) => <li key={i}><b>{cp.items[i].text}</b> {cp.items[i].support}</li>)}</ul>
    </div>
  );
  return (
    <div className="a-par">
      <section className={`a-par-hero is-soft${res.id === 'talk' ? ' is-warn' : ''}`}>
        <div className="top"><small>{`${pt('par_quiz_result')} · ${cp.title}`}</small></div>
        <h2>{r.title}</h2>
        <p>{r.short}</p>
      </section>
      {/* Safety first: the "talk to a doctor" result and the flagged items are free for everyone. */}
      {(res.id === 'talk' || res.id === 'watch') && (
        <Box tone="warn" label={`⚠️ ${pt('par_h_specialist')}`}>
          {r.detail.map((t) => <p key={t}>{t}</p>)}
          {res.flagged.length > 0 && <ul className="a-par-bullets">{res.flagged.map((i) => <li key={i}>{cp.items[i].text}</li>)}</ul>}
        </Box>
      )}
      {res.id === 'ontrack' && <div className="a-par-card">{r.detail.map((t) => <p key={t}>{t}</p>)}</div>}
      {res.notYet.length > 0 && (ctx.isPremium ? support : <PremiumBlurGate feature="parenting_quiz" title={LOCK.title()} subtitle={LOCK.text()} cta={LOCK.cta()}>{support}</PremiumBlurGate>)}
      <button type="button" className="a-par-btn ghost" onClick={() => setNav(startQuiz())}>{pt('par_quiz_retake')}</button>
      <p className="a-par-small">{q.note}</p>
      <Sources sources={q.sources} />
    </div>
  );
}

// ── Saved ────────────────────────────────────────────────────────────────────────────────
export function SavedScreen({ ctx }: { ctx: ParentingCtx }) {
  const items = ctx.local.saved.map((ref) => {
    const [kind, id] = ref.split(':');
    if (kind === 'a') { const a = ctx.content.articles.find((x) => x.id === id); return a ? <ArticleRow key={ref} a={a} ctx={ctx} /> : null; }
    const c = ctx.content.sos.find((x) => x.id === id);
    return c ? (
      <button key={ref} type="button" className="a-par-row" onClick={() => ctx.go({ s: 'sos', id: c.id })}>
        <span className="ic">{c.emoji}</span><span className="tx"><b>{c.title}</b><small>{c.moment}</small></span>
      </button>
    ) : null;
  }).filter(Boolean);
  return <div className="a-par">{items.length ? items : <p className="a-par-small">{pt('par_saved_empty')}</p>}</div>;
}

export const savedRef = (route: Route): string | null => (route.s === 'article' ? `a:${route.id}` : route.s === 'sos' ? `s:${route.id}` : null);
export { toggleSaved };
