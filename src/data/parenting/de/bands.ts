import type { BandOverview } from '../types';
import { S } from './sources';

export const BANDS: BandOverview[] = [
  {
    id: '0-1',
    emoji: '👶',
    title: 'Das erste Jahr: das Fundament des Vertrauens',
    lead: 'In diesem Jahr lernt dein Baby, ob die Welt ein sicherer Ort ist. Die Antwort holt es sich aus deiner Stimme, deinen Armen und der Art, wie du auf es reagierst.',
    brain: [
      'In den ersten Lebensjahren entstehen im Gehirn pro Sekunde mehr als eine Million neue Nervenverbindungen. Welche Bahnen sich festigen, entscheidet die wiederholte Alltagserfahrung: Dein Baby gibt einen Laut von sich, du antwortest; es weint, du kommst zu ihm.',
      'Der Teil des Gehirns, der beruhigt, ist bei deinem Baby noch sehr unreif. Deshalb kann es sich noch nicht selbst beruhigen, sondern „leiht“ sich die Ruhe von deinem entspannten Körper. Das nennt man Co-Regulation, und sie ist die erste Lektion in späterer Selbstregulation.',
      'Mit etwa 6–9 Monaten werden Gedächtnis und Bindung stärker: Dein Baby fremdelt vielleicht und wird unruhig, wenn du den Raum verlässt. Das ist kein Rückschritt, sondern im Gegenteil ein Zeichen, dass es eine Bindung zu dir aufgebaut hat.',
    ],
    needs: [
      'Eine Antwort auf sein Weinen. In diesem Alter kann man ein Baby nicht „ans Tragen gewöhnen“ oder verwöhnen. Eine schnelle, liebevolle Reaktion lehrt es, der Welt zu vertrauen.',
      'Austausch von Angesicht zu Angesicht: Lächeln, Lieder, seine Laute nachahmen. Diese „Hin-und-her“-Spiele legen das Fundament für Sprache und Gefühle im Gehirn.',
      'Ein vorhersehbarer Tag: Essen, Schlafen und Baden in ungefähr gleicher Reihenfolge. Nicht die genaue Uhrzeit zählt, sondern ein vertrauter Rhythmus.',
      'Sicherer Schlaf und eine sichere Umgebung – und Eltern, die ausgeruht sind und Unterstützung bekommen.',
    ],
    normal: [
      'Langes, scheinbar grundloses Weinen zu bestimmten Tageszeiten, vor allem am frühen Abend (in den ersten 3–4 Monaten).',
      'Häufiges nächtliches Aufwachen. Im ersten Jahr durchzuschlafen ist nicht für jedes Baby die Norm.',
      'Alles in den Mund stecken: So erkundet dein Baby die Welt.',
      'Angst vor Fremden und Weinen, wenn du nicht da bist (etwa ab 8 Monaten).',
    ],
    tryThis: [
      'Mehrmals am Tag 5 Minuten „Zeit von Angesicht zu Angesicht“: Handy weg, ahme die Laute deines Babys nach und beschreibe in Worten, was es tut.',
      'Begleite den Alltag mit Worten: „Jetzt wechseln wir die Windel. Wir heben das Bein. Fertig!“',
      'Spielt Kuckuck: Mit diesem Spiel lernt dein Kind, dass wer geht, auch wiederkommt – und die Trennungsangst wird sanfter.',
      'Wenn das Weinen lange dauert und deine Geduld am Ende ist, leg dein Baby an einen sicheren Ort – ins Bettchen –, atme ein paar Minuten durch und komm dann zurück.',
    ],
    specialist: [
      'Wenn dein Baby nicht auf Geräusche reagiert, keinen Blickkontakt mit dir aufnimmt, mit 4 Monaten nicht lächelt oder mit 9 Monaten nicht auf seinen Namen reagiert.',
      'Wenn es eine Fähigkeit verliert, die es schon konnte (lächeln, Laute machen, sitzen).',
      'Wenn sein Weinen anders klingt als sonst oder mit Fieber, Erbrechen, Teilnahmslosigkeit oder Trinkverweigerung einhergeht: Geh zum Arzt. In ernsten Fällen ruf {emergency} an.',
      'Wenn du dich selbst wochenlang traurig oder hoffnungslos fühlst oder Angst hast, deinem Baby etwas anzutun: Das kann eine postpartale Depression sein, und sie ist behandelbar. Sprich mit deiner Ärztin oder deinem Arzt.',
    ],
    sources: [S.harvardServe, S.nurturingCare2018, S.ainsworth1978, S.healthyChildrenCrying, S.zubler2022],
  },
  {
    id: '1-3',
    emoji: '🧸',
    title: '1–3 Jahre: die „Selber machen!“-Phase',
    lead: 'Dein Kind läuft schon, fängt an zu sprechen und will selbstständig sein, aber der Teil des Gehirns, der Gefühle steuert, ist noch sehr jung. Genau daher kommen die Wutanfälle.',
    brain: [
      'Das Gefühlszentrum des Gehirns (die Amygdala) ist stark und schnell, der präfrontale Kortex, der es „bremst“, wird sich dagegen noch viele Jahre entwickeln. Deshalb kann ein Zweijähriges nicht aufhören, auch wenn es selbst „Stopp“ sagt. Das ist kein Trotz, sondern eine noch unreife Bremse.',
      'Die Sprache entwickelt sich rasant, doch dein Kind versteht viel, viel mehr, als es sagen kann. Nicht ausdrücken zu können, was es will, frustriert enorm – und das kommt oft als Schreien oder Hauen heraus.',
      'In diesem Alter lernt dein Kind Ursache und Wirkung durch Ausprobieren: Es wirft den Löffel auf den Boden, schaut, wie du reagierst, und wirft ihn wieder. Das ist kein „Ärgern“, sondern das Experiment eines kleinen Forschers.',
    ],
    needs: [
      'Ruhige, klare und wiederkehrende Grenzen: „Hauen geht nicht. Ich halte deine Hände fest.“ Keine langen Erklärungen, sondern ein kurzer Satz und Handeln.',
      'Wahlmöglichkeiten: „Das rote oder das blaue T-Shirt?“ Eine Wahl erfüllt das Bedürfnis nach Autonomie und macht das „Nein“ seltener nötig.',
      'Gefühle benennen: „Du bist wütend, weil das Spiel vorbei ist.“ Ein benanntes Gefühl beruhigt sich schneller.',
      'Jeden Tag ein paar Minuten Spiel, bei dem dein Kind bestimmt, viel Bewegung und frische Luft.',
    ],
    normal: [
      'Mehrere Wutanfälle am Tag, besonders wenn es müde oder hungrig ist oder bei Übergängen.',
      'Oft „Nein!“ sagen und dasselbe immer und immer wieder wollen.',
      'Nicht teilen können. Echtes Teilen entwickelt sich erst mit etwa 3–4 Jahren.',
      'Gelegentliches Beißen oder Hauen: In diesem Alter erreicht körperliche Aggression ihren Höhepunkt und nimmt danach allmählich ab.',
    ],
    tryThis: [
      'Kündige Übergänge 5 Minuten vorher an: „Noch zweimal rutschen, dann gehen wir nach Hause.“',
      'Sag statt „Nein“, was erlaubt ist: „Nicht an die Wand, mal auf dieses Papier.“',
      'Jeden Tag 10 Minuten „sein Spiel“: Was es macht, machst du auch – ohne Kritik und ohne Fragenflut.',
      'Bemerke tagsüber gutes Verhalten und benenne es genau: „Du hast deinem Bruder das Spielzeug gegeben, wie hat er sich gefreut!“',
    ],
    specialist: [
      'Wenn es mit 18 Monaten nicht zeigt (mit dem Finger deutet), mit 2 Jahren keine Zwei-Wort-Sätze bildet, nicht auf seinen Namen reagiert oder sehr wenig Blickkontakt hat.',
      'Wenn es Wörter oder Fähigkeiten verliert, die es schon konnte (in jedem Alter).',
      'Wenn Wutanfälle länger als 25 Minuten dauern, mehr als 5-mal am Tag auftreten, es sich selbst oder andere ernsthaft verletzt oder sie auch nach dem 4. Geburtstag nicht weniger werden.',
      'Wenn Schwierigkeiten mit Schlaf, Essen oder Verhalten das Familienleben über Monate durcheinanderbringen.',
    ],
    sources: [S.harvardEF2011, S.healthyChildrenTantrums, S.cdcPositive, S.tremblay2004, S.zubler2022],
  },
  {
    id: '3-6',
    emoji: '🎨',
    title: '3–6 Jahre: Fantasie, Fragen und Regeln',
    lead: 'Dein Kind fragt „Warum?“, erfindet Rollenspiele und lernt, was Freundschaft ist. Seine Selbststeuerung wächst schnell, aber es braucht noch deine Unterstützung.',
    brain: [
      'Die exekutiven Funktionen – Aufmerksamkeit halten, abwarten, bis man dran ist, eine Regel im Kopf behalten, umdenken – entwickeln sich zwischen 3 und 5 Jahren rasant. Rollenspiele und Spiele mit Regeln sind dafür das beste Training.',
      'Dein Kind beginnt zu verstehen, dass andere anders denken können als es selbst. Deshalb tauchen in diesem Alter die ersten Lügen auf – interessanterweise ein Zeichen geistiger Entwicklung.',
      'Die Fantasie wird stärker, die Grenze zwischen Wirklichkeit und Erfundenem ist noch verschwommen. Angst vor der Dunkelheit, vor Monstern oder vor Träumen ist typisch für dieses Alter.',
    ],
    needs: [
      'Wenige, klare Familienregeln, die konsequent gelten. Je vorhersehbarer die Regeln, desto weniger Streit.',
      'Logische Folgen statt Strafen: „Wenn du den Ball im Haus wirfst, kommt der Ball in den Schrank.“',
      'Gespräche über Gefühle: Bücher, Spiele mit Kuscheltieren, Fragen wie „Wie würdest du dich fühlen?“.',
      'Echte kleine Aufgaben: den Tisch decken, Spielzeug aufräumen, die Pflanze gießen.',
    ],
    normal: [
      'Manchmal lügen, Fantasie und Wirklichkeit vermischen.',
      'Regeln austesten und heftig auf „Ungerechtigkeit“ reagieren.',
      'Angst vor der Dunkelheit oder vor neuen Situationen.',
      'Immer noch gelegentliche Wutanfälle, aber kürzer und seltener als früher.',
    ],
    tryThis: [
      'Frag einmal am Tag nach dem „schönsten und dem schwierigsten Moment des Tages“ und hör aufmerksam zu.',
      'Malt die Regeln gemeinsam als Bilder und hängt sie an die Wand.',
      'Übt Selbstbeherrschung mit Spielen wie „Rotes Licht, grünes Licht“ oder „Simon sagt“.',
      'Wenn etwas schiefgeht, sucht gemeinsam nach einer Lösung: „Das Wasser ist ausgelaufen. Was machen wir?“',
    ],
    specialist: [
      'Wenn es mit 4 Jahren keine Sätze bildet, Fremde es kaum verstehen oder es sich überhaupt nicht für Spielkameraden interessiert.',
      'Wenn Ängste oder Sorgen den Alltag (Kita, Schlaf, Essen) wochenlang durcheinanderbringen.',
      'Wenn Aggression anderen ernsthaft schadet oder zunimmt, oder wenn es Tiere quält.',
      'Wenn es nach längerer Zeit des Trockenseins tagsüber wieder einnässt oder frühere Fähigkeiten verliert.',
    ],
    sources: [S.diamond2013, S.harvardEF2011, S.talwarLee2008, S.cdcPositive, S.zubler2022],
  },
  {
    id: '6-12',
    emoji: '🎒',
    title: '6–12 Jahre: Können, Freundschaft, Selbstvertrauen',
    lead: 'In den Schuljahren baut dein Kind das Gefühl „Ich kann das“ auf. Freunde werden wichtig, aber du bleibst sein wichtigster Halt.',
    brain: [
      'Planen, Aufmerksamkeit und Selbststeuerung sind schon gut entwickelt, aber Müdigkeit, Hunger und Stress „schalten“ sie leicht ab. Ein gereiztes Kind nach der Schule ist oft einfach ein erschöpftes Kind.',
      'Dein Kind fängt an, sich mit anderen zu vergleichen. In dieser Phase speist sich das Selbstwertgefühl vor allem aus Anstrengung, aus neu erworbenen Fähigkeiten und aus dem Gefühl, dazuzugehören.',
      'Kurz vor der Pubertät (etwa mit 9–12 Jahren) können hormonelle Veränderungen beginnen: Stimmungsschwankungen und ein größeres Bedürfnis nach Privatsphäre sind normal.',
    ],
    needs: [
      'Ermutigung, die Anstrengung und Strategie sieht: „Du hast lange an dieser Aufgabe gearbeitet und einen anderen Weg ausprobiert.“',
      'Wachsende Verantwortung und Mitspracherecht, zusammen mit klaren Familienregeln.',
      'Eltern, die zuhören, ohne zu urteilen. Wenn du bei kleinen Dingen zuhörst, wird es dir auch die großen erzählen.',
      'Freie Zeit jenseits von Bildschirm und Hausaufgaben: Spiel, Sport, Freunde, Schlaf.',
    ],
    normal: [
      'Lange Diskussionen über Gerechtigkeit, der Wunsch, Regeln zu verhandeln.',
      'Streit und Versöhnung in Freundschaften, Kummer à la „Sie haben mich nicht mitspielen lassen“.',
      'Sich vor den Hausaufgaben drücken, Vergesslichkeit.',
      'Sich manchmal für die Eltern schämen oder mehr Zeit allein wollen (besonders ab 10 Jahren).',
    ],
    tryThis: [
      'Eine Zeit für „Gespräche ohne Verhör“ – im Auto, beim Essen oder vor dem Schlafengehen: Erzähl auch du von deinem Tag.',
      'Ein fester Zeitpunkt und Ort für die Hausaufgaben – aber mach sie nicht an seiner Stelle.',
      'Schreibt gemeinsam einen Familien-Medienplan: wo, wann und wie lange.',
      'Einmal pro Woche Zeit zu zweit: nur du und dein Kind, bei einer Aktivität, die es aussucht.',
    ],
    specialist: [
      'Traurigkeit, Interessenverlust oder große Veränderungen bei Schlaf oder Appetit, die länger als zwei Wochen anhalten.',
      'Hartnäckige Weigerung, zur Schule zu gehen, häufige Klagen über Bauch- und Kopfschmerzen (wenn der Arzt keine Ursache findet).',
      'Anzeichen, dass es gemobbt wird oder selbst andere mobbt; völliger Rückzug von Freunden.',
      'Selbstverletzung, Reden über den Tod oder Suizid: Tu das nie als „Aufmerksamkeit suchen“ ab. Wende dich sofort an Fachleute, bei Gefahr ruf {emergency} an.',
    ],
    sources: [S.cdcPositive, S.aapMediaSchool2016, S.pomerantz2007, S.muellerDweck1998, S.unesco2019],
  },
];
