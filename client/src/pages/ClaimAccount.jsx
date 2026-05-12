import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export default function ClaimAccount() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [submitting, setSubmitting] = useState(null); // 'claim' | 'skip' | null
  const [error, setError] = useState(null);

  const pending = params.get('pending');
  const candidateUsername = params.get('candidate_username');
  const candidateScore = params.get('candidate_score');
  const candidateBets = params.get('candidate_bets');

  if (!pending || !candidateUsername) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="text-accent-pink text-sm">Lien invalide ou expiré.</p>
        <button
          onClick={() => navigate('/login')}
          className="mt-4 px-4 py-2 rounded-lg bg-gradient-accent text-white text-sm font-semibold"
        >
          Retour login
        </button>
      </div>
    );
  }

  async function call(endpoint) {
    setSubmitting(endpoint);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/auth/${endpoint}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      loginWithToken(data.token);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setSubmitting(null);
    }
  }

  return (
    <div className="max-w-md mx-auto py-12">
      <div className="bg-bg-card rounded-xl border border-white/5 p-6 text-center">
        <h1 className="text-xl font-bold text-text-primary mb-2">Compte existant détecté</h1>
        <p className="text-sm text-text-secondary mb-6">
          On a trouvé un ancien compte avec le même pseudo.<br/>
          Est-ce le tien ?
        </p>

        <div className="bg-bg-primary/50 rounded-xl border border-white/5 p-4 mb-6">
          <p className="text-lg font-bold text-text-primary">{candidateUsername}</p>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-text-muted">
            <div>
              <p className="bg-gradient-accent bg-clip-text text-transparent text-lg font-bold">
                {candidateScore}
              </p>
              <p>Score</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <p className="text-lg font-bold text-text-primary">{candidateBets}</p>
              <p>Bets</p>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-accent-pink text-xs mb-3">{error}</p>
        )}

        <div className="space-y-2">
          <button
            onClick={() => call('claim')}
            disabled={!!submitting}
            className="w-full py-2.5 rounded-xl bg-gradient-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting === 'claim' ? 'Récupération...' : 'Oui, c\'est mon compte'}
          </button>
          <button
            onClick={() => call('claim-skip')}
            disabled={!!submitting}
            className="w-full py-2.5 rounded-xl bg-bg-hover text-text-secondary text-sm font-medium hover:text-text-primary transition-colors disabled:opacity-50"
          >
            {submitting === 'claim-skip' ? 'Création...' : 'Non, créer un nouveau compte'}
          </button>
        </div>

        <p className="text-[10px] text-text-muted mt-4">
          Cette action est irréversible. Si tu cliques "C'est mon compte", il sera lié à ton Discord pour toujours.
        </p>
      </div>
    </div>
  );
}
