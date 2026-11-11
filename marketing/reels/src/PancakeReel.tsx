import '@fontsource-variable/nunito';
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { stagger } from 'animejs';
import { useAnime, f } from './anime';
import { LottieLayer } from './LottieLayer';
import { checkMark, sparkleBurst, steam } from './lottie';
import { Banana, Bowl, Egg, Fork, Oat, OatJar, Pan, Pancake, PancakeStack, Plate, Spoon, Strips } from './art';
import { COPY, type Lang } from './copy';

// Layout: 1080x1920 Reel. Content lives between y≈260 and y≈1480 (Instagram covers the top bar and the bottom
// caption/buttons); text never sits in the right 160px where the like/share column is.
export const C = { bg: '#FFE7E1', bg2: '#FFD8CF', ink: '#2F2A28', soft: '#7A6A64', coral: '#FF5A5F', accentInk: '#9E2B2E', cream: '#FFF8F4', green: '#1F9D63' };
const display: React.CSSProperties = { fontFamily: "'Nunito Variable', 'Nunito', system-ui, sans-serif", fontWeight: 900, letterSpacing: '-0.02em', color: C.ink };
const body: React.CSSProperties = { fontFamily: "'Nunito Variable', 'Nunito', system-ui, sans-serif", fontWeight: 700, color: C.soft };

const SPARKLES = sparkleBurst();
const STEAM = steam();
const CHECK = checkMark();

export const SCENES = { hook: [0, 90], ingredients: [90, 150], s1: [240, 105], s2: [345, 105], s3: [450, 105], s4: [555, 150], s5: [705, 90], family: [795, 120], end: [915, 120] } as const;
export const TOTAL = 1035;

function Background() {
  const frame = useCurrentFrame();
  const drift = (p: number, a: number) => Math.sin(frame / 60 + p) * a;
  return <AbsoluteFill style={{ background: `linear-gradient(170deg, ${C.bg} 0%, ${C.bg2} 100%)` }}>
    <div style={{ position: 'absolute', width: 760, height: 760, borderRadius: '50%', background: '#FFF3EE', opacity: 0.7, left: -220 + drift(0, 30), top: 120 + drift(1, 40) }} />
    <div style={{ position: 'absolute', width: 620, height: 620, borderRadius: '50%', background: '#FFC9C0', opacity: 0.35, right: -200 + drift(2, 30), bottom: 160 + drift(3, 30) }} />
    {[[120, 420], [930, 300], [860, 1340], [180, 1500], [540, 220]].map(([x, y], i) =>
      <div key={i} style={{ position: 'absolute', left: x, top: y + drift(i, 14), width: 18, height: 18, borderRadius: 9, background: i % 2 ? '#FFFFFF' : '#FF9AA0', opacity: 0.6 }} />)}
  </AbsoluteFill>;
}

/** Step header: "ADDIM 2/5" pill and a two-line title that rises word by word (anime stagger). */
function StepTitle({ step, title, sub, lang }: { step: number; title: string; sub?: string; lang: Lang }) {
  const words = title.split(' ');
  const v = useAnime({ pill: { y: 40, o: 0 }, ...Object.fromEntries(words.map((_, i) => [`w${i}`, { y: 90, o: 0 }])), sub: { o: 0, y: 20 } } as Record<string, Record<string, number>>, (tl, v) => {
    tl.add(v.pill, { y: [40, 0], o: [0, 1], duration: f(10), ease: 'outBack(2)' }, 0);
    words.forEach((_, i) => tl.add(v[`w${i}`], { y: [90, 0], o: [0, 1], duration: f(14), ease: 'outExpo' }, f(4 + i * 3)));
    tl.add(v.sub, { o: [0, 1], y: [20, 0], duration: f(12), ease: 'outQuad' }, f(14));
  });
  return <div style={{ position: 'absolute', top: 290, left: 80, right: 160 }}>
    <div style={{ display: 'inline-block', padding: '10px 26px', borderRadius: 999, background: C.coral, color: '#fff', ...display, fontSize: 38, transform: `translateY(${v.pill.y}px)`, opacity: v.pill.o }}>
      {COPY[lang].step} {step}/5
    </div>
    <div style={{ ...display, fontSize: 104, lineHeight: 1.02, marginTop: 26, display: 'flex', flexWrap: 'wrap', columnGap: 26 }}>
      {words.map((w, i) => <span key={i} style={{ display: 'inline-block', transform: `translateY(${v[`w${i}`].y}px)`, opacity: v[`w${i}`].o }}>{w}</span>)}
    </div>
    {sub && <div style={{ ...body, fontSize: 46, marginTop: 18, opacity: v.sub.o, transform: `translateY(${v.sub.y}px)` }}>{sub}</div>}
  </div>;
}

/** Fades a scene out over its last frames so cuts feel like one motion. */
function SceneExit({ duration, children }: { duration: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [duration - 8, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = interpolate(frame, [duration - 8, duration], [0, -40], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ opacity: o, transform: `translateY(${y}px)` }}>{children}</AbsoluteFill>;
}

function Hook({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const v = useAnime({ l1: { s: 3, o: 0, r: -8 }, l2: { s: 3, o: 0, r: 6 }, stack: { y: -900, s: 1 }, chip: { y: 60, o: 0 }, tag: { o: 0 } }, (tl, v) => {
    tl.add(v.l1, { s: [3, 1], o: [0, 1], r: [-8, -3], duration: f(10), ease: 'outExpo' }, 0)
      .add(v.l2, { s: [3, 1], o: [0, 1], r: [6, 2], duration: f(10), ease: 'outExpo' }, f(12))
      .add(v.stack, { y: [-900, 0], duration: f(18), ease: 'outBounce' }, f(26))
      .add(v.stack, { s: [1, 1.04, 1], duration: f(30), ease: 'inOutSine' }, f(46))
      .add(v.chip, { y: [60, 0], o: [0, 1], duration: f(12), ease: 'outBack(2)' }, f(40))
      .add(v.tag, { o: [0, 1], duration: f(10) }, f(50));
  });
  return <SceneExit duration={90}>
    <div style={{ position: 'absolute', top: 300, left: 70, right: 150 }}>
      <div style={{ ...display, fontSize: 150, lineHeight: 1, transform: `scale(${v.l1.s}) rotate(${v.l1.r}deg)`, transformOrigin: 'left center', opacity: v.l1.o }}>{t.hook1}</div>
      <div style={{ ...display, fontSize: 150, lineHeight: 1.05, color: C.coral, transform: `scale(${v.l2.s}) rotate(${v.l2.r}deg)`, transformOrigin: 'left center', opacity: v.l2.o }}>{t.hook2}</div>
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 690, display: 'flex', justifyContent: 'center', transform: `translateY(${v.stack.y}px) scale(${v.stack.s})` }}>
      <PancakeStack size={620} count={5} />
    </div>
    <LottieLayer data={SPARKLES} size={760} fromFrame={40} style={{ position: 'absolute', left: 160, top: 640 }} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1330, display: 'flex', justifyContent: 'center', transform: `translateY(${v.chip.y}px)`, opacity: v.chip.o }}>
      <div style={{ ...display, fontSize: 56, background: '#fff', borderRadius: 999, padding: '20px 40px', boxShadow: '0 20px 40px -24px rgba(158,43,46,.5)' }}>
        {t.hookChip} <span style={{ letterSpacing: 0 }}>🍌🥚🌾</span>
      </div>
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1460, textAlign: 'center', ...body, fontSize: 40, opacity: v.tag.o }}>{t.hookTag}</div>
  </SceneExit>;
}

function Ingredients({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const v = useAnime({ title: { y: 60, o: 0 }, c0: { x: -900, r: -12 }, c1: { x: -900, r: -12 }, c2: { x: -900, r: -12 }, tip: { o: 0, y: 30 }, bob: { y: 0 } }, (tl, v) => {
    tl.add(v.title, { y: [60, 0], o: [0, 1], duration: f(12), ease: 'outExpo' }, 0)
      .add([v.c0, v.c1, v.c2], { x: [-900, 0], r: [-12, 0], duration: f(18), ease: 'outBack(1.4)', delay: stagger(f(10)) }, f(8))
      .add(v.tip, { o: [0, 1], y: [30, 0], duration: f(12), ease: 'outQuad' }, f(62))
      .add(v.bob, { y: [0, -10, 0], duration: f(60), ease: 'inOutSine', loop: 2 }, f(40));
  });
  const items = [
    { art: <Banana size={190} />, name: t.banana, amount: t.bananaAmt },
    { art: <Egg size={180} />, name: t.egg, amount: t.eggAmt },
    { art: <OatJar size={180} />, name: t.oats, amount: t.oatsAmt },
  ];
  return <SceneExit duration={150}>
    <div style={{ position: 'absolute', top: 300, left: 80, right: 160, ...display, fontSize: 104, transform: `translateY(${v.title.y}px)`, opacity: v.title.o }}>{t.ingredients}</div>
    {items.map((it, i) => {
      const c = v[`c${i}` as 'c0'];
      return <div key={i} style={{ position: 'absolute', left: 80, right: 160, top: 470 + i * 270, height: 240, borderRadius: 40, background: '#fff',
        display: 'flex', alignItems: 'center', gap: 34, padding: '0 40px', boxShadow: '0 26px 50px -30px rgba(158,43,46,.45)',
        transform: `translateX(${c.x}px) rotate(${c.r}deg)` }}>
        <div style={{ transform: `translateY(${i % 2 ? -v.bob.y : v.bob.y}px)` }}>{it.art}</div>
        <div><div style={{ ...display, fontSize: 64 }}>{it.name}</div><div style={{ ...body, fontSize: 44, color: C.accentInk }}>{it.amount}</div></div>
      </div>;
    })}
    <div style={{ position: 'absolute', left: 80, right: 160, top: 1300, ...body, fontSize: 42, lineHeight: 1.3, opacity: v.tip.o, transform: `translateY(${v.tip.y}px)` }}>💡 {t.oatTip}</div>
  </SceneExit>;
}

function StepMash({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const v = useAnime({ banana: { y: -500, sq: 1, o: 1 }, fork: { y: -300, r: 20, o: 0 }, bowl: { fill: 0 } }, (tl, v) => {
    tl.add(v.banana, { y: [-500, 0], duration: f(16), ease: 'outBounce' }, f(8))
      .add(v.fork, { o: [0, 1], y: [-300, -60], duration: f(10), ease: 'outQuad' }, f(26))
      .add(v.fork, { y: [-60, 20, -60, 20, -60, 20, -60], r: [20, 10, 20, 10, 20, 10, 20], duration: f(40), ease: 'inOutSine' }, f(36))
      .add(v.banana, { sq: [1, 0.25], o: [1, 0], duration: f(40), ease: 'inQuad' }, f(36))
      .add(v.bowl, { fill: [0, 0.55], duration: f(40), ease: 'outQuad' }, f(36));
  });
  return <SceneExit duration={105}>
    <StepTitle step={1} title={t.s1} sub={t.s1sub} lang={lang} />
    <div style={{ position: 'absolute', left: 90, top: 760, width: 900, transform: 'scale(1.12)', transformOrigin: 'top center' }}>
      <div style={{ position: 'absolute', left: 230, top: -40, transform: `translateY(${v.banana.y}px) scaleY(${v.banana.sq})`, transformOrigin: 'bottom center', opacity: v.banana.o }}><Banana size={320} /></div>
      <Bowl size={800} fill={v.bowl.fill} batter="#F6D776" />
      <div style={{ position: 'absolute', left: 470, top: -120, transform: `translateY(${v.fork.y}px) rotate(${v.fork.r}deg)`, opacity: v.fork.o }}><Fork size={300} /></div>
    </div>
  </SceneExit>;
}

function StepEgg({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const v = useAnime({ egg: { y: -520, crack: 0, o: 1 }, spoon: { a: 0, o: 0 }, bowl: { fill: 0.55 } }, (tl, v) => {
    tl.add(v.egg, { y: [-520, -120], duration: f(14), ease: 'outQuad' }, f(6))
      .add(v.egg, { crack: [0, 1], duration: f(14), ease: 'outExpo' }, f(24))
      .add(v.egg, { o: [1, 0], duration: f(8) }, f(42))
      .add(v.bowl, { fill: [0.55, 0.7], duration: f(14) }, f(36))
      .add(v.spoon, { o: [0, 1], duration: f(6) }, f(46))
      .add(v.spoon, { a: [0, Math.PI * 4], duration: f(50), ease: 'inOutSine' }, f(46));
  });
  const sx = Math.cos(v.spoon.a) * 120, sy = Math.sin(v.spoon.a) * 26;
  return <SceneExit duration={105}>
    <StepTitle step={2} title={t.s2} sub={t.s2sub} lang={lang} />
    <div style={{ position: 'absolute', left: 90, top: 760, width: 900, transform: 'scale(1.12)', transformOrigin: 'top center' }}>
      <div style={{ position: 'absolute', left: 260, top: -60, transform: `translateY(${v.egg.y}px)`, opacity: v.egg.o }}><Egg size={280} crack={v.egg.crack} /></div>
      <Bowl size={800} fill={v.bowl.fill} batter="#F4CF6A" />
      {/* swirl in the batter while mixing */}
      <svg width="800" height="300" style={{ position: 'absolute', left: 0, top: 120, opacity: v.spoon.o * 0.6 }}>
        <ellipse cx="400" cy="70" rx={150 + Math.sin(v.spoon.a) * 20} ry="30" fill="none" stroke="#E2B44A" strokeWidth="8" strokeDasharray="40 30" strokeDashoffset={v.spoon.a * 40} />
      </svg>
      <div style={{ position: 'absolute', left: 370 + sx, top: -110 + sy, transform: `rotate(${18 + Math.sin(v.spoon.a) * 8}deg)`, opacity: v.spoon.o }}><Spoon size={300} /></div>
    </div>
  </SceneExit>;
}

function StepOats({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const v = useAnime({ jar: { x: 300, tilt: 0, o: 0 }, pour: { p: 0 }, bowl: { fill: 0.7, thick: 0 }, note: { o: 0, s: 0.6 } }, (tl, v) => {
    tl.add(v.jar, { x: [300, 0], o: [0, 1], duration: f(14), ease: 'outBack(1.4)' }, f(4))
      .add(v.jar, { tilt: [0, -110], duration: f(14), ease: 'inOutQuad' }, f(18))
      .add(v.pour, { p: [0, 1], duration: f(44), ease: 'linear' }, f(28))
      .add(v.bowl, { fill: [0.7, 0.92], thick: [0, 1], duration: f(44) }, f(30))
      .add(v.note, { o: [0, 1], s: [0.6, 1], duration: f(14), ease: 'outBack(2.4)' }, f(74));
  });
  const batter = `rgb(${Math.round(244 - v.bowl.thick * 20)}, ${Math.round(207 - v.bowl.thick * 25)}, ${Math.round(106 - v.bowl.thick * 10)})`;
  return <SceneExit duration={105}>
    <StepTitle step={3} title={t.s3} sub={t.s3sub} lang={lang} />
    <div style={{ position: 'absolute', left: 90, top: 760, width: 900, transform: 'scale(1.12)', transformOrigin: 'top center' }}>
      <Bowl size={800} fill={v.bowl.fill} batter={batter} />
      {Array.from({ length: 16 }, (_, i) => {
        const local = (v.pour.p * 2.2 - i * 0.08);
        if (local <= 0 || local >= 1) return null;
        return <div key={i} style={{ position: 'absolute', left: 470 + ((i * 37) % 70) - local * 40, top: -200 + local * 330, transform: `rotate(${i * 50}deg)` }}><Oat size={36} light={i % 2 === 0} /></div>;
      })}
      <div style={{ position: 'absolute', left: 470, top: -300, transform: `translateX(${v.jar.x}px)`, opacity: v.jar.o }}><OatJar size={300} tilt={v.jar.tilt} /></div>
    </div>
    <div style={{ position: 'absolute', left: 80, width: 470, top: 560, opacity: v.note.o, transform: `scale(${v.note.s})`, transformOrigin: 'left center' }}>
      <div style={{ ...display, fontSize: 40, lineHeight: 1.2, background: '#fff', color: C.accentInk, borderRadius: 28, padding: '16px 26px' }}>{t.s3note}</div>
    </div>
  </SceneExit>;
}

function StepCook({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const frame = useCurrentFrame();
  const v = useAnime({ pan: { y: 400, o: 0 }, d0: { s: 0 }, d1: { s: 0 }, d2: { s: 0 }, flip: { a: 0 }, brown: { b: 0 }, timer: { o: 0, s: 0.5 } }, (tl, v) => {
    tl.add(v.pan, { y: [400, 0], o: [0, 1], duration: f(16), ease: 'outExpo' }, 0)
      .add([v.d0, v.d1, v.d2], { s: [0, 1], duration: f(16), ease: 'outElastic(1, .6)', delay: stagger(f(8)) }, f(16))
      .add(v.brown, { b: [0, 1], duration: f(40) }, f(36))
      .add(v.timer, { o: [0, 1], s: [0.5, 1], duration: f(12), ease: 'outBack(2.5)' }, f(40))
      .add(v.flip, { a: [0, 180], duration: f(18), ease: 'inOutCubic' }, f(84));
  });
  const flipped = v.flip.a > 90;
  const lift = Math.sin((v.flip.a / 180) * Math.PI) * 170;
  const seconds = Math.min(180, Math.max(0, Math.round((frame - 40) * 3.2)));
  return <SceneExit duration={150}>
    <StepTitle step={4} title={t.s4} sub={t.s4sub} lang={lang} />
    <div style={{ position: 'absolute', left: 90, top: 700, width: 900, transform: `translateY(${v.pan.y}px)`, opacity: v.pan.o }}>
      <Pan size={900}>
        {[[95, 92], [178, 128], [262, 92]].map(([x, y], i) => {
          const s = v[`d${i}` as 'd0'].s;
          const isFlip = i === 1;
          return <g key={i} transform={`translate(${x} ${y - (isFlip ? lift / 2.2 : 0)}) scale(${s} ${isFlip ? Math.abs(Math.cos((v.flip.a * Math.PI) / 180)) * s || 0.02 : s})`}>
            <foreignObject x={-55} y={-34} width="110" height="68">
              <Pancake size={110} browned={isFlip && flipped ? 1 : v.brown.b * 0.6} raw={(isFlip && flipped) ? 0 : 1 - v.brown.b} />
            </foreignObject>
          </g>;
        })}
      </Pan>
      <LottieLayer data={STEAM} size={600} fromFrame={50} speed={1} loop style={{ position: 'absolute', left: 130, top: -330, opacity: 1, filter: 'drop-shadow(0 0 10px rgba(158,43,46,.25))' }} />
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1430, display: 'flex', justifyContent: 'center', opacity: v.timer.o, transform: `scale(${v.timer.s})` }}>
      <div style={{ ...display, fontSize: 50, background: C.ink, color: '#fff', borderRadius: 999, padding: '16px 34px', fontVariantNumeric: 'tabular-nums' }}>
        ⏱ {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} · {t.s4timer}
      </div>
    </div>
  </SceneExit>;
}

function StepCut({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const v = useAnime({ cake: { o: 1, s: 1 }, knife: { x: -500, o: 1 }, strips: { o: 0, spread: 0 }, hint: { o: 0, y: 30 } }, (tl, v) => {
    tl.add(v.knife, { x: [-500, 700], duration: f(20), ease: 'inOutQuad' }, f(10))
      .add(v.knife, { o: [1, 0], duration: f(4) }, f(28))
      .add(v.cake, { o: [1, 0], duration: f(6) }, f(28))
      .add(v.strips, { o: [0, 1], duration: f(6) }, f(28))
      .add(v.strips, { spread: [0, 1], duration: f(20), ease: 'outBack(2)' }, f(30))
      .add(v.hint, { o: [0, 1], y: [30, 0], duration: f(12) }, f(46));
  });
  return <SceneExit duration={90}>
    <StepTitle step={5} title={t.s5} sub={t.s5sub} lang={lang} />
    <div style={{ position: 'absolute', left: 90, top: 760, width: 900 }}>
      <Plate size={900} />
      <div style={{ position: 'absolute', left: 230, top: 140, opacity: v.cake.o }}><Pancake size={440} /></div>
      <div style={{ position: 'absolute', left: 190, top: 90, opacity: v.strips.o }}><Strips size={520} spread={v.strips.spread} /></div>
      <div style={{ position: 'absolute', left: v.knife.x, top: 150, width: 380, height: 26, borderRadius: 13, background: 'linear-gradient(90deg,#CFC9C5,#F2EFED)', transform: 'rotate(90deg)', transformOrigin: 'left center', opacity: v.knife.o }} />
    </div>
    <div style={{ position: 'absolute', left: 80, right: 160, top: 1330, ...body, fontSize: 44, opacity: v.hint.o, transform: `translateY(${v.hint.y}px)` }}>👶 {t.s5hint}</div>
  </SceneExit>;
}

function Family({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const v = useAnime({ title: { o: 0, y: 60 }, p0: { y: 500 }, p1: { y: 500 }, b0: { x: 400, o: 0 }, b1: { x: 400, o: 0 }, b2: { x: 400, o: 0 } }, (tl, v) => {
    tl.add(v.title, { o: [0, 1], y: [60, 0], duration: f(12), ease: 'outExpo' }, 0)
      .add([v.p0, v.p1], { y: [500, 0], duration: f(18), ease: 'outBack(1.3)', delay: stagger(f(8)) }, f(8))
      .add([v.b0, v.b1, v.b2], { x: [400, 0], o: [0, 1], duration: f(14), ease: 'outExpo', delay: stagger(f(7)) }, f(36));
  });
  const badges = [['🍌', t.b1], ['🥚', t.b2], ['🌾', t.b3]];
  return <SceneExit duration={120}>
    <div style={{ position: 'absolute', top: 290, left: 80, right: 160, ...display, fontSize: 96, lineHeight: 1.04, opacity: v.title.o, transform: `translateY(${v.title.y}px)` }}>{t.family}</div>
    <div style={{ position: 'absolute', left: 40, top: 640, transform: `translateY(${v.p0.y}px)` }}>
      <Plate size={520}><foreignObject x="70" y="40" width="160" height="110"><Strips size={160} /></foreignObject></Plate>
      <div style={{ ...display, fontSize: 42, textAlign: 'center', marginTop: -118 }}>{t.forBaby}</div>
    </div>
    <div style={{ position: 'absolute', left: 520, top: 600, transform: `translateY(${v.p1.y}px)` }}>
      <Plate size={520}><foreignObject x="70" y="-10" width="160" height="170"><PancakeStack size={160} count={3} /></foreignObject></Plate>
      <div style={{ ...display, fontSize: 42, textAlign: 'center', marginTop: -118 }}>{t.forMom}</div>
    </div>
    {badges.map(([icon, text], i) => {
      const b = v[`b${i}` as 'b0'];
      return <div key={i} style={{ position: 'absolute', left: 80, right: 160, top: 1150 + i * 112, display: 'flex', alignItems: 'center', gap: 20,
        background: '#fff', borderRadius: 30, padding: '16px 28px', transform: `translateX(${b.x}px)`, opacity: b.o }}>
        <span style={{ fontSize: 50 }}>{icon}</span><span style={{ ...display, fontSize: 42, fontWeight: 800 }}>{text}</span>
      </div>;
    })}
  </SceneExit>;
}

function End({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const v = useAnime({ title: { o: 0, y: 40 }, cta: { o: 0, s: 0.7 }, logo: { s: 0, r: -30 } }, (tl, v) => {
    tl.add(v.title, { o: [0, 1], y: [40, 0], duration: f(10) }, 0)
      .add(v.logo, { s: [0, 1], r: [-30, 0], duration: f(18), ease: 'outElastic(1, .55)' }, f(56))
      .add(v.cta, { o: [0, 1], s: [0.7, 1], duration: f(14), ease: 'outBack(2)' }, f(62));
  });
  return <AbsoluteFill>
    <div style={{ position: 'absolute', top: 290, left: 80, right: 160, ...display, fontSize: 84, opacity: v.title.o, transform: `translateY(${v.title.y}px)` }}>{t.safetyTitle}</div>
    {t.safety.map((s, i) => <div key={i} style={{ position: 'absolute', left: 80, right: 160, top: 470 + i * 150, display: 'flex', alignItems: 'center', gap: 26 }}>
      <LottieLayer data={CHECK} size={110} fromFrame={8 + i * 12} />
      <span style={{ ...display, fontSize: 46, fontWeight: 800, lineHeight: 1.15 }}>{s}</span>
    </div>)}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
      <Img src={staticFile('brand-mark.png')} style={{ width: 190, height: 190, objectFit: 'contain', transform: `scale(${v.logo.s}) rotate(${v.logo.r}deg)` }} />
      <div style={{ ...display, fontSize: 56, background: C.coral, color: '#fff', borderRadius: 999, padding: '22px 46px', opacity: v.cta.o, transform: `scale(${v.cta.s})`, textAlign: 'center' }}>{t.cta}</div>
      <div style={{ ...body, fontSize: 38, opacity: v.cta.o }}>{t.save}</div>
    </div>
    <LottieLayer data={SPARKLES} size={700} fromFrame={60} style={{ position: 'absolute', left: 190, top: 820 }} />
  </AbsoluteFill>;
}

/** Thin progress line across the top: tells viewers how far into the recipe they are (helps watch-through). */
function Progress() {
  const frame = useCurrentFrame();
  return <div style={{ position: 'absolute', left: 80, right: 80, top: 230, height: 10, borderRadius: 5, background: 'rgba(47,42,40,.1)' }}>
    <div style={{ width: `${(frame / TOTAL) * 100}%`, height: '100%', borderRadius: 5, background: C.coral }} />
  </div>;
}

export function PancakeReel({ lang = 'az' }: { lang?: Lang }) {
  const S = SCENES;
  const seq = (k: keyof typeof SCENES, el: React.ReactNode) => <Sequence from={S[k][0]} durationInFrames={S[k][1]} layout="none"><AbsoluteFill>{el}</AbsoluteFill></Sequence>;
  return <AbsoluteFill style={{ background: C.bg }}>
    <Background />
    {seq('hook', <Hook lang={lang} />)}
    {seq('ingredients', <Ingredients lang={lang} />)}
    {seq('s1', <StepMash lang={lang} />)}
    {seq('s2', <StepEgg lang={lang} />)}
    {seq('s3', <StepOats lang={lang} />)}
    {seq('s4', <StepCook lang={lang} />)}
    {seq('s5', <StepCut lang={lang} />)}
    {seq('family', <Family lang={lang} />)}
    {seq('end', <End lang={lang} />)}
    <Progress />
  </AbsoluteFill>;
}
