import type { MilestoneQuiz, StyleQuiz } from '../types';
import { S } from './sources';

export const STYLE_QUIZ: StyleQuiz = {
  id: 'style',
  emoji: '🪞',
  title: 'Minu kasvatusstiil',
  intro: '12 lühikest väidet. Mõtle viimasele kahele nädalale ja vasta ausalt — siin pole õigeid ega valesid vastuseid. Tulemus jääb ainult sinu telefoni.',
  scale: ['Peaaegu mitte kunagi', 'Mõnikord', 'Sageli', 'Peaaegu alati'],
  items: [
    { text: 'Kui mu laps on kurb või vihane, nimetan ma tema tunde ja olen tema kõrval.', dim: 'warmth' },
    { text: 'Leian päeva jooksul aega teda kallistada, temaga naerda ja öelda „ma armastan sind“.', dim: 'warmth' },
    { text: 'Kui mu laps räägib, panen telefoni käest ja kuulan.', dim: 'warmth' },
    { text: 'Märkan tema head käitumist ja nimetan selle.', dim: 'warmth' },
    { text: 'Meil on kodus mõned selged reeglid, mida mu laps teab.', dim: 'structure' },
    { text: 'Kui olen reegli seadnud, pean sellest rahulikult kinni.', dim: 'structure' },
    { text: 'Meie päevarütm (söök, uni) on enam-vähem püsiv.', dim: 'structure' },
    { text: 'Kui mu laps nutab või käib peale, loobun oma „ei“-st.', dim: 'giveIn' },
    { text: 'Väsinuna lasen reeglitel täiesti minna — „tehku, mida tahab“.', dim: 'giveIn' },
    { text: 'Närvi minnes tõstan häält või karjun.', dim: 'harsh' },
    { text: 'Ähvardan oma last („ma jätan su siia“, „ma annan su politseile“).', dim: 'harsh' },
    { text: 'Vihahoos tekib mul tahtmine teda lüüa või karmilt öelda ja mõnikord ma seda ka teen.', dim: 'harsh' },
  ],
  results: {
    balanced: {
      title: 'Soe ja selge',
      short: 'Sa näitad nii armastust kui ka sead selgeid piire — kombinatsioon, mida uuringud peavad kõige kasulikumaks.',
      detail: [
        'Psühholoogid nimetavad seda stiili „autoritatiivseks“: palju soojust ja palju struktuuri. Sellise stiiliga kasvanud lapsed on keskmiselt iseseisvamad ja enesekindlamad ning tulevad oma tunnetega paremini toime.',
        'See ei tähenda täiuslikkust. Ka sina väsid ja mõnikord saab kannatus otsa. Vahe teeb see, et pärast raskeid hetki pöördud sa suhte juurde tagasi.',
      ],
      next: ['Kui laps kasvab, hakka reegleid koos temaga looma.', 'Ära unusta enda eest hoolitseda: rahulikuks vanemaks olemiseks on vaja puhata.', 'Hoia alles „erilise aja“ harjumus — see on kõige tugevam „kindlustus“.'],
    },
    gentle: {
      title: 'Väga soe, piirid pehmed',
      short: 'Sa oled lapsega väga lähedane ja tundlik tema tunnete suhtes. Mõnikord on piiride hoidmine raske.',
      detail: [
        'Soojus on sinu suurim tugevus ja see on lapse turvalise kiindumuse jaoks hindamatu. Kuid lapsed katsetavad piire, et teada saada, kas need on paigas. Kui piir pehmeneb, katsetab laps rohkem ja vanem kurnatakse ära.',
        'Armastus ja piirid ei ole vastuolus. Ütlemine „ma armastan sind ja vastus on ikkagi ei“ annab lapsele turvatunde.',
      ],
      next: ['Vali 3–5 selget pere reeglit ja rakenda neid rahulikult.', 'Näita jonnihoo ajal empaatiat, kuid ära muuda otsust.', 'Proovi programmi „21 päeva karjumata“ sammu „üks lause, üks kord“.'],
    },
    storm: {
      title: 'Armastav, kuid väsinuna plahvatav',
      short: 'Sa oled lapsega väga seotud, kuid stressirohketel hetkedel hääl tõuseb. See on paljudele vanematele tuttav olukord.',
      detail: [
        'Sinu soojus on tugev vundament. Karjumine ja karmid sõnad tulenevad aga sageli väsimusest, kiirustamisest ja üksi jäämisest, mitte armastuse puudumisest.',
        'Uuringud näitavad, et isegi kui suhe on soe, mõjub regulaarne karjumine lapse käitumisele halvasti. Hea uudis: eneseregulatsioon on õpitav oskus ja parandavad vestlused kaitsevad suhet.',
      ],
      next: ['Leia oma päästikud: millised kellaajad, millised olukorrad?', 'Alusta „pausinupu“ ja pika väljahingamisega.', 'Programm „21 päeva karjumata“ on just sulle.'],
    },
    strict: {
      title: 'Piirid tugevad, soojus peidus',
      short: 'Sa väärtustad korda ja reegleid. Mõnikord tuleb see soojuse ja kuulamise arvelt.',
      detail: [
        'Reeglid ja järjepidevus on lapse jaoks olulised — see on sinu tugevus. Kuid karmi kontrolli ja karistustega seatud piirid ei vähenda uuringute järgi pikaajalisi käitumisprobleeme, vaid võivad neid hoopis suurendada.',
        'Reegleid säilitades saab soojust lisada: selgitada, tundeid nimetada, head käitumist märgata.',
      ],
      next: ['Iga päev 10 minutit mänguaega, mida juhib laps.', 'Kasuta karistuse asemel loogilisi tagajärgi.', 'Selgita üht reeglit: „See reegel on olemas, sest…“'],
    },
    stretched: {
      title: 'Väsinud ja kurnatud',
      short: 'Paistab, et oled viimasel ajal väga väsinud. See ei tähenda, et oled halb vanem, vaid on märk toevajadusest.',
      detail: [
        'Kui vanem on kurnatud, ei jätku jõudu ei soojuseks ega struktuuriks. See on väga levinud ja mõistetav olukord, eriti kui on beebi, unepuudus, töö ja üksi olemine.',
        'See tulemus ei ole süüdistus, vaid näitab, et ka sina vajad hoolt. Väikesed sammud ja abi palumine võivad kõike muuta.',
      ],
      next: ['Jaga koormat: lepi partneri, pere või sõpradega kokku konkreetne abi.', 'Üks 5-minutiline lähedushetk päevas: ainult kallistus ja silmside.', 'Kui tunned üle kahe nädala kurbust või lootusetust, räägi arsti või psühholoogiga.'],
    },
  },
  note: 'See test ei ole diagnoos, vaid lihtne vahend enesevaatluseks. See põhineb Baumrindi soojuse ja struktuuri mõõtmetel.',
  sources: [S.baumrind1966, S.baumrind1967, S.pinquart2017, S.wangKenny2014],
};

export const MILESTONE_QUIZ: MilestoneQuiz = {
  id: 'milestones',
  emoji: '🧩',
  title: 'Mida mu laps peaks selles eas oskama?',
  intro: 'Lühike kontroll, mis põhineb CDC ja Ameerika Pediaatria Akadeemia arenguetappidel. Enamik lapsi (umbes 3 last 4-st) näitab selles eas neid oskusi. Iga laps areneb oma tempos.',
  answers: { yes: 'Jah', no: 'Veel mitte', unsure: 'Ei ole kindel' },
  regression: 'Kas ta on kaotanud mõne oskuse, mis tal varem oli (sõna, mäng, liigutus)?',
  checkpoints: [
    {
      id: 'm4',
      fromMonths: 4,
      title: '4 kuud',
      items: [
        { text: 'Naeratab sind nähes ise ja püüab sinu tähelepanu köita.', flag: true, support: 'Veeda palju aega näost näkku: naerata, oota, vasta tema naeratusele.' },
        { text: 'Teeb häälitsusi nagu „a-a“, „u-u“ ja vastab häälega, kui sina räägid.', support: 'Jäljenda tema häälitsusi ja tee siis paus, et ta saaks „vastata“.' },
        { text: 'Pöörab hääle kuuldes pea hääle poole.', flag: true, support: 'Kutsu teda pehme häälega nimepidi eri suundadest.' },
        { text: 'Süles olles hoiab pead toeta stabiilselt.', support: 'Ärkveloleku ajal mitu korda päevas lühike „kõhuliaeg“.' },
        { text: 'Haarab kätte antud mänguasjast ja hoiab seda.', support: 'Anna kergeid, hästi haaratavaid kõristeid.' },
        { text: 'Kõhuli olles toetub küünarnukkidele ja tõstab pead.', support: 'Pane tema ette peegel või värviline mänguasi.' },
      ],
    },
    {
      id: 'm9',
      fromMonths: 9,
      title: '9 kuud',
      items: [
        { text: 'Vaatab, kui teda nimepidi kutsutakse.', flag: true, support: 'Kasuta tema nime mängudes sageli, naerata ja kiida, kui ta vaatab.' },
        { text: 'Ütleb erinevaid silpe nagu „ma-ma-ma“, „ba-ba-ba“.', flag: true, support: 'Korrake silpe koos, laula laule.' },
        { text: 'Tõstab käed, et teda sülle võetaks.', support: 'Küsi enne ülesvõtmist: „Sülle?“ ja oota, et ta käed avaks.' },
        { text: 'Vaatab mahakukkunud eseme järele ja otsib seda.', support: 'Mängi peitust ja mängu „kus mänguasi on?“.' },
        { text: 'Istub toeta.', support: 'Anna põrandal turvalist mänguaega ja kaitse istumist patjadega.' },
        { text: 'Pelgab võõraid või otsib sinu juurest varju.', support: 'See on kiindumuse märk. Ära kiirusta uute inimestega tutvumisega.' },
      ],
    },
    {
      id: 'm18',
      fromMonths: 18,
      title: '18 kuud',
      items: [
        { text: 'Osutab sõrmega, et näidata sulle midagi huvitavat.', flag: true, support: 'Näita ja nimeta ka ise: „Vaata, lind!“ Kui ta näitab, vasta innukalt.' },
        { text: 'Ütleb lisaks sõnadele „emme, issi“ vähemalt 3 sõna.', flag: true, support: 'Räägi igapäevatoimetuste ajal ja laienda tema sõnu.' },
        { text: 'Täidab lihtsa korralduse ilma žestita („anna pall“).', support: 'Ütle korraldus lühidalt ja täna rõõmsalt, kui ta selle täidab.' },
        { text: 'Kõnnib toeta.', flag: true, support: 'Anna palju võimalusi liikuda paljajalu ja turvalises kohas.' },
        { text: 'Jäljendab sind kodutöödes (pühkimine, telefoniga rääkimine).', support: 'Anna väike hari, mängunõud ja „tehke tööd“ koos.' },
        { text: 'Sööb sõrmedega ise ja proovib lusikat kasutada.', support: 'Luba määrduda, paku näpuotsatoite.' },
      ],
    },
    {
      id: 'm30',
      fromMonths: 30,
      title: '2,5 aastat',
      items: [
        { text: 'Ütleb umbes 50 sõna.', support: 'Lugege koos raamatuid, nimetage pilte, esita avatud küsimusi.' },
        { text: 'Ühendab kaks sõna, millest üks on tegusõna („kiisu jookseb“).', flag: true, support: 'Laienda tema üht sõna kaheks: „Auto.“ — „Suur auto sõidab!“' },
        { text: 'Kasutab sõnu „mina“, „minu“, „meie“.', support: 'Ütle kordamööda mängides „minu kord, sinu kord“.' },
        { text: 'Mängib rollimänge (toidab nukku, sõidutab klotsi nagu autot).', flag: true, support: 'Liitu rollimänguga ja paku lihtsaid stsenaariume.' },
        { text: 'Täidab kaheosalise korralduse („võta mänguasi ja pane karpi“).', support: 'Anna korraldusi mängu kaudu ja harjutage kõigepealt ühte, siis kahte sammu.' },
        { text: 'Hüppab kahe jalaga maast lahti.', support: 'Hüppemängud õues, „jänkumäng“.' },
      ],
    },
    {
      id: 'm48',
      fromMonths: 48,
      title: '4 aastat',
      items: [
        { text: 'Moodustab 4- ja enamasõnalisi lauseid.', flag: true, support: 'Rääkige päevast ja laiendage tema lugu küsimustega.' },
        { text: 'Jutustab millestki, mis päeva jooksul juhtus.', support: 'Pidage õhtul juttu „päeva parimast hetkest“.' },
        { text: 'Muutub mängus kellekski teiseks (õpetaja, superkangelane).', support: 'Anna aega ja vahendeid kostüümide ja rollimängude jaoks.' },
        { text: 'Naudib teiste lastega mängimist ja lohutab neid.', flag: true, support: 'Korralda sõpradega lühikesi kohtumisi ja aita tundeid nimetada.' },
        { text: 'Nimetab mõnda värvi.', support: 'Nimetage igapäevaelus värve ja tehke sellest mäng.' },
        { text: 'Püüab suure palli enamasti kinni, hoiab pliiatsit sõrmedega.', support: 'Pallimängud, joonistamine, plastiliin.' },
      ],
    },
    {
      id: 'y6',
      fromMonths: 72,
      title: 'Kooliiga (6–12)',
      items: [
        { text: 'Teeb igapäevase enesehoolduse (riietumine, hambapesu) enamasti ise.', support: 'Anna eakohast iseseisvust ja toeta pildiliste rutiinidega.' },
        { text: 'Tal on vähemalt üks sõber, kellega ta naudib mängimist.', flag: true, support: 'Loo võimalusi sõprussuheteks ja harjutage kodus sotsiaalseid oskusi.' },
        { text: 'Järgib mängureegleid ja oskab oma järjekorda oodata.', support: 'Mängige perega reeglitega lauamänge.' },
        { text: 'Oskab oma tundeid sõnadega selgitada.', support: 'Tee tunnetest rääkimine igapäevaseks harjumuseks.' },
        { text: 'Lugemis- ja arvutamisoskus areneb klassitasemele vastavalt.', flag: true, support: 'Hoia õpetajaga ühendust, lugege koos, tunnusta tema pingutust.' },
        { text: 'Rahuneb pärast närvi minekut mõistliku aja jooksul.', support: 'Valige ja harjutage koos rahunemisvõtteid.' },
      ],
    },
  ],
  results: {
    ontrack: {
      title: 'Kõik on õigel teel',
      short: 'Sinu laps näitab enamikku selle vanuse jaoks oodatud oskustest.',
      detail: [
        'Kui on vastuseid „veel mitte“, ära muretse: lapsed omandavad mõned oskused veidi hiljem, teised aga varem.',
        'Esita igal arstivisiidil oma küsimused arengu kohta — see on parim viis arengut jälgida.',
      ],
    },
    watch: {
      title: 'Mõned oskused alles kujunevad',
      short: 'Mõned vastused on „veel mitte“ või „ei ole kindel“. Neid oskusi saad toetada igapäevase mänguga.',
      detail: [
        'Toeta allolevate nõuannetega 4–6 nädalat ja kontrolli siis uuesti.',
        'Kui mure püsib, räägi lastearstiga järgmist visiiti ootamata. Varajane tugi on alati parem kui ootamine.',
      ],
    },
    talk: {
      title: 'Soovitame rääkida lastearstiga',
      short: 'Mõned vastused on märgid, mida arst peaks vaatama. See ei ole diagnoos, kuid oodata pole vaja.',
      detail: [
        'Oskuste kadumine (tagasiminek) või oluliste arenguetappide hilinemine vajab varajast hindamist. Varakult alustatud tugi annab parima tulemuse.',
        'Arsti juurde minnes võid seda nimekirja näidata.',
      ],
    },
  },
  note: 'See kontroll ei ole sõeluuringuvahend ega diagnoos. Kui sul on muret, pöördu tulemusest sõltumata arsti poole.',
  sources: [S.zubler2022, S.cdcActEarly],
};
