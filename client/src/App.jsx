import { Routes, Route } from 'react-router-dom';
import { useWebSocket } from './hooks/useWebSocket';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import MatchBet from './pages/MatchBet';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Login from './pages/Login';
import DiscordOpen from './pages/DiscordOpen';
import DiscordCallback from './pages/DiscordCallback';
import ClaimAccount from './pages/ClaimAccount';
import Admin from './pages/Admin';

export default function App() {
  useWebSocket();

  return (
    <div className="min-h-screen bg-gradient-bg">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/match/:id" element={<MatchBet />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/discord-open" element={<DiscordOpen />} />
          <Route path="/discord-callback" element={<DiscordCallback />} />
          <Route path="/claim-account" element={<ClaimAccount />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  );
}
