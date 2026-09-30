# BallArena

Live match fan chat — a full-stack app with a React frontend and Cloudflare Worker backend.

## Project structure

```
BallArena/
├── frontend/          Vite + React app (match schedule, chat UI)
│   └── src/
│       ├── components/ChatRoom.jsx
│       ├── data/fixtures.js
│       └── pages/
├── worker/            Cloudflare Worker + Durable Object
│   └── src/
│       ├── index.js
│       └── room.js
└── package.json       Root scripts to run both services
```

## Quick start

```bash
npm run install:all
npm run dev
```

This starts:

- **Worker** at `http://localhost:8787`
- **Frontend** at `http://localhost:5173`

Open `http://localhost:5173`, choose a listed match and team, and chat.

## Update local matches

Fetch upcoming Premier League matches once and store them in `frontend/src/data/matches.json`:

```bash
npm run fetch:matches
```

The script keeps upcoming matches through 1 January 2027, inclusive.

Review that file and manually delete matches that should not have a chat room. The frontend reads only the remaining local matches and makes no Football-Data API requests at runtime.

The Football-Data Free tier allows 10 calls per minute. The script uses a stricter local limit of one call every 60 seconds, records the attempt before contacting the API, and prevents concurrent runs. If the cooldown is active or the API returns `429`, no additional request is made and the existing match file is preserved.

## How it works

- One **Durable Object per match** (`matchId` from fixture data).
- **Hibernatable WebSockets** keep idle connections cheap at scale.
- **No database** — per-user state lives in WebSocket attachments.
- **Free cap**: 10,000 users per room; full rooms show a waitlist screen.
- **Live-only chat**: the match page only renders `<ChatRoom />` while the fixture is live.

## Environment variables

### Frontend (`frontend/.env.development` or `.env.production`)

| Variable             | Description                              |
| -------------------- | ---------------------------------------- |
| `VITE_CHAT_HTTP_URL` | Worker HTTP URL for status checks        |
| `VITE_CHAT_WS_URL`   | Worker WebSocket URL                     |
| `VITE_WAITLIST_URL`  | WhatsApp/Telegram link when room is full |

### Worker (`worker/wrangler.toml` → `[vars]`)

| Variable         | Description                                             |
| ---------------- | ------------------------------------------------------- |
| `ALLOWED_ORIGIN` | Frontend origin for CORS (e.g. `http://localhost:5173`) |

## Deploy

**Worker:**

```bash
cd worker
npx wrangler deploy
```

Update `ALLOWED_ORIGIN` in `wrangler.toml` to your production frontend URL.

**Frontend:**

```bash
cd frontend
# Set production env vars (see .env.example)
npm run build
# Deploy dist/ to Cloudflare Pages, Vercel, Netlify, etc.
```

Set `VITE_CHAT_HTTP_URL` and `VITE_CHAT_WS_URL` to your deployed Worker URL at build time.

## Customizing fixtures

Edit `frontend/src/data/matches.json` to remove matches or adjust the locally stored list. Run `npm run fetch:matches` when you want to refresh it from Football-Data.org.

## Phase 2 (not built)

Payment gating via Razorpay when rooms hit the free cap. The backend already returns `403 room_full` — swap the waitlist screen for a checkout flow and validate payment tokens before WebSocket upgrade.

## Manual API check

```bash
curl http://localhost:8787/room/live-el-clasico/status
# {"occupancy":0,"limit":10000,"full":false}
```
