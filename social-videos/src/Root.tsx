import { Composition, Folder } from "remotion";
import { color } from "./brand";
import { HecKimDemedi } from "./hec-kim-demedi/HecKimDemedi";

export const RemotionRoot = () => {
  return (
    <Folder name="Social">
      <Composition
        id="HecKimDemedi01"
        component={HecKimDemedi}
        durationInFrames={630}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          number: "01",
          bubbles: [
            {
              text: "…doğuşdan sonra da\n6 aylıq hamilə kimi\ngörünəcəm.",
              lines: 3,
              side: "left",
              fill: color.alliq,
            },
            {
              text: "…duşa girmək günün\nən böyük uğuru olacaq.",
              lines: 2,
              side: "right",
              fill: color.seftali,
            },
            {
              text: "…əmizdirmək təbiidir,\namma asan deyil.",
              lines: 2,
              side: "left",
              fill: color.pembe,
            },
            {
              text: "…gecə saat 3-də ağlayan\ntəkcə körpə olmayacaq.",
              lines: 2,
              side: "right",
              fill: color.alliq,
            },
            {
              text: "…sevgi bəzən dərhal yox,\nyavaş-yavaş gəlir.",
              lines: 2,
              side: "left",
              fill: color.seftali,
            },
            {
              text: "…anamı bu qədər\nbaşa düşəcəm.",
              lines: 2,
              side: "right",
              fill: color.pembe,
            },
          ],
        }}
      />
      <Composition
        id="HecKimDemedi02"
        component={HecKimDemedi}
        durationInFrames={630}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          number: "02",
          bubbles: [
            {
              text: "…yuxusuzluq yorğunluq deyil,\nbambaşqa bir şeydir.",
              lines: 2,
              side: "left",
              fill: color.seftali,
            },
            {
              text: "…körpə yatanda mən\nyatmayacam. Ona baxacam.",
              lines: 2,
              side: "right",
              fill: color.pembe,
            },
            {
              text: "…soyuq çay içməyə\nöyrəşəcəm.",
              lines: 2,
              side: "left",
              fill: color.alliq,
            },
            {
              text: "…hamı məsləhət verəcək,\namma heç kim soruşmayacaq:\n“Sən necəsən?”",
              lines: 3,
              side: "right",
              fill: color.seftali,
            },
            {
              text: "…bədənimi yenidən\ntanımalı olacam.",
              lines: 2,
              side: "left",
              fill: color.pembe,
            },
            {
              text: "…bu qədər yorulub\nbu qədər sevəcəm.",
              lines: 2,
              side: "right",
              fill: color.alliq,
            },
          ],
        }}
      />
    </Folder>
  );
};
