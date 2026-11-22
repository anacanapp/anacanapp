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
import { Baby } from "./Baby";

export type BuSaniyeProps = {
  readonly number: string;
};

type Scene = {
  readonly title: string;
  readonly note: string;
  readonly fill: string;
};

const scenes: readonly Scene[] = [
  {
    title: "Hıçqırır.",
    note: "Qarnındakı o ritmik kiçik\ntəkanlar məhz budur.",
    fill: color.seftali,
  },
  {
    title: "Əsnəyir.",
    note: "Bəli, hələ doğulmamış.",
    fill: color.pembe,
  },
  {
    title: "Barmağını sorur.",
    note: "Əmməyi indidən məşq edir.",
    fill: color.alliq,
  },
  {
    title: "Yatır.",
    note: "Göz qapaqları altında gözləri\ntərpənir. Bəlkə də yuxu görür.",
    fill: color.seftali,
  },
];

const HOOK = 2.6; // seconds
const SCENE = 3.5; // seconds
const END_START = HOOK + SCENE * scenes.length;

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
        O, bu saniyə
      </div>
      <div
        style={{
          color: color.mercan,
          opacity: accent,
          translate: `0px ${(1 - accent) * 40}px`,
        }}
      >
        nə edir?
      </div>
    </div>
  );
};

// What the figure is doing at a given moment of a given scene.
const pose = (scene: number, t: number, fps: number) => {
  const s = t / fps;
  if (scene === 0) {
    // A sharp little jump every 0.9 s that settles quickly.
    const sinceHic = (s + 0.55) % 0.9;
    return { lift: -34 * Math.exp(-sinceHic * 9), hic: sinceHic };
  }
  if (scene === 1) {
    const open = interpolate(s, [0.5, 1.4, 2.2, 3.0], [0, 1, 1, 0], {
      ...clamp,
      easing: Easing.inOut(Easing.ease),
    });
    return { mouthOpen: open, headTilt: -9 * open };
  }
  if (scene === 2) {
    const up = spring({
      frame: t - 0.4 * fps,
      fps,
      config: { damping: 200 },
      durationInFrames: 0.9 * fps,
    });
    return { handUp: up, pulse: up * Math.sin(s * 7) * 0.012 };
  }
  // REM sleep: slow breathing, eyes flutter in short bursts.
  const burst = Math.sin(s * 1.9) > 0.2 ? 1 : 0;
  return { eyeShift: burst * Math.sin(s * 26) * 5, breath: Math.sin(s * 2) };
};

const Stage = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - HOOK * fps;
  const sceneFrames = SCENE * fps;
  const index = Math.min(
    scenes.length - 1,
    Math.max(0, Math.floor(local / sceneFrames)),
  );
  const t = local - index * sceneFrames;
  const scene = scenes[index];
  const p = pose(index, t, fps);

  const appear = spring({ frame: local + 0.3 * fps, fps, config: softSpring });
  const pop = spring({ frame: t, fps, config: softSpring });
  const text = spring({ frame: t - 0.15 * fps, fps, config: softSpring });
  const textOut = interpolate(
    t,
    [sceneFrames - 0.25 * fps, sceneFrames],
    [1, index === scenes.length - 1 ? 1 : 0],
    clamp,
  );

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 190,
          top: 520,
          width: 700,
          height: 700,
          borderRadius: 350,
          backgroundColor: scene.fill,
          opacity: appear,
          scale:
            interpolate(appear, [0, 1], [0.8, 1]) *
            (index === 0 ? 1 : interpolate(pop, [0, 1], [0.94, 1])) *
            (1 + (p.breath ?? 0) * 0.012 + (p.pulse ?? 0)),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 40,
            translate: `0px ${p.lift ?? 0}px`,
          }}
        >
          <Baby
            stroke={color.murekkep}
            mouthOpen={p.mouthOpen}
            headTilt={p.headTilt}
            handUp={p.handUp}
            eyeShift={p.eyeShift}
          />
        </div>
        {index === 0 && p.hic !== undefined && p.hic < 0.3 && t > 0 ? (
          <div
            style={{
              position: "absolute",
              left: 520,
              top: 90,
              fontFamily: headlineFont,
              fontWeight: 800,
              fontSize: 54,
              color: color.mercan,
              rotate: "12deg",
              opacity: interpolate(p.hic, [0, 0.3], [1, 0]),
              translate: `0px ${-p.hic * 60}px`,
            }}
          >
            hıq!
          </div>
        ) : null}
        {index === 3
          ? [0, 1, 2].map((i) => {
              const cycle = ((t / fps) * 0.5 + i * 0.33) % 1;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: 520 + cycle * 70,
                    top: 150 - cycle * 150,
                    fontFamily: headlineFont,
                    fontWeight: 800,
                    fontSize: 40 + cycle * 30,
                    color: color.mercan,
                    opacity: Math.sin(cycle * Math.PI),
                  }}
                >
                  z
                </div>
              );
            })
          : null}
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 1290,
          opacity: text * textOut,
          translate: `0px ${(1 - text) * 40}px`,
        }}
      >
        <div
          style={{
            fontFamily: headlineFont,
            fontWeight: 700,
            fontSize: 118,
            lineHeight: 1,
            letterSpacing: "-0.045em",
            color: color.mercan,
          }}
        >
          {scene.title}
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: textFont,
            fontWeight: 500,
            fontSize: 46,
            lineHeight: 1.3,
            color: color.kahveGri,
            whiteSpace: "pre-line",
          }}
        >
          {scene.note}
        </div>
      </div>
    </>
  );
};

const Ending = ({ number }: BuSaniyeProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - END_START * fps;

  const cover = interpolate(local, [0, 0.7 * fps], [100, 0], {
    ...clamp,
    easing: Easing.bezier(...gentleEase),
  });
  const baby = spring({ frame: local - 0.4 * fps, fps, config: softSpring });
  const line1 = spring({ frame: local - 0.9 * fps, fps, config: softSpring });
  const line2 = spring({ frame: local - 1.4 * fps, fps, config: softSpring });
  const chip = spring({ frame: local - 2.4 * fps, fps, config: softSpring });
  // Eyes open shortly after the scene lands, then a small wave.
  const awake = local > 1.5 * fps;
  const wave = awake ? 0.55 + Math.sin((local / fps) * 6) * 0.12 : 0;

  if (local < 0) {
    return null;
  }

  return (
    <AbsoluteFill
      style={{ backgroundColor: color.koyuKahve, translate: `0% ${cover}%` }}
    >
      <TopBar label="HAMİLƏLİK" number={number} onDark />
      <div
        style={{
          position: "absolute",
          left: 240,
          top: 400,
          width: 600,
          height: 600,
          borderRadius: 300,
          backgroundColor: color.murekkep,
          opacity: baby,
          scale: interpolate(baby, [0, 1], [0.86, 1]),
        }}
      >
        <div style={{ position: "absolute", inset: 34 }}>
          <Baby stroke={color.seftali} eyesOpen={awake} handUp={wave} />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 1090,
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
          Sən yatanda
        </div>
        <div
          style={{
            color: color.seftali,
            opacity: line2,
            translate: `0px ${(1 - line2) * 40}px`,
          }}
        >
          o oyaqdır.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 1420,
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
        Bu gecə ona salam de.
      </div>
    </AbsoluteFill>
  );
};

export const BuSaniye = ({ number }: BuSaniyeProps) => {
  return (
    <AbsoluteFill style={{ backgroundColor: color.krem }}>
      <Stage />
      <Headline />
      <TopBar label="HAMİLƏLİK" number={number} />
      <Ending number={number} />
    </AbsoluteFill>
  );
};
