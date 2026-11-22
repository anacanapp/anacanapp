type Props = {
  readonly stroke: string;
  readonly eyesOpen?: boolean;
  /** 0 = soft smile, 1 = wide yawn */
  readonly mouthOpen?: number;
  /** 0 = hand resting on the belly, 1 = thumb at the mouth */
  readonly handUp?: number;
  /** Sideways eye flutter in px, used for REM sleep */
  readonly eyeShift?: number;
  readonly headTilt?: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// A simple rounded line figure, drawn in the same spirit as the brand's
// line icons: one stroke weight, round caps and joins, no fills.
export const Baby = ({
  stroke,
  eyesOpen = false,
  mouthOpen = 0,
  handUp = 0,
  eyeShift = 0,
  headTilt = 0,
}: Props) => {
  const handX = lerp(318, 322, handUp);
  const handY = lerp(452, 300, handUp);
  const elbowX = lerp(214, 176, handUp);
  const elbowY = lerp(470, 392, handUp);

  return (
    <svg viewBox="0 0 600 600" width="100%" height="100%">
      <g
        fill="none"
        stroke={stroke}
        strokeWidth={15}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Curled body and leg */}
        <path d="M 246 322 C 150 356, 128 478, 214 528 C 290 572, 400 548, 418 470" />
        <path d="M 418 470 C 452 400, 372 372, 344 420 C 330 446, 352 470, 376 464" />
        {/* Arm */}
        <path d={`M 262 372 Q ${elbowX} ${elbowY} ${handX} ${handY}`} />
        {/* Head */}
        <g transform={`rotate(${headTilt} 330 232)`}>
          <circle cx={330} cy={232} r={118} />
          {eyesOpen ? (
            <>
              <circle cx={296 + eyeShift} cy={224} r={6} fill={stroke} />
              <circle cx={376 + eyeShift} cy={224} r={6} fill={stroke} />
            </>
          ) : (
            <>
              <path
                d={`M ${278 + eyeShift} 222 q 18 16 36 0`}
                strokeWidth={12}
              />
              <path
                d={`M ${358 + eyeShift} 222 q 18 16 36 0`}
                strokeWidth={12}
              />
            </>
          )}
          {mouthOpen > 0.05 ? (
            <ellipse
              cx={336}
              cy={lerp(284, 290, mouthOpen)}
              rx={lerp(12, 26, mouthOpen)}
              ry={lerp(4, 30, mouthOpen)}
              strokeWidth={12}
            />
          ) : (
            <path d="M 316 280 q 20 18 40 0" strokeWidth={12} />
          )}
        </g>
      </g>
    </svg>
  );
};
