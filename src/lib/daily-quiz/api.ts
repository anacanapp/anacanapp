// Gündəlik Bilik Yarışı: client for the daily quiz RPCs (supabase/migrations/20261113200000_daily_quiz.sql).
// Questions arrive without answers; scoring, streak, league and leaderboard are computed on the server.
import { supabase } from '@/integrations/supabase/client';

export type QuizCategory = 'pregnancy' | 'baby_food' | 'sleep' | 'development' | 'health' | 'safety' | 'postpartum';
export type QuizLeague = 'bronze' | 'silver' | 'gold';
export interface QuizQuestion { id: string; category: QuizCategory; question: string; options: string[] }
export interface QuizBoardRow { rank: number; points: number; me: boolean; name: string | null; avatar: string | null }
export interface QuizSummary {
  streak: number; total_points: number; week_points: number; league: QuizLeague; week_start: string;
  leaderboard: { top: QuizBoardRow[]; me: { rank: number; points: number } | null };
}
export interface QuizState extends QuizSummary {
  enabled: boolean; language: string; date: string; questions_per_day: number; seconds_per_question: number;
  today: { status: 'none' | 'started' } | { status: 'done'; correct: number; total: number; score: number };
}
export interface QuizStart { date: string; seconds_per_question: number; questions: QuizQuestion[]; answers: (number | null)[] }
export interface QuizAnswer { index: number; chosen: number; correct_index: number; correct: boolean; explanation: string; article_url: string | null }
export interface QuizResultItem { id: string; chosen: number; correct_index: number; explanation: string; article_url: string | null }
export interface QuizResult extends QuizSummary { correct: number; total: number; score: number; perfect: boolean; results: QuizResultItem[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- quiz RPCs are not in the generated types yet
const rpc = (name: string, args: Record<string, unknown>) => (supabase as any).rpc(name, args);

async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw Object.assign(new Error(error.message || name), { code: String(error.message || '').match(/QUIZ_[A-Z_]+/)?.[0] });
  return data as T;
}

export const fetchQuizState = (language: string) => call<QuizState>('daily_quiz_state_v1', { p_language: language });
export const startQuiz = (language: string) => call<QuizStart>('daily_quiz_start_v1', { p_language: language });
/** Stores one answer (-1 = time ran out) and reveals its correct option; an answer cannot be changed later. */
export const answerQuestion = (index: number, choice: number) => call<QuizAnswer>('daily_quiz_answer_v1', { p_index: index, p_choice: choice });
export const finishQuiz = () => call<QuizResult>('daily_quiz_finish_v1', {});

/** Points for a result as the server computes them (20 per correct, +20 for a perfect round). */
export const quizPoints = (correct: number, total: number) => correct * 20 + (correct === total && total > 0 ? 20 : 0);

/** Next unanswered index in a round (answers use -1 for "no answer yet / timed out"). */
export function nextIndex(answers: (number | null)[]): number {
  const i = answers.findIndex((a) => a === null);
  return i === -1 ? answers.length : i;
}
