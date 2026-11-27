import type { ParentingContent } from '../types';
import { BANDS } from './bands';
import { EMOTION_LIMIT_ARTICLES } from './articles-emotions-limits';
import { CONNECTION_ROUTINE_ARTICLES } from './articles-connection-routines';
import { GROWTH_BEHAVIOUR_ARTICLES } from './articles-growth-behaviour';
import { BABY_YEAR_ARTICLES } from './articles-baby-year';
import { FAMILY_LIFE_ARTICLES } from './articles-family-life';
import { SOS_CARDS } from './sos';
import { PROGRAMMES } from './programmes';
import { MILESTONE_QUIZ, STYLE_QUIZ } from './quizzes';
import { AREAS, TIPS } from './tips';
import { ARTICLE_TAGS, PROGRAMME_TAGS, SOS_TAGS } from './tags';

const withTags = <T extends { id: string; tags?: string[] }>(list: T[], tags: Record<string, string[]>): T[] =>
  list.map((item) => (tags[item.id] ? { ...item, tags: tags[item.id] } : item));

/** Tərbiyə content in Polish (translated from the Azerbaijani original; sources are cited per article). */
const content: ParentingContent = {
  bands: BANDS,
  areas: AREAS,
  articles: withTags([...EMOTION_LIMIT_ARTICLES, ...CONNECTION_ROUTINE_ARTICLES, ...GROWTH_BEHAVIOUR_ARTICLES, ...BABY_YEAR_ARTICLES, ...FAMILY_LIFE_ARTICLES], ARTICLE_TAGS),
  sos: withTags(SOS_CARDS, SOS_TAGS),
  programmes: withTags(PROGRAMMES, PROGRAMME_TAGS),
  styleQuiz: STYLE_QUIZ,
  milestoneQuiz: MILESTONE_QUIZ,
  tips: TIPS,
};

export default content;
