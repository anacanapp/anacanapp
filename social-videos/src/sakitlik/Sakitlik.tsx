import { Audio, Video } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { color, gentleEase, headlineFont } from "../brand";
import { clamp } from "../shared";
import { TopBar } from "../TopBar";

type Line = {
  readonly text: string;
  readonly accent: string;
  /** Seconds at which the line fades in and out. */
  readonly from: number;
  readonly to: number;
};

export type SakitlikProps = {
  readonly number: string;
  readonly clip: string;
  /** Where the captions sit, so they never cover the subject. */
  readonly captionAt: "top" | "bottom";
  /** Where in the music track this video starts, in seconds. */
  readonly musicFrom: number;
  readonly lines: readonly Line[];
};

const FADE = 0.9; // seconds

const Caption = ({
  line,
  at,
}: {
  readonly line: Line;
  readonly at: SakitlikProps["captionAt"];
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = frame / fps;
  const ease = Easing.bezier(...gentleEase);
  const opacity =
    interpolate(s, [line.from, line.from + FADE], [0, 1], {
      ...clamp,
      easing: ease,
    }) *
    interpolate(s, [line.to - FADE, line.to], [1, 0], {
      ...clamp,
      easing: ease,
    });
  const rise = interpolate(s, [line.from, line.from + FADE], [24, 0], {
    ...clamp,
    easing: ease,
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        ...(at === "top" ? { top: 300 } : { bottom: 420 }),
        fontFamily: headlineFont,
        fontWeight: 700,
        fontSize: 116,
        lineHeight: 0.98,
        letterSpacing: "-0.045em",
        color: color.beyaz,
        opacity,
        translate: `0px ${rise}px`,
      }}
    >
      <div>{line.text}</div>
      <div style={{ color: color.seftali }}>{line.accent}</div>
    </div>
  );
};

export const Sakitlik = ({
  number,
  clip,
  captionAt,
  musicFrom,
  lines,
}: SakitlikProps) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 0.8 * fps], [0, 1], clamp);
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 1.2 * fps, durationInFrames],
    [1, 0],
    clamp,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: color.koyuKahve }}>
      <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
        <Video
          src={staticFile(clip)}
          muted
          objectFit="cover"
          style={{ width: "100%", height: "100%" }}
        />
      </AbsoluteFill>
      {/* Photo posts: white text over a koyu-kahve gradient behind it. */}
      <AbsoluteFill
        style={{
          background:
            captionAt === "top"
              ? "linear-gradient(to bottom, rgba(29,21,18,0.78) 0%, rgba(29,21,18,0) 46%)"
              : "linear-gradient(to top, rgba(29,21,18,0.92) 0%, rgba(29,21,18,0) 62%)",
        }}
      />
      {captionAt === "bottom" ? (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(to bottom, rgba(29,21,18,0.45) 0%, rgba(29,21,18,0) 16%)",
          }}
        />
      ) : null}
      {lines.map((line) => (
        <Caption key={line.from} line={line} at={captionAt} />
      ))}
      <TopBar label="SAKİTLİK" number={number} onDark />
      <Audio
        src={staticFile("sakitlik/music.mp3")}
        trimBefore={musicFrom * fps}
        volume={(f) =>
          0.75 *
          interpolate(f, [0, 1.5 * fps], [0, 1], clamp) *
          interpolate(
            f,
            [durationInFrames - 2 * fps, durationInFrames],
            [1, 0],
            clamp,
          )
        }
      />
    </AbsoluteFill>
  );
};
