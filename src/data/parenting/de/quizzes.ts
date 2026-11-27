import type { MilestoneQuiz, StyleQuiz } from '../types';
import { S } from './sources';

export const STYLE_QUIZ: StyleQuiz = {
  id: 'style',
  emoji: '🪞',
  title: 'Mein Erziehungsstil',
  intro: '12 kurze Aussagen. Denk an die letzten zwei Wochen und antworte ehrlich – es gibt hier keine richtigen oder falschen Antworten. Das Ergebnis wird in deinem Konto gespeichert und nur du siehst es.',
  scale: ['Fast nie', 'Manchmal', 'Oft', 'Fast immer'],
  items: [
    { text: 'Wenn mein Kind traurig oder wütend ist, benenne ich sein Gefühl und bleibe bei ihm.', dim: 'warmth' },
    { text: 'Im Laufe des Tages finde ich Zeit, es zu umarmen, mit ihm zu lachen und „Ich hab dich lieb“ zu sagen.', dim: 'warmth' },
    { text: 'Wenn mein Kind erzählt, lege ich das Handy weg und höre zu.', dim: 'warmth' },
    { text: 'Ich bemerke sein gutes Verhalten und benenne es.', dim: 'warmth' },
    { text: 'Bei uns zu Hause gibt es ein paar klare Regeln, die mein Kind kennt.', dim: 'structure' },
    { text: 'Wenn ich eine Regel aufgestellt habe, setze ich sie ruhig um.', dim: 'structure' },
    { text: 'Unser Tagesablauf (Essen, Schlafen) ist ungefähr gleichbleibend.', dim: 'structure' },
    { text: 'Wenn mein Kind weint oder nicht lockerlässt, nehme ich mein „Nein“ zurück.', dim: 'giveIn' },
    { text: 'Wenn ich müde bin, lasse ich die Regeln ganz fallen – „soll es doch machen, was es will“.', dim: 'giveIn' },
    { text: 'Wenn ich mich ärgere, werde ich laut oder schreie.', dim: 'harsh' },
    { text: 'Ich drohe meinem Kind („Dann lasse ich dich hier“, „Dann hole ich die Polizei“).', dim: 'harsh' },
    { text: 'Wenn ich wütend bin, habe ich den Drang, es zu schlagen oder harte Worte zu sagen – und manchmal tue ich es.', dim: 'harsh' },
  ],
  results: {
    balanced: {
      title: 'Warmherzig und klar',
      short: 'Du zeigst Liebe und setzt gleichzeitig klare Grenzen – die Kombination, die die Forschung als am hilfreichsten ansieht.',
      detail: [
        'Psychologen nennen diesen Stil „autoritativ“: viel Wärme und viel Struktur. Kinder, die so aufwachsen, sind im Durchschnitt selbstständiger und selbstbewusster und können ihre Gefühle besser steuern.',
        'Das heißt nicht, perfekt zu sein. Auch du bist müde, auch dir reißt mal der Geduldsfaden. Den Unterschied macht, dass du nach schwierigen Momenten zur Beziehung zurückkehrst.',
      ],
      next: ['Fang an, Regeln gemeinsam mit deinem Kind aufzustellen, während es größer wird.', 'Vergiss die Selbstfürsorge nicht: Um ruhig zu sein, musst du dich ausruhen.', 'Bewahre die Gewohnheit der „besonderen Zeit“ – sie ist die stärkste „Versicherung“.'],
    },
    gentle: {
      title: 'Sehr warmherzig, sanfte Grenzen',
      short: 'Du bist deinem Kind sehr nah und gehst feinfühlig auf seine Gefühle ein. Grenzen zu halten fällt dir manchmal schwer.',
      detail: [
        'Wärme ist deine größte Stärke und für eine sichere Bindung unersetzlich. Kinder testen Grenzen aber, um zu wissen, dass sie noch da sind. Werden die Grenzen weich, testet das Kind umso mehr, und die Eltern erschöpfen sich.',
        'Liebe und Grenzen widersprechen sich nicht. „Ich hab dich lieb, und die Antwort ist trotzdem Nein“ gibt deinem Kind Sicherheit.',
      ],
      next: ['Wähle 3–5 klare Familienregeln und setze sie ruhig um.', 'Zeig bei einem Wutanfall Mitgefühl, aber ändere deine Entscheidung nicht.', 'Probier den Schritt „Ein Satz, einmal“ aus dem Programm „21 Tage ohne Schreien“.'],
    },
    storm: {
      title: 'Liebevoll, aber explosiv in müden Momenten',
      short: 'Du bist deinem Kind sehr verbunden, aber in stressigen Momenten wirst du laut. Diese Situation kennen sehr viele Eltern.',
      detail: [
        'Deine Wärme ist ein starkes Fundament. Schreien und harte Worte sind dagegen meist eine Folge von Müdigkeit, Zeitdruck und Alleinsein – nicht von fehlender Liebe.',
        'Studien zeigen, dass regelmäßiges Anschreien das Verhalten eines Kindes negativ beeinflusst, selbst wenn die Beziehung warmherzig ist. Die gute Nachricht: Selbstregulation ist eine erlernbare Fähigkeit, und Reparatur-Gespräche schützen die Beziehung.',
      ],
      next: ['Finde deine Auslöser: welche Uhrzeiten, welche Situationen?', 'Fang mit dem „Pausenknopf“ und langem Ausatmen an.', 'Das Programm „21 Tage ohne Schreien“ ist genau das Richtige für dich.'],
    },
    strict: {
      title: 'Starke Grenzen, versteckte Wärme',
      short: 'Ordnung und Regeln sind dir wichtig. Manchmal geht das auf Kosten von Wärme und Zuhören.',
      detail: [
        'Regeln und Beständigkeit sind für Kinder wichtig – das ist deine Stärke. Aber Grenzen, die mit strenger Kontrolle und Strafen gesetzt werden, verringern laut Forschung langfristig keine Verhaltensprobleme, sondern können sie sogar verstärken.',
        'Du kannst die Regeln beibehalten und trotzdem mehr Wärme zeigen: erklären, Gefühle benennen, gutes Verhalten bemerken.',
      ],
      next: ['Jeden Tag 10 Minuten Spielzeit, in der dein Kind bestimmt.', 'Nutze logische Folgen statt Strafen.', 'Erkläre eine Regel: „Diese Regel gibt es, weil …“'],
    },
    stretched: {
      title: 'Müde und erschöpft',
      short: 'Es sieht so aus, als wärst du in letzter Zeit sehr müde. Das heißt nicht, dass du ein schlechter Elternteil bist, sondern es ist ein Signal, dass du Unterstützung brauchst.',
      detail: [
        'Wenn Eltern erschöpft sind, bleibt weder Kraft für Wärme noch für Struktur. Das ist sehr verbreitet und gut nachvollziehbar, besonders mit einem Baby, mit Schlafmangel, Arbeit und wenn man allein ist.',
        'Dieses Ergebnis ist kein Vorwurf an dich, sondern zeigt, dass auch du Fürsorge brauchst. Kleine Schritte und um Hilfe zu bitten können alles verändern.',
      ],
      next: ['Teil die Last: Vereinbare mit Partner, Familie oder Freunden konkrete Hilfe.', 'Jeden Tag ein 5-minütiger Moment der Verbindung: nur Umarmung und Blickkontakt.', 'Wenn du dich länger als zwei Wochen traurig oder hoffnungslos fühlst, sprich mit einer Ärztin, einem Arzt oder einer Psychologin bzw. einem Psychologen.'],
    },
  },
  note: 'Dieser Test ist keine Diagnose, sondern ein einfaches Werkzeug zur Selbstbeobachtung. Er beruht auf Baumrinds Dimensionen Wärme und Struktur.',
  sources: [S.baumrind1966, S.baumrind1967, S.pinquart2017, S.wangKenny2014],
};

export const MILESTONE_QUIZ: MilestoneQuiz = {
  id: 'milestones',
  emoji: '🧩',
  title: 'Was sollte mein Kind in diesem Alter können?',
  intro: 'Ein kurzer Check, der auf den Entwicklungsmeilensteinen der CDC und der Amerikanischen Akademie für Kinderheilkunde beruht. Die meisten Kinder (etwa 3 von 4) zeigen diese Fähigkeiten in diesem Alter. Jedes Kind entwickelt sich in seinem eigenen Tempo.',
  answers: { yes: 'Ja', no: 'Noch nicht', unsure: 'Bin mir nicht sicher' },
  regression: 'Hat es eine Fähigkeit verloren, die es schon konnte (Wörter, Spiel, Bewegung)?',
  checkpoints: [
    {
      id: 'm4',
      fromMonths: 4,
      title: '4 Monate',
      items: [
        { text: 'Lächelt von sich aus, wenn es dich sieht, und versucht, deine Aufmerksamkeit zu bekommen.', flag: true, support: 'Verbringt viel Zeit von Angesicht zu Angesicht: Lächle, warte ab und erwidere sein Lächeln.' },
        { text: 'Macht Laute wie „a-a“ oder „u-u“ und antwortet mit Lauten, wenn du sprichst.', support: 'Ahme seine Laute nach und mach dann eine Pause, damit es „antworten“ kann.' },
        { text: 'Dreht den Kopf zum Geräusch, wenn es deine Stimme hört.', flag: true, support: 'Ruf seinen Namen mit sanfter Stimme aus verschiedenen Richtungen.' },
        { text: 'Hält den Kopf auf dem Arm ohne Stütze stabil.', support: 'Im Wachzustand mehrmals am Tag kurz „Bauchzeit“.' },
        { text: 'Greift ein Spielzeug, das man ihm in die Hand gibt, und hält es fest.', support: 'Gib ihm leichte Rasseln, die sich gut greifen lassen.' },
        { text: 'Stützt sich in Bauchlage auf die Ellbogen und hebt den Kopf.', support: 'Leg einen Spiegel oder ein buntes Spielzeug vor es hin.' },
      ],
    },
    {
      id: 'm9',
      fromMonths: 9,
      title: '9 Monate',
      items: [
        { text: 'Schaut, wenn man seinen Namen ruft.', flag: true, support: 'Benutze seinen Namen oft beim Spielen; wenn es schaut, lächle und lobe es.' },
        { text: 'Sagt verschiedene Silben wie „ma-ma-ma“ oder „ba-ba-ba“.', flag: true, support: 'Wiederholt die Silben gemeinsam, singt Lieder.' },
        { text: 'Streckt die Arme hoch, um hochgenommen zu werden.', support: 'Frag vor dem Hochnehmen: „Auf den Arm?“ und warte, bis es die Arme ausstreckt.' },
        { text: 'Schaut einem heruntergefallenen Gegenstand hinterher und sucht ihn.', support: 'Spielt Kuckuck und „Wo ist das Spielzeug?“.' },
        { text: 'Sitzt ohne Stütze.', support: 'Gib ihm sichere Spielzeit auf dem Boden und sichere das Sitzen mit Kissen ab.' },
        { text: 'Fremdelt oder sucht bei dir Schutz.', support: 'Das ist ein Zeichen von Bindung. Dräng es nicht, neue Menschen kennenzulernen.' },
      ],
    },
    {
      id: 'm18',
      fromMonths: 18,
      title: '18 Monate',
      items: [
        { text: 'Zeigt mit dem Finger auf etwas Interessantes, um es dir zu zeigen.', flag: true, support: 'Zeig auch selbst und benenne es: „Schau, ein Vogel!“ Reagiere begeistert, wenn es zeigt.' },
        { text: 'Sagt außer „Mama, Papa“ mindestens 3 Wörter.', flag: true, support: 'Begleite den Alltag mit Worten und erweitere seine Wörter.' },
        { text: 'Befolgt eine einfache Aufforderung ohne Geste („Gib mir den Ball“).', support: 'Sag die Aufforderung kurz und bedank dich freudig, wenn es sie befolgt.' },
        { text: 'Läuft ohne Festhalten.', flag: true, support: 'Gib ihm barfuß in einer sicheren Umgebung viel Gelegenheit zur Bewegung.' },
        { text: 'Ahmt dich bei der Hausarbeit nach (fegen, telefonieren).', support: 'Gib ihm einen kleinen Besen oder Spielgeschirr und „arbeitet“ zusammen.' },
        { text: 'Isst selbst mit den Fingern und versucht, einen Löffel zu benutzen.', support: 'Erlaub, dass es sich schmutzig macht, und biete Fingerfood an.' },
      ],
    },
    {
      id: 'm30',
      fromMonths: 30,
      title: '2½ Jahre',
      items: [
        { text: 'Sagt etwa 50 Wörter.', support: 'Lest gemeinsam Bücher, benennt die Bilder und stell offene Fragen.' },
        { text: 'Verbindet zwei Wörter mit einem Verb („Katze läuft“).', flag: true, support: 'Mach aus einem Wort zwei: „Auto.“ – „Das große Auto fährt!“' },
        { text: 'Benutzt Wörter wie „ich“, „mein“, „wir“.', support: 'Sag bei Spielen mit Abwechseln „ich bin dran, du bist dran“.' },
        { text: 'Spielt Rollenspiele (die Puppe füttern, einen Bauklotz wie ein Auto fahren lassen).', flag: true, support: 'Spiel beim Rollenspiel mit und schlag einfache Geschichten vor.' },
        { text: 'Befolgt eine Aufforderung mit zwei Schritten („Nimm das Spielzeug und leg es in die Kiste“).', support: 'Gib Aufforderungen spielerisch und übt erst einen Schritt, dann zwei.' },
        { text: 'Springt mit beiden Füßen vom Boden ab.', support: 'Hüpfspiele draußen, „Hasenspringen“.' },
      ],
    },
    {
      id: 'm48',
      fromMonths: 48,
      title: '4 Jahre',
      items: [
        { text: 'Bildet Sätze mit 4 oder mehr Wörtern.', flag: true, support: 'Erzählt euch vom Tag und erweitert seine Geschichten mit Fragen.' },
        { text: 'Erzählt von etwas, das im Laufe des Tages passiert ist.', support: 'Sprecht abends über den „schönsten Moment des Tages“.' },
        { text: 'Verwandelt sich im Spiel in jemand anderen (Lehrerin, Superheld).', support: 'Gib Zeit und Material für Verkleidungen und Rollenspiele.' },
        { text: 'Spielt gern mit anderen Kindern und tröstet sie.', flag: true, support: 'Organisiere kurze Treffen mit Freunden und hilf, Gefühle zu benennen.' },
        { text: 'Kann einige Farben benennen.', support: 'Benennt im Alltag Farben und macht ein Spiel daraus.' },
        { text: 'Fängt einen großen Ball meistens und hält einen Stift mit den Fingern.', support: 'Ballspiele, Malen, Knete.' },
      ],
    },
    {
      id: 'y6',
      fromMonths: 72,
      title: 'Schulalter (6–12)',
      items: [
        { text: 'Erledigt die tägliche Körperpflege (anziehen, Zähne putzen) weitgehend selbst.', support: 'Gib altersgemäße Selbstständigkeit und unterstütze sie mit Bildroutinen.' },
        { text: 'Hat mindestens einen Freund oder eine Freundin und spielt gern mit ihm oder ihr.', flag: true, support: 'Ermögliche Freundschaften und übt soziale Fähigkeiten zu Hause.' },
        { text: 'Hält sich an Spielregeln und kann warten, bis es dran ist.', support: 'Spielt als Familie Brettspiele mit Regeln.' },
        { text: 'Kann seine Gefühle in Worten erklären.', support: 'Mach das Reden über Gefühle zu einer täglichen Gewohnheit.' },
        { text: 'Lesen und Rechnen entwickeln sich passend zur Klassenstufe.', flag: true, support: 'Bleib mit der Lehrkraft in Kontakt, lest gemeinsam und würdige seine Anstrengung.' },
        { text: 'Beruhigt sich nach einem Ärger in angemessener Zeit.', support: 'Wählt gemeinsam Beruhigungstechniken aus und übt sie.' },
      ],
    },
  ],
  results: {
    ontrack: {
      title: 'Alles auf gutem Weg',
      short: 'Dein Kind zeigt die meisten Fähigkeiten, die in diesem Alter erwartet werden.',
      detail: [
        'Wenn du ein paar Mal „Noch nicht“ geantwortet hast, mach dir keine Sorgen: Kinder erwerben manche Fähigkeiten etwas später, andere früher.',
        'Stell bei jeder Vorsorgeuntersuchung deine Fragen zur Entwicklung – das ist die beste Art, sie im Blick zu behalten.',
      ],
    },
    watch: {
      title: 'Einige Fähigkeiten entwickeln sich noch',
      short: 'Es gibt einige Antworten mit „Noch nicht“ oder „Bin mir nicht sicher“. Du kannst diese Fähigkeiten im Alltag spielerisch fördern.',
      detail: [
        'Unterstütze dein Kind 4–6 Wochen lang mit den Tipps unten und mach den Check dann noch einmal.',
        'Wenn deine Sorge bleibt, sprich mit der Kinderärztin oder dem Kinderarzt, ohne auf die nächste Untersuchung zu warten. Frühe Unterstützung ist immer besser als Abwarten.',
      ],
    },
    talk: {
      title: 'Wir empfehlen ein Gespräch mit der Kinderärztin oder dem Kinderarzt',
      short: 'Einige Antworten sind Signale, die sich eine Ärztin oder ein Arzt ansehen sollte. Das ist keine Diagnose, aber Abwarten ist nicht nötig.',
      detail: [
        'Der Verlust von Fähigkeiten (Regression) oder Verzögerungen bei wichtigen Meilensteinen sollten früh abgeklärt werden. Früh begonnene Förderung bringt die besten Ergebnisse.',
        'Du kannst diese Liste beim Arztbesuch zeigen.',
      ],
    },
  },
  note: 'Dieser Check ist ein Screening-Werkzeug und keine Diagnose. Wenn du dir Sorgen machst, wende dich unabhängig vom Ergebnis an eine Ärztin oder einen Arzt.',
  sources: [S.zubler2022, S.cdcActEarly],
};
