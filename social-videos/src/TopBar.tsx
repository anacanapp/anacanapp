import { Img, staticFile } from "remotion";

type Props = {
  /** Series label and number. No longer drawn; kept to identify editions. */
  readonly label?: string;
  readonly number?: string;
  readonly onMercan?: boolean;
  readonly onDark?: boolean;
};

// The brand mark alone in the top-right corner: coral on light fields,
// white on mercan, dark fields and footage.
export const TopBar = ({ onMercan = false, onDark = false }: Props) => {
  return (
    <Img
      src={staticFile(
        onMercan || onDark ? "anacan-mark-white.png" : "anacan-mark-coral.png",
      )}
      style={{
        position: "absolute",
        top: 104,
        right: 80,
        width: 76,
        height: 76,
      }}
    />
  );
};
