import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';
import { googleToken } from '../../azure-migration/google-cloud/google-client.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'public/assets/luzern');
const PROJECT = 'ninth-park-492111-m4';
const MODEL = 'gemini-2.5-flash-image';
const REGION = 'global';
const common = 'Premium realistic stylized 3D life simulation game cinematic environment, extremely high quality physically based rendering, realistic wood grain, woven boucle linen upholstery, soft knitted textile microdetail, warm natural morning sunlight, subtle ambient occlusion, beautiful soft shadows, rich but tasteful warm sage green cream oak and peach palette, editorial architectural photography composition, crystal clear sharp details, genuinely inviting lived-in home, contemporary elegant Swiss lakeside townhouse in Lucerne Switzerland, Lake Lucerne and distant Mount Pilatus visible through tall windows. A cohesive modern family home. NO text, NO lettering, NO watermark, NO user interface. Beautiful full frame 16:9 composition.';
const mother = 'A beautiful warmly expressive 29-year-old adult mother, medium light warm olive skin, brown eyes, glossy chestnut brown hair in a loose soft bun with a sage botanical ribbon, soft sage green knitted cardigan over an ivory cotton top, natural attractive facial proportions, tender genuine smile, lifelike rounded 3D animation film character with anatomically correct hands, natural posture. Semi-realistic premium 3D animation art, NOT toy figure, NOT low-poly, NOT a flat cartoon.';
const baby = 'A lovely 6-month-old baby with softly tousled chestnut hair, expressive brown eyes and warm cheeks, wearing an ivory cotton baby sleepsuit with tiny sage botanical patterns, believable baby proportions and beautifully rendered fabric.';

const scenes = [
  { id: 'lakeside-wide', prompt: 'Generate ONE single full-bleed 16:9 panoramic frame, NOT a collage, NOT split screen, NOT multiple images. Very beautiful cinematic photorealistic 3D game environment of Lake Lucerne promenade in Lucerne Switzerland on a sunny calm October morning. Famous Kapellbruecke covered wooden bridge and Water Tower clearly recognizable in middle distance, historic colorful Swiss waterfront roofs, distant Mount Pilatus mountains under soft blue sky, sparkling gentle turquoise lake water, maple foliage with a little autumn gold, wooden lakeside bench and pretty flower planters, generous open stone walking path in foreground. Architecture and landscape completely outdoors. NO interior, NO house, NO people, NO lettering, NO watermark. Beautiful unified eye-level view, exquisite realistic materials and natural lighting.' },
  { id: 'cafe-real', prompt: 'Generate ONE single unified 16:9 full-frame photograph-quality 3D architectural game environment. Interior of a small sophisticated coffee shop overlooking Lake Lucerne in Lucerne Switzerland, clear cafe furnishings: small round wooden bistro tables, sage velvet chairs, brass espresso machine on creamy marble bar, ceramic espresso cups, plates with fresh croissants, elegant pastry display case, pendant lighting, indoor plants and soft linen curtains. Large tall street-front windows looking at Swiss lakeside historic houses and mountains. Gorgeous warm morning sunshine and detailed PBR materials. NOT a home living room. NO sofa, NO fireplace. NO people, NO text, NO watermark, NOT a collage, NOT split-screen.' },
  { id: 'alpine-window', prompt: 'ONE seamless 16:9 scenic photograph-quality backdrop image for the view from a Swiss lakeside home window. Lake Lucerne Switzerland, calm pale turquoise water, distant layered Alps and Mount Pilatus, delicate blue haze, small green hillside and a few beautiful Swiss rooftops in lower foreground. Bright soft morning sun, blue sky with gentle wispy clouds. Whole view is the outdoors from eye level, expansive landscape. NO window frames, NO building interior, NO people, NO text, NO watermark, NO collage. Beautiful cinematic natural realism, a cohesive single image.' },
  { id: 'nursery', prompt: `${common} Interior nursery at eye level, wide full view. Pale sage green panelled walls, natural oak baby crib left with fine wooden rails, wool knitted blankets, cream upholstered nursing armchair right with a peach knitted cushion, low round oak side table in front, woven toy basket, plush bunny and teddy bear, beautiful botanical and animal wall prints, hanging wooden mobile with moon stars and clouds, soft cream floral rug, indoor monstera and trailing pothos plants, warm oak floor, large rear window with translucent sage linen curtains. NO people. Leave central open floor area. The room is lovingly ready for a baby.` },
  { id: 'living', prompt: `${common} Wide elegant living room at eye level, generous deep ivory boucle sofa with textured sage green and terracotta pillows, round solid oak coffee table with tea tray and an open book, cream stone fireplace with softly glowing fire, oak bookshelves, trailing plants, linen floor lamp, personal ceramic objects, tall windows with Lake Lucerne scenery, balcony door, comfortable wool rug and beautiful oak parquet. On side table a few family photographs without visible faces. NO people. A cozy real family living space.` },
  { id: 'kitchen', prompt: `${common} Wide eye-level Swiss family kitchen and dining area, sage green shaker cabinetry, creamy honed stone counter, beautiful brass curved faucet, large window over sink, oak dining table with linen placemats, comfortable woven chairs, stoneware cups, fresh apples pears and vegetables in an oak bowl, linen tea towels, potted herbs, a charming espresso machine, breadboard with sliced fresh bread, pendant lamp, refined natural oak parquet. NO people. Gorgeous clean usable kitchen worktop in foreground.` },
  { id: 'bedroom', prompt: `${common} Wide eye-level adult bedroom with oak double bed, layered ivory and sage linen bedding, textured quilt folded at foot, cream boucle bench, soft warm white bedside lamps, walnut bedside table with open journal and cup, warm oak floor and wool rug, tall windows with view of Swiss lake and mountains, sheer curtains, leafy plant and framed botanical prints. NO people. Realistic calm sanctuary for a mother, warm and refined.` },
  { id: 'bathroom', prompt: `${common} Wide eye-level luxurious but believable family bathroom, creamy travertine tiles, freestanding white bathtub left with folded linen towel and wooden bath tray, oak vanity right with ceramic basin and brass faucet, softly glowing large round mirror, sage towels on wooden rail, soaps in natural bottles without labels, sunlight through frosted window, leafy indoor plants. NO people. Swiss home continuity, peaceful realistic detail.` },
  { id: 'terrace', prompt: `${common} Eye-level wide view from a beautiful private terrace overlooking Lake Lucerne. Solid wood outdoor table with morning coffee and small vase of flowers, two wicker chairs with cream linen cushions, terracotta herb planters, climbing green vines and pale roses, small lawn and children's picnic blanket. Distant snow touched Alps and Mount Pilatus, lake sailboats, pastel Lucerne roofs visible. It is a quiet warm autumn morning, believable Swiss neighborhood. NO people.` },
  { id: 'lakeside', prompt: `${common} Cinematic eye-level panoramic Lake Lucerne promenade in central Luzern, Switzerland, the Chapel Bridge wooden covered bridge and water tower, beautiful authentic pastel historic waterfront buildings and distant Mount Pilatus, gentle turquoise lake reflections, leafy trees with hints of gold, wooden bench, planters, quiet path suitable for a family stroll. Beautiful bright realistic game environment, unobtrusive stylized 3D movie quality. NO people. Luxurious composition with open promenade foreground.` },
  { id: 'market', prompt: `${common} Interior of a small beautiful local Swiss grocery and bakery in Lucerne. Wooden shelves with fresh vegetables, apples, pears, milk bottles and breads, wicker produce baskets, sage green counter with modest register, woven shopping bag in foreground, soft sun through front store window, beautiful tile floor. Cozy neighborhood shop, realistic produce and detailed packaging without text or brands. NO people.` },
  { id: 'cafe', prompt: `${common} Beautiful quiet Swiss lakeside cafe interior in Lucerne, oak bistro tables and sage upholstered chairs, creamy stone countertop, espresso cups and a plate of pastry, trailing plants, big window view of Lake Lucerne and Chapel Bridge, warm golden light and realistic linen napkins, oak floor, elegant small family-friendly space. NO people.` },
  { id: 'clinic', prompt: `${common} Beautiful modern private family maternity clinic consultation room in Lucerne, Swiss clinic with pale sage and ivory interior, natural oak desks, cozy upholstered mother consultation chair, professional ultrasound cart and modern monitor with simple grey abstract scan image, cream examination bed with sage bedding, brass reading lamp, softly frosted tall windows, indoor plants and framed botanical art, believable clean professional equipment. NO people. No medical procedures.` },
  { id: 'feeding', prompt: `${common} ${mother} ${baby} Medium wide shot of the mother sitting in an ivory boucle nursing armchair in the nursery, gently bottle feeding the smiling baby in her arms with a clear baby milk bottle with sage cap. Warm happy eye contact. Crib left, wooden moon star mobile, linen curtains and leafy plants, changing dresser right with folded botanical blankets, plush bunny, peach crochet cushion, warm sunlight. Visually rich close-up focal characters with lovely soft depth of field. Family life simulator hero scene.` },
  { id: 'pregnancy', prompt: `${common} ${mother} The mother is 7 months pregnant with a natural rounded baby bump, sitting comfortably on the ivory sofa in the living room, one hand resting gently on her belly, the other holding a pregnancy journal with blank pages, smiling softly toward the window. Whole upper body and natural hands in view, ivory relaxed pants, real knitted cardigan. Warm realistic indoor sunlight, oak coffee table with tea, beautiful soft throw, lake view. Tender everyday pregnancy moment, gorgeous focal character and environment.` },
  { id: 'changing', prompt: `${common} ${baby} A high-quality gently top-down point-of-view close scene of the happy baby lying on a soft cream changing mat atop oak and ivory dresser in the sage nursery. Baby wearing comfortable ivory and sage botanical sleepsuit, wriggling hands and feet, plush bunny nearby, folded towels, woven storage baskets, the mother's natural adult hands entering subtly from the lower edge holding a clean white diaper with sage tabs. Lovely realistic 3D film quality, correct hands, clean wholesome family caregiving scene, warm soft sun, beautifully detailed fabrics.` },
  { id: 'sleeping', prompt: `${common} ${baby} Close eye-level scene of a peacefully sleeping baby safely resting on its back on a firm cream mattress in a natural oak crib, no loose items around baby, wearing ivory and sage botanical sleeping suit, delicate wooden star mobile overhead at a distance, warm low evening lamplight, sage panel wall, beautiful cozy nursery and soft plant shadows. Lovely cinematic calm 3D film quality, lifelike detailed fabrics, natural small baby.` },
  { id: 'family', prompt: `${common} ${mother} ${baby} And a handsome adult father with short chestnut hair and light warm olive skin, wearing an oatmeal knitted sweater and dark blue relaxed trousers. A loving three-person family on the ivory living room sofa, mother comfortably holding the baby and father looking toward them with warm smile, cozy sage pillows, round oak coffee table, cream fireplace, window showing Lake Lucerne. Natural warm family portrait, realistic beautiful 3D film rendering with textile texture and flattering light.` },
];

await mkdir(output, { recursive: true });
const selected = process.argv.slice(2);
const jobs = selected.length ? scenes.filter(scene => selected.includes(scene.id)) : scenes;
if (!jobs.length) throw new Error('Unknown artwork scene.');
let token = await googleToken('GCP-SERVICE-ACCOUNT-JSON');
if (token.credentialProject !== PROJECT) throw new Error('Wrong Google project.');
let manifest = { schema: 'mommy-luzern-art-v1', project: PROJECT, model: MODEL, assets: [] };
try { manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8')); } catch {}
for (const scene of jobs) {
  const path = join(output, `${scene.id}.webp`);
  if (await stat(path).catch(() => null)) {
    if (!manifest.assets.some(item => item.id === scene.id)) {
      const bytes = await readFile(path), info = await sharp(bytes).metadata();
      manifest.assets.push({ id: scene.id, file: `${scene.id}.webp`, width: info.width, height: info.height, bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'), createdAt: new Date().toISOString(), prompt: scene.prompt });
    }
    console.log(`Artwork exists: ${scene.id}`); continue;
  }
  let response;
  for (let attempt = 0; attempt < 5; attempt++) {
    token = await googleToken('GCP-SERVICE-ACCOUNT-JSON');
    response = await fetch(`https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${REGION}/publishers/google/models/${MODEL}:generateContent`, {
    method: 'POST', headers: { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Generate one image. ' + scene.prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } } }),
    signal: AbortSignal.timeout(150000), redirect: 'error',
    });
    if (response.status !== 429 && response.status !== 503) break;
    await new Promise(resolve => setTimeout(resolve, 18000 * (attempt + 1)));
  }
  if (!response.ok) { const data = await response.json().catch(() => ({})); console.log(JSON.stringify({ scene: scene.id, status: response.status, reason: data.error?.status })); throw new Error(`Artwork generation HTTP ${response.status}`); }
  const data = await response.json(), image = data.candidates?.flatMap(item => item.content?.parts ?? []).find(part => part.inlineData)?.inlineData;
  if (!image) throw new Error(`No generated artwork for ${scene.id}`);
  const source = Buffer.from(image.data, 'base64');
  const { data: bytes, info } = await sharp(source).resize({ width: 1792, withoutEnlargement: true }).webp({ quality: 90, effort: 5 }).toBuffer({ resolveWithObject: true });
  await writeFile(path, bytes);
  manifest.assets = [...manifest.assets.filter(item => item.id !== scene.id), { id: scene.id, file: `${scene.id}.webp`, width: info.width, height: info.height,
    bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), createdAt: new Date().toISOString(), prompt: scene.prompt }];
  console.log(JSON.stringify({ scene: scene.id, width: info.width, height: info.height, bytes: bytes.length, generated: true }));
  manifest.model = MODEL;
  await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await new Promise(resolve => setTimeout(resolve, 9000));
}
manifest.model = MODEL;
await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
