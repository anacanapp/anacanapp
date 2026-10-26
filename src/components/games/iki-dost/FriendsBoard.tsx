import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Home, KeyRound, LockKeyhole, Check, CircleDot, Waves } from 'lucide-react';
import { FRIEND_NAMES, friendCell, friendPosition, type FriendsLevel, type FriendsState, type FriendDirection } from './model';
import { friendsAtHome, friendsDoorOpen, friendsPlateMask } from './engine';
import type { FriendsText } from './useFriendsText';
import { FRIENDS_ART } from './art';
export default function FriendsBoard({ level, state, t, number, disabled, onDirection }: {
  level: FriendsLevel; state: FriendsState; t: FriendsText; number: (value: number) => string; disabled: boolean; onDirection: (direction: FriendDirection) => void;
}) {
  const region = useRef<HTMLDivElement>(null), start = useRef<{ id: number; x: number; y: number } | null>(null), [cellSize, setCellSize] = useState(38);
  const plates = friendsPlateMask(level, state), home = friendsAtHome(level, state);
  const columns = level.worlds[0].rows[0].length, rows = level.worlds[0].rows.length;
  useEffect(() => {
    const measure = () => {
      const el = region.current; if (!el?.clientWidth || !el.clientHeight) return;
      const landscape = innerWidth >= 600 && innerHeight <= 600;
      const short = innerHeight <= 610 && !landscape;
      setCellSize(Math.floor(Math.max(18, Math.min(55, (el.clientWidth - (landscape ? 32 : 24)) / (columns * (landscape ? 2 : 1)),
        (el.clientHeight - (landscape ? 47 : short ? 84 : 110)) / (rows * (landscape ? 1 : 2))))));
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (region.current) observer?.observe(region.current); measure(); window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [columns, rows]);
  const gesture = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !start.current || start.current.id !== event.pointerId) return;
    const dx = event.clientX - start.current.x, dy = event.clientY - start.current.y; start.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    onDirection(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up');
  };
  return <div className="tf-boards" ref={region} data-testid="friends-boards" dir="ltr" style={{ '--tf-cell': `${cellSize}px` } as CSSProperties}
    onPointerDown={event => { if (!disabled && event.button === 0 && event.isPrimary !== false) { start.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture?.(event.pointerId); } }}
    onPointerUp={gesture} onPointerCancel={() => { start.current = null; }}>
    {level.worlds.map((world, side) => {
      const actor = friendPosition(world, state.positions[side]), name = FRIEND_NAMES[side];
      return <section className={`tf-world tf-world-${side}`} key={side} aria-label={name} data-friend-side={side}>
        <div className="tf-world-label"><span><img src={FRIENDS_ART[side]} width="30" height="30" alt="" />{name}</span><small className={home[side] ? 'is-home' : ''}>{home[side] ? <Check size={12} /> : <Home size={12} />}{t(home[side] ? 'home' : 'journey')}</small></div>
        <div className="tf-grid" style={{ width: columns * cellSize, height: rows * cellSize }} data-testid={`friends-board-${side}`}>
          {world.rows.flatMap((row, r) => [...row].map((tile, c) => {
            const position = r * columns + c, held = state.positions[side] === position;
            const keyGone = tile === 'k' && !!(state.keys & 1) || tile === 'l' && !!(state.keys & 2);
            const open = friendsDoorOpen(tile, state, plates), channel = ['l', 'L', 'b', 'B'].includes(tile) ? 2 : 1;
            return <div key={position} className={`tf-tile tf-tile-${tile === '#' ? 'rock' : tile === '!' ? 'water' : tile === 'H' ? 'home' : 'path'} ${['A', 'B', 'K', 'L'].includes(tile) ? `tf-gate ${open ? 'is-open' : ''}` : ''} ${['a', 'b'].includes(tile) && held ? 'is-held' : ''}`}
              style={{ left: c * cellSize, top: r * cellSize }} data-tile={tile} data-position={position}>
              {tile === 'H' && <Home className="tf-home-icon" size={Math.max(16, cellSize * .62)} />}
              {tile === '!' && <Waves size={Math.max(12, cellSize * .5)} />}
              {['k', 'l'].includes(tile) && !keyGone && <><KeyRound size={Math.max(13, cellSize * .48)} /><small>{number(channel)}</small></>}
              {['K', 'L'].includes(tile) && <><LockKeyhole size={Math.max(13, cellSize * .48)} /><small>{number(channel)}</small></>}
              {['a', 'b', 'A', 'B'].includes(tile) && <><CircleDot size={Math.max(13, cellSize * .48)} /><small>{number(channel)}</small></>}
            </div>;
          }))}
          <div className={`tf-actor ${home[side] ? 'is-home' : ''} ${friendCell(world, state.positions[side]) === '!' ? 'is-lost' : ''}`}
            data-friend-position={state.positions[side]} style={{ left: actor.column * cellSize, top: actor.row * cellSize }}>
            <img src={FRIENDS_ART[side]} alt={name} width="512" height="512" draggable={false} />
          </div>
        </div>
      </section>;
    })}
  </div>;
}
