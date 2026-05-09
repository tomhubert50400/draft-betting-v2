require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const http = require('http');
const { initDb } = require('./db');
const { initWebSocket } = require('./ws');
const { startDraftWatchMonitor } = require('./draftwatch');
const { startPoller, backfillMissingWinners } = require('./scraper/poller');
const { syncSchedule } = require('./scraper/scheduleSync');

const authRoutes = require('./routes/auth');
const matchRoutes = require('./routes/matches');
const betRoutes = require('./routes/bets');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const playerRoutes = require('./routes/players');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://draft.zerqua.com',
  credentials: true,
}));
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/bets', betRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/players', playerRoutes);

const { authRequired } = require('./middleware/auth');
const { adminRequired } = require('./middleware/admin');

app.post('/api/admin/sync', authRequired, adminRequired, async (req, res) => {
  try {
    const result = await syncSchedule();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  const { getClientCount } = require('./ws');
  res.json({ status: 'ok', wsClients: getClientCount() });
});

const PORT = process.env.PORT || 3001;

initDb();
initWebSocket(server);
startDraftWatchMonitor();
startPoller();
backfillMissingWinners().catch((err) => console.error('Backfill error:', err));

function scheduleDailySync() {
  const now = new Date();
  const next6am = new Date(now);
  next6am.setUTCHours(6, 0, 0, 0);
  if (next6am <= now) next6am.setDate(next6am.getDate() + 1);

  const delay = next6am - now;
  setTimeout(() => {
    syncSchedule().catch(err => console.error('Daily sync error:', err));
    setInterval(() => {
      syncSchedule().catch(err => console.error('Daily sync error:', err));
    }, 24 * 60 * 60 * 1000);
  }, delay);

  console.log(`Daily sync scheduled at ${next6am.toISOString()}`);
}

scheduleDailySync();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
