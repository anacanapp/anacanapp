// Hero note under the baby size tags (2026-11-12): why the length jumps around week 20 (crown-rump -> crown-heel).
// All 23 app languages inline (like appUpdate-i18n.ts); unknown languages fall back to English.
const NOTE: Record<string, string> = {
  az: 'Boy 20 həftəyə qədər başdan oturağa, sonra başdan dabana qədər ölçülür.',
  en: 'Length is measured head to bottom until week 20, then head to heel.',
  ru: 'До 20-й недели рост измеряют от макушки до копчика, затем от макушки до пяток.',
  tr: 'Boy 20. haftaya kadar baştan kuyruk sokumuna, sonra baştan topuğa kadar ölçülür.',
  kk: 'Бойы 20-аптаға дейін төбеден құйымшаққа дейін, кейін төбеден өкшеге дейін өлшенеді.',
  de: 'Bis zur 20. Woche wird die Länge vom Scheitel bis zum Steiß gemessen, danach vom Scheitel bis zur Ferse.',
  ar: 'يُقاس الطول حتى الأسبوع 20 من الرأس إلى المقعدة، ثم من الرأس إلى الكعب.',
  uz: 'Boʻy 20-haftagacha boshdan dumgʻazagacha, keyin boshdan tovongacha oʻlchanadi.',
  ka: 'სიგრძე მე-20 კვირამდე იზომება თხემიდან კუდუსუნამდე, შემდეგ თხემიდან ქუსლამდე.',
  zh: '20周前测量的是头臀长，之后测量的是头到脚跟的长度。',
  id: 'Panjang diukur dari kepala ke bokong hingga minggu ke-20, lalu dari kepala ke tumit.',
  fr: 'Jusqu’à 20 semaines, la taille est mesurée de la tête aux fesses, puis de la tête aux talons.',
  es: 'Hasta la semana 20 la longitud se mide de la cabeza a las nalgas, después de la cabeza a los talones.',
  pt: 'Até a semana 20 o comprimento é medido da cabeça ao bumbum, depois da cabeça ao calcanhar.',
  vi: 'Đến tuần 20, chiều dài được đo từ đầu đến mông, sau đó từ đầu đến gót chân.',
  hi: '20वें सप्ताह तक लंबाई सिर से नितंब तक, उसके बाद सिर से एड़ी तक मापी जाती है।',
  ja: '20週までは頭からおしりまで、その後は頭からかかとまでの長さです。',
  ko: '20주까지는 머리부터 엉덩이까지, 이후에는 머리부터 발뒤꿈치까지 잰 길이예요.',
  pl: 'Do 20. tygodnia długość mierzy się od czubka głowy do pośladków, potem od głowy do pięt.',
  nl: 'Tot week 20 wordt de lengte gemeten van kruin tot stuit, daarna van kruin tot hiel.',
  sv: 'Fram till vecka 20 mäts längden från hjässa till säte, därefter från hjässa till häl.',
  ky: 'Бою 20-жумага чейин баштан куймулчакка чейин, андан кийин баштан согончокко чейин өлчөнөт.',
  et: 'Pikkust mõõdetakse 20. nädalani pealaest istmikuni, seejärel pealaest kandadeni.',
};
export const fetalLengthNote = (language: string | null | undefined): string => NOTE[String(language || '')] ?? NOTE.en;
export const FETAL_LENGTH_NOTE_LANGUAGES = Object.keys(NOTE);

/** Very small weights (first weeks) read better as "<0.1" than "0.01". */
export const formatFetalWeight = (grams: number): string => (grams > 0 && grams < 0.1 ? '<0.1' : String(grams));
