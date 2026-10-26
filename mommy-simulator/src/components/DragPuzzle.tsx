import { useRef, useState } from 'react';
import { copy } from '../game/copy';
import { text, t } from '../game/i18n';
import type { Copy, Language } from '../game/types';
import { audio } from '../game/audio';
import { Icon } from './Icon';

export interface PuzzlePiece { id: string; title: string; icon: string; x: number; y: number; w: number; h: number; colour: string; rotation?: number }

export function DragPuzzle({ pieces, title, description, language, onFinish, variant = 'bag' }: {
  pieces: PuzzlePiece[]; title: Copy; description: Copy; language: Language; onFinish(score: number): void; variant?: 'bag' | 'crib' | 'routine' | 'seat';
}) {
  const [placed, setPlaced] = useState<string[]>([]), [selected, setSelected] = useState<string | null>(null), [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [turns, setTurns] = useState<Record<string, number>>({}), [attempts, setAttempts] = useState(0), [error, setError] = useState('');
  const board = useRef<HTMLDivElement>(null), dragging = useRef<string | null>(null), last = useRef({ x: 0, y: 0 }), moved = useRef(false);
  const finishDrop = (piece: PuzzlePiece, x: number, y: number) => {
    const rect = board.current?.getBoundingClientRect(); if (!rect) return;
    const nx = (x - rect.left) / rect.width * 100, ny = (y - rect.top) / rect.height * 100;
    const inside = Math.abs(nx - piece.x - piece.w / 2) < piece.w / 2 + 3 && Math.abs(ny - piece.y - piece.h / 2) < piece.h / 2 + 3;
    const rotated = (turns[piece.id] ?? 0) % 4 === (piece.rotation ?? 0);
    if (inside && rotated) {
      const next = [...placed, piece.id]; setPlaced(next); setSelected(null); audio.sparkle();
      if (next.length === pieces.length) onFinish(Math.max(50, 100 - attempts * 5));
    } else { setAttempts(attempts + 1); setError(piece.id); setTimeout(() => setError(''), 500); }
    setDrag(null); dragging.current = null;
  };
  return <div className={`drag-puzzle puzzle-${variant}`}>
    <header className="scene-game-intro"><span className="eyebrow">{t('interactive', language)}</span><h3>{text(title, language)}</h3><p>{text(description, language)}</p></header>
    <div className="puzzle-status"><span><Icon name="check" size={15} />{placed.length} / {pieces.length}</span><small>{t('dragHint', language)}</small></div>
    <div className="puzzle-board" ref={board} data-testid="puzzle-board"><div className="puzzle-background"><Icon name={variant === 'bag' ? 'bag' : variant === 'crib' ? 'bed' : variant === 'seat' ? 'car' : 'clock'} size={110} /></div>{pieces.map(piece => <button key={piece.id} data-testid={`slot-${piece.id}`} className={`puzzle-slot ${placed.includes(piece.id) ? 'placed' : selected === piece.id ? 'active' : ''}`} style={{ left: `${piece.x}%`, top: `${piece.y}%`, width: `${piece.w}%`, height: `${piece.h}%`, '--piece-colour': piece.colour } as React.CSSProperties} onClick={() => { if (selected !== piece.id || placed.includes(piece.id)) return; const r = board.current!.getBoundingClientRect(); finishDrop(piece, r.left + (piece.x + piece.w / 2) / 100 * r.width, r.top + (piece.y + piece.h / 2) / 100 * r.height); }} aria-label={`${t('place', language)} ${piece.title}`}>
      <Icon name={placed.includes(piece.id) ? piece.icon : 'plus'} size={placed.includes(piece.id) ? 28 : 20} /><span>{piece.title}</span>{placed.includes(piece.id) && <i><Icon name="check" size={12} /></i>}
    </button>)}</div>
    <div className="puzzle-tray">{pieces.map(piece => <div className={`puzzle-piece ${placed.includes(piece.id) ? 'used' : ''} ${selected === piece.id ? 'selected' : ''} ${error === piece.id ? 'shake' : ''}`} key={piece.id} style={{ '--piece-colour': piece.colour } as React.CSSProperties}>
      <button data-testid={`piece-${piece.id}`} disabled={placed.includes(piece.id)} onPointerDown={e => { if (placed.includes(piece.id)) return; e.currentTarget.setPointerCapture(e.pointerId); dragging.current = piece.id; moved.current = false; setSelected(piece.id); last.current = { x: e.clientX, y: e.clientY }; }} onPointerMove={e => { if (dragging.current !== piece.id) return; if (Math.hypot(e.clientX - last.current.x, e.clientY - last.current.y) > 5) moved.current = true; if (moved.current) setDrag({ id: piece.id, x: e.clientX, y: e.clientY }); }} onPointerUp={e => { if (dragging.current === piece.id && moved.current) finishDrop(piece, e.clientX, e.clientY); else { dragging.current = null; setDrag(null); } }} onPointerCancel={() => { dragging.current = null; setDrag(null); }} aria-pressed={selected === piece.id}>
        <span className="puzzle-piece-icon" style={{ transform: `rotate(${(turns[piece.id] ?? 0) * 90}deg)` }}><Icon name={placed.includes(piece.id) ? 'check' : piece.icon} size={28} /></span><span>{piece.title}</span>
      </button>{piece.rotation !== undefined && !placed.includes(piece.id) && <button className="puzzle-rotate" data-testid={`rotate-${piece.id}`} aria-label={t('rotate', language)} onClick={() => setTurns({ ...turns, [piece.id]: (turns[piece.id] ?? 0) + 1 })}><Icon name="rotate" size={14} /></button>}
    </div>)}</div>
    {drag && <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}><Icon name={pieces.find(p => p.id === drag.id)!.icon} size={35} /></div>}
    <small className="puzzle-hint">{text(copy('Sürüşdür və ya əşyanı seçib uyğun yerə toxun.', 'Drag, or select an item and tap its matching place.', 'Sürükle veya eşyayı seçip uygun yerine dokun.'), language)}</small>
  </div>;
}
