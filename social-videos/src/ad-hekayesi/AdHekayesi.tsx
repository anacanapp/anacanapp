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
import { clamp, EndingCopy, MercanEnding } from "../shared";
import { TopBar } from "../TopBar";

type Picture = "halo" | "night" | "peak";

export type AdHekayesiProps = EndingCopy & {
  readonly name: string;
  readonly fill: string;
  readonly origin: string;
  readonly root: string;
  readonly rootMeaning: string;
  readonly meaning: string;
  readonly note: string;
  readonly picture: Picture;
};

const SETTLE = 3.0; // seconds: the name moves up
const ROOT = 4.0;
const MEANING = 7.2;
const NOTE = 9.6;
const END = 14.2;

const Drawing = ({
  kind,
  p,
}: {
  readonly kind: Picture;
  readonly p: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = frame / fps;
  const line = {
    fill: "none",
    stroke: color.murekkep,
    strokeWidth: 9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  const draw = (length: number) => ({
    strokeDasharray: length,
    strokeDashoffset: length * (1 - p),
  });

  return (
    <svg viewBox="0 0 240 240" width={240} height={240}>
      {kind === "halo" ? (
        <>
          <circle cx={120} cy={120} r={44} {...line} {...draw(280)} />
          <circle
            cx={120}
            cy={120}
            r={92 + Math.sin(s * 2) * 4}
            {...line}
            stroke={color.mercan}
            strokeDasharray="4 22"
            opacity={p}
          />
        </>
      ) : null}
      {kind === "night" ? (
        <>
          <path
            d="M150 44 a82 82 0 1 0 46 132 a66 66 0 0 1 -46 -132 z"
            {...line}
            {...draw(520)}
          />
          {[
            [196, 60, 0],
            [222, 112, 1.3],
            [176, 104, 2.4],
          ].map(([x, y, phase]) => (
            <circle
              key={x}
              cx={x}
              cy={y}
              r={7}
              fill={color.mercan}
              opacity={p * (0.55 + 0.45 * Math.sin(s * 3 + phase))}
            />
          ))}
        </>
      ) : null}
      {kind === "peak" ? (
        <>
          <path
            d="M18 204 L96 76 L134 138 L164 96 L224 204 Z"
            {...line}
            {...draw(640)}
          />
          <path
            d="M96 76 V28 M96 28 l40 14 l-40 14"
            {...line}
            stroke={color.mercan}
            opacity={p}
          />
        </>
      ) : null}
    </svg>
  );
};

const Story = ({
  name,
  origin,
  root,
  rootMeaning,
  meaning,
  note,
  picture,
}: Omit<AdHekayesiProps, keyof EndingCopy | "fill">) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const letters = Array.from(name);
  const size = Math.min(380, 880 / (letters.length * 0.56));

  const intro = spring({ frame: frame - 0.2 * fps, fps, config: softSpring });
  const settle = interpolate(
    frame,
    [(SETTLE - 0.8) * fps, SETTLE * fps],
    [0, 1],
    {
      ...clamp,
      easing: Easing.bezier(...gentleEase),
    },
  );
  const at = (seconds: number) =>
    spring({ frame: frame - seconds * fps, fps, config: softSpring });
  const chip = at(SETTLE + 0.1);
  const card = at(ROOT);
  const label = at(MEANING);
  const big = at(MEANING + 0.35);
  const drawing = interpolate(
    frame,
    [(MEANING + 0.4) * fps, (MEANING + 1.6) * fps],
    [0, 1],
    { ...clamp, easing: Easing.bezier(...gentleEase) },
  );
  const noteIn = at(NOTE);

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 600,
          fontFamily: textFont,
          fontWeight: 500,
          fontSize: 48,
          color: color.kahveGri,
          opacity: intro * (1 - settle),
        }}
      >
        Bu adın bir hekayəsi var:
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          top: interpolate(settle, [0, 1], [690, 270]),
          transformOrigin: "0% 0%",
          scale: interpolate(settle, [0, 1], [1, 0.62]),
          fontFamily: headlineFont,
          fontWeight: 800,
          fontSize: size,
          lineHeight: 1,
          letterSpacing: "-0.05em",
          color: color.murekkep,
          whiteSpace: "nowrap",
        }}
      >
        {letters.map((letter, i) => {
          const drop = spring({
            frame: frame - (0.6 + i * 0.16) * fps,
            fps,
            config: { damping: 12, stiffness: 180 },
          });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: Math.min(1, drop * 2),
                translate: `0px ${(1 - drop) * -220}px`,
                rotate: `${(1 - drop) * (i % 2 === 0 ? -14 : 14)}deg`,
              }}
            >
              {letter}
            </span>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 560,
          height: 64,
          padding: "0 30px",
          borderRadius: 32,
          display: "flex",
          alignItems: "center",
          backgroundColor: color.beyaz,
          fontFamily: textFont,
          fontWeight: 600,
          fontSize: 28,
          letterSpacing: "0.02em",
          color: color.murekkep,
          opacity: chip,
          scale: interpolate(chip, [0, 1], [0.8, 1]),
          transformOrigin: "0% 50%",
        }}
      >
        {origin}
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 680,
          boxSizing: "border-box",
          padding: "44px 52px",
          borderRadius: 40,
          backgroundColor: color.beyaz,
          display: "flex",
          alignItems: "baseline",
          gap: 36,
          opacity: card,
          translate: `0px ${(1 - card) * 50}px`,
        }}
      >
        <div
          style={{
            fontFamily: headlineFont,
            fontWeight: 800,
            fontSize: 110,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            color: color.mercan,
          }}
        >
          {root}
        </div>
        <div
          style={{
            fontFamily: textFont,
            fontWeight: 500,
            fontSize: 46,
            lineHeight: 1.25,
            color: color.murekkep,
          }}
        >
          {rootMeaning}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 950,
          fontFamily: textFont,
          fontWeight: 600,
          fontSize: 34,
          letterSpacing: "0.02em",
          color: color.kahveGri,
          opacity: label,
        }}
      >
        MƏNASI
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 1000,
          width: 650,
          fontFamily: headlineFont,
          fontWeight: 700,
          fontSize: 128,
          lineHeight: 0.98,
          letterSpacing: "-0.045em",
          color: color.murekkep,
          opacity: big,
          translate: `0px ${(1 - big) * 40}px`,
        }}
      >
        {meaning}
      </div>
      <div style={{ position: "absolute", right: 80, top: 990 }}>
        <Drawing kind={picture} p={drawing} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 1300,
          fontFamily: textFont,
          fontWeight: 500,
          fontSize: 48,
          lineHeight: 1.3,
          color: color.murekkep,
          whiteSpace: "pre-line",
          opacity: noteIn,
          translate: `0px ${(1 - noteIn) * 30}px`,
        }}
      >
        {note}
      </div>
    </>
  );
};

export const AdHekayesi = ({
  fill,
  label,
  number,
  endLine1,
  endLine2,
  endChip,
  ...story
}: AdHekayesiProps) => {
  return (
    <AbsoluteFill style={{ backgroundColor: fill }}>
      <Story {...story} />
      <TopBar label={label} number={number} />
      <MercanEnding
        start={END}
        label={label}
        number={number}
        endLine1={endLine1}
        endLine2={endLine2}
        endChip={endChip}
      />
    </AbsoluteFill>
  );
};
