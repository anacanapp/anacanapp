import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { color, headlineFont, softSpring, textFont } from "../brand";
import { clamp, EndingCopy, Headline, MercanEnding } from "../shared";
import { TopBar } from "../TopBar";

export type Query = {
  readonly time: string;
  readonly text: string;
};

export type AxtarisProps = EndingCopy & {
  readonly queries: readonly Query[];
};

const HOOK = 2.6; // seconds
const SLOT = 3.3; // seconds per search
const HOLD = 1.2; // extra seconds on the last search
const ROW = 104;

const Magnifier = ({ stroke }: { readonly stroke: string }) => (
  <svg width={52} height={52} viewBox="0 0 24 24" fill="none">
    <circle cx={11} cy={11} r={7} stroke={stroke} strokeWidth={2} />
    <path
      d="M16.5 16.5 21 21"
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </svg>
);

const Clock = () => (
  <svg width={40} height={40} viewBox="0 0 24 24" fill="none">
    <circle cx={12} cy={12} r={9} stroke={color.kahveGri} strokeWidth={2} />
    <path
      d="M12 7v5l3 2"
      stroke={color.kahveGri}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Search = ({ queries }: Pick<AxtarisProps, "queries">) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - HOOK * fps;
  const slot = SLOT * fps;
  const last = queries.length - 1;
  const index = Math.min(last, Math.max(0, Math.floor(local / slot)));
  const t = local - index * slot;
  const query = queries[index];

  const appear = spring({ frame: local + 0.3 * fps, fps, config: softSpring });
  const typed = Math.round(
    interpolate(t, [0.3 * fps, 1.7 * fps], [0, query.text.length], clamp),
  );
  const done = typed >= query.text.length;
  const caretOn = !done || Math.floor(t / (0.5 * fps)) % 2 === 0;
  const isFinal = index === last;
  const glow = isFinal
    ? spring({ frame: t - 1.8 * fps, fps, config: softSpring })
    : 0;
  const timeIn = spring({ frame: t, fps, config: softSpring });

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 520,
          fontFamily: headlineFont,
          fontWeight: 800,
          fontSize: 76,
          letterSpacing: "-0.04em",
          color: color.mercan,
          opacity: appear * Math.min(1, timeIn * 1.5),
          translate: `0px ${(1 - timeIn) * 20}px`,
        }}
      >
        {query.time}
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 640,
          height: 136,
          boxSizing: "border-box",
          borderRadius: 68,
          padding: "0 44px",
          display: "flex",
          alignItems: "center",
          gap: 26,
          backgroundColor: color.beyaz,
          border: `5px solid ${glow > 0.5 ? color.mercan : color.cizgi}`,
          opacity: appear,
          scale: interpolate(appear, [0, 1], [0.92, 1]) * (1 + glow * 0.02),
        }}
      >
        <Magnifier stroke={glow > 0.5 ? color.mercan : color.kahveGri} />
        <div
          style={{
            fontFamily: textFont,
            fontWeight: 500,
            fontSize: 44,
            letterSpacing: "-0.01em",
            color: color.murekkep,
            whiteSpace: "nowrap",
          }}
        >
          {query.text.slice(0, typed)}
          <span style={{ color: color.mercan, opacity: caretOn ? 1 : 0 }}>
            |
          </span>
        </div>
      </div>
      {queries.slice(0, last).map((q, i) => {
        // A finished search drops into the history, newest on top.
        const added = spring({
          frame: local - (i + 1) * slot,
          fps,
          config: softSpring,
        });
        const below = queries.slice(i + 1, last).reduce(
          (sum, _, j) =>
            sum +
            spring({
              frame: local - (i + 2 + j) * slot,
              fps,
              config: softSpring,
            }),
          0,
        );
        return (
          <div
            key={q.time}
            style={{
              position: "absolute",
              left: 104,
              right: 104,
              top: 836 + below * ROW,
              height: ROW,
              display: "flex",
              alignItems: "center",
              gap: 24,
              borderBottom: `3px solid ${color.cizgi}`,
              opacity: added * interpolate(below, [0, 3], [1, 0.45], clamp),
              translate: `0px ${(1 - added) * -40}px`,
            }}
          >
            <Clock />
            <div
              style={{
                flex: 1,
                fontFamily: textFont,
                fontWeight: 500,
                fontSize: 38,
                color: color.kahveGri,
                whiteSpace: "nowrap",
              }}
            >
              {q.text}
            </div>
            <div
              style={{
                fontFamily: textFont,
                fontWeight: 600,
                fontSize: 32,
                color: color.kahveGri,
              }}
            >
              {q.time}
            </div>
          </div>
        );
      })}
    </>
  );
};

export const Axtaris = ({ queries, ...ending }: AxtarisProps) => {
  return (
    <AbsoluteFill style={{ backgroundColor: color.krem }}>
      <Search queries={queries} />
      <Headline line1="Ananın axtarış" accent="tarixçəsi" hook={HOOK} />
      <TopBar label={ending.label} number={ending.number} />
      <MercanEnding start={HOOK + SLOT * queries.length + HOLD} {...ending} />
    </AbsoluteFill>
  );
};
