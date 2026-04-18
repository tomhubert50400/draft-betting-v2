import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchUser, fetchUserBets } from '../api/users';
import { useAuth } from '../contexts/AuthContext';
import BadgeDisplay from '../components/BadgeDisplay';

export default function Profile() {
  const { id } = useParams();
  const { user: currentUser, logout } = useAuth();
  const isOwn = currentUser && String(currentUser.id) === String(id);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => fetchUser(id),
  });

  const { data: bets, isLoading: betsLoading } = useQuery({
    queryKey: ['userBets', id],
    queryFn: () => fetchUserBets(id),
  });

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <p className="text-accent-pink text-sm">User not found</p>
        <Link to="/" className="text-accent-purple text-sm mt-2 inline-block hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : null;

  const betList = Array.isArray(bets) ? bets : [];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Profile header */}
      <div className="bg-bg-card rounded-xl border border-white/5 p-6 mb-6">
        <div className="flex items-start gap-4">
          <img
            src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.discord_username)}&background=7c3aed&color=fff&size=80`}
            alt=""
            className="w-16 h-16 rounded-full ring-2 ring-accent-purple/30 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-text-primary truncate">{profile.discord_username}</h1>
            {memberSince && (
              <p className="text-xs text-text-muted mt-0.5">Member since {memberSince}</p>
            )}
            <div className="flex items-center gap-4 mt-3">
              <div>
                <p className="text-xl font-bold bg-gradient-accent bg-clip-text text-transparent">
                  {profile.total_score ?? 0}
                </p>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Score</p>
              </div>
              <div className="w-px h-8 bg-white/5" />
              <div>
                <p className="text-xl font-bold text-text-primary">
                  {profile.total_bets ?? betList.length}
                </p>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Bets</p>
              </div>
            </div>
            {profile.badges && profile.badges.length > 0 && (
              <div className="mt-3">
                <BadgeDisplay badges={profile.badges} />
              </div>
            )}
          </div>
        </div>

        {isOwn && (
          <button
            onClick={logout}
            className="mt-4 text-xs text-text-muted hover:text-accent-pink transition-colors"
          >
            Log out
          </button>
        )}
      </div>

      {/* Bet history */}
      <h2 className="text-lg font-bold text-text-primary mb-3">Bet History</h2>
      {betsLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
        </div>
      ) : betList.length === 0 ? (
        <div className="bg-bg-card rounded-xl border border-white/5 p-6 text-center">
          <p className="text-text-muted text-sm">No bets placed yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {betList.map((bet) => (
            <Link
              key={bet.id}
              to={`/match/${bet.match_id}`}
              className="block bg-bg-card rounded-xl border border-white/5 hover:border-accent-purple/20 p-4 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {bet.team1 || 'Team 1'} vs {bet.team2 || 'Team 2'}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {bet.created_at ? new Date(bet.created_at).toLocaleDateString() : ''}
                  </p>
                </div>
                {bet.score != null && (
                  <div className="text-right">
                    <p className="text-lg font-bold bg-gradient-accent bg-clip-text text-transparent">
                      {bet.score}
                    </p>
                    <p className="text-[10px] text-text-muted">pts</p>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
