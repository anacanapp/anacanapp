import { canSpellWord, wordsFromRack, type CompiledLexicon, type CompiledWord } from './lexicon';
import { getGardenLevelProfile, gardenTimeLimit, cellKey, type GardenCell, type GardenWord, type WordGardenLevel, type WordGardenMode } from './model';

export function gardenSeed(value: string): number {
  let hash = 2166136261;
  for (const letter of value) hash = Math.imul(hash ^ letter.codePointAt(0)!, 16777619);
  return hash >>> 0;
}
export function gardenRandom(seed: number) {
  let state = seed;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
export function shuffleLetters<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const next = Math.floor(random() * (index + 1));
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}
interface Rack { root: CompiledWord; words: CompiledWord[] }
const rackCache = new WeakMap<CompiledLexicon, Map<string, Rack[]>>();
function racksFor(lexicon: CompiledLexicon, length: number, minimum = 3): Rack[] {
  let cached = rackCache.get(lexicon);
  if (!cached) { cached = new Map(); rackCache.set(lexicon, cached); }
  const key = `${length}:${minimum}`;
  if (cached.has(key)) return cached.get(key)!;
  const seen = new Set<string>(), racks: Rack[] = [];
  const possible = lexicon.targets.filter(word => word.letters.length === length)
    // Code-point tie breaking stays identical across browser/ICU versions.
    .sort((a, b) => Number(b.tier === 'common') - Number(a.tier === 'common') || b.frequency - a.frequency || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
  for (const root of possible) {
    if (seen.has(root.signature)) continue;
    const words = wordsFromRack(lexicon, root.letters);
    if (words.filter(word => word.tier !== 'bonus').length < minimum) continue;
    seen.add(root.signature); racks.push({ root, words });
  }
  cached.set(key, racks);
  return racks;
}
interface Placed extends GardenWord { letters: string[] }
interface WorkingCell extends GardenCell { across: boolean; down: boolean }
const point = (word: Pick<Placed, 'row' | 'column' | 'direction'>, index: number) => ({
  row: word.row + (word.direction === 'down' ? index : 0), column: word.column + (word.direction === 'across' ? index : 0),
});
function bounds(cells: Iterable<Pick<GardenCell, 'row' | 'column'>>) {
  const values = [...cells];
  return { minRow: Math.min(...values.map(cell => cell.row)), maxRow: Math.max(...values.map(cell => cell.row)),
    minColumn: Math.min(...values.map(cell => cell.column)), maxColumn: Math.max(...values.map(cell => cell.column)) };
}
function canPlace(word: Placed, board: Map<string, WorkingCell>) {
  const step = word.direction === 'across' ? { row: 0, column: 1 } : { row: 1, column: 0 };
  if (board.has(cellKey({ row: word.row - step.row, column: word.column - step.column }))
    || board.has(cellKey(point(word, word.letters.length)))) return false;
  let intersections = 0;
  for (const [index, letter] of word.letters.entries()) {
    const here = point(word, index), existing = board.get(cellKey(here));
    if (existing) {
      if (existing.letter !== letter || existing[word.direction]) return false;
      intersections++;
    } else {
      const perpendicular = word.direction === 'across' ? { row: 1, column: 0 } : { row: 0, column: 1 };
      if ([-1, 1].some(sign => board.has(cellKey({ row: here.row + perpendicular.row * sign, column: here.column + perpendicular.column * sign })))) return false;
    }
  }
  if (board.size && !intersections) return false;
  const box = bounds([...board.values(), ...word.letters.map((_, index) => point(word, index))]);
  return box.maxRow - box.minRow < 11 && box.maxColumn - box.minColumn < 11;
}
function place(word: Placed, board: Map<string, WorkingCell>) {
  for (const [index, letter] of word.letters.entries()) {
    const position = point(word, index), key = cellKey(position), existing = board.get(key);
    board.set(key, { ...position, letter, wordIds: [...(existing?.wordIds || []), word.id],
      across: word.direction === 'across' || existing?.across || false, down: word.direction === 'down' || existing?.down || false });
  }
}
function layout(root: CompiledWord, candidates: CompiledWord[], target: number, random: () => number) {
  const board = new Map<string, WorkingCell>(), placed: Placed[] = [];
  const first: Placed = { id: root.word, word: root.word, letters: root.letters, row: 0, column: 0,
    direction: random() > 0.5 ? 'across' : 'down', definition: root.definition };
  place(first, board); placed.push(first);
  let remaining = shuffleLetters(candidates.filter(word => word.word !== root.word), random);
  // Each placement joins the connected crossword and avoids accidental parallel
  // words. Bounded retries guarantee a responsive worker even on a small library.
  for (let pass = 0; pass < 2 && placed.length < target; pass++) {
    const unused: CompiledWord[] = [];
    for (const candidate of remaining) {
      if (placed.length >= target) { unused.push(candidate); continue; }
      const options: { word: Placed; score: number }[] = [];
      for (const cell of board.values()) for (const [index, letter] of candidate.letters.entries()) {
        if (letter !== cell.letter) continue;
        for (const direction of ['across', 'down'] as const) {
          const word: Placed = { id: candidate.word, word: candidate.word, letters: candidate.letters, direction,
            row: cell.row - (direction === 'down' ? index : 0), column: cell.column - (direction === 'across' ? index : 0), definition: candidate.definition };
          if (!canPlace(word, board)) continue;
          const box = bounds([...board.values(), ...word.letters.map((_, i) => point(word, i))]);
          const rows = box.maxRow - box.minRow + 1, columns = box.maxColumn - box.minColumn + 1;
          options.push({ word, score: rows * columns + Math.abs(rows - columns) * 2 + random() * 8 });
        }
      }
      options.sort((a, b) => a.score - b.score);
      if (options.length) { place(options[0].word, board); placed.push(options[0].word); }
      else unused.push(candidate);
    }
    remaining = unused;
  }
  const box = bounds(board.values());
  return {
    words: placed.map(word => ({ ...word, row: word.row - box.minRow, column: word.column - box.minColumn })),
    cells: [...board.values()].map(({ across: _across, down: _down, ...cell }) => ({ ...cell,
      row: cell.row - box.minRow, column: cell.column - box.minColumn })).sort((a, b) => a.row - b.row || a.column - b.column),
    rows: box.maxRow - box.minRow + 1, columns: box.maxColumn - box.minColumn + 1,
  };
}
function rankCandidates(rack: Rack, level: number, random: () => number) {
  return rack.words.filter(word => word.tier !== 'bonus' && (level > 40 || word.tier === 'common' || word.frequency >= 90))
    .map(word => ({ word, rank: (word.tier === 'common' ? 100 : 0) + word.frequency / 5 + random() * 35 }))
    .sort((a, b) => b.rank - a.rank).map(value => value.word).slice(0, 20);
}
// Published v1 puzzles must remain reproducible while an unfinished save resumes.
function generateLegacyGardenLevel(lexicon: CompiledLexicon, level: number, mode: WordGardenMode): WordGardenLevel {
  const profile = getGardenLevelProfile(level);
  if (!['calm', 'timed'].includes(mode)) throw new Error('WORD_GARDEN_MODE_INVALID');
  const seed = gardenSeed(`${lexicon.data.language}:${lexicon.data.revision}:${mode}:${level}`), random = gardenRandom(seed);
  let racks = racksFor(lexicon, profile.rackLength);
  // A language can grow independently: use its richest shorter rack bucket rather
  // than inventing a word or loading another language when its vocabulary is small.
  for (let length = profile.rackLength - 1; !racks.length && length >= 4; length--) racks = racksFor(lexicon, length);
  if (!racks.length) throw new Error('WORD_GARDEN_LIBRARY_RACKS_REQUIRED');
  const opening = mode === 'calm' && level <= lexicon.data.openingRacks.length
    ? racks.find(rack => rack.root.word === lexicon.data.openingRacks[level - 1]) : null;
  const pool = level <= 20 ? racks.filter(rack => rack.root.tier === 'common') : racks;
  const available = pool.length ? pool : racks;
  const initialIndex = (level - 1 + gardenSeed(`${lexicon.data.revision}:${mode}:racks`)) % available.length;
  let best: ReturnType<typeof layout> | null = null, chosen: Rack | null = null;
  for (let attempt = 0; attempt < Math.min(12, available.length); attempt++) {
    const rack = attempt === 0 && opening ? opening : available[(initialIndex + attempt) % available.length];
    const candidates = rankCandidates(rack, level, random);
    const result = layout(rack.root, candidates, profile.targetWords, random);
    if (!best || result.words.length > best.words.length) { best = result; chosen = rack; }
    if (result.words.length >= profile.targetWords || opening && attempt === 0 && result.words.length >= 3) break;
  }
  if (!best || !chosen || best.words.length < 3) throw new Error('WORD_GARDEN_CONNECTED_LEVEL_REQUIRED');
  const targets = new Set(best.words.map(word => word.word));
  const bonusWords = chosen.words.filter(word => !targets.has(word.word)).map(word => word.word).sort();
  const letters = shuffleLetters(chosen.root.letters, random);
  return { schema: 'anacan-word-garden-level-v1', language: lexicon.data.language, revision: lexicon.data.revision,
    level, mode, seed, id: `${lexicon.data.language}:${lexicon.data.revision}:${mode}:${level}:${seed}`,
    ...best, letters, bonusWords, difficulty: profile.difficulty,
    timeLimit: mode === 'timed' ? 60 + best.words.length * 18 + profile.rackLength * 5 : null };
}
type Layout = ReturnType<typeof layout>;
interface GardenCard { rack: Rack; puzzle: Layout }
const deckCache = new WeakMap<CompiledLexicon, Map<string, GardenCard[]>>();
const tierStart = (difficulty: WordGardenLevel['difficulty']) => [1, 11, 41, 101, 221][difficulty - 1];
function variedDeck(lexicon: CompiledLexicon, difficulty: WordGardenLevel['difficulty'], mode: WordGardenMode, cycle = 0): GardenCard[] {
  let cache = deckCache.get(lexicon);
  if (!cache) { cache = new Map(); deckCache.set(lexicon, cache); }
  const key = `${mode}:${difficulty}:${cycle}`;
  if (cache.has(key)) return cache.get(key)!;
  const start = tierStart(difficulty), profile = getGardenLevelProfile(start), minimum = difficulty === 1 ? 2 : 3;
  const baseline = cycle ? variedDeck(lexicon, difficulty, mode) : null;
  let racks = racksFor(lexicon, profile.rackLength, minimum);
  for (let length = profile.rackLength - 1; !racks.length && length >= 4; length--) racks = racksFor(lexicon, length, minimum);
  const familiar = difficulty <= 2 ? racks.filter(rack => rack.root.tier === 'common') : [];
  const available = baseline ? baseline.map(card => card.rack) : familiar.length >= 10 ? familiar : racks;
  const cards: { rack: Rack; variants: Layout[]; rank: number }[] = [];
  const random = gardenRandom(gardenSeed(`${lexicon.data.revision}:${mode}:${difficulty}:${cycle}:variety-deck`));
  for (const rack of available) {
    const candidates = rack.words.filter(word => word.tier !== 'bonus'
      && (difficulty > 2 || word.tier === 'common' || word.frequency >= 70));
    const variants: Layout[] = [], signatures = new Set<string>();
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = layout(rack.root, candidates, difficulty === 5 ? 8 : profile.targetWords, random);
      const signature = result.words.map(word => word.word).sort().join('|');
      if (result.words.length < minimum || signatures.has(signature)) continue;
      variants.push(result); signatures.add(signature);
    }
    const fallback = baseline?.find(card => card.rack === rack)?.puzzle;
    if (!variants.length && fallback) variants.push(fallback);
    if (variants.length) cards.push({ rack, variants, rank: random() });
  }
  if (!cards.length) throw new Error('WORD_GARDEN_LIBRARY_RACKS_REQUIRED');
  // Each rack is dealt once before recycling. Prefer answers absent from the last
  // six puzzles instead of repeatedly falling through to the richest next rack.
  // Stable bookends join independent cycles without recursive history generation
  // even at level2,147,483,647; the interior is newly shuffled and laid out.
  const prefix = baseline?.slice(0, 3) || [], suffix = baseline?.slice(-3) || [];
  const reserved = new Set([...prefix, ...suffix].map(card => card.rack));
  for (let index = cards.length - 1; index >= 0; index--) if (reserved.has(cards[index].rack)) cards.splice(index, 1);
  const history: string[][] = prefix.map(card => card.puzzle.words.map(word => word.word)), deck: GardenCard[] = [...prefix];
  if (!baseline && difficulty > 1) for (let level = start - 6; level < start; level++) {
    history.push(generateGardenLevel(lexicon, level, mode).words.map(word => word.word));
  }
  while (cards.length) {
    let chosenIndex = 0, chosenVariant = cards[0].variants[0], bestScore = Infinity;
    for (const [index, card] of cards.entries()) for (const variant of card.variants) {
      const words = variant.words.map(word => word.word);
      const overlap = history.slice(-6).reduce((score, recent, age, values) => score
        + words.filter(word => recent.includes(word)).length * (age === values.length - 1 ? 1000 : (age + 1) * 12), 0);
      const closing = cards.length <= 4 ? (suffix.length ? suffix.slice(0, 1) : deck.slice(0, 2)).reduce((score, first) => score
        + words.filter(word => first.puzzle.words.some(answer => answer.word === word)).length * (cards.length === 1 ? 1000 : 35), 0) : 0;
      const score = overlap + closing + Math.max(0, profile.targetWords - words.length) * 2 + card.rank;
      if (score < bestScore) { bestScore = score; chosenIndex = index; chosenVariant = variant; }
    }
    const [chosen] = cards.splice(chosenIndex, 1);
    deck.push({ rack: chosen.rack, puzzle: chosenVariant }); history.push(chosenVariant.words.map(word => word.word));
    if (history.length > 6) history.shift();
  }
  deck.push(...suffix);
  cache.set(key, deck);
  if (cache.size > 24) for (const oldKey of cache.keys()) {
    if (!oldKey.endsWith(':0') && oldKey !== key) { cache.delete(oldKey); break; }
  }
  return deck;
}
export function generateGardenLevel(lexicon: CompiledLexicon, level: number, mode: WordGardenMode = 'calm'): WordGardenLevel {
  const profile = getGardenLevelProfile(level);
  if (!['calm', 'timed'].includes(mode)) throw new Error('WORD_GARDEN_MODE_INVALID');
  if (lexicon.data.revision === 'az-202610-v1') return generateLegacyGardenLevel(lexicon, level, mode);
  const seed = gardenSeed(`${lexicon.data.language}:${lexicon.data.revision}:${mode}:${level}`), random = gardenRandom(seed);
  const initial = variedDeck(lexicon, profile.difficulty, mode), offset = level - tierStart(profile.difficulty);
  const deck = variedDeck(lexicon, profile.difficulty, mode, Math.floor(offset / initial.length));
  const openingWord = profile.difficulty === 1 ? lexicon.data.openingRacks[level - 1] : undefined;
  const card = deck.find(card => openingWord && card.rack.root.word === openingWord)
    || deck[offset % deck.length];
  const targetWords = card.puzzle.words.slice(0, profile.targetWords);
  const candidates = targetWords.map(word => lexicon.words.get(word.word)!);
  let best: Layout | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = layout(card.rack.root, candidates, targetWords.length, random);
    if (result.words.length === targetWords.length
      && (!best || result.rows * result.columns + Math.abs(result.rows - result.columns) * 3
        < best.rows * best.columns + Math.abs(best.rows - best.columns) * 3)) best = result;
  }
  // The pre-verified connected template is a bounded fallback, never another rack.
  if (!best) {
    const board = new Map<string, WorkingCell>();
    for (const word of targetWords) place(word, board);
    const box = bounds(board.values());
    best = { words: targetWords.map(word => ({ ...word, row: word.row - box.minRow, column: word.column - box.minColumn })),
      cells: [...board.values()].map(({ across: _across, down: _down, ...cell }) => ({ ...cell,
        row: cell.row - box.minRow, column: cell.column - box.minColumn })).sort((a, b) => a.row - b.row || a.column - b.column),
      rows: box.maxRow - box.minRow + 1, columns: box.maxColumn - box.minColumn + 1 };
  }
  const targets = new Set(best.words.map(word => word.word));
  return { schema: 'anacan-word-garden-level-v1', language: lexicon.data.language, revision: lexicon.data.revision,
    level, mode, seed, id: `${lexicon.data.language}:${lexicon.data.revision}:${mode}:${level}:${seed}`,
    ...best, letters: shuffleLetters(card.rack.root.letters, random),
    bonusWords: card.rack.words.filter(word => !targets.has(word.word)).map(word => word.word).sort(),
    difficulty: profile.difficulty, timeLimit: mode === 'timed' ? gardenTimeLimit(best.words, card.rack.root.letters.length, profile.difficulty) : null };
}
export function validateGardenLevel(level: WordGardenLevel, lexicon: CompiledLexicon): boolean {
  if (level.language !== lexicon.data.language || level.revision !== lexicon.data.revision || level.words.length < (level.difficulty === 1 ? 2 : 3)
    || level.words.length > 8 || new Set(level.words.map(word => word.word)).size !== level.words.length
    || level.rows > 11 || level.columns > 11 || !level.cells.length) return false;
  const board = new Map<string, GardenCell>();
  for (const cell of level.cells) {
    if (cell.row < 0 || cell.column < 0 || cell.row >= level.rows || cell.column >= level.columns || board.has(cellKey(cell))) return false;
    board.set(cellKey(cell), cell);
  }
  for (const word of level.words) {
    if (!lexicon.words.has(word.word) || !canSpellWord(level.letters, word.letters)) return false;
    if (word.letters.some((letter, index) => board.get(cellKey(point(word, index)))?.letter !== letter)) return false;
    if (!level.cells.some(cell => cell.wordIds.length === 2 && cell.wordIds.includes(word.id))) return false;
  }
  const visited = new Set<string>([level.words[0].id]);
  for (let pass = 0; pass < level.words.length; pass++) for (const cell of level.cells) if (cell.wordIds.some(id => visited.has(id))) cell.wordIds.forEach(id => visited.add(id));
  return visited.size === level.words.length && level.bonusWords.every(word => lexicon.words.has(word) && canSpellWord(level.letters, lexicon.words.get(word)!.letters));
}
