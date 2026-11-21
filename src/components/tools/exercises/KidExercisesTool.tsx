import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Clock, Heart, Pause, Play, RotateCcw, Search, ShieldAlert, Sparkles, Info } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { logEvent } from '@/lib/analytics';
import { useUserStore } from '@/store/userStore';
import { hasKidExContent, loadKidExContent, type KidExContent } from '@/data/kid-exercises';
import { KIDEX_UI_AZ } from '@/data/kid-exercises/ui-az';
import type { KidExUiText } from '@/data/kid-exercises/types';
import {
  currentGroupKey, dayKey, doneOn, exerciseImage, groupsOf, logDone, readKidExState, searchExercises, setForMonths,
  todaysPicks, toggleFav, unlogDone, weekStrip, writeKidExState, type KidExState, type KidExercise,
} from '@/lib/kid-exercises';
import { ToolHeader, ToolLoading, ToolPage } from '../anacan/ToolKit';
import './kid-exercises.css';

const fill = (template: string, vars: Record<string, string | number>) => template.replace(/\{([a-z]+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
/** Source sentences after a label start lowercase; under their own heading they start with a capital. */
const cap = (s: string, language: string) => (s ? s.charAt(0).toLocaleUpperCase(language === 'az' || language === 'tr' ? 'tr' : language) + s.slice(1) : s);

function makeT(ui: KidExUiText, language: string) {
  const num = (n: number) => { try { return new Intl.NumberFormat(language).format(n); } catch { return String(n); } };
  return {
    ...ui,
    language,
    countOf: (n: number) => fill(ui.count, { n: num(n) }),
    doneOf: (n: number) => fill(ui.doneCount, { n: num(n) }),
    ageFor: (name: string) => fill(ui.ageFor, { name }),
    cap: (s: string) => cap(s, language),
  };
}
type KT = ReturnType<typeof makeT>;
const TextContext = createContext<KT>(makeT(KIDEX_UI_AZ, 'az'));
const useT = () => useContext(TextContext);

export default function KidExercisesTool({ onBack }: { onBack: () => void }) {
  useScreenAnalytics('KidExercises', 'Tools');
  const appLanguage = useUserStore((s) => s.language);
  const language = hasKidExContent(appLanguage) ? appLanguage : 'az';
  const [content, setContent] = useState<KidExContent | null>(null);
  useEffect(() => {
    let alive = true;
    void loadKidExContent(language).then((c) => { if (alive) setContent(c); });
    return () => { alive = false; };
  }, [language]);
  if (!content) return <ToolLoading />;
  return (
    <TextContext.Provider value={makeT(content.ui, content.language)}>
      <KidExHome onBack={onBack} content={content} />
    </TextContext.Provider>
  );
}

function KidExHome({ onBack, content }: { onBack: () => void; content: KidExContent }) {
  const T = useT();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { selectedChild, getChildAge } = useChildren();
  const childMonths = selectedChild ? getChildAge(selectedChild)?.months ?? null : null;
  const [state, setState] = useState<KidExState>(() => readKidExState(typeof localStorage === 'undefined' ? null : localStorage, userId));
  useEffect(() => { setState(readKidExState(localStorage, userId)); }, [userId]);
  const save = (next: KidExState) => { setState(next); writeKidExState(localStorage, userId, next); };

  const childSet = childMonths != null ? setForMonths(childMonths) : null;
  const setId = state.set ?? childSet ?? '0-1';
  const set = content.sets.find((s) => s.id === setId) ?? content.sets[0];
  // Child's real age only when the shown group is the child's own; otherwise the start of the chosen group.
  const months = setId === childSet && childMonths != null ? childMonths : null;
  const [filter, setFilter] = useState<'all' | 'favs'>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => { void logEvent('kid_exercises_opened', { set: setId, has_child: childMonths != null, language: T.language }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const now = new Date();
  const today = dayKey(now);
  const done = doneOn(state, today);
  const inSet = useMemo(() => content.exercises.filter((e) => e.set === set.id), [content.exercises, set.id]);
  const picks = useMemo(() => todaysPicks(inSet, `${today}|${selectedChild?.id ?? 'x'}|${set.id}`, months), [inSet, today, selectedChild?.id, set.id, months]);
  const nowGroup = currentGroupKey(content.exercises, set.id, months);
  const base = filter === 'favs' ? content.exercises.filter((e) => state.favs.includes(e.id)) : inSet;
  const list = searchExercises(base, query);
  const groups = groupsOf(list);
  const week = weekStrip(state, now);
  const ordered = groups.flatMap((g) => g.items);

  const pickSet = (id: string) => { save({ ...state, set: id === childSet ? null : id }); setOpenId(null); };
  const open = (e: KidExercise, from: string) => { void logEvent('kid_exercise_viewed', { exercise: e.id, from }); setOpenId(e.id); };
  const toggleDone = (e: KidExercise) => {
    if (done.has(e.id)) { save(unlogDone(state, e.id, new Date())); return; }
    void logEvent('kid_exercise_done', { exercise: e.id, set: e.set });
    save(logDone(state, e.id, new Date()));
  };

  const current = openId ? content.exercises.find((e) => e.id === openId) ?? null : null;
  if (current) {
    const nav = ordered.some((e) => e.id === current.id) ? ordered : picks;
    const i = nav.findIndex((e) => e.id === current.id);
    return (
      <ExerciseScreen exercise={current} done={done.has(current.id)} fav={state.favs.includes(current.id)}
        prev={i > 0 ? nav[i - 1] : null} next={i >= 0 && i < nav.length - 1 ? nav[i + 1] : null}
        onGo={(e) => setOpenId(e.id)} onBack={() => setOpenId(null)} onDone={() => toggleDone(current)}
        onFav={() => save(toggleFav(state, current.id))} />
    );
  }

  return (
    <ToolPage>
      <ToolHeader title={T.title} eyebrow={T.eyebrow} onBack={onBack} />
      <div className="ke-wrap">
        <div className="ke-ages" role="tablist" aria-label={selectedChild ? T.ageFor(selectedChild.name) : T.age}>
          {content.sets.map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={set.id === s.id} className={`ke-chip${set.id === s.id ? ' on' : ''}`} onClick={() => pickSet(s.id)}>
              {s.id === childSet && selectedChild ? `${selectedChild.avatar_emoji || '👶'} ` : ''}{s.label}
            </button>
          ))}
        </div>

        <section className="ke-card ke-today" aria-label={T.today}>
          <div className="ke-today-row">
            <div>
              <p className="ke-eyebrow">{T.today}</p>
              <p className="ke-big">{T.doneOf(done.size)}</p>
            </div>
            <div className="ke-week" title={T.weekHint}>
              {week.map((d) => <span key={d.day} className={`ke-dot${d.count > 0 ? ' on' : ''}${d.today ? ' today' : ''}`} aria-label={`${d.day}: ${d.count}`} />)}
            </div>
          </div>
          <p className="ke-note"><Info size={13} aria-hidden /> <span>{T.safetyNote}</span></p>
        </section>

        <h2 className="ke-h2">{T.picksTitle}</h2>
        <p className="ke-sub">{T.picksSub} · {set.months}</p>
        <div className="ke-picks">
          {picks.map((e) => (
            <button key={e.id} type="button" className="ke-pick" onClick={() => open(e, 'today')}>
              <span className="ke-plate"><img src={exerciseImage(e.id)} alt="" loading="lazy" width={640} height={640} /></span>
              <span className="ke-pick-title">{e.title}</span>
              {done.has(e.id) && <Check size={14} className="ke-ok ke-pick-ok" aria-label={T.doneToday} />}
            </button>
          ))}
        </div>

        <h2 className="ke-h2">{T.allTitle}</h2>
        <label className="ke-search">
          <Search size={15} aria-hidden />
          <input type="search" value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder={T.search} aria-label={T.search} />
        </label>
        <div className="ke-filters">
          <button type="button" className={`ke-chip${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>{T.all} · {inSet.length}</button>
          <button type="button" className={`ke-chip${filter === 'favs' ? ' on' : ''}`} onClick={() => setFilter('favs')}><Heart size={12} aria-hidden /> {T.favs} · {state.favs.length}</button>
        </div>

        {filter === 'all' && !query && (
          <details className="ke-card ke-rules">
            <summary><ShieldAlert size={14} aria-hidden /> {T.rules} · {set.label}</summary>
            <ul>{set.rules.map((r) => <li key={r}>{r}</li>)}</ul>
          </details>
        )}

        {groups.length === 0 && <p className="ke-empty">{filter === 'favs' && !query ? T.noFavs : T.noResults}</p>}
        {groups.map((g) => (
          <section key={g.key} className="ke-group">
            <h3 className="ke-group-title">{g.label}{g.key === nowGroup && filter === 'all' && <span className="ke-now">{T.nowBadge}</span>}<span className="ke-group-count">{T.countOf(g.items.length)}</span></h3>
            <div className="ke-list">
              {g.items.map((e) => (
                <button key={e.id} type="button" className="ke-row" onClick={() => open(e, 'list')}>
                  <span className="ke-thumb"><img src={exerciseImage(e.id)} alt="" loading="lazy" width={640} height={640} /></span>
                  <span className="ke-row-text">
                    <span className="ke-row-title">{e.title}</span>
                    <span className="ke-row-sub">{e.age}</span>
                  </span>
                  {done.has(e.id) ? <Check size={16} className="ke-ok" aria-label={T.doneToday} /> : state.favs.includes(e.id) ? <Heart size={14} className="ke-heart" fill="currentColor" aria-label={T.favs} /> : <ChevronRight size={16} className="ke-chev" aria-hidden />}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </ToolPage>
  );
}

function ExerciseScreen({ exercise: e, done, fav, prev, next, onGo, onBack, onDone, onFav }: {
  exercise: KidExercise; done: boolean; fav: boolean; prev: KidExercise | null; next: KidExercise | null;
  onGo: (e: KidExercise) => void; onBack: () => void; onDone: () => void; onFav: () => void;
}) {
  const T = useT();
  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* ignore */ } }, [e.id]);
  return (
    <ToolPage>
      <ToolHeader title={T.title} eyebrow={e.group} onBack={onBack}
        actions={<button type="button" className="a-icon-btn" onClick={onFav} aria-label={fav ? T.unfav : T.fav} aria-pressed={fav}>
          <Heart size={16} className={fav ? 'ke-heart' : ''} fill={fav ? 'currentColor' : 'none'} /></button>} />
      <div className="ke-wrap ke-detail">
        <div className="ke-hero"><img src={exerciseImage(e.id)} alt={e.title} width={640} height={640} /></div>
        <h1 className="ke-title">{e.title}</h1>
        <div className="ke-meta">
          <span className="ke-pill"><Sparkles size={12} aria-hidden /> {e.age}</span>
          {e.duration && <span className="ke-pill"><Clock size={12} aria-hidden /> {T.cap(e.duration).replace(/[.。]\s*$/, '')}</span>}
        </div>

        <section className="ke-card">
          <p className="ke-eyebrow">{T.how}</p>
          <p className="ke-p">{e.how}</p>
        </section>
        <section className="ke-card">
          <p className="ke-eyebrow">{T.benefit}</p>
          <p className="ke-p">{T.cap(e.benefit)}</p>
        </section>
        {e.caution && (
          <section className="ke-card ke-caution" role="note">
            <p className="ke-eyebrow"><ShieldAlert size={12} aria-hidden /> {T.caution}</p>
            <p className="ke-p">{T.cap(e.caution)}</p>
          </section>
        )}

        <Stopwatch key={e.id} />

        <button type="button" className={`a-cta-btn ke-cta${done ? ' done' : ''}`} onClick={onDone} aria-pressed={done}>
          <Check size={16} aria-hidden /> {done ? T.doneToday : T.done}
        </button>

        <div className="ke-nav">
          <button type="button" className="a-btn-soft" disabled={!prev} onClick={() => prev && onGo(prev)}><ChevronLeft size={15} aria-hidden /> {T.prev}</button>
          <button type="button" className="a-btn-soft" disabled={!next} onClick={() => next && onGo(next)}>{T.next} <ChevronRight size={15} aria-hidden /></button>
        </div>
      </div>
    </ToolPage>
  );
}

/** Simple stopwatch for holds and rounds; stops when the screen closes. */
function Stopwatch() {
  const T = useT();
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startedAt = useRef(0);
  const base = useRef(0);
  useEffect(() => {
    if (!running) return;
    startedAt.current = Date.now();
    const id = window.setInterval(() => setElapsed(base.current + Date.now() - startedAt.current), 250);
    return () => { window.clearInterval(id); base.current += Date.now() - startedAt.current; };
  }, [running]);
  const s = Math.floor(elapsed / 1000);
  const label = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return (
    <section className="ke-card ke-timer" aria-label={T.timer}>
      <div>
        <p className="ke-eyebrow"><Clock size={12} aria-hidden /> {T.timer}</p>
        <p className="ke-time" aria-live="off">{label}</p>
      </div>
      <div className="ke-timer-btns">
        <button type="button" className="a-icon-btn" onClick={() => { startedAt.current = Date.now(); base.current = 0; setElapsed(0); setRunning(false); }} aria-label={T.reset} disabled={elapsed === 0 && !running}><RotateCcw size={16} /></button>
        <button type="button" className="ke-play" onClick={() => setRunning((r) => !r)} aria-label={running ? T.pause : T.start}>
          {running ? <Pause size={18} /> : <Play size={18} />}<span>{running ? T.pause : T.start}</span>
        </button>
      </div>
    </section>
  );
}
