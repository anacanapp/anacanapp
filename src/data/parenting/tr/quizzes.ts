import type { MilestoneQuiz, StyleQuiz } from '../types';
import { S } from './sources';

export const STYLE_QUIZ: StyleQuiz = {
  id: 'style',
  emoji: '🪞',
  title: 'Benim ebeveynlik tarzım',
  intro: '12 kısa ifade. Son iki haftayı düşün ve içtenlikle cevap ver — burada doğru ya da yanlış cevap yok. Sonuç sadece senin telefonunda kalır.',
  scale: ['Neredeyse hiçbir zaman', 'Bazen', 'Sık sık', 'Neredeyse her zaman'],
  items: [
    { text: 'Çocuğum üzgün ya da kızgın olduğunda duygusunu adlandırır ve yanında olurum.', dim: 'warmth' },
    { text: 'Gün içinde ona sarılmaya, birlikte gülmeye, “seni seviyorum” demeye zaman bulurum.', dim: 'warmth' },
    { text: 'Çocuğum konuşurken telefonu bir kenara bırakıp dinlerim.', dim: 'warmth' },
    { text: 'İyi davranışlarını fark eder ve adlandırırım.', dim: 'warmth' },
    { text: 'Evde çocuğumun bildiği birkaç net kural var.', dim: 'structure' },
    { text: 'Bir kural koyduktan sonra onu sakince uygularım.', dim: 'structure' },
    { text: 'Günlük düzenimiz (yemek, uyku) aşağı yukarı sabittir.', dim: 'structure' },
    { text: 'Çocuğum ağladığında ya da ısrar ettiğinde verdiğim “hayır”dan vazgeçerim.', dim: 'giveIn' },
    { text: 'Yorgun olduğumda kuralları tamamen bırakırım, “ne isterse yapsın”.', dim: 'giveIn' },
    { text: 'Sinirlendiğimde sesimi yükseltirim ya da bağırırım.', dim: 'harsh' },
    { text: 'Çocuğumu tehdit ederim (“seni burada bırakıp gideceğim”, “seni polise vereceğim”).', dim: 'harsh' },
    { text: 'Sinirli anlarda ona vurmak ya da sert sözler söylemek istediğim olur ve bazen yaparım.', dim: 'harsh' },
  ],
  results: {
    balanced: {
      title: 'Sıcak ve net',
      short: 'Hem sevgi gösteriyorsun hem de net sınırlar koyuyorsun — araştırmaların en faydalı bulduğu birleşim.',
      detail: [
        'Psikologlar bu tarza “demokratik” (yetkili) diyor: yüksek sıcaklık ve yüksek yapı. Bu tarzla büyüyen çocuklar ortalamada daha bağımsız, özgüvenli olur ve duygularını daha iyi yönetir.',
        'Bu kusursuz olmak demek değil. Sen de yoruluyorsun, bazen sabrın tükeniyor. Farkı yaratan, zor anlardan sonra ilişkiye geri dönmen.',
      ],
      next: ['Çocuk büyüdükçe kuralları onunla birlikte belirlemeye başla.', 'Kendine bakmayı unutma: sakin bir ebeveyn olmak için dinlenmek gerekir.', '“Özel zaman” alışkanlığını koru — bu en güçlü “sigortadır”.'],
    },
    gentle: {
      title: 'Çok sıcak, sınırlar yumuşak',
      short: 'Çocuğunla çok yakınsın ve duygularına duyarlısın. Bazen sınırları korumak zor geliyor.',
      detail: [
        'Sıcaklık senin en güçlü yanın ve bu, çocuğun güvenli bağlanması için paha biçilmez. Ama çocuklar sınırları, yerinde olup olmadıklarını anlamak için sınar. Sınır yumuşadığında çocuk daha çok sınar, ebeveyn ise tükenir.',
        'Sevgi ve sınır birbirine zıt değildir. “Seni seviyorum ve cevap yine de hayır” demek çocuğa güven verir.',
      ],
      next: ['3–5 net aile kuralı seç ve onları sakince uygula.', 'Öfke nöbeti sırasında empati göster, ama kararını değiştirme.', '“Bağırmadan 21 gün” programındaki “bir cümle, bir kez” adımını dene.'],
    },
    storm: {
      title: 'Sevgi dolu, ama yorgun anlarda patlayan',
      short: 'Çocuğuna çok bağlısın, ama stresli anlarda sesin yükseliyor. Bu, pek çok ebeveynin tanıdığı bir durum.',
      detail: [
        'Sıcaklığın güçlü bir temel. Bağırmak ve sert sözler ise çoğu zaman sevgisizliğin değil, yorgunluğun, acelenin ve yalnız kalmanın sonucudur.',
        'Araştırmalar, ilişki sıcak olsa bile düzenli bağırmanın çocuğun davranışını olumsuz etkilediğini gösteriyor. İyi haber: öz düzenleme öğrenilebilen bir beceridir ve onarım sohbetleri ilişkiyi korur.',
      ],
      next: ['Tetikleyicilerini bul: hangi saatler, hangi durumlar?', '“Duraklatma düğmesi” ve uzun nefes vermeyle başla.', '“Bağırmadan 21 gün” programı tam sana göre.'],
    },
    strict: {
      title: 'Sınırlar güçlü, sıcaklık geri planda',
      short: 'Düzene ve kurala önem veriyorsun. Bazen bu, sıcaklık ve dinleme pahasına oluyor.',
      detail: [
        'Kurallar ve tutarlılık çocuk için önemlidir — bu senin güçlü yanın. Ama araştırmalara göre sert kontrol ve cezayla konan sınırlar uzun vadede davranış sorunlarını azaltmaz, tersine artırabilir.',
        'Kuralları korurken sıcaklığı artırmak mümkün: açıklamak, duyguyu adlandırmak, iyi davranışı fark etmek.',
      ],
      next: ['Her gün 10 dakika çocuğun yönettiği oyun zamanı.', 'Ceza yerine mantıklı sonuçlar kullan.', 'Bir kuralı açıkla: “Bu kural var, çünkü…”'],
    },
    stretched: {
      title: 'Yorgun ve tükenmiş',
      short: 'Görünüşe göre son zamanlarda çok yorgunsun. Bu kötü bir ebeveyn olmak değil, desteğe ihtiyaç olduğunun sinyali.',
      detail: [
        'Ebeveyn tükendiğinde ne sıcaklık ne de yapı için güç kalır. Bu çok yaygın ve anlaşılır bir durum, özellikle bebek, uykusuzluk, iş ve yalnızlık bir araya geldiğinde.',
        'Bu sonuç bir suçlama değil, senin de kendine bakılmaya ihtiyacın olduğunu gösteriyor. Küçük adımlar ve yardım istemek her şeyi değiştirebilir.',
      ],
      next: ['Yükü paylaş: partnerinle, ailenle, arkadaşlarınla somut bir yardım üzerinde anlaş.', 'Günde 5 dakikalık bir bağ anı: sadece sarılma ve göz teması.', 'İki haftadan uzun süredir üzüntü ya da umutsuzluk hissediyorsan bir doktor ya da psikologla konuş.'],
    },
  },
  note: 'Bu test bir tanı değil, kendini gözlemlemek için basit bir araçtır. Baumrind’in sıcaklık ve yapı boyutlarına dayanır.',
  sources: [S.baumrind1966, S.baumrind1967, S.pinquart2017, S.wangKenny2014],
};

export const MILESTONE_QUIZ: MilestoneQuiz = {
  id: 'milestones',
  emoji: '🧩',
  title: 'Çocuğum bu yaşta neler yapabilmeli?',
  intro: 'CDC ve Amerikan Pediatri Akademisi’nin gelişim basamaklarına dayanan kısa bir kontrol. Çocukların çoğu (yaklaşık 4’te 3’ü) bu yaşta bu becerileri gösterir. Her çocuk kendi hızında gelişir.',
  answers: { yes: 'Evet', no: 'Henüz değil', unsure: 'Emin değilim' },
  regression: 'Önceden yapabildiği bir beceriyi (kelime, oyun, hareket) kaybetti mi?',
  checkpoints: [
    {
      id: 'm4',
      fromMonths: 4,
      title: '4 ay',
      items: [
        { text: 'Seni görünce kendiliğinden gülümser, dikkatini çekmeye çalışır.', flag: true, support: 'Yüz yüze çok zaman geçir: gülümse, bekle, onun gülümsemesine karşılık ver.' },
        { text: '“A-a”, “u-u” gibi sesler çıkarır, sen konuşunca sesle karşılık verir.', support: 'Seslerini taklit et, sonra “cevap” vermesi için ara ver.' },
        { text: 'Sesini duyunca başını sese doğru çevirir.', flag: true, support: 'Farklı yönlerden yumuşak bir sesle adını seslen.' },
        { text: 'Kucaktayken başını desteksiz dik tutar.', support: 'Uyanıkken günde birkaç kez kısa “karın üstü zamanı”.' },
        { text: 'Eline verilen oyuncağı tutar ve tutmaya devam eder.', support: 'Hafif, tutması kolay çıngıraklı oyuncaklar ver.' },
        { text: 'Karnının üstündeyken dirseklerine dayanıp başını kaldırır.', support: 'Önüne bir ayna ya da renkli bir oyuncak koy.' },
      ],
    },
    {
      id: 'm9',
      fromMonths: 9,
      title: '9 ay',
      items: [
        { text: 'Adı söylendiğinde bakar.', flag: true, support: 'Oyunlarda adını sık sık kullan, baktığında gülümse ve öv.' },
        { text: '“Ma-ma-ma”, “ba-ba-ba” gibi farklı heceler söyler.', flag: true, support: 'Heceleri birlikte tekrarlayın, şarkılar söyle.' },
        { text: 'Kucağa alınmak için kollarını kaldırır.', support: 'Almadan önce sor: “Kucak mı?” ve kollarını açmasını bekle.' },
        { text: 'Yere düşen eşyanın arkasından bakar, onu arar.', support: 'Ce-e ve “oyuncak nerede?” oyunları oyna.' },
        { text: 'Desteksiz oturur.', support: 'Yerde güvenli oyun zamanı tanı, oturmasını yastıklarla koru.' },
        { text: 'Tanımadığı kişilerden çekinir ya da sana sığınır.', support: 'Bu bağlanmanın işaretidir. Yeni insanlarla tanışmayı aceleye getirme.' },
      ],
    },
    {
      id: 'm18',
      fromMonths: 18,
      title: '18 ay',
      items: [
        { text: 'İlginç bir şeyi sana göstermek için parmağıyla işaret eder.', flag: true, support: 'Sen de göster ve adlandır: “Bak, kuş!” O gösterdiğinde hevesle karşılık ver.' },
        { text: '“Anne, baba” dışında en az 3 kelime söyler.', flag: true, support: 'Günlük işleri konuşarak yap, onun kelimelerini genişlet.' },
        { text: 'Jest olmadan basit bir yönergeyi yerine getirir (“topu ver”).', support: 'Yönergeyi kısa söyle, yaptığında sevinçle teşekkür et.' },
        { text: 'Desteksiz yürür.', flag: true, support: 'Yalınayak, güvenli bir alanda bol bol hareket fırsatı ver.' },
        { text: 'Ev işlerinde seni taklit eder (süpürmek, telefonla konuşmak).', support: 'Küçük bir süpürge, oyuncak mutfak eşyaları ver, birlikte “iş yapın”.' },
        { text: 'Parmaklarıyla kendi yer, kaşık kullanmaya çalışır.', support: 'Kirlenmesine izin ver, parmak yiyecekleri sun.' },
      ],
    },
    {
      id: 'm30',
      fromMonths: 30,
      title: '2,5 yaş',
      items: [
        { text: 'Yaklaşık 50 kelime söyler.', support: 'Birlikte kitap okuyun, resimleri adlandırın, açık uçlu sorular sor.' },
        { text: 'Fiil içeren iki kelimeyi birleştirir (“kedi koşuyor”).', flag: true, support: 'Tek kelimesini iki kelimeye genişlet: “Araba.” — “Büyük araba gidiyor!”' },
        { text: '“Ben”, “benim”, “biz” kelimelerini kullanır.', support: 'Sıralı oyunlarda “benim sıram, senin sıran” de.' },
        { text: 'Rol oyunu oynar (oyuncak bebeği beslemek, bloğu araba gibi sürmek).', flag: true, support: 'Rol oyununa katıl, basit senaryolar öner.' },
        { text: 'İki adımlı bir yönergeyi yerine getirir (“oyuncağı al ve kutuya koy”).', support: 'Yönergeleri oyunla ver; önce tek adım, sonra iki adım çalışın.' },
        { text: 'İki ayağıyla yerden zıplar.', support: 'Açık havada zıplama oyunları, “tavşan” oyunu.' },
      ],
    },
    {
      id: 'm48',
      fromMonths: 48,
      title: '4 yaş',
      items: [
        { text: '4 ya da daha fazla kelimelik cümleler kurar.', flag: true, support: 'Gününüz hakkında konuşun, onun anlattıklarını sorularla genişletin.' },
        { text: 'Gün içinde olan bir şeyi anlatır.', support: 'Akşamları “günün en güzel anı” sohbeti yapın.' },
        { text: 'Oyunda başka birine dönüşür (öğretmen, süper kahraman).', support: 'Kostümler ve rol oyunları için zaman ve malzeme sağla.' },
        { text: 'Başka çocuklarla oynamaktan keyif alır, onları teselli eder.', flag: true, support: 'Arkadaşlarla kısa buluşmalar ayarla, duyguları adlandırmasına yardım et.' },
        { text: 'Birkaç rengin adını söyler.', support: 'Günlük hayatta renkleri adlandırın, oyuna çevirin.' },
        { text: 'Büyük bir topu çoğu zaman yakalar, kalemi parmaklarıyla tutar.', support: 'Top oyunları, resim, oyun hamuru.' },
      ],
    },
    {
      id: 'y6',
      fromMonths: 72,
      title: 'Okul çağı (6–12)',
      items: [
        { text: 'Günlük öz bakımı (giyinmek, diş fırçalamak) çoğunlukla kendisi yapar.', support: 'Yaşına uygun bağımsızlık tanı, resimli rutinlerle destekle.' },
        { text: 'En az bir arkadaşı var ve onunla oynamaktan keyif alır.', flag: true, support: 'Arkadaşlıklara fırsat yarat, sosyal becerileri evde çalışın.' },
        { text: 'Oyunların kurallarına uyar, sırasını bekleyebilir.', support: 'Aileyle kurallı kutu oyunları oynayın.' },
        { text: 'Duygularını sözle anlatabilir.', support: 'Duygular hakkında konuşmayı günlük bir alışkanlık haline getir.' },
        { text: 'Okuma ve sayma becerileri sınıf düzeyine uygun ilerliyor.', flag: true, support: 'Öğretmenle iletişimde ol, birlikte okuyun, çabasını takdir et.' },
        { text: 'Sinirlendikten sonra makul bir sürede sakinleşir.', support: 'Sakinleşme yöntemlerini birlikte seçin ve çalışın.' },
      ],
    },
  ],
  results: {
    ontrack: {
      title: 'Her şey yolunda',
      short: 'Çocuğun bu yaş için beklenen becerilerin çoğunu gösteriyor.',
      detail: [
        '“Henüz değil” cevapları varsa endişelenme: çocuklar bazı becerileri biraz geç, bazılarını ise erken kazanır.',
        'Her kontrolde doktora gelişimle ilgili sorularını sor — bu en iyi takip yoludur.',
      ],
    },
    watch: {
      title: 'Birkaç beceri hâlâ gelişiyor',
      short: 'Birkaç “henüz değil” ya da “emin değilim” cevabı var. Bu becerileri günlük oyunla destekleyebilirsin.',
      detail: [
        'Aşağıdaki önerilerle 4–6 hafta destekle ve yeniden kontrol et.',
        'Endişen sürüyorsa bir sonraki kontrolü beklemeden çocuk doktoruyla konuş. Erken destek her zaman beklemekten daha iyidir.',
      ],
    },
    talk: {
      title: 'Çocuk doktoruyla konuşmanı öneriyoruz',
      short: 'Bazı cevaplar doktorun bakması gereken sinyaller. Bu bir tanı değil, ama beklemeye gerek yok.',
      detail: [
        'Beceri kaybı (gerileme) ya da önemli basamaklarda gecikme erken değerlendirme gerektirir. Erken başlanan destek en iyi sonucu verir.',
        'Doktora giderken bu listeyi gösterebilirsin.',
      ],
    },
  },
  note: 'Bu kontrol bir tarama aracıdır, tanı değildir. Endişen varsa sonuçtan bağımsız olarak doktora başvur.',
  sources: [S.zubler2022, S.cdcActEarly],
};
