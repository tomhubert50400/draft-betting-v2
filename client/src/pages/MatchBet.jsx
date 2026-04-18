import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMatch } from '../api/matches';
import { placeBet, fetchMyBets } from '../api/bets';
import { useAuth } from '../contexts/AuthContext';
import DraftSelector from '../components/DraftSelector';

export default function MatchBet() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState(null);

  const { data: match, isLoading: matchLoading, error: matchError } = useQuery({
    queryKey: ['match', id],
    queryFn: () => fetchMatch(id),
  });

  const { data: myBets } = useQuery({
    queryKey: ['myBets'],
    queryFn: fetchMyBets,
    enabled: !!user,
  });

  const existingBet = myBets?.find?.((b) => String(b.match_id) === String(id));

  const mutation = useMutation({
    mutationFn: (predictions) => placeBet(id, predictions),
    onSuccess: () => {
      setMessage({ type: 'success', text: existingBet ? 'Bet updated!' : 'Bet placed!' });
      queryClient.invalidateQueries({ queryKey: ['myBets'] });
      queryClient.invalidateQueries({ queryKey: ['match', id] });
    },
    onError: (err) => {
      setMessage({ type: 'error', text: err.message || 'Failed to place bet' });
    },
  });

  if (matchLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (matchError || !match) {
    return (
      <div className="text-center py-20">
        <p className="text-accent-pink text-sm">Match not found</p>
        <Link to="/" className="text-accent-purple text-sm mt-2 inline-block hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isOpen = match.status === 'open';
  const isCompleted = match.status === 'completed';

  return (
    <div className="max-w-xl mx-auto">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-4 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </Link>


      {/* Match header */}
      <div className="bg-bg-card rounded-xl border border-white/5 p-5 mb-4">
        <div className="flex items-center justify-center gap-4 mb-2">
          <span className="text-xl font-bold text-text-primary">{match.team1}</span>
          <span className="text-text-muted font-bold">VS</span>
          <span className="text-xl font-bold text-text-primary">{match.team2}</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
          <span className={`px-2 py-0.5 rounded-full border font-semibold ${
            isOpen
              ? 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/30'
              : isCompleted
                ? 'bg-text-muted/20 text-text-muted border-text-muted/30'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          }`}>
            {match.status?.toUpperCase()}
          </span>
          {match.format && <span>{match.format}</span>}
          {match.game_number && <span>Game {match.game_number}</span>}
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className={`rounded-xl p-3 mb-4 text-sm font-medium ${
          message.type === 'success'
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-accent-pink/10 text-accent-pink border border-accent-pink/20'
        }`}>
          {message.text}
        </div>
      )}

      {/* Draft selector */}
      <div className="bg-bg-card rounded-xl border border-white/5 p-4">
        <h2 className="text-sm font-semibold text-text-secondary mb-4">
          {isOpen
            ? existingBet ? 'Update your predictions' : 'Select your predictions'
            : isCompleted
              ? 'Match results'
              : 'Predictions locked'}
        </h2>
        <DraftSelector
          match={match}
          onSubmit={(predictions) => mutation.mutateAsync(predictions)}
          existingBet={existingBet}
          canBrowse={true}
          canSubmit={isOpen && !!user}
        />
      </div>

      {/* Show score if completed */}
      {isCompleted && existingBet && existingBet.score != null && (
        <div className="mt-4 bg-bg-card rounded-xl border border-white/5 p-4 text-center">
          <p className="text-text-secondary text-xs mb-1">Your score</p>
          <p className="text-2xl font-bold bg-gradient-accent bg-clip-text text-transparent">
            {existingBet.score}
          </p>
        </div>
      )}
    </div>
  );
}
