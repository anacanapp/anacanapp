import { mkdir, writeFile } from 'node:fs/promises';
import { CHAPTERS } from '../src/game/content';
import { createState, DEFAULT_AVATAR, reducer } from '../src/game/engine';
import type { GameState } from '../src/game/types';

const directory = 'artifacts/native-fixtures';
await mkdir(directory, { recursive: true });
const initial = reducer(createState(), { type: 'START', avatar: DEFAULT_AVATAR, chapter: 0, language: 'az' });
for (const [name, chapter, partial, location] of [['birth', 8, 4, 'clinic'], ['clinic', 1, 2, 'clinic']] as const) {
  const completed = CHAPTERS.slice(0, chapter).flatMap(chapter => chapter.mission.steps.map(s => s.id));
  completed.push(...CHAPTERS[chapter].mission.steps.slice(0, partial).map(s => s.id));
  const fixture: GameState = { ...initial, chapter, unlockedChapter: chapter, location,
    missions: { completed, quality: Object.fromEntries(completed.map(id => [id, 85])), rewards: CHAPTERS.slice(0, chapter).map(c => c.id) },
    pregnancy: { ...initial.pregnancy, birthPlan: 'cesarean' } };
  await writeFile(`${directory}/${name}.json`, JSON.stringify(fixture));
}
console.log('Isolated UI-test fixtures prepared.');
