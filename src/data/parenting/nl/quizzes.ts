import type { MilestoneQuiz, StyleQuiz } from '../types';
import { S } from './sources';

export const STYLE_QUIZ: StyleQuiz = {
  id: 'style',
  emoji: '🪞',
  title: 'Mijn opvoedstijl',
  intro: '12 korte uitspraken. Denk aan de afgelopen twee weken en antwoord eerlijk — er zijn geen goede of foute antwoorden. De uitkomst wordt in je account bewaard en alleen jij kunt hem zien.',
  scale: ['Bijna nooit', 'Soms', 'Vaak', 'Bijna altijd'],
  items: [
    { text: 'Als mijn kind verdrietig of boos is, benoem ik het gevoel en blijf ik bij hem.', dim: 'warmth' },
    { text: 'Ik vind elke dag tijd om hem te knuffelen, samen te lachen en “ik hou van je” te zeggen.', dim: 'warmth' },
    { text: 'Als mijn kind praat, leg ik mijn telefoon weg en luister ik.', dim: 'warmth' },
    { text: 'Ik zie zijn goede gedrag en benoem het.', dim: 'warmth' },
    { text: 'Bij ons thuis zijn er een paar duidelijke regels die mijn kind kent.', dim: 'structure' },
    { text: 'Als ik een regel heb gesteld, houd ik me er rustig aan.', dim: 'structure' },
    { text: 'Ons dagritme (eten, slapen) is ongeveer vast.', dim: 'structure' },
    { text: 'Als mijn kind huilt of aandringt, kom ik terug op mijn “nee”.', dim: 'giveIn' },
    { text: 'Als ik moe ben, laat ik de regels helemaal los: “laat hem maar doen wat hij wil”.', dim: 'giveIn' },
    { text: 'Als ik boos word, verhef ik mijn stem of schreeuw ik.', dim: 'harsh' },
    { text: 'Ik dreig mijn kind (“ik laat je hier achter”, “ik bel de politie”).', dim: 'harsh' },
    { text: 'In een boos moment heb ik de neiging hem te slaan of harde woorden te zeggen, en soms doe ik dat ook.', dim: 'harsh' },
  ],
  results: {
    balanced: {
      title: 'Warm en duidelijk',
      short: 'Je laat liefde zien en stelt ook duidelijke grenzen — de combinatie die onderzoek als het meest waardevol ziet.',
      detail: [
        'Psychologen noemen deze stijl “autoritatief”: veel warmte en veel structuur. Kinderen die zo opgroeien zijn gemiddeld zelfstandiger, hebben meer zelfvertrouwen en kunnen beter met hun gevoelens omgaan.',
        'Dat betekent niet dat je perfect bent. Ook jij wordt moe en soms is je geduld op. Wat het verschil maakt, is dat je na moeilijke momenten de verbinding weer opzoekt.',
      ],
      next: ['Begin de regels samen met je kind te maken naarmate hij ouder wordt.', 'Vergeet de zorg voor jezelf niet: om een rustige ouder te zijn, moet je ook uitrusten.', 'Houd de gewoonte van “speciale tijd” vast — dat is je sterkste “verzekering”.'],
    },
    gentle: {
      title: 'Heel warm, zachte grenzen',
      short: 'Je bent heel nabij en gevoelig voor de gevoelens van je kind. Grenzen vasthouden vind je soms lastig.',
      detail: [
        'Warmte is je grootste kracht, en die is onmisbaar voor een veilige hechting. Maar kinderen testen grenzen om te weten of ze er nog staan. Als de grens zacht wordt, gaat je kind meer testen en raakt de ouder uitgeput.',
        'Liefde en grenzen staan niet tegenover elkaar. Zeggen “ik hou van je, en het antwoord is nog steeds nee” geeft je kind juist veiligheid.',
      ],
      next: ['Kies 3–5 duidelijke gezinsregels en pas ze rustig toe.', 'Toon begrip tijdens een driftbui, maar verander je besluit niet.', 'Probeer de stap “één zin, één keer” uit het programma “21 dagen zonder schreeuwen”.'],
    },
    storm: {
      title: 'Liefdevol, maar ontploft op vermoeide momenten',
      short: 'Je bent heel betrokken bij je kind, maar in stressvolle momenten gaat je stem omhoog. Veel ouders herkennen dat.',
      detail: [
        'Jouw warmte is een stevige basis. Schreeuwen en harde woorden zijn vaak het gevolg van vermoeidheid, haast en er alleen voor staan, niet van een gebrek aan liefde.',
        'Onderzoek laat zien dat regelmatig schreeuwen het gedrag van een kind negatief beïnvloedt, ook als de relatie warm is. Het goede nieuws: zelfregulatie is een vaardigheid die je kunt leren, en herstelgesprekken beschermen jullie band.',
      ],
      next: ['Ontdek je triggers: welke uren, welke situaties?', 'Begin met de “pauzeknop” en lang uitademen.', 'Het programma “21 dagen zonder schreeuwen” is precies iets voor jou.'],
    },
    strict: {
      title: 'Sterke grenzen, verborgen warmte',
      short: 'Je hecht veel waarde aan orde en regels. Soms gaat dat ten koste van warmte en luisteren.',
      detail: [
        'Regels en consequent zijn is belangrijk voor een kind — dat is jouw kracht. Maar grenzen die met harde controle en straf worden gesteld, verminderen volgens onderzoek gedragsproblemen op lange termijn niet en kunnen ze zelfs vergroten.',
        'Je kunt de regels houden en tegelijk meer warmte geven: uitleggen, gevoelens benoemen, goed gedrag zien.',
      ],
      next: ['Elke dag 10 minuten speeltijd waarin je kind de leiding heeft.', 'Gebruik logische gevolgen in plaats van straf.', 'Leg één regel uit: “Deze regel is er omdat…”'],
    },
    stretched: {
      title: 'Moe en uitgeput',
      short: 'Het lijkt erop dat je de laatste tijd erg moe bent. Dat maakt je geen slechte ouder; het is een signaal dat je steun nodig hebt.',
      detail: [
        'Als een ouder uitgeput is, is er geen energie meer voor warmte en ook niet voor structuur. Dat komt heel vaak voor en is goed te begrijpen, zeker met een baby, slaapgebrek, werk en er alleen voor staan.',
        'Deze uitkomst is geen verwijt; hij laat zien dat ook jij zorg nodig hebt. Kleine stappen en hulp vragen kunnen alles veranderen.',
      ],
      next: ['Deel de last: maak concrete afspraken over hulp met je partner, familie of vrienden.', 'Eén moment van verbinding van 5 minuten per dag: alleen een knuffel en oogcontact.', 'Voel je je langer dan twee weken somber of hopeloos, praat dan met een arts of psycholoog.'],
    },
  },
  note: 'Deze test is geen diagnose, maar een eenvoudig hulpmiddel om naar jezelf te kijken. Hij is gebaseerd op de dimensies warmte en structuur van Baumrind.',
  sources: [S.baumrind1966, S.baumrind1967, S.pinquart2017, S.wangKenny2014],
};

export const MILESTONE_QUIZ: MilestoneQuiz = {
  id: 'milestones',
  emoji: '🧩',
  title: 'Wat kan mijn kind op deze leeftijd?',
  intro: 'Een korte check op basis van de ontwikkelingsmijlpalen van de CDC en de American Academy of Pediatrics. De meeste kinderen (ongeveer 3 op de 4) laten deze vaardigheden op deze leeftijd zien. Elk kind ontwikkelt zich in zijn eigen tempo.',
  answers: { yes: 'Ja', no: 'Nog niet', unsure: 'Weet ik niet zeker' },
  regression: 'Is hij een vaardigheid kwijtgeraakt die hij al had (woorden, spel, bewegen)?',
  checkpoints: [
    {
      id: 'm4',
      fromMonths: 4,
      title: '4 maanden',
      items: [
        { text: 'Lacht uit zichzelf als hij jou ziet en probeert je aandacht te trekken.', flag: true, support: 'Breng veel tijd door van gezicht tot gezicht: lach, wacht, reageer op zijn lachje.' },
        { text: 'Maakt geluidjes als “aa”, “oe” en reageert met geluid als jij praat.', support: 'Doe zijn geluidjes na en wacht dan even, zodat hij kan “antwoorden”.' },
        { text: 'Draait zijn hoofd naar je toe als hij je stem hoort.', flag: true, support: 'Roep zacht zijn naam vanuit verschillende kanten.' },
        { text: 'Houdt zijn hoofd zonder steun stil als je hem draagt.', support: 'Een paar keer per dag korte “buiktijd” als hij wakker is.' },
        { text: 'Pakt een speeltje vast dat je hem geeft en houdt het vast.', support: 'Geef lichte rammelaars die makkelijk vast te pakken zijn.' },
        { text: 'Steunt op zijn ellebogen en tilt zijn hoofd op als hij op zijn buik ligt.', support: 'Leg een spiegel of een kleurig speeltje voor hem neer.' },
      ],
    },
    {
      id: 'm9',
      fromMonths: 9,
      title: '9 maanden',
      items: [
        { text: 'Kijkt op als zijn naam wordt geroepen.', flag: true, support: 'Gebruik zijn naam vaak in spelletjes, en lach en prijs hem als hij kijkt.' },
        { text: 'Zegt verschillende klanken als “ma-ma-ma”, “ba-ba-ba”.', flag: true, support: 'Herhaal de klanken samen en zing liedjes.' },
        { text: 'Steekt zijn armen uit om opgepakt te worden.', support: 'Vraag voor je hem oppakt: “Op de arm?” en wacht tot hij zijn armen uitsteekt.' },
        { text: 'Kijkt een gevallen voorwerp na en zoekt ernaar.', support: 'Speel kiekeboe en “waar is het speeltje?”.' },
        { text: 'Zit zonder steun.', support: 'Geef hem veilige speeltijd op de grond en bescherm het zitten met kussens.' },
        { text: 'Is eenkennig bij onbekenden of zoekt bescherming bij jou.', support: 'Dit is een teken van hechting. Forceer kennismaken met nieuwe mensen niet.' },
      ],
    },
    {
      id: 'm18',
      fromMonths: 18,
      title: '18 maanden',
      items: [
        { text: 'Wijst met zijn vinger om je iets interessants te laten zien.', flag: true, support: 'Wijs zelf ook en benoem het: “Kijk, een vogel!” Reageer enthousiast als hij wijst.' },
        { text: 'Zegt naast “mama, papa” minstens 3 woorden.', flag: true, support: 'Praat tijdens de dagelijkse dingen en breid zijn woorden uit.' },
        { text: 'Voert een eenvoudige opdracht uit zonder gebaar (“geef de bal”).', support: 'Zeg de opdracht kort en bedank hem blij als hij het doet.' },
        { text: 'Loopt zonder steun.', flag: true, support: 'Geef hem volop kans om te bewegen, op blote voeten, in een veilige ruimte.' },
        { text: 'Doet jou na bij klusjes in huis (vegen, bellen).', support: 'Geef hem een klein bezempje of speelgoedservies en “werk” samen.' },
        { text: 'Eet zelf met zijn vingers en probeert een lepel te gebruiken.', support: 'Laat hem knoeien en bied vingerfood aan.' },
      ],
    },
    {
      id: 'm30',
      fromMonths: 30,
      title: '2,5 jaar',
      items: [
        { text: 'Zegt ongeveer 50 woorden.', support: 'Lees samen boekjes, benoem de plaatjes en stel open vragen.' },
        { text: 'Maakt combinaties van twee woorden met een werkwoord (“poes rent”).', flag: true, support: 'Maak van één woord van hem twee woorden: “Auto.” — “Grote auto rijdt!”' },
        { text: 'Gebruikt woorden als “ik”, “mijn”, “wij”.', support: 'Zeg bij beurtspelletjes “mijn beurt, jouw beurt”.' },
        { text: 'Speelt doe-alsof-spel (pop eten geven, een blok laten rijden als auto).', flag: true, support: 'Doe mee met het fantasiespel en stel eenvoudige verhaaltjes voor.' },
        { text: 'Voert een opdracht in twee stappen uit (“pak het speeltje en leg het in de doos”).', support: 'Geef opdrachten via spel en oefen eerst één stap, daarna twee.' },
        { text: 'Springt met twee voeten tegelijk van de grond.', support: 'Springspelletjes buiten, het “konijntjesspel”.' },
      ],
    },
    {
      id: 'm48',
      fromMonths: 48,
      title: '4 jaar',
      items: [
        { text: 'Maakt zinnen van 4 of meer woorden.', flag: true, support: 'Praat over de dag en breid zijn verhaal uit met vragen.' },
        { text: 'Vertelt iets wat er die dag is gebeurd.', support: 'Praat ’s avonds over “het leukste moment van de dag”.' },
        { text: 'Wordt in zijn spel iemand anders (juf, superheld).', support: 'Geef tijd en spullen voor verkleden en rollenspel.' },
        { text: 'Speelt graag met andere kinderen en troost ze.', flag: true, support: 'Organiseer korte speelafspraakjes en help hem gevoelens te benoemen.' },
        { text: 'Kan een paar kleuren benoemen.', support: 'Benoem kleuren in het dagelijks leven en maak er een spelletje van.' },
        { text: 'Vangt meestal een grote bal en houdt een potlood met zijn vingers vast.', support: 'Balspelletjes, tekenen, klei.' },
      ],
    },
    {
      id: 'y6',
      fromMonths: 72,
      title: 'Basisschoolleeftijd (6–12)',
      items: [
        { text: 'Doet de dagelijkse verzorging (aankleden, tandenpoetsen) grotendeels zelf.', support: 'Geef zelfstandigheid die bij zijn leeftijd past en ondersteun met plaatjesroutines.' },
        { text: 'Heeft minstens één vriend(in) en speelt daar graag mee.', flag: true, support: 'Geef ruimte voor vriendschappen en oefen sociale vaardigheden thuis.' },
        { text: 'Houdt zich aan spelregels en kan op zijn beurt wachten.', support: 'Speel als gezin bordspellen met regels.' },
        { text: 'Kan zijn gevoelens in woorden uitleggen.', support: 'Maak van praten over gevoelens een dagelijkse gewoonte.' },
        { text: 'Lezen en rekenen gaan vooruit op het niveau van zijn klas.', flag: true, support: 'Houd contact met de leerkracht, lees samen en waardeer zijn inzet.' },
        { text: 'Wordt binnen een redelijke tijd weer rustig nadat hij boos is geworden.', support: 'Kies samen manieren om rustig te worden en oefen ze.' },
      ],
    },
  ],
  results: {
    ontrack: {
      title: 'Alles gaat goed',
      short: 'Je kind laat de meeste vaardigheden zien die je op deze leeftijd mag verwachten.',
      detail: [
        'Heb je een paar keer “nog niet” geantwoord, maak je dan geen zorgen: kinderen leren sommige vaardigheden wat later en andere juist vroeg.',
        'Stel bij elke controle je vragen over de ontwikkeling aan de arts — dat is de beste manier om alles te volgen.',
      ],
    },
    watch: {
      title: 'Een paar vaardigheden zijn nog in ontwikkeling',
      short: 'Er zijn een paar keer “nog niet” of “weet ik niet zeker”. Je kunt deze vaardigheden met dagelijks spel ondersteunen.',
      detail: [
        'Ondersteun hem 4–6 weken met de tips hieronder en doe de check daarna opnieuw.',
        'Blijf je je zorgen maken, praat dan met de kinderarts zonder de volgende controle af te wachten. Vroege steun is altijd beter dan afwachten.',
      ],
    },
    talk: {
      title: 'We raden aan met een kinderarts te praten',
      short: 'Sommige antwoorden zijn signalen waar een arts naar moet kijken. Het is geen diagnose, maar wachten is niet nodig.',
      detail: [
        'Verlies van vaardigheden (terugval) of vertraging van belangrijke mijlpalen vraagt om een vroeg onderzoek. Steun die vroeg begint, geeft het beste resultaat.',
        'Je kunt deze lijst aan de arts laten zien.',
      ],
    },
  },
  note: 'Deze check is een screeningshulpmiddel en geen diagnose. Maak je je zorgen, ga dan naar een arts, wat de uitkomst ook is.',
  sources: [S.zubler2022, S.cdcActEarly],
};
