import type { BandOverview } from '../types';
import { S } from './sources';

export const BANDS: BandOverview[] = [
  {
    id: '0-1',
    emoji: '👶',
    title: 'Pierwszy rok: fundament zaufania',
    lead: 'W tym roku niemowlę uczy się, czy świat jest bezpiecznym miejscem. Odpowiedź czerpie z twojego głosu, twoich ramion i z tego, jak na nie reagujesz.',
    brain: [
      'W pierwszych latach życia w mózgu powstaje ponad milion nowych połączeń nerwowych na sekundę. O tym, które ścieżki się wzmocnią, decydują powtarzane codzienne doświadczenia: dziecko wydaje dźwięk, ty odpowiadasz; płacze, ty podchodzisz.',
      'Część mózgu niemowlęcia odpowiedzialna za uspokajanie się jest jeszcze bardzo niedojrzała. Dlatego maluch nie potrafi jeszcze sam się uspokoić — „pożycza” spokój od twojego spokojnego ciała. Nazywa się to koregulacją i jest to pierwsza lekcja przyszłej samoregulacji.',
      'Około 6.–9. miesiąca pamięć i przywiązanie się wzmacniają: dziecko może zacząć bać się obcych i niepokoić się, gdy wychodzisz z pokoju. To nie regres, wręcz przeciwnie — znak, że jest z tobą związane.',
    ],
    needs: [
      'Reakcji na płacz. W tym wieku nie da się niemowlęcia „przyzwyczaić do noszenia” ani rozpieścić. Szybka, czuła reakcja uczy je ufać światu.',
      'Kontaktu twarzą w twarz: uśmiechów, piosenek, powtarzania jego dźwięków. Takie zabawy w „podaj i oddaj” budują podstawy mózgu odpowiedzialnego za mowę i emocje.',
      'Przewidywalnego dnia: jedzenie, sen, kąpiel w mniej więcej tej samej kolejności. Liczy się nie dokładna godzina, tylko znajomy rytm.',
      'Bezpiecznego snu i bezpiecznego otoczenia, a do tego wypoczętego rodzica, który ma wsparcie.',
    ],
    normal: [
      'Długie, pozornie bezprzyczynowe napady płaczu o określonych porach, zwłaszcza pod wieczór (w pierwszych 3–4 miesiącach).',
      'Częste budzenie się w nocy. Przesypianie całej nocy w pierwszym roku nie jest normą dla każdego dziecka.',
      'Wkładanie wszystkiego do buzi: to jego sposób poznawania świata.',
      'Lęk przed obcymi i płacz, gdy cię nie ma (mniej więcej od 8. miesiąca).',
    ],
    tryThis: [
      'Kilka razy dziennie 5 minut „czasu twarzą w twarz”: telefon odłożony, powtarzaj dźwięki dziecka, nazywaj słowami, co robi.',
      'Opowiadaj podczas codziennych czynności: „Teraz zmieniamy pieluszkę. Podnosimy nóżkę. Gotowe!”',
      'Baw się w „a kuku”: dzięki tej zabawie dziecko uczy się, że „kto odchodzi, ten wraca”, a lęk separacyjny łagodnieje.',
      'Gdy płacz się przeciąga, a cierpliwość się kończy, połóż dziecko w bezpiecznym miejscu — w łóżeczku — weź kilka minut na oddech i wróć.',
    ],
    specialist: [
      'Jeśli dziecko nie reaguje na dźwięki, nie nawiązuje z tobą kontaktu wzrokowego, nie uśmiecha się w 4. miesiącu albo nie reaguje na swoje imię w 9. miesiącu.',
      'Jeśli traci umiejętności, które już miało (uśmiechanie się, gaworzenie, siedzenie).',
      'Jeśli płacze inaczej niż zwykle, a towarzyszy temu gorączka, wymioty, apatia lub odmowa jedzenia: zgłoś się do lekarza. W poważnej sytuacji dzwoń pod {emergency}.',
      'Jeśli sama/sam od tygodni czujesz smutek, beznadzieję albo lęk, że zrobisz dziecku krzywdę: to może być depresja poporodowa i da się ją leczyć. Powiedz o tym lekarzowi.',
    ],
    sources: [S.harvardServe, S.nurturingCare2018, S.ainsworth1978, S.healthyChildrenCrying, S.zubler2022],
  },
  {
    id: '1-3',
    emoji: '🧸',
    title: '1–3 lata: etap „Ja sam!”',
    lead: 'Dziecko już chodzi, zaczyna mówić i chce być samodzielne, ale mózg, który zarządza emocjami, jest jeszcze bardzo niedojrzały. Stąd biorą się napady złości.',
    brain: [
      'Ośrodek emocji w mózgu (ciało migdałowate) jest silny i szybki, a „hamująca” go kora przedczołowa będzie się rozwijać jeszcze przez wiele lat. Dlatego dwulatek nie potrafi się zatrzymać, nawet gdy mówisz „stop”. To nie upór, tylko niedojrzały hamulec.',
      'Mowa rozwija się błyskawicznie, ale dziecko rozumie o wiele więcej, niż potrafi powiedzieć. Niemożność wyrażenia, czego chce, rodzi ogromną frustrację, która często wychodzi krzykiem albo biciem.',
      'W tym wieku dziecko poznaje przyczynę i skutek metodą prób: rzuca łyżkę na podłogę, patrzy na twoją reakcję, rzuca znowu. To nie „robienie ci na złość”, tylko eksperyment małego naukowca.',
    ],
    needs: [
      'Spokojnych, jasnych i powtarzalnych granic: „Nie wolno bić. Przytrzymam twoje ręce.” Zamiast długich wyjaśnień — krótkie zdanie i działanie.',
      'Możliwości wyboru: „Czerwona koszulka czy niebieska?” Wybór zaspokaja potrzebę autonomii i zmniejsza potrzebę mówienia „nie”.',
      'Nazywania uczuć: „Złościsz się, bo zabawa się skończyła.” Nazwane uczucie szybciej się uspokaja.',
      'Kilku minut dziennie zabawy, w której to ono prowadzi, dużo ruchu i świeżego powietrza.',
    ],
    normal: [
      'Kilka napadów złości dziennie, zwłaszcza gdy jest zmęczone, głodne albo w momentach przejścia.',
      'Częste „Nie!”, wielokrotne domaganie się tego samego.',
      'Brak umiejętności dzielenia się. Prawdziwe dzielenie się kształtuje się mniej więcej po 3.–4. roku życia.',
      'Sporadyczne gryzienie lub bicie: w tym wieku agresja fizyczna osiąga szczyt, a potem stopniowo maleje.',
    ],
    tryThis: [
      'Uprzedzaj 5 minut przed zmianą aktywności: „Jeszcze dwa zjazdy i wracamy do domu.”',
      'Zamiast „nie” mów, co wolno: „Nie po ścianie, rysuj na tej kartce.”',
      '10 minut dziennie „jego zabawy”: robisz to, co ono, bez krytyki i bez zasypywania pytaniami.',
      'W ciągu dnia zauważaj dobre zachowanie i nazywaj je konkretnie: „Dałeś bratu zabawkę, zobacz, jak się ucieszył!”',
    ],
    specialist: [
      'Jeśli w 18. miesiącu nie wskazuje palcem, w wieku 2 lat nie mówi zdań dwuwyrazowych, nie reaguje na imię albo bardzo rzadko nawiązuje kontakt wzrokowy.',
      'Jeśli traci słowa lub umiejętności, które już opanowało (w dowolnym wieku).',
      'Jeśli napady złości trwają dłużej niż 25 minut, zdarzają się częściej niż 5 razy dziennie, dziecko poważnie rani siebie lub innych albo nie słabną po 4. roku życia.',
      'Jeśli trudności ze snem, jedzeniem czy zachowaniem od miesięcy zaburzają codzienne życie rodziny.',
    ],
    sources: [S.harvardEF2011, S.healthyChildrenTantrums, S.cdcPositive, S.tremblay2004, S.zubler2022],
  },
  {
    id: '3-6',
    emoji: '🎨',
    title: '3–6 lat: wyobraźnia, pytania i zasady',
    lead: 'Dziecko pyta „dlaczego?”, wymyśla zabawy w udawanie, uczy się przyjaźni. Umiejętność panowania nad sobą szybko rośnie, ale wciąż potrzebuje twojego wsparcia.',
    brain: [
      'Funkcje wykonawcze — utrzymywanie uwagi, czekanie na swoją kolej, pamiętanie zasad, zmiana sposobu myślenia — rozwijają się bardzo szybko między 3. a 5. rokiem życia. Zabawy w udawanie i gry z zasadami to najlepszy trening tych umiejętności.',
      'Dziecko zaczyna rozumieć, że ktoś inny może myśleć inaczej. Dlatego w tym wieku pojawiają się pierwsze kłamstwa. Co ciekawe, to oznaka rozwoju poznawczego.',
      'Wyobraźnia się wzmacnia, a granica między rzeczywistością a fantazją jest jeszcze zamazana. Lęk przed ciemnością, potworami czy snami to typowe lęki tego wieku.',
    ],
    needs: [
      'Kilku jasnych zasad rodzinnych, stosowanych konsekwentnie. Im bardziej przewidywalne zasady, tym mniej kłótni.',
      'Logicznych konsekwencji zamiast kar: „Jeśli rzucasz piłką w domu, piłka idzie do szafy.”',
      'Rozmów o uczuciach: książek, zabaw zabawkami, pytań „a ty jak byś się czuł?”.',
      'Prawdziwych, małych obowiązków: nakrywanie do stołu, sprzątanie zabawek, podlewanie kwiatka.',
    ],
    normal: [
      'Czasem kłamie, myli fantazję z rzeczywistością.',
      'Testuje zasady i silnie reaguje na „niesprawiedliwość”.',
      'Boi się ciemności albo nowych sytuacji.',
      'Wciąż zdarzają się napady złości, ale krótsze i rzadsze niż wcześniej.',
    ],
    tryThis: [
      'Raz dziennie zapytaj o „najlepszy i najtrudniejszy moment dnia” i uważnie słuchaj.',
      'Narysujcie razem zasady w formie obrazków i powieście je na ścianie.',
      'Ćwiczcie powstrzymywanie się w zabawach typu „czerwone światło, zielone światło” czy „Szymon mówi”.',
      'Gdy coś pójdzie nie tak, szukajcie rozwiązania razem: „Woda się wylała. Co robimy?”',
    ],
    specialist: [
      'Jeśli w wieku 4 lat nie buduje zdań, obcy z trudem rozumieją jego mowę albo w ogóle nie interesuje się rówieśnikami.',
      'Jeśli lęki lub niepokój od tygodni zaburzają codzienne życie (przedszkole, sen, jedzenie).',
      'Jeśli agresja poważnie rani innych albo narasta; jeśli pojawia się okrucieństwo wobec zwierząt.',
      'Jeśli po długim okresie suchości znów moczy się w dzień albo traci wcześniejsze umiejętności.',
    ],
    sources: [S.diamond2013, S.harvardEF2011, S.talwarLee2008, S.cdcPositive, S.zubler2022],
  },
  {
    id: '6-12',
    emoji: '🎒',
    title: '6–12 lat: umiejętności, przyjaźń, wiara w siebie',
    lead: 'Lata szkolne to czas, w którym dziecko buduje poczucie „potrafię”. Przyjaciele zyskują na znaczeniu, ale ty nadal jesteś jego główną podporą.',
    brain: [
      'Planowanie, uwaga i samokontrola są już dobrze rozwinięte, ale zmęczenie, głód i stres łatwo je „wyłączają”. Rozdrażnione dziecko po szkole to często po prostu dziecko wyczerpane.',
      'Dziecko zaczyna porównywać się z innymi. W tym okresie poczucie własnej wartości karmi się głównie wysiłkiem, zdobywaniem umiejętności i poczuciem akceptacji.',
      'Bliżej okresu dojrzewania (około 9–12 lat) mogą zacząć się zmiany hormonalne: wahania nastroju i większa potrzeba prywatności są normalne.',
    ],
    needs: [
      'Zachęty, która dostrzega wysiłek i strategię: „Długo pracowałeś nad tym zadaniem, spróbowałeś innego sposobu.”',
      'Stopniowo rosnącej odpowiedzialności i prawa wyboru, razem z jasnymi zasadami rodzinnymi.',
      'Rodzica, który słucha bez oceniania. Jeśli wysłuchasz małych spraw, opowie ci też o dużych.',
      'Wolnego czasu poza ekranem i lekcjami: zabawy, sportu, przyjaciół, snu.',
    ],
    normal: [
      'Długie spory o sprawiedliwość, chęć negocjowania zasad.',
      'Kłótnie i godzenie się z przyjaciółmi, smutek, że „nie przyjęli mnie do zabawy”.',
      'Unikanie zadań domowych, zapominalstwo.',
      'Czasem wstydzi się rodzica albo chce więcej czasu w samotności (zwłaszcza po 10. roku życia).',
    ],
    tryThis: [
      'Czas na „rozmowę bez przesłuchania” w samochodzie, przy jedzeniu albo przed snem: opowiadaj też o swoim dniu.',
      'Stała pora i miejsce na lekcje, ale nie odrabiaj ich za dziecko.',
      'Spiszcie razem rodzinny plan ekranowy: gdzie, kiedy i jak długo.',
      'Raz w tygodniu czas we dwoje: tylko ty i ono, przy zajęciu, które samo wybierze.',
    ],
    specialist: [
      'Smutek, utrata zainteresowań, duże zmiany snu lub apetytu trwające dłużej niż dwa tygodnie.',
      'Uporczywa odmowa chodzenia do szkoły, częste skargi na bóle brzucha i głowy (jeśli lekarz nie znajduje przyczyny).',
      'Oznaki bycia ofiarą przemocy rówieśniczej albo dręczenia innych; całkowita izolacja od przyjaciół.',
      'Samookaleczanie, mówienie o śmierci lub samobójstwie: nigdy nie traktuj tego jako „zwracania na siebie uwagi”. Natychmiast zwróć się do specjalisty, a jeśli jest zagrożenie — dzwoń pod {emergency}.',
    ],
    sources: [S.cdcPositive, S.aapMediaSchool2016, S.pomerantz2007, S.muellerDweck1998, S.unesco2019],
  },
];
