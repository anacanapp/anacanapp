import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Check, Leaf } from 'lucide-react';
import { cellKey, type GardenRound, type WordGardenLevel } from './model';
import { visibleGardenCells } from './state';
import { displayGardenWord } from './lexicon';
import type { GardenText } from './useGardenText';

export default function CrosswordBoard({ level, round, locale, t, disabled, hintReady, onHint, recentWord }: {
  level: WordGardenLevel; round: GardenRound; locale: string; t: GardenText; disabled: boolean; hintReady: boolean;
  onHint: (key: string) => void; recentWord: string | null;
}) {
  const visible = useMemo(() => visibleGardenCells(level, round), [level, round]);
  const region = useRef<HTMLDivElement>(null), [width, setWidth] = useState<number | null>(null);
  const [focusedWord, setFocusedWord] = useState<string | null>(null);
  useEffect(() => {
    const measure = () => {
      const parent = region.current;
      if (!parent || !parent.clientWidth || !parent.clientHeight) return;
      const available = Math.max(60, parent.clientHeight - 10);
      setWidth(Math.floor(Math.min(parent.clientWidth - 10, available * level.columns / level.rows, level.columns * 54)));
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (region.current) observer?.observe(region.current);
    measure(); window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [level.rows, level.columns]);
  const starts = useMemo(() => new Map(level.words.map((word, index) => [cellKey(word), index + 1])), [level]);
  const found = new Set(round.found);
  return <div className="wg-crossword-region">
    <div className="wg-crossword-space" ref={region}>
    <div className={`wg-crossword ${hintReady ? 'is-hinting' : ''}`} role="group" aria-label={t('boardLabel')}
      style={{ '--wg-columns': level.columns, '--wg-rows': level.rows,
        ...(width ? { width, '--wg-cell-font': `${Math.max(12, Math.min(28, (width / level.columns - 4) * .54))}px` } : {}) } as CSSProperties} data-testid="wordgarden-board">
      {level.cells.map(cell => {
        const key = cellKey(cell), known = visible.has(key), complete = cell.wordIds.some(id => found.has(id));
        const justFound = !!recentWord && cell.wordIds.includes(recentWord);
        return <button type="button" key={key} data-garden-cell={key} data-revealed={known} className={`wg-cell ${complete ? 'is-found' : known ? 'is-revealed' : ''} ${justFound ? 'just-found' : ''} ${focusedWord && cell.wordIds.includes(focusedWord) ? 'is-focused' : ''}`}
          disabled={!hintReady || known} style={{ gridRow: cell.row + 1, gridColumn: cell.column + 1 }}
          aria-label={known ? t('revealedCell', { letter: displayGardenWord(cell.letter, locale), row: cell.row + 1, column: cell.column + 1 })
            : t('hiddenCell', { row: cell.row + 1, column: cell.column + 1 })} onClick={() => onHint(key)}>
          {starts.has(key) && <small>{starts.get(key)}</small>}
          <span>{known ? displayGardenWord(cell.letter, locale) : ''}</span>
          {!known && hintReady && <Leaf size={12} className="wg-cell-hint" />}
        </button>;
      })}
    </div>
    </div>
    <div className="wg-word-dots" aria-label={t('foundWords')}>{level.words.map((word, index) => <button type="button" key={word.id}
      disabled={disabled} className={`${found.has(word.id) ? 'is-found' : ''} ${focusedWord === word.id ? 'is-focused' : ''}`}
      aria-pressed={focusedWord === word.id} aria-label={found.has(word.id) ? displayGardenWord(word.word, locale) : t('wordLabel', { number: index + 1, length: word.letters.length })}
      title={t('letterCount', { count: word.letters.length })}
      onClick={() => setFocusedWord(value => value === word.id ? null : word.id)}>
      {found.has(word.id) ? <Check size={12} /> : <i>{index + 1}</i>}<span>{word.letters.length}</span>
    </button>)}</div>
  </div>;
}
