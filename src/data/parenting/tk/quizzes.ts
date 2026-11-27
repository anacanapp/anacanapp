import type { MilestoneQuiz, StyleQuiz } from '../types';
import { S } from './sources';

export const STYLE_QUIZ: StyleQuiz = {
  id: 'style',
  emoji: '🪞',
  title: 'Meniň terbiýe stilim',
  intro: '12 sany gysga tassyklama. Soňky iki hepdäni ýadyňyza salyň we dogruçyl jogap beriň — bu ýerde dogry ýa-da nädogry jogap ýok. Netijäňiz hasabyňyzda saklanýar we ony diňe siz görüp bilýärsiňiz.',
  scale: ['Hemen hiç haçan', 'Käte', 'Köplenç', 'Hemen hemişe'],
  items: [
    { text: 'Çagam gamgyn ýa-da gaharly bolanda, duýgyny atlandyrýaryn we onuň ýanynda galýaryn.', dim: 'warmth' },
    { text: 'Gün dowamynda ony gujaklamaga, bilelikde gülmäge we «seni söýýärin» diýmäge wagt tapýaryn.', dim: 'warmth' },
    { text: 'Çagam men bilen gürleşende, telefonymy bir gyra goýýaryn we diňleýärin.', dim: 'warmth' },
    { text: 'Onuň gowy hereketlerini görýärin we atlandyrýaryn.', dim: 'warmth' },
    { text: 'Öýümizde çagamyň bilýän birnäçe düşnükli düzgüni bar.', dim: 'structure' },
    { text: 'Bir düzgün goýanymdan soň, ony rahatlyk bilen ýerine ýetirýärin.', dim: 'structure' },
    { text: 'Gündelik tertibimiz (nahar, uky) azdan-kände durnukly.', dim: 'structure' },
    { text: 'Çagam aglasa ýa-da dyzap durup alsa, aýdan «ýok» sözümden dänýärin.', dim: 'giveIn' },
    { text: 'Ýadanymda düzgünleri düýbünden goýberýärin — «isleýänini etsin».', dim: 'giveIn' },
    { text: 'Bimaza bolanymda sesimi galdyrýaryn ýa-da gygyrýaryn.', dim: 'harsh' },
    { text: 'Çagamy gorkuzýaryn («seni şu ýerde taşlap giderin», «polisiýa jaň ederin»).', dim: 'harsh' },
    { text: 'Gaharly pursatlarda ony urmak ýa-da gödek sözler aýtmak islegini duýýaryn we käte şeýle edýärin.', dim: 'harsh' },
  ],
  results: {
    balanced: {
      title: 'Mähirli we düşnükli',
      short: 'Siz söýgiňizi görkezýärsiňiz we şol bir wagtda düşnükli çäkleri goýýarsyňyz — barlaglaryň iň peýdaly hasaplaýan utgaşmasy.',
      detail: [
        'Psihologlar bu stile «abraýly» diýýärler: ýokary mähir we ýokary tertip. Ortaça alanyňda, bu stilde terbiýelenen çagalar has özbaşdak, özüne has ynamly bolýarlar we duýgularyny has gowy dolandyrýarlar.',
        'Bu kämil bolmak diýmek däl. Siz hem ýadaýarsyňyz, käte sabryňyz hem gutarýar. Tapawudy kyn pursatlardan soň gatnaşyga gaýdyp gelmek döredýär.',
      ],
      next: ['Çagaňyz ulaldygyça düzgünleri onuň bilen bilelikde düzüp başlaň.', 'Öz-özüňize ideg etmegi unutmaň: rahat ene-ata bolmak üçin dynç almak gerek.', '«Aýratyn wagt» endigiňizi goraň — bu siziň iň güýçli «ätiýaçlandyryşyňyz».'],
    },
    gentle: {
      title: 'Örän mähirli, ýumşak çäkler',
      short: 'Siz çagaňyza örän ýakyn we onuň duýgularyna duýgur. Käte çäkleri saklamak kyn bolýar.',
      detail: [
        'Mähir siziň iň uly güýjüňiz we çagaňyzyň ygtybarly baglanyşygy üçin bahasyz. Ýöne çagalar çäkleriň henizem ýerindedigini bilmek üçin olary synaýarlar. Çäkler ýumşanda çagalar has köp synaýarlar — ene-ata bolsa halys bolýar.',
        'Söýgi we çäkler biri-birine garşy gelmeýär. «Men seni söýýärin, jogap bolsa barybir ýok» diýmek çaga howpsuzlyk duýgusyny berýär.',
      ],
      next: ['3–5 sany düşnükli maşgala düzgünini saýlaň we olary rahatlyk bilen ulanyň.', 'Gaharly tutgaýlarda duýgudaşlyk görkeziň, ýöne kararyňyzy üýtgetmäň.', '«Gygyryksyz 21 gün» programmasyndan «bir sözlem, bir gezek» ädimini synap görüň.'],
    },
    storm: {
      title: 'Söýýär, ýöne ýadanda partlaýar',
      short: 'Siz çagaňyza örän bagly, ýöne stresli pursatlarda sesiňiz galýar. Muny köp ene-atalar özünde görýär.',
      detail: [
        'Siziň mähriňiz berk binýat. Gygyryk we gödek sözler köplenç söýginiň ýetmezçiliginiň däl-de, ýadawlygyň, howlukmaçlygyň we ýeke galmagyň netijesidir.',
        'Barlaglar gatnaşyk mähirli bolsa-da, yzygiderli gygyrmagyň çagalaryň häsiýetine ýaramaz täsir edýändigini görkezýär. Gowy habar: özüňi dolandyrmak öwrenip bolýan endik, dikeltme gürrüňdeşlikleri bolsa gatnaşygy goraýar.',
      ],
      next: ['Gaharyňyzy getirýän zatlary tapyň: günüň haýsy wagty, haýsy ýagdaýlar?', '«Arakesme düwmesinden» we uzyn dem çykarmakdan başlaň.', '«Gygyryksyz 21 gün» programmasy edil siziň üçin döredildi.'],
    },
    strict: {
      title: 'Berk çäkler, gizlin mähir',
      short: 'Siz tertibe we düzgünlere uly baha berýärsiňiz. Käte bu mähriň we diňlemegiň hasabyna bolýar.',
      detail: [
        'Düzgünler we yzygiderlilik çagalar üçin möhüm — bu siziň güýçli tarapyňyz. Ýöne barlaglara görä, berk gözegçilik we jeza arkaly goýlan çäkler uzak möhletde häsiýet kynçylyklaryny azaltmaýar — hatda olary artdyryp hem biler.',
        'Düzgünleri saklap, has köp mähir goşup bilersiňiz: düşündirmek, duýgulary atlandyrmak, gowy hereketleri görmek.',
      ],
      next: ['Günde 10 minut çaganyň alyp barýan oýny.', 'Jezanyň deregine logiki netijeleri ulanyň.', 'Bir düzgüni düşündiriň: «Bizde şeýle düzgün bar, sebäbi…»'],
    },
    stretched: {
      title: 'Ýadaw we halys',
      short: 'Soňky döwürde gaty ýadan ýaly görünýärsiňiz. Bu sizi erbet ene-ata etmeýär — bu size goldawyň gerekdigini görkezýän signal.',
      detail: [
        'Ene-ata halys bolanda, ne mähre, ne-de tertibe güýç galýar. Bu, esasan, bäbek, uky ýetmezçiligi, iş we ýeke galmak bilen bilelikde, örän ýygy duş gelýän we düşnükli ýagdaý.',
        'Bu netije aýyplama däl — ol size hem idegiň gerekdigini görkezýär. Kiçijik ädimler we kömek soramak hemme zady üýtgedip biler.',
      ],
      next: ['Ýüki paýlaşyň: ýoldaşyňyz, maşgalaňyz ýa-da dostlaryňyz bilen takyk kömek barada ylalaşyň.', 'Günde bir 5 minutlyk ýakynlyk pursaty: diňe gujaklamak we göze seretmek.', 'Iki hepdeden köp gamgynlyk ýa-da umytsyzlyk duýýan bolsaňyz, lukman ýa-da psiholog bilen gürleşiň.'],
    },
  },
  note: 'Bu test diagnoz däl — öz-özüňe ser salmak üçin ýönekeý gural. Ol Baumrindiň mähir we tertip ölçeglerine esaslanýar.',
  sources: [S.baumrind1966, S.baumrind1967, S.pinquart2017, S.wangKenny2014],
};

export const MILESTONE_QUIZ: MilestoneQuiz = {
  id: 'milestones',
  emoji: '🧩',
  title: 'Çagam bu ýaşda näme edip bilmeli?',
  intro: 'CDC-niň we Amerikan Pediatriýa Akademiýasynyň ösüş tapgyrlaryna esaslanýan gysga barlag. Çagalaryň köpüsi (takmynan 4-den 3-si) bu ýaşda bu endikleri görkezýär. Her çaga öz depgininde ösýär.',
  answers: { yes: 'Hawa', no: 'Entek ýok', unsure: 'Bilemok' },
  regression: 'Öň bar bolan endigini (sözler, oýun, hereket) ýitirdimi?',
  checkpoints: [
    {
      id: 'm4',
      fromMonths: 4,
      title: '4 aýlyk',
      items: [
        { text: 'Sizi görende özbaşdak ýylgyrýar, ünsüňizi çekjek bolýar.', flag: true, support: 'Ýüzbe-ýüz köp wagt geçiriň: ýylgyryň, garaşyň, onuň ýylgyryşyna jogap beriň.' },
        { text: '«a-a», «u-u» ýaly sesler çykarýar we siz gürläniňizde ses bilen jogap berýär.', support: 'Onuň seslerini gaýtalaň, soňra «jogap berer» ýaly arakesme ediň.' },
        { text: 'Sesiňize tarap kellesini öwürýär.', flag: true, support: 'Dürli taraplardan ony ýuwaşlyk bilen ady bilen çagyryň.' },
        { text: 'Gujakda saklananda kellesini goldawsyz durnukly saklaýar.', support: 'Oýakka her gün birnäçe gysga gezek «garyn üstünde wagt».' },
        { text: 'Eline berlen oýnawajy tutup saklaýar.', support: 'Tutmagy aňsat, ýeňil şakyrdawuklar beriň.' },
        { text: 'Garnynyň üstünde ýatanda tirseklerine daýanyp kellesini galdyrýar.', support: 'Onuň öňünde aýna ýa-da reňkli oýnawaç goýuň.' },
      ],
    },
    {
      id: 'm9',
      fromMonths: 9,
      title: '9 aýlyk',
      items: [
        { text: 'Ady tutulanda seredýär.', flag: true, support: 'Oýunlarda onuň adyny ýygy-ýygydan tutuň, seredende ýylgyryň we öwüň.' },
        { text: '«ma-ma-ma», «ba-ba-ba» ýaly dürli bogunlary aýdýar.', flag: true, support: 'Bogunlary bilelikde gaýtalaň, aýdym aýdyň.' },
        { text: 'Gujaga alynmak üçin ellerini ýokary galdyrýar.', support: 'Gujaga almazdan öň: «Gujaga?» diýip soraň we elini açmagyna garaşyň.' },
        { text: 'Gözden gaýyp bolan zatlary gözleýär.', support: '«Tutdum-tapdym» we «oýnawaç nirede?» oýunlaryny oýnaň.' },
        { text: 'Goldawsyz oturýar.', support: 'Ýerde howpsuz oýun wagtyny beriň, oturanda ýassyklar bilen goraň.' },
        { text: 'Nätanyşlara seresaply garaýar ýa-da size ýapyşýar.', support: 'Bu baglanyşygyň alamaty. Täze adamlar bilen tanyşdyrmaga howlukmaň.' },
      ],
    },
    {
      id: 'm18',
      fromMonths: 18,
      title: '18 aýlyk',
      items: [
        { text: 'Size gyzykly bir zady görkezmek üçin barmagy bilen salgylaýar.', flag: true, support: 'Özüňiz hem görkeziň we atlandyryň: «Seret, guş!» Ol görkezende höwes bilen jogap beriň.' },
        { text: '«eje» we «kaka» sözlerinden başga iň bolmanda 3 söz aýdýar.', flag: true, support: 'Gündelik işleri sözläp ediň we onuň sözlerini giňeldiň.' },
        { text: 'Yşaratsyz ýönekeý tabşyrygy ýerine ýetirýär («topy maňa ber»).', support: 'Tabşyryklary gysga aýdyň, ýerine ýetirende begenip sag bol aýdyň.' },
        { text: 'Goldawsyz ýöreýär.', flag: true, support: 'Howpsuz ýerde ýalaňaýak hereket etmäge köp mümkinçilik beriň.' },
        { text: 'Öý işlerinde sizi gaýtalaýar (süpürýär, telefonda «gürleýär»).', support: 'Oňa kiçijik süpürgi ýa-da oýnawaç gap-gaç beriň we bilelikde «öý işini ediň».' },
        { text: 'Barmaklary bilen özbaşdak iýýär, çemçe ulanmaga synanyşýar.', support: 'Bulaşmaga ýol beriň we barmak bilen iýip bolýan iýmitleri hödürläň.' },
      ],
    },
    {
      id: 'm30',
      fromMonths: 30,
      title: '2½ ýaş',
      items: [
        { text: 'Takmynan 50 söz aýdýar.', support: 'Bilelikde kitap okaň, suratlary atlandyryň, açyk soraglar beriň.' },
        { text: 'Biri işlik bolan iki sözi birleşdirýär («pişik ylgaýar»).', flag: true, support: 'Onuň bir sözüni ikä öwüriň: «Maşyn». — «Uly maşyn gidýär!»' },
        { text: '«men», «maňa», «biz» ýaly sözleri ulanýar.', support: 'Nobatly oýunlarda «meniň nobatym, seniň nobatyň» diýiň.' },
        { text: 'Hyýaly oýun oýnaýar (gurjagy iýmitlendirýär, kuby maşyn ýaly sürýär).', flag: true, support: 'Onuň hyýaly oýnuna goşulyň we ýönekeý wakalary teklip ediň.' },
        { text: 'Iki ädimli tabşyryklary ýerine ýetirýär («oýnawajy al we gutynyň içine sal»).', support: 'Tabşyryklary oýun görnüşinde beriň: ilki bir ädimi, soňra iki ädimi türgenleşdiriň.' },
        { text: 'Iki aýagy bilen ýerden bökýär.', support: 'Daşarda bökmek oýunlary, «towşanjyk» oýny.' },
      ],
    },
    {
      id: 'm48',
      fromMonths: 48,
      title: '4 ýaş',
      items: [
        { text: '4 ýa-da ondan köp sözden ybarat sözlem düzýär.', flag: true, support: 'Günüňiz barada gürrüň beriň we onuň hekaýalaryny soraglar bilen giňeldiň.' },
        { text: 'Gün dowamynda bolan bir waka barada size gürrüň berýär.', support: 'Agşam «günüň iň gowy pursaty» barada gürrüňdeşlik ediň.' },
        { text: 'Oýunda özüni başga biri ýaly görkezýär (mugallym, superkahryman).', support: 'Geýinip-bezenmek we rol oýunlary üçin wagt we zatlar beriň.' },
        { text: 'Beýleki çagalar bilen oýnamagy halaýar we olara teselli berýär.', flag: true, support: 'Gysga oýun duşuşyklaryny gurnaň we duýgulary atlandyrmaga kömek ediň.' },
        { text: 'Birnäçe reňki atlandyrýar.', support: 'Gündelik durmuşda reňkleri atlandyryň we muny oýna öwrüň.' },
        { text: 'Uly topy köplenç tutýar, galamy barmaklary bilen saklaýar.', support: 'Top oýunlary, surat çekmek, plastilin.' },
      ],
    },
    {
      id: 'y6',
      fromMonths: 72,
      title: 'Mekdep ýaşy (6–12)',
      items: [
        { text: 'Gündelik öz-özüne ideg etmegi (geýinmek, diş arassalamak) köplenç özbaşdak edýär.', support: 'Ýaşyna laýyk özbaşdaklyk beriň we ony suratly gün tertibi bilen goldaň.' },
        { text: 'Iň bolmanda bir dosty bar we onuň bilen oýnamagy halaýar.', flag: true, support: 'Dostluga ýer beriň we sosial endikleri öýde türgenleşdiriň.' },
        { text: 'Oýun düzgünlerini berjaý edýär we öz nobatyna garaşyp bilýär.', support: 'Maşgala bolup düzgünli stol oýunlaryny oýnaň.' },
        { text: 'Duýgularyny sözler bilen düşündirip bilýär.', support: 'Duýgular barada gürleşmegi gündelik endige öwrüň.' },
        { text: 'Okamak we hasaplamak endikleri synpyna laýyklykda ösýär.', flag: true, support: 'Mugallym bilen aragatnaşykda boluň, bilelikde okaň we onuň tagallasyna baha beriň.' },
        { text: 'Bimaza bolandan soň oňaýly wagtyň içinde köşeşýär.', support: 'Köşeşmegiň usullaryny bilelikde saýlaň we türgenleşdiriň.' },
      ],
    },
  ],
  results: {
    ontrack: {
      title: 'Hemme zat ýolunda',
      short: 'Çagaňyz bu ýaşda garaşylýan endikleriň köpüsini görkezýär.',
      detail: [
        'Birnäçe «entek ýok» jogabyňyz bar bolsa, alada etmäň: çagalar käbir endikleri birneme giçräk, käbirlerini bolsa irräk ele alýarlar.',
        'Her barlagda ösüş barada soraglaryňyzy lukmana beriň — bu yzarlamagyň iň gowy ýoly.',
      ],
    },
    watch: {
      title: 'Birnäçe endik entek ösýär',
      short: 'Birnäçe «entek ýok» ýa-da «bilemok» jogaby bar. Bu endikleri gündelik oýun arkaly goldap bilersiňiz.',
      detail: [
        'Aşakdaky maslahatlar bilen olary 4–6 hepdäniň dowamynda goldaň, soňra ýene barlaň.',
        'Eger henizem aladalanýan bolsaňyz, indiki barlaga garaşman pediatryňyz bilen gürleşiň. Ir goldaw elmydama garaşmakdan gowudyr.',
      ],
    },
    talk: {
      title: 'Pediatryňyz bilen gürleşmegi maslahat berýäris',
      short: 'Käbir jogaplar lukmanyň seretmeli signallarydyr. Bu diagnoz däl, ýöne garaşmagyň zerurlygy ýok.',
      detail: [
        'Endikleriň ýitmegi (regressiýa) ýa-da esasy ösüş tapgyrlarynda gijikmeler ir bahalandyrmagy talap edýär. Ir başlanan goldaw iň gowy netijeleri berýär.',
        'Bu sanawy kabul edilende lukmana görkezip bilersiňiz.',
      ],
    },
  },
  note: 'Bu barlag skrining guraly hem, diagnoz hem däl. Aladalanýan bolsaňyz, netijä garamazdan lukmana ýüz tutuň.',
  sources: [S.zubler2022, S.cdcActEarly],
};
