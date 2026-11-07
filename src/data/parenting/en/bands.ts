import type { BandOverview } from '../types';
import { S } from './sources';

export const BANDS: BandOverview[] = [
  {
    id: '0-1',
    emoji: '👶',
    title: 'The first year: a foundation of trust',
    lead: 'This year your baby learns whether the world is a safe place. The answer comes from your voice, your arms and the way you respond.',
    brain: [
      'In the first years of life, more than a million new neural connections form in the brain every second. Repeated everyday experience decides which pathways get stronger: your baby makes a sound, you answer; they cry, you come close.',
      'The part of a baby’s brain that calms them down is still very immature. That is why your baby can’t settle on their own yet and “borrows” calm from your calm body. This is called co-regulation, and it is the very first lesson in self-regulation.',
      'Around 6–9 months, memory and attachment grow stronger: your baby may start to be wary of strangers and get upset when you leave the room. This isn’t a step backwards — quite the opposite, it’s a sign they are attached to you.',
    ],
    needs: [
      'A response to their crying. At this age you can’t “spoil” a baby or get them “too used to being held”. Responding quickly and kindly teaches them to trust the world.',
      'Face-to-face time: smiles, songs, copying their sounds. These “serve and return” games build the foundations of language and emotional development.',
      'A predictable day: feeding, sleep and bath in roughly the same order. It’s not the exact clock time that matters, but a familiar rhythm.',
      'Safe sleep and a safe environment — and a rested, supported parent.',
    ],
    normal: [
      'Long bouts of crying at certain times of day, especially in the late afternoon and evening, that seem to have no reason (in the first 3–4 months).',
      'Waking often at night. Sleeping through the night in the first year is not the norm for every baby.',
      'Putting everything in their mouth: this is how they explore the world.',
      'Fear of strangers and crying when you’re not there (from around 8 months).',
    ],
    tryThis: [
      'A few times a day, 5 minutes of “face-to-face time”: phone away, copy your baby’s sounds, describe what they’re doing.',
      'Talk your way through everyday tasks: “Now we’re changing your nappy. Legs up. All done!”',
      'Play peekaboo: through this game your baby learns that “what goes away comes back”, and separation anxiety softens.',
      'When the crying goes on and on and your patience runs out, put your baby down somewhere safe — in the cot — take a few minutes to breathe, then come back.',
    ],
    specialist: [
      'If your baby doesn’t react to sounds, doesn’t make eye contact with you, isn’t smiling by 4 months or doesn’t respond to their name by 9 months.',
      'If they lose a skill they used to have (smiling, babbling, sitting).',
      'If their crying is different from usual, or comes with fever, vomiting, unusual drowsiness or refusing feeds: see a doctor. If it’s serious, call {emergency}.',
      'If you’ve felt sad, hopeless or afraid of harming your baby for weeks: this may be postnatal depression, and it can be treated. Tell your doctor.',
    ],
    sources: [S.harvardServe, S.nurturingCare2018, S.ainsworth1978, S.healthyChildrenCrying, S.zubler2022],
  },
  {
    id: '1-3',
    emoji: '🧸',
    title: 'Ages 1–3: the “I do it myself!” stage',
    lead: 'Your child is walking, starting to talk and wants to be independent — but the brain that manages feelings is still very young. That’s where tantrums come from.',
    brain: [
      'The brain’s emotion centre (the amygdala) is strong and fast, while the prefrontal cortex that “puts the brakes on” will keep developing for many years. That’s why a two-year-old can’t stop even when you say “stop”. It isn’t stubbornness — it’s brakes that aren’t finished yet.',
      'Language develops fast, but what a child understands is far ahead of what they can say. Not being able to say what they want is hugely frustrating, and it often comes out as screaming or hitting.',
      'At this age children learn cause and effect by experimenting: they drop the spoon, watch your reaction, drop it again. They’re not trying to wind you up — it’s a little scientist running an experiment.',
    ],
    needs: [
      'Calm, clear limits that stay the same: “No hitting. I’m holding your hands.” Not long explanations — a short sentence and action.',
      'Choices: “Red T-shirt or blue?” Choice meets their need for autonomy and reduces the need to say “no”.',
      'Naming their feelings: “You’re angry because the game is over.” A feeling that has a name settles faster.',
      'A few minutes a day of play they lead, plenty of movement and fresh air.',
    ],
    normal: [
      'Several tantrums a day, especially when tired, hungry or at transition times.',
      'Saying “No!” a lot and asking for the same thing over and over.',
      'Not being able to share. Real sharing develops from around 3–4 years.',
      'Occasional biting or hitting: physical aggression peaks at this age and then gradually declines.',
    ],
    tryThis: [
      'Give a 5-minute warning before transitions: “Two more goes on the slide, then we’re going home.”',
      'Instead of “no”, say what they can do: “Not on the wall — draw on this paper.”',
      '10 minutes a day of “their game”: whatever they do, you do too — no criticism, no barrage of questions.',
      'Notice good behaviour during the day and name it precisely: “You gave the toy to your brother — look how happy he is!”',
    ],
    specialist: [
      'If there’s no pointing at 18 months, no two-word phrases at 2 years, no response to their name or very little eye contact.',
      'If they lose words or skills they used to have (at any age).',
      'If tantrums last longer than 25 minutes, happen more than 5 times a day, cause serious injury to themselves or others, or don’t ease off after age 4.',
      'If sleep, eating or behaviour difficulties disrupt family life for months.',
    ],
    sources: [S.harvardEF2011, S.healthyChildrenTantrums, S.cdcPositive, S.tremblay2004, S.zubler2022],
  },
  {
    id: '3-6',
    emoji: '🎨',
    title: 'Ages 3–6: imagination, questions and rules',
    lead: 'Your child asks “why?”, sets up pretend play and learns about friendship. Self-control grows fast, but they still need your support.',
    brain: [
      'Executive functions — holding attention, waiting for a turn, remembering a rule, switching between ideas — develop rapidly between 3 and 5. Pretend play and games with rules are the best practice for these skills.',
      'Your child begins to understand that other people can think differently. That’s why the first lies appear at this age — interestingly, a sign of cognitive development.',
      'Imagination gets stronger and the line between real and made-up is still blurry. Fear of the dark, of monsters and of bad dreams are typical at this age.',
    ],
    needs: [
      'A few clear family rules, applied consistently. The more predictable the rules, the fewer the arguments.',
      'Logical consequences, not punishment: “If you throw the ball indoors, the ball goes in the cupboard.”',
      'Conversations about feelings: books, play with toys, questions like “how would you feel?”',
      'Real little responsibilities: setting the table, tidying toys, watering a plant.',
    ],
    normal: [
      'Telling the occasional lie and mixing up fantasy and reality.',
      'Testing rules and reacting strongly to “unfairness”.',
      'Being afraid of the dark or of new situations.',
      'Still having tantrums now and then, but shorter and less often than before.',
    ],
    tryThis: [
      'Once a day, ask “What was the best and the hardest moment of your day?” and really listen.',
      'Draw the rules together in pictures and put them up on the wall.',
      'Practise self-control with games like “Red light, green light” or “Simon says”.',
      'When something goes wrong, find the fix together: “The water spilled. What shall we do?”',
    ],
    specialist: [
      'If at 4 they’re not making sentences, strangers find their speech hard to understand, or they show no interest in playmates.',
      'If fears or anxiety disrupt daily life (nursery, sleep, eating) for weeks.',
      'If aggression seriously hurts others or is getting worse; if there is cruelty to animals.',
      'If after being dry for a long time they start wetting again during the day, or lose earlier skills.',
    ],
    sources: [S.diamond2013, S.harvardEF2011, S.talwarLee2008, S.cdcPositive, S.zubler2022],
  },
  {
    id: '6-12',
    emoji: '🎒',
    title: 'Ages 6–12: skills, friendship, self-confidence',
    lead: 'The school years are when a child builds their sense of “I can do it”. Friends become important, but you are still their main anchor.',
    brain: [
      'Planning, attention and self-control are now well developed, but tiredness, hunger and stress easily “switch them off”. An irritable child after school is very often just a drained child.',
      'Children start comparing themselves with others. In this period self-worth is fed mainly by effort, gaining skills and feeling accepted.',
      'Closer to adolescence (around 9–12) hormonal changes may begin: mood swings and a greater need for personal space are normal.',
    ],
    needs: [
      'Encouragement that notices effort and strategy: “You worked really hard on this problem and tried another way.”',
      'Gradually more responsibility and say in decisions, alongside clear family rules.',
      'A parent who listens without judging. If you listen to the small things, they’ll tell you the big things too.',
      'Free time beyond screens and homework: play, sport, friends, sleep.',
    ],
    normal: [
      'Long arguments about fairness and wanting to negotiate rules.',
      'Falling out and making up with friends, and the hurt of “they wouldn’t let me play”.',
      'Avoiding homework and forgetfulness.',
      'Sometimes being embarrassed by their parents or wanting more time alone (especially after 10).',
    ],
    tryThis: [
      'A “no-interrogation chat” time in the car, at meals or before bed: tell them about your day too.',
      'A fixed time and place for homework — but don’t do the homework for them.',
      'Write a family screen plan together: where, when and how much.',
      'Once a week, one-on-one time: just you and them, doing something they choose.',
    ],
    specialist: [
      'Sadness, loss of interest, or big changes in sleep or appetite lasting more than two weeks.',
      'Persistent refusal to go to school, frequent complaints of tummy aches and headaches (when the doctor finds no cause).',
      'Signs of being bullied or bullying others; complete withdrawal from friends.',
      'Self-harm, or talk about death or suicide: never dismiss this as “attention-seeking”. Get professional help straight away, and if there is immediate danger call {emergency}.',
    ],
    sources: [S.cdcPositive, S.aapMediaSchool2016, S.pomerantz2007, S.muellerDweck1998, S.unesco2019],
  },
];
