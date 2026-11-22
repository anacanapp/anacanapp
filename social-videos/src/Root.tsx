import { Composition, Folder } from "remotion";
import { HecKimDemedi } from "./hec-kim-demedi/HecKimDemedi";

export const RemotionRoot = () => {
  return (
    <Folder name="Social">
      <Composition
        id="HecKimDemedi"
        component={HecKimDemedi}
        durationInFrames={630}
        fps={30}
        width={1080}
        height={1920}
      />
    </Folder>
  );
};
