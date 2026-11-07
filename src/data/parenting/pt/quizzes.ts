import type { MilestoneQuiz, StyleQuiz } from '../types';
import { S } from './sources';

export const STYLE_QUIZ: StyleQuiz = {
  id: 'style',
  emoji: '🪞',
  title: 'Meu estilo de criação',
  intro: '12 frases curtas. Pense nas últimas duas semanas e responda com sinceridade — aqui não há resposta certa ou errada. O resultado fica só no seu celular.',
  scale: ['Quase nunca', 'Às vezes', 'Com frequência', 'Quase sempre'],
  items: [
    { text: 'Quando meu filho está triste ou com raiva, eu dou nome ao que ele sente e fico ao lado dele.', dim: 'warmth' },
    { text: 'Ao longo do dia, encontro tempo para abraçar, rir junto e dizer “eu te amo”.', dim: 'warmth' },
    { text: 'Quando meu filho fala comigo, deixo o celular de lado e escuto.', dim: 'warmth' },
    { text: 'Eu percebo os bons comportamentos dele e digo isso em voz alta.', dim: 'warmth' },
    { text: 'Em casa existem algumas regras claras que meu filho conhece.', dim: 'structure' },
    { text: 'Depois de colocar uma regra, eu a cumpro com calma.', dim: 'structure' },
    { text: 'Nossa rotina diária (refeições, sono) é mais ou menos estável.', dim: 'structure' },
    { text: 'Quando meu filho chora ou insiste, eu volto atrás no “não” que dei.', dim: 'giveIn' },
    { text: 'Quando estou cansado(a), largo todas as regras: “deixa ele fazer o que quiser”.', dim: 'giveIn' },
    { text: 'Quando fico com raiva, levanto a voz ou grito.', dim: 'harsh' },
    { text: 'Eu ameaço meu filho (“vou embora e te deixo aqui”, “vou chamar a polícia”).', dim: 'harsh' },
    { text: 'Nos momentos de raiva, tenho vontade de bater ou de dizer palavras duras — e às vezes faço.', dim: 'harsh' },
  ],
  results: {
    balanced: {
      title: 'Afeto e clareza',
      short: 'Você demonstra amor e, ao mesmo tempo, coloca limites claros — a combinação que os estudos consideram mais benéfica.',
      detail: [
        'Os psicólogos chamam esse estilo de “autoritativo”: muito afeto e muita estrutura. Crianças criadas assim são, em média, mais independentes, mais autoconfiantes e lidam melhor com os sentimentos.',
        'Isso não significa ser perfeito. Você também se cansa, às vezes a paciência acaba. O que faz a diferença é você voltar para a relação depois dos momentos difíceis.',
      ],
      next: ['Conforme a criança cresce, comece a criar as regras junto com ela.', 'Não se esqueça de cuidar de você: para ter calma, é preciso descansar.', 'Proteja o hábito do “tempo especial” — é o “seguro” mais poderoso.'],
    },
    gentle: {
      title: 'Muito afeto, limites frouxos',
      short: 'Você tem uma relação muito próxima com a criança e é sensível aos sentimentos dela. Às vezes é difícil manter os limites.',
      detail: [
        'O afeto é o seu ponto mais forte, e ele é insubstituível para um apego seguro. Mas as crianças testam os limites para saber se eles continuam no lugar. Quando o limite amolece, a criança testa mais — e os pais se esgotam.',
        'Amor e limite não são opostos. Dizer “eu te amo, e a resposta continua sendo não” dá segurança à criança.',
      ],
      next: ['Escolha 3–5 regras claras para a família e aplique com calma.', 'Na birra, mostre empatia, mas não mude a decisão.', 'Teste o passo “Uma frase, uma vez” do programa “21 dias sem gritar”.'],
    },
    storm: {
      title: 'Muito amor, mas explosões nos momentos de cansaço',
      short: 'Você tem um vínculo forte com a criança, mas nos momentos de estresse a voz sobe. É uma situação que muitos pais reconhecem.',
      detail: [
        'O seu afeto é uma base forte. Já os gritos e as palavras duras muitas vezes são resultado do cansaço, da pressa e da solidão — não da falta de amor.',
        'Estudos mostram que, mesmo quando a relação é afetuosa, gritar com frequência afeta negativamente o comportamento da criança. A boa notícia: a autorregulação é uma habilidade que se aprende, e as conversas de reparação protegem a relação.',
      ],
      next: ['Encontre seus gatilhos: em que horários, em que situações?', 'Comece pelo “botão de pausa” e pela expiração longa.', 'O programa “21 dias sem gritar” é feito para você.'],
    },
    strict: {
      title: 'Limites fortes, afeto escondido',
      short: 'Você valoriza ordem e regras. Às vezes isso acontece às custas do afeto e da escuta.',
      detail: [
        'Regras e constância são importantes para a criança — esse é o seu ponto forte. Mas, segundo os estudos, limites impostos com controle rígido e castigo não diminuem os problemas de comportamento a longo prazo; pelo contrário, podem aumentá-los.',
        'Dá para aumentar o afeto mantendo as regras: explicando, dando nome aos sentimentos, reparando no bom comportamento.',
      ],
      next: ['Todo dia, 10 minutos de brincadeira conduzida pela criança.', 'Em vez de castigo, use consequências lógicas.', 'Explique uma regra: “Essa regra existe porque…”'],
    },
    stretched: {
      title: 'No limite das forças',
      short: 'Parece que você anda muito cansado(a) ultimamente. Isso não é ser um mau pai ou uma má mãe: é um sinal de que você precisa de apoio.',
      detail: [
        'Quando os pais estão esgotados, não sobra força nem para o afeto nem para a estrutura. É uma situação muito comum e compreensível, principalmente quando há um bebê, falta de sono, trabalho e solidão.',
        'Este resultado não é uma acusação: mostra que você também precisa de cuidado. Pequenos passos e pedir ajuda podem mudar tudo.',
      ],
      next: ['Divida a carga: combine uma ajuda concreta com o parceiro, a família ou os amigos.', 'Um momento de conexão de 5 minutos por dia: só abraço e olho no olho.', 'Se há mais de duas semanas você sente tristeza ou desesperança, converse com um médico ou psicólogo.'],
    },
  },
  note: 'Este teste não é um diagnóstico, e sim uma ferramenta simples de auto-observação. Ele se baseia nas dimensões de afeto e estrutura de Baumrind.',
  sources: [S.baumrind1966, S.baumrind1967, S.pinquart2017, S.wangKenny2014],
};

export const MILESTONE_QUIZ: MilestoneQuiz = {
  id: 'milestones',
  emoji: '🧩',
  title: 'O que meu filho deveria saber fazer nesta idade?',
  intro: 'Uma checagem rápida baseada nos marcos do desenvolvimento do CDC e da Academia Americana de Pediatria. A maioria das crianças (cerca de 3 em cada 4) mostra essas habilidades nesta idade. Cada criança se desenvolve no seu próprio ritmo.',
  answers: { yes: 'Sim', no: 'Ainda não', unsure: 'Não tenho certeza' },
  regression: 'Perdeu alguma habilidade que já tinha (palavras, brincadeiras, movimentos)?',
  checkpoints: [
    {
      id: 'm4',
      fromMonths: 4,
      title: '4 meses',
      items: [
        { text: 'Sorri sozinho quando vê você e tenta chamar sua atenção.', flag: true, support: 'Passe bastante tempo cara a cara: sorria, espere e responda ao sorriso dele.' },
        { text: 'Faz sons como “a-a” e “u-u” e responde com sons quando você fala.', support: 'Imite os sons dele e depois faça uma pausa para ele “responder”.' },
        { text: 'Vira a cabeça na direção da sua voz quando a ouve.', flag: true, support: 'Chame o nome dele com voz suave de lados diferentes.' },
        { text: 'No colo, mantém a cabeça firme sem apoio.', support: 'Enquanto ele estiver acordado, alguns momentos curtos de bruços por dia.' },
        { text: 'Pega e segura um brinquedo colocado na mão dele.', support: 'Ofereça chocalhos leves e fáceis de segurar.' },
        { text: 'De bruços, apoia-se nos cotovelos e levanta a cabeça.', support: 'Coloque um espelho ou um brinquedo colorido na frente dele.' },
      ],
    },
    {
      id: 'm9',
      fromMonths: 9,
      title: '9 meses',
      items: [
        { text: 'Olha quando é chamado pelo nome.', flag: true, support: 'Use o nome dele com frequência nas brincadeiras e, quando ele olhar, sorria e elogie.' },
        { text: 'Diz sílabas variadas, como “ma-ma-ma” e “ba-ba-ba”.', flag: true, support: 'Repitam as sílabas juntos, cante músicas.' },
        { text: 'Levanta os braços para pedir colo.', support: 'Antes de pegar, pergunte: “Colo?” e espere ele abrir os braços.' },
        { text: 'Acompanha com o olhar um objeto que cai e procura por ele.', support: 'Brinque de esconde-achou e de “cadê o brinquedo?”.' },
        { text: 'Senta sem apoio.', support: 'Dê tempo de brincadeira segura no chão e proteja com almofadas enquanto ele senta.' },
        { text: 'Estranha pessoas desconhecidas ou se agarra a você.', support: 'Isso é sinal de apego. Não apresse a aproximação com pessoas novas.' },
      ],
    },
    {
      id: 'm18',
      fromMonths: 18,
      title: '18 meses',
      items: [
        { text: 'Aponta com o dedo para mostrar algo interessante para você.', flag: true, support: 'Aponte também e diga o nome: “Olha, um passarinho!” Quando ele apontar, responda com entusiasmo.' },
        { text: 'Fala pelo menos 3 palavras além de “mamãe” e “papai”.', flag: true, support: 'Faça as tarefas do dia conversando e amplie as palavras dele.' },
        { text: 'Segue uma instrução simples sem gestos (“me dá a bola”).', support: 'Diga a instrução de forma curta e, quando ele fizer, agradeça com alegria.' },
        { text: 'Anda sem apoio.', flag: true, support: 'Dê bastante oportunidade de se movimentar descalço, num espaço seguro.' },
        { text: 'Imita você nas tarefas de casa (varrer, falar ao telefone).', support: 'Dê uma vassourinha ou panelinhas de brinquedo e “trabalhem” juntos.' },
        { text: 'Come sozinho com os dedos e tenta usar a colher.', support: 'Deixe ele se sujar e ofereça comidas para pegar com a mão.' },
      ],
    },
    {
      id: 'm30',
      fromMonths: 30,
      title: '2 anos e meio',
      items: [
        { text: 'Fala cerca de 50 palavras.', support: 'Leiam livros juntos, digam o nome das figuras, faça perguntas abertas.' },
        { text: 'Junta duas palavras, sendo uma delas um verbo (“gato corre”).', flag: true, support: 'Transforme a palavra dele em duas: “Carro.” — “Olha o carro grande passando!”' },
        { text: 'Usa as palavras “eu”, “meu”, “a gente”.', support: 'Nas brincadeiras de revezar, diga “minha vez, sua vez”.' },
        { text: 'Brinca de faz de conta (dar comida para a boneca, empurrar um bloco como se fosse um carro).', flag: true, support: 'Entre no faz de conta e sugira histórias simples.' },
        { text: 'Segue uma instrução de dois passos (“pega o brinquedo e coloca na caixa”).', support: 'Dê as instruções brincando e treine primeiro com um passo, depois com dois.' },
        { text: 'Pula do chão com os dois pés.', support: 'Brincadeiras de pular ao ar livre, brincar de “coelhinho”.' },
      ],
    },
    {
      id: 'm48',
      fromMonths: 48,
      title: '4 anos',
      items: [
        { text: 'Forma frases com 4 palavras ou mais.', flag: true, support: 'Conversem sobre o dia e ampliem a história dela com perguntas.' },
        { text: 'Conta algo que aconteceu durante o dia.', support: 'À noite, conversem sobre “o melhor momento do dia”.' },
        { text: 'Na brincadeira, vira outra pessoa (professora, super-herói).', support: 'Dê tempo e materiais para fantasias e faz de conta.' },
        { text: 'Gosta de brincar com outras crianças e as consola.', flag: true, support: 'Organize encontros curtos com amigos e ajude a dar nome aos sentimentos.' },
        { text: 'Diz o nome de várias cores.', support: 'Digam o nome das cores no dia a dia e transformem isso em brincadeira.' },
        { text: 'Pega uma bola grande na maioria das vezes e segura o lápis com os dedos.', support: 'Brincadeiras de bola, desenho, massinha.' },
      ],
    },
    {
      id: 'y6',
      fromMonths: 72,
      title: 'Idade escolar (6–12)',
      items: [
        { text: 'Faz sozinha quase todo o autocuidado do dia a dia (se vestir, escovar os dentes).', support: 'Dê autonomia adequada à idade e apoie com rotinas ilustradas.' },
        { text: 'Tem pelo menos um amigo e gosta de brincar com ele.', flag: true, support: 'Abra espaço para as amizades e treinem as habilidades sociais em casa.' },
        { text: 'Segue as regras dos jogos e consegue esperar a vez.', support: 'Joguem em família jogos de tabuleiro com regras.' },
        { text: 'Consegue explicar com palavras o que sente.', support: 'Faça da conversa sobre sentimentos um hábito diário.' },
        { text: 'Avança em leitura e contas de acordo com a série.', flag: true, support: 'Mantenha contato com a professora, leiam juntos, valorize o esforço.' },
        { text: 'Depois de ficar nervosa, se acalma num tempo razoável.', support: 'Escolham juntos formas de se acalmar e treinem.' },
      ],
    },
  ],
  results: {
    ontrack: {
      title: 'Tudo no caminho certo',
      short: 'A criança mostra a maioria das habilidades esperadas para esta idade.',
      detail: [
        'Se houver respostas “Ainda não”, não se preocupe: as crianças adquirem algumas habilidades um pouco mais tarde e outras mais cedo.',
        'Em toda consulta, faça ao médico as suas perguntas sobre o desenvolvimento — essa é a melhor forma de acompanhar.',
      ],
    },
    watch: {
      title: 'Algumas habilidades ainda estão se formando',
      short: 'Há algumas respostas “Ainda não” ou “Não tenho certeza”. Você pode apoiar essas habilidades com brincadeiras do dia a dia.',
      detail: [
        'Apoie por 4–6 semanas com as dicas abaixo e faça a checagem de novo.',
        'Se a preocupação continuar, converse com o pediatra sem esperar a próxima consulta. Apoiar cedo é sempre melhor do que esperar.',
      ],
    },
    talk: {
      title: 'Recomendamos conversar com o pediatra',
      short: 'Algumas respostas são sinais que um médico deve avaliar. Não é um diagnóstico, mas não é preciso esperar.',
      detail: [
        'A perda de habilidades (regressão) ou o atraso em marcos importantes pedem uma avaliação precoce. O apoio que começa cedo traz os melhores resultados.',
        'Quando for ao médico, você pode mostrar esta lista.',
      ],
    },
  },
  note: 'Esta checagem é uma ferramenta de triagem, não um diagnóstico. Se algo te preocupa, procure o médico, seja qual for o resultado.',
  sources: [S.zubler2022, S.cdcActEarly],
};
