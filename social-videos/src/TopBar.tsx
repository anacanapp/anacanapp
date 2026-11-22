import { color, headlineFont, textFont } from "./brand";

type Props = {
  readonly label: string;
  readonly number: string;
  readonly onMercan?: boolean;
};

// Top bar: label chip left, numbered "Anacan" wordmark right.
export const TopBar = ({ label, number, onMercan = false }: Props) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 110,
        left: 80,
        right: 80,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div
        style={{
          height: 64,
          padding: "0 30px",
          borderRadius: 32,
          display: "flex",
          alignItems: "center",
          backgroundColor: onMercan ? color.beyaz : color.mercan,
          color: onMercan ? color.murekkep : color.beyaz,
          fontFamily: textFont,
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            fontFamily: headlineFont,
            fontSize: 50,
            fontWeight: 800,
            letterSpacing: "-0.05em",
            color: onMercan ? color.beyaz : color.murekkep,
          }}
        >
          Anacan
        </div>
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: color.beyaz,
            border: onMercan ? "none" : `3px solid ${color.cizgi}`,
            color: onMercan ? color.mercan : color.kahveGri,
            fontFamily: textFont,
            fontSize: 22,
            fontWeight: 600,
          }}
        >
          {number}
        </div>
      </div>
    </div>
  );
};
