import type { MilestoneQuiz, StyleQuiz } from '../types';
import { S } from './sources';

export const STYLE_QUIZ: StyleQuiz = {
  id: 'style',
  emoji: '🪞',
  title: 'Gaya pengasuhanku',
  intro: '12 pernyataan singkat. Pikirkan dua minggu terakhir dan jawab dengan jujur — di sini tidak ada jawaban benar atau salah. Hasilnya hanya tersimpan di ponselmu.',
  scale: ['Hampir tidak pernah', 'Kadang-kadang', 'Sering', 'Hampir selalu'],
  items: [
    { text: 'Saat anakku sedih atau marah, aku menamai perasaannya dan tetap ada di dekatnya.', dim: 'warmth' },
    { text: 'Sepanjang hari aku menyempatkan diri untuk memeluknya, tertawa bersama, dan bilang “aku sayang kamu”.', dim: 'warmth' },
    { text: 'Saat anakku bicara, aku menyingkirkan ponsel dan mendengarkan.', dim: 'warmth' },
    { text: 'Aku memperhatikan perilaku baiknya dan menyebutkannya.', dim: 'warmth' },
    { text: 'Di rumah ada beberapa aturan jelas yang diketahui anakku.', dim: 'structure' },
    { text: 'Setelah membuat aturan, aku menerapkannya dengan tenang.', dim: 'structure' },
    { text: 'Rutinitas harian kami (makan, tidur) kurang lebih tetap.', dim: 'structure' },
    { text: 'Saat anakku menangis atau memaksa, aku membatalkan “tidak” yang sudah kuucapkan.', dim: 'giveIn' },
    { text: 'Saat lelah, aku melepaskan aturan sepenuhnya, “terserah dia mau apa”.', dim: 'giveIn' },
    { text: 'Saat kesal, aku meninggikan suara atau membentak.', dim: 'harsh' },
    { text: 'Aku mengancam anakku (“aku tinggal kamu di sini”, “nanti aku panggilkan polisi”).', dim: 'harsh' },
    { text: 'Saat emosi, muncul keinginan untuk memukulnya atau mengucapkan kata-kata kasar, dan kadang aku melakukannya.', dim: 'harsh' },
  ],
  results: {
    balanced: {
      title: 'Hangat dan jelas',
      short: 'Kamu menunjukkan kasih sayang sekaligus memberi batasan yang jelas — kombinasi yang menurut penelitian paling bermanfaat.',
      detail: [
        'Psikolog menyebut gaya ini “autoritatif”: kehangatan tinggi dan struktur tinggi. Anak yang tumbuh dengan gaya ini rata-rata lebih mandiri, lebih percaya diri, dan lebih mampu mengelola perasaan.',
        'Ini bukan berarti sempurna. Kamu juga bisa lelah, kadang kesabaranmu habis. Yang membuat perbedaan adalah kamu kembali memperbaiki hubungan setelah momen-momen sulit.',
      ],
      next: ['Seiring anak tumbuh, mulailah menyusun aturan bersamanya.', 'Jangan lupa merawat dirimu: untuk jadi orang tua yang tenang, kamu perlu istirahat.', 'Pertahankan kebiasaan “waktu khusus” — ini “asuransi” yang paling ampuh.'],
    },
    gentle: {
      title: 'Sangat hangat, batasannya lunak',
      short: 'Kamu sangat dekat dengan anakmu dan peka terhadap perasaannya. Kadang mempertahankan batasan terasa sulit.',
      detail: [
        'Kehangatan adalah kekuatan terbesarmu, dan ini tak tergantikan untuk kelekatan yang aman. Tapi anak menguji batasan untuk memastikan batasan itu masih ada di tempatnya. Saat batasan melunak, anak makin sering menguji, dan orang tua pun kelelahan.',
        'Kasih sayang dan batasan tidak saling bertentangan. Mengatakan “Aku sayang kamu, dan jawabannya tetap tidak” memberi anak rasa aman.',
      ],
      next: ['Pilih 3–5 aturan keluarga yang jelas dan terapkan dengan tenang.', 'Saat tantrum, tunjukkan empati, tapi jangan ubah keputusanmu.', 'Coba langkah “satu kalimat, satu kali” dari program “21 hari tanpa membentak”.'],
    },
    storm: {
      title: 'Penuh kasih, tapi meledak saat lelah',
      short: 'Kamu sangat lekat dengan anakmu, tapi di saat stres suaramu meninggi. Ini situasi yang dikenal banyak orang tua.',
      detail: [
        'Kehangatanmu adalah fondasi yang kuat. Bentakan dan kata-kata kasar sering kali adalah akibat kelelahan, ketergesaan, dan merasa sendirian, bukan karena kurang sayang.',
        'Penelitian menunjukkan bahwa meski hubungannya hangat, membentak secara rutin berdampak negatif pada perilaku anak. Kabar baiknya: regulasi diri adalah keterampilan yang bisa dipelajari, dan obrolan perbaikan melindungi hubungan.',
      ],
      next: ['Temukan pemicumu: jam berapa, situasi seperti apa?', 'Mulailah dengan “tombol jeda” dan embusan napas panjang.', 'Program “21 hari tanpa membentak” memang dibuat untukmu.'],
    },
    strict: {
      title: 'Batasan kuat, kehangatan tersembunyi',
      short: 'Kamu mementingkan keteraturan dan aturan. Kadang ini terjadi dengan mengorbankan kehangatan dan mendengarkan.',
      detail: [
        'Aturan dan konsistensi penting bagi anak — ini kekuatanmu. Tapi menurut penelitian, batasan yang dipasang lewat kontrol keras dan hukuman tidak mengurangi masalah perilaku jangka panjang, malah bisa menambahnya.',
        'Kehangatan bisa ditambah sambil tetap mempertahankan aturan: menjelaskan, menamai perasaan, memperhatikan perilaku baik.',
      ],
      next: ['Setiap hari 10 menit waktu bermain yang dipimpin anak.', 'Pakai konsekuensi logis sebagai ganti hukuman.', 'Jelaskan satu aturan: “Aturan ini ada karena…”'],
    },
    stretched: {
      title: 'Lelah dan kehabisan tenaga',
      short: 'Sepertinya akhir-akhir ini kamu sangat lelah. Ini bukan tanda orang tua yang buruk, tapi sinyal bahwa kamu butuh dukungan.',
      detail: [
        'Saat orang tua kehabisan tenaga, tidak ada lagi energi untuk kehangatan maupun struktur. Ini situasi yang sangat umum dan bisa dimengerti, terutama saat ada bayi, kurang tidur, pekerjaan, dan merasa sendirian.',
        'Hasil ini bukan tuduhan untukmu, tapi tanda bahwa kamu sendiri juga butuh dirawat. Langkah-langkah kecil dan meminta bantuan bisa mengubah segalanya.',
      ],
      next: ['Bagi bebanmu: sepakati bantuan yang konkret dengan pasangan, keluarga, teman.', 'Sehari sekali momen kedekatan 5 menit: hanya pelukan dan kontak mata.', 'Kalau kamu merasa sedih atau putus asa lebih dari dua minggu, bicaralah dengan dokter atau psikolog.'],
    },
  },
  note: 'Tes ini bukan diagnosis, hanya alat sederhana untuk mengamati diri sendiri. Didasarkan pada dimensi kehangatan dan struktur dari Baumrind.',
  sources: [S.baumrind1966, S.baumrind1967, S.pinquart2017, S.wangKenny2014],
};

export const MILESTONE_QUIZ: MilestoneQuiz = {
  id: 'milestones',
  emoji: '🧩',
  title: 'Apa yang seharusnya bisa dilakukan anakku di usia ini?',
  intro: 'Pemeriksaan singkat berdasarkan tahap perkembangan dari CDC dan American Academy of Pediatrics. Sebagian besar anak (sekitar 3 dari 4) menunjukkan kemampuan ini di usia ini. Setiap anak berkembang dengan temponya sendiri.',
  answers: { yes: 'Ya', no: 'Belum', unsure: 'Tidak yakin' },
  regression: 'Apakah ia kehilangan kemampuan yang sebelumnya sudah bisa (kata, permainan, gerakan)?',
  checkpoints: [
    {
      id: 'm4',
      fromMonths: 4,
      title: '4 bulan',
      items: [
        { text: 'Tersenyum sendiri saat melihatmu, berusaha menarik perhatianmu.', flag: true, support: 'Habiskan banyak waktu tatap muka: tersenyum, tunggu, balas senyumnya.' },
        { text: 'Mengeluarkan suara seperti “a-a”, “u-u”, dan membalas dengan suara saat kamu bicara.', support: 'Tirukan suaranya, lalu beri jeda supaya ia bisa “menjawab”.' },
        { text: 'Menoleh ke arah suaramu saat mendengarnya.', flag: true, support: 'Panggil namanya dengan lembut dari berbagai arah.' },
        { text: 'Saat digendong, bisa menahan kepalanya tetap tegak tanpa disangga.', support: 'Saat terjaga, beberapa kali sehari beri “waktu tengkurap” singkat.' },
        { text: 'Menggenggam dan memegang mainan yang diberikan ke tangannya.', support: 'Beri mainan kerincingan yang ringan dan mudah digenggam.' },
        { text: 'Saat tengkurap, bertumpu pada siku dan mengangkat kepala.', support: 'Taruh cermin atau mainan berwarna di depannya.' },
      ],
    },
    {
      id: 'm9',
      fromMonths: 9,
      title: '9 bulan',
      items: [
        { text: 'Menoleh saat namanya dipanggil.', flag: true, support: 'Sering sebut namanya saat bermain, dan saat ia menoleh, tersenyum dan puji dia.' },
        { text: 'Mengucapkan berbagai suku kata seperti “ma-ma-ma”, “ba-ba-ba”.', flag: true, support: 'Ulangi suku katanya bersama, nyanyikan lagu.' },
        { text: 'Mengangkat tangannya minta digendong.', support: 'Sebelum menggendong, tanyakan: “Gendong?” dan tunggu ia membuka tangannya.' },
        { text: 'Melihat ke arah benda yang jatuh dan mencarinya.', support: 'Main cilukba dan “mainannya mana?”.' },
        { text: 'Duduk tanpa disangga.', support: 'Beri waktu bermain yang aman di lantai, lindungi posisi duduknya dengan bantal.' },
        { text: 'Menghindari orang yang tidak dikenalnya atau berlindung padamu.', support: 'Ini tanda kelekatan. Jangan terburu-buru mengenalkannya pada orang baru.' },
      ],
    },
    {
      id: 'm18',
      fromMonths: 18,
      title: '18 bulan',
      items: [
        { text: 'Menunjuk dengan jari untuk memperlihatkan sesuatu yang menarik kepadamu.', flag: true, support: 'Kamu juga tunjuk dan sebutkan namanya: “Lihat, burung!” Saat ia menunjuk, tanggapi dengan antusias.' },
        { text: 'Mengucapkan setidaknya 3 kata selain “mama, papa”.', flag: true, support: 'Lakukan kegiatan sehari-hari sambil bercerita, kembangkan kata-katanya.' },
        { text: 'Menjalankan perintah sederhana tanpa isyarat (“kasih bolanya”).', support: 'Beri perintah singkat, dan saat ia melakukannya, ucapkan terima kasih dengan gembira.' },
        { text: 'Berjalan tanpa dipegangi.', flag: true, support: 'Beri banyak kesempatan bergerak tanpa alas kaki di tempat yang aman.' },
        { text: 'Meniru kamu dalam pekerjaan rumah (menyapu, bicara di telepon).', support: 'Beri sapu kecil, mainan alat dapur, dan “bekerja” bersama.' },
        { text: 'Makan sendiri dengan jari, mencoba memakai sendok.', support: 'Biarkan ia berantakan, tawarkan finger food.' },
      ],
    },
    {
      id: 'm30',
      fromMonths: 30,
      title: '2,5 tahun',
      items: [
        { text: 'Mengucapkan sekitar 50 kata.', support: 'Bacakan buku bersama, sebutkan nama gambar-gambarnya, ajukan pertanyaan terbuka.' },
        { text: 'Menggabungkan dua kata yang mengandung kata kerja (“kucing lari”).', flag: true, support: 'Kembangkan satu katanya jadi dua kata: “Mobil.” — “Mobil besar jalan!”' },
        { text: 'Memakai kata “aku”, “punyaku”, “kita”.', support: 'Dalam permainan bergiliran, bilang “giliranku, giliranmu”.' },
        { text: 'Bermain pura-pura (menyuapi boneka, menjalankan balok seperti mobil).', flag: true, support: 'Ikut bermain pura-pura, tawarkan skenario sederhana.' },
        { text: 'Menjalankan perintah dua langkah (“ambil mainannya dan masukkan ke kotak”).', support: 'Beri perintah lewat permainan, latih satu langkah dulu, lalu dua langkah.' },
        { text: 'Melompat dari lantai dengan kedua kaki.', support: 'Permainan lompat di luar ruangan, main “kelinci”.' },
      ],
    },
    {
      id: 'm48',
      fromMonths: 48,
      title: '4 tahun',
      items: [
        { text: 'Menyusun kalimat dengan 4 kata atau lebih.', flag: true, support: 'Ngobrol tentang hari ini, kembangkan ceritanya lewat pertanyaan.' },
        { text: 'Menceritakan sesuatu yang terjadi hari itu.', support: 'Malam hari, ngobrol tentang “momen terbaik hari ini”.' },
        { text: 'Saat bermain, berperan menjadi orang lain (guru, superhero).', support: 'Sediakan waktu dan bahan untuk kostum dan permainan peran.' },
        { text: 'Senang bermain dengan anak lain dan menghibur mereka.', flag: true, support: 'Atur pertemuan singkat dengan teman, bantu menamai perasaan.' },
        { text: 'Menyebutkan nama beberapa warna.', support: 'Sebutkan warna-warna dalam kehidupan sehari-hari, jadikan permainan.' },
        { text: 'Sering bisa menangkap bola besar, memegang pensil dengan jari.', support: 'Permainan bola, menggambar, plastisin.' },
      ],
    },
    {
      id: 'y6',
      fromMonths: 72,
      title: 'Usia sekolah (6–12)',
      items: [
        { text: 'Sebagian besar perawatan diri sehari-hari (berpakaian, sikat gigi) ia lakukan sendiri.', support: 'Beri kemandirian sesuai usianya, dukung dengan rutinitas bergambar.' },
        { text: 'Punya setidaknya satu teman dan senang bermain dengannya.', flag: true, support: 'Ciptakan kesempatan berteman, latih keterampilan sosial di rumah.' },
        { text: 'Mematuhi aturan permainan, bisa menunggu giliran.', support: 'Mainkan board game dengan aturan bersama keluarga.' },
        { text: 'Bisa menjelaskan perasaannya dengan kata-kata.', support: 'Jadikan membicarakan perasaan sebagai kebiasaan sehari-hari.' },
        { text: 'Kemampuan membaca dan berhitung berkembang sesuai kelasnya.', flag: true, support: 'Jaga komunikasi dengan guru, membaca bersama, hargai usahanya.' },
        { text: 'Setelah kesal, ia tenang kembali dalam waktu yang wajar.', support: 'Pilih dan latih cara-cara menenangkan diri bersama.' },
      ],
    },
  ],
  results: {
    ontrack: {
      title: 'Semuanya sesuai jalurnya',
      short: 'Anakmu menunjukkan sebagian besar kemampuan yang diharapkan untuk usia ini.',
      detail: [
        'Kalau ada jawaban “belum”, jangan khawatir: anak menguasai sebagian kemampuan sedikit lebih lambat, dan sebagian lainnya lebih cepat.',
        'Di setiap pemeriksaan, sampaikan pertanyaanmu tentang perkembangan anak ke dokter — inilah cara memantau yang terbaik.',
      ],
    },
    watch: {
      title: 'Beberapa kemampuan masih terbentuk',
      short: 'Ada beberapa jawaban “belum” atau “tidak yakin”. Kamu bisa mendukung kemampuan ini lewat permainan sehari-hari.',
      detail: [
        'Dukung selama 4–6 minggu dengan saran-saran di bawah, lalu periksa lagi.',
        'Kalau kekhawatiranmu tetap ada, bicaralah dengan dokter anak tanpa menunggu pemeriksaan berikutnya. Dukungan sejak dini selalu lebih baik daripada menunggu.',
      ],
    },
    talk: {
      title: 'Kami sarankan bicara dengan dokter anak',
      short: 'Beberapa jawaban adalah sinyal yang perlu dilihat dokter. Ini bukan diagnosis, tapi tidak perlu menunggu.',
      detail: [
        'Hilangnya kemampuan (kemunduran) atau keterlambatan tahap perkembangan yang penting perlu dievaluasi sejak dini. Dukungan yang dimulai sejak awal memberi hasil terbaik.',
        'Saat ke dokter, kamu bisa menunjukkan daftar ini.',
      ],
    },
  },
  note: 'Pemeriksaan ini adalah alat skrining, bukan diagnosis. Kalau kamu khawatir, hubungi dokter apa pun hasilnya.',
  sources: [S.zubler2022, S.cdcActEarly],
};
