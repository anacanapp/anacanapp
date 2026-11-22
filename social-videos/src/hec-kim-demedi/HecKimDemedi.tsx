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

export type Bubble = {
  readonly text: string;
  readonly lines: number;
  readonly side: "left" | "right";
  readonly fill: string;
};

export type HecKimDemediProps = {
  readonly label: string;
  readonly number: string;
  readonly endLine1: string;
  readonly endLine2: string;
  readonly endChip: string;
  // Written by the brand as shared experiences. They are not quotes from
  // real users, so they carry no names, avatars or attribution.
  readonly bubbles: readonly Bubble[];
};

const FONT_SIZE = 46;
const LINE_HEIGHT = 1.3;
const PAD_Y = 38;
const GAP = 24;
const STACK_BOTTOM = 1540; // Stays clear of the Reels / TikTok caption area.
const FADE_TOP = 520;
const FIRST_BUBBLE = 3; // seconds
const BUBBLE_EVERY = 2.2; // seconds
const END_START = 17; // seconds

const bubbleHeight = (b: Bubble) =>
  b.lines * FONT_SIZE * LINE_HEIGHT + PAD_Y * 2;

const Headline = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: softSpring });
  const accent = spring({ frame: frame - 0.5 * fps, fps, config: softSpring });
  const settle = interpolate(frame, [2 * fps, 2.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
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
        Mənə heç kim
      </div>
      <div
        style={{
          color: color.mercan,
          opacity: accent,
          translate: `0px ${(1 - accent) * 40}px`,
        }}
      >
        demədi ki…
      </div>
    </div>
  );
};

const BubbleStack = ({ bubbles }: Pick<HecKimDemediProps, "bubbles">) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = bubbles.map((_, i) =>
    spring({
      frame: frame - (FIRST_BUBBLE + i * BUBBLE_EVERY) * fps,
      fps,
      config: softSpring,
    }),
  );

  return (
    <>
      {bubbles.map((b, i) => {
        const height = bubbleHeight(b);
        // Each newer bubble pushes the older ones up as it arrives.
        const pushed = bubbles
          .slice(i + 1)
          .reduce(
            (sum, later, j) =>
              sum + progress[i + 1 + j] * (bubbleHeight(later) + GAP),
            0,
          );
        const top = STACK_BOTTOM - height - pushed;
        const p = progress[i];
        const fade = interpolate(top, [FADE_TOP - 110, FADE_TOP], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const isLeft = b.side === "left";

        return (
          <div
            key={b.text}
            style={{
              position: "absolute",
              top,
              left: isLeft ? 80 : undefined,
              right: isLeft ? undefined : 80,
              height,
              boxSizing: "border-box",
              padding: `${PAD_Y}px 44px`,
              borderRadius: 40,
              borderBottomLeftRadius: isLeft ? 10 : 40,
              borderBottomRightRadius: isLeft ? 40 : 10,
              backgroundColor: b.fill,
              color: color.murekkep,
              fontFamily: textFont,
              fontWeight: 500,
              fontSize: FONT_SIZE,
              lineHeight: LINE_HEIGHT,
              letterSpacing: "-0.01em",
              whiteSpace: "pre-line",
              opacity: Math.min(1, p * 1.4) * fade,
              scale: interpolate(p, [0, 1], [0.86, 1]),
              translate: `0px ${(1 - p) * 70}px`,
              transformOrigin: isLeft ? "0% 100%" : "100% 100%",
            }}
          >
            {b.text}
          </div>
        );
      })}
    </>
  );
};

const Ending = ({
  label,
  number,
  endLine1,
  endLine2,
  endChip,
}: Omit<HecKimDemediProps, "bubbles">) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - END_START * fps;

  const cover = interpolate(local, [0, 0.7 * fps], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
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
            letterSpacing: "0em",
            lineHeight: 1,
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

export const HecKimDemedi = ({ bubbles, ...ending }: HecKimDemediProps) => {
  const { label, number } = ending;
  return (
    <AbsoluteFill style={{ backgroundColor: color.krem }}>
      <BubbleStack bubbles={bubbles} />
      <Headline />
      <TopBar label={label} number={number} />
      <Ending {...ending} />
    </AbsoluteFill>
  );
};
