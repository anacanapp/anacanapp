// Anacan dashboard stories, Azerbaijani (2026-11-09). Prototype: docs/prototypes/dashboard-stories.html.
// Plain data (StoryJson): one renderer draws every template and illustration in code. Text markers:
// ==x== highlighted chip, __x__ accent colour, **x** bold; {var} is filled on the device from the user's own data
// ({weekLabel}, {fruit}, {lengthCm}, {weightG}, {weekNote}, {babyName}, {babyMonths}, {milestone},
// {milestoneShort}, {cycleLabel}, {phase}, {phaseTip}). Medical copy cites its source on the slide.
// Edits: keep plain Azerbaijani, no long dashes, one idea per slide.
import type { Story, WeekRow, MonthRow, PhaseRow } from '@/lib/stories';

export const WEEKS: WeekRow[] = [
  [12,'laym',5,14,'Barmaqları ayrılır, refleksləri yaranır.'],
  [16,'avokado',12,100,'Üz əzələləri işləyir, mimika yaranır.'],
  [20,'banan',25,300,'Səsləri eşitməyə başlayır.'],
  [24,'qarğıdalı',30,600,'Ağciyərlər nəfəsə hazırlaşır, yuxu ritmi yaranır.'],
  [28,'badımcan',37,1000,'Gözlərini açıb-yumur, beyni sürətlə böyüyür.'],
  [32,'ananas',42,1700,'Dərialtı piy yığır, hərəkətləri güclənir.'],
  [36,'yemiş',47,2600,'Başı aşağı dönməyə hazırlaşır.'],
  [40,'qarpız',51,3400,'Dünyaya gəlməyə hazırdır.'],
];
export const MONTHS: MonthRow[] = [
  [1,'Üzlərə baxır, səsə dönür.','Səsinə sakitləşir'],
  [2,'Güləndə cavab verir, başını qaldırır.','İlk sosial təbəssüm'],
  [4,'Başını dik saxlayır, "agu" deyir, əllərini ağzına aparır.','Səslərlə "danışır"'],
  [6,'Dəstəklə oturur, adına reaksiya verir, oyuncağı əldən-ələ ötürür.','Əlavə qidaya hazırlıq'],
  [9,'Dəstəksiz oturur, gizlənən oyuncağı axtarır, "bay-bay" edir.','Yad adamdan çəkinə bilər'],
  [12,'Dəstəklə addımlayır, "ana" deyir, barmaqla göstərir.','İlk sözlər'],
];
export const PHASES: PhaseRow[] = [
  [1,5,'menstruasiya','Bədən dincəlmək istəyir. Yüngül gəzinti və isti kompres sancını azalda bilər.'],
  [6,12,'follikulyar faza','Estrogen artır, enerji və əhval adətən yaxşılaşır. Yeni vərdiş üçün yaxşı vaxtdır.'],
  [13,16,'ovulyasiya pəncərəsi','Mayalanma ehtimalının ən yüksək olduğu günlər. Bu, kontrasepsiya üsulu deyil.'],
  [17,35,'lüteal faza','Progesteron artır. Yuxu, su və duz balansına diqqət PMS əlamətlərini yüngülləşdirə bilər.'],
];

export const STORIES_AZ: Story[] = [
 // ---- Hamiləlik ----
 { id:'bump-this-week', module:'bump', title:'Bu həftə', theme:'coral', illus:'fruit',
   audience:{ stage:'bump', weekFrom:12, weekTo:40 }, schedule:{ refresh:'weekly', day:'mon' }, source:'ACOG, NHS',
   slides:[
     { t:'cover', kicker:'{weekLabel}', title:'Körpən indi =={fruit}== boydadır', mascot:'bump' },
     { t:'fact', kicker:'Təxmini ölçü', value:'{lengthCm}', unit:'sm', body:'Çəkisi təxminən {weightG} qram. Hər körpə öz tempində böyüyür.' },
     { t:'cover', kicker:'Bu həftə', title:'{weekNote}', size:'m', illus:'blob' },
     { t:'cta', kicker:'Daha ətraflı', title:'Həftəlik inkişafa bax', body:'Döl inkişafı alətində bu həftənin bütün dəyişiklikləri.', cta:{ label:'Döl inkişafı', nav:{ tool:'fetal-growth' } }, illus:'heart' } ] },
 { id:'bump-kicks', module:'bump', title:'Hərəkətlər', theme:'violet', illus:'feet',
   audience:{ stage:'bump', weekFrom:24 }, schedule:{ refresh:'once' }, source:'RCOG, NHS',
   slides:[
     { t:'cover', kicker:'Ekspert məsləhəti', title:'Körpənin __hərəkət ritmini__ tanıyırsan?', illus:'feet' },
     { t:'list', title:'Hər gün eyni vaxtda say', items:['Yemək yedikdən sonra rahat otur və ya sol böyrü üstə uzan.','Təpik, dönmə, itələmə: hamısı sayılır.','Öz körpənin normal ritmini öyrən.'] },
     { t:'alert', kicker:'Vacib', title:'Hərəkətlər azalıbsa, səhəri gözləmə', items:['Doğum evinə və ya həkiminə zəng et','Saymağı başqa günə saxlama'], illus:'shield' },
     { t:'cta', title:'Hərəkət sayğacını aç', body:'Bir toxunuşla say, ritmini qrafikdə gör.', cta:{ label:'Hərəkət sayğacı', nav:{ tool:'kick' } }, illus:'feet' } ] },
 { id:'bump-eat-for-two', module:'bump', title:'Mif və fakt', theme:'cream', illus:'bowl',
   audience:{ stage:'bump' }, schedule:{ refresh:'once' }, source:'ACOG',
   slides:[
     { t:'cover', kicker:'Mif yoxsa fakt?', title:'Hamilə qadın __iki nəfərlik__ yeməlidir.', illus:'bowl' },
     { t:'myth', myth:'İki nəfərlik ye.', fact:'İlk trimestrdə əlavə kalori lazım deyil. İkinci trimestrdə gündə təxminən 340, üçüncüdə 450 kkal əlavə kifayətdir.' },
     { t:'list', title:'Bir boşqab üçün sadə qayda', items:['Yarısı tərəvəz və meyvə','Dörddə biri zülal: ət, balıq, paxlalı','Dörddə biri tam taxıl'] },
     { t:'cta', title:'Sənə uyğun qidalanma planı', body:'Trimestrə görə menyu və vacib vitaminlər.', cta:{ label:'Qidalanma', nav:{ tool:'nutrition' } }, illus:'bowl' } ] },
 { id:'bump-danger', module:'bump', title:'Təcili əlamətlər', theme:'navy', illus:'shield',
   audience:{ stage:'bump' }, schedule:{ refresh:'monthly' }, source:'ÜST, NHS',
   slides:[
     { t:'cover', kicker:'Təhlükəsizlik', title:'Bu əlamətlərdə __dərhal__ həkimə', illus:'shield' },
     { t:'alert', items:['Qanaxma və ya maye axması','Güclü baş ağrısı, görmənin bulanması','Üzdə, əllərdə qəfil şişkinlik','Hərəkətlərin azalması','Qızdırma və ya güclü qarın ağrısı'] },
     { t:'cta', title:'Siyahını əlində saxla', body:'Təhlükəli əlamətlər bələdçisi oflayn da açılır.', cta:{ label:'Təhlükəli əlamətlər', nav:{ tool:'danger-signs' } }, illus:'shield' } ] },

 // ---- Analıq ----
 { id:'mom-this-month', module:'mommy', title:'{babyMonths} aylıq', theme:'peach', illus:'baby',
   audience:{ stage:'mommy', monthsFrom:1, monthsTo:12 }, schedule:{ refresh:'monthly' }, source:'CDC, ÜST',
   slides:[
     { t:'cover', kicker:'{babyName} {babyMonths} aylıqdır', title:'=={milestoneShort}==', illus:'baby' },
     { t:'cover', kicker:'Bu ayın yenilikləri', title:'{milestone}', size:'m', illus:'blob' },
     { t:'quote', badge:'Ekspert məsləhəti', quote:'Hər körpə öz tempində inkişaf edir. Narahatlığın varsa, növbəti müayinəni gözləmədən pediatrla danış.', src:'CDC tövsiyəsi əsasında' },
     { t:'cta', title:'İnkişaf mərhələlərini izlə', body:'Boy, çəki və mərhələlər bir yerdə.', cta:{ label:'Boy-çəki', nav:{ tool:'baby-growth' } }, illus:'baby' } ] },
 { id:'mom-safe-sleep', module:'mommy', title:'Təhlükəsiz yuxu', theme:'navy', illus:'moon',
   audience:{ stage:'mommy', monthsTo:12 }, schedule:{ refresh:'once' }, source:'AAP',
   slides:[
     { t:'cover', kicker:'Ekspert məsləhəti', title:'Təhlükəsiz yuxunun __ABC__-si', illus:'moon' },
     { t:'list', title:'Hər yuxuda, hər dəfə', items:['**A**: tək, öz yatağında','**B**: arxası üstə','**C**: bərk döşək, boş yataq'] },
     { t:'quiz', title:'Körpənin yatağına yastıq qoymaq olar?', options:['Bəli, rahat olsun','Xeyr, 1 yaşa qədər yox'], correct:1, explain:'1 yaşa qədər yataqda yastıq, yorğan və oyuncaq olmamalıdır.' },
     { t:'cta', title:'Yuxu ritmini qur', body:'Növbəti yuxu vaxtı və ağ səs bir yerdə.', cta:{ label:'Yuxu', nav:{ tool:'whitenoise' } }, illus:'moon' } ] },
 { id:'mom-solids-quiz', module:'mommy', title:'Əlavə qida', theme:'yellow', illus:'bowl',
   audience:{ stage:'mommy', monthsFrom:4, monthsTo:8 }, schedule:{ refresh:'once' }, source:'ÜST',
   slides:[
     { t:'quiz', kicker:'Quiz', title:'Əlavə qidaya nə vaxt başlamaq tövsiyə olunur?', options:['3 ayda','Təxminən 6 ayda','9 ayda'], correct:1, explain:'ÜST ilk 6 ayda yalnız ana südü, sonra əlavə qida tövsiyə edir.' },
     { t:'list', title:'Hazırlıq əlamətləri', items:['Başını dik saxlayır','Dəstəklə oturur','Yeməyə maraq göstərir','Qaşığı dili ilə itələmir'] },
     { t:'cta', title:'Addım-addım bələdçi', body:'İlk qidalar, porsiyalar və allergen planı.', cta:{ label:'Əlavə qida bələdçisi', nav:{ tool:'solid-food-guide' }, premium:true }, illus:'bowl' } ] },
 { id:'mom-feelings', module:'mommy', title:'Sən necəsən?', theme:'lilac', illus:'heart',
   audience:{ stage:'mommy', monthsTo:12 }, schedule:{ refresh:'monthly' }, source:'ÜST, ACOG',
   slides:[
     { t:'cover', kicker:'Sənin üçün', title:'Ana olmaq __yorur__. Bu normaldır.', illus:'heart' },
     { t:'fact', kicker:'Doğuşdan sonra', value:'1/7', unit:'ana', body:'Hər 7 anadan biri doğuşdan sonrakı depressiya yaşayır. Kömək istəmək güclü olmaqdır.' },
     { t:'list', title:'Bu hisslər 2 həftədən çox çəkirsə', items:['Həkiminlə danış','Yaxınına söylə','2 dəqiqəlik testi et'] },
     { t:'cta', title:'Özünü yoxla', body:'Anonim test, nəticə yalnız sənə görünür.', cta:{ label:'Psixoloji sağlamlıq', nav:{ tool:'mental-health' } }, illus:'heart' } ] },

 // ---- Dövr ----
 { id:'flow-today', module:'flow', title:'{cycleLabel}', theme:'mint', illus:'cycle',
   audience:{ stage:'flow' }, schedule:{ refresh:'daily' }, source:'ACOG',
   slides:[
     { t:'cover', kicker:'Tsiklinin {cycleLabel}ü', title:'İndi =={phase}==', illus:'cycle' },
     { t:'cover', kicker:'Bu günlər üçün', title:'{phaseTip}', size:'m', illus:'blob' },
     { t:'cta', title:'Bugünkü hissini qeyd et', body:'Əlamətlərin növbəti tsikldə proqnozu daha dəqiq edir.', cta:{ label:'Dövr təqvimi', nav:{ screen:'calendar' } }, illus:'cycle' } ] },
 { id:'flow-sport', module:'flow', title:'Mif və fakt', theme:'forest', illus:'blob',
   audience:{ stage:'flow' }, schedule:{ refresh:'once' }, source:'ACOG',
   slides:[
     { t:'cover', kicker:'Mif yoxsa fakt?', title:'Dövr zamanı __idman olmaz__.', illus:'blob' },
     { t:'myth', myth:'Menstruasiya vaxtı hərəkət etmə.', fact:'Yüngül hərəkət, məsələn gəzinti, yoqa və ya üzgüçülük, sancını və əhval dəyişkənliyini azalda bilər.' },
     { t:'cta', title:'Sənə uyğun məşqlər', body:'Tsikl fazasına görə yüngül proqramlar.', cta:{ label:'Məşqlər', nav:{ tool:'exercise' } }, illus:'heart' } ] },
 { id:'flow-pms', module:'flow', title:'PMS', theme:'peach', illus:'drop',
   audience:{ stage:'flow' }, schedule:{ refresh:'monthly', phase:'luteal' }, source:'ACOG',
   slides:[
     { t:'cover', kicker:'Ekspert məsləhəti', title:'PMS günlərini ==yüngülləşdir==', illus:'drop' },
     { t:'list', items:['Qarına isti kompres','Gündə 20 dəqiqə gəzinti','Duzu və kofeini azalt','7 ilə 9 saat yuxu'] },
     { t:'alert', kicker:'Həkimə nə vaxt', title:'Ağrı gündəlik həyatını dayandırırsa', items:['Ağrıkəsici kömək etmirsə','Qanaxma çox güclüdürsə'], illus:'shield' } ] },
 { id:'flow-normal', module:'flow', title:'Normal tsikl', theme:'coral', illus:'cycle',
   audience:{ stage:'flow' }, schedule:{ refresh:'once' }, source:'ACOG',
   slides:[
     { t:'fact', kicker:'Bilirsən?', value:'21-35', unit:'gün', body:'Böyüklərdə normal tsikl bu aralıqdadır. Hər ay bir neçə gün fərq normaldır.' },
     { t:'list', title:'Həkimlə danış, əgər', items:['Tsikl 21 gündən qısa və ya 35 gündən uzundursa','3 ay ardıcıl dövr gəlmirsə','Dövr 7 gündən çox çəkirsə'] },
     { t:'cta', title:'Tsiklini izlə', body:'Qeyri-müntəzəmliyi Anacan özü göstərəcək.', cta:{ label:'Dövr təqvimi', nav:{ screen:'calendar' } }, illus:'cycle' } ] },

 // ---- Hamı üçün ----
 { id:'all-water', module:'all', title:'Su', theme:'navy', illus:'drop',
   audience:{ stage:['bump','mommy','flow'] }, schedule:{ refresh:'weekly' }, source:'ÜST, EFSA',
   slides:[
     { t:'cover', kicker:'Kiçik vərdiş', title:'Susuzluğu __gözləmə__', illus:'drop' },
     { t:'fact', kicker:'Gündəlik maye', value:'2-3', unit:'litr', body:'Hamiləlikdə və əmizdirmədə ehtiyac artır. Sidiyin açıq rəngdə olması yaxşı göstəricidir.' },
     { t:'list', title:'Asan yollar', items:['Hər yeməkdə bir stəkan','Əmizdirəndə yanında su','Telefonunda xatırlatma'] } ] },
 { id:'all-ai', module:'all', title:'Anacan AI', theme:'violet', illus:'chat',
   audience:{ stage:['bump','mommy','flow'] }, schedule:{ refresh:'once' }, source:'',
   slides:[
     { t:'cover', kicker:'Gecə saat 3-dür', title:'Sualın var? ==Anacan AI== oyaqdır.', illus:'chat' },
     { t:'list', title:'Analar ən çox nə soruşur', items:['Körpə niyə gecə oyanır?','Bu səpgi normaldırmı?','Hansı vitaminləri içim?'] },
     { t:'cta', title:'İlk sualını ver', body:'Təcili hallarda həkimə və ya 103-ə zəng et.', cta:{ label:'Anacan AI', nav:{ tab:'ai' } }, illus:'chat' } ] },
 { id:'all-community', module:'all', title:'İcma', theme:'lime', illus:'chat',
   audience:{ stage:['bump','mommy','flow'] }, schedule:{ refresh:'weekly', data:'community_top_topics' }, source:'',
   slides:[
     { t:'cover', kicker:'Bu həftə icmada', title:'Analar ən çox __bunları__ müzakirə etdi', illus:'chat' },
     { t:'list', items:['Diş çıxarma gecələri','Hamiləlikdə ürək yanması','Bağçaya hazırlıq'] },
     { t:'cta', title:'Söhbətə qoşul', body:'Sualını yaz, təcrübəni bölüş.', cta:{ label:'İcma', nav:{ tab:'community' } }, illus:'chat' } ] },
 { id:'all-doctor-pdf', module:'all', title:'Həkimə hazır', theme:'cream', illus:'doc',
   audience:{ stage:['bump','mommy'] }, schedule:{ refresh:'once' }, source:'',
   slides:[
     { t:'cover', kicker:'Müayinədən əvvəl', title:'Həkimə __hazır__ get', illus:'doc' },
     { t:'list', title:'Özünlə götür', items:['Təzyiq və çəki qeydləri','Sualların siyahısı','Son analizlərin nəticəsi'] },
     { t:'cta', title:'Bir toxunuşla PDF', body:'Bütün qeydlərin həkim üçün səliqəli hesabatda.', cta:{ label:'Həkim hesabatı', nav:{ screen:'doctor-report' }, premium:true }, illus:'doc' } ] },
 // ================= +44 (2026-11-09) =================
 // ---- Hamiləlik ----
 { id:'bump-folic', module:'bump', title:'Fol turşusu', theme:'lime', illus:'pill',
   audience:{ stage:'bump', weekTo:14 }, schedule:{ refresh:'once' }, source:'ÜST',
   slides:[
     { t:'cover', kicker:'İlk 12 həftə', title:'Hər gün ==fol turşusu==', illus:'pill' },
     { t:'fact', kicker:'Gündəlik doza', value:'400', unit:'mkq', body:'Körpənin sinir borusunun düzgün formalaşmasına kömək edir. Dozanı həkiminlə dəqiqləşdir.' },
     { t:'list', title:'Qidada harada var', items:['Ispanaq, brokkoli, kahı','Mərci, noxud, lobya','Portağal və digər sitruslar'] },
     { t:'cta', title:'Vitaminini unutma', body:'Gündəlik xatırlatma və qeyd.', cta:{ label:'Vitamin izləyicisi', nav:{ tool:'vitamin-tracker' }, premium:true }, illus:'pill' } ] },
 { id:'bump-nausea', module:'bump', title:'Ürəkbulanma', theme:'mint', illus:'drop',
   audience:{ stage:'bump', weekTo:16 }, schedule:{ refresh:'once' }, source:'NHS, ACOG',
   slides:[
     { t:'cover', kicker:'Səhər bulantısı', title:'Ürəkbulanmanı ==yüngülləşdir==', illus:'drop' },
     { t:'list', items:['Az-az, tez-tez ye','Yataqdan qalxmadan quru peçenye','Zəncəfilli çay və ya konfet','Kəskin iylərdən uzaq dur'] },
     { t:'alert', kicker:'Həkimə nə vaxt', title:'Bunlar varsa, gözləmə', items:['Heç nə saxlaya bilmirsən','Sidik çox az və tünd rəngdədir','Çəki itirirsən'], illus:'shield' } ] },
 { id:'bump-side-sleep', module:'bump', title:'Yan üstə yat', theme:'navy', illus:'moon',
   audience:{ stage:'bump', weekFrom:26 }, schedule:{ refresh:'once' }, source:'RCOG',
   slides:[
     { t:'quiz', kicker:'Quiz', title:'28-ci həftədən sonra necə yatmaq tövsiyə olunur?', options:['Arxası üstə','Yan üstə','Fərqi yoxdur'], correct:1, explain:'Üçüncü trimestrdə yan üstə yatmaq körpəyə qan axınını yaxşılaşdırır. Gecə arxası üstə oyansan, narahat olma, sadəcə yanına çevril.' },
     { t:'list', title:'Rahat yatmaq üçün', items:['Dizlərin arasına yastıq','Qarnın altına kiçik yastıq','Belinə dayaq'] },
     { t:'cta', title:'Yuxunu izlə', body:'Gecə oyanmalarını qeyd et, həkiminə göstər.', cta:{ label:'Əhval gündəliyi', nav:{ tool:'mood' } }, illus:'moon' } ] },
 { id:'bump-bag', module:'bump', title:'Doğum çantası', theme:'yellow', illus:'bag',
   audience:{ stage:'bump', weekFrom:30 }, schedule:{ refresh:'weekly' }, source:'NHS',
   slides:[
     { t:'cover', kicker:'36-cı həftəyə qədər', title:'Doğum çantası __hazırdır?__', illus:'bag' },
     { t:'list', title:'Üç bölmə', items:['Sənədlər: şəxsiyyət vəsiqəsi, mübadilə kartı','Ana üçün: xalat, gecəlik, gigiyena','Körpə üçün: bodi, papaq, bez'] },
     { t:'cta', title:'Hazır siyahı', body:'Qeyd et, partnyorunla paylaş.', cta:{ label:'Xəstəxana çantası', nav:{ tool:'hospital' } }, illus:'bag' } ] },
 { id:'bump-gdm', module:'bump', title:'Şəkər testi', theme:'peach', illus:'drop',
   audience:{ stage:'bump', weekFrom:20, weekTo:30 }, schedule:{ refresh:'once' }, source:'ÜST, ACOG',
   slides:[
     { t:'fact', kicker:'Hamiləlik diabeti testi', value:'24-28', unit:'həftə', body:'Bu həftələrdə qlükoza testi tövsiyə olunur. Erkən aşkarlanan diabet asan idarə olunur.' },
     { t:'list', title:'Testdən əvvəl', items:['Həkimin dediyi qədər ac qal','Rahat geyin, yanında su götür','Nəticəni Anacan-da qeyd et'] },
     { t:'cta', title:'Qan şəkərini izlə', body:'Ac qarına və yeməkdən sonra ölçmələr bir qrafikdə.', cta:{ label:'Qan şəkəri', nav:{ tool:'blood-sugar' }, premium:true }, illus:'drop' } ] },
 { id:'bump-bp', module:'bump', title:'Təzyiq', theme:'coral', illus:'heart',
   audience:{ stage:'bump', weekFrom:20 }, schedule:{ refresh:'monthly' }, source:'ÜST, NHS',
   slides:[
     { t:'fact', kicker:'Diqqət həddi', value:'140/90', unit:'', body:'20-ci həftədən sonra təzyiq bu həddə və ya yuxarı olarsa, həkimə xəbər ver. Bu preeklampsiyanın əlaməti ola bilər.' },
     { t:'alert', title:'Təzyiqlə birlikdə bunlar varsa, təcili', items:['Güclü baş ağrısı','Gözlərdə parıltı, bulanma','Qabırğaların altında ağrı','Qəfil şişkinlik'] },
     { t:'cta', title:'Təzyiqini qeyd et', body:'Ölçmələr həkim hesabatına avtomatik düşür.', cta:{ label:'Qan təzyiqi', nav:{ tool:'blood-pressure' } }, illus:'heart' } ] },
 { id:'bump-move', module:'bump', title:'Hərəkət et', theme:'lime', illus:'feet',
   audience:{ stage:'bump' }, schedule:{ refresh:'once' }, source:'ÜST',
   slides:[
     { t:'fact', kicker:'Həftəlik hədəf', value:'150', unit:'dəqiqə', body:'Həkimin icazə verirsə, həftədə 150 dəqiqə orta tempdə hərəkət tövsiyə olunur. Gündə 20 dəqiqəlik gəzinti kifayətdir.' },
     { t:'list', title:'Təhlükəsiz seçimlər', items:['Gəzinti','Üzgüçülük','Hamilələr üçün yoqa və pilates'] },
     { t:'alert', kicker:'Dayandır və həkimə', title:'Bunlar olarsa', items:['Qanaxma və ya maye','Baş gicəllənməsi, nəfəs darlığı','Döş qəfəsində ağrı'] },
     { t:'cta', title:'Trimestrə uyğun məşqlər', body:'Video ilə addım-addım.', cta:{ label:'Məşqlər', nav:{ tool:'exercise' }, premium:true }, illus:'feet' } ] },
 { id:'bump-avoid', module:'bump', title:'Bunlardan qaç', theme:'cream', illus:'bowl',
   audience:{ stage:'bump' }, schedule:{ refresh:'once' }, source:'ÜST, NHS',
   slides:[
     { t:'cover', kicker:'Qida təhlükəsizliyi', title:'Hamiləlikdə __bunlardan__ qaç', illus:'bowl' },
     { t:'list', items:['Çiy və az bişmiş ət, yumurta','Pasterizə olunmamış süd və pendir','Civəsi yüksək balıq: qılınc balığı, köpəkbalığı'] },
     { t:'myth', myth:'Bir qədəh şərab zərərsizdir.', fact:'Hamiləlikdə təhlükəsiz alkoqol miqdarı məlum deyil. Ən təhlükəsiz seçim heç içməməkdir.' },
     { t:'cta', title:'Bu qida təhlükəsizdirmi?', body:'Axtar, cavabı bir saniyədə gör.', cta:{ label:'Təhlükəsizlik yoxlaması', nav:{ tool:'safety' } }, illus:'bowl' } ] },
 { id:'bump-caffeine', module:'bump', title:'Kofein', theme:'violet', illus:'cup',
   audience:{ stage:'bump' }, schedule:{ refresh:'once' }, source:'ACOG',
   slides:[
     { t:'fact', kicker:'Gündəlik hədd', value:'200', unit:'mq', body:'Bu, təxminən 2 kiçik fincan kofedir. Çay, kola və şokoladda da kofein var.' },
     { t:'quiz', title:'Hansında kofein yoxdur?', options:['Qara çay','Kola','Çobanyastığı çayı'], correct:2, explain:'Çobanyastığı çayında kofein yoxdur. Bitki çaylarını da ölçülü iç və həkiminlə məsləhətləş.' } ] },
 { id:'bump-labor-signs', module:'bump', title:'Doğum başlayır?', theme:'coral', illus:'clock',
   audience:{ stage:'bump', weekFrom:32 }, schedule:{ refresh:'weekly' }, source:'ACOG, NHS',
   slides:[
     { t:'cover', kicker:'Yalançı yoxsa əsl?', title:'Sancıları ==ayırd et==', illus:'clock' },
     { t:'myth', myth:'Hər sıxılma doğumdur.', fact:'Yalançı sancılar qeyri-müntəzəmdir və dincələndə keçir. Əsl sancılar müntəzəmdir, güclənir və tezləşir.' },
     { t:'fact', kicker:'İlk doğuş üçün qayda', value:'5-1-1', unit:'', body:'Sancılar 5 dəqiqədən bir, hər biri 1 dəqiqə, 1 saat davam edirsə, doğum evinə zəng et. Suyun gəlməsi və qanaxma isə dərhal müraciət deməkdir.' },
     { t:'cta', title:'Sancıları say', body:'Aralıq və müddət avtomatik hesablanır.', cta:{ label:'Sancı sayğacı', nav:{ tool:'contraction' }, premium:true }, illus:'clock' } ] },
 { id:'bump-partner', module:'bump', title:'Partnyor', theme:'lilac', illus:'chat',
   audience:{ stage:'bump' }, schedule:{ refresh:'once' }, source:'',
   slides:[
     { t:'cover', kicker:'Birlikdə daha asan', title:'Partnyorunu __Anacan-a__ dəvət et', illus:'chat' },
     { t:'list', title:'O nə görəcək', items:['Körpənin həftəlik inkişafı','Həkim görüşləri və alış-veriş siyahısı','Ona uyğun tapşırıqlar'] },
     { t:'cta', title:'Bir linklə qoş', body:'Nəyi paylaşacağını sən seçirsən.', cta:{ label:'Partnyor', nav:{ screen:'partner-sharing' } }, illus:'chat' } ] },
 { id:'bump-names', module:'bump', title:'Ad seçimi', theme:'yellow', illus:'baby',
   audience:{ stage:'bump', weekFrom:16 }, schedule:{ refresh:'once' }, source:'',
   slides:[
     { t:'cover', kicker:'Xoş sual', title:'Körpənin ==adı== nə olacaq?', illus:'baby' },
     { t:'list', title:'Seçməzdən əvvəl 3 sual', items:['Asan tələffüz olunur?','Mənası xoşuna gəlir?','Soyadla ahəngdardır?'] },
     { t:'cta', title:'Mənası ilə adlar', body:'Bəyəndiklərini partnyorunla birlikdə səs ver.', cta:{ label:'Ad tapıcı', nav:{ tool:'names' } }, illus:'baby' } ] },

 // ---- Analıq ----
 { id:'mom-hunger', module:'mommy', title:'Aclıq siqnalı', theme:'peach', illus:'bottle',
   audience:{ stage:'mommy', monthsTo:6 }, schedule:{ refresh:'once' }, source:'ÜST, UNICEF',
   slides:[
     { t:'cover', kicker:'Ekspert məsləhəti', title:'Ağlama ==gec siqnaldır==', illus:'bottle' },
     { t:'list', title:'Erkən aclıq siqnalları', items:['Ağzını açıb-yumur','Əllərini ağzına aparır','Başını döşə tərəf çevirir'] },
     { t:'cta', title:'Qidalanmanı qeyd et', body:'Son qidalanma və növbəti vaxt bir baxışda.', cta:{ label:'Körpə izləyicisi', nav:{ tool:'baby-tracker' }, premium:true }, illus:'bottle' } ] },
 { id:'mom-diapers', module:'mommy', title:'Yaş bezlər', theme:'mint', illus:'drop',
   audience:{ stage:'mommy', monthsTo:2 }, schedule:{ refresh:'once' }, source:'NHS',
   slides:[
     { t:'fact', kicker:'5-ci gündən sonra', value:'6+', unit:'bez', body:'Gündə ən azı 6 yaş bez körpənin kifayət qədər süd aldığını göstərir.' },
     { t:'alert', kicker:'Həkimə zəng et', title:'Bunları görsən', items:['Yaş bez azdır','Körpə çox yuxuludur, əmmir','Dərisi və gözləri saralır'] },
     { t:'cta', title:'Bezləri say', body:'Gündəlik say avtomatik hesablanır.', cta:{ label:'Körpə izləyicisi', nav:{ tool:'baby-tracker' }, premium:true }, illus:'drop' } ] },
 { id:'mom-fever', module:'mommy', title:'Qızdırma', theme:'coral', illus:'thermo',
   audience:{ stage:'mommy', monthsTo:12 }, schedule:{ refresh:'monthly' }, source:'NHS, AAP',
   slides:[
     { t:'fact', kicker:'3 aydan kiçik körpədə', value:'38°', unit:'C', body:'Bu temperatur və ya yuxarısı dərhal həkimə müraciət deməkdir.' },
     { t:'alert', title:'Hər yaşda təcili', items:['Səpgi basanda solmur','Nəfəs almaqda çətinlik','Çox yuxulu, oyanmır','Qıcolma'] },
     { t:'cta', title:'Xəstəlik gündəliyi', body:'Temperatur, dərman və əlamətləri həkimə göstər.', cta:{ label:'Təhlükəli əlamətlər', nav:{ tool:'danger-signs' } }, illus:'thermo' } ] },
 { id:'mom-tummy', module:'mommy', title:'Qarın üstə', theme:'lime', illus:'baby',
   audience:{ stage:'mommy', monthsTo:6 }, schedule:{ refresh:'once' }, source:'ÜST, AAP',
   slides:[
     { t:'fact', kicker:'Gündəlik hədəf', value:'30', unit:'dəqiqə', body:'Oyaq ikən, nəzarət altında, gün ərzində bir neçə dəfəyə bölərək. 3-5 dəqiqədən başla.' },
     { t:'list', title:'Nəyə kömək edir', items:['Boyun və kürək əzələləri güclənir','Başın arxası yastılaşmır','Sürünməyə hazırlıq'] },
     { t:'quote', badge:'Ekspert məsləhəti', quote:'Arxası üstə yat, qarın üstə oyna.', src:'AAP tövsiyəsi əsasında' } ] },
 { id:'mom-teething', module:'mommy', title:'Diş çıxarma', theme:'yellow', illus:'tooth',
   audience:{ stage:'mommy', monthsFrom:4 }, schedule:{ refresh:'once' }, source:'AAP, NHS',
   slides:[
     { t:'cover', kicker:'Təxminən 6 ayda', title:'İlk diş __yoldadır__', illus:'tooth' },
     { t:'list', title:'Rahatlatmaq üçün', items:['Soyudulmuş, dondurulmamış diş halqası','Təmiz barmaqla diş ətinə masaj','Ağız kənarını tez-tez sil'] },
     { t:'alert', kicker:'Təhlükəsizlik', title:'Bunlardan istifadə etmə', items:['Kəhrəba boyunbağı: boğulma riski','Benzokainli gellər'] },
     { t:'cta', title:'Dişləri izlə', body:'Hansı diş nə vaxt çıxdı, bir xəritədə.', cta:{ label:'Diş izləyicisi', nav:{ tool:'teething' }, premium:true }, illus:'tooth' } ] },
 { id:'mom-soothe', module:'mommy', title:'Sakitləşdirmə', theme:'lilac', illus:'baby',
   audience:{ stage:'mommy', monthsTo:4 }, schedule:{ refresh:'once' }, source:'AAP',
   slides:[
     { t:'cover', kicker:'Gecə ağlamaları', title:'Ağlayan körpəni ==sakitləşdir==', illus:'baby' },
     { t:'list', items:['Bələ və ya yumşaq qucaqla','"Şşş" səsi və ya ağ səs','Yavaş yırğala','Əmizdir və ya əmzik ver'] },
     { t:'alert', kicker:'Heç vaxt', title:'Körpəni silkələmə', items:['Əsəbiləşsən, körpəni təhlükəsiz yatağa qoy','Bir neçə dəqiqə nəfəs al, kömək istə'] },
     { t:'cta', title:'Niyə ağlayır?', body:'Ağlamanın səbəbini təxmin et.', cta:{ label:'Ağlama tərcüməçisi', nav:{ tool:'cry-translator' }, premium:true }, illus:'chat' } ] },
 { id:'mom-wake-window', module:'mommy', title:'Oyaqlıq vaxtı', theme:'navy', illus:'clock',
   audience:{ stage:'mommy', monthsTo:12 }, schedule:{ refresh:'monthly' }, source:'Pediatrik yuxu tövsiyələri',
   slides:[
     { t:'cover', kicker:'Yuxu sirri', title:'Yorğun körpə __çətin yatır__', illus:'clock' },
     { t:'list', title:'Təxmini oyaqlıq vaxtı', items:['0-3 ay: 45-90 dəqiqə','4-6 ay: 1,5-2,5 saat','7-12 ay: 2-3,5 saat'] },
     { t:'cta', title:'Növbəti yuxu nə vaxt?', body:'Anacan yaşa görə hesablayır.', cta:{ label:'Yuxu', nav:{ tool:'sleep-training' }, premium:true }, illus:'moon' } ] },
 { id:'mom-allergens', module:'mommy', title:'Allergenlər', theme:'forest', illus:'bowl',
   audience:{ stage:'mommy', monthsFrom:5, monthsTo:12 }, schedule:{ refresh:'once' }, source:'AAP',
   slides:[
     { t:'myth', myth:'Allergen qidaları gec vermək daha təhlükəsizdir.', fact:'Əlavə qidaya başladıqdan sonra yumurta, fıstıq məhsulları kimi allergenləri gecikdirməyə ehtiyac yoxdur.' },
     { t:'list', title:'Necə təqdim etməli', items:['Hər dəfə bir yeni qida','2-3 gün reaksiyanı izlə','Səpgi, qusma olarsa həkimə'] },
     { t:'cta', title:'Allergen planı', body:'Addım-addım bələdçi.', cta:{ label:'Əlavə qida bələdçisi', nav:{ tool:'solid-food-guide' }, premium:true }, illus:'bowl' } ] },
 { id:'mom-choking', module:'mommy', title:'Boğulma riski', theme:'coral', illus:'shield',
   audience:{ stage:'mommy', monthsFrom:6 }, schedule:{ refresh:'once' }, source:'AAP, NHS',
   slides:[
     { t:'cover', kicker:'Təhlükəsizlik', title:'Bu qidaları ==kəsərək== ver', illus:'shield' },
     { t:'list', items:['Üzüm və albalı: uzununa dördə böl','Bütöv qoz-fındıq vermə','Çiy yerkökü: bişir və ya rəndələ','Popkorn: 4 yaşa qədər yox'] },
     { t:'cta', title:'Boğulmada nə etməli?', body:'İlk yardım addımları oflayn da açılır.', cta:{ label:'İlk yardım', nav:{ tool:'first-aid' } }, illus:'shield' } ] },
 { id:'mom-recovery', module:'mommy', title:'Bərpa', theme:'peach', illus:'heart',
   audience:{ stage:'mommy', monthsTo:3 }, schedule:{ refresh:'weekly' }, source:'ACOG',
   slides:[
     { t:'cover', kicker:'Doğuşdan sonra', title:'Bədənin __6 həftəyə__ ehtiyac duyur', illus:'heart' },
     { t:'list', title:'Bu həftələrdə', items:['Kegel məşqləri hər gün','Körpədən ağır şey qaldırma','Qanaxma tədricən azalmalıdır'] },
     { t:'alert', kicker:'Təcili', title:'Bunlar varsa, həkimə', items:['Qanaxma çoxalır, iri laxtalar','Qızdırma','Bir ayaqda ağrı, şişkinlik'] },
     { t:'cta', title:'Bərpa planı', body:'Həftəlik məşqlər və yoxlama.', cta:{ label:'Doğuşdan sonra bərpa', nav:{ screen:'recovery' } }, illus:'heart' } ] },
 { id:'mom-rest', module:'mommy', title:'Sən də dincəl', theme:'cream', illus:'moon',
   audience:{ stage:'mommy', monthsTo:12 }, schedule:{ refresh:'weekly' }, source:'',
   slides:[
     { t:'quote', badge:'Sənin üçün', quote:'Körpə yatanda ev işləri gözləyə bilər. Sən gözləyə bilməzsən.', src:'Anacan' },
     { t:'list', title:'Bu gün özünə 10 dəqiqə', items:['Bir stəkan su və isti çay','Pəncərəni aç, nəfəs al','Yaxınından kömək istə'] } ] },
 { id:'mom-vitd', module:'mommy', title:'D vitamini', theme:'yellow', illus:'sun',
   audience:{ stage:'mommy', monthsTo:12 }, schedule:{ refresh:'once' }, source:'AAP',
   slides:[
     { t:'fact', kicker:'Ana südü ilə qidalanan körpələrə', value:'400', unit:'BV', body:'Gündəlik D vitamini tövsiyə olunur. Dozanı və formanı pediatrla dəqiqləşdir.' },
     { t:'cta', title:'Xatırlatma qur', body:'Hər gün eyni vaxtda bildiriş.', cta:{ label:'Vitamin izləyicisi', nav:{ tool:'vitamin-tracker' }, premium:true }, illus:'sun' } ] },
 { id:'mom-screens', module:'mommy', title:'Ekran vaxtı', theme:'violet', illus:'phone',
   audience:{ stage:'mommy' }, schedule:{ refresh:'once' }, source:'ÜST, AAP',
   slides:[
     { t:'myth', myth:'Cizgi filmlər körpənin inkişafına kömək edir.', fact:'2 yaşa qədər ekran tövsiyə olunmur. Video zəng ilə yaxınları görmək istisnadır.' },
     { t:'list', title:'Ekran yerinə', items:['Kitab oxu, şəkillərə bax','Mahnı oxu, əl çal','Gəzintidə gördüklərini adlandır'] },
     { t:'cta', title:'Yaşa uyğun oyunlar', body:'Hər ay üçün inkişaf oyunları.', cta:{ label:'Oyunlar', nav:{ tool:'mini-games' } }, illus:'book' } ] },
 { id:'mom-vaccine', module:'mommy', title:'Peyvəndlər', theme:'lime', illus:'shield',
   audience:{ stage:'mommy' }, schedule:{ refresh:'monthly', data:'next_vaccine' }, source:'ÜST',
   slides:[
     { t:'cover', kicker:'Vaxtında qoruma', title:'Növbəti peyvənd ==yaxındır==', illus:'shield' },
     { t:'list', title:'Peyvənd günü', items:['Peyvənd kartını götür','Sonra yüngül qızdırma ola bilər','Çox əmizdir, qucaqla'] },
     { t:'cta', title:'Peyvənd təqvimi', body:'Körpənin tarixinə görə xatırlatmalar.', cta:{ label:'Peyvənd təqvimi', nav:{ tool:'vaccine-calendar' } }, illus:'shield' } ] },

 // ---- Dövr ----
 { id:'flow-iron', module:'flow', title:'Dəmir', theme:'coral', illus:'bowl',
   audience:{ stage:'flow' }, schedule:{ refresh:'monthly', phase:'menstruasiya' }, source:'ÜST',
   slides:[
     { t:'cover', kicker:'Ağır dövr günlərində', title:'Dəmirini ==bərpa et==', illus:'bowl' },
     { t:'list', items:['Qırmızı ət, qaraciyər, yumurta','Mərci, noxud, ispanaq','C vitamini ilə birlikdə ye: limon, bibər'] },
     { t:'alert', kicker:'Analiz et', title:'Bunlar varsa, həkimə', items:['Daimi halsızlıq','Baş gicəllənməsi','Saç tökülməsi'] } ] },
 { id:'flow-ovulation', module:'flow', title:'Ovulyasiya', theme:'mint', illus:'cycle',
   audience:{ stage:'flow' }, schedule:{ refresh:'monthly', phase:'ovulyasiya pəncərəsi' }, source:'ACOG',
   slides:[
     { t:'cover', kicker:'Bədənin siqnal verir', title:'Ovulyasiyanın __3 əlaməti__', illus:'cycle' },
     { t:'list', items:['Şəffaf, uzanan ifrazat','Qarının bir tərəfində yüngül ağrı','Bazal temperaturun bir az artması'] },
     { t:'cta', title:'Əlamətləri qeyd et', body:'Proqnoz hər ay daha dəqiq olur.', cta:{ label:'Dövr təqvimi', nav:{ screen:'calendar' } }, illus:'cycle' } ] },
 { id:'flow-fertile', module:'flow', title:'Hamiləlik planı', theme:'lilac', illus:'heart',
   audience:{ stage:'flow', goal:'ttc' }, schedule:{ refresh:'monthly' }, source:'ACOG, ÜST',
   slides:[
     { t:'fact', kicker:'Fertil pəncərə', value:'6', unit:'gün', body:'Ovulyasiya günü və ondan əvvəlki 5 gün. Bu günlərdə hamilə qalma ehtimalı ən yüksəkdir.' },
     { t:'list', title:'Planlaşdırırsansa', items:['Fol turşusuna indidən başla','Həkimlə ilkin müayinə','Siqareti və alkoqolu burax'] },
     { t:'cta', title:'Hamiləlik planı rejimi', body:'LH testi, bazal temperatur və fertil günlər.', cta:{ label:'Hamiləlik planı', nav:{ screen:'calendar' } }, illus:'heart' } ] },
 { id:'flow-tampon', module:'flow', title:'Gigiyena', theme:'navy', illus:'clock',
   audience:{ stage:'flow' }, schedule:{ refresh:'once' }, source:'FDA',
   slides:[
     { t:'fact', kicker:'Tampon üçün maksimum', value:'8', unit:'saat', body:'Daha uzun saxlamaq nadir, amma təhlükəli toksik şok sindromu riskini artırır.' },
     { t:'list', title:'Sadə qaydalar', items:['Ən az udma gücü olanı seç','Gecə üçün bez daha yaxşıdır','Qızdırma, səpgi olarsa çıxar və həkimə'] } ] },
 { id:'flow-pcos', module:'flow', title:'PKOS', theme:'peach', illus:'cycle',
   audience:{ stage:'flow' }, schedule:{ refresh:'once' }, source:'ÜST',
   slides:[
     { t:'fact', kicker:'Polikistoz yumurtalıq sindromu', value:'1/10', unit:'qadın', body:'Təxminən hər 10 qadından biri PKOS ilə yaşayır, çoxu bunu bilmir.' },
     { t:'list', title:'Həkimlə danış, əgər', items:['Dövrlər çox qeyri-müntəzəmdir','Sızanaq və artıq tük artıb','Hamilə qalmaqda çətinlik var'] },
     { t:'cta', title:'Həkim üçün hesabat', body:'Tsikl tarixçəni PDF kimi göstər.', cta:{ label:'Simptom hesabatı', nav:{ screen:'doctor-report' }, premium:true }, illus:'doc' } ] },
 { id:'flow-mood', module:'flow', title:'Əhval', theme:'violet', illus:'heart',
   audience:{ stage:'flow' }, schedule:{ refresh:'monthly', phase:'lüteal faza' }, source:'ACOG',
   slides:[
     { t:'cover', kicker:'Lüteal faza', title:'Əhvalın dəyişir? __Səbəbi var__', illus:'heart' },
     { t:'list', items:['Hormonlar əhvala təsir edir','Yuxu və hərəkət kömək edir','Qeyd et: təkrarlanan nümunəni gör'] },
     { t:'alert', kicker:'PMDD ola bilər', title:'Ağır depressiv hisslər hər ay təkrarlanırsa', items:['Həkimə və ya psixoloqa müraciət et'] },
     { t:'cta', title:'Əhvalını qeyd et', body:'5 saniyə, gündə bir dəfə.', cta:{ label:'Əhval gündəliyi', nav:{ tool:'mood' } }, illus:'heart' } ] },
 { id:'flow-why-track', module:'flow', title:'Niyə izləməli', theme:'yellow', illus:'doc',
   audience:{ stage:'flow' }, schedule:{ refresh:'once' }, source:'',
   slides:[
     { t:'cover', kicker:'Kiçik vərdiş, böyük fayda', title:'Tsiklini izləmək ==nə verir?==', illus:'doc' },
     { t:'list', items:['Növbəti dövrü əvvəlcədən bil','Qeyri-müntəzəmliyi erkən gör','Həkimə dəqiq məlumat apar'] },
     { t:'cta', title:'Bu günü qeyd et', body:'Bir toxunuş kifayətdir.', cta:{ label:'Dövr təqvimi', nav:{ screen:'calendar' } }, illus:'cycle' } ] },
 { id:'flow-bloating', module:'flow', title:'Şişkinlik', theme:'forest', illus:'drop',
   audience:{ stage:'flow' }, schedule:{ refresh:'monthly', phase:'lüteal faza' }, source:'ACOG',
   slides:[
     { t:'myth', myth:'Şişkinlikdə su az içmək lazımdır.', fact:'Əksinə, kifayət qədər su içmək və duzu azaltmaq şişkinliyi yüngülləşdirə bilər.' },
     { t:'list', title:'Kömək edənlər', items:['Duzlu qəlyanaltıları azalt','Gündə 20 dəqiqə gəzinti','Kalium: banan, qatıq'] } ] },
 { id:'flow-sleep', module:'flow', title:'Yuxu', theme:'navy', illus:'moon',
   audience:{ stage:'flow' }, schedule:{ refresh:'monthly', phase:'lüteal faza' }, source:'',
   slides:[
     { t:'cover', kicker:'Dövrdən əvvəl', title:'Yuxun __pisləşir?__', illus:'moon' },
     { t:'list', items:['Otağı sərin saxla','Axşam kofeindən qaç','Yatmazdan 1 saat əvvəl ekransız'] },
     { t:'cta', title:'Sakitləşdirici səslər', body:'Yağış, dəniz, ağ səs.', cta:{ label:'Ağ səs', nav:{ tool:'whitenoise' }, premium:true }, illus:'moon' } ] },

 { id:'flow-pain', module:'flow', title:'Ağrı normaldır?', theme:'lilac', illus:'thermo',
   audience:{ stage:'flow' }, schedule:{ refresh:'monthly', phase:'menstruasiya' }, source:'ACOG',
   slides:[
     { t:'quiz', kicker:'Quiz', title:'Dövr ağrısı nə vaxt normal deyil?', options:['İlk 1-2 gün yüngül sancı','Ağrıkəsici kömək etmir, işə gedə bilmirsən'], correct:1, explain:'Gündəlik həyatını dayandıran ağrı endometrioz kimi səbəblərin əlaməti ola bilər. Həkimə müraciət et.' },
     { t:'list', title:'Rahatlatmaq üçün', items:['Qarın altına isti kompres','Yüngül dartınma və gəzinti','Həkimin tövsiyə etdiyi ağrıkəsici'] },
     { t:'cta', title:'Ağrını qeyd et', body:'Şiddət və günlər həkim hesabatına düşür.', cta:{ label:'Dövr təqvimi', nav:{ screen:'calendar' } }, illus:'cycle' } ] },
 // ---- Hamı üçün ----
 { id:'all-handwash', module:'all', title:'Əl yuma', theme:'mint', illus:'drop',
   audience:{ stage:['bump','mommy','flow'] }, schedule:{ refresh:'monthly' }, source:'ÜST',
   slides:[
     { t:'fact', kicker:'Sadə, amma təsirli', value:'20', unit:'saniyə', body:'Əlləri sabunla ən azı 20 saniyə yu: ovuclar, barmaq araları, dırnaq altları və biləklər. Bu sadə qayda bir çox infeksiyanın qarşısını alır.' },
     { t:'list', title:'Xüsusilə', items:['Körpəyə toxunmazdan əvvəl','Bez dəyişdikdən sonra','Yemək hazırlamadan əvvəl'] } ] },
 { id:'all-sun', module:'all', title:'Günəş', theme:'yellow', illus:'sun',
   audience:{ stage:['bump','mommy','flow'] }, schedule:{ refresh:'once', season:'summer' }, source:'AAP',
   slides:[
     { t:'cover', kicker:'Yay məsləhəti', title:'Günəşdən ==ağıllı== qorun', illus:'sun' },
     { t:'list', items:['6 aydan kiçik körpə birbaşa günəşdə olmasın','Papaq və yüngül, uzun geyim','Böyüklər üçün SPF 30+'] },
     { t:'cta', title:'Bu gün nə geyinsin?', body:'Havaya görə geyim məsləhəti.', cta:{ label:'Hava və geyim', nav:{ tool:'weather-clothing' }, premium:true }, illus:'sun' } ] },
 { id:'all-car-seat', module:'all', title:'Avtomobildə', theme:'coral', illus:'car',
   audience:{ stage:['bump','mommy'] }, schedule:{ refresh:'once' }, source:'AAP',
   slides:[
     { t:'cover', kicker:'Təhlükəsizlik', title:'Qucaqda yox, ==oturacaqda==', illus:'car' },
     { t:'list', items:['İlk gündən uşaq oturacağı','Mümkün qədər uzun arxaya baxan','Ön oturacaqda körpə olmasın'] },
     { t:'cta', title:'Doğum çantası siyahısına əlavə et', body:'Evə dönüş üçün də hazır ol.', cta:{ label:'Xəstəxana çantası', nav:{ tool:'hospital' } }, illus:'bag' } ] },
 { id:'all-room-temp', module:'all', title:'Otaq istiliyi', theme:'navy', illus:'thermo',
   audience:{ stage:['mommy'] }, schedule:{ refresh:'once', season:'winter' }, source:'NHS',
   slides:[
     { t:'fact', kicker:'Körpənin yatdığı otaq', value:'16-20', unit:'°C', body:'Həddən artıq isti otaq ani körpə ölümü riskini artırır.' },
     { t:'list', title:'Yoxla', items:['Ənsəsi tərləyibsə, isti geyinib','Əl-ayağın soyuq olması normaldır','Papaqla yatırtma'] },
     { t:'cta', title:'Otaq səs-küyü də vacibdir', body:'Səs səviyyəsini ölç.', cta:{ label:'Səs ölçən', nav:{ tool:'noise-meter' }, premium:true }, illus:'thermo' } ] },
 { id:'all-breathe', module:'all', title:'2 dəqiqə sakitlik', theme:'lilac', illus:'blob',
   audience:{ stage:['bump','mommy','flow'] }, schedule:{ refresh:'weekly' }, source:'',
   slides:[
     { t:'cover', kicker:'İndi, burada', title:'Gəl, birlikdə __nəfəs alaq__', illus:'blob' },
     { t:'list', items:['4 saniyə burnundan al','4 saniyə saxla','6 saniyə ağzından ver','5 dəfə təkrarla'] },
     { t:'quote', badge:'Kiçik xatırlatma', quote:'Hər şeyi bu gün etməli deyilsən.', src:'Anacan' } ] },
 { id:'all-first-aid', module:'all', title:'İlk yardım', theme:'coral', illus:'shield',
   audience:{ stage:['bump','mommy'] }, schedule:{ refresh:'monthly' }, source:'Qırmızı Xaç, AAP',
   slides:[
     { t:'cover', kicker:'Bilmək vacibdir', title:'1 yaşdan kiçik körpə ==boğulursa==', illus:'shield' },
     { t:'list', items:['Üzü aşağı qolunun üstünə qoy','Kürəyinə 5 zərbə','Arxası üstə çevir, 2 barmaqla 5 sinə təzyiqi','103-ə zəng et, təkrarla'] },
     { t:'cta', title:'Bütün addımlar şəkillərlə', body:'İnternetsiz də açılır.', cta:{ label:'İlk yardım', nav:{ tool:'first-aid' } }, illus:'shield' } ] },
 { id:'all-blog', module:'all', title:'Həftənin məqaləsi', theme:'cream', illus:'book',
   audience:{ stage:['bump','mommy','flow'] }, schedule:{ refresh:'weekly', data:'blog_top_week' }, source:'',
   slides:[
     { t:'cover', kicker:'Bu həftə ən çox oxunan', title:'__Ekspertlərdən__ 5 dəqiqəlik oxu', illus:'book' },
     { t:'list', title:'Bu həftə', items:['Körpə yuxusu: 4 aylıq reqressiya','Hamiləlikdə dəmir çatışmazlığı','Dövr ağrısı nə vaxt normal deyil'] },
     { t:'cta', title:'Bloqu aç', body:'Yaşına və mərhələnə uyğun seçilmiş məqalələr.', cta:{ label:'Bloq', nav:{ tool:'blog' } }, illus:'book' } ] },
 { id:'all-premium', module:'all', title:'Premium', theme:'violet', illus:'blob',
   audience:{ stage:['bump','mommy','flow'], premium:false }, schedule:{ refresh:'weekly' }, source:'',
   slides:[
     { t:'cover', kicker:'Anacan Premium', title:'Hər şey ==bir yerdə==', illus:'blob' },
     { t:'list', items:['Limitsiz Anacan AI','Körpə izləyicisi və həftəlik analiz','Həkim üçün PDF hesabat','Reklamsız'] },
     { t:'cta', title:'3 gün pulsuz sına', body:'İstədiyin vaxt ləğv et.', cta:{ label:'Premium', nav:{ screen:'billing' }, premium:true }, illus:'blob' } ] },

 // ================= +20 (2026-11-09, app launch set) =================
 { id:'bump-heartburn', module:'bump', title:'Ürək yanması', theme:'peach', illus:'drop',
   audience:{ stage:'bump', weekFrom:16 }, schedule:{ refresh:'once' }, source:'NHS',
   slides:[
     { t:'cover', kicker:'Çox yayılmış narahatlıq', title:'Ürək yanmasını ==azalt==', illus:'drop' },
     { t:'list', items:['Az-az, tez-tez ye','Yeməkdən sonra 2-3 saat uzanma','Yastığı bir az hündür qoy','Ədviyyatlı və yağlı yeməyi azalt'] },
     { t:'alert', kicker:'Həkimə de', title:'Dərman lazım ola bilər', items:['Antasidləri həkimlə məsləhətləşib iç','Döş ağrısı ilə birlikdədirsə, təcili'] } ] },
 { id:'bump-swelling', module:'bump', title:'Şişkinlik', theme:'mint', illus:'feet',
   audience:{ stage:'bump', weekFrom:24 }, schedule:{ refresh:'once' }, source:'NHS',
   slides:[
     { t:'myth', myth:'Hamiləlikdə hər şişkinlik təhlükəlidir.', fact:'Axşamlar ayaqlarda yüngül şişkinlik çox vaxt normaldır. Qəfil və üzdə, əllərdə şişkinlik isə həkimə müraciət deməkdir.' },
     { t:'list', title:'Yüngülləşdirmək üçün', items:['Ayaqlarını hündürə qaldır','Uzun müddət ayaq üstə durma','Gün ərzində kifayət qədər su iç'] } ] },
 { id:'bump-iron', module:'bump', title:'Dəmir', theme:'coral', illus:'bowl',
   audience:{ stage:'bump' }, schedule:{ refresh:'once' }, source:'ÜST',
   slides:[
     { t:'fact', kicker:'Hamiləlikdə ehtiyac', value:'2x', unit:'dəmir', body:'Qan həcmi artdığı üçün dəmirə ehtiyac təxminən iki dəfə çoxalır. Analizlərini həkiminlə izlə.' },
     { t:'list', title:'Dəmiri yaxşı mənimsə', items:['C vitamini ilə birlikdə ye','Çayı yeməkdən 1 saat sonra iç','Həkimin yazdığı dəmiri unutma'] },
     { t:'cta', title:'Vitaminlərini izlə', body:'Gündəlik xatırlatma ilə.', cta:{ label:'Vitamin izləyicisi', nav:{ tool:'vitamin-tracker' }, premium:true }, illus:'pill' } ] },
 { id:'bump-dental', module:'bump', title:'Diş həkimi', theme:'yellow', illus:'tooth',
   audience:{ stage:'bump' }, schedule:{ refresh:'once' }, source:'ACOG',
   slides:[
     { t:'myth', myth:'Hamiləlikdə diş həkiminə getmək olmaz.', fact:'Diş müayinəsi və müalicəsi hamiləlikdə təhlükəsizdir və vacibdir. Həkimə hamilə olduğunu de.' },
     { t:'list', title:'Diş əti qanayırsa', items:['Yumşaq fırça istifadə et','Gündə 2 dəfə fırçala, diş sapı işlət','Diş həkiminə göstər'] } ] },
 { id:'bump-pelvic', module:'bump', title:'Çanaq dibi', theme:'lilac', illus:'heart',
   audience:{ stage:'bump' }, schedule:{ refresh:'once' }, source:'NHS',
   slides:[
     { t:'cover', kicker:'Gündə 3 dəfə', title:'Kegel məşqləri ==indi== başla', illus:'heart' },
     { t:'list', items:['Sidiyi saxlayırmış kimi əzələləri sıx','10 saniyə saxla, burax','10 dəfə təkrarla'] },
     { t:'quote', badge:'Ekspert məsləhəti', quote:'Hamiləlikdə gücləndirilən çanaq dibi doğuşdan sonra bərpanı asanlaşdırır.', src:'NHS tövsiyəsi əsasında' } ] },
 { id:'bump-travel', module:'bump', title:'Səyahət', theme:'navy', illus:'car',
   audience:{ stage:'bump' }, schedule:{ refresh:'once' }, source:'RCOG',
   slides:[
     { t:'cover', kicker:'Yola çıxırsan?', title:'Hamiləlikdə __rahat__ səyahət', illus:'car' },
     { t:'list', items:['Kəmər qarnın altından, budlar üzərindən','Hər 1-2 saatda dayan, ayaqlarını hərəkət etdir','Mübadilə kartını yanında saxla'] },
     { t:'alert', kicker:'Uçuş', title:'36-cı həftədən sonra', items:['Əksər aviaşirkətlər icazə vermir','Həkimdən arayış soruşa bilərlər'] } ] },
 { id:'mom-breastfeed-latch', module:'mommy', title:'Döşə tutma', theme:'peach', illus:'bottle',
   audience:{ stage:'mommy', monthsTo:3 }, schedule:{ refresh:'once' }, source:'ÜST, UNICEF',
   slides:[
     { t:'cover', kicker:'Əmizdirmə', title:'Düzgün tutuş ==ağrısız== olur', illus:'bottle' },
     { t:'list', items:['Ağzı geniş açıq, dodaqları çölə','Döşün tünd hissəsinin çoxu ağzında','Çənəsi döşə toxunur'] },
     { t:'alert', kicker:'Kömək istə', title:'Bunlar varsa', items:['Hər əmizdirmə ağrılıdır','Döşdə çat, qızartı, qızdırma'] } ] },
 { id:'mom-colic', module:'mommy', title:'Kolik', theme:'violet', illus:'baby',
   audience:{ stage:'mommy', monthsTo:4 }, schedule:{ refresh:'once' }, source:'NHS',
   slides:[
     { t:'fact', kicker:'Kolik qaydası', value:'3', unit:'saat', body:'Gündə 3 saatdan çox, həftədə 3 gündən çox ağlama kolik ola bilər. Adətən 3-4 aya keçir.' },
     { t:'list', title:'Sakitləşdirmək üçün', items:['Qucaqda dik saxla','Qarnını saat əqrəbi istiqamətində sığalla','Ağ səs və ya yumşaq yırğalama'] },
     { t:'cta', title:'Niyə ağlayır?', body:'Ağlama tərcüməçisi ilə yoxla.', cta:{ label:'Ağlama tərcüməçisi', nav:{ tool:'cry-translator' }, premium:true }, illus:'chat' } ] },
 { id:'mom-bath', module:'mommy', title:'Çimizdirmə', theme:'mint', illus:'drop',
   audience:{ stage:'mommy', monthsTo:12 }, schedule:{ refresh:'once' }, source:'NHS',
   slides:[
     { t:'fact', kicker:'Suyun istiliyi', value:'37', unit:'°C', body:'Dirsəyinlə yoxla: isti yox, ilıq olmalıdır. Həftədə 2-3 dəfə çimizdirmək kifayətdir.' },
     { t:'alert', kicker:'Heç vaxt', title:'Körpəni suda tək qoyma', items:['Bir saniyəlik də olsa','Lazım olanları əvvəlcədən yanına qoy'] } ] },
 { id:'mom-reading', module:'mommy', title:'Kitab oxu', theme:'cream', illus:'book',
   audience:{ stage:'mommy' }, schedule:{ refresh:'once' }, source:'AAP',
   slides:[
     { t:'cover', kicker:'Gündə 10 dəqiqə', title:'Körpəyə ==kitab== oxu', illus:'book' },
     { t:'list', title:'Nə qazanır', items:['Söz ehtiyatı böyüyür','Səsini tanıyır, sakitləşir','Sizin üçün xüsusi vaxt yaranır'] },
     { t:'cta', title:'Yuxu nağılları', body:'Körpənin adı ilə fərdi nağıllar.', cta:{ label:'Nağıllar', nav:{ tool:'fairy-tale' }, premium:true }, illus:'book' } ] },
 { id:'mom-skin', module:'mommy', title:'Dəri qayğısı', theme:'yellow', illus:'baby',
   audience:{ stage:'mommy', monthsTo:12 }, schedule:{ refresh:'once' }, source:'NHS',
   slides:[
     { t:'list', title:'Bez səpgisinə qarşı', items:['Bezi tez-tez dəyiş','Dərini quru saxla, havalandır','Qoruyucu krem nazik qatla'] },
     { t:'alert', kicker:'Həkimə göstər', title:'Bunlar varsa', items:['Səpgi qabarcıqlıdır və ya irinlidir','Qızdırma ilə birlikdədir','3 gündə keçmir'] } ] },
 { id:'mom-car-nap', module:'mommy', title:'Yuxu təhlükəsizliyi', theme:'navy', illus:'moon',
   audience:{ stage:'mommy', monthsTo:12 }, schedule:{ refresh:'once' }, source:'AAP',
   slides:[
     { t:'myth', myth:'Körpə avtomobil oturacağında rahat yatır, saatlarla qala bilər.', fact:'Oturacaq yol üçündür. Evə çatanda körpəni düz, bərk yatağa köçür.' },
     { t:'list', title:'Divanda yatma', items:['Körpə ilə divanda yuxuya getmə','Yorğunsansa, körpəni öz yatağına qoy'] } ] },
 { id:'mom-walk', module:'mommy', title:'Gəzinti', theme:'lime', illus:'sun',
   audience:{ stage:'mommy' }, schedule:{ refresh:'weekly' }, source:'ÜST',
   slides:[
     { t:'cover', kicker:'Hər gün', title:'Təmiz hava __ikinizə__ də lazımdır', illus:'sun' },
     { t:'list', items:['Gündüz işığı yuxu ritmini qurur','Gəzinti ananın əhvalını yaxşılaşdırır','Havaya uyğun geyindir'] },
     { t:'cta', title:'Bu gün nə geyinsin?', body:'Havaya görə məsləhət.', cta:{ label:'Hava və geyim', nav:{ tool:'weather-clothing' }, premium:true }, illus:'sun' } ] },
 { id:'flow-water', module:'flow', title:'Su və dövr', theme:'navy', illus:'drop',
   audience:{ stage:'flow' }, schedule:{ refresh:'monthly', phase:'menstruasiya' }, source:'ACOG',
   slides:[
     { t:'cover', kicker:'Dövr günlərində', title:'Su iç, ==yaxşı== hiss et', illus:'drop' },
     { t:'list', items:['Su sancı və baş ağrısını azalda bilər','Kofeini və duzu azalt','Isti bitki çayları rahatladır'] } ] },
 { id:'flow-exercise-phase', module:'flow', title:'Faza və idman', theme:'lime', illus:'feet',
   audience:{ stage:'flow' }, schedule:{ refresh:'monthly', phase:'follikulyar faza' }, source:'',
   slides:[
     { t:'cover', kicker:'Follikulyar faza', title:'Enerjin ==yüksəkdir==', illus:'feet' },
     { t:'list', title:'Bu günlər üçün', items:['Daha intensiv məşq yaxşı gedir','Yeni idmana başlamaq üçün uyğun vaxt','Bədənini dinlə, istirahəti unutma'] },
     { t:'cta', title:'Məşq proqramı', body:'Tsikl fazasına uyğun.', cta:{ label:'Məşqlər', nav:{ tool:'exercise' }, premium:true }, illus:'feet' } ] },
 { id:'flow-checkup', module:'flow', title:'Müayinə', theme:'cream', illus:'doc',
   audience:{ stage:'flow' }, schedule:{ refresh:'once' }, source:'ÜST',
   slides:[
     { t:'fact', kicker:'Ginekoloji müayinə', value:'1', unit:'il', body:'İldə bir dəfə profilaktik müayinə tövsiyə olunur. Şikayət varsa, gözləmə.' },
     { t:'list', title:'Özünlə apar', items:['Son 3 tsiklin tarixləri','Əlamətlərin siyahısı','Suallarını yaz'] },
     { t:'cta', title:'Simptom hesabatı', body:'Tsikl tarixçən bir PDF-də.', cta:{ label:'Həkim hesabatı', nav:{ screen:'doctor-report' }, premium:true }, illus:'doc' } ] },
 { id:'flow-stress', module:'flow', title:'Stress', theme:'lilac', illus:'blob',
   audience:{ stage:'flow' }, schedule:{ refresh:'once' }, source:'ACOG',
   slides:[
     { t:'myth', myth:'Gecikmə həmişə hamiləlik deməkdir.', fact:'Stress, səyahət, kəskin çəki dəyişikliyi və xəstəlik də dövrü gecikdirə bilər. Şübhə varsa, test et.' },
     { t:'list', title:'Stressi azalt', items:['Gündə 7-9 saat yuxu','Qısa gəzintilər','Nəfəs məşqi: 4 al, 6 ver'] } ] },
 { id:'all-sleep-mom', module:'all', title:'Ana yuxusu', theme:'navy', illus:'moon',
   audience:{ stage:['bump','mommy'] }, schedule:{ refresh:'weekly' }, source:'',
   slides:[
     { t:'cover', kicker:'Sənin üçün', title:'Yuxusuzluq __normal__ deyil, kömək istə', illus:'moon' },
     { t:'list', items:['Gecə növbəsini partnyorla bölüş','Gündüz 20 dəqiqə də olsa uzan','Yatmazdan əvvəl ekranı kənara qoy'] },
     { t:'cta', title:'Sakitləşdirici səslər', body:'Yağış, dəniz, ağ səs.', cta:{ label:'Ağ səs', nav:{ tool:'whitenoise' }, premium:true }, illus:'moon' } ] },
 { id:'all-doctors', module:'all', title:'Həkim tap', theme:'lime', illus:'heart',
   audience:{ stage:['bump','mommy','flow'] }, schedule:{ refresh:'once' }, source:'',
   slides:[
     { t:'cover', kicker:'Bakı və bölgələr', title:'Sənə uyğun ==həkimi== tap', illus:'heart' },
     { t:'list', items:['Ginekoloq, pediatr, laktasiya məsləhətçisi','Ünvan və əlaqə məlumatları','Analardan rəylər'] },
     { t:'cta', title:'Həkimlər', body:'Pulsuz, hər zaman açıq.', cta:{ label:'Həkimlər', nav:{ tool:'doctors' } }, illus:'heart' } ] },
 { id:'all-shopping', module:'all', title:'Alış-veriş', theme:'yellow', illus:'bag',
   audience:{ stage:['bump','mommy'] }, schedule:{ refresh:'once' }, source:'',
   slides:[
     { t:'cover', kicker:'Ağıllı alış-veriş', title:'Lazım olanı al, ==artığını== yox', illus:'bag' },
     { t:'list', title:'İlk aylar üçün əsaslar', items:['Bezlər və salfetlər','Mövsümə uyğun 6-8 bodi','Avtomobil oturacağı'] },
     { t:'cta', title:'Paylaşılan siyahı', body:'Partnyorun da görür, alanda işarələyir.', cta:{ label:'Alış-veriş siyahısı', nav:{ tool:'shopping' } }, illus:'bag' } ] },
];
