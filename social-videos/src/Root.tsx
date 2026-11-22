import { Composition, Folder } from "remotion";
import { AnaLugeti } from "./ana-lugeti/AnaLugeti";
import { Axtaris } from "./axtaris/Axtaris";
import { Bildiris } from "./bildiris/Bildiris";
import { color } from "./brand";
import { BuSaniye } from "./bu-saniye/BuSaniye";
import { NenemDeyirdi } from "./nenem-deyirdi/NenemDeyirdi";
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
      <Composition
        id="NenemDeyirdi10"
        component={NenemDeyirdi}
        durationInFrames={705}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "HAMİLƏLİK",
          number: "10",
          endLine1: "Nənəni sev,",
          endLine2: "həkimdən soruş.",
          endChip: "Sənin nənən nə deyirdi?",
          sayings: [
            {
              quote: "Qarın sivridirsə, oğlandır.",
              verdict: "mif",
              note: "Forma bədən quruluşundan və\nkörpənin duruşundan asılıdır.",
              fill: color.alliq,
            },
            {
              quote: "İndi iki nəfərlik yeməlisən.",
              verdict: "mif",
              note: "İki dəfə çox yox,\niki dəfə keyfiyyətli.",
              fill: color.seftali,
            },
            {
              quote: "Qıcqırman çoxdursa, körpə saçlı doğulacaq.",
              verdict: "belke",
              note: "Kiçik bir araşdırma həqiqətən\nbelə bir əlaqə tapıb.",
              fill: color.pembe,
            },
            {
              quote: "Hamilə qadın çox gəzməlidir.",
              verdict: "dogru",
              note: "Həkimin qadağan etməyibsə,\nhərəkət ikinizə də xeyirdir.",
              fill: color.alliq,
            },
          ],
        }}
      />
      <Composition
        id="NenemDeyirdi11"
        component={NenemDeyirdi}
        durationInFrames={705}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "ANALIQ",
          number: "11",
          endLine1: "Nənəni sev,",
          endLine2: "həkimdən soruş.",
          endChip: "Sənin nənən nə deyirdi?",
          sayings: [
            {
              quote: "Uşağı qucağa öyrətmə.",
              verdict: "mif",
              note: "Yenidoğulmuşu qucaqla ərköyün etmək\nolmur. Qucaq ona güvən verir.",
              fill: color.pembe,
            },
            {
              quote: "Diş çıxarır, ona görə qızdırması var.",
              verdict: "mif",
              note: "Diş yüngül narahatlıq verə bilər.\nYüksək qızdırmada həkimə göstər.",
              fill: color.alliq,
            },
            {
              quote: "Su ver, uşaq susayıb.",
              verdict: "mif",
              note: "İlk 6 ayda ana südü və ya\nqarışıq suyu da əvəz edir.",
              fill: color.seftali,
            },
            {
              quote: "Uşaq yatanda sən də yat.",
              verdict: "dogru",
              note: "Nənə burada haqlıdır.\nQab-qacaq gözləyə bilər.",
              fill: color.pembe,
            },
          ],
        }}
      />
      <Composition
        id="AnaLugeti12"
        component={AnaLugeti}
        durationInFrames={705}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "ANALIQ",
          number: "12",
          endLine1: "analıq (isim):",
          endLine2: "dünyanın ən yorucu sevgisi.",
          endChip: "Sənin lüğətində hansı söz var?",
          entries: [
            {
              word: "yuxu",
              meta: "[yu-xu] · isim",
              definition: "Əvvəllər gecə etdiyim\nşey. İndi şayiə.",
              fill: color.alliq,
            },
            {
              word: "isti çay",
              meta: "[is-ti çay] · isim",
              definition: "Əfsanəvi içki. Görən\nolub, içən olmayıb.",
              fill: color.seftali,
            },
            {
              word: "beş dəqiqə",
              meta: "[beş də-qi-qə] · zaman",
              definition: "Duş, yemək və istirahət\nüçün ayrılan ümumi vaxt.",
              fill: color.pembe,
            },
            {
              word: "sakitlik",
              meta: "[sa-kit-lik] · isim",
              definition: "Şübhəli vəziyyət.\nDərhal yoxlanmalıdır.",
              fill: color.alliq,
            },
          ],
        }}
      />
      <Composition
        id="AnaLugeti13"
        component={AnaLugeti}
        durationInFrames={705}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "HAMİLƏLİK",
          number: "13",
          endLine1: "hamilə (sifət):",
          endLine2: "iki ürəkli.",
          endChip: "Sənin lüğətində hansı söz var?",
          entries: [
            {
              word: "istək",
              meta: "[is-tək] · isim",
              definition: "Gecə saat 3-də nar.\nMüzakirə olunmur.",
              fill: color.seftali,
            },
            {
              word: "yastıq",
              meta: "[yas-tıq] · isim",
              definition: "Biri azdır.\nDördü də azdır.",
              fill: color.pembe,
            },
            {
              word: "“yaxşıyam”",
              meta: "[yax-şı-yam] · ifadə",
              definition: "Yorğunam, acam, ağlamaq\nistəyirəm. Amma yaxşıyam.",
              fill: color.alliq,
            },
            {
              word: "təpik",
              meta: "[tə-pik] · isim",
              definition: "Dünyanın ən gözəl\noyadıcı zəngi.",
              fill: color.seftali,
            },
          ],
        }}
      />
      <Composition
        id="AnaLugeti14"
        component={AnaLugeti}
        durationInFrames={705}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "ANALIQ",
          number: "14",
          endLine1: "ana (isim):",
          endLine2: "hər şeyə çatan ürək.",
          endChip: "Sənin lüğətində hansı söz var?",
          entries: [
            {
              word: "bircə dəqiqə",
              meta: "[bir-cə də-qi-qə] · ifadə",
              definition: "Ananın dilində:\niyirmi dəqiqə.",
              fill: color.pembe,
            },
            {
              word: "çanta",
              meta: "[çan-ta] · isim",
              definition: "Evin yarısı.\nHər ehtimala qarşı.",
              fill: color.alliq,
            },
            {
              word: "foto",
              meta: "[fo-to] · isim",
              definition: "Telefonda 4.000 ədəd.\nHamısı eyni, hamısı lazım.",
              fill: color.seftali,
            },
            {
              word: "qucaq",
              meta: "[qu-caq] · isim",
              definition: "Hər dərdin dərmanı.\nReseptsiz.",
              fill: color.pembe,
            },
          ],
        }}
      />
      <Composition
        id="Axtaris15"
        component={Axtaris}
        durationInFrames={735}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "ANALIQ",
          number: "15",
          endLine1: "Bunu soruşan",
          endLine2: "hər ana yaxşı anadır.",
          endChip: "Sən gecə nə axtarırsan?",
          queries: [
            { time: "23:10", text: "körpə neçə saat yatmalıdır" },
            { time: "00:42", text: "körpə niyə yatmır" },
            { time: "01:57", text: "körpə hıçqırır normaldır" },
            { time: "03:05", text: "yuxusuz neçə gün yaşamaq olar" },
            { time: "03:41", text: "mən yaxşı anayam?" },
          ],
        }}
      />
      <Composition
        id="Axtaris16"
        component={Axtaris}
        durationInFrames={735}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "HAMİLƏLİK",
          number: "16",
          endLine1: "Bunu soruşan",
          endLine2: "artıq yaxşı anadır.",
          endChip: "Sən ilk nəyi axtardın?",
          queries: [
            { time: "09:12", text: "test iki xətt, biri solğun" },
            { time: "09:13", text: "solğun xətt də sayılır?" },
            { time: "14:30", text: "hamiləlikdə qəhvə olar" },
            { time: "22:48", text: "körpə nə vaxt təpik vurur" },
            { time: "02:16", text: "yaxşı ana ola biləcəm?" },
          ],
        }}
      />
      <Composition
        id="Axtaris17"
        component={Axtaris}
        durationInFrames={735}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "ANALIQ",
          number: "17",
          endLine1: "Vaxt tez keçir.",
          endLine2: "Bu günü saxla.",
          endChip: "Sən bu gün nə axtardın?",
          queries: [
            { time: "10:05", text: "körpə nə vaxt oturur" },
            { time: "10:06", text: "qonşunun uşağı artıq oturur" },
            { time: "15:20", text: "uşaq hər şeyi ağzına aparır" },
            { time: "19:44", text: "uşaq torpaq yedi nə etməli" },
            { time: "23:58", text: "niyə bu qədər tez böyüyür" },
          ],
        }}
      />
      <Composition
        id="Bildiris18"
        component={Bildiris}
        durationInFrames={570}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "ANALIQ",
          number: "18",
          clock: "08:00",
          day: "çərşənbə",
          endLine1: "Ananı da",
          endLine2: "soruşan olsun.",
          endChip: "Bəs sən bu gün necəsən?",
          notifications: [
            {
              from: "Qayınana",
              time: "08:12",
              text: "Uşağı qalın geyindir, bayır soyuqdur.",
              tint: color.pembe,
            },
            {
              from: "İş qrupu",
              time: "10:47",
              text: "Bilirik, məzuniyyətdəsən. Bircə sual…",
              tint: color.alliq,
            },
            {
              from: "Yoldaşım",
              time: "13:20",
              text: "Axşama nə bişirəcəksən?",
              tint: color.seftali,
            },
            {
              from: "Analar qrupu",
              time: "16:05",
              text: "Sizinki hələ iməkləmir?",
              tint: color.pembe,
            },
            {
              from: "Anam",
              time: "19:38",
              text: "Uşağın bugünkü şəklini at, darıxmışam.",
              tint: color.alliq,
            },
            {
              from: "Anacan",
              time: "22:30",
              text: "Bu gün hamı səndən nəsə istədi.\nBəs sən necəsən?",
              tint: color.mercan,
            },
          ],
        }}
      />
      <Composition
        id="Bildiris19"
        component={Bildiris}
        durationInFrames={570}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "HAMİLƏLİK",
          number: "19",
          clock: "08:00",
          day: "cümə",
          endLine1: "Körpədən əvvəl",
          endLine2: "ananı soruş.",
          endChip: "Səndən bu gün kim soruşdu?",
          notifications: [
            {
              from: "Anam",
              time: "08:30",
              text: "Səhər yeməyini yemisən? Uşaq ac qalmasın.",
              tint: color.pembe,
            },
            {
              from: "Qayınana",
              time: "11:15",
              text: "Cinsi bilindi? Mən deyirəm oğlandır.",
              tint: color.alliq,
            },
            {
              from: "Rəfiqələr",
              time: "13:40",
              text: "Adını seçdiniz? Bizə niyə demirsən?",
              tint: color.seftali,
            },
            {
              from: "Yoldaşım",
              time: "16:20",
              text: "Bu gün təpik vurdu? Videosunu at.",
              tint: color.pembe,
            },
            {
              from: "Xalam",
              time: "19:05",
              text: "Qarnın böyüyüb? Şəkil göndər görək.",
              tint: color.alliq,
            },
            {
              from: "Anacan",
              time: "21:45",
              text: "Bu gün hamı körpəni soruşdu.\nBəs sən necəsən?",
              tint: color.mercan,
            },
          ],
        }}
      />
      <Composition
        id="Bildiris20"
        component={Bildiris}
        durationInFrames={570}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "ANALIQ",
          number: "20",
          clock: "09:00",
          day: "bazar ertəsi",
          endLine1: "Söz çoxdur.",
          endLine2: "Dəstək də olsun.",
          endChip: "Sənə ən çox nə deyirlər?",
          notifications: [
            {
              from: "Qonşu",
              time: "09:05",
              text: "Uşaq gecə yaman ağlayırdı. Nəsə olub?",
              tint: color.pembe,
            },
            {
              from: "Qayınana",
              time: "11:30",
              text: "Günorta gəlirik. Zəhmət çəkmə, çay bəsdir.",
              tint: color.alliq,
            },
            {
              from: "Rəfiqəm",
              time: "14:10",
              text: "Hələ də evdəsən? Çıx bir az gəz.",
              tint: color.seftali,
            },
            {
              from: "Bibim",
              time: "16:45",
              text: "Uşağı niyə belə nazik geyindirmisən?",
              tint: color.pembe,
            },
            {
              from: "Yoldaşım",
              time: "20:20",
              text: "Gecikirəm. Məni gözləmə, yat.",
              tint: color.alliq,
            },
            {
              from: "Anacan",
              time: "23:10",
              text: "Bu gün çox söz eşitdin.\nBunu da eşit: sən yaxşı anasan.",
              tint: color.mercan,
            },
          ],
        }}
      />
    </Folder>
  );
};
