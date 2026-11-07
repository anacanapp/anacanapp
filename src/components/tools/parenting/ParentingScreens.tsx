import { useMemo, useState, type ReactNode } from 'react';
import { Crown, Lock, Phone } from 'lucide-react';
import PremiumBlurGate from '@/components/premium/PremiumBlurGate';
import { fillEmergencyNumber } from '@/lib/emergency';
import { bandKey, pf, pt } from '@/lib/parenting-copy';
import {
  type ParentingLocal, type ProgrammeProgress,
  FREE_PROGRAMME_DAYS, canCompleteToday, checkpointFor, completeDay, isDayLocked, isFinished, milestoneResult, nextDayIndex,
  progressPercent, readingMinutes, startProgramme, styleResult, styleScores, toggleSaved, undoLastDay,
} from '@/lib/parenting';
import type {
  AgeBandId, Area, AreaId, Article, MilestoneAnswer, ParentingContent, Programme, SosCard, Source,
} from '@/data/parenting/types';
import { AGE_BANDS } from '@/data/parenting/types';

export type Route =
  | { s: 'home' }
  | { s: 'band'; id: AgeBandId }
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
  local: ParentingLocal;
  update: (fn: (s: ParentingLocal) => ParentingLocal) => void;
  go: (r: Route) => void;
  track: (action: string) => void;
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
  const setBand = (b: AgeBandId) => ctx.update((s) => ({ ...s, band: b === ctx.childBand ? null : b }));
  const overviewMin = readingMinutes([overview.lead, ...overview.brain, ...overview.needs, ...overview.normal, ...overview.tryThis]);

  return (
    <div className="a-par">
      <section className="a-par-hero" aria-label={pt('par_tip_title')}>
        <div className="top">
          <small>{pt('par_tip_title')}</small>
          {ctx.childAgeLabel && <span className="tag">{`${ctx.childName} · ${ctx.childAgeLabel}`}</span>}
        </div>
        <h2>{tip.title}</h2>
        <p>{tip.text}</p>
      </section>

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
  const prog = ctx.local.programmes[p.id];
  const done = prog ? prog.done.length : 0;
  return (
    <button type="button" className="a-par-feature" onClick={() => ctx.go({ s: 'programme', id: p.id })}>
      <Ring percent={progressPercent(prog, p.days.length)} label={prog ? `${done}/${p.days.length}` : p.emoji} />
      <span>
        <b>{p.title}</b>
        <small>{prog ? pf('par_prog_progress', { done, total: p.days.length }) : `${pf('par_prog_days', { n: p.days.length })} · ${pt('par_prog_daily')}`}</small>
      </span>
      {!ctx.isPremium && <PremiumBadge />}
    </button>
  );
}

function QuizRows({ ctx }: { ctx: ParentingCtx }) {
  const { styleQuiz, milestoneQuiz } = ctx.content;
  return (
    <>
      {[styleQuiz, milestoneQuiz].map((q) => {
        const last = ctx.local.quizzes[q.id];
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
export function BandScreen({ ctx, id }: { ctx: ParentingCtx; id: AgeBandId }) {
  const b = ctx.content.bands.find((x) => x.id === id)!;
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
      <Sources sources={b.sources} />
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
    </div>
  );
}

// ── Programmes ───────────────────────────────────────────────────────────────────────────
export function ProgrammesScreen({ ctx }: { ctx: ParentingCtx }) {
  return (
    <div className="a-par">
      {!ctx.isPremium && <p className="a-par-small">{pf('par_prog_free_days', { n: FREE_PROGRAMME_DAYS })}</p>}
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
  const prog: ProgrammeProgress | undefined = p ? ctx.local.programmes[p.id] : undefined;
  const next = nextDayIndex(prog);
  const [picked, setPicked] = useState<number | null>(null);
  if (!p) return null;
  const total = p.days.length;
  const finished = isFinished(prog, total);
  const sel = Math.min(picked ?? Math.min(next, total - 1), total - 1);
  const day = p.days[sel];
  const locked = isDayLocked(sel, ctx.isPremium);
  const save = (fn: (cur: ProgrammeProgress) => ProgrammeProgress | null) => ctx.update((s) => {
    const cur = s.programmes[p.id] ?? startProgramme(ctx.today);
    const res = fn(cur);
    const programmes = { ...s.programmes };
    if (res) programmes[p.id] = res; else delete programmes[p.id];
    return { ...s, programmes };
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
  const canDo = sel === next && canCompleteToday(prog, total, ctx.today) && !locked;
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
      <div className="a-par-feature static">
        <Ring percent={progressPercent(prog, total)} label={`${prog.done.length}/${total}`} size={56} />
        <span>
          <b>{finished ? pt('par_prog_finished') : prog.done.length ? pt('par_prog_great') : p.title}</b>
          <small>{prog.done.length ? pf('par_prog_steps_done', { n: prog.done.length }) : pt('par_prog_daily')}</small>
        </span>
      </div>
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
      <div className="a-par-row-btns">
        {prog.done.length > 0 && <button type="button" className="a-par-btn ghost small" onClick={() => save((cur) => undoLastDay(cur, ctx.today))}>{pt('par_prog_undo')}</button>}
        <button type="button" className="a-par-btn ghost small" onClick={() => { save(() => null); setPicked(null); }}>{pt('par_prog_restart')}</button>
      </div>
      <Sources sources={p.sources} />
    </div>
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

function StyleQuizScreen({ ctx }: { ctx: ParentingCtx }) {
  const q = ctx.content.styleQuiz;
  const [answers, setAnswers] = useState<number[]>([]);
  const [started, setStarted] = useState(false);
  const done = answers.length >= q.items.length;
  const resultId = useMemo(() => (done ? styleResult(styleScores(q.items, answers)) : null), [done, answers, q.items]);

  const answer = (v: number) => {
    const next = [...answers, v];
    setAnswers(next);
    if (next.length >= q.items.length) {
      const r = styleResult(styleScores(q.items, next));
      ctx.update((s) => ({ ...s, quizzes: { ...s.quizzes, style: { at: ctx.today, result: r } } }));
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
    const i = answers.length;
    return (
      <div className="a-par">
        <QuizProgress n={i + 1} total={q.items.length} />
        <div className="a-par-card"><h3>{q.items[i].text}</h3></div>
        <div className="a-par-answers">
          {q.scale.map((label, v) => <button key={label} type="button" onClick={() => answer(v)}>{label}</button>)}
        </div>
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
      <button type="button" className="a-par-btn ghost" onClick={() => { setAnswers([]); setStarted(true); }}>{pt('par_quiz_retake')}</button>
      <p className="a-par-small">{q.note}</p>
      <Sources sources={q.sources} />
    </div>
  );
}

function MilestoneQuizScreen({ ctx }: { ctx: ParentingCtx }) {
  const q = ctx.content.milestoneQuiz;
  const cp = checkpointFor(q.checkpoints, ctx.ageMonths ?? BAND_MONTHS[ctx.band])!;
  const [answers, setAnswers] = useState<MilestoneAnswer[]>([]);
  const [regression, setRegression] = useState<MilestoneAnswer | null>(null);
  const [started, setStarted] = useState(false);
  const total = cp.items.length + 1;

  const finish = (reg: MilestoneAnswer) => {
    setRegression(reg);
    const r = milestoneResult(cp, answers, reg);
    ctx.update((s) => ({ ...s, quizzes: { ...s.quizzes, milestones: { at: ctx.today, result: r.id } } }));
    ctx.track('quiz_milestones_done');
  };

  if (!started) {
    return (
      <div className="a-par">
        <h2 className="a-par-title">{q.emoji} {q.title}</h2>
        <p className="a-par-meta">{cp.title}</p>
        <p className="a-par-lead">{q.intro}</p>
        <button type="button" className="a-par-btn" onClick={() => setStarted(true)}>{pt('par_quiz_start')}</button>
        <p className="a-par-small">{q.note}</p>
      </div>
    );
  }
  if (answers.length < cp.items.length) {
    const i = answers.length;
    return (
      <div className="a-par">
        <QuizProgress n={i + 1} total={total} />
        <p className="a-par-meta">{cp.title}</p>
        <div className="a-par-card"><h3>{cp.items[i].text}</h3></div>
        <div className="a-par-answers">
          {(['yes', 'no', 'unsure'] as MilestoneAnswer[]).map((k) => <button key={k} type="button" onClick={() => setAnswers([...answers, k])}>{q.answers[k]}</button>)}
        </div>
      </div>
    );
  }
  if (!regression) {
    return (
      <div className="a-par">
        <QuizProgress n={total} total={total} />
        <div className="a-par-card"><h3>{q.regression}</h3></div>
        <div className="a-par-answers">
          <button type="button" onClick={() => finish('yes')}>{q.answers.yes}</button>
          <button type="button" onClick={() => finish('no')}>{q.answers.no}</button>
        </div>
      </div>
    );
  }
  const res = milestoneResult(cp, answers, regression);
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
      <button type="button" className="a-par-btn ghost" onClick={() => { setAnswers([]); setRegression(null); }}>{pt('par_quiz_retake')}</button>
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
