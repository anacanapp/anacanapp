import type { MilestoneQuiz, StyleQuiz } from '../types';
import { S } from './sources';

export const STYLE_QUIZ: StyleQuiz = {
  id: 'style',
  emoji: '🪞',
  title: 'Min föräldrastil',
  intro: '12 korta påståenden. Tänk på de senaste två veckorna och svara ärligt — det finns inga rätt eller fel svar. Resultatet stannar bara i din telefon.',
  scale: ['Nästan aldrig', 'Ibland', 'Ofta', 'Nästan alltid'],
  items: [
    { text: 'När mitt barn är ledset eller argt sätter jag ord på känslan och finns där.', dim: 'warmth' },
    { text: 'Jag hittar tid varje dag att krama, skratta och säga ”jag älskar dig”.', dim: 'warmth' },
    { text: 'När mitt barn pratar lägger jag undan mobilen och lyssnar.', dim: 'warmth' },
    { text: 'Jag lägger märke till barnets bra beteende och sätter ord på det.', dim: 'warmth' },
    { text: 'Hemma har vi några tydliga regler som mitt barn känner till.', dim: 'structure' },
    { text: 'När jag har satt en regel håller jag lugnt fast vid den.', dim: 'structure' },
    { text: 'Vår dagliga rytm (mat, sömn) är ungefär densamma.', dim: 'structure' },
    { text: 'När mitt barn gråter eller tjatar ändrar jag mitt ”nej”.', dim: 'giveIn' },
    { text: 'När jag är trött släpper jag reglerna helt: ”hen får göra som hen vill”.', dim: 'giveIn' },
    { text: 'När jag blir arg höjer jag rösten eller skriker.', dim: 'harsh' },
    { text: 'Jag hotar mitt barn (”jag lämnar dig här”, ”jag ringer polisen”).', dim: 'harsh' },
    { text: 'När jag är arg känner jag lust att slå eller säga hårda ord, och ibland gör jag det.', dim: 'harsh' },
  ],
  results: {
    balanced: {
      title: 'Varm och tydlig',
      short: 'Du visar både kärlek och sätter tydliga gränser — den kombination som forskningen ser som mest gynnsam.',
      detail: [
        'Psykologer kallar den här stilen ”auktoritativ”: mycket värme och mycket struktur. Barn som växer upp med den här stilen är i genomsnitt mer självständiga, har bättre självförtroende och hanterar sina känslor bättre.',
        'Det betyder inte att du är perfekt. Du blir också trött och ibland tar tålamodet slut. Det som gör skillnaden är att du hittar tillbaka till relationen efter svåra stunder.',
      ],
      next: ['Börja göra reglerna tillsammans med barnet i takt med att hen växer.', 'Glöm inte att ta hand om dig själv: för att vara en lugn förälder behöver du vila.', 'Håll fast vid vanan med ”särskild tid” — det är din starkaste ”försäkring”.'],
    },
    gentle: {
      title: 'Mycket varm, mjuka gränser',
      short: 'Du är väldigt nära ditt barn och lyhörd för hens känslor. Ibland är det svårt att hålla gränserna.',
      detail: [
        'Värmen är din största styrka, och den är ovärderlig för barnets trygga anknytning. Men barn testar gränser för att veta att de finns kvar. När gränsen mjuknar testar barnet mer, och föräldern blir utmattad.',
        'Kärlek och gränser står inte i motsats till varandra. Att säga ”jag älskar dig, och svaret är ändå nej” ger barnet trygghet.',
      ],
      next: ['Välj 3–5 tydliga familjeregler och tillämpa dem lugnt.', 'Visa förståelse under ett utbrott, men ändra inte beslutet.', 'Testa steget ”en mening, en gång” från programmet ”21 dagar utan att skrika”.'],
    },
    storm: {
      title: 'Kärleksfull, men exploderar i trötta stunder',
      short: 'Du är väldigt fäst vid ditt barn, men i stressade stunder höjs rösten. Det känner många föräldrar igen.',
      detail: [
        'Din värme är en stark grund. Skrik och hårda ord beror oftast på trötthet, stress och att vara ensam, inte på brist på kärlek.',
        'Forskning visar att regelbundna skrik påverkar barnets beteende negativt, även när relationen är varm. De goda nyheterna: självreglering är en förmåga som går att lära sig, och reparationssamtal skyddar relationen.',
      ],
      next: ['Hitta det som triggar dig: vilka timmar, vilka situationer?', 'Börja med ”pausknappen” och en lång utandning.', 'Programmet ”21 dagar utan att skrika” är precis för dig.'],
    },
    strict: {
      title: 'Starka gränser, dold värme',
      short: 'Du lägger stor vikt vid ordning och regler. Ibland sker det på bekostnad av värme och lyssnande.',
      detail: [
        'Regler och konsekvens är viktiga för barnet — det är din styrka. Men gränser som sätts med hård kontroll och straff minskar enligt forskningen inte beteendeproblem på lång sikt, utan kan tvärtom öka dem.',
        'Det går att behålla reglerna och samtidigt öka värmen: förklara, sätta ord på känslor, lägga märke till bra beteende.',
      ],
      next: ['10 minuter lek varje dag där barnet bestämmer.', 'Använd logiska konsekvenser i stället för straff.', 'Förklara en regel: ”Den här regeln finns för att…”'],
    },
    stretched: {
      title: 'Trött och utmattad',
      short: 'Det verkar som att du har varit väldigt trött på sistone. Det betyder inte att du är en dålig förälder, utan är en signal om att du behöver stöd.',
      detail: [
        'När en förälder är utmattad finns det ingen kraft kvar varken för värme eller för struktur. Det är mycket vanligt och lätt att förstå, särskilt med en bebis, sömnbrist, jobb och ensamhet.',
        'Resultatet är ingen anklagelse; det visar att också du behöver omsorg. Små steg och att be om hjälp kan förändra allt.',
      ],
      next: ['Dela på bördan: kom överens om konkret hjälp med din partner, familj eller vänner.', 'En kontaktstund på 5 minuter om dagen: bara en kram och ögonkontakt.', 'Om du har känt dig nedstämd eller hopplös i mer än två veckor, prata med en läkare eller psykolog.'],
    },
  },
  note: 'Testet är ingen diagnos, utan ett enkelt verktyg för självreflektion. Det bygger på Baumrinds dimensioner värme och struktur.',
  sources: [S.baumrind1966, S.baumrind1967, S.pinquart2017, S.wangKenny2014],
};

export const MILESTONE_QUIZ: MilestoneQuiz = {
  id: 'milestones',
  emoji: '🧩',
  title: 'Vad kan mitt barn i den här åldern?',
  intro: 'En kort koll baserad på utvecklingsmilstolparna från CDC och American Academy of Pediatrics. De flesta barn (ungefär 3 av 4) visar de här förmågorna i den här åldern. Varje barn utvecklas i sin egen takt.',
  answers: { yes: 'Ja', no: 'Inte än', unsure: 'Osäker' },
  regression: 'Har barnet tappat en förmåga hen redan hade (ord, lek, rörelse)?',
  checkpoints: [
    {
      id: 'm4',
      fromMonths: 4,
      title: '4 månader',
      items: [
        { text: 'Ler av sig själv när hen ser dig och försöker fånga din uppmärksamhet.', flag: true, support: 'Var mycket ansikte mot ansikte: le, vänta, svara på bebisens leende.' },
        { text: 'Gör ljud som ”a-a”, ”o-o” och svarar med ljud när du pratar.', support: 'Härma bebisens ljud och pausa sedan så att hen kan ”svara”.' },
        { text: 'Vänder huvudet mot dig när hen hör din röst.', flag: true, support: 'Säg bebisens namn med mjuk röst från olika håll.' },
        { text: 'Håller huvudet stadigt utan stöd när du bär hen.', support: 'Kort ”magläge” några gånger om dagen när bebisen är vaken.' },
        { text: 'Tar tag i en leksak du ger och håller i den.', support: 'Ge lätta skallror som är lätta att greppa.' },
        { text: 'Stödjer sig på armbågarna och lyfter huvudet i magläge.', support: 'Lägg en spegel eller en färgglad leksak framför bebisen.' },
      ],
    },
    {
      id: 'm9',
      fromMonths: 9,
      title: '9 månader',
      items: [
        { text: 'Tittar upp när hen hör sitt namn.', flag: true, support: 'Använd namnet ofta i lekar, och le och beröm när barnet tittar.' },
        { text: 'Säger olika stavelser som ”ma-ma-ma”, ”ba-ba-ba”.', flag: true, support: 'Upprepa stavelserna tillsammans och sjung sånger.' },
        { text: 'Sträcker upp armarna för att bli upplyft.', support: 'Fråga innan du lyfter: ”Upp?” och vänta på att barnet sträcker ut armarna.' },
        { text: 'Följer ett föremål som tappats med blicken och letar efter det.', support: 'Lek tittut och ”var är leksaken?”.' },
        { text: 'Sitter utan stöd.', support: 'Ge säker lektid på golvet och skydda sittandet med kuddar.' },
        { text: 'Är försiktig med främlingar eller söker skydd hos dig.', support: 'Det är ett tecken på anknytning. Stressa inte fram bekantskap med nya människor.' },
      ],
    },
    {
      id: 'm18',
      fromMonths: 18,
      title: '18 månader',
      items: [
        { text: 'Pekar med fingret för att visa dig något intressant.', flag: true, support: 'Peka själv och benämn: ”Titta, en fågel!” Svara entusiastiskt när barnet pekar.' },
        { text: 'Säger minst 3 ord utöver ”mamma, pappa”.', flag: true, support: 'Prata medan ni gör vardagliga saker och bygg ut barnets ord.' },
        { text: 'Följer en enkel uppmaning utan gest (”ge mig bollen”).', support: 'Säg uppmaningen kort och tacka glatt när barnet gör det.' },
        { text: 'Går utan stöd.', flag: true, support: 'Ge gott om rörelsemöjligheter, barfota, i en säker miljö.' },
        { text: 'Härmar dig i hushållssysslor (sopa, prata i telefon).', support: 'Ge en liten sopborste eller leksaksporslin och ”jobba” tillsammans.' },
        { text: 'Äter själv med fingrarna och försöker använda sked.', support: 'Låt barnet kladda och erbjud fingermat.' },
      ],
    },
    {
      id: 'm30',
      fromMonths: 30,
      title: '2,5 år',
      items: [
        { text: 'Säger ungefär 50 ord.', support: 'Läs böcker tillsammans, benämn bilderna och ställ öppna frågor.' },
        { text: 'Sätter ihop två ord med ett verb (”katten springer”).', flag: true, support: 'Bygg ut ett ord till två: ”Bil.” — ”Stor bil kör!”' },
        { text: 'Använder ord som ”jag”, ”min”, ”vi”.', support: 'Säg ”min tur, din tur” i turtagningslekar.' },
        { text: 'Leker låtsaslekar (matar dockan, kör en kloss som en bil).', flag: true, support: 'Var med i låtsasleken och föreslå enkla handlingar.' },
        { text: 'Följer en uppmaning i två steg (”ta leksaken och lägg den i lådan”).', support: 'Ge uppmaningar genom lek och öva först ett steg, sedan två.' },
        { text: 'Hoppar jämfota från marken.', support: 'Hopplekar utomhus, ”kaninleken”.' },
      ],
    },
    {
      id: 'm48',
      fromMonths: 48,
      title: '4 år',
      items: [
        { text: 'Säger meningar med 4 ord eller fler.', flag: true, support: 'Prata om dagen och bygg ut barnets berättelse med frågor.' },
        { text: 'Berättar om något som hänt under dagen.', support: 'Prata på kvällen om ”dagens bästa stund”.' },
        { text: 'Blir någon annan i leken (lärare, superhjälte).', support: 'Ge tid och material för utklädnad och rollekar.' },
        { text: 'Tycker om att leka med andra barn och tröstar dem.', flag: true, support: 'Ordna korta lekträffar och hjälp barnet att sätta ord på känslor.' },
        { text: 'Kan säga namnet på några färger.', support: 'Benämn färger i vardagen och gör det till en lek.' },
        { text: 'Fångar oftast en stor boll och håller pennan med fingrarna.', support: 'Bollekar, rita, modellera.' },
      ],
    },
    {
      id: 'y6',
      fromMonths: 72,
      title: 'Skolålder (6–12)',
      items: [
        { text: 'Sköter den dagliga egenvården (klä på sig, borsta tänderna) mestadels själv.', support: 'Ge självständighet som passar åldern och stötta med bildrutiner.' },
        { text: 'Har minst en kompis och tycker om att leka med hen.', flag: true, support: 'Ge utrymme för vänskap och öva sociala förmågor hemma.' },
        { text: 'Följer reglerna i spel och kan vänta på sin tur.', support: 'Spela sällskapsspel med regler som familj.' },
        { text: 'Kan förklara sina känslor med ord.', support: 'Gör det till en daglig vana att prata om känslor.' },
        { text: 'Läsning och räkning går framåt i takt med klassen.', flag: true, support: 'Håll kontakten med läraren, läs tillsammans och uppskatta ansträngningen.' },
        { text: 'Lugnar sig inom rimlig tid efter att ha blivit arg.', support: 'Välj sätt att lugna sig tillsammans och öva på dem.' },
      ],
    },
  ],
  results: {
    ontrack: {
      title: 'Allt ser bra ut',
      short: 'Ditt barn visar de flesta förmågor som kan förväntas i den här åldern.',
      detail: [
        'Om du svarade ”inte än” på några punkter, oroa dig inte: barn lär sig vissa förmågor lite senare och andra tidigt.',
        'Ställ dina frågor om utvecklingen till läkaren eller sjuksköterskan vid varje kontroll — det är det bästa sättet att följa upp.',
      ],
    },
    watch: {
      title: 'Några förmågor håller fortfarande på att utvecklas',
      short: 'Det finns några svar med ”inte än” eller ”osäker”. Du kan stötta de här förmågorna genom vardaglig lek.',
      detail: [
        'Stötta barnet med tipsen nedan i 4–6 veckor och gör sedan kollen igen.',
        'Om oron finns kvar, prata med en barnläkare utan att vänta på nästa kontroll. Tidigt stöd är alltid bättre än att vänta.',
      ],
    },
    talk: {
      title: 'Vi rekommenderar att du pratar med en barnläkare',
      short: 'Vissa svar är signaler som en läkare bör titta på. Det är ingen diagnos, men du behöver inte vänta.',
      detail: [
        'Förlust av förmågor (tillbakagång) eller försenade viktiga milstolpar kräver en tidig bedömning. Stöd som börjar tidigt ger bäst resultat.',
        'Du kan visa den här listan när du träffar läkaren.',
      ],
    },
  },
  note: 'Den här kollen är ett screeningverktyg och ingen diagnos. Om du är orolig, kontakta läkare oavsett resultat.',
  sources: [S.zubler2022, S.cdcActEarly],
};
