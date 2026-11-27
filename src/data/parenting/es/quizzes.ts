import type { MilestoneQuiz, StyleQuiz } from '../types';
import { S } from './sources';

export const STYLE_QUIZ: StyleQuiz = {
  id: 'style',
  emoji: '🪞',
  title: 'Mi estilo de crianza',
  intro: '12 frases cortas. Piensa en las dos últimas semanas y responde con sinceridad: aquí no hay respuestas correctas ni incorrectas. El resultado se guarda en tu cuenta y solo tú puedes verlo.',
  scale: ['Casi nunca', 'A veces', 'A menudo', 'Casi siempre'],
  items: [
    { text: 'Cuando mi hijo está triste o enojado, le pongo nombre a lo que siente y me quedo a su lado.', dim: 'warmth' },
    { text: 'A lo largo del día encuentro tiempo para abrazarlo, reírnos y decirle “te quiero”.', dim: 'warmth' },
    { text: 'Cuando mi hijo me habla, dejo el teléfono a un lado y lo escucho.', dim: 'warmth' },
    { text: 'Me fijo en su buena conducta y se lo digo.', dim: 'warmth' },
    { text: 'En casa hay unas pocas normas claras que mi hijo conoce.', dim: 'structure' },
    { text: 'Cuando pongo una norma, la cumplo con calma.', dim: 'structure' },
    { text: 'Nuestra rutina diaria (comidas, sueño) es bastante estable.', dim: 'structure' },
    { text: 'Cuando mi hijo llora o insiste, retiro el “no” que le había dado.', dim: 'giveIn' },
    { text: 'Cuando estoy cansado/a, dejo de lado todas las normas: “que haga lo que quiera”.', dim: 'giveIn' },
    { text: 'Cuando me altero, levanto la voz o grito.', dim: 'harsh' },
    { text: 'Amenazo a mi hijo (“te dejo aquí y me voy”, “llamo a la policía”).', dim: 'harsh' },
    { text: 'En los momentos de enojo me dan ganas de pegarle o de decirle cosas duras, y a veces lo hago.', dim: 'harsh' },
  ],
  results: {
    balanced: {
      title: 'Calidez y claridad',
      short: 'Muestras amor y a la vez pones límites claros: la combinación que los estudios consideran más beneficiosa.',
      detail: [
        'Los psicólogos llaman a este estilo “democrático” o “con autoridad”: mucha calidez y mucha estructura. Los niños que crecen con este estilo son, de media, más autónomos, más seguros de sí mismos y gestionan mejor sus emociones.',
        'Eso no significa ser perfecto. Tú también te cansas y a veces se te agota la paciencia. Lo que marca la diferencia es que, después de los momentos difíciles, vuelves a conectar.',
      ],
      next: ['A medida que crece, empieza a crear las normas junto con tu hijo.', 'No te olvides de cuidarte: para ser una madre o un padre en calma hace falta descansar.', 'Protege el hábito del “tiempo especial”: es el “seguro” más potente.'],
    },
    gentle: {
      title: 'Mucha calidez, límites blandos',
      short: 'Tienes una relación muy cercana con tu hijo y eres sensible a sus emociones. A veces te cuesta mantener los límites.',
      detail: [
        'La calidez es tu mayor fortaleza, y es insustituible para un apego seguro. Pero los niños ponen a prueba los límites para saber que siguen en su sitio. Cuando el límite se ablanda, el niño prueba todavía más, y los padres acaban agotados.',
        'El amor y los límites no se contradicen. Decir “te quiero y la respuesta sigue siendo no” le da seguridad al niño.',
      ],
      next: ['Elige 3–5 normas familiares claras y aplícalas con calma.', 'Durante la rabieta, muestra empatía, pero no cambies tu decisión.', 'Prueba el paso “Una frase, una vez” del programa “21 días sin gritar”.'],
    },
    storm: {
      title: 'Mucho amor, pero explosiones cuando llega el cansancio',
      short: 'Tienes un vínculo muy fuerte con tu hijo, pero en los momentos de estrés sube la voz. Es una situación que muchos padres reconocen.',
      detail: [
        'Tu calidez es una base sólida. Los gritos y las palabras duras suelen ser fruto del cansancio, de las prisas y de la soledad, no de la falta de amor.',
        'Los estudios muestran que, aunque la relación sea cálida, los gritos frecuentes afectan negativamente a la conducta del niño. La buena noticia: la autorregulación es una habilidad que se aprende, y las conversaciones de reparación protegen la relación.',
      ],
      next: ['Encuentra tus detonantes: ¿a qué horas, en qué situaciones?', 'Empieza con el “botón de pausa” y la exhalación larga.', 'El programa “21 días sin gritar” está hecho justo para ti.'],
    },
    strict: {
      title: 'Límites firmes, calidez escondida',
      short: 'Das importancia al orden y a las normas. A veces eso ocurre a costa de la calidez y de la escucha.',
      detail: [
        'Las normas y la constancia son importantes para el niño: es tu punto fuerte. Pero, según los estudios, los límites impuestos con control duro y castigos no reducen los problemas de conducta a largo plazo; al contrario, pueden aumentarlos.',
        'Se puede aumentar la calidez sin renunciar a las normas: explicando, poniendo nombre a las emociones, fijándote en la buena conducta.',
      ],
      next: ['Cada día, 10 minutos de juego dirigido por el niño.', 'En lugar de castigos, usa consecuencias lógicas.', 'Explica una norma: “Esta norma existe porque…”'],
    },
    stretched: {
      title: 'Al límite de tus fuerzas',
      short: 'Parece que últimamente estás muy cansado/a. No significa que seas un mal padre o una mala madre: es una señal de que necesitas apoyo.',
      detail: [
        'Cuando los padres están agotados, no quedan fuerzas ni para la calidez ni para la estructura. Es una situación muy común y comprensible, sobre todo cuando hay un bebé, falta de sueño, trabajo y soledad.',
        'Este resultado no es una acusación: muestra que tú también necesitas cuidados. Los pasos pequeños y pedir ayuda pueden cambiarlo todo.',
      ],
      next: ['Reparte la carga: acuerda con tu pareja, tu familia o tus amigos una ayuda concreta.', 'Un momento de conexión de 5 minutos al día: solo abrazos y contacto visual.', 'Si llevas más de dos semanas sintiendo tristeza o desesperanza, habla con un médico o con un psicólogo.'],
    },
  },
  note: 'Este test no es un diagnóstico, sino una herramienta sencilla de autoobservación. Se basa en las dimensiones de calidez y estructura de Baumrind.',
  sources: [S.baumrind1966, S.baumrind1967, S.pinquart2017, S.wangKenny2014],
};

export const MILESTONE_QUIZ: MilestoneQuiz = {
  id: 'milestones',
  emoji: '🧩',
  title: '¿Qué debería saber hacer mi hijo a esta edad?',
  intro: 'Una revisión breve basada en los hitos del desarrollo de los CDC y de la Academia Estadounidense de Pediatría. La mayoría de los niños (más o menos 3 de cada 4) muestran estas habilidades a esta edad. Cada niño se desarrolla a su propio ritmo.',
  answers: { yes: 'Sí', no: 'Todavía no', unsure: 'No lo tengo claro' },
  regression: '¿Ha perdido alguna habilidad que ya tenía (palabras, juego, movimientos)?',
  checkpoints: [
    {
      id: 'm4',
      fromMonths: 4,
      title: '4 meses',
      items: [
        { text: 'Sonríe por sí mismo al verte e intenta llamar tu atención.', flag: true, support: 'Pasa mucho tiempo cara a cara: sonríe, espera y responde a su sonrisa.' },
        { text: 'Hace sonidos como “a-a” o “u-u” y responde con sonidos cuando le hablas.', support: 'Imita sus sonidos y luego haz una pausa para que te “conteste”.' },
        { text: 'Gira la cabeza hacia tu voz cuando te oye.', flag: true, support: 'Llámalo por su nombre con voz suave desde distintos lados.' },
        { text: 'En brazos, mantiene la cabeza firme sin apoyo.', support: 'Mientras esté despierto, varios ratos cortos al día boca abajo.' },
        { text: 'Agarra y sostiene un juguete que le pones en la mano.', support: 'Dale sonajeros ligeros y fáciles de agarrar.' },
        { text: 'Boca abajo, se apoya en los codos y levanta la cabeza.', support: 'Ponle delante un espejo o un juguete de colores.' },
      ],
    },
    {
      id: 'm9',
      fromMonths: 9,
      title: '9 meses',
      items: [
        { text: 'Mira cuando lo llamas por su nombre.', flag: true, support: 'Usa a menudo su nombre en los juegos y, cuando te mire, sonríe y felicítalo.' },
        { text: 'Dice sílabas variadas como “ma-ma-ma” o “ba-ba-ba”.', flag: true, support: 'Repitan juntos las sílabas y cántale canciones.' },
        { text: 'Levanta los brazos para que lo tomes en brazos.', support: 'Antes de levantarlo, pregúntale “¿upa?” y espera a que abra los brazos.' },
        { text: 'Sigue con la mirada un objeto que se cae y lo busca.', support: 'Juega al cucú-tras y a “¿dónde está el juguete?”.' },
        { text: 'Se sienta sin apoyo.', support: 'Dale tiempo de juego seguro en el suelo y protégelo con cojines mientras se sienta.' },
        { text: 'Desconfía de los desconocidos o se refugia en ti.', support: 'Es una señal de apego. No le metas prisa para conocer a gente nueva.' },
      ],
    },
    {
      id: 'm18',
      fromMonths: 18,
      title: '18 meses',
      items: [
        { text: 'Señala con el dedo para mostrarte algo que le interesa.', flag: true, support: 'Señala tú también y ponle nombre: “¡Mira, un pájaro!” Cuando señale, respóndele con entusiasmo.' },
        { text: 'Dice al menos 3 palabras además de “mamá” y “papá”.', flag: true, support: 'Haz las tareas diarias hablando y amplía sus palabras.' },
        { text: 'Sigue una instrucción sencilla sin gestos (“dame la pelota”).', support: 'Dile la instrucción en pocas palabras y, cuando la cumpla, agradéceselo con alegría.' },
        { text: 'Camina sin apoyo.', flag: true, support: 'Dale muchas oportunidades de moverse descalzo en un espacio seguro.' },
        { text: 'Te imita en las tareas de casa (barrer, hablar por teléfono).', support: 'Dale una escoba pequeña o cacharritos de juguete y “trabajen” juntos.' },
        { text: 'Come solo con los dedos e intenta usar la cuchara.', support: 'Deja que se manche y ofrécele alimentos para comer con los dedos.' },
      ],
    },
    {
      id: 'm30',
      fromMonths: 30,
      title: '2 años y medio',
      items: [
        { text: 'Dice unas 50 palabras.', support: 'Lean juntos, nombren los dibujos y hazle preguntas abiertas.' },
        { text: 'Junta dos palabras, una de ellas un verbo (“gato corre”).', flag: true, support: 'Convierte su palabra en dos: “Coche.” — “¡Ahí va un coche grande!”' },
        { text: 'Usa las palabras “yo”, “mío”, “nosotros”.', support: 'En los juegos por turnos, di “me toca a mí, te toca a ti”.' },
        { text: 'Juega a juegos simbólicos (dar de comer a un muñeco, mover un bloque como si fuera un coche).', flag: true, support: 'Súmate a su juego simbólico y propón historias sencillas.' },
        { text: 'Sigue una instrucción de dos pasos (“toma el juguete y mételo en la caja”).', support: 'Da las instrucciones jugando y practica primero con un paso y luego con dos.' },
        { text: 'Salta del suelo con los dos pies.', support: 'Juegos de saltar al aire libre, jugar a ser “conejitos”.' },
      ],
    },
    {
      id: 'm48',
      fromMonths: 48,
      title: '4 años',
      items: [
        { text: 'Forma frases de 4 palabras o más.', flag: true, support: 'Hablen del día y amplíen su relato con preguntas.' },
        { text: 'Cuenta algo que le ha pasado durante el día.', support: 'Por la noche, charlen sobre “el mejor momento del día”.' },
        { text: 'En el juego se convierte en otra persona (maestra, superhéroe).', support: 'Dale tiempo y materiales para disfraces y juegos de roles.' },
        { text: 'Disfruta jugando con otros niños y los consuela.', flag: true, support: 'Organiza encuentros cortos con amigos y ayúdale a poner nombre a las emociones.' },
        { text: 'Dice el nombre de varios colores.', support: 'Nombren los colores en la vida diaria y conviértanlo en un juego.' },
        { text: 'Casi siempre atrapa una pelota grande y sostiene el lápiz con los dedos.', support: 'Juegos de pelota, dibujar, plastilina.' },
      ],
    },
    {
      id: 'y6',
      fromMonths: 72,
      title: 'Edad escolar (6–12)',
      items: [
        { text: 'Hace solo casi todo su cuidado personal diario (vestirse, lavarse los dientes).', support: 'Dale una autonomía adecuada a su edad y apóyala con rutinas con dibujos.' },
        { text: 'Tiene al menos un amigo y disfruta jugando con él.', flag: true, support: 'Facilita las amistades y practiquen en casa las habilidades sociales.' },
        { text: 'Respeta las reglas de los juegos y sabe esperar su turno.', support: 'Jueguen en familia a juegos de mesa con reglas.' },
        { text: 'Sabe explicar con palabras lo que siente.', support: 'Haz de hablar de emociones un hábito diario.' },
        { text: 'Avanza en lectura y cálculo de acuerdo con su curso.', flag: true, support: 'Mantente en contacto con su maestro, lean juntos y valora su esfuerzo.' },
        { text: 'Después de alterarse, se calma en un tiempo razonable.', support: 'Elijan juntos estrategias para calmarse y practíquenlas.' },
      ],
    },
  ],
  results: {
    ontrack: {
      title: 'Todo va bien',
      short: 'Tu hijo muestra la mayoría de las habilidades esperables para su edad.',
      detail: [
        'Si hay algún “Todavía no”, no te preocupes: los niños adquieren algunas habilidades un poco más tarde y otras antes.',
        'En cada revisión, hazle al médico tus preguntas sobre su desarrollo: es la mejor forma de hacer un seguimiento.',
      ],
    },
    watch: {
      title: 'Algunas habilidades todavía se están formando',
      short: 'Hay algunas respuestas de “Todavía no” o “No lo tengo claro”. Puedes apoyar estas habilidades con el juego del día a día.',
      detail: [
        'Apóyalas durante 4–6 semanas con los consejos de abajo y vuelve a hacer la revisión.',
        'Si sigues preocupado/a, habla con el pediatra sin esperar a la próxima revisión. Apoyar pronto siempre es mejor que esperar.',
      ],
    },
    talk: {
      title: 'Te recomendamos hablar con el pediatra',
      short: 'Algunas respuestas son señales que debería ver un médico. No es un diagnóstico, pero no hace falta esperar.',
      detail: [
        'La pérdida de habilidades (regresión) o el retraso en hitos importantes requieren una evaluación temprana. El apoyo que empieza pronto da los mejores resultados.',
        'Cuando vayas al médico, puedes enseñarle esta lista.',
      ],
    },
  },
  note: 'Esta revisión es una herramienta de cribado, no un diagnóstico. Si algo te preocupa, consulta al médico sea cual sea el resultado.',
  sources: [S.zubler2022, S.cdcActEarly],
};
