<p align="center">
  <img src="client/src/assets/hero.png" alt="Draft Predictions" width="900" />
</p>

<h1 align="center">Draft Predictions</h1>

<p align="center">
  A real-time League of Legends draft prediction game built around Karmine Corp matches.
</p>

<p align="center">
  <a href="https://draft.zerqua.com"><strong>Open the live application</strong></a>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=111111" />
  <img alt="Express" src="https://img.shields.io/badge/API-Express-000000?logo=express&logoColor=white" />
  <img alt="SQLite" src="https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite&logoColor=white" />
  <img alt="WebSocket" src="https://img.shields.io/badge/Updates-WebSocket-7B2CF5" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Styles-Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white" />
</p>

## Overview

Draft Predictions lets a community predict champion picks before a League of Legends draft is revealed. Matches are created from the LoL Esports schedule, predictions lock around the live draft, and results are scored when the official draft data becomes available.

The application is self-hosted and combines a React client, an Express API, SQLite persistence, Discord authentication, and WebSocket updates.

## Features

- Upcoming Karmine Corp match and series dashboard
- Champion predictions for each role and team
- Automatic BO1, BO3, and BO5 series handling
- Match locking and live draft monitoring
- Draft and winner resolution from LoL Esports data
- Automatic score calculation and badge evaluation
- Global leaderboard and individual profile pages
- Discord OAuth login and account-claiming flow
- Real-time match and result updates over WebSocket
- Administrative interface for matches, players, synchronization, and recovery tasks
- Daily schedule synchronization and background result backfilling

## Architecture

```text
client/                 React + Vite single-page application
├── src/pages/          Dashboard, betting, leaderboard, profile, auth, admin
├── src/components/     Draft selector, series cards, navigation, UI
├── src/contexts/       Authentication and champion data
└── src/hooks/          API and WebSocket integrations

server/                 Node.js + Express backend
├── routes/             Auth, matches, bets, users, players, admin
├── scraper/            LoL Esports schedule, live draft, and result polling
├── middleware/         Authentication and authorization
├── db.js               SQLite initialization and migrations
├── ws.js               WebSocket server and broadcasts
└── index.js            HTTP server and background jobs
```

## Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, Vite, React Router, TanStack Query, Tailwind CSS |
| Backend | Node.js, Express, WebSocket |
| Database | SQLite through `better-sqlite3` |
| Authentication | Discord OAuth, JWT, bcrypt |
| External data | LoL Esports schedule, live game, draft, roster, and result feeds |
| Operations | PM2, Caddy, SQLite backups, health endpoint |

## Prerequisites

- Node.js
- npm
- A Discord application for OAuth
- Network access to the LoL Esports data endpoints

## Local setup

### 1. Install dependencies

```bash
git clone https://github.com/tomhubert50400/draft-betting-v2.git
cd draft-betting-v2
npm ci
```

The repository uses npm workspaces for the client and server packages.

### 2. Configure the environment

```bash
cp .env.example .env
```

Set the required values:

```dotenv
JWT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback
FRONTEND_URL=http://localhost:5173
PORT=3001
```

Generate a long, random `JWT_SECRET` and never commit the resulting `.env` file.

### 3. Start the API

```bash
npm run dev --workspace server
```

The API exposes a health check at:

```text
GET http://localhost:3001/api/health
```

### 4. Start the client

In a second terminal:

```bash
npm run dev --workspace client
```

Open [http://localhost:5173](http://localhost:5173).

## Production build

```bash
npm run build --workspace client
```

The generated client is written to `client/dist`. The Express server serves the API and WebSocket connection separately.

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the documented PM2, Caddy, backup, monitoring, and rollback procedure used by the self-hosted deployment.

## API surface

| Prefix | Responsibility |
| --- | --- |
| `/auth` | Discord authentication and account claims |
| `/api/matches` | Match, series, draft, and result data |
| `/api/bets` | Prediction submission and retrieval |
| `/api/users` | Profiles, leaderboard data, and badges |
| `/api/players` | Player and role data |
| `/api/admin` | Protected administration operations |
| `/api/health` | Runtime and WebSocket health status |

## Data flow

1. The scheduled synchronization job creates upcoming KC matches.
2. Users submit role-by-role champion predictions while a match is open.
3. The backend monitors the live game feed and locks the prediction window.
4. Completed draft and winner data are resolved from the LoL Esports feeds.
5. Scores are calculated, stored in SQLite, and broadcast to connected clients.

## Current verification status

- Frontend production build: verified
- Live application and health endpoint: deployed through the documented self-hosted stack
- Automated server test suite: not currently configured

## License

This repository does not currently include an open-source license. All rights are reserved by the author.
