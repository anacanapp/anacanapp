// Story illustrations: flat SVG drawn in code (static, our own markup; colours come from story themes).
/* eslint-disable max-len */

const eyes = (cx: number, cy: number, gap = 70, s = 1, look = 6) => [cx - gap / 2, cx + gap / 2].map((x: number) =>
  `<ellipse cx="${x}" cy="${cy}" rx="${28*s}" ry="${17*s}" fill="#fff"/><ellipse cx="${x + look}" cy="${cy + 2}" rx="${12*s}" ry="${13*s}" fill="#111"/>`).join('');
const spark = (x: number, y: number, r: number, c: string) => `<path d="M${x} ${y-r}C${x+r*.18} ${y-r*.18} ${x+r*.18} ${y-r*.18} ${x+r} ${y}C${x+r*.18} ${y+r*.18} ${x+r*.18} ${y+r*.18} ${x} ${y+r}C${x-r*.18} ${y+r*.18} ${x-r*.18} ${y+r*.18} ${x-r} ${y}C${x-r*.18} ${y-r*.18} ${x-r*.18} ${y-r*.18} ${x} ${y-r}Z" fill="${c}"/>`;
const ILL: Record<string, (c: string, a: string) => string> = {
  blob: (c: string, a: string) => `<svg viewBox="0 0 360 230">${spark(60,40,14,a)}${spark(300,70,9,a)}${spark(270,24,6,a)}
    <path d="M40 230C40 140 100 92 180 92S320 140 320 230Z" fill="${c}"/><path d="M150 100C138 60 160 40 178 62C186 30 222 38 210 84Z" fill="${c}"/>${eyes(180,168,92,1.1)}</svg>`,
  fruit: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(56,70,13,a)}${spark(310,40,9,a)}
    <circle cx="180" cy="150" r="96" fill="${c}"/><circle cx="148" cy="118" r="22" fill="#fff" opacity=".25"/>
    <path d="M182 56C184 34 196 22 214 18C212 38 202 52 182 56Z" fill="${a}"/><rect x="176" y="40" width="8" height="24" rx="4" fill="#2B1B17"/>${eyes(180,160,64,.8)}</svg>`,
  moon: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(70,60,12,a)}${spark(290,40,8,a)}${spark(300,150,6,a)}${spark(48,170,7,a)}
    <path d="M220 40A110 110 0 1 0 290 200A90 90 0 1 1 220 40Z" fill="${c}"/>
    <path d="M140 150q14 12 28 0M188 150q14 12 28 0" stroke="#111" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`,
  heart: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(60,56,12,a)}${spark(304,72,9,a)}
    <path d="M180 226C80 160 60 118 60 90C60 56 86 34 118 34C146 34 166 50 180 72C194 50 214 34 242 34C274 34 300 56 300 90C300 118 280 160 180 226Z" fill="${c}"/>
    <path d="M78 120H140L156 92L178 150L196 110L210 120H282" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  drop: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(70,80,12,a)}${spark(296,52,9,a)}
    <path d="M180 20C180 20 96 116 96 168C96 214 134 246 180 246S264 214 264 168C264 116 180 20 180 20Z" fill="${c}"/>
    <path d="M136 168c0 20 12 34 30 40" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" opacity=".55"/>${eyes(180,178,60,.75,0)}</svg>`,
  cycle: (c: string, a: string) => { const seg = Array.from({length: 28}, (_: unknown, i: number) => { const ang = (i / 28) * Math.PI * 2 - Math.PI / 2, r = 92;
      const x = 180 + Math.cos(ang) * r, y = 140 + Math.sin(ang) * r;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i < 5 ? 11 : 7}" fill="${i < 5 ? c : a}" opacity="${i < 5 ? 1 : (i > 11 && i < 17 ? 1 : .45)}"/>`; }).join('');
    return `<svg viewBox="0 0 360 250">${seg}<circle cx="180" cy="140" r="54" fill="${c}"/>${eyes(180,140,42,.55,0)}</svg>`; },
  bowl: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(64,58,12,a)}${spark(300,44,9,a)}
    <circle cx="150" cy="104" r="26" fill="${a}"/><circle cx="196" cy="96" r="30" fill="#FFB199"/><circle cx="226" cy="118" r="20" fill="${a}" opacity=".7"/>
    <path d="M70 120H290C290 186 240 226 180 226S70 186 70 120Z" fill="${c}"/><rect x="60" y="112" width="240" height="18" rx="9" fill="${c}"/>${eyes(180,172,66,.7)}</svg>`,
  shield: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(70,64,12,a)}${spark(292,48,9,a)}
    <path d="M180 18L282 56V122C282 182 236 222 180 240C124 222 78 182 78 122V56Z" fill="${c}"/>
    <rect x="170" y="70" width="20" height="86" rx="10" fill="#fff"/><circle cx="180" cy="186" r="12" fill="#fff"/></svg>`,
  chat: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(52,48,11,a)}${spark(312,140,8,a)}
    <rect x="44" y="40" width="200" height="110" rx="38" fill="${c}"/><path d="M90 140L76 186L130 148Z" fill="${c}"/>
    <rect x="150" y="120" width="170" height="92" rx="34" fill="${a}"/><path d="M280 200L300 236L250 206Z" fill="${a}"/>
    <circle cx="104" cy="96" r="10" fill="#fff"/><circle cx="144" cy="96" r="10" fill="#fff"/><circle cx="184" cy="96" r="10" fill="#fff"/></svg>`,
  doc: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(62,60,12,a)}${spark(300,70,9,a)}
    <rect x="104" y="24" width="152" height="206" rx="20" fill="#fff"/><rect x="104" y="24" width="152" height="54" rx="20" fill="${c}"/>
    <rect x="128" y="100" width="104" height="12" rx="6" fill="${c}" opacity=".35"/><rect x="128" y="126" width="80" height="12" rx="6" fill="${c}" opacity=".35"/>
    <path d="M128 174l18 18 34-36" stroke="${c}" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  feet: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(300,50,11,a)}${spark(50,190,8,a)}
    <g transform="rotate(-14 130 140)"><ellipse cx="130" cy="150" rx="40" ry="62" fill="${c}"/>${[0,1,2,3,4].map((i: number)=>`<circle cx="${100+i*15}" cy="${78-Math.abs(2-i)*4}" r="${10-i*.8}" fill="${c}"/>`).join('')}</g>
    <g transform="rotate(14 240 120)"><ellipse cx="240" cy="130" rx="34" ry="54" fill="${a}"/>${[0,1,2,3,4].map((i: number)=>`<circle cx="${214+i*13}" cy="${68-Math.abs(2-i)*3.5}" r="${8.5-i*.7}" fill="${a}"/>`).join('')}</g></svg>`,
  baby: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(60,52,12,a)}${spark(304,60,9,a)}
    <circle cx="180" cy="150" r="98" fill="${c}"/><path d="M164 56c4-22 30-26 34-6" stroke="${c}" stroke-width="12" fill="none" stroke-linecap="round"/>
    <circle cx="130" cy="176" r="16" fill="#FF9AA2" opacity=".7"/><circle cx="230" cy="176" r="16" fill="#FF9AA2" opacity=".7"/>
    <path d="M150 146q10-12 20 0M190 146q10-12 20 0" stroke="#111" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M164 184q16 14 32 0" stroke="#111" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`,
  pill: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(64,56,12,a)}${spark(300,64,9,a)}
    <g transform="rotate(-30 180 140)"><rect x="90" y="100" width="180" height="80" rx="40" fill="${c}"/><path d="M180 100H230A40 40 0 0 1 230 180H180Z" fill="#fff"/></g>${eyes(160,150,50,.6,0)}</svg>`,
  bag: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(60,60,12,a)}${spark(300,52,9,a)}
    <path d="M140 70V54a20 20 0 0 1 20-20h40a20 20 0 0 1 20 20v16" stroke="${a}" stroke-width="12" fill="none"/>
    <rect x="80" y="70" width="200" height="160" rx="30" fill="${c}"/><rect x="80" y="120" width="200" height="16" fill="#fff" opacity=".35"/>${eyes(180,180,64,.7)}</svg>`,
  cup: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(70,60,12,a)}${spark(300,50,9,a)}
    <path d="M150 40c-10 14 10 22 0 36M190 40c-10 14 10 22 0 36" stroke="${a}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M96 96H256V170A60 60 0 0 1 196 230H156A60 60 0 0 1 96 170Z" fill="${c}"/><path d="M256 116h18a30 30 0 0 1 0 60h-22" stroke="${c}" stroke-width="16" fill="none"/>${eyes(176,160,60,.7)}</svg>`,
  clock: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(60,60,12,a)}${spark(304,60,9,a)}
    <circle cx="180" cy="135" r="100" fill="${c}"/><circle cx="180" cy="135" r="78" fill="#fff" opacity=".9"/>
    <path d="M180 135V85M180 135l34 22" stroke="#111" stroke-width="10" stroke-linecap="round"/><circle cx="180" cy="135" r="8" fill="${a}"/></svg>`,
  bottle: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(70,64,12,a)}${spark(296,48,9,a)}
    <rect x="160" y="16" width="40" height="34" rx="16" fill="${a}"/><rect x="146" y="46" width="68" height="20" rx="8" fill="#fff"/>
    <rect x="128" y="62" width="104" height="176" rx="40" fill="${c}"/><rect x="128" y="150" width="104" height="88" rx="40" fill="#fff" opacity=".35"/>${eyes(180,120,48,.55,0)}</svg>`,
  thermo: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(72,60,12,a)}${spark(296,70,9,a)}
    <rect x="156" y="20" width="48" height="160" rx="24" fill="#fff"/><rect x="168" y="70" width="24" height="120" rx="12" fill="${c}"/>
    <circle cx="180" cy="196" r="40" fill="${c}"/>${eyes(180,196,34,.42,0)}</svg>`,
  tooth: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(64,56,12,a)}${spark(300,64,9,a)}
    <path d="M120 70C120 30 170 40 180 56C190 40 240 30 240 70C240 120 230 150 222 200C218 228 196 228 192 200L186 160H174L168 200C164 228 142 228 138 200C130 150 120 120 120 70Z" fill="#fff"/>
    <ellipse cx="148" cy="118" rx="14" ry="10" fill="${c}" opacity=".35"/>${eyes(180,100,44,.5,0)}</svg>`,
  sun: (c: string, a: string) => `<svg viewBox="0 0 360 250"><g fill="${a}">${Array.from({length:12},(_: unknown, i: number)=>{return `<rect x="174" y="14" width="12" height="40" rx="6" transform="rotate(${i*30} 180 140)"/>`;}).join('')}</g>
    <circle cx="180" cy="140" r="72" fill="${c}"/>${eyes(180,140,52,.6,0)}<path d="M160 168q20 16 40 0" stroke="#111" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`,
  book: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(60,56,12,a)}${spark(304,60,9,a)}
    <path d="M180 70C150 50 110 46 70 54V214C110 206 150 210 180 230Z" fill="${c}"/><path d="M180 70C210 50 250 46 290 54V214C250 206 210 210 180 230Z" fill="${a}"/>
    <path d="M96 96h56M96 126h56M208 96h56M208 126h56" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".7"/></svg>`,
  car: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(60,56,12,a)}${spark(304,52,9,a)}
    <path d="M110 40H210A40 40 0 0 1 250 80V200H110A30 30 0 0 1 80 170V70A30 30 0 0 1 110 40Z" fill="${c}"/>
    <rect x="104" y="64" width="116" height="104" rx="26" fill="#fff" opacity=".35"/><path d="M134 92V190M190 92V190" stroke="${a}" stroke-width="10" stroke-linecap="round"/>
    ${eyes(162,120,48,.55,0)}<rect x="96" y="200" width="168" height="18" rx="9" fill="${a}"/></svg>`,
  phone: (c: string, a: string) => `<svg viewBox="0 0 360 250">${spark(64,60,12,a)}${spark(300,52,9,a)}
    <rect x="124" y="20" width="112" height="216" rx="26" fill="${c}"/><rect x="136" y="44" width="88" height="150" rx="12" fill="#fff" opacity=".9"/>
    <path d="M150 90L210 150M210 90L150 150" stroke="${a}" stroke-width="12" stroke-linecap="round"/></svg>`,
};

export const illustration = (name: string, c: string, a: string): string => (ILL[name] || ILL.blob)(c, a);
export const ILLUSTRATION_NAMES = Object.keys(ILL);
