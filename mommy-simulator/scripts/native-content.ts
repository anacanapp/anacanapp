import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { ACTIVITIES, CHAPTERS, FURNITURE, STORIES } from '../src/game/content';
import { createState } from '../src/game/engine';
import { GROCERY_PRODUCTS } from '../src/game/luzern';

await mkdir('godot/data', { recursive: true });
await writeFile('godot/data/simulation.json', JSON.stringify({ schema: 'mommy-native-content-v1', defaultState: createState(),
  chapters: CHAPTERS, activities: ACTIVITIES, furniture: FURNITURE, stories: STORIES, groceries: GROCERY_PRODUCTS }));
await writeFile('godot/data/catalogue.json', await readFile('public/data/catalogue.json'));
await writeFile('godot/data/provenance.json', await readFile('public/data/provenance.json'));
console.log('Native simulation definitions and public Google catalogue prepared.');
