import matches from './matches.json';

// RoomObject: one Durable Object instance per match.
// Uses the Hibernatable WebSocket API so idle connections (users just
// reading, not typing) cost nothing while the room is quiet.
//
// Comments marked FIX 1..7 map to the numbered problems in the review.

const FREE_USER_LIMIT = 10000;
const MAX_MESSAGE_LENGTH = 300;
const MAX_RAW_MESSAGE_LENGTH = 1024; // FIX 7: reject oversized frames before parsing
const MAX_NAME_LENGTH = 24;
const RATE_LIMIT_WINDOW_MS = 10000;
const RATE_LIMIT_MAX_MESSAGES = 10;
const HISTORY_LIMIT = 50;
const HISTORY_SAVE_DELAY_MS = 2000; // FIX 1: at most one storage write per 2s
const STATS_BROADCAST_DELAY_MS = 1000; // FIX 2: at most one stats broadcast per 1s
const ANON_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/; // FIX 5a: UUIDs match this

export class RoomObject {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.recentMessages = [];
    this.saveTimer = null;
    this.statsTimer = null;

    // FIX 1: reload history from disk every time the object wakes from
    // hibernation. blockConcurrencyWhile makes sure loading finishes
    // before any other event is handled.
    ctx.blockConcurrencyWhile(async () => {
      this.recentMessages = (await ctx.storage.get('history')) || [];
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const match = matches.find((fixture) => fixture.id === this.getMatchId(url));

    if (url.pathname.endsWith('/status')) {
      return this.handleStatus(match);
    }

    if (!match) {
      return Response.json({ error: 'match_not_found' }, { status: 404 });
    }

    if (!this.isMatchLive(match)) {
      return Response.json(this.getWindowError(match), { status: 403 });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade request', { status: 400 });
    }

    const team = url.searchParams.get('team');
    const anonId = url.searchParams.get('anonId');
    const rawName = url.searchParams.get('name') || 'Fan';
    const rawBadge = url.searchParams.get('badge') || '⚽';

    if (team !== 'home' && team !== 'away') {
      return new Response('Query param "team" must be "home" or "away"', { status: 400 });
    }

    // FIX 5a: reject missing or malformed IDs (also protects the 2 KB
    // attachment size limit).
    if (!anonId || !ANON_ID_PATTERN.test(anonId)) {
      return new Response('Query param "anonId" is missing or invalid', { status: 400 });
    }

    // FIX 5b: if this browser already has a connection, it is about to be
    // replaced, so don't count it toward the room limit.
    const duplicates = this.ctx.getWebSockets(`id:${anonId}`);
    const currentCount = this.getConnectedCount() - duplicates.length;
    if (currentCount >= FREE_USER_LIMIT) {
      return Response.json(
        { error: 'room_full', occupancy: currentCount, limit: FREE_USER_LIMIT },
        { status: 403 }
      );
    }

    // Admitted: close the older connection(s) from the same browser.
    for (const old of duplicates) {
      try {
        old.close(4000, 'Replaced by a newer connection');
      } catch {}
    }

    const name = sanitizeName(rawName);
    const badge = sanitizeText(rawBadge).slice(0, 4);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Tags let us count and find sockets without opening each one.
    this.ctx.acceptWebSocket(server, [`team:${team}`, `id:${anonId}`]);

    // FIX 4: set the closing alarm once, not on every join.
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(match.end);
    }

    server.serializeAttachment({
      matchId: match.id,
      team,
      name,
      badge,
      anonId,
      joinedAt: Date.now(),
      msgCount: 0,
      windowStart: Date.now()
    });

    // Send initial statistics
    server.send(JSON.stringify({ type: 'stats', ...this.getStats() }));

    // Send chat history
    for (const msg of this.recentMessages) {
      server.send(JSON.stringify(msg));
    }

    // FIX 2: batch the stats update for everyone else
    this.scheduleStatsBroadcast();

    return new Response(null, { status: 101, webSocket: client });
  }

  handleStatus(match) {
    if (!match) return Response.json({ error: 'match_not_found' }, { status: 404 });
    return Response.json({ ...this.getStats(), ...this.getWindowStatus(match) });
  }

  getMatchId(url) {
    return url.pathname.match(/^\/room\/([a-zA-Z0-9_-]+)/)?.[1];
  }

  isMatchLive(match) {
    const now = Date.now();
    return now >= match.kickoff && now < match.end;
  }

  getWindowStatus(match) {
    const now = Date.now();
    return {
      matchOpen: this.isMatchLive(match),
      kickoff: match.kickoff,
      end: match.end,
      windowState: now < match.kickoff ? 'upcoming' : now < match.end ? 'live' : 'finished'
    };
  }

  getWindowError(match) {
    return {
      error: 'chat_closed',
      message: Date.now() < match.kickoff ? 'Chat opens at kickoff.' : 'Chat is closed because the match has ended.',
      ...this.getWindowStatus(match)
    };
  }

  async alarm() {
    // Stop pending timers so nothing is written or sent after the match.
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.statsTimer) {
      clearTimeout(this.statsTimer);
      this.statsTimer = null;
    }

    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.close(1000, 'Match chat window closed');
      } catch {}
    }

    // The match is over, so the saved history is no longer needed.
    this.recentMessages = [];
    await this.ctx.storage.delete('history');
  }

  getConnectedCount() {
    return this.ctx.getWebSockets().length;
  }

  // FIX 2: count with tags instead of opening every socket's attachment.
  getStats() {
    const homeCount = this.ctx.getWebSockets('team:home').length;
    const awayCount = this.ctx.getWebSockets('team:away').length;
    const occupancy = homeCount + awayCount;
    return {
      occupancy,
      limit: FREE_USER_LIMIT,
      full: occupancy >= FREE_USER_LIMIT,
      homeCount,
      awayCount
    };
  }

  // FIX 2: however many joins/leaves happen, send at most one update per second.
  scheduleStatsBroadcast() {
    if (this.statsTimer) return;
    this.statsTimer = setTimeout(() => {
      this.statsTimer = null;
      this.broadcastStats();
    }, STATS_BROADCAST_DELAY_MS);
  }

  broadcastStats() {
    const payload = JSON.stringify({ type: 'stats', ...this.getStats() });
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload);
      } catch {}
    }
  }

  async webSocketMessage(ws, message) {
    // FIX 7: ignore binary frames and oversized text before doing any work.
    if (typeof message !== 'string' || message.length > MAX_RAW_MESSAGE_LENGTH) return;

    const meta = ws.deserializeAttachment();
    if (!meta) return;

    const match = matches.find((fixture) => fixture.id === meta.matchId);
    if (!match || !this.isMatchLive(match)) {
      try {
        ws.close(1000, 'Match chat window closed');
      } catch {}
      return;
    }

    let data;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }
    if (!data || typeof data !== 'object') return;

    // FIX 3: the rate limit applies to EVERY message type, before any
    // broadcast happens.
    if (!this.checkRateLimit(ws, meta)) {
      try {
        ws.send(
          JSON.stringify({
            type: 'system_error',
            message: 'Slow down! You are sending messages too quickly (max 10 msgs per 10s).'
          })
        );
      } catch {}
      return;
    }

    // Handle Quick Reaction Event
    if (data.type === 'reaction') {
      const emoji = typeof data.emoji === 'string' ? sanitizeText(data.emoji.slice(0, 10)) : '⚽';
      this.broadcast({
        type: 'reaction',
        emoji,
        team: meta.team,
        name: meta.name,
        badge: meta.badge,
        ts: Date.now()
      });
      return;
    }

    // Handle Team Cheer Burst Event
    if (data.type === 'cheer') {
      this.broadcast({
        type: 'cheer',
        team: meta.team,
        name: meta.name,
        ts: Date.now()
      });
      return;
    }

    // Handle Standard Chat Message
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    if (!text || text.length > MAX_MESSAGE_LENGTH) return;

    const payload = {
      type: 'message',
      team: meta.team,
      name: meta.name,
      badge: meta.badge || '⚽',
      text: sanitizeText(text),
      ts: Date.now()
    };

    this.pushToHistory(payload);
    this.broadcast(payload);
  }

  async webSocketClose(ws, _code, _reason, _wasClean) {
    this.scheduleStatsBroadcast();
  }

  async webSocketError(ws, _error) {
    this.scheduleStatsBroadcast();
  }

  checkRateLimit(ws, meta) {
    const now = Date.now();

    if (now - meta.windowStart > RATE_LIMIT_WINDOW_MS) {
      meta.windowStart = now;
      meta.msgCount = 0;
    }

    meta.msgCount += 1;
    ws.serializeAttachment(meta);

    return meta.msgCount <= RATE_LIMIT_MAX_MESSAGES;
  }

  // FIX 1: keep history in memory for speed, and save it to disk (throttled)
  // so it survives hibernation and restarts.
  pushToHistory(payload) {
    this.recentMessages.push(payload);
    if (this.recentMessages.length > HISTORY_LIMIT) {
      this.recentMessages.shift();
    }

    if (!this.saveTimer) {
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null;
        this.ctx.storage.put('history', this.recentMessages);
      }, HISTORY_SAVE_DELAY_MS);
    }
  }

  broadcast(payload) {
    const raw = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(raw);
      } catch {}
    }
  }
}

function sanitizeName(name) {
  return name.slice(0, MAX_NAME_LENGTH).replace(/[<>]/g, '');
}

function sanitizeText(text) {
  return text.replace(/[<>]/g, '');
}