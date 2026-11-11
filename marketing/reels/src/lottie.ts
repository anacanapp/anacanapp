// Hand-authored Lottie animations (no third-party assets): sparkle burst, rising steam, drawn check mark.
// Built as plain Lottie JSON and played by dotLottie.

type V = number[];
const still = (k: unknown) => ({ a: 0, k });
const kf = (frames: [number, V][], ease: [number, number, number, number] = [0.33, 0, 0.2, 1]) => ({
  a: 1,
  k: frames.map(([t, s], i) => (i < frames.length - 1
    ? { t, s, o: { x: [ease[0]], y: [ease[1]] }, i: { x: [ease[2]], y: [ease[3]] } }
    : { t, s })),
});
const transform = (extra: Record<string, unknown> = {}) => ({
  ty: 'tr', p: still([0, 0]), a: still([0, 0]), s: still([100, 100]), r: still(0), o: still(100), sk: still(0), sa: still(0), ...extra,
});
const layer = (ind: number, nm: string, shapes: unknown[], ks: Record<string, unknown>, op: number, ip = 0) => ({
  ddd: 0, ind, ty: 4, nm, sr: 1, ao: 0, ip, op, st: 0, bm: 0, shapes,
  ks: { o: still(100), r: still(0), p: still([0, 0, 0]), a: still([0, 0, 0]), s: still([100, 100, 100]), ...ks },
});
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).concat(1);
const doc = (nm: string, w: number, h: number, op: number, layers: unknown[]) =>
  ({ v: '5.7.4', fr: 30, ip: 0, op, w, h, nm, ddd: 0, assets: [], layers });

// Four-point star path centred on 0,0.
const star = (r: number) => {
  const q = r * 0.22;
  return { ty: 'sh', ks: still({ c: true, i: Array(8).fill([0, 0]), o: Array(8).fill([0, 0]),
    v: [[0, -r], [q, -q], [r, 0], [q, q], [0, r], [-q, q], [-r, 0], [-q, -q]] }) };
};

/** Sparkles that pop around the centre (45 frames). */
export function sparkleBurst(colors = ['#FF5A5F', '#FFC94D', '#FFFFFF', '#FF9AA0']) {
  const W = 600, op = 45;
  const layers = Array.from({ length: 10 }, (_, i) => {
    const ang = (i / 10) * Math.PI * 2 + (i % 2) * 0.3;
    const dist = 170 + (i % 3) * 45;
    const delay = (i % 4) * 3;
    const r = 18 + (i % 3) * 9;
    const to = [W / 2 + Math.cos(ang) * dist, W / 2 + Math.sin(ang) * dist, 0];
    return layer(i + 1, `s${i}`, [{ ty: 'gr', it: [star(r), { ty: 'fl', c: still(rgb(colors[i % colors.length])), o: still(100), r: 1 }, transform()] }], {
      p: kf([[delay, [W / 2, W / 2, 0]], [delay + 22, to]]),
      s: kf([[delay, [0, 0, 100]], [delay + 10, [120, 120, 100]], [delay + 30, [0, 0, 100]]]),
      r: kf([[delay, [0]], [delay + 30, [90]]]),
    }, op);
  });
  return doc('sparkles', W, W, op, layers);
}

/** Three steam wisps rising and fading (60 frames, loops cleanly). */
export function steam(color = '#FFFFFF') {
  const W = 400, op = 60;
  const wisp = (x: number) => ({ ty: 'sh', ks: still({ c: false,
    v: [[x, 330], [x + 22, 260], [x - 18, 190], [x + 14, 110]],
    i: [[0, 0], [-18, 26], [18, 26], [-14, 24]], o: [[18, -26], [-18, -26], [14, -26], [0, 0]] }) });
  const layers = [-90, 0, 90].map((dx, i) => layer(i + 1, `w${i}`, [{ ty: 'gr', it: [
    wisp(W / 2 + dx),
    { ty: 'st', c: still(rgb(color)), o: still(100), w: still(22), lc: 2, lj: 2 },
    { ty: 'tm', s: kf([[i * 6, [0]], [i * 6 + 40, [100]]]), e: kf([[i * 6, [0]], [i * 6 + 26, [100]]]), o: still(0), m: 1 },
    transform(),
  ] }], { o: kf([[i * 6, [0]], [i * 6 + 8, [90]], [i * 6 + 40, [0]]]), p: kf([[i * 6, [0, 20, 0]], [i * 6 + 40, [0, -30, 0]]]) }, op));
  return doc('steam', W, W, op, layers);
}

/** Green check mark drawn inside a circle (24 frames). */
export function checkMark() {
  const W = 120, op = 24;
  const circle = { ty: 'el', p: still([60, 60]), s: still([100, 100]) };
  const tick = { ty: 'sh', ks: still({ c: false, v: [[36, 62], [53, 78], [86, 44]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]] }) };
  return doc('check', W, W, op, [
    layer(1, 'tick', [{ ty: 'gr', it: [tick, { ty: 'st', c: still(rgb('#FFFFFF')), o: still(100), w: still(12), lc: 2, lj: 2 },
      { ty: 'tm', s: still(0), e: kf([[6, [0]], [20, [100]]]), o: still(0), m: 1 }, transform()] }], {}, op),
    layer(2, 'disc', [{ ty: 'gr', it: [circle, { ty: 'fl', c: still(rgb('#1F9D63')), o: still(100), r: 1 }, transform()] }],
      { a: still([60, 60, 0]), p: still([60, 60, 0]), s: kf([[0, [0, 0, 100]], [8, [112, 112, 100]], [12, [100, 100, 100]]]) }, op),
  ]);
}
