import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function DiscordCallback() {
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('No authentication token received');
      return;
    }

    try {
      loginWithToken(token);
      navigate('/', { replace: true });
    } catch (err) {
      setError('Failed to authenticate: ' + (err.message || 'Unknown error'));
    }
  }, [searchParams, loginWithToken, navigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="bg-bg-card rounded-2xl border border-accent-pink/20 p-8 max-w-sm w-full text-center">
          <p className="text-accent-pink text-sm font-medium mb-4">{error}</p>
          <a
            href="/login"
            className="text-accent-purple text-sm hover:underline"
          >
            Try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-3 text-text-secondary">
        <div className="w-6 h-6 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Authenticating...</span>
      </div>
    </div>
  );
}
