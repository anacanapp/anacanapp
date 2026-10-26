import { useEffect, useRef, useState } from 'react';
import { defaultLook } from '../game/cosmetics';
import type { PlayerLook } from '../game/cosmetics';
import { GameSimulation } from '../game/simulation';
import type { PhaserArena } from '../game/phaser-arena';
import { prepareLogoImage } from '../game/logo-art';

/** The lobby previews the actual Phaser arena and selected company appearance. */
export function ArenaPreview({ color = '#b9ff6b', look = defaultLook() }: { color?: string; look?: PlayerLook }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let disposed = false; let engine: PhaserArena | undefined;
    const game = new GameSimulation({ name: 'YOUR STARTUP', seed: 1862, color, look });
    game.player.x = 180; game.player.y = 220;
    for (const bot of game.bots) bot.alive = false;
    for (const [index, id] of [7, 12].entries()) {
      const bot = game.bots[id]; bot.alive = true; bot.mass = index ? 65 : 27;
      bot.radius = index ? 58 : 38; bot.x = game.player.x + (index ? -260 : 350); bot.y = game.player.y + (index ? -270 : -75);
    }
    setReady(false);
    void Promise.all([import('../game/phaser-arena'), prepareLogoImage(look)]).then(([{ createPhaserArena }]) => {
      if (disposed || !host.current) return;
      engine = createPhaserArena(host.current, { simulation: game, details: true, preview: true, input: () => ({ x: 0, y: 0, boost: false }), onEvent: () => undefined, onSnapshot: () => undefined, onSuspend: () => undefined, onReady: () => setReady(true) });
    });
    return () => { disposed = true; engine?.destroy(); };
  }, [color, look.logo, look.frame, look.trail, look.monogram, look.customImage]);
  return <div className={`arena-preview-phaser ${ready ? 'ready' : ''}`} ref={host} aria-hidden="true" />;
}
