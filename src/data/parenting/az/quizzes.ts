import type { MilestoneQuiz, StyleQuiz } from '../types';
import { S } from './sources';

export const STYLE_QUIZ: StyleQuiz = {
  id: 'style',
  emoji: '🪞',
  title: 'Mənim tərbiyə üslubum',
  intro: '12 qısa ifadə. Son iki həftəni düşün və səmimi cavab ver — burada düzgün və ya səhv cavab yoxdur. Nəticə hesabında saxlanılır və onu yalnız sən görürsən.',
  scale: ['Demək olar ki, heç vaxt', 'Bəzən', 'Tez-tez', 'Demək olar ki, həmişə'],
  items: [
    { text: 'Uşağım kədərli və ya qəzəbli olanda hissini adlandırıb yanında oluram.', dim: 'warmth' },
    { text: 'Gün ərzində onu qucaqlamaq, gülmək, “səni sevirəm” demək üçün vaxt tapıram.', dim: 'warmth' },
    { text: 'Uşağım danışanda telefonu kənara qoyub dinləyirəm.', dim: 'warmth' },
    { text: 'Onun yaxşı davranışlarını görüb adlandırıram.', dim: 'warmth' },
    { text: 'Evdə uşağımın bildiyi bir neçə aydın qayda var.', dim: 'structure' },
    { text: 'Qaydanı qoyandan sonra ona sakitcə əməl edirəm.', dim: 'structure' },
    { text: 'Gündəlik rejimimiz (yemək, yuxu) təxminən sabitdir.', dim: 'structure' },
    { text: 'Uşağım ağlayanda və ya israr edəndə, verdiyim “yox”dan imtina edirəm.', dim: 'giveIn' },
    { text: 'Yorğun olanda qaydaları tamamilə buraxıram, “nə istəyir etsin”.', dim: 'giveIn' },
    { text: 'Əsəbiləşəndə səsimi qaldırıram və ya bağırıram.', dim: 'harsh' },
    { text: 'Uşağımı hədələyirəm (“səni burada qoyub gedəcəm”, “polisə verəcəm”).', dim: 'harsh' },
    { text: 'Əsəb anında onu vurmaq və ya sərt sözlər demək istəyi olur və bəzən edirəm.', dim: 'harsh' },
  ],
  results: {
    balanced: {
      title: 'İsti və aydın',
      short: 'Sən həm sevgi göstərirsən, həm də aydın sərhəd qoyursan — tədqiqatların ən faydalı saydığı birləşmə.',
      detail: [
        'Psixoloqlar bu üslubu “avtoritativ” adlandırırlar: yüksək istilik və yüksək struktur. Bu üslubla böyüyən uşaqlar orta hesabla daha müstəqil, özünəinamlı olur və hissləri daha yaxşı idarə edirlər.',
        'Bu, mükəmməl olmaq demək deyil. Sən də yorulursan, bəzən səbrin tükənir. Fərqi yaradan — çətin anlardan sonra münasibətə qayıtmağındır.',
      ],
      next: ['Uşaq böyüdükcə qaydaları onunla birlikdə qurmağa başla.', 'Özünə qayğını unutma: sakit valideyn olmaq üçün dincəlmək lazımdır.', '“Xüsusi vaxt” vərdişini qoru — bu, ən güclü “sığortadır”.'],
    },
    gentle: {
      title: 'Çox isti, sərhədlər yumşaq',
      short: 'Uşağınla çox yaxınsan və hisslərinə həssassan. Bəzən sərhədləri saxlamaq çətin gəlir.',
      detail: [
        'İstilik sənin ən güclü tərəfindir və bu, uşağın təhlükəsiz bağlılığı üçün əvəzsizdir. Lakin uşaqlar sərhədləri sınayır ki, onların yerində olduğunu bilsinlər. Sərhəd yumşaldıqda uşaq daha çox sınayır, valideyn isə tükənir.',
        'Sevgi ilə sərhəd bir-birinə zidd deyil. “Səni sevirəm və cavab yenə də yoxdur” demək uşağa təhlükəsizlik verir.',
      ],
      next: ['3–5 aydın ailə qaydası seç və onları sakitcə tətbiq et.', 'Tantrum zamanı empatiya göstər, amma qərarı dəyişmə.', '“21 gün bağırmadan” proqramındakı “bir cümlə, bir dəfə” addımını sına.'],
    },
    storm: {
      title: 'Sevgi dolu, amma yorğun anlarda partlayan',
      short: 'Uşağına çox bağlısan, amma stresli anlarda səs yüksəlir. Bu, çox valideynin tanıdığı vəziyyətdir.',
      detail: [
        'Sənin istiliyin güclü təməldir. Bağırmaq və sərt sözlər isə çox vaxt yorğunluğun, tələsiyin və tək qalmağın nəticəsidir, sevgisizliyin yox.',
        'Tədqiqatlar göstərir ki, münasibət isti olsa belə, müntəzəm bağırmaq uşağın davranışına mənfi təsir edir. Yaxşı xəbər: öz-özünü tənzimləmə öyrənilən bacarıqdır və bərpa söhbətləri münasibəti qoruyur.',
      ],
      next: ['Tetikləyicilərini tap: hansı saatlar, hansı vəziyyətlər?', '“Fasilə düyməsi” və uzun nəfəsvermə ilə başla.', '“21 gün bağırmadan” proqramı tam sənin üçündür.'],
    },
    strict: {
      title: 'Sərhədlər güclü, istilik gizlində',
      short: 'Sən nizam və qaydaya önəm verirsən. Bəzən bu, istilik və dinləmə hesabına olur.',
      detail: [
        'Qaydalar və ardıcıllıq uşaq üçün vacibdir — bu sənin güclü tərəfindir. Amma sərt nəzarət və cəza ilə qoyulan sərhədlər, tədqiqatlara görə, uzunmüddətli davranış problemlərini azaltmır, əksinə, artıra bilər.',
        'Qaydaları saxlayaraq istiliyi artırmaq mümkündür: izah etmək, hissi adlandırmaq, yaxşı davranışı görmək.',
      ],
      next: ['Hər gün 10 dəqiqə uşağın rəhbərlik etdiyi oyun vaxtı.', 'Cəza əvəzinə məntiqi nəticələrdən istifadə et.', 'Bir qaydanı izah et: “Bu qayda var, çünki…”'],
    },
    stretched: {
      title: 'Yorğun və tükənmiş',
      short: 'Görünür, son vaxtlar çox yorğunsan. Bu, pis valideyn olmaq deyil, dəstəyə ehtiyac siqnalıdır.',
      detail: [
        'Valideyn tükənəndə həm istilik, həm də struktur üçün güc qalmır. Bu, çox yayılmış və başa düşülən vəziyyətdir, xüsusən körpə, yuxusuzluq, iş və tək qalma olanda.',
        'Bu nəticə sənə ittiham deyil, sənin özünə də qayğıya ehtiyacın olduğunu göstərir. Kiçik addımlar və kömək istəmək hər şeyi dəyişə bilər.',
      ],
      next: ['Yükü bölüş: partnyor, ailə, dostlarla konkret kömək razılaşdır.', 'Gündə bir 5 dəqiqəlik əlaqə anı: yalnız qucaq və göz təması.', 'İki həftədən çox kədər və ya ümidsizlik hiss edirsənsə, həkim və ya psixoloqla danış.'],
    },
  },
  note: 'Bu test diaqnoz deyil, özünü müşahidə üçün sadə alətdir. Baumrindin istilik və struktur ölçülərinə əsaslanır.',
  sources: [S.baumrind1966, S.baumrind1967, S.pinquart2017, S.wangKenny2014],
};

export const MILESTONE_QUIZ: MilestoneQuiz = {
  id: 'milestones',
  emoji: '🧩',
  title: 'Uşağım bu yaşda nə bacarmalıdır?',
  intro: 'CDC və Amerika Pediatriya Akademiyasının inkişaf mərhələlərinə əsaslanan qısa yoxlama. Uşaqların çoxu (təxminən 4-dən 3-ü) bu yaşda bu bacarıqları göstərir. Hər uşaq öz tempində inkişaf edir.',
  answers: { yes: 'Bəli', no: 'Hələ yox', unsure: 'Əmin deyiləm' },
  regression: 'Əvvəl bacardığı bir bacarığı (söz, oyun, hərəkət) itirib?',
  checkpoints: [
    {
      id: 'm4',
      fromMonths: 4,
      title: '4 ay',
      items: [
        { text: 'Səni görəndə özü gülümsəyir, diqqətini cəlb etməyə çalışır.', flag: true, support: 'Üz-üzə çox vaxt keçir: gülümsə, gözlə, onun gülümsəməsinə cavab ver.' },
        { text: '“A-a”, “u-u” kimi səslər çıxarır, sən danışanda səslə cavab verir.', support: 'Onun səslərini təqlid et, sonra fasilə ver ki, “cavab” versin.' },
        { text: 'Səsini eşidəndə başını səsə tərəf çevirir.', flag: true, support: 'Müxtəlif tərəflərdən adını yumşaq səslə çağır.' },
        { text: 'Qucaqda olanda başını dəstəksiz sabit saxlayır.', support: 'Oyaq olanda gündə bir neçə dəfə qısa “qarın üstə vaxt”.' },
        { text: 'Əlinə verilən oyuncağı tutub saxlayır.', support: 'Yüngül, tutması asan cingiltili oyuncaqlar ver.' },
        { text: 'Qarnı üstə olanda dirsəklərinə dayanıb başını qaldırır.', support: 'Qarşısına güzgü və ya rəngli oyuncaq qoy.' },
      ],
    },
    {
      id: 'm9',
      fromMonths: 9,
      title: '9 ay',
      items: [
        { text: 'Adı çağırılanda baxır.', flag: true, support: 'Adını oyunlarda tez-tez işlət, baxanda gülümsə və tərif et.' },
        { text: '“Ma-ma-ma”, “ba-ba-ba” kimi müxtəlif hecalar deyir.', flag: true, support: 'Hecaları birlikdə təkrarla, mahnılar oxu.' },
        { text: 'Qucağa götürülmək üçün əllərini qaldırır.', support: 'Götürməzdən əvvəl soruş: “Qucağa?” və əllərini açmasını gözlə.' },
        { text: 'Yerə düşən əşyanın ardınca baxır, onu axtarır.', support: 'Gizlənpaç və “oyuncaq hanı?” oyunları oyna.' },
        { text: 'Dəstəksiz oturur.', support: 'Döşəmədə təhlükəsiz oyun vaxtı ver, oturuşu yastıqlarla qoru.' },
        { text: 'Tanımadığı adamlardan çəkinir və ya sənə sığınır.', support: 'Bu, bağlılığın əlamətidir. Yeni insanlarla tanışlığı tələsdirmə.' },
      ],
    },
    {
      id: 'm18',
      fromMonths: 18,
      title: '18 ay',
      items: [
        { text: 'Maraqlı bir şeyi sənə göstərmək üçün barmaqla işarə edir.', flag: true, support: 'Özün də göstər və adlandır: “Bax, quş!” Göstərəndə həvəslə cavab ver.' },
        { text: '“Ana, ata”dan başqa ən azı 3 söz deyir.', flag: true, support: 'Gündəlik işləri danışaraq et, onun sözlərini genişləndir.' },
        { text: 'Jestsiz sadə tapşırığı yerinə yetirir (“topu ver”).', support: 'Tapşırığı qısa de, edəndə sevinclə təşəkkür et.' },
        { text: 'Dəstəksiz yeriyir.', flag: true, support: 'Ayaqyalın, təhlükəsiz məkanda çoxlu hərəkət imkanı ver.' },
        { text: 'Səni ev işlərində təqlid edir (süpürmək, telefonla danışmaq).', support: 'Kiçik süpürgə, oyuncaq qab-qacaq ver, birlikdə “iş görün”.' },
        { text: 'Barmaqları ilə özü yeyir, qaşıqdan istifadəyə çalışır.', support: 'Çirklənməyə icazə ver, barmaq qidaları təklif et.' },
      ],
    },
    {
      id: 'm30',
      fromMonths: 30,
      title: '2,5 yaş',
      items: [
        { text: 'Təxminən 50 söz deyir.', support: 'Birlikdə kitab oxu, şəkilləri adlandırın, açıq suallar ver.' },
        { text: 'Felli iki sözü birləşdirir (“pişik qaçır”).', flag: true, support: 'Onun bir sözünü iki sözə genişləndir: “Maşın.” — “Böyük maşın gedir!”' },
        { text: '“Mən”, “mənim”, “biz” sözlərini işlədir.', support: 'Növbəli oyunlarda “mənim növbəm, sənin növbən” de.' },
        { text: 'Rol oyunu oynayır (kuklanı yedizdirmək, bloku maşın kimi sürmək).', flag: true, support: 'Rol oyununa qoşul, sadə ssenarilər təklif et.' },
        { text: 'İki addımlı tapşırığı yerinə yetirir (“oyuncağı götür və qutuya qoy”).', support: 'Tapşırıqları oyunla ver və əvvəl bir addım, sonra iki addım məşq et.' },
        { text: 'İki ayağı ilə yerdən tullanır.', support: 'Açıq havada tullanma oyunları, “dovşan” oyunu.' },
      ],
    },
    {
      id: 'm48',
      fromMonths: 48,
      title: '4 yaş',
      items: [
        { text: '4 və daha çox sözlü cümlələr qurur.', flag: true, support: 'Gün haqqında danışın, onun hekayəsini suallarla genişləndirin.' },
        { text: 'Gün ərzində baş verən bir şeyi danışır.', support: 'Axşam “günün ən yaxşı anı” söhbəti edin.' },
        { text: 'Oyunda başqa birinə çevrilir (müəllim, superqəhrəman).', support: 'Kostyumlar, rol oyunları üçün vaxt və materiallar ver.' },
        { text: 'Başqa uşaqlarla oynamaqdan zövq alır, onlara təsəlli verir.', flag: true, support: 'Dostlarla qısa görüşlər təşkil et, hissləri adlandırmağa kömək et.' },
        { text: 'Bir neçə rəngin adını deyir.', support: 'Gündəlik həyatda rəngləri adlandırın, oyuna çevirin.' },
        { text: 'Böyük topu çox vaxt tutur, karandaşı barmaqları ilə tutur.', support: 'Top oyunları, rəsm, plastilin.' },
      ],
    },
    {
      id: 'y6',
      fromMonths: 72,
      title: 'Məktəb yaşı (6–12)',
      items: [
        { text: 'Gündəlik özünəqulluğu (geyinmək, diş fırçalamaq) əsasən özü edir.', support: 'Yaşına uyğun müstəqillik ver, şəkilli rutinlərlə dəstəklə.' },
        { text: 'Ən azı bir dostu var və onunla oynamaqdan zövq alır.', flag: true, support: 'Dostluqlara imkan yarat, sosial bacarıqları evdə məşq edin.' },
        { text: 'Oyunların qaydalarına əməl edir, növbəsini gözləyə bilir.', support: 'Ailə ilə qaydalı stolüstü oyunlar oynayın.' },
        { text: 'Hisslərini sözlə izah edə bilir.', support: 'Hisslər haqqında danışmağı gündəlik vərdiş et.' },
        { text: 'Oxumaq və saymaq bacarıqları sinfinə uyğun irəliləyir.', flag: true, support: 'Müəllimlə əlaqədə ol, birlikdə oxu, səyini təqdir et.' },
        { text: 'Əsəbiləşəndən sonra makul vaxtda sakitləşir.', support: 'Sakitləşmə üsullarını birlikdə seçin və məşq edin.' },
      ],
    },
  ],
  results: {
    ontrack: {
      title: 'Hər şey yolundadır',
      short: 'Uşağın bu yaş üçün gözlənilən bacarıqların çoxunu göstərir.',
      detail: [
        '“Hələ yox” cavabları varsa, narahat olma: uşaqlar bəzi bacarıqları bir az gec, bəzilərini isə tez qazanır.',
        'Hər müayinədə həkimə inkişaf haqqında suallarını ver — bu, ən yaxşı izləmə yoludur.',
      ],
    },
    watch: {
      title: 'Bir neçə bacarıq hələ formalaşır',
      short: 'Bir neçə “hələ yox” və ya “əmin deyiləm” cavabı var. Bu bacarıqları gündəlik oyunla dəstəkləyə bilərsən.',
      detail: [
        'Aşağıdakı məsləhətlərlə 4–6 həftə dəstəklə və yenidən yoxla.',
        'Narahatlığın davam edirsə, növbəti müayinəni gözləmədən pediatrla danış. Erkən dəstək həmişə gözləməkdən daha yaxşıdır.',
      ],
    },
    talk: {
      title: 'Pediatrla danışmağı tövsiyə edirik',
      short: 'Bəzi cavablar həkimin baxmalı olduğu siqnallardır. Bu diaqnoz deyil, amma gözləmək lazım deyil.',
      detail: [
        'Bacarıq itkisi (geriləmə) və ya vacib mərhələlərin gecikməsi erkən qiymətləndirmə tələb edir. Erkən başlanan dəstək ən yaxşı nəticəni verir.',
        'Həkimə gedəndə bu siyahını göstərə bilərsən.',
      ],
    },
  },
  note: 'Bu yoxlama skrininq aləti və diaqnoz deyil. Narahatlığın varsa, nəticədən asılı olmayaraq həkimə müraciət et.',
  sources: [S.zubler2022, S.cdcActEarly],
};
