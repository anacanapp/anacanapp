import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  color,
  gentleEase,
  headlineFont,
  softSpring,
  textFont,
} from "../brand";
import { TopBar } from "../TopBar";

type Verdict = "mif" | "dogru" | "belke";

export type Saying = {
  readonly quote: string;
  readonly verdict: Verdict;
  readonly note: string;
  readonly fill: string;
};

export type NenemDeyirdiProps = {
  readonly label: string;
  readonly number: string;
  // Every verdict and note is a health claim: have a specialist confirm
  // them before an edition is published.
  readonly sayings: readonly Saying[];
  readonly endLine1: string;
  readonly endLine2: string;
  readonly endChip: string;
};

const stamp: Record<Verdict, { text: string; ink: string }> = {
  mif: { text: "MİF", ink: color.mercan },
  dogru: { text: "DOĞRU", ink: "#1F7A55" },
  belke: { text: "BƏLKƏ", ink: color.kahveGri },
};

const HOOK = 2.6; // seconds
const ITEM = 4.2; // seconds
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Headline = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: softSpring });
  const accent = spring({ frame: frame - 0.5 * fps, fps, config: softSpring });
  const settle = interpolate(frame, [(HOOK - 0.8) * fps, HOOK * fps], [0, 1], {
    ...clamp,
    easing: Easing.bezier(...gentleEase),
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        top: interpolate(settle, [0, 1], [720, 250]),
        fontFamily: headlineFont,
        fontWeight: 700,
        fontSize: interpolate(settle, [0, 1], [148, 92]),
        lineHeight: 0.98,
        letterSpacing: "-0.045em",
        color: color.murekkep,
      }}
    >
      <div style={{ opacity: enter, translate: `0px ${(1 - enter) * 40}px` }}>
        Nənəm
      </div>
      <div
        style={{
          color: color.mercan,
          opacity: accent,
          translate: `0px ${(1 - accent) * 40}px`,
        }}
      >
        deyirdi ki…
      </div>
    </div>
  );
};

const SayingCard = ({
  saying,
  index,
  t,
  isLast,
}: {
  readonly saying: Saying;
  readonly index: number;
  readonly t: number;
  readonly isLast: boolean;
}) => {
  const { fps } = useVideoConfig();
  const enter = spring({ frame: t, fps, config: softSpring });
  const slam = spring({
    frame: t - 1.4 * fps,
    fps,
    config: { damping: 14, stiffness: 260 },
  });
  const note = spring({ frame: t - 1.9 * fps, fps, config: softSpring });
  const out = interpolate(
    t,
    [(ITEM - 0.25) * fps, ITEM * fps],
    [1, isLast ? 1 : 0],
    clamp,
  );
  const { text, ink } = stamp[saying.verdict];

  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        top: 540,
        opacity: out,
      }}
    >
      <div
        style={{
          position: "relative",
          boxSizing: "border-box",
          minHeight: 520,
          padding: "48px 52px 72px",
          borderRadius: 40,
          backgroundColor: saying.fill,
          opacity: Math.min(1, enter * 1.4),
          translate: `${(1 - enter) * 90}px 0px`,
        }}
      >
        <div
          style={{
            width: "fit-content",
            padding: "8px 24px",
            borderRadius: 30,
            backgroundColor: color.beyaz,
            fontFamily: textFont,
            fontWeight: 600,
            fontSize: 30,
            color: color.murekkep,
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </div>
        <div
          style={{
            marginTop: 36,
            fontFamily: headlineFont,
            fontWeight: 700,
            fontSize: 86,
            lineHeight: 1.04,
            letterSpacing: "-0.035em",
            color: color.murekkep,
          }}
        >
          “{saying.quote}”
        </div>
        <div
          style={{
            position: "absolute",
            right: 28,
            bottom: -62,
            padding: "10px 38px 14px",
            borderRadius: 28,
            border: `10px solid ${ink}`,
            backgroundColor: color.krem,
            color: ink,
            fontFamily: headlineFont,
            fontWeight: 800,
            fontSize: 112,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            rotate: "-7deg",
            opacity: Math.min(1, slam * 3),
            scale: interpolate(slam, [0, 1], [2.3, 1]),
          }}
        >
          {text}
        </div>
      </div>
      <div
        style={{
          marginTop: 120,
          fontFamily: textFont,
          fontWeight: 500,
          fontSize: 48,
          lineHeight: 1.3,
          color: color.murekkep,
          whiteSpace: "pre-line",
          opacity: note,
          translate: `0px ${(1 - note) * 30}px`,
        }}
      >
        {saying.note}
      </div>
    </div>
  );
};

const Sayings = ({ sayings }: Pick<NenemDeyirdiProps, "sayings">) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - HOOK * fps;
  if (local < 0) {
    return null;
  }
  const index = Math.min(sayings.length - 1, Math.floor(local / (ITEM * fps)));
  return (
    <SayingCard
      saying={sayings[index]}
      index={index}
      t={local - index * ITEM * fps}
      isLast={index === sayings.length - 1}
    />
  );
};

const Ending = ({
  label,
  number,
  sayings,
  endLine1,
  endLine2,
  endChip,
}: NenemDeyirdiProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - (HOOK + ITEM * sayings.length) * fps;

  const cover = interpolate(local, [0, 0.7 * fps], [100, 0], {
    ...clamp,
    easing: Easing.bezier(...gentleEase),
  });
  const line1 = spring({ frame: local - 0.5 * fps, fps, config: softSpring });
  const line2 = spring({ frame: local - 1.0 * fps, fps, config: softSpring });
  const chip = spring({ frame: local - 1.9 * fps, fps, config: softSpring });

  if (local < 0) {
    return null;
  }

  return (
    <AbsoluteFill
      style={{ backgroundColor: color.mercan, translate: `0% ${cover}%` }}
    >
      <TopBar label={label} number={number} onMercan />
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 640,
          fontFamily: headlineFont,
          fontWeight: 700,
          fontSize: 148,
          lineHeight: 0.98,
          letterSpacing: "-0.045em",
        }}
      >
        <div
          style={{
            color: color.beyaz,
            opacity: line1,
            translate: `0px ${(1 - line1) * 40}px`,
          }}
        >
          {endLine1}
        </div>
        <div
          style={{
            color: color.seftali,
            opacity: line2,
            translate: `0px ${(1 - line2) * 40}px`,
          }}
        >
          {endLine2}
        </div>
        <div
          style={{
            marginTop: 70,
            width: "fit-content",
            height: 96,
            padding: "0 44px",
            borderRadius: 48,
            display: "flex",
            alignItems: "center",
            backgroundColor: color.beyaz,
            color: color.murekkep,
            fontFamily: textFont,
            fontWeight: 600,
            fontSize: 40,
            letterSpacing: "0em",
            lineHeight: 1,
            opacity: chip,
            scale: interpolate(chip, [0, 1], [0.86, 1]),
            transformOrigin: "0% 50%",
          }}
        >
          {endChip}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const NenemDeyirdi = (props: NenemDeyirdiProps) => {
  return (
    <AbsoluteFill style={{ backgroundColor: color.krem }}>
      <Sayings sayings={props.sayings} />
      <Headline />
      <TopBar label={props.label} number={props.number} />
      <Ending {...props} />
    </AbsoluteFill>
  );
};
