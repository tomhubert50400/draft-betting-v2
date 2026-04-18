import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NAV_LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/leaderboard', label: 'Leaderboard' },
];

export default function Navbar() {
  const { user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-bg-secondary/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold bg-gradient-accent bg-clip-text text-transparent">
            Draft Betting
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(link.to)
                  ? 'bg-accent-purple/20 text-accent-purple'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              {link.label}
            </Link>
          ))}
          {user?.is_admin && (
            <Link
              to="/admin"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive('/admin')
                  ? 'bg-accent-pink/20 text-accent-pink'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              Admin
            </Link>
          )}
        </div>

        {/* Right side: user or login */}
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              to={`/profile/${user.id}`}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-bg-hover transition-colors"
            >
              <img
                src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.discord_username)}&background=7c3aed&color=fff&size=32`}
                alt=""
                className="w-7 h-7 rounded-full ring-2 ring-accent-purple/40"
              />
              <span className="text-sm font-medium text-text-primary hidden sm:inline">
                {user.discord_username}
              </span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-gradient-accent text-white hover:opacity-90 transition-opacity"
            >
              Login
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-white/5 px-4 py-2 space-y-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(link.to)
                  ? 'bg-accent-purple/20 text-accent-purple'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              {link.label}
            </Link>
          ))}
          {user?.is_admin && (
            <Link
              to="/admin"
              onClick={() => setMenuOpen(false)}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/admin')
                  ? 'bg-accent-pink/20 text-accent-pink'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              Admin
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
