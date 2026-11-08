import type { MilestoneQuiz, StyleQuiz } from '../types';
import { S } from './sources';

export const STYLE_QUIZ: StyleQuiz = {
  id: 'style',
  emoji: '🪞',
  title: 'My parenting style',
  intro: '12 short statements. Think about the last two weeks and answer honestly — there are no right or wrong answers here. Your result is saved in your account and only you can see it.',
  scale: ['Almost never', 'Sometimes', 'Often', 'Almost always'],
  items: [
    { text: 'When my child is sad or angry, I name the feeling and stay with them.', dim: 'warmth' },
    { text: 'During the day I find time to hug them, laugh together and say “I love you”.', dim: 'warmth' },
    { text: 'When my child talks to me, I put my phone aside and listen.', dim: 'warmth' },
    { text: 'I notice their good behaviour and name it.', dim: 'warmth' },
    { text: 'At home we have a few clear rules that my child knows.', dim: 'structure' },
    { text: 'Once I’ve set a rule, I calmly follow through on it.', dim: 'structure' },
    { text: 'Our daily routine (meals, sleep) is more or less consistent.', dim: 'structure' },
    { text: 'When my child cries or insists, I go back on the “no” I gave.', dim: 'giveIn' },
    { text: 'When I’m tired, I drop the rules completely — “let them do whatever they want”.', dim: 'giveIn' },
    { text: 'When I get upset, I raise my voice or shout.', dim: 'harsh' },
    { text: 'I threaten my child (“I’ll leave you here”, “I’ll call the police”).', dim: 'harsh' },
    { text: 'In moments of anger I feel the urge to hit them or say harsh words, and sometimes I do.', dim: 'harsh' },
  ],
  results: {
    balanced: {
      title: 'Warm and clear',
      short: 'You show love and also set clear limits — the combination research considers the most beneficial.',
      detail: [
        'Psychologists call this style “authoritative”: high warmth and high structure. On average, children raised with this style are more independent and self-confident and manage their feelings better.',
        'This doesn’t mean being perfect. You get tired too, and sometimes your patience runs out. What makes the difference is coming back to the relationship after hard moments.',
      ],
      next: ['As your child grows, start making rules together with them.', 'Don’t forget to look after yourself: to be a calm parent, you need rest.', 'Protect your “special time” habit — it’s your strongest “insurance”.'],
    },
    gentle: {
      title: 'Very warm, gentle limits',
      short: 'You’re very close to your child and sensitive to their feelings. Sometimes holding limits feels hard.',
      detail: [
        'Warmth is your greatest strength, and it’s invaluable for your child’s secure attachment. But children test limits to find out whether they’re still there. When limits soften, children test more — and parents get worn out.',
        'Love and limits don’t contradict each other. Saying “I love you, and the answer is still no” gives your child a sense of safety.',
      ],
      next: ['Choose 3–5 clear family rules and apply them calmly.', 'Show empathy during tantrums, but don’t change your decision.', 'Try the “one sentence, once” step from the “21 days without shouting” programme.'],
    },
    storm: {
      title: 'Loving, but explodes when tired',
      short: 'You’re very attached to your child, but in stressful moments your voice goes up. Lots of parents recognise this.',
      detail: [
        'Your warmth is a strong foundation. Shouting and harsh words are very often the result of tiredness, rushing and being on your own — not a lack of love.',
        'Research shows that regular shouting has a negative effect on children’s behaviour even when the relationship is warm. The good news: self-regulation is a skill that can be learned, and repair conversations protect the relationship.',
      ],
      next: ['Find your triggers: which times of day, which situations?', 'Start with the “pause button” and a long out-breath.', 'The “21 days without shouting” programme is made for you.'],
    },
    strict: {
      title: 'Strong limits, hidden warmth',
      short: 'You value order and rules. Sometimes that comes at the cost of warmth and listening.',
      detail: [
        'Rules and consistency matter for children — this is your strength. But according to research, limits set through harsh control and punishment don’t reduce behaviour problems in the long run — they can even increase them.',
        'You can keep the rules and still add more warmth: explaining, naming feelings, noticing good behaviour.',
      ],
      next: ['10 minutes a day of play led by your child.', 'Use logical consequences instead of punishment.', 'Explain one rule: “We have this rule because…”'],
    },
    stretched: {
      title: 'Tired and drained',
      short: 'It looks like you’ve been very tired lately. That doesn’t make you a bad parent — it’s a signal that you need support.',
      detail: [
        'When a parent is drained, there’s no energy left for either warmth or structure. It’s a very common and understandable situation, especially with a baby, lack of sleep, work and being on your own.',
        'This result isn’t an accusation — it shows that you need care too. Small steps and asking for help can change everything.',
      ],
      next: ['Share the load: agree on specific help with your partner, family or friends.', 'One 5-minute moment of connection a day: just a hug and eye contact.', 'If you’ve felt sad or hopeless for more than two weeks, talk to a doctor or psychologist.'],
    },
  },
  note: 'This quiz isn’t a diagnosis — it’s a simple tool for self-reflection. It’s based on Baumrind’s dimensions of warmth and structure.',
  sources: [S.baumrind1966, S.baumrind1967, S.pinquart2017, S.wangKenny2014],
};

export const MILESTONE_QUIZ: MilestoneQuiz = {
  id: 'milestones',
  emoji: '🧩',
  title: 'What should my child be able to do at this age?',
  intro: 'A short check based on the developmental milestones of the CDC and the American Academy of Pediatrics. Most children (about 3 in 4) show these skills at this age. Every child develops at their own pace.',
  answers: { yes: 'Yes', no: 'Not yet', unsure: 'Not sure' },
  regression: 'Have they lost a skill they used to have (words, play, movement)?',
  checkpoints: [
    {
      id: 'm4',
      fromMonths: 4,
      title: '4 months',
      items: [
        { text: 'Smiles on their own when they see you, tries to get your attention.', flag: true, support: 'Spend lots of time face to face: smile, wait, respond to their smile.' },
        { text: 'Makes sounds like “ah-ah”, “oo-oo”, and makes sounds back when you talk.', support: 'Copy their sounds, then pause so they can “answer”.' },
        { text: 'Turns their head towards the sound of your voice.', flag: true, support: 'Gently call their name from different directions.' },
        { text: 'Holds their head steady without support when being held.', support: 'A few short spells of “tummy time” each day while awake.' },
        { text: 'Holds on to a toy placed in their hand.', support: 'Give light rattles that are easy to grasp.' },
        { text: 'When on their tummy, pushes up on their elbows and lifts their head.', support: 'Put a mirror or a colourful toy in front of them.' },
      ],
    },
    {
      id: 'm9',
      fromMonths: 9,
      title: '9 months',
      items: [
        { text: 'Looks when their name is called.', flag: true, support: 'Use their name often in games, and smile and praise them when they look.' },
        { text: 'Makes different syllables like “ma-ma-ma”, “ba-ba-ba”.', flag: true, support: 'Repeat syllables together, sing songs.' },
        { text: 'Lifts their arms up to be picked up.', support: 'Before picking them up, ask: “Up?” and wait for them to open their arms.' },
        { text: 'Looks for things when they drop out of sight.', support: 'Play peekaboo and “where’s the toy?” games.' },
        { text: 'Sits without support.', support: 'Give safe floor play time, and protect them with cushions while they sit.' },
        { text: 'Is wary of strangers or clings to you.', support: 'This is a sign of attachment. Don’t rush introductions to new people.' },
      ],
    },
    {
      id: 'm18',
      fromMonths: 18,
      title: '18 months',
      items: [
        { text: 'Points to show you something interesting.', flag: true, support: 'Point and name things yourself: “Look, a bird!” Respond eagerly when they point.' },
        { text: 'Says at least 3 words besides “mama” and “dada”.', flag: true, support: 'Talk your way through everyday tasks and expand on their words.' },
        { text: 'Follows a simple instruction without gestures (“give me the ball”).', support: 'Keep instructions short, and thank them happily when they do it.' },
        { text: 'Walks without support.', flag: true, support: 'Give lots of chances to move around barefoot in a safe space.' },
        { text: 'Copies you doing chores (sweeping, talking on the phone).', support: 'Give them a little broom or toy dishes, and “do the chores” together.' },
        { text: 'Feeds themselves with their fingers, tries to use a spoon.', support: 'Let them get messy and offer finger foods.' },
      ],
    },
    {
      id: 'm30',
      fromMonths: 30,
      title: '2½ years',
      items: [
        { text: 'Says about 50 words.', support: 'Read books together, name the pictures, ask open questions.' },
        { text: 'Puts two words together, including a verb (“cat runs”).', flag: true, support: 'Stretch their one word into two: “Car.” — “Big car going!”' },
        { text: 'Uses words like “I”, “me”, “we”.', support: 'In turn-taking games, say “my turn, your turn”.' },
        { text: 'Plays pretend (feeding a doll, driving a block like a car).', flag: true, support: 'Join in their pretend play and suggest simple storylines.' },
        { text: 'Follows two-step instructions (“pick up the toy and put it in the box”).', support: 'Give instructions as a game, practising one step first, then two.' },
        { text: 'Jumps off the ground with both feet.', support: 'Jumping games outdoors, playing “bunnies”.' },
      ],
    },
    {
      id: 'm48',
      fromMonths: 48,
      title: '4 years',
      items: [
        { text: 'Makes sentences of 4 or more words.', flag: true, support: 'Talk about your day and expand their stories with questions.' },
        { text: 'Tells you about something that happened during the day.', support: 'Have a “best moment of the day” chat in the evening.' },
        { text: 'Pretends to be someone else in play (a teacher, a superhero).', support: 'Give time and materials for dressing up and pretend play.' },
        { text: 'Enjoys playing with other children and comforts them.', flag: true, support: 'Arrange short playdates and help them name feelings.' },
        { text: 'Names a few colours.', support: 'Name colours in everyday life and make a game of it.' },
        { text: 'Catches a large ball most of the time, holds a crayon with their fingers.', support: 'Ball games, drawing, play dough.' },
      ],
    },
    {
      id: 'y6',
      fromMonths: 72,
      title: 'School age (6–12)',
      items: [
        { text: 'Mostly handles daily self-care (getting dressed, brushing teeth) on their own.', support: 'Give age-appropriate independence and support it with picture routines.' },
        { text: 'Has at least one friend and enjoys playing with them.', flag: true, support: 'Make room for friendships, and practise social skills at home.' },
        { text: 'Follows the rules of games and can wait for their turn.', support: 'Play board games with rules as a family.' },
        { text: 'Can explain their feelings in words.', support: 'Make talking about feelings an everyday habit.' },
        { text: 'Reading and counting skills are progressing in line with their school year.', flag: true, support: 'Stay in touch with the teacher, read together and appreciate their effort.' },
        { text: 'Calms down within a reasonable time after getting upset.', support: 'Choose and practise calm-down strategies together.' },
      ],
    },
  ],
  results: {
    ontrack: {
      title: 'Everything is on track',
      short: 'Your child is showing most of the skills expected at this age.',
      detail: [
        'If you have some “not yet” answers, don’t worry: children pick up some skills a little later and others earlier.',
        'Ask the doctor your questions about development at every check-up — that’s the best way to keep track.',
      ],
    },
    watch: {
      title: 'A few skills are still developing',
      short: 'There are a few “not yet” or “not sure” answers. You can support these skills through everyday play.',
      detail: [
        'Support them with the tips below for 4–6 weeks, then check again.',
        'If you’re still concerned, talk to your paediatrician without waiting for the next check-up. Early support is always better than waiting.',
      ],
    },
    talk: {
      title: 'We recommend talking to your paediatrician',
      short: 'Some answers are signals a doctor should look at. This isn’t a diagnosis, but there’s no need to wait.',
      detail: [
        'Loss of skills (regression) or delays in key milestones call for an early assessment. Support that starts early gives the best results.',
        'You can show this list to the doctor at your appointment.',
      ],
    },
  },
  note: 'This check isn’t a screening tool or a diagnosis. If you’re concerned, see a doctor whatever the result.',
  sources: [S.zubler2022, S.cdcActEarly],
};
