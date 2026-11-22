import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { color, headlineFont, softSpring, textFont } from "../brand";
import { clamp, EndingCopy, MercanEnding } from "../shared";
import { TopBar } from "../TopBar";

export type Notification = {
  readonly from: string;
  readonly text: string;
  readonly tint: string;
};

export type BildirisProps = EndingCopy & {
  readonly clock: string;
  readonly day: string;
  readonly notifications: readonly Notification[];
};

const FIRST = 1.6; // seconds
const EVERY = 2.0; // seconds
const HOLD = 3.2; // seconds on the last notification
const CARD = 178;
const GAP = 18;

const LockScreen = ({
  clock,
  day,
  notifications,
}: Pick<BildirisProps, "clock" | "day" | "notifications">) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const last = notifications.length - 1;
  const clockIn = spring({ frame, fps, config: softSpring });
  const progress = notifications.map((_, i) =>
    spring({
      frame: frame - (FIRST + i * EVERY) * fps,
      fps,
      config: softSpring,
    }),
  );
  // Once the last message lands, everything else steps back.
  const focus = spring({
    frame: frame - (FIRST + last * EVERY + 0.9) * fps,
    fps,
    config: { damping: 200 },
  });

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 250,
          opacity: clockIn,
          translate: `0px ${(1 - clockIn) * 40}px`,
        }}
      >
        <div
          style={{
            fontFamily: headlineFont,
            fontWeight: 800,
            fontSize: 250,
            lineHeight: 1,
            letterSpacing: "-0.05em",
            color: color.beyaz,
          }}
        >
          {clock}
        </div>
        <div
          style={{
            fontFamily: textFont,
            fontWeight: 500,
            fontSize: 44,
            color: color.seftali,
          }}
        >
          {day}
        </div>
      </div>
      {notifications.map((n, i) => {
        // Newest on top; each arrival pushes the older ones down.
        const pushed = progress
          .slice(i + 1)
          .reduce((sum, p) => sum + p * (CARD + GAP), 0);
        const top = 620 + pushed;
        const p = progress[i];
        const isLast = i === last;
        const fade = interpolate(top, [1330, 1480], [1, 0], clamp);
        return (
          <div
            key={n.from}
            style={{
              position: "absolute",
              left: 80,
              right: 80,
              top,
              height: CARD,
              boxSizing: "border-box",
              padding: "0 40px",
              borderRadius: 40,
              display: "flex",
              alignItems: "center",
              gap: 30,
              backgroundColor: isLast ? color.seftali : color.krem,
              opacity:
                Math.min(1, p * 1.4) * fade * (isLast ? 1 : 1 - focus * 0.72),
              scale:
                interpolate(p, [0, 1], [0.9, 1]) *
                (isLast ? 1 + focus * 0.03 : 1),
              translate: `0px ${(1 - p) * -60}px`,
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: 92,
                height: 92,
                borderRadius: 46,
                backgroundColor: n.tint,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: headlineFont,
                fontWeight: 800,
                fontSize: 46,
                color: isLast ? color.beyaz : color.murekkep,
              }}
            >
              {n.from.slice(0, 1)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  fontFamily: textFont,
                  fontWeight: 600,
                  fontSize: 38,
                  color: color.murekkep,
                }}
              >
                <span>{n.from}</span>
                <span
                  style={{
                    fontWeight: 500,
                    fontSize: 30,
                    color: color.kahveGri,
                  }}
                >
                  indi
                </span>
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontFamily: textFont,
                  fontWeight: 500,
                  fontSize: 38,
                  lineHeight: 1.25,
                  color: color.murekkep,
                }}
              >
                {n.text}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};

export const Bildiris = ({
  clock,
  day,
  notifications,
  ...ending
}: BildirisProps) => {
  return (
    <AbsoluteFill style={{ backgroundColor: color.koyuKahve }}>
      <LockScreen clock={clock} day={day} notifications={notifications} />
      <TopBar label={ending.label} number={ending.number} onDark />
      <MercanEnding
        start={FIRST + (notifications.length - 1) * EVERY + HOLD}
        {...ending}
      />
    </AbsoluteFill>
  );
};
