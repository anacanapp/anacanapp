import { useId } from 'react';

/** Original SVG artwork: light enough for an offline WebView and independent of
 * external image CDNs. Themes use the same artwork with their own palette. */
export default function GardenScenery() {
  const id = useId().replace(/:/g, '');
  return <div className="wg-scenery" aria-hidden="true">
    <svg viewBox="0 0 1000 1200" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor="var(--wg-sky-top)" /><stop offset="1" stopColor="var(--wg-sky-bottom)" /></linearGradient>
        <linearGradient id={`${id}-water`} x2="0" y2="1"><stop stopColor="var(--wg-water-top)" /><stop offset="1" stopColor="var(--wg-water-bottom)" /></linearGradient>
        <radialGradient id={`${id}-sun`}><stop stopColor="var(--wg-sun)" stopOpacity=".9" /><stop offset="1" stopColor="var(--wg-sun)" stopOpacity="0" /></radialGradient>
      </defs>
      <path fill={`url(#${id}-sky)`} d="M0 0h1000v1200H0z" />
      <circle cx="740" cy="420" r="240" fill={`url(#${id}-sun)`} />
      <circle cx="740" cy="420" r="49" fill="var(--wg-sun)" opacity=".7" />
      <g fill="white" opacity=".25"><path d="M35 297c55-44 111-19 134 4 22-41 81-39 105-4 43-8 73 8 77 24H35z"/><path d="M695 180c47-26 79-9 95 12 19-39 67-32 84-5 46-1 72 16 79 27H695z"/></g>
      <path d="M0 688 130 487 228 589 383 426 581 648 710 495 865 649 1000 578v380H0z" fill="var(--wg-mountain-far)" opacity=".55" />
      <path d="m304 517 79-91 83 96-72-32-34 16-14-24zM84 558l46-71 55 74-42-29-13 6-8-17zM668 559l42-64 62 75-51-39-17 21-10-25z" fill="var(--wg-snow)" opacity=".55" />
      <path d="M0 713q122-96 246-20t227 53q105-105 227-23t300-29v263H0z" fill="var(--wg-mountain-near)" opacity=".57" />
      <path d="M0 854q180-35 334 3t322-8 344-6v357H0z" fill={`url(#${id}-water)`} />
      <g fill="none" stroke="var(--wg-snow)" strokeWidth="2" opacity=".25"><path d="M360 914h164m74 29h193m-570 43h180m133 42h118m-42-127h67m-14 189h232"/></g>
      <path d="M0 940q60-85 130-90t132 88l-74 262H0z" fill="var(--wg-ground)" />
      <path d="M1000 993q-134-128-286-22t-233 229h519z" fill="var(--wg-ground)" opacity=".83" />
      <g fill="var(--wg-leaf)" opacity=".85"><path d="M40 1070q-27-59-34-63 49 7 43 57 19-78 66-90-13 58-52 101z"/><path d="M950 1120q-2-82 40-118 10 57-27 109 21-28 50-28-8 38-56 46z"/></g>
      <g fill="var(--wg-flower)"><circle cx="77" cy="1064" r="9"/><circle cx="89" cy="1064" r="9"/><circle cx="83" cy="1054" r="9"/><circle cx="83" cy="1073" r="9"/><circle cx="907" cy="1150" r="12"/><circle cx="923" cy="1150" r="12"/><circle cx="915" cy="1138" r="12"/><circle cx="915" cy="1162" r="12"/></g>
      <g fill="var(--wg-sun)"><circle cx="83" cy="1064" r="6"/><circle cx="915" cy="1150" r="8"/></g>
      <g className="wg-scenery-stars" fill="#fff5d9"><path d="m130 290 3 9 9 3-9 3-3 9-3-9-9-3 9-3zM876 350l3 8 8 3-8 3-3 8-3-8-8-3 8-3zM576 204l3 9 9 3-9 3-3 9-3-9-9-3 9-3z"/><circle cx="330" cy="220" r="2.5"/><circle cx="708" cy="268" r="2.5"/><circle cx="427" cy="349" r="2"/><circle cx="70" cy="458" r="2"/></g>
    </svg>
    <div className="wg-scenery-wash" />
  </div>;
}
