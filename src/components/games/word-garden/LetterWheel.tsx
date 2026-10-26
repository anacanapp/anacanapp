import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { CornerDownLeft, Shuffle, X, Delete } from 'lucide-react';
import { displayGardenWord } from './lexicon';
import type { GardenText } from './useGardenText';
import { crossedLetters, selectWheelLetter, wheelPoints, type WheelPoint } from './wheel';

interface Props { letters: string[]; locale: string; t: GardenText; disabled: boolean; resetKey: string; onSubmit: (word: string) => void; onShuffle: () => void; onPick: () => void }
export default function LetterWheel({ letters, locale, t, disabled, resetKey, onSubmit, onShuffle, onPick }: Props) {
  const points = wheelPoints(letters.length), ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number[]>([]), chosen = useRef<number[]>([]), [cursor, setCursor] = useState<WheelPoint | null>(null);
  const gesture = useRef<{ id: number; start: WheelPoint; last: WheelPoint; moved: boolean } | null>(null);
  const latest = useRef({ letters, disabled, onSubmit, onPick }); latest.current = { letters, disabled, onSubmit, onPick };
  const choose = useCallback((index: number) => {
    const next = selectWheelLetter(chosen.current, index);
    if (next === chosen.current) return;
    chosen.current = next; setSelected(next); latest.current.onPick();
  }, []);
  const clear = useCallback(() => { chosen.current = []; setSelected([]); setCursor(null); }, []);
  useEffect(() => { gesture.current = null; chosen.current = []; setSelected([]); setCursor(null); }, [resetKey, disabled]);
  const submit = useCallback(() => {
    const word = chosen.current.map(index => latest.current.letters[index]).join('');
    clear(); if (!latest.current.disabled && word) latest.current.onSubmit(word);
  }, [clear]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (latest.current.disabled || event.ctrlKey || event.metaKey || event.altKey
        || (event.target instanceof HTMLElement && event.target.matches('input,textarea,[contenteditable=true]'))) return;
      if (event.key === 'Enter' && chosen.current.length && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); submit(); return; }
      if (event.key === 'Backspace' && chosen.current.length) { event.preventDefault(); chosen.current = chosen.current.slice(0, -1); setSelected(chosen.current); return; }
      const normalized = event.key.normalize('NFC').toLocaleLowerCase(locale);
      if (Array.from(normalized).length !== 1) return;
      const index = latest.current.letters.findIndex((letter, index) => letter === normalized && !chosen.current.includes(index));
      if (index >= 0) { event.preventDefault(); choose(index); ref.current?.focus({ preventScroll: true }); }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [locale, choose, submit]);
  const localPoint = (event: Pick<PointerEvent, 'clientX' | 'clientY'>) => {
    const box = ref.current!.getBoundingClientRect();
    return { x: (event.clientX - box.left) / box.width * 300, y: (event.clientY - box.top) / box.height * 300 };
  };
  const move = (event: PointerEvent) => {
    const current = gesture.current;
    if (!current || event.pointerId !== current.id || disabled) return;
    const next = localPoint(event);
    if (Math.hypot(next.x - current.start.x, next.y - current.start.y) > 8) current.moved = true;
    for (const index of crossedLetters(current.last, next, points)) choose(index);
    current.last = next; setCursor(next);
  };
  const value = selected.map(index => letters[index]).join('');
  return <div className="wg-wheel-region">
    <div className="wg-word-entry"><div className={`wg-word-preview ${selected.length ? 'has-word' : ''}`}>
      <span aria-live="polite" aria-label={value ? t('selectedWord', { word: displayGardenWord(value, locale) }) : t('waitingWord')}>
        {value ? displayGardenWord(value, locale) : t('waitingWord')}
      </span>
      {selected.length > 0 && <button type="button" disabled={disabled} aria-label={t('clear')} onClick={clear}><X size={17} /></button>}
    </div>
      <button type="button" className="wg-word-delete" disabled={disabled || !selected.length} aria-label={t('backspace')}
        onClick={() => { chosen.current = chosen.current.slice(0, -1); setSelected(chosen.current); }}><Delete size={18} /></button>
      <button type="button" className="wg-submit" aria-label={t('submit')} disabled={disabled || !selected.length} onClick={submit}><CornerDownLeft size={18} /></button>
    </div>
    <div className="wg-wheel" ref={ref} role="group" tabIndex={0} aria-label={t('wheelLabel')} data-testid="wordgarden-wheel"
      onPointerDown={event => {
        if (disabled || gesture.current || event.isPrimary === false || event.button !== 0) return;
        const next = localPoint(event), radius = Math.max(27, 22 * 300 / ref.current!.getBoundingClientRect().width);
        const index = points.findIndex(point => Math.hypot(point.x - next.x, point.y - next.y) <= radius);
        if (index < 0) return;
        event.preventDefault(); gesture.current = { id: event.pointerId, start: next, last: next, moved: false };
        ref.current?.setPointerCapture?.(event.pointerId); choose(index); setCursor(next);
      }} onPointerMove={move} onPointerUp={event => {
        const current = gesture.current;
        if (!current || current.id !== event.pointerId) return;
        move(event); gesture.current = null; setCursor(null);
        if (ref.current?.hasPointerCapture?.(event.pointerId)) ref.current.releasePointerCapture(event.pointerId);
        if (current.moved) submit();
      }} onPointerCancel={() => { gesture.current = null; clear(); }} onLostPointerCapture={() => { if (gesture.current) { gesture.current = null; clear(); } }}>
      <svg viewBox="0 0 300 300" className="wg-wheel-lines" aria-hidden="true">
        <circle cx="150" cy="150" r="134" fill="none" className="wg-wheel-orbit" />
        <polyline points={[...selected.map(index => points[index]), ...(cursor && gesture.current?.moved ? [cursor] : [])].map(point => `${point.x},${point.y}`).join(' ')} />
      </svg>
      <button type="button" className="wg-wheel-shuffle" disabled={disabled} onClick={() => { clear(); onShuffle(); }} aria-label={t('shuffle')}><Shuffle size={24} /></button>
      {letters.map((letter, index) => <button key={index} type="button" className={`wg-letter ${selected.includes(index) ? 'is-selected' : ''}`}
        data-letter-index={index} data-letter={letter} disabled={disabled} aria-pressed={selected.includes(index)}
        aria-label={t('letterLabel', { letter: displayGardenWord(letter, locale), number: index + 1 })}
        style={{ left: `${points[index].x / 3}%`, top: `${points[index].y / 3}%` }}
        onClick={event => { if (event.detail === 0 && !disabled) choose(index); }}>
        {displayGardenWord(letter, locale)}
      </button>)}
    </div>
    <div className="wg-wheel-caption">{t('clickShort')}</div>
  </div>;
}
