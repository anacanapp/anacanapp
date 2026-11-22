import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { color, gentleEase, headlineFont, softSpring, textFont } from "./brand";
import { TopBar } from "./TopBar";

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

type HeadlineProps = {
  readonly line1: string;
  readonly accent: string;
  /** Seconds the headline stays large before settling at the top. */
  readonly hook: number;
  readonly onDark?: boolean;
};

// Opens large in the middle of the frame, then settles under the top bar.
export const Headline = ({ line1, accent, hook, onDark }: HeadlineProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: softSpring });
  const second = spring({ frame: frame - 0.5 * fps, fps, config: softSpring });
  const settle = interpolate(frame, [(hook - 0.8) * fps, hook * fps], [0, 1], {
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
        color: onDark ? color.beyaz : color.murekkep,
      }}
    >
      <div style={{ opacity: enter, translate: `0px ${(1 - enter) * 40}px` }}>
        {line1}
      </div>
      <div
        style={{
          color: onDark ? color.seftali : color.mercan,
          opacity: second,
          translate: `0px ${(1 - second) * 40}px`,
        }}
      >
        {accent}
      </div>
    </div>
  );
};

export type EndingCopy = {
  readonly label: string;
  readonly number: string;
  readonly endLine1: string;
  readonly endLine2: string;
  readonly endChip: string;
};

// Mercan closing slide: two-line message and one white chip.
export const MercanEnding = ({
  start,
  label,
  number,
  endLine1,
  endLine2,
  endChip,
}: EndingCopy & { readonly start: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - start * fps;

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
          top: 620,
          fontFamily: headlineFont,
          fontWeight: 700,
          fontSize: 136,
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
