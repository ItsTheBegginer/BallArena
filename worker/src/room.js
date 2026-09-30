import matches from './matches.json';

// RoomObject: one Durable Object instance per match.
// Uses the Hibernatable WebSocket API so idle connections (users just
// reading, not typing) cost nothing while the room is quiet.

const FREE_USER_LIMIT = 10000;
const MAX_MESSAGE_LENGTH = 300;
const MAX_NAME_LENGTH = 24;
const RATE_LIMIT_WINDOW_MS = 10000;
const RATE_LIMIT_MAX_MESSAGES = 10;
const HISTORY_LIMIT = 50;

export class RoomObject {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.recentMessages = [];
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
    const badge = url.searchParams.get('badge') || '⚽';

    if (team !== 'home' && team !== 'away') {
      return new Response('Query param "team" must be "home" or "away"', { status: 400 });
    }
    if (!anonId) {
      return new Response('Query param "anonId" is required', { status: 400 });
    }

    const currentCount = this.getConnectedCount();
    if (currentCount >= FREE_USER_LIMIT) {
      return Response.json(
        { error: 'room_full', occupancy: currentCount, limit: FREE_USER_LIMIT },
        { status: 403 }
      );
    }

    const name = sanitizeName(rawName);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server, [`team:${team}`]);
    await this.ctx.storage.setAlarm(match.end);

    server.serializeAttachment({
      matchId: match.id,
      team,
      name,
      badge: badge.slice(0, 4),
      anonId,
      joinedAt: Date.now(),
      msgCount: 0,
      windowStart: Date.now()
    });

    // Send initial statistics
    const stats = this.getStats();
    server.send(JSON.stringify({ type: 'stats', ...stats }));

    // Send chat history
    for (const msg of this.recentMessages) {
      server.send(JSON.stringify(msg));
    }

    // Broadcast updated stats to all users asynchronously
    this.broadcastStats();

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
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.close(1000, 'Match chat window closed');
      } catch {}
    }
  }

  getConnectedCount() {
    return this.ctx.getWebSockets().length;
  }

  getStats() {
    const sockets = this.ctx.getWebSockets();
    let homeCount = 0;
    let awayCount = 0;

    for (const socket of sockets) {
      try {
        const meta = socket.deserializeAttachment();
        if (meta?.team === 'home') homeCount++;
        else if (meta?.team === 'away') awayCount++;
      } catch {}
    }

    const occupancy = sockets.length;
    return {
      occupancy,
      limit: FREE_USER_LIMIT,
      full: occupancy >= FREE_USER_LIMIT,
      homeCount,
      awayCount
    };
  }

  broadcastStats() {
    const stats = this.getStats();
    const payload = JSON.stringify({ type: 'stats', ...stats });
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload);
      } catch {}
    }
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== 'string') return;

    const meta = ws.deserializeAttachment();
    const match = matches.find((fixture) => fixture.id === meta?.matchId);
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

    if (!meta) return;

    // Handle Quick Reaction Event
    if (data.type === 'reaction') {
      const emoji = typeof data.emoji === 'string' ? data.emoji.slice(0, 10) : '⚽';
      const payload = {
        type: 'reaction',
        emoji,
        team: meta.team,
        name: meta.name,
        badge: meta.badge,
        ts: Date.now()
      };
      this.broadcast(payload);
      return;
    }

    // Handle Team Cheer Burst Event
    if (data.type === 'cheer') {
      const payload = {
        type: 'cheer',
        team: meta.team,
        name: meta.name,
        ts: Date.now()
      };
      this.broadcast(payload);
      return;
    }

    // Handle Standard Chat Message
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    if (!text || text.length > MAX_MESSAGE_LENGTH) return;

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
    this.broadcastStats();
  }

  async webSocketError(ws, _error) {
    this.broadcastStats();
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

  pushToHistory(payload) {
    this.recentMessages.push(payload);
    if (this.recentMessages.length > HISTORY_LIMIT) {
      this.recentMessages.shift();
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

