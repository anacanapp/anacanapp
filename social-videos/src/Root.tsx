import { Composition, Folder } from "remotion";
import { color } from "./brand";
import { BuSaniye } from "./bu-saniye/BuSaniye";
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
          label: "ANALIQ",
          number: "01",
          endLine1: "Biz deyirik:",
          endLine2: "tək deyilsən.",
          endChip: "Bəs sənə nəyi demədilər?",
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
          label: "ANALIQ",
          number: "02",
          endLine1: "Biz deyirik:",
          endLine2: "tək deyilsən.",
          endChip: "Bəs sənə nəyi demədilər?",
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
      <Composition
        id="HecKimDemedi03"
        component={HecKimDemedi}
        durationInFrames={630}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "ANALIQ",
          number: "03",
          endLine1: "İndi bilirsən:",
          endLine2: "hər şeyə dəyər.",
          endChip: "Bəs səni nə təəccübləndirdi?",
          bubbles: [
            {
              text: "…ilk gülüşü bütün yuxusuz\ngecələri unutduracaq.",
              lines: 2,
              side: "left",
              fill: color.pembe,
            },
            {
              text: "…barmağımı tutan o balaca\nəl dünyanı dayandıracaq.",
              lines: 2,
              side: "right",
              fill: color.seftali,
            },
            {
              text: "…qoxusunu hər şeydən\nçox sevəcəm.",
              lines: 2,
              side: "left",
              fill: color.alliq,
            },
            {
              text: "…“ana” sözü\nmənim adım olacaq.",
              lines: 2,
              side: "right",
              fill: color.pembe,
            },
            {
              text: "…özümdə bu qədər\ngüc tapacam.",
              lines: 2,
              side: "left",
              fill: color.seftali,
            },
            {
              text: "…ürəyim artıq məndən\nkənarda gəzəcək.",
              lines: 2,
              side: "right",
              fill: color.alliq,
            },
          ],
        }}
      />
      <Composition
        id="BuSaniye"
        component={BuSaniye}
        durationInFrames={660}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ number: "04" }}
      />
      <Composition
        id="HecKimDemedi05"
        component={HecKimDemedi}
        durationInFrames={630}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "HAMİLƏLİK",
          number: "05",
          endLine1: "Biz deyirik:",
          endLine2: "tək deyilsən.",
          endChip: "Bəs sənə nəyi demədilər?",
          bubbles: [
            {
              text: "…ilk üç ayda bu qədər\nyorğun olacam.",
              lines: 2,
              side: "left",
              fill: color.alliq,
            },
            {
              text: "…“səhər” ürəkbulanması\nbütün günü davam edəcək.",
              lines: 2,
              side: "right",
              fill: color.seftali,
            },
            {
              text: "…sevdiyim yeməyin\niyindən qaçacam.",
              lines: 2,
              side: "left",
              fill: color.pembe,
            },
            {
              text: "…hələ heç kim bilmir, amma\nmən hər saniyə bilirəm.",
              lines: 2,
              side: "right",
              fill: color.alliq,
            },
            {
              text: "…bir testə bu qədər\nuzun-uzun baxacam.",
              lines: 2,
              side: "left",
              fill: color.seftali,
            },
            {
              text: "…sevinclə qorxu eyni\nanda gələ bilər.",
              lines: 2,
              side: "right",
              fill: color.pembe,
            },
          ],
        }}
      />
      <Composition
        id="HecKimDemedi06"
        component={HecKimDemedi}
        durationInFrames={630}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "HAMİLƏLİK",
          number: "06",
          endLine1: "Biz deyirik:",
          endLine2: "bu da keçəcək.",
          endChip: "Səndə hansı oldu?",
          bubbles: [
            {
              text: "…ayaqqabılarım bir ölçü\nbalaca gələcək.",
              lines: 2,
              side: "left",
              fill: color.seftali,
            },
            {
              text: "…gecə üç dəfə tualetə\nqalxmaq adi hal olacaq.",
              lines: 2,
              side: "right",
              fill: color.pembe,
            },
            {
              text: "…corabımı geyinmək\nidman sayılacaq.",
              lines: 2,
              side: "left",
              fill: color.alliq,
            },
            {
              text: "…yatmaq üçün dörd\nyastıq lazım olacaq.",
              lines: 2,
              side: "right",
              fill: color.seftali,
            },
            {
              text: "…reklama baxıb\nağlayacam.",
              lines: 2,
              side: "left",
              fill: color.pembe,
            },
            {
              text: "…qarnım hamının toxunmaq\nistədiyi yer olacaq.",
              lines: 2,
              side: "right",
              fill: color.alliq,
            },
          ],
        }}
      />
      <Composition
        id="HecKimDemedi07"
        component={HecKimDemedi}
        durationInFrames={630}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "HAMİLƏLİK",
          number: "07",
          endLine1: "İndi bilirsən:",
          endLine2: "möcüzə səndədir.",
          endChip: "Bəs səni nə təəccübləndirdi?",
          bubbles: [
            {
              text: "…ilk təpiyi hiss edəndə\nnəfəsim kəsiləcək.",
              lines: 2,
              side: "left",
              fill: color.pembe,
            },
            {
              text: "…ürək döyüntüsünü\neşidib ağlayacam.",
              lines: 2,
              side: "right",
              fill: color.alliq,
            },
            {
              text: "…hələ görmədiyim birini\nbu qədər sevəcəm.",
              lines: 2,
              side: "left",
              fill: color.seftali,
            },
            {
              text: "…qarnımla saatlarla\ndanışacam.",
              lines: 2,
              side: "right",
              fill: color.pembe,
            },
            {
              text: "…bədənimə heyran\nqalacam.",
              lines: 2,
              side: "left",
              fill: color.alliq,
            },
            {
              text: "…artıq heç vaxt tək\nolmayacam.",
              lines: 2,
              side: "right",
              fill: color.seftali,
            },
          ],
        }}
      />
      <Composition
        id="HecKimDemedi08"
        component={HecKimDemedi}
        durationInFrames={630}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "HAMİLƏLİK",
          number: "08",
          endLine1: "Biz deyirik:",
          endLine2: "özünə qulaq as.",
          endChip: "Sənə ən çox nə dedilər?",
          bubbles: [
            {
              text: "…hamı qarnıma baxıb\ncinsini “biləcək”.",
              lines: 2,
              side: "left",
              fill: color.alliq,
            },
            {
              text: "…hər kəsin bir doğuş\nhekayəsi olacaq. Qorxulusu.",
              lines: 2,
              side: "right",
              fill: color.seftali,
            },
            {
              text: "…“iki nəfərlik ye” sözünü\ngündə beş dəfə eşidəcəm.",
              lines: 2,
              side: "left",
              fill: color.pembe,
            },
            {
              text: "…ad seçmək ailə\nşurasına çevriləcək.",
              lines: 2,
              side: "right",
              fill: color.alliq,
            },
            {
              text: "…“hələ doğmamısan?” sualı\nmənə zarafat gəlməyəcək.",
              lines: 2,
              side: "left",
              fill: color.seftali,
            },
            {
              text: "…ən yaxşı məsləhət\n“özünə qulaq as” olacaq.",
              lines: 2,
              side: "right",
              fill: color.pembe,
            },
          ],
        }}
      />
      <Composition
        id="HecKimDemedi09"
        component={HecKimDemedi}
        durationInFrames={630}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "HAMİLƏLİK",
          number: "09",
          endLine1: "Biz deyirik:",
          endLine2: "sən hazırsan.",
          endChip: "Sən neçənci həftədəsən?",
          bubbles: [
            {
              text: "…son ay ən uzun\nay olacaq.",
              lines: 2,
              side: "left",
              fill: color.seftali,
            },
            {
              text: "…xəstəxana çantasını üç\ndəfə yenidən yığacam.",
              lines: 2,
              side: "right",
              fill: color.pembe,
            },
            {
              text: "…hər sancıda “vaxtdır?”\ndeyə düşünəcəm.",
              lines: 2,
              side: "left",
              fill: color.alliq,
            },
            {
              text: "…yatmaq istəyəcəm, amma\nrahat yer tapmayacam.",
              lines: 2,
              side: "right",
              fill: color.seftali,
            },
            {
              text: "…balaca paltarları\nqatlayıb ağlayacam.",
              lines: 2,
              side: "left",
              fill: color.pembe,
            },
            {
              text: "…qorxacam. Və yenə də\nhazır olacam.",
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
