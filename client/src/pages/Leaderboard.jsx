import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchLeaderboard } from '../api/users';
import { useAuth } from '../contexts/AuthContext';
import BadgeDisplay from '../components/BadgeDisplay';

export default function Leaderboard() {
  const { user } = useAuth();

  const { data: leaderboard, isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: fetchLeaderboard,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-accent-pink text-sm">Failed to load leaderboard</p>
      </div>
    );
  }

  const rows = Array.isArray(leaderboard) ? leaderboard : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Leaderboard</h1>
        <p className="text-text-secondary text-sm mt-1">Top predictors ranked by score</p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-bg-card rounded-xl border border-white/5 p-8 text-center">
          <p className="text-text-muted text-sm">No rankings yet. Be the first to bet!</p>
        </div>
      ) : (
        <div className="bg-bg-card rounded-xl border border-white/5 overflow-hidden">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-[3rem_1fr_5rem_5rem_auto] gap-4 px-4 py-3 border-b border-white/5 text-xs font-semibold text-text-muted uppercase tracking-wider">
            <span>Rank</span>
            <span>Player</span>
            <span className="text-right">Score</span>
            <span className="text-right">Bets</span>
            <span>Badges</span>
          </div>

          {/* Rows */}
          {rows.map((entry, index) => {
            const rank = index + 1;
            const isCurrentUser = user && String(entry.id) === String(user.id);

            return (
              <div
                key={entry.id}
                className={`grid grid-cols-[3rem_1fr_auto] sm:grid-cols-[3rem_1fr_5rem_5rem_auto] gap-4 px-4 py-3 items-center border-b border-white/5 last:border-b-0 transition-colors ${
                  isCurrentUser ? 'bg-accent-purple/5' : 'hover:bg-bg-hover/50'
                }`}
              >
                {/* Rank */}
                <span className={`text-sm font-bold ${
                  rank === 1 ? 'text-amber-400' :
                  rank === 2 ? 'text-gray-300' :
                  rank === 3 ? 'text-amber-600' :
                  'text-text-muted'
                }`}>
                  #{rank}
                </span>

                {/* Player */}
                <Link
                  to={`/profile/${entry.id}`}
                  className="flex items-center gap-2 min-w-0"
                >
                  <img
                    src={entry.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.username)}&background=7c3aed&color=fff&size=32`}
                    alt=""
                    className="w-7 h-7 rounded-full ring-1 ring-white/10 shrink-0"
                  />
                  <span className={`text-sm font-medium truncate ${
                    isCurrentUser ? 'text-accent-purple' : 'text-text-primary'
                  }`}>
                    {entry.username}
                  </span>
                </Link>

                {/* Score + Bets (mobile: inline, desktop: separate columns) */}
                <div className="flex items-center gap-3 sm:contents">
                  <span className="text-sm font-bold text-text-primary sm:text-right">
                    {entry.total_score ?? entry.score ?? 0}
                  </span>
                  <span className="text-xs text-text-muted sm:text-right hidden sm:block">
                    {entry.total_bets ?? entry.bet_count ?? 0}
                  </span>
                </div>

                {/* Badges (desktop only) */}
                <div className="hidden sm:block">
                  <BadgeDisplay badges={entry.badges || []} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
