import type { MilestoneQuiz, StyleQuiz } from '../types';
import { S } from './sources';

export const STYLE_QUIZ: StyleQuiz = {
  id: 'style',
  emoji: '🪞',
  title: 'Mój styl wychowania',
  intro: '12 krótkich stwierdzeń. Pomyśl o ostatnich dwóch tygodniach i odpowiedz szczerze — nie ma tu dobrych ani złych odpowiedzi. Wynik zapisuje się na twoim koncie i widzisz go tylko ty.',
  scale: ['Prawie nigdy', 'Czasami', 'Często', 'Prawie zawsze'],
  items: [
    { text: 'Gdy moje dziecko jest smutne albo złe, nazywam jego uczucie i jestem przy nim.', dim: 'warmth' },
    { text: 'W ciągu dnia znajduję czas, żeby je przytulić, pośmiać się z nim, powiedzieć „kocham cię”.', dim: 'warmth' },
    { text: 'Gdy moje dziecko mówi, odkładam telefon i słucham.', dim: 'warmth' },
    { text: 'Dostrzegam jego dobre zachowania i je nazywam.', dim: 'warmth' },
    { text: 'W domu jest kilka jasnych zasad, które moje dziecko zna.', dim: 'structure' },
    { text: 'Gdy ustalę zasadę, spokojnie jej przestrzegam.', dim: 'structure' },
    { text: 'Nasz rytm dnia (jedzenie, sen) jest mniej więcej stały.', dim: 'structure' },
    { text: 'Gdy moje dziecko płacze albo nalega, wycofuję się z powiedzianego „nie”.', dim: 'giveIn' },
    { text: 'Gdy jestem zmęczona/zmęczony, całkiem odpuszczam zasady: „niech robi, co chce”.', dim: 'giveIn' },
    { text: 'Gdy się denerwuję, podnoszę głos albo krzyczę.', dim: 'harsh' },
    { text: 'Grożę dziecku („zostawię cię tutaj”, „oddam cię policji”).', dim: 'harsh' },
    { text: 'W chwili złości mam ochotę je uderzyć albo powiedzieć coś ostrego i czasem to robię.', dim: 'harsh' },
  ],
  results: {
    balanced: {
      title: 'Ciepło i jasno',
      short: 'Okazujesz miłość i jednocześnie stawiasz jasne granice — to połączenie, które badania uznają za najkorzystniejsze.',
      detail: [
        'Psycholodzy nazywają ten styl „autorytatywnym”: dużo ciepła i dużo struktury. Dzieci wychowywane w tym stylu są średnio bardziej samodzielne, pewne siebie i lepiej radzą sobie z uczuciami.',
        'Nie oznacza to perfekcji. Ty też się męczysz, czasem kończy ci się cierpliwość. Różnicę robi to, że po trudnych chwilach wracasz do relacji.',
      ],
      next: ['Gdy dziecko rośnie, zacznij ustalać zasady razem z nim.', 'Nie zapominaj o dbaniu o siebie: żeby być spokojnym rodzicem, trzeba odpoczywać.', 'Pielęgnuj nawyk „specjalnego czasu” — to najsilniejsze „ubezpieczenie”.'],
    },
    gentle: {
      title: 'Dużo ciepła, miękkie granice',
      short: 'Jesteś bardzo blisko z dzieckiem i wrażliwie reagujesz na jego uczucia. Czasem trudno ci utrzymać granice.',
      detail: [
        'Ciepło to twoja największa siła i jest bezcenne dla bezpiecznego przywiązania. Jednak dzieci testują granice, żeby sprawdzić, czy wciąż są na swoim miejscu. Gdy granice miękną, dziecko testuje częściej, a rodzic się wyczerpuje.',
        'Miłość i granice się nie wykluczają. Powiedzenie „Kocham cię, a odpowiedź nadal brzmi nie” daje dziecku poczucie bezpieczeństwa.',
      ],
      next: ['Wybierz 3–5 jasnych zasad rodzinnych i spokojnie je stosuj.', 'Podczas napadu złości okaż empatię, ale nie zmieniaj decyzji.', 'Wypróbuj krok „jedno zdanie, jeden raz” z programu „21 dni bez krzyku”.'],
    },
    storm: {
      title: 'Pełna miłości, ale wybuchająca w chwilach zmęczenia',
      short: 'Jesteś bardzo związana/związany z dzieckiem, ale w stresujących chwilach podnosisz głos. To sytuacja, którą zna wielu rodziców.',
      detail: [
        'Twoje ciepło to mocny fundament. Krzyk i ostre słowa to najczęściej skutek zmęczenia, pośpiechu i samotności, a nie braku miłości.',
        'Badania pokazują, że nawet przy ciepłej relacji regularny krzyk negatywnie wpływa na zachowanie dziecka. Dobra wiadomość: samoregulacji można się nauczyć, a rozmowy naprawcze chronią relację.',
      ],
      next: ['Znajdź swoje wyzwalacze: jakie godziny, jakie sytuacje?', 'Zacznij od „przycisku pauzy” i długiego wydechu.', 'Program „21 dni bez krzyku” jest właśnie dla ciebie.'],
    },
    strict: {
      title: 'Mocne granice, ukryte ciepło',
      short: 'Przywiązujesz wagę do porządku i zasad. Czasem dzieje się to kosztem ciepła i słuchania.',
      detail: [
        'Zasady i konsekwencja są dla dziecka ważne — to twoja mocna strona. Jednak według badań granice stawiane surową kontrolą i karami nie zmniejszają długofalowo problemów z zachowaniem, a mogą je nawet nasilać.',
        'Można dodać ciepła, zachowując zasady: wyjaśniać, nazywać uczucia, dostrzegać dobre zachowanie.',
      ],
      next: ['Codziennie 10 minut zabawy prowadzonej przez dziecko.', 'Zamiast kar stosuj logiczne konsekwencje.', 'Wyjaśnij jedną zasadę: „Ta zasada jest, bo…”'],
    },
    stretched: {
      title: 'Zmęczona/zmęczony i wyczerpana/wyczerpany',
      short: 'Wygląda na to, że ostatnio jesteś bardzo zmęczona/zmęczony. To nie znaczy, że jesteś złym rodzicem — to sygnał, że potrzebujesz wsparcia.',
      detail: [
        'Gdy rodzic jest wyczerpany, brakuje sił i na ciepło, i na strukturę. To bardzo częsta i zrozumiała sytuacja, zwłaszcza przy niemowlęciu, niewyspaniu, pracy i samotności.',
        'Ten wynik nie jest oskarżeniem, tylko pokazuje, że ty też potrzebujesz troski. Małe kroki i prośba o pomoc mogą wszystko zmienić.',
      ],
      next: ['Podziel się obciążeniem: ustal konkretną pomoc z partnerem, rodziną, przyjaciółmi.', 'Raz dziennie 5-minutowa chwila bliskości: tylko przytulenie i kontakt wzrokowy.', 'Jeśli dłużej niż dwa tygodnie czujesz smutek lub beznadzieję, porozmawiaj z lekarzem lub psychologiem.'],
    },
  },
  note: 'Ten test nie jest diagnozą, tylko prostym narzędziem do obserwacji siebie. Opiera się na wymiarach ciepła i struktury według Baumrind.',
  sources: [S.baumrind1966, S.baumrind1967, S.pinquart2017, S.wangKenny2014],
};

export const MILESTONE_QUIZ: MilestoneQuiz = {
  id: 'milestones',
  emoji: '🧩',
  title: 'Co moje dziecko powinno umieć w tym wieku?',
  intro: 'Krótki test oparty na kamieniach milowych rozwoju według CDC i Amerykańskiej Akademii Pediatrii. Większość dzieci (około 3 na 4) wykazuje te umiejętności w tym wieku. Każde dziecko rozwija się we własnym tempie.',
  answers: { yes: 'Tak', no: 'Jeszcze nie', unsure: 'Nie jestem pewna/pewien' },
  regression: 'Czy straciło umiejętność, którą wcześniej miało (słowo, zabawę, ruch)?',
  checkpoints: [
    {
      id: 'm4',
      fromMonths: 4,
      title: '4 miesiące',
      items: [
        { text: 'Samo uśmiecha się na twój widok, próbuje przyciągnąć twoją uwagę.', flag: true, support: 'Spędzaj dużo czasu twarzą w twarz: uśmiechaj się, czekaj, odpowiadaj na jego uśmiech.' },
        { text: 'Wydaje dźwięki typu „a-a”, „u-u”, odpowiada dźwiękami, gdy mówisz.', support: 'Naśladuj jego dźwięki, a potem zrób pauzę, żeby mogło „odpowiedzieć”.' },
        { text: 'Odwraca głowę w stronę twojego głosu, gdy go słyszy.', flag: true, support: 'Wołaj je łagodnie po imieniu z różnych stron.' },
        { text: 'Na rękach stabilnie trzyma główkę bez podparcia.', support: 'Gdy nie śpi, kilka razy dziennie krótki „czas na brzuszku”.' },
        { text: 'Chwyta i trzyma zabawkę podaną do rączki.', support: 'Dawaj lekkie, łatwe do chwycenia grzechotki.' },
        { text: 'Leżąc na brzuchu, podpiera się na łokciach i unosi głowę.', support: 'Postaw przed nim lusterko albo kolorową zabawkę.' },
      ],
    },
    {
      id: 'm9',
      fromMonths: 9,
      title: '9 miesięcy',
      items: [
        { text: 'Patrzy, gdy woła się je po imieniu.', flag: true, support: 'Często używaj jego imienia w zabawach, a gdy spojrzy, uśmiechnij się i pochwal.' },
        { text: 'Mówi różne sylaby, np. „ma-ma-ma”, „ba-ba-ba”.', flag: true, support: 'Powtarzajcie razem sylaby, śpiewaj piosenki.' },
        { text: 'Unosi rączki, żeby wziąć je na ręce.', support: 'Zanim podniesiesz, zapytaj: „Na rączki?” i poczekaj, aż wyciągnie ręce.' },
        { text: 'Patrzy za spadającym przedmiotem, szuka go.', support: 'Bawcie się w „a kuku” i „gdzie jest zabawka?”.' },
        { text: 'Siedzi bez podparcia.', support: 'Daj bezpieczny czas na zabawę na podłodze, zabezpiecz siedzenie poduszkami.' },
        { text: 'Unika nieznajomych albo tuli się do ciebie.', support: 'To oznaka przywiązania. Nie przyspieszaj poznawania nowych osób.' },
      ],
    },
    {
      id: 'm18',
      fromMonths: 18,
      title: '18 miesięcy',
      items: [
        { text: 'Wskazuje palcem, żeby pokazać ci coś ciekawego.', flag: true, support: 'Sama/sam też wskazuj i nazywaj: „Zobacz, ptak!” Gdy pokazuje, reaguj z entuzjazmem.' },
        { text: 'Mówi co najmniej 3 słowa poza „mama, tata”.', flag: true, support: 'Opowiadaj podczas codziennych czynności, rozwijaj jego słowa.' },
        { text: 'Wykonuje proste polecenie bez gestu („daj piłkę”).', support: 'Mów polecenie krótko, a gdy je wykona, radośnie podziękuj.' },
        { text: 'Chodzi bez trzymania.', flag: true, support: 'Daj dużo okazji do ruchu na boso w bezpiecznym miejscu.' },
        { text: 'Naśladuje cię w pracach domowych (zamiatanie, rozmowa przez telefon).', support: 'Daj małą miotłę, zabawkowe naczynia i „pracujcie” razem.' },
        { text: 'Je samo palcami, próbuje używać łyżki.', support: 'Pozwól mu się brudzić, proponuj jedzenie do rączki.' },
      ],
    },
    {
      id: 'm30',
      fromMonths: 30,
      title: '2,5 roku',
      items: [
        { text: 'Mówi około 50 słów.', support: 'Czytajcie razem książki, nazywajcie obrazki, zadawaj pytania otwarte.' },
        { text: 'Łączy dwa słowa z czasownikiem („kotek biegnie”).', flag: true, support: 'Rozwijaj jedno jego słowo do dwóch: „Auto.” — „Duże auto jedzie!”' },
        { text: 'Używa słów „ja”, „moje”, „my”.', support: 'W zabawach na zmianę mów „moja kolej, twoja kolej”.' },
        { text: 'Bawi się w udawanie (karmi lalkę, jeździ klockiem jak autem).', flag: true, support: 'Dołącz do zabawy w udawanie, proponuj proste scenariusze.' },
        { text: 'Wykonuje polecenie dwuetapowe („weź zabawkę i włóż do pudełka”).', support: 'Dawaj polecenia w formie zabawy i ćwiczcie najpierw jeden krok, potem dwa.' },
        { text: 'Podskakuje obunóż.', support: 'Zabawy w skakanie na dworze, zabawa w „zajączka”.' },
      ],
    },
    {
      id: 'm48',
      fromMonths: 48,
      title: '4 lata',
      items: [
        { text: 'Buduje zdania z 4 lub więcej słów.', flag: true, support: 'Rozmawiajcie o dniu, rozwijajcie jego opowieść pytaniami.' },
        { text: 'Opowiada o czymś, co wydarzyło się w ciągu dnia.', support: 'Wieczorem rozmawiajcie o „najlepszym momencie dnia”.' },
        { text: 'W zabawie wciela się w kogoś innego (nauczyciela, superbohatera).', support: 'Daj czas i materiały na przebrania i zabawy w role.' },
        { text: 'Lubi bawić się z innymi dziećmi, pociesza je.', flag: true, support: 'Organizuj krótkie spotkania z kolegami, pomagaj nazywać uczucia.' },
        { text: 'Nazywa kilka kolorów.', support: 'Nazywajcie kolory w codziennym życiu, zamieńcie to w zabawę.' },
        { text: 'Często łapie dużą piłkę, trzyma kredkę palcami.', support: 'Gry w piłkę, rysowanie, plastelina.' },
      ],
    },
    {
      id: 'y6',
      fromMonths: 72,
      title: 'Wiek szkolny (6–12)',
      items: [
        { text: 'Codzienne czynności samoobsługowe (ubieranie się, mycie zębów) wykonuje głównie samo.', support: 'Daj samodzielność dopasowaną do wieku, wspieraj obrazkowymi rutynami.' },
        { text: 'Ma co najmniej jednego przyjaciela i lubi się z nim bawić.', flag: true, support: 'Stwarzaj okazje do przyjaźni, ćwiczcie w domu umiejętności społeczne.' },
        { text: 'Przestrzega zasad gier, potrafi poczekać na swoją kolej.', support: 'Grajcie rodzinnie w gry planszowe z zasadami.' },
        { text: 'Potrafi opisać swoje uczucia słowami.', support: 'Zrób z rozmów o uczuciach codzienny nawyk.' },
        { text: 'Umiejętności czytania i liczenia rozwijają się adekwatnie do klasy.', flag: true, support: 'Bądź w kontakcie z nauczycielem, czytajcie razem, doceniaj wysiłek.' },
        { text: 'Po zdenerwowaniu uspokaja się w rozsądnym czasie.', support: 'Wybierzcie razem i ćwiczcie sposoby na uspokojenie się.' },
      ],
    },
  ],
  results: {
    ontrack: {
      title: 'Wszystko idzie dobrze',
      short: 'Twoje dziecko wykazuje większość umiejętności oczekiwanych w tym wieku.',
      detail: [
        'Jeśli są odpowiedzi „jeszcze nie”, nie martw się: dzieci zdobywają niektóre umiejętności trochę później, a inne wcześniej.',
        'Przy każdej wizycie pytaj lekarza o rozwój dziecka — to najlepszy sposób monitorowania.',
      ],
    },
    watch: {
      title: 'Kilka umiejętności jeszcze się kształtuje',
      short: 'Jest kilka odpowiedzi „jeszcze nie” albo „nie jestem pewna/pewien”. Możesz wspierać te umiejętności w codziennej zabawie.',
      detail: [
        'Wspieraj je przez 4–6 tygodni według wskazówek poniżej i sprawdź ponownie.',
        'Jeśli niepokój nie mija, porozmawiaj z pediatrą, nie czekając na kolejną wizytę. Wczesne wsparcie jest zawsze lepsze niż czekanie.',
      ],
    },
    talk: {
      title: 'Zalecamy rozmowę z pediatrą',
      short: 'Niektóre odpowiedzi to sygnały, którym powinien przyjrzeć się lekarz. To nie diagnoza, ale nie trzeba czekać.',
      detail: [
        'Utrata umiejętności (regres) albo opóźnienie ważnych kamieni milowych wymaga wczesnej oceny. Wsparcie rozpoczęte wcześnie daje najlepsze efekty.',
        'Idąc do lekarza, możesz pokazać tę listę.',
      ],
    },
  },
  note: 'Ten test jest narzędziem przesiewowym, a nie diagnozą. Jeśli coś cię niepokoi, zgłoś się do lekarza niezależnie od wyniku.',
  sources: [S.zubler2022, S.cdcActEarly],
};
