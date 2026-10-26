import { useEffect, useRef, useState } from 'react';
import { copy } from '../game/content';
import { text, t } from '../game/i18n';
import { audio } from '../game/audio';
import type { Activity, Catalogue, GameAction, GameState, Language, PublicRow } from '../game/types';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { SimulationGame } from './SimulationGames';

interface MiniProps { activity: Activity; catalogue: Catalogue; state: GameState; dispatch(action: GameAction): void; language: Language; source?: PublicRow; onComplete(quality: number, sourceId?: string): void; onClose(): void }

export function MiniGame(props: MiniProps) {
  const [quality, setQuality] = useState<number | null>(null);
  const completedSource = useRef<string>();
  const { activity, catalogue, language, onClose, onComplete } = props;
  const milestone = activity.id === 'play' ? catalogue.milestones.filter(row => Number(row.week_number) <= Math.max(1, props.state.chapter >= 13 ? 52 : props.state.chapter >= 12 ? 24 : 12)).at(-1) : undefined;
  const source = props.source ?? (activity.mini === 'cooking' ? catalogue.recipes[0] : milestone);
  const finish = (score: number, sourceId?: string) => { completedSource.current = sourceId; setQuality(Math.max(1, Math.min(100, score))); audio.success(); };
  return <Sheet title={text(activity.title, language)} subtitle={t('miniBonus', language)} icon={activity.icon} onClose={onClose} language={language} className="mini-sheet" wide>
    {quality !== null ? <div className="mini-result"><div className="result-stars">{[0, 1, 2].map(i => <Icon name="star" key={i} size={i === 1 ? 49 : 38} className={quality >= i * 33 ? 'earned' : ''} />)}</div><h2>{t(quality > 75 ? 'perfect' : 'good', language)}</h2><p>{text(activity.result, language)}</p><div className="bonus-pill"><Icon name="heart" />+{Math.round(quality / 2)}% {t('score', language)}</div>
      <button className="button primary large" onClick={() => onComplete(quality, completedSource.current ?? source?.id)} data-testid="mini-complete">{t('finish', language)}<Icon name="check" /></button></div>
      : !['lullaby', 'discovery'].includes(activity.mini ?? '') ? <SimulationGame activity={activity} catalogue={catalogue} state={props.state} dispatch={props.dispatch} source={source} onFinish={finish} />
      : activity.mini === 'lullaby' ? <LullabyGame language={language} onFinish={finish} />
      : <DiscoveryGame language={language} onFinish={finish} />}
  </Sheet>;
}

function LullabyGame({ language, onFinish }: { language: Language; onFinish(score: number): void }) {
  const [hits, setHits] = useState<number[]>([]), [feedback, setFeedback] = useState(''), [remaining, setRemaining] = useState(18);
  const marker = useRef<HTMLSpanElement>(null), start = useRef(0), phase = useRef(.5), lastTap = useRef(0), ended = useRef(false), hitsRef = useRef<number[]>([]);
  useEffect(() => {
    let frame = 0; const animate = (now: number) => {
      if (!start.current) start.current = now;
      phase.current = .5 + Math.sin((now - start.current) / 640) * .44;
      if (marker.current) marker.current.style.left = `${phase.current * 100}%`;
      frame = requestAnimationFrame(animate);
    }; frame = requestAnimationFrame(animate);
    const timer = setInterval(() => setRemaining(old => Math.max(0, old - 1)), 1000);
    return () => { cancelAnimationFrame(frame); clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (remaining === 0 && !ended.current) { ended.current = true; onFinish(hitsRef.current.reduce((a, b) => a + b, 0) / 5); }
  }, [remaining, onFinish]);
  const tap = () => {
    const now = performance.now(); if (now - lastTap.current < 600 || ended.current) return; lastTap.current = now;
    const score = Math.max(20, 100 - Math.abs(phase.current - .5) * 240), next = [...hits, score];
    hitsRef.current = next; setHits(next); setFeedback(t(score > 75 ? 'perfect' : 'good', language)); audio.sparkle();
    if (next.length === 5) { ended.current = true; onFinish(Math.round(next.reduce((a, b) => a + b, 0) / 5)); }
  };
  return <div className="mini-game lullaby-game"><p>{t('lullabyHint', language)}</p><div className="lullaby-moon"><Icon name="moon" size={90} /><span className="lullaby-star s1"><Icon name="star" size={23} /></span><span className="lullaby-star s2"><Icon name="star" size={17} /></span><span className="lullaby-z">z z z</span></div>
    <div className="lullaby-notes">{Array.from({ length: 5 }, (_, i) => <span className={hits[i] !== undefined ? 'done' : ''} key={i}><Icon name={hits[i] !== undefined ? 'check' : 'music'} size={22} /></span>)}</div>
    <div className="rhythm-track"><div className="rhythm-target" /><span className="rhythm-marker" ref={marker} /></div>
    <button className="rhythm-button" onClick={tap} aria-label={t('lullabyHint', language)} data-testid="lullaby-tap"><Icon name="heart" size={35} /></button><div className="rhythm-feedback" aria-live="polite">{feedback || '♪'}</div><small>{remaining}s</small>
  </div>;
}

function DiscoveryGame({ language, onFinish }: { language: Language; onFinish(score: number): void }) {
  const [cards] = useState(() => [0, 2, 1, 3, 2, 0, 3, 1]);
  const [open, setOpen] = useState<number[]>([]), [matched, setMatched] = useState<number[]>([]), [turns, setTurns] = useState(0), [preview, setPreview] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => { timers.current.push(setTimeout(() => setPreview(false), 1700)); return () => timers.current.forEach(clearTimeout); }, []);
  const choose = (index: number) => {
    if (preview || open.length === 2 || open.includes(index) || matched.includes(cards[index])) return;
    const next = [...open, index]; setOpen(next); audio.tap();
    if (next.length === 2) {
      setTurns(turns + 1);
      if (cards[next[0]] === cards[index]) {
        const complete = [...matched, cards[index]]; setMatched(complete); setOpen([]); audio.sparkle();
        if (complete.length === 4) onFinish(Math.max(40, 100 - Math.max(0, turns + 1 - 4) * 7));
      } else timers.current.push(setTimeout(() => setOpen([]), 850));
    }
  };
  return <div className="mini-game discovery-game"><p>{t('discoveryHint', language)}</p><span className="mini-kicker">{text(copy('Balaca gözlər üçün rəngli kəşflər', 'Colourful discoveries for little eyes', 'Minik gözler için renkli keşifler'), language)}</span><div className="discovery-grid">{cards.map((type, index) => {
    const revealed = preview || open.includes(index) || matched.includes(type);
    return <button key={index} className={`discovery-card ${revealed ? 'revealed' : ''} ${matched.includes(type) ? 'matched' : ''} toy-${type}`} onClick={() => choose(index)} aria-label={`${t('playMini', language)} ${index + 1}`} data-testid={`discovery-${index}`} disabled={preview || matched.includes(type)}><Icon name={revealed ? ['flower', 'moon', 'rainbow', 'leaf'][type] : 'heart'} size={revealed ? 35 : 21} /></button>;
  })}</div><div className="discovery-progress"><Icon name="sparkles" size={18} />{matched.length} / 4</div></div>;
}
