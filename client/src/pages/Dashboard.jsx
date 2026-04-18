import { useQuery } from '@tanstack/react-query';
import { fetchMatches } from '../api/matches';
import { fetchMyBets } from '../api/bets';
import { useAuth } from '../contexts/AuthContext';
import MatchCard from '../components/MatchCard';

function MatchSection({ title, matches, emptyText, betMatchIds }) {
  if (matches.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-bold text-text-primary mb-3">{title}</h2>
        <p className="text-text-muted text-sm bg-bg-card rounded-xl p-6 text-center border border-white/5">
          {emptyText}
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-text-primary mb-3">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} hasBet={betMatchIds?.has(match.id)} />
        ))}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { data: matches, isLoading, error } = useQuery({
    queryKey: ['matches'],
    queryFn: fetchMatches,
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
        <p className="text-accent-pink text-sm">Failed to load matches</p>
        <p className="text-text-muted text-xs mt-1">{error.message}</p>
      </div>
    );
  }

  const allMatches = Array.isArray(matches) ? matches : [];
  const open = allMatches.filter((m) => m.status === 'open');
  const locked = allMatches.filter((m) => m.status === 'locked');
  const completed = allMatches
    .filter((m) => m.status === 'completed')
    .slice(0, 10); // Show last 10

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Matches</h1>
        <p className="text-text-secondary text-sm mt-1">
          Predict champion picks and earn points
        </p>
      </div>

      <MatchSection
        title="Upcoming"
        matches={open}
        emptyText="No upcoming matches right now"
      />
      <MatchSection
        title="In Progress"
        matches={locked}
        emptyText="No matches in progress"
      />
      <MatchSection
        title="Recent Results"
        matches={completed}
        emptyText="No completed matches yet"
      />
    </div>
  );
}
