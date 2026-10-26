/// <reference lib="webworker" />
import { loadGardenLexicon } from './library';
import { generateGardenLevel } from './generator';
import type { WordGardenMode } from './model';

addEventListener('message', async (event: MessageEvent<{ id: string; language: string; level: number; mode: WordGardenMode; revision?: string }>) => {
  const { id, language, level, mode, revision } = event.data;
  try {
    const lexicon = await loadGardenLexicon(language, revision);
    postMessage({ id, level: generateGardenLevel(lexicon, level, mode) });
  } catch (error) {
    postMessage({ id, error: error instanceof Error && /^WORD_GARDEN_/.test(error.message) ? error.message : 'WORD_GARDEN_GENERATION_FAILED' });
  }
});
