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

export type Entry = {
  readonly word: string;
  readonly meta: string;
  readonly definition: string;
  readonly fill: string;
};

export type AnaLugetiProps = EndingCopy & {
  readonly entries: readonly Entry[];
};

const HOOK = 2.6; // seconds
const ITEM = 4.2; // seconds

const EntryCard = ({
  entry,
  t,
  isLast,
}: {
  readonly entry: Entry;
  readonly t: number;
  readonly isLast: boolean;
}) => {
  const { fps } = useVideoConfig();
  const enter = spring({ frame: t, fps, config: softSpring });
  const typed = Math.round(
    interpolate(t, [0.25 * fps, 0.95 * fps], [0, entry.word.length], clamp),
  );
  const meta = spring({ frame: t - 1.0 * fps, fps, config: softSpring });
  const def = spring({ frame: t - 1.5 * fps, fps, config: softSpring });
  const out = interpolate(
    t,
    [(ITEM - 0.25) * fps, ITEM * fps],
    [1, isLast ? 1 : 0],
    clamp,
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        top: 540,
        boxSizing: "border-box",
        minHeight: 640,
        padding: "64px 56px",
        borderRadius: 40,
        backgroundColor: entry.fill,
        opacity: Math.min(1, enter * 1.4) * out,
        translate: `0px ${(1 - enter) * 70}px`,
      }}
    >
      <div
        style={{
          fontFamily: headlineFont,
          fontWeight: 800,
          fontSize: 128,
          lineHeight: 1,
          letterSpacing: "-0.045em",
          color: color.murekkep,
          minHeight: 128,
        }}
      >
        {entry.word.slice(0, typed)}
        <span
          style={{
            color: color.mercan,
            opacity: typed < entry.word.length ? 1 : 0,
          }}
        >
          |
        </span>
      </div>
      <div
        style={{
          marginTop: 22,
          fontFamily: textFont,
          fontWeight: 500,
          fontSize: 40,
          color: color.kahveGri,
          opacity: meta,
        }}
      >
        {entry.meta}
      </div>
      <div
        style={{
          marginTop: 44,
          height: 4,
          borderRadius: 2,
          backgroundColor: color.beyaz,
          width: `${meta * 100}%`,
        }}
      />
      <div
        style={{
          marginTop: 48,
          display: "flex",
          gap: 22,
          opacity: def,
          translate: `0px ${(1 - def) * 30}px`,
        }}
      >
        <div
          style={{
            fontFamily: headlineFont,
            fontWeight: 800,
            fontSize: 58,
            lineHeight: 1.22,
            color: color.mercan,
          }}
        >
          1.
        </div>
        <div
          style={{
            fontFamily: textFont,
            fontWeight: 500,
            fontSize: 56,
            lineHeight: 1.27,
            letterSpacing: "-0.01em",
            color: color.murekkep,
            whiteSpace: "pre-line",
          }}
        >
          {entry.definition}
        </div>
      </div>
    </div>
  );
};

const Entries = ({ entries }: Pick<AnaLugetiProps, "entries">) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - HOOK * fps;
  if (local < 0) {
    return null;
  }
  const index = Math.min(entries.length - 1, Math.floor(local / (ITEM * fps)));
  return (
    <EntryCard
      entry={entries[index]}
      t={local - index * ITEM * fps}
      isLast={index === entries.length - 1}
    />
  );
};

export const AnaLugeti = ({ entries, ...ending }: AnaLugetiProps) => {
  return (
    <AbsoluteFill style={{ backgroundColor: color.krem }}>
      <Entries entries={entries} />
      <Headline line1="Ana" accent="lüğəti" hook={HOOK} />
      <TopBar label={ending.label} number={ending.number} />
      <MercanEnding start={HOOK + ITEM * entries.length} {...ending} />
    </AbsoluteFill>
  );
};
