import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const STATUS_STYLES = {
  open: 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/30',
  locked: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  completed: 'bg-text-muted/20 text-text-muted border-text-muted/30',
};

const STATUS_LABELS = {
  open: 'Open',
  locked: 'Locked',
  completed: 'Completed',
};

function formatCountdown(ms) {
  if (ms <= 0) return 'Locking soon...';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function MatchCard({ match, hasBet }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (match.status !== 'open' || !match.lock_at) return;

    function update() {
      const diff = new Date(match.lock_at).getTime() - Date.now();
      setTimeLeft(diff);
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [match.status, match.lock_at]);

  const status = match.status || 'open';
  const formatLabel = match.best_of?.toUpperCase() || '';
  const gameLabel = match.game_number ? `Game ${match.game_number}` : '';

  return (
    <Link
      to={`/match/${match.id}`}
      className="block bg-bg-card rounded-xl border border-white/5 hover:border-accent-purple/30 hover:shadow-lg hover:shadow-accent-purple/5 transition-all duration-200 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[status]}`}>
            {STATUS_LABELS[status]}
          </span>
          {formatLabel && (
            <span className="text-xs text-text-muted font-medium">
              {formatLabel}
            </span>
          )}
          {gameLabel && (
            <span className="text-xs text-text-secondary font-medium bg-bg-hover px-2 py-0.5 rounded">
              {gameLabel}
            </span>
          )}
        </div>
        {status === 'open' && timeLeft !== null && (
          <span className="text-xs font-mono">
            <span className="text-text-muted">Locking in </span>
            <span className="text-accent-cyan">{formatCountdown(timeLeft)}</span>
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex-1 text-right">
          <span className="text-lg font-bold text-text-primary">
            {match.team1}
          </span>
        </div>
        <span className="text-text-muted text-sm font-bold px-2">VS</span>
        <div className="flex-1 text-left">
          <span className="text-lg font-bold text-text-primary">
            {match.team2}
          </span>
        </div>
      </div>

      {/* Completed results: show winner */}
      {status === 'completed' && match.winner && (
        <div className="mt-3 text-center">
          <span className="text-xs text-text-secondary">Won by </span>
          <span className="text-xs font-bold text-green-400">
            {match.winner === 'team1' ? match.team1 : match.team2}
          </span>
        </div>
      )}

      {status === 'open' && (
        <div className="mt-3 text-center">
          {hasBet ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-400 bg-green-500/10 px-3 py-1 rounded-lg border border-green-500/20">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Bet placed
            </span>
          ) : (
            <span className="inline-block text-xs font-semibold text-accent-purple bg-accent-purple/10 px-3 py-1 rounded-lg">
              Place Bet
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
