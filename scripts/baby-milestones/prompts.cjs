// 1–12 ay körpə inkişaf mərhələləri üçün Nano Banana promptları.
// Hər şəkil: STYLE (bütün aylar üçün eyni personaj) + ay səhnəsi + NEGATIVE.
// Mərhələlər WHO / CDC "Learn the Signs. Act Early." inkişaf göstəricilərinə əsaslanır.

const STYLE = `
Flat 2D kawaii vector illustration of ONE cute baby, children's app sticker style, clean and minimal.
CHARACTER (must stay identical in every image):
- chubby baby with chibi proportions: big perfectly round head (about 45% of total body height), small soft rounded body, short chubby limbs with soft rounded mitten-like hands and feet
- skin: soft warm peach (#F9CEA6), flat fill, no gradients, no texture
- hair: one small chestnut-brown (#8F5444) tuft on top of the head ending in a single cute curl that drops onto the forehead, otherwise bald
- face: two large glossy dark-brown oval eyes with one small white highlight each (unless the scene says eyes are closed), thin light-brown eyebrows, soft pink round blush on both cheeks (#F6AFA3), tiny button nose implied (no nostrils), small simple mouth; one small rounded ear visible on each side
- clothing: sleeveless light pastel-blue (#D8EEFC) bodysuit top with a tiny white round collar, white fluffy diaper underneath; nothing else unless the scene says so
LINE & COLOR:
- uniform medium-weight warm brown outline (#9A5D49) around every shape, rounded line caps, smooth vector curves
- flat colors only, no shading, no gradients, no gloss except eye highlights, no drop shadows
- palette limited to peach, warm brown, pastel blue, white, soft pink; props only in pastel blue / white / soft peach
COMPOSITION:
- the whole baby fully visible and centered, with generous empty margin (at least 10%) on every side, nothing cropped
- BACKGROUND: perfectly plain pure white (#FFFFFF), completely empty — no floor, no ground line, no shadow, no blanket, no rug, no frame, no vignette
- square 1:1
`.trim();

const NEGATIVE = `
STRICT RULES: exactly one baby; anatomically plausible for the stated age; exactly two arms and two legs; no extra or missing limbs; no fused limbs; hands and feet simple rounded shapes.
NO text, NO letters, NO numbers, NO speech bubbles, NO logos, NO watermark, NO signature.
NO photorealism, NO 3D render, NO painterly texture, NO adults, NO animals, NO background scenery.
`.trim();

const MONTHS = [
  {
    month: 1,
    title_az: '1 ay — yeni doğulmuş, arxası üstə yatır',
    milestone_az: 'Yuxunun çoxunu arxası üstə keçirir, yumruqları sıxılıb, ayaqları qurbağa kimi bükülüdür.',
    scene: `Newborn (1 month old) peacefully SLEEPING lying flat on its BACK (supine, the safe sleep position), seen from the side, head on the left, body horizontal.
IMPORTANT ORIENTATION: the back of the head and the whole spine rest on the ground; the tummy, chest and the front of the diaper face UP toward the top of the image; the face looks up toward the sky / slightly turned toward the viewer, upright and NOT upside down. The baby is NOT on its tummy and NOT curled on its side.
Typical newborn flexed posture: both hands curled into tight little fists resting up on the chest near the chin, elbows bent; both legs bent and drawn up above the tummy in a relaxed "frog" position, knees apart, feet in the air.
Eyes CLOSED drawn as gentle downward-curved arcs, relaxed calm face, tiny closed mouth, cheeks blushing.
Three small pastel-blue "z" shapes floating diagonally above the head are allowed (these are the only symbol allowed).`,
  },
  {
    month: 2,
    title_az: '2 ay — qarınüstə başını qaldırır, ilk sosial təbəssüm',
    milestone_az: 'Qarnı üstə uzananda başını qısa müddət 45° qaldırır, insanlara gülümsəyir.',
    scene: `2-month-old baby during tummy time: lying flat on its TUMMY, seen from the side, head on the left.
The baby lifts its head about 45 degrees off the ground (chin up, but chest still on the ground). Forearms lie flat on the ground in front, elbows bent under the shoulders, small fists loosely open.
Legs lie flat behind, slightly bent, soles of the feet pointing up.
First social smile: eyes are happy closed upward arcs ("^ ^"), small open smiling mouth.`,
  },
  {
    month: 3,
    title_az: '3 ay — dirsəklərə dayanıb başı dik saxlayır',
    milestone_az: 'Qarnı üstə dirsəklərinə dayanır, başı və sinəsi 90°-ə qədər qalxır, oyuncağı gözü ilə izləyir.',
    scene: `3-month-old baby during tummy time, seen from the side, head on the left: propped up on its FOREARMS, elbows directly under the shoulders, upper chest lifted off the ground, head held up firmly and steadily at about 90 degrees, looking forward and slightly up.
Hands are open and relaxed, palms flat on the ground. Legs relaxed flat behind.
Eyes open, big and curious, small happy smile. A small pastel-blue soft ball lies on the ground in front of the baby, which the baby is looking at.`,
  },
  {
    month: 4,
    title_az: '4 ay — oyuncağı tutur, ucadan gülür',
    milestone_az: 'Arxası üstə çınqırağı iki əli ilə tutur, ağzına aparmağa çalışır, qəhqəhə çəkir, ayaqlarını atır.',
    scene: `4-month-old baby lying on its BACK, seen from the side, head on the left, body horizontal.
Both arms reach up above the chest and BOTH hands grasp the handle of a simple pastel-blue baby rattle (a short stick with a round ball on top) held above the face.
Legs lifted and kicking playfully in the air, knees bent.
Laughing out loud: eyes happy closed upward arcs, mouth wide open in a big laugh showing a pink tongue, no teeth.`,
  },
  {
    month: 5,
    title_az: '5 ay — ayaqlarını tutur, yuvarlanmağa başlayır',
    milestone_az: 'Arxası üstə öz ayaq barmaqlarını tutur, qarından arxaya yuvarlanır.',
    scene: `5-month-old baby lying on its BACK, seen from the front-side, discovering its feet: both legs lifted up high, and each hand holding the toes of the foot on the same side.
The body is tilted slightly onto one side as if starting to roll over. Head rests on the ground, turned toward the viewer.
Delighted expression: big open eyes, wide open smiling mouth.
One soft curved pastel-blue motion arc near the back suggests rolling (no arrowhead text).`,
  },
  {
    month: 6,
    title_az: '6 ay — dəstəklə oturur, ilk dişi',
    milestone_az: 'Əllərinə dayanaraq ("üçayaq" vəziyyətində) oturur, ilk alt dişləri çıxır, heca deyir.',
    scene: `6-month-old baby SITTING, facing the viewer, in the classic "tripod sit": leaning slightly forward, both arms straight down in front with both palms pressed on the ground between the legs for support.
Legs spread wide in a V shape in front, slightly bent, soles of the feet facing each other.
Happy babbling face: big open eyes, open smiling mouth showing exactly TWO tiny white lower front teeth.`,
  },
  {
    month: 7,
    title_az: '7 ay — dəstəksiz oturur, oyuncağı əldən-ələ ötürür',
    milestone_az: 'Təkbaşına dik oturur, oyuncağı bir əlindən digərinə keçirir.',
    scene: `7-month-old baby SITTING upright on its own, facing the viewer, back straight, no hand support.
Legs bent in front in a relaxed cross-legged position.
The baby holds a small plain pastel-blue toy cube block (blank faces, no letters) in the left hand and reaches for it with the right hand (transferring it from hand to hand), both hands at chest height in front of the body.
Big curious open eyes looking at the block, cheerful open smile with two tiny lower teeth.`,
  },
  {
    month: 8,
    title_az: '8 ay — əl-dizləri üstə emekləyir',
    milestone_az: 'Əlləri və dizləri üstə emekləyir, ətrafı kəşf edir.',
    scene: `8-month-old baby CRAWLING on hands and knees, drawn in STRICT SIDE PROFILE view (like a dog seen from the side), moving toward the LEFT edge of the image.
Correct crawling anatomy: the torso is HORIZONTAL like a little table top, lifted off the ground with the tummy NOT touching the ground; the head is at the left end of the torso, the diaper/bottom at the right end at the same height as the shoulders.
Under the shoulders: both arms straight and vertical, palms flat on the ground. Under the hips: both thighs vertical with the knees on the ground, and the lower legs lying flat on the ground pointing backward to the right, soles of the feet facing up.
The near-side hand and the far-side knee are slightly forward (mid-step).
Head lifted, face turned three-quarters toward the viewer, big bright eyes, happy open smile with two tiny lower teeth.
The baby is NOT sitting, NOT facing the viewer, NOT lying on its tummy.`,
  },
  {
    month: 9,
    title_az: '9 ay — mebelə tutunub ayağa qalxır',
    milestone_az: 'Mebelə tutunaraq ayağa qalxır, dayanıqlı oturur.',
    scene: `9-month-old baby PULLING UP TO STAND next to a low simple pastel-blue toy box (a plain rounded rectangle box with a white lid, waist-high to the baby, no text, no decoration) placed on the right.
The baby stands on both feet with knees slightly bent and wobbly, body turned three-quarters toward the box, both hands holding firmly onto the top edge of the box.
Proud excited face looking at the viewer: big open eyes, open smiling mouth with two tiny lower teeth.`,
  },
  {
    month: 10,
    title_az: '10 ay — mebel boyunca yeriyir, qısa müddət tək dayanır',
    milestone_az: 'Əlindən tutmadan bir neçə saniyə dayanır, mebel boyunca yan addımlarla yeriyir.',
    scene: `10-month-old baby STANDING ALONE for the first time, facing the viewer, nothing to hold on to.
Wide stance with feet apart and toes slightly outward, knees slightly bent, both arms raised up and out to the sides at shoulder height for balance, hands open.
Concentrated but happy expression: big open eyes, small open "o"-shaped smiling mouth.`,
  },
  {
    month: 11,
    title_az: '11 ay — "bay-bay" edir, ilk sözlər',
    milestone_az: 'Əl yelləyib "bay-bay" edir, "ana", "ata" kimi ilk sözləri deyir.',
    scene: `11-month-old baby standing steadily on its own, facing the viewer, feet slightly apart.
Waving "bye-bye": the right arm is raised up beside the head with the hand open and palm facing the viewer, two short curved pastel-blue motion lines next to the waving hand. The left arm relaxed down by the side.
Joyful talkative expression: big open eyes, wide open smiling mouth with tiny lower and upper front teeth.`,
  },
  {
    month: 12,
    title_az: '12 ay — ilk müstəqil addımlar',
    milestone_az: 'Təkbaşına ilk addımlarını atır, birinci ad günü.',
    scene: `12-month-old baby taking its FIRST INDEPENDENT STEPS, seen from the front-side, walking toward the viewer's right.
Mid-step toddler walk: one leg forward with the foot about to land, the other leg behind, wide wobbly stance, both arms raised up and out to the sides for balance ("high guard" toddler arms).
Wearing a small pastel-blue cone birthday party hat with white polka dots and a white pom-pom, tilted on the head (the hair curl still peeks out).
A few small pastel confetti pieces (pastel blue, soft pink, pale yellow) float around the baby.
Overjoyed expression: big open eyes, wide open laughing mouth with tiny teeth.`,
  },
];

const REFERENCE_PROMPT = `${STYLE}

SCENE: Character reference sheet image — a 6-month-old baby SITTING upright facing the viewer, legs spread in front, hands resting on the knees, neutral happy smile, eyes open. This image defines the character design for a whole series.

${NEGATIVE}`;


// 3D Pixar üslubu (--style=3d): yumşaq studiya render, Anacan Mərcan (#FF5A5F) geyim.
const STYLE_3D = `
High-end 3D animated feature film character render (Pixar / Disney quality) of ONE adorable baby, soft cinematic studio lighting, subsurface-scattering skin, gentle global illumination, crisp clean details, sharp focus, premium quality.
CHARACTER (must stay identical in every image):
- chubby, round, cute baby with a big round head, full rosy cheeks, small button nose, big glossy dark-brown eyes with soft catch-lights and long lashes, soft light-brown eyebrows, small rounded ears
- warm light peach skin with natural pink blush on cheeks, knees and fingertips; soft realistic chubby baby hands and feet with correct number of fingers and toes
- hair: short soft chestnut-brown baby hair, with ONE signature curl twisted into a spiral on top of the head
- clothing: a neat, clean, soft ribbed-cotton baby bodysuit in Anacan CORAL color (exact hue #FF5A5F, a warm vivid coral red-pink), short sleeves, a small henley placket with two tiny white snap buttons, a thin slightly lighter coral trim at the neck and sleeves; the diaper is hidden under the bodysuit; no shoes, no socks, no hat unless the scene says so
- the baby is perfectly clean and tidy: NO food, NO mess, NO stains, NO crumbs
RENDER & COMPOSITION:
- the whole baby fully visible and centered, with generous empty margin (at least 10%) on every side, nothing cropped
- BACKGROUND: perfectly plain pure white (#FFFFFF) seamless studio, completely empty — no floor texture, no horizon line, no props unless the scene says so, NO cast shadow and NO contact shadow on the ground
- square 1:1
- if the scene below mentions outlines, arcs, "z" shapes, motion lines or confetti symbols, IGNORE them — render everything naturally in 3D with no symbols; any props mentioned in the scene are rendered as soft realistic 3D toys in white / pastel colors
`.trim();

const NEGATIVE_3D = `
STRICT RULES: exactly one baby; anatomically correct and physically realistic for the stated age; exactly two arms and two legs; five fingers per hand, five toes per foot; no fused or extra limbs.
NO text, NO letters, NO numbers, NO logos, NO watermark, NO symbols, NO motion lines.
NO flat 2D cartoon, NO outlines, NO photorealistic real-baby photo, NO adults, NO animals, NO background scenery, NO shadow on the ground.
`.trim();

const REFERENCE_PROMPT_3D = `STYLE REFERENCE: the attached image shows the target art style (3D animated film look, skin shading, eyes, signature hair curl, soft lighting). Match that rendering style, but create a NEW clean character sheet image — do NOT copy the food, the mess, the pie, the spoon, the leaf-print clothing or the beige background.

${STYLE_3D}

SCENE: Character reference image — a 6-month-old baby SITTING upright facing the viewer, legs spread in front, hands resting on the knees, sweet happy smile, eyes open. This image defines the character design for a whole series.

${NEGATIVE_3D}`;

function buildPrompt(m, withReference, style = 'flat') {
  const is3d = style === '3d';
  const ref = withReference
    ? `REFERENCE IMAGE: the attached image shows the exact character design. Draw THE SAME baby (same head shape, same hair curl, same eyes, same colors, same clothing, same rendering style) — only the pose, age-appropriate body proportions and expression change as described below. Do NOT copy the reference pose.\n\n`
    : '';
  return `${ref}${is3d ? STYLE_3D : STYLE}\n\nSCENE (${m.month} month${m.month > 1 ? 's' : ''} old — developmental milestone pose; the pose must be physically realistic for a baby of this age):\n${m.scene}\n\n${is3d ? NEGATIVE_3D : NEGATIVE}`;
}

module.exports = { STYLE, NEGATIVE, STYLE_3D, NEGATIVE_3D, MONTHS, REFERENCE_PROMPT, REFERENCE_PROMPT_3D, buildPrompt };
