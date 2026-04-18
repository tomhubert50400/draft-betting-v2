# Deployment Guide — draft.zerqua.com (Mac home server)

Production setup with **Caddy** (reverse proxy + TLS) + **pm2** (Node process) + **SQLite** (data) + **Cloudflare Tunnel** (optional, for NAT/CGNAT).

---

## ⚙️ Instructions for autonomous agent (Cowork / Claude Code)

If you (the agent) are executing this guide on behalf of the user, follow these rules:

### Before starting, ask the user for these values upfront (one batched question)
1. **Project install path** (default: `~/sites/draft-betting`) — confirm where to clone
2. **Git remote URL** for the v2 repo (private GitHub repo)
3. **Domain** (default `draft.zerqua.com`) — confirm
4. **Discord OAuth credentials**:
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - User must have already added the redirect URI `https://<DOMAIN>/auth/discord/callback` in https://discord.com/developers/applications
5. **DNS strategy**: A) Direct (port forwarding) or B) Cloudflare Tunnel
6. **DB strategy**: A) Fresh install (empty DB) or B) Migrate from Firebase or C) Copy existing DB file from elsewhere
   - If B: ask user to `scp` `firebase-credentials.json` to `server/migration/` after clone
   - If C: ask user to `scp` the `.db` file to `data/` after clone

### What you can do autonomously
- Install Homebrew, Node 24, pm2, Caddy, sqlite3, cloudflared
- Generate `JWT_SECRET` with `openssl rand -hex 64`
- Clone, `npm install`, `npm run build`
- Write `.env`, `Caddyfile`, edit cron
- `pm2 start`, `pm2 save`, follow `pm2 startup` instructions
- Test endpoints with `curl`
- Read logs (`pm2 logs`, Caddy logs)

### What requires user interaction (PAUSE and ask)
- **sudo password**: needed for `brew install`, editing `/etc/caddy/Caddyfile`, `cloudflared service install`, `pm2 startup`
- **Cloudflare login**: `cloudflared tunnel login` opens a browser — user must complete it
- **Final validation**: ask the user to load `https://<DOMAIN>` from a phone (off-network) before declaring success

### Verification checkpoints (do NOT skip)
After each major step, run a verification and report status:
- After step 1 (clone): `ls package.json && cat .env.example | head -5`
- After step 4 (DB): `sqlite3 data/draft-betting.db "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM matches;"`
- After step 5 (build): `ls client/dist/index.html`
- After step 6 (pm2): `curl -s http://localhost:3001/api/health` (expect `{"status":"ok",...}`)
- After step 7 (Caddy): `curl -I https://<DOMAIN>` (expect `HTTP/2 200`)
- After step 9 (backup): run `./scripts/backup.sh` once and check `backups/` folder

### Failure handling
- If a brew install fails with permissions → check user is not root, retry with sudo if needed
- If `npm install` fails on `better-sqlite3` → ensure Xcode CLI tools installed: `xcode-select --install`
- If Caddy can't get a Let's Encrypt cert → DNS not propagated yet; wait 5 min and retry
- If pm2 crashes immediately → `pm2 logs draft-betting --lines 50` and report to user
- **Never proceed past a failed checkpoint silently.** Report the error and ask the user.

### Sensitive data
- **NEVER print** `JWT_SECRET`, `DISCORD_CLIENT_SECRET`, or `firebase-credentials.json` content in your responses
- **NEVER commit** these to git (they're in `.gitignore`, but double-check)
- After deployment success, suggest the user delete `firebase-credentials.json` if migration is done

---

## 0. Prerequisites on the Mac

```bash
# Install Homebrew if missing
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install required tools
brew install node@24 git caddy sqlite3
brew install --cask cloudflare-warp  # only if you use Cloudflare Tunnel; see step 8

# pm2 globally
npm install -g pm2
```

Check Node version:
```bash
node --version  # must be >= 20.19, ideally 24.x
```

---

## 1. Clone the project

```bash
mkdir -p ~/sites
cd ~/sites
git clone <YOUR_GIT_REMOTE> draft-betting
cd draft-betting
npm install --omit=dev
cd client && npm install && cd ..
```

> If you don't have a remote yet, create a private GitHub repo and push from your dev machine, then clone here.

---

## 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env with real values
nano .env
```

Generate a strong JWT secret:
```bash
openssl rand -hex 64
# paste into JWT_SECRET=
```

Required values:
- `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` (see step 3)
- `DISCORD_REDIRECT_URI=https://draft.zerqua.com/auth/discord/callback`
- `JWT_SECRET=<the random hex from openssl>`
- `FRONTEND_URL=https://draft.zerqua.com`
- `DB_PATH=./data/draft-betting.db`
- `PORT=3001`

---

## 3. Discord OAuth setup

1. Go to https://discord.com/developers/applications
2. Create a new application (or reuse the existing v1 one)
3. **OAuth2 → General**:
   - Add redirect URI: `https://draft.zerqua.com/auth/discord/callback`
   - Copy the Client ID and Client Secret
4. Paste them in `.env`

If you reuse the v1 Discord app, the old redirect URI will keep working too — no impact.

---

## 4. Initialize the database

The schema auto-applies on first run. Two options:

### Option A — Fresh database
Just start the server once; the schema is applied automatically.

### Option B — Migrate from Firebase (recommended)
You already ran the migration locally. To migrate again on the Mac (or apply your latest local DB):

```bash
# Easiest: copy your local DB
mkdir -p data
scp dev-machine:/path/to/lol-draft-betting-v2/data/draft-betting.db data/

# Or run the migration on the Mac (needs Firebase credentials):
mkdir -p server/migration
scp dev-machine:/path/to/firebase-credentials.json server/migration/
node server/migration/migrate.js
```

Verify:
```bash
sqlite3 data/draft-betting.db "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM matches;"
```

---

## 5. Build the frontend

```bash
cd client
npm run build  # outputs to client/dist/
cd ..
```

You should now have `client/dist/index.html` + assets.

---

## 6. Start the backend with pm2

```bash
pm2 start ecosystem.config.js
pm2 save                 # persist process list
pm2 startup              # follow the printed command to autostart on boot
```

Useful pm2 commands:
```bash
pm2 status               # see running processes
pm2 logs draft-betting   # tail logs
pm2 restart draft-betting
pm2 stop draft-betting
```

Test the API:
```bash
curl http://localhost:3001/api/health
# → {"status":"ok","wsClients":0}
```

---

## 7. Configure Caddy

```bash
sudo cp Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
# Replace /Users/YOURUSER/draft-betting/client/dist with the real path
```

If you already have a Caddyfile with other sites, append the `draft.zerqua.com { ... }` block instead of replacing the file.

Reload Caddy:
```bash
sudo brew services restart caddy
# or, if Caddy runs as a launchd agent:
sudo caddy reload --config /etc/caddy/Caddyfile
```

Test:
```bash
curl -I https://draft.zerqua.com
# → HTTP/2 200 ...
```

Caddy will automatically obtain a Let's Encrypt cert on first request (assuming DNS is pointing here — see step 8).

---

## 8. DNS / Cloudflare Tunnel

You said `zerqua.com` is bought via Hostinger and DNS is delegated to Cloudflare. Two cases:

### Case A — Direct exposure (you have a public IP and ports 80/443 open)
- Add an `A` record in Cloudflare: `draft → <your home public IP>`
- Set the proxy status to **DNS only** (grey cloud) or **Proxied** (orange cloud, recommended for DDoS)
- Open ports 80 and 443 on your router → Mac

### Case B — Cloudflare Tunnel (recommended; no port forwarding needed)
```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create draft-betting
cloudflared tunnel route dns draft-betting draft.zerqua.com
```

Create `~/.cloudflared/config.yml`:
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /Users/YOURUSER/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: draft.zerqua.com
    service: https://localhost:443
    originRequest:
      noTLSVerify: true
  - service: http_status:404
```

Run as a service:
```bash
sudo cloudflared service install
sudo launchctl start com.cloudflare.cloudflared
```

Caddy still serves on `localhost:443`; the tunnel forwards public traffic to it.

---

## 9. Backups

```bash
chmod +x scripts/backup.sh
./scripts/backup.sh      # test once

# Schedule every 6h via cron:
crontab -e
# add this line (adjust path):
0 */6 * * * /Users/YOURUSER/sites/draft-betting/scripts/backup.sh >> /tmp/draft-backup.log 2>&1
```

Backups land in `backups/` (gzipped, kept 14 days).

---

## 10. Update workflow

For future updates:
```bash
cd ~/sites/draft-betting
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

This pulls, rebuilds the front, and restarts pm2.

---

## 11. Logs & monitoring

- **Caddy access logs**: `/var/log/caddy/draft.zerqua.com.log`
- **pm2 logs**: `pm2 logs draft-betting` or `~/.pm2/logs/`
- **Server health**: `curl https://draft.zerqua.com/api/health`

---

## 12. Troubleshooting

**Discord OAuth redirect_uri_mismatch**
→ Check the redirect URI in the Discord app settings matches `DISCORD_REDIRECT_URI` in `.env` exactly (including trailing slash).

**WebSocket disconnects every 30s**
→ Cloudflare proxy may close idle WS. Add to Caddyfile inside the backend handler:
```
reverse_proxy localhost:3001 {
  flush_interval -1
}
```

**SQLite locked**
→ WAL mode is enabled, but if you ever see locks, ensure no other process touches the DB (e.g., never run two pm2 instances).

**Cert renewal failing**
→ Caddy renews automatically. Check `journalctl -u caddy` (Linux) or Caddy logs.

---

## 13. Security checklist

- [ ] `.env` is **not** in git (already in `.gitignore`)
- [ ] `server/migration/firebase-credentials.json` **not** in git (already)
- [ ] `JWT_SECRET` is at least 64 hex chars and unique to prod
- [ ] Discord OAuth secret rotated if leaked
- [ ] Mac firewall enabled, only ports 80/443 (or just Cloudflare Tunnel) reachable
- [ ] pm2 runs as a non-admin user (don't run as root)
- [ ] Cloudflare proxied (orange cloud) for DDoS protection
- [ ] Backup script working and tested by restoring at least once

---

## 14. Rollback

If something breaks after a deploy:
```bash
git log --oneline -10
git checkout <PREVIOUS_COMMIT_SHA>
./scripts/deploy.sh
```

For DB rollback, restore from backups:
```bash
pm2 stop draft-betting
gunzip -c backups/draft-betting-YYYYMMDD-HHMMSS.db.gz > data/draft-betting.db
pm2 start draft-betting
```
