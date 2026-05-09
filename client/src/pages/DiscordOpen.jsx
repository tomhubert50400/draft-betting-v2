import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function DiscordOpen() {
  const [searchParams] = useSearchParams();
  const appUrl = searchParams.get('app');
  const webUrl = searchParams.get('web');

  useEffect(() => {
    if (
      !appUrl ||
      !webUrl ||
      !appUrl.startsWith('discord://-/oauth2/authorize?') ||
      !webUrl.startsWith('https://discord.com/oauth2/authorize?')
    ) {
      window.location.replace('/login?error=discord_open_failed');
      return;
    }

    window.location.href = appUrl;
    const fallback = window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        window.location.href = webUrl;
      }
    }, 1200);

    return () => window.clearTimeout(fallback);
  }, [appUrl, webUrl]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="bg-bg-card rounded-2xl border border-white/5 p-8 max-w-sm w-full text-center">
        <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-text-secondary text-sm">
          Opening Discord...
        </p>
      </div>
    </div>
  );
}
