import type { MilestoneQuiz, StyleQuiz } from '../types';
import { S } from './sources';

export const STYLE_QUIZ: StyleQuiz = {
  id: 'style',
  emoji: '🪞',
  title: 'Mon style éducatif',
  intro: '12 affirmations courtes. Pense aux deux dernières semaines et réponds sincèrement – il n’y a pas de bonne ou de mauvaise réponse. Le résultat reste uniquement sur ton téléphone.',
  scale: ['Presque jamais', 'Parfois', 'Souvent', 'Presque toujours'],
  items: [
    { text: 'Quand mon enfant est triste ou en colère, je nomme ce qu’il ressent et je reste près de lui.', dim: 'warmth' },
    { text: 'Dans la journée, je trouve le temps de lui faire des câlins, de rire avec lui, de lui dire « je t’aime ».', dim: 'warmth' },
    { text: 'Quand mon enfant me parle, je pose mon téléphone et je l’écoute.', dim: 'warmth' },
    { text: 'Je remarque ses bons comportements et je les nomme.', dim: 'warmth' },
    { text: 'À la maison, il y a quelques règles claires que mon enfant connaît.', dim: 'structure' },
    { text: 'Une fois la règle posée, je la fais respecter calmement.', dim: 'structure' },
    { text: 'Notre rythme quotidien (repas, sommeil) est à peu près stable.', dim: 'structure' },
    { text: 'Quand mon enfant pleure ou insiste, je reviens sur mon « non ».', dim: 'giveIn' },
    { text: 'Quand je suis fatigué(e), je laisse complètement tomber les règles : « qu’il fasse ce qu’il veut ».', dim: 'giveIn' },
    { text: 'Quand je m’énerve, j’élève la voix ou je crie.', dim: 'harsh' },
    { text: 'Je menace mon enfant (« je vais te laisser ici », « je vais appeler la police »).', dim: 'harsh' },
    { text: 'Quand je suis à bout, j’ai envie de le frapper ou de lui dire des mots durs, et parfois je le fais.', dim: 'harsh' },
  ],
  results: {
    balanced: {
      title: 'Chaleureux et clair',
      short: 'Tu montres ton amour et tu poses aussi des limites claires – la combinaison que la recherche juge la plus bénéfique.',
      detail: [
        'Les psychologues appellent ce style « démocratique » (ou « directif-chaleureux ») : beaucoup de chaleur et beaucoup de structure. Les enfants élevés ainsi sont en moyenne plus autonomes, plus confiants et gèrent mieux leurs émotions.',
        'Cela ne veut pas dire être parfait. Toi aussi, tu te fatigues, tu perds parfois patience. Ce qui fait la différence, c’est que tu reviens vers la relation après les moments difficiles.',
      ],
      next: ['À mesure que ton enfant grandit, commence à poser les règles avec lui.', 'N’oublie pas de prendre soin de toi : pour être un parent calme, il faut se reposer.', 'Garde l’habitude du « moment spécial » – c’est la meilleure des « assurances ».'],
    },
    gentle: {
      title: 'Très chaleureux, limites souples',
      short: 'Tu es très proche de ton enfant et sensible à ses émotions. Tenir les limites te semble parfois difficile.',
      detail: [
        'La chaleur est ta plus grande force, et elle est irremplaçable pour un attachement sûr. Mais les enfants testent les limites pour vérifier qu’elles sont toujours là. Quand les limites s’assouplissent, l’enfant teste davantage, et le parent s’épuise.',
        'L’amour et les limites ne s’opposent pas. Dire « Je t’aime, et la réponse reste non » donne à ton enfant un sentiment de sécurité.',
      ],
      next: ['Choisis 3 à 5 règles familiales claires et applique-les calmement.', 'Pendant une crise, montre de l’empathie, mais ne change pas ta décision.', 'Essaie l’étape « Une phrase, une fois » du programme « 21 jours sans crier ».'],
    },
    storm: {
      title: 'Plein d’amour, mais explosif quand tu es fatigué(e)',
      short: 'Tu es très attaché(e) à ton enfant, mais dans les moments de stress, le ton monte. Beaucoup de parents connaissent cette situation.',
      detail: [
        'Ta chaleur est une base solide. Les cris et les mots durs sont le plus souvent la conséquence de la fatigue, de la précipitation et de la solitude, pas d’un manque d’amour.',
        'Les études montrent que crier régulièrement a un effet négatif sur le comportement de l’enfant, même quand la relation est chaleureuse. La bonne nouvelle : l’autorégulation s’apprend, et les conversations de réparation protègent la relation.',
      ],
      next: ['Repère tes déclencheurs : à quelles heures, dans quelles situations ?', 'Commence par le « bouton pause » et l’expiration longue.', 'Le programme « 21 jours sans crier » est fait pour toi.'],
    },
    strict: {
      title: 'Limites fortes, chaleur en retrait',
      short: 'Tu accordes de l’importance à l’ordre et aux règles. Parfois, c’est au détriment de la chaleur et de l’écoute.',
      detail: [
        'Les règles et la constance sont importantes pour un enfant – c’est ta force. Mais selon la recherche, les limites posées par un contrôle sévère et des punitions ne réduisent pas les problèmes de comportement à long terme ; elles peuvent même les aggraver.',
        'Il est possible de garder les règles tout en ajoutant de la chaleur : expliquer, nommer les émotions, remarquer les bons comportements.',
      ],
      next: ['Chaque jour, 10 minutes de jeu dirigé par ton enfant.', 'Utilise des conséquences logiques plutôt que des punitions.', 'Explique une règle : « Cette règle existe parce que… »'],
    },
    stretched: {
      title: 'Fatigué(e) et épuisé(e)',
      short: 'On dirait que tu es très fatigué(e) ces derniers temps. Ce n’est pas être un mauvais parent, c’est le signe que tu as besoin de soutien.',
      detail: [
        'Quand un parent est épuisé, il ne reste de force ni pour la chaleur ni pour la structure. C’est une situation très courante et compréhensible, surtout avec un bébé, le manque de sommeil, le travail et la solitude.',
        'Ce résultat n’est pas un reproche : il montre que toi aussi, tu as besoin qu’on prenne soin de toi. De petits pas et le fait de demander de l’aide peuvent tout changer.',
      ],
      next: ['Partage la charge : convenez d’une aide concrète avec ton ou ta partenaire, ta famille, tes amis.', 'Chaque jour, un moment de connexion de 5 minutes : juste un câlin et un regard.', 'Si tu ressens de la tristesse ou du désespoir depuis plus de deux semaines, parles-en à un médecin ou à un psychologue.'],
    },
  },
  note: 'Ce test n’est pas un diagnostic, mais un outil simple pour s’observer. Il s’appuie sur les dimensions de chaleur et de structure de Baumrind.',
  sources: [S.baumrind1966, S.baumrind1967, S.pinquart2017, S.wangKenny2014],
};

export const MILESTONE_QUIZ: MilestoneQuiz = {
  id: 'milestones',
  emoji: '🧩',
  title: 'Que devrait savoir faire mon enfant à cet âge ?',
  intro: 'Une courte vérification fondée sur les étapes du développement du CDC et de l’Académie américaine de pédiatrie. La plupart des enfants (environ 3 sur 4) montrent ces compétences à cet âge. Chaque enfant se développe à son propre rythme.',
  answers: { yes: 'Oui', no: 'Pas encore', unsure: 'Je ne suis pas sûr(e)' },
  regression: 'A-t-il perdu une compétence qu’il avait déjà (mots, jeu, mouvement) ?',
  checkpoints: [
    {
      id: 'm4',
      fromMonths: 4,
      title: '4 mois',
      items: [
        { text: 'Sourit spontanément quand il te voit et cherche à attirer ton attention.', flag: true, support: 'Passez beaucoup de temps face à face : souris, attends, réponds à son sourire.' },
        { text: 'Fait des sons comme « a-a », « ou-ou » et te répond par des sons quand tu parles.', support: 'Imite ses sons, puis fais une pause pour qu’il puisse « répondre ».' },
        { text: 'Tourne la tête vers ta voix quand il l’entend.', flag: true, support: 'Appelle-le doucement par son prénom depuis différents côtés.' },
        { text: 'Tient sa tête droite sans soutien quand il est dans les bras.', support: 'Plusieurs fois par jour, quand il est éveillé, un court « temps sur le ventre ».' },
        { text: 'Attrape et tient un jouet qu’on lui met dans la main.', support: 'Donne-lui des hochets légers et faciles à saisir.' },
        { text: 'Sur le ventre, s’appuie sur ses coudes et relève la tête.', support: 'Place devant lui un miroir ou un jouet coloré.' },
      ],
    },
    {
      id: 'm9',
      fromMonths: 9,
      title: '9 mois',
      items: [
        { text: 'Regarde quand on l’appelle par son prénom.', flag: true, support: 'Utilise souvent son prénom dans les jeux ; quand il regarde, souris et félicite-le.' },
        { text: 'Dit différentes syllabes comme « ma-ma-ma », « ba-ba-ba ».', flag: true, support: 'Répétez les syllabes ensemble, chantez des chansons.' },
        { text: 'Lève les bras pour qu’on le prenne.', support: 'Avant de le prendre, demande : « Dans les bras ? » et attends qu’il tende les bras.' },
        { text: 'Suit des yeux un objet qui tombe et le cherche.', support: 'Jouez à coucou et à « Où est le jouet ? ».' },
        { text: 'Tient assis sans soutien.', support: 'Donne-lui du temps de jeu au sol en sécurité et protège sa position assise avec des coussins.' },
        { text: 'Se méfie des inconnus ou se réfugie contre toi.', support: 'C’est un signe d’attachement. Ne précipite pas la rencontre avec de nouvelles personnes.' },
      ],
    },
    {
      id: 'm18',
      fromMonths: 18,
      title: '18 mois',
      items: [
        { text: 'Pointe du doigt quelque chose d’intéressant pour te le montrer.', flag: true, support: 'Pointe toi aussi et nomme : « Regarde, un oiseau ! » Réponds avec enthousiasme quand il montre quelque chose.' },
        { text: 'Dit au moins 3 mots en plus de « maman, papa ».', flag: true, support: 'Raconte les gestes du quotidien et enrichis ses mots.' },
        { text: 'Suit une consigne simple sans geste (« donne le ballon »).', support: 'Donne une consigne courte et remercie-le joyeusement quand il la suit.' },
        { text: 'Marche sans aide.', flag: true, support: 'Offre-lui beaucoup d’occasions de bouger pieds nus dans un espace sûr.' },
        { text: 'T’imite dans les tâches ménagères (balayer, parler au téléphone).', support: 'Donne-lui un petit balai, une dînette, et « travaillez » ensemble.' },
        { text: 'Mange seul avec les doigts et essaie d’utiliser une cuillère.', support: 'Accepte qu’il se salisse et propose des aliments à manger avec les doigts.' },
      ],
    },
    {
      id: 'm30',
      fromMonths: 30,
      title: '2 ans et demi',
      items: [
        { text: 'Dit environ 50 mots.', support: 'Lisez des livres ensemble, nommez les images, pose des questions ouvertes.' },
        { text: 'Associe deux mots dont un verbe (« chat court »).', flag: true, support: 'Transforme son mot en deux : « Voiture. » – « La grosse voiture roule ! »' },
        { text: 'Utilise les mots « moi », « mon », « nous ».', support: 'Dans les jeux chacun son tour, dis « c’est mon tour, c’est ton tour ».' },
        { text: 'Joue à faire semblant (nourrir sa poupée, faire rouler un cube comme une voiture).', flag: true, support: 'Participe au jeu de faire semblant et propose des scénarios simples.' },
        { text: 'Suit une consigne en deux étapes (« prends le jouet et mets-le dans la boîte »).', support: 'Donne les consignes sous forme de jeu et entraînez-vous d’abord avec une étape, puis deux.' },
        { text: 'Saute à pieds joints.', support: 'Des jeux de sauts dehors, le jeu du « petit lapin ».' },
      ],
    },
    {
      id: 'm48',
      fromMonths: 48,
      title: '4 ans',
      items: [
        { text: 'Fait des phrases de 4 mots ou plus.', flag: true, support: 'Parlez de la journée et enrichissez son histoire avec des questions.' },
        { text: 'Raconte quelque chose qui s’est passé dans la journée.', support: 'Le soir, parlez du « meilleur moment de la journée ».' },
        { text: 'Se transforme en quelqu’un d’autre dans le jeu (maîtresse, super-héros).', support: 'Donne-lui du temps et du matériel pour les déguisements et les jeux de rôle.' },
        { text: 'Aime jouer avec d’autres enfants et les console.', flag: true, support: 'Organise de courtes rencontres avec des copains et aide-le à nommer les émotions.' },
        { text: 'Nomme quelques couleurs.', support: 'Nommez les couleurs au quotidien et faites-en un jeu.' },
        { text: 'Attrape le plus souvent un gros ballon et tient un crayon avec les doigts.', support: 'Jeux de ballon, dessin, pâte à modeler.' },
      ],
    },
    {
      id: 'y6',
      fromMonths: 72,
      title: 'Âge scolaire (6–12)',
      items: [
        { text: 'S’occupe en grande partie seul de ses soins quotidiens (s’habiller, se brosser les dents).', support: 'Donne-lui une autonomie adaptée à son âge et soutiens-la avec des routines en images.' },
        { text: 'A au moins un ami et aime jouer avec lui.', flag: true, support: 'Favorise les amitiés et entraînez-vous aux compétences sociales à la maison.' },
        { text: 'Respecte les règles des jeux et sait attendre son tour.', support: 'Jouez en famille à des jeux de société avec des règles.' },
        { text: 'Sait expliquer ses émotions avec des mots.', support: 'Fais de la discussion sur les émotions une habitude quotidienne.' },
        { text: 'Ses compétences en lecture et en calcul progressent au niveau de sa classe.', flag: true, support: 'Reste en contact avec l’enseignant, lisez ensemble et valorise ses efforts.' },
        { text: 'Se calme dans un délai raisonnable après s’être énervé.', support: 'Choisissez ensemble des techniques pour se calmer et entraînez-vous.' },
      ],
    },
  ],
  results: {
    ontrack: {
      title: 'Tout va bien',
      short: 'Ton enfant montre la plupart des compétences attendues à cet âge.',
      detail: [
        'S’il y a quelques réponses « Pas encore », ne t’inquiète pas : les enfants acquièrent certaines compétences un peu plus tard, d’autres plus tôt.',
        'À chaque consultation, pose tes questions sur le développement au médecin – c’est la meilleure façon de le suivre.',
      ],
    },
    watch: {
      title: 'Quelques compétences sont encore en train de se former',
      short: 'Il y a quelques réponses « Pas encore » ou « Je ne suis pas sûr(e) ». Tu peux soutenir ces compétences par le jeu au quotidien.',
      detail: [
        'Soutiens-le pendant 4 à 6 semaines avec les conseils ci-dessous, puis refais la vérification.',
        'Si ton inquiétude persiste, parles-en au pédiatre sans attendre la prochaine consultation. Un soutien précoce vaut toujours mieux que l’attente.',
      ],
    },
    talk: {
      title: 'Nous te conseillons d’en parler au pédiatre',
      short: 'Certaines réponses sont des signaux qu’un médecin doit examiner. Ce n’est pas un diagnostic, mais il n’y a pas de raison d’attendre.',
      detail: [
        'Une perte de compétences (régression) ou un retard sur des étapes importantes nécessite une évaluation précoce. Un accompagnement commencé tôt donne les meilleurs résultats.',
        'Tu peux montrer cette liste au médecin lors de la consultation.',
      ],
    },
  },
  note: 'Cette vérification est un outil de repérage, pas un diagnostic. Si tu es inquiet(ète), consulte un médecin, quel que soit le résultat.',
  sources: [S.zubler2022, S.cdcActEarly],
};
