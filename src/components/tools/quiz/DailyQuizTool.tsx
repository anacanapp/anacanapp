// Gündəlik Bilik Yarışı (daily quiz). Home (streak, points, league, weekly leaderboard) → questions with a timer and
// instant feedback → results. Everything is server-side (src/lib/daily-quiz/api.ts); this screen only renders it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, RefreshCw, Share2, X } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { nativeShare } from '@/lib/native';
import {
  answerQuestion, fetchQuizState, finishQuiz, nextIndex, startQuiz,
  type QuizAnswer, type QuizBoardRow, type QuizLeague, type QuizQuestion, type QuizResult, type QuizState,
} from '@/lib/daily-quiz/api';
import { fill, quizCopy, type QuizCopy } from '@/lib/daily-quiz/copy';
import { ToolHeader, ToolLoading, ToolPage } from '../anacan/ToolKit';
import './daily-quiz.css';

const LETTERS = ['A', 'B', 'C', 'D'];
const MEDAL: Record<QuizLeague, string> = { bronze: '/quiz/medal-bronze.webp', silver: '/quiz/medal-silver.webp', gold: '/quiz/medal-gold.webp' };

type Phase =
  | { kind: 'loading' } | { kind: 'error' } | { kind: 'home'; state: QuizState }
  | { kind: 'play'; date: string; seconds: number; questions: QuizQuestion[]; answers: (number | null)[]; index: number; reveal: QuizAnswer | null }
  | { kind: 'result'; result: QuizResult; questions: QuizQuestion[] };

export default function DailyQuizTool({ onBack }: { onBack: () => void }) {
  useScreenAnalytics('daily_quiz', 'DailyQuizTool');
  const language = useUserStore((s) => s.language) || 'az';
  const t = useMemo(() => quizCopy(language), [language]);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setPhase({ kind: 'loading' });
    try { setPhase({ kind: 'home', state: await fetchQuizState(language) }); } catch { setPhase({ kind: 'error' }); }
  }, [language]);
  useEffect(() => { void load(); }, [load]);

  const begin = async () => {
    if (busy) return; setBusy(true);
    try {
      const s = await startQuiz(language);
      const answers = s.questions.map((_, i) => (s.answers?.[i] ?? null));
      const index = nextIndex(answers);
      if (index >= s.questions.length) await finish(s.questions);
      else setPhase({ kind: 'play', date: s.date, seconds: s.seconds_per_question, questions: s.questions, answers, index, reveal: null });
    } catch { await load(); } finally { setBusy(false); }
  };

  const finish = async (questions: QuizQuestion[]) => {
    try { setPhase({ kind: 'result', result: await finishQuiz(), questions }); } catch { await load(); }
  };

  if (phase.kind === 'loading') return <ToolLoading />;
  return (
    <ToolPage className="dq">
      <ToolHeader title={t.tileName} onBack={phase.kind === 'play' ? () => void load() : onBack} />
      {phase.kind === 'error' && <div className="dq-card dq-center">
        <p className="dq-muted">{t.error}</p>
        <button type="button" className="dq-cta" onClick={() => void load()}><RefreshCw size={16} />{t.retry}</button>
      </div>}
      {phase.kind === 'home' && <Home t={t} state={phase.state} busy={busy} onStart={begin} />}
      {phase.kind === 'play' && <Play t={t} phase={phase} setPhase={setPhase} onFinish={finish} />}
      {phase.kind === 'result' && <Result t={t} result={phase.result} questions={phase.questions} onDone={() => void load()} />}
    </ToolPage>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <div className="dq-stat"><span className="dq-stat-icon">{icon}</span><b>{value}</b><small>{label}</small></div>;
}

function Home({ t, state, busy, onStart }: { t: QuizCopy; state: QuizState; busy: boolean; onStart: () => void }) {
  const league = { bronze: t.bronze, silver: t.silver, gold: t.gold }[state.league];
  const done = state.today.status === 'done';
  return (
    <div className="dq-stack">
      <div className="dq-hero-title">
        <h1>{t.title}</h1>
        <p>{fill(t.subtitle, { n: state.questions_per_day })}</p>
      </div>
      {!state.enabled
        ? <div className="dq-card dq-center"><img src="/quiz/bulb.webp" alt="" className="dq-hero-art" /><p className="dq-muted">{t.unavailable}</p></div>
        : <div className="dq-card dq-hero">
            <img src={done ? '/quiz/trophy.webp' : '/quiz/bulb.webp'} alt="" className="dq-hero-art" />
            <div className="dq-hero-copy">
              <h2>{done ? t.heroDone : state.today.status === 'started' ? t.heroResume : t.heroReady}</h2>
              {done && state.today.status === 'done'
                ? <p className="dq-muted">{state.today.correct} / {state.today.total} · {fill(t.pointsGained, { n: state.today.score })}<br />{t.heroDoneSub}</p>
                : <button type="button" className="dq-cta" disabled={busy} onClick={onStart}>{state.today.status === 'started' ? t.resume : t.start}</button>}
            </div>
          </div>}
      <div className="dq-stats">
        <Stat icon="🔥" value={String(state.streak)} label={t.streak} />
        <Stat icon="⭐" value={String(state.week_points)} label={t.points} />
        <Stat icon={<img src={MEDAL[state.league]} alt="" />} value={league} label={t.league} />
      </div>
      <Board t={t} rows={state.leaderboard.top} me={state.leaderboard.me} />
      <p className="dq-foot">{t.newLeague}</p>
    </div>
  );
}

function Board({ t, rows, me }: { t: QuizCopy; rows: QuizBoardRow[]; me: { rank: number; points: number } | null }) {
  const podium = [rows[1], rows[0], rows[2]];
  const meInTop = rows.some((r) => r.me);
  return (
    <div className="dq-card">
      <h3 className="dq-card-title">{t.weekly}</h3>
      {rows.length === 0 ? <p className="dq-muted dq-center-text">{t.noPlayers}</p> : <>
        <div className="dq-podium">{podium.map((r, i) => r ? (
          <div key={r.rank + '-' + i} className={`dq-pod dq-pod-${[2, 1, 3][i]}${r.me ? ' is-me' : ''}`}>
            <Avatar row={r} t={t} />
            <div className="dq-pod-step"><span>{r.rank}</span></div>
            <small>{r.me ? t.you : r.name || t.anon}</small>
          </div>) : <div key={'empty' + i} className="dq-pod" />)}
        </div>
        <ol className="dq-list">{rows.slice(3).map((r) => (
          <li key={r.rank + (r.name || '')} className={r.me ? 'is-me' : ''}><span>{r.rank}</span><b>{r.me ? t.you : r.name || t.anon}</b><em>{r.points}</em></li>))}
        </ol>
      </>}
      {me && !meInTop && <div className="dq-me"><span>{fill(t.yourPlace, { n: me.rank })}</span><em>{me.points}</em></div>}
    </div>
  );
}

function Avatar({ row, t }: { row: QuizBoardRow; t: QuizCopy }) {
  const [broken, setBroken] = useState(false);
  const letter = (row.me ? t.you : row.name || t.anon).slice(0, 1).toUpperCase();
  return row.avatar && !broken
    ? <img className="dq-avatar" src={row.avatar} alt="" onError={() => setBroken(true)} />
    : <span className="dq-avatar dq-avatar-letter">{letter}</span>;
}

function Play({ t, phase, setPhase, onFinish }: {
  t: QuizCopy; phase: Extract<Phase, { kind: 'play' }>; setPhase: (p: Phase) => void; onFinish: (q: QuizQuestion[]) => Promise<void>;
}) {
  const { questions, index, reveal, seconds } = phase;
  const q = questions[index];
  const [left, setLeft] = useState(seconds);
  const [sending, setSending] = useState(false);
  const sent = useRef(false);

  useEffect(() => { setLeft(seconds); sent.current = false; }, [index, seconds]);

  const choose = useCallback(async (choice: number) => {
    if (sent.current || reveal) return;
    sent.current = true; setSending(true);
    try {
      const r = await answerQuestion(index, choice);
      const answers = phase.answers.slice(); answers[index] = r.chosen;
      setPhase({ ...phase, answers, reveal: r });
    } catch { sent.current = false; } finally { setSending(false); }
  }, [index, phase, reveal, setPhase]);

  useEffect(() => {
    if (reveal) return;
    if (left <= 0) { void choose(-1); return; }
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left, reveal, choose]);

  const goNext = () => {
    const next = index + 1;
    if (next >= questions.length) void onFinish(questions);
    else setPhase({ ...phase, index: next, reveal: null });
  };

  const pct = Math.max(0, left / seconds);
  return (
    <div className="dq-stack">
      <div className="dq-progress">
        <span className="dq-progress-label">{fill(t.question, { i: index + 1, n: questions.length })}</span>
        <div className="dq-dots">{questions.map((_, i) => <i key={i} className={i < index || (i === index && reveal) ? 'on' : i === index ? 'now' : ''} />)}</div>
        <div className="dq-timer" style={{ ['--p' as string]: pct }} aria-label={String(left)}><span>{reveal ? '·' : left}</span></div>
      </div>
      <span className="dq-chip">{t.categories[q.category]}</span>
      <h2 className="dq-question">{q.question}</h2>
      <div className="dq-options">{q.options.map((o, i) => {
        const state = !reveal ? '' : i === reveal.correct_index ? 'right' : i === reveal.chosen ? 'wrong' : 'dim';
        return (
          <button type="button" key={i} className={`dq-option ${state}`} disabled={!!reveal || sending} onClick={() => void choose(i)}>
            <span className="dq-letter">{LETTERS[i]}</span><span className="dq-option-text">{o}</span>
            {state === 'right' && <Check size={20} strokeWidth={3} />}{state === 'wrong' && <X size={20} strokeWidth={3} />}
          </button>);
      })}</div>
      {reveal && <div className={`dq-card dq-explain ${reveal.correct ? 'ok' : 'no'}`}>
        <b>{reveal.chosen === -1 ? t.timeUp : reveal.correct ? '✓ ' + t.answer : t.didYouKnow}</b>
        <p>{reveal.explanation}</p>
      </div>}
      {reveal && <button type="button" className="dq-cta dq-wide" onClick={goNext}>
        {index + 1 >= questions.length ? t.finish : t.next}<ChevronRight size={18} /></button>}
    </div>
  );
}

function Result({ t, result, questions, onDone }: { t: QuizCopy; result: QuizResult; questions: QuizQuestion[]; onDone: () => void }) {
  const ratio = result.total ? result.correct / result.total : 0;
  const headline = ratio >= 0.8 ? t.great : ratio >= 0.4 ? t.good : t.tryTomorrow;
  const missed = result.results.find((r) => r.chosen !== r.correct_index) ?? result.results[0];
  const share = () => void nativeShare({ title: t.title, text: fill(t.shareText, { c: result.correct, n: result.total }) + ' https://anacan.az' });
  return (
    <div className="dq-stack">
      <div className="dq-result-head">
        <img src="/quiz/trophy.webp" alt="" className="dq-trophy" />
        <h1>{headline}</h1>
        <div className="dq-score">{result.correct} / {result.total}</div>
        <div className="dq-chips"><span className="dq-pill coral">{fill(t.pointsGained, { n: result.score })}</span>
          <span className="dq-pill peach">🔥 {fill(t.streakChip, { n: result.streak })}</span></div>
      </div>
      {missed && <div className="dq-card">
        <h3 className="dq-card-title coral">{t.didYouKnow}</h3>
        <p className="dq-small-q">{questions.find((q) => q.id === missed.id)?.question}</p>
        <p className="dq-body">{missed.explanation}</p>
      </div>}
      <Board t={t} rows={result.leaderboard.top} me={result.leaderboard.me} />
      <div className="dq-actions">
        <button type="button" className="dq-ghost" onClick={share}><Share2 size={16} />{t.share}</button>
        <button type="button" className="dq-cta" onClick={onDone}>{t.done}</button>
      </div>
    </div>
  );
}
