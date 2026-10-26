import { motion } from 'framer-motion';
import { Trophy, Medal, User } from 'lucide-react';
import { tr } from '@/lib/tr';
import { useAuth } from '@/hooks/useAuth';
import { useGameLeaderboard, useMyGameScore } from '@/hooks/useGameScores';
import { gameScoreMessage } from '@/lib/game-score-messages';
import { Link } from 'react-router-dom';

interface LeaderboardProps {
  gameId: string;
}

// Podium colors mapped to the anacan palette
const RANK_STYLES = [
  { bg: 'var(--a-grad-yellow)', ink: 'var(--a-warn-ink)' }, // 1st
  { bg: 'linear-gradient(135deg, var(--a-surface-soft), var(--a-line-strong))', ink: 'var(--a-ink-soft)' }, // 2nd
  { bg: 'var(--a-grad-peach)', ink: 'var(--a-accent-ink)' }, // 3rd
];

const Leaderboard = ({ gameId }: LeaderboardProps) => {
  const { user, loading } = useAuth();
  const { data: entries = [], isLoading, isError, refetch } = useGameLeaderboard(gameId, 20);
  const { data: myScore } = useMyGameScore(gameId);

  const myRankIndex = entries.findIndex((e) => e.userId === user?.id);

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-6 h-6 rounded-full animate-spin" style={{ border: '2px solid var(--a-peach-2)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user) return <div className="a-card text-center" style={{ padding: '28px 18px' }}>
    <User className="mx-auto mb-3 h-9 w-9 text-primary" />
    <p className="a-list-title">{gameScoreMessage('loginTitle')}</p>
    <p className="a-list-sub" style={{ whiteSpace: 'normal', marginBlock: 10 }}>{gameScoreMessage('loginDescription')}</p>
    <Link to="/" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">{gameScoreMessage('login')}</Link>
  </div>;

  if (isError) return <div className="a-card text-center" role="alert" style={{ padding: '28px 18px' }}>
    <p className="a-list-title">{gameScoreMessage('loadingError')}</p>
    <p className="a-list-sub" style={{ whiteSpace: 'normal', marginBlock: 10 }}>{gameScoreMessage('loadingDescription')}</p>
    <button type="button" onClick={() => { void refetch(); }} className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">{gameScoreMessage('retry')}</button>
  </div>;

  if (entries.length === 0) {
    return (
      <div className="a-card text-center" style={{ padding: '34px 18px' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--a-surface-soft)' }}>
          <Trophy className="w-8 h-8" style={{ color: 'var(--a-ink-faint)' }} />
        </div>
        <p className="a-list-title mb-1" style={{ margin: '0 0 4px' }}>
          {tr('minigames_leaderboard_empty_title', 'Reytinq hələ boşdur')}
        </p>
        <p className="a-list-sub max-w-xs mx-auto" style={{ margin: '0 auto', whiteSpace: 'normal' }}>
          {tr('minigames_leaderboard_empty_desc', 'İlk oyunçu siz olun! Oyunu bitirin və xalınız qlobal reytinqə düşsün.')}
        </p>
        {myScore && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm" style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
            <Trophy className="w-4 h-4" /> {tr('minigames_your_best_score', 'Sizin ən yaxşı xalınız')}: {myScore.best_score}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-1">
      <div className="space-y-2">
        {entries.map((entry, index) => {
          const isMe = entry.userId === user?.id;
          const rank = index + 1;
          return (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.02, 0.2) }}
              className="flex items-center gap-3 p-2.5 rounded-2xl"
              style={isMe ?
              { background: 'var(--a-peach-1)', border: '1px solid var(--a-peach-2)' } :
              { background: 'var(--a-surface)', border: '1px solid var(--a-line)', boxShadow: 'var(--a-card-shadow)' }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs"
                style={rank <= 3 ?
                { background: RANK_STYLES[rank - 1].bg, color: RANK_STYLES[rank - 1].ink, boxShadow: '0 4px 10px -4px rgba(23, 21, 15, 0.25)' } :
                { background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)' }}
              >
                {rank <= 3 ? <Medal className="w-4 h-4" /> : rank}
              </div>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: isMe ? 'var(--a-chip-overlay)' : 'var(--a-peach-1)' }}>
                {entry.avatarUrl ? (
                  <img loading="lazy" decoding="async" src={entry.avatarUrl} alt={entry.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4" style={{ color: 'var(--a-accent-ink)' }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ margin: 0, color: isMe ? 'var(--a-accent-ink)' : 'var(--a-ink)' }}>
                  {entry.name} {isMe && <span className="text-xs" style={{ color: 'var(--a-accent-ink)' }}>({tr('minigames_you_label', 'Siz')})</span>}
                </p>
                <p className="text-[11px]" style={{ margin: 0, color: isMe ? 'var(--a-accent-ink)' : 'var(--a-ink-soft)', opacity: isMe ? 0.75 : 1 }}>
                  {tr('saglamsebet_level_label', 'Səviyyə')} {entry.bestLevel}
                </p>
              </div>
              <div className="text-end flex-shrink-0">
                <p className="text-sm font-extrabold" style={{ margin: 0, color: 'var(--a-accent-ink)' }}>{entry.bestScore}</p>
                <p className="text-[10px]" style={{ margin: 0, color: isMe ? 'var(--a-accent-ink)' : 'var(--a-ink-soft)', opacity: isMe ? 0.75 : 1 }}>{tr('minigames_points_label', 'xal')}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {myRankIndex === -1 && myScore && (
        <div className="mt-3 flex items-center gap-3 p-2.5 rounded-2xl" style={{ background: 'var(--a-peach-1)', border: '1px solid var(--a-peach-2)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs" style={{ background: 'var(--a-chip-overlay)', color: 'var(--a-accent-ink)' }}>
            —
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ margin: 0, color: 'var(--a-accent-ink)' }}>{tr('minigames_your_best_score', 'Sizin ən yaxşı xalınız')}</p>
          </div>
          <p className="text-sm font-extrabold" style={{ margin: 0, color: 'var(--a-accent-ink)' }}>{myScore.best_score}</p>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
