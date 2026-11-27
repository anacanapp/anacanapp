/**
 * Anacan.AI → Tərbiyə link: is the mother's (or father's) message about a parenting topic, and which SOS card or
 * article answers it best? Client-side, over the tool's own content in the app language: tags (author-written
 * stems, weight 3; multi-word tags 6 — a named situation is strong evidence) and title words (first five letters of words with 5+ letters, weight 1.5).
 * A topic needs a score of 3 (one tag, or two title words). Ties go to the article (the general explainer); a
 * card wins when the situation itself is named (e.g. "mağazada isterika").
 */
import type { ParentingContent } from '@/data/parenting/types';
import { foldText, foldWords } from './parenting-search';

export type ParentingMatch = { kind: 'sos' | 'article'; id: string; title: string; emoji: string; score: number };

const MIN_SCORE = 3;
const STEM = 5;

/** Chinese / Japanese write without spaces between words: tags are matched as substrings of the whole message. */
const NO_SPACE_SCRIPT = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;

/** Arabic: one spelling for alef / taa marbuta / alef maqsura, and the attached article / prepositions removed. */
const AR_PREFIX = /^(?:وال|بال|كال|فال|لل|ال|و|ب|ل|ف|ك)(?=[\u0621-\u064a]{3,})/;
const arNorm = (w: string) => w.replace(/[\u064b-\u0652]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
const isArabic = (w: string) => /[\u0621-\u064a]/.test(w);
function wordForms(words: string[]): string[] {
  const out: string[] = [];
  for (const w of words) {
    if (!isArabic(w)) { out.push(w); continue; }
    const n = arNorm(w);
    out.push(n);
    const bare = n.replace(AR_PREFIX, '');
    if (bare !== n) out.push(bare);
  }
  return out;
}
const tagWords = (tag: string) => foldWords(tag).map((w) => (isArabic(w) ? arNorm(w).replace(AR_PREFIX, '') : w));

/** Does one tag (possibly several words) occur in the message words? Each tag word must start a message word. */
function tagHit(words: string[], tag: string, text = ''): boolean {
  const parts = tagWords(tag);
  if (parts.length && text && parts.every((p) => NO_SPACE_SCRIPT.test(p))) return parts.every((p) => text.includes(p));
  if (!parts.length) return false;
  if (parts.length === 1) return words.some((w) => w.startsWith(parts[0]));
  // Multi-word: in order, allowing up to two words in between.
  for (let i = 0; i < words.length; i++) {
    if (!words[i].startsWith(parts[0])) continue;
    let at = i;
    let ok = true;
    for (const p of parts.slice(1)) {
      let found = -1;
      for (let j = at + 1; j <= Math.min(words.length - 1, at + 3); j++) if (words[j].startsWith(p)) { found = j; break; }
      if (found < 0) { ok = false; break; }
      at = found;
    }
    if (ok) return true;
  }
  return false;
}

function score(words: string[], title: string, tags: string[] | undefined, text = ''): number {
  let s = 0;
  for (const tag of tags || []) if (tagHit(words, tag, text)) s += foldWords(tag).length > 1 ? 6 : 3;
  const stems = [...new Set(foldWords(title).filter((w) => w.length >= STEM).map((w) => w.slice(0, STEM)))];
  for (const stem of stems) if (words.some((w) => w.startsWith(stem))) s += 1.5;
  return s;
}

/** Best SOS card or article for a chat message, or null when the message is not about a parenting topic. */
export function matchParentingTopic(content: ParentingContent | null | undefined, message: string | null | undefined): ParentingMatch | null {
  if (!content || !message || foldText(message).length < 4) return null;
  const words = wordForms(foldWords(message));
  const text = NO_SPACE_SCRIPT.test(message) ? foldText(message).replace(/\s+/g, '') : '';
  let best: ParentingMatch | null = null;
  const consider = (m: ParentingMatch) => {
    if (m.score < MIN_SCORE) return;
    if (!best || m.score > best.score || (m.score === best.score && m.kind === 'article' && best.kind === 'sos')) best = m;
  };
  for (const c of content.sos) consider({ kind: 'sos', id: c.id, title: c.title, emoji: c.emoji, score: score(words, c.title, c.tags, text) });
  for (const a of content.articles) consider({ kind: 'article', id: a.id, title: a.title, emoji: a.emoji, score: score(words, a.title, a.tags, text) });
  return best;
}
