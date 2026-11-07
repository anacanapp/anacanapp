import type { ParentingContent } from '../types';
import { BANDS } from './bands';
import { EMOTION_LIMIT_ARTICLES } from './articles-emotions-limits';
import { CONNECTION_ROUTINE_ARTICLES } from './articles-connection-routines';
import { GROWTH_BEHAVIOUR_ARTICLES } from './articles-growth-behaviour';
import { SOS_CARDS } from './sos';
import { PROGRAMMES } from './programmes';
import { MILESTONE_QUIZ, STYLE_QUIZ } from './quizzes';
import { AREAS, TIPS } from './tips';

/** Tərbiyə content in Azerbaijani (written for Anacan; sources are cited per article). */
const content: ParentingContent = {
  bands: BANDS,
  areas: AREAS,
  articles: [...EMOTION_LIMIT_ARTICLES, ...CONNECTION_ROUTINE_ARTICLES, ...GROWTH_BEHAVIOUR_ARTICLES],
  sos: SOS_CARDS,
  programmes: PROGRAMMES,
  styleQuiz: STYLE_QUIZ,
  milestoneQuiz: MILESTONE_QUIZ,
  tips: TIPS,
};

export default content;
