import { useCallback, useEffect, useRef, useState } from 'react';

const HTTP_WORKER_URL = import.meta.env.VITE_CHAT_HTTP_URL || 'http://localhost:8787';
const WS_WORKER_URL = import.meta.env.VITE_CHAT_WS_URL || 'ws://localhost:8787';
const WAITLIST_URL = import.meta.env.VITE_WAITLIST_URL || 'https://wa.me/';

const BADGES = [
  { id: '⚽', label: 'Striker' },
  { id: '🛡️', label: 'Defender' },
  { id: '🎯', label: 'Tactician' },
  { id: '🎺', label: 'Superfan' },
  { id: '⚡', label: 'Electric' },
  { id: '🏆', label: 'Legend' }
];

const REACTION_EMOJIS = [
  { emoji: '⚽', label: 'GOAL!' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '📺', label: 'VAR' },
  { emoji: '🟥', label: 'Red Card' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '🪄', label: 'Magic' },
  { emoji: '😂', label: 'LOL' },
  { emoji: '😱', label: 'Shock' }
];

const ADJECTIVES = ['Blue', 'Red', 'Swift', 'Loud', 'Lucky', 'Mighty', 'Sharp', 'Bold', 'Golden', 'Apex'];
const NOUNS = ['Falcon', 'Tiger', 'Striker', 'Keeper', 'Rocket', 'Wolf', 'Eagle', 'Fan', 'Winger', 'Maestro'];

function getAnonId() {
  let id = localStorage.getItem('chat_anon_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('chat_anon_id', id);
  }
  return id;
}

function getRandomName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

function getStoredName() {
  let name = localStorage.getItem('chat_display_name');
  if (!name) {
    name = getRandomName();
    localStorage.setItem('chat_display_name', name);
  }
  return name;
}

function getStoredBadge() {
  return localStorage.getItem('chat_user_badge') || '⚽';
}

function formatTime(ts) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date(ts));
}

// Simple Web Audio API Synthesizer for Match Audio FX
class StadiumAudio {
  static playCheer() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }

  static playGoalHorn() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(300, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }
}

/** @param {{ matchId: string, homeTeamName: string, awayTeamName: string }} props */
export default function ChatRoom({ matchId, homeTeamName, awayTeamName }) {
  const [team, setTeam] = useState(null);
  const [status, setStatus] = useState('idle');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'home' | 'away'
  const [roomStats, setRoomStats] = useState({ occupancy: 0, limit: 10000, homeCount: 0, awayCount: 0 });
  const [systemAlert, setSystemAlert] = useState(null);
  const [displayName, setDisplayName] = useState(getStoredName());
  const [selectedBadge, setSelectedBadge] = useState(getStoredBadge());
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);

  const wsRef = useRef(null);
  const listRef = useRef(null);
  const hasOpenedRef = useRef(false);
  const anonIdRef = useRef(getAnonId());

  const fetchOccupancy = useCallback(async () => {
    try {
      const res = await fetch(`${HTTP_WORKER_URL}/room/${matchId}/status`);
      const data = await res.json();
      if (data) {
        setRoomStats((prev) => ({ ...prev, ...data }));
      }
      return data;
    } catch {
      return null;
    }
  }, [matchId]);

  const addFloatingReaction = useCallback((emoji, teamName) => {
    const id = `${Date.now()}-${Math.random()}`;
    const leftOffset = 20 + Math.random() * 60; // 20% to 80% width
    setFloatingReactions((prev) => [...prev.slice(-15), { id, emoji, teamName, leftOffset }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2000);
  }, []);

  const connect = useCallback(
    (chosenTeam) => {
      hasOpenedRef.current = false;
      setStatus('connecting');

      const params = new URLSearchParams({
        team: chosenTeam,
        anonId: anonIdRef.current,
        name: displayName,
        badge: selectedBadge
      });

      const ws = new WebSocket(`${WS_WORKER_URL}/room/${matchId}?${params.toString()}`);
      wsRef.current = ws;

      ws.onopen = () => {
        hasOpenedRef.current = true;
        setStatus('open');
        fetchOccupancy();
      };

      ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        if (data.type === 'stats') {
          setRoomStats({
            occupancy: data.occupancy || 0,
            limit: data.limit || 10000,
            homeCount: data.homeCount || 0,
            awayCount: data.awayCount || 0
          });
        } else if (data.type === 'message') {
          setMessages((prev) => [...prev.slice(-199), data]);
        } else if (data.type === 'reaction') {
          addFloatingReaction(data.emoji, data.team);
          if (soundEnabled) {
            if (data.emoji === '⚽') StadiumAudio.playGoalHorn();
            else StadiumAudio.playCheer();
          }
        } else if (data.type === 'cheer') {
          addFloatingReaction(data.team === 'home' ? '📣' : '🎺', data.team);
          if (soundEnabled) StadiumAudio.playCheer();
        } else if (data.type === 'system_error') {
          setSystemAlert(data.message);
          setTimeout(() => setSystemAlert(null), 4000);
        }
      };

      ws.onclose = () => {
        setStatus((prev) => (prev === 'full' ? 'full' : hasOpenedRef.current ? 'closed' : 'error'));
      };

      ws.onerror = () => {
        if (!hasOpenedRef.current) setStatus('error');
      };
    },
    [addFloatingReaction, displayName, fetchOccupancy, matchId, selectedBadge, soundEnabled]
  );

  const checkAndJoin = useCallback(
    async (chosenTeam) => {
      setTeam(chosenTeam);
      setStatus('checking');
      const data = await fetchOccupancy();
      if (data?.matchOpen === false) {
        setStatus(data.windowState === 'upcoming' ? 'not_started' : 'closed');
        return;
      }
      if (data?.full) {
        setStatus('full');
        return;
      }
      connect(chosenTeam);
    },
    [connect, fetchOccupancy]
  );

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (status !== 'open') return;
    const interval = setInterval(fetchOccupancy, 15000);
    return () => clearInterval(interval);
  }, [fetchOccupancy, status]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || status !== 'open' || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ text }));
    setDraft('');
  };

  const handleSendReaction = (emoji) => {
    if (status !== 'open' || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'reaction', emoji }));
  };

  const handleSendCheer = () => {
    if (status !== 'open' || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'cheer' }));
  };

  const saveProfile = (newNombre, newBadge) => {
    const trimmed = newNombre.trim() || 'Fan';
    setDisplayName(trimmed);
    setSelectedBadge(newBadge);
    localStorage.setItem('chat_display_name', trimmed);
    localStorage.setItem('chat_user_badge', newBadge);
    setIsEditingProfile(false);
    if (wsRef.current && status === 'open') {
      // Reconnect with new profile info
      wsRef.current.close();
      connect(team);
    }
  };

  const generateRandomName = () => {
    const newName = getRandomName();
    setDisplayName(newName);
  };

  const filteredMessages = messages.filter((m) => {
    if (filterTab === 'home') return m.team === 'home';
    if (filterTab === 'away') return m.team === 'away';
    return true;
  });

  const totalFans = roomStats.homeCount + roomStats.awayCount || 1;
  const homePct = Math.round((roomStats.homeCount / totalFans) * 100) || 50;
  const awayPct = 100 - homePct;

  const homeColor = 'bg-blue-600';
  const awayColor = 'bg-red-600';

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-6 sm:p-10">
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-2xl shadow-lg shadow-emerald-500/20">
            🏟️
          </div>
          <h2 className="text-xl font-bold text-slate-100 sm:text-2xl">Pick Your Match Side</h2>
          <p className="mt-1 text-sm text-slate-400">Join thousands of passionate fans in real-time chat.</p>
        </div>

        {/* Profile Card Preview */}
        <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Your Fan Identity</span>
            <button
              type="button"
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="text-xs font-medium text-emerald-400 hover:underline"
            >
              {isEditingProfile ? 'Done' : 'Customize'}
            </button>
          </div>

          {!isEditingProfile ? (
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-xl shadow-inner">
                {selectedBadge}
              </span>
              <div>
                <p className="font-semibold text-slate-100">{displayName}</p>
                <p className="text-xs text-slate-400">Ready for kickoff</p>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Chat Handle</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={24}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={generateRandomName}
                    title="Randomize handle"
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                  >
                    🎲
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Fan Badge</label>
                <div className="flex flex-wrap gap-2">
                  {BADGES.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBadge(b.id)}
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition ${
                        selectedBadge === b.id
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span>{b.id}</span>
                      <span>{b.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Team Selection Buttons */}
        <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => checkAndJoin('home')}
            className="group relative flex-1 overflow-hidden rounded-2xl bg-blue-600 px-6 py-4 font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 hover:shadow-blue-500/40"
          >
            <div className="relative z-10 flex flex-col items-center">
              <span className="text-xs uppercase tracking-widest text-blue-200">Support</span>
              <span className="text-lg">{homeTeamName}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => checkAndJoin('away')}
            className="group relative flex-1 overflow-hidden rounded-2xl bg-red-600 px-6 py-4 font-semibold text-white shadow-lg shadow-red-600/30 transition hover:bg-red-500 hover:shadow-red-500/40"
          >
            <div className="relative z-10 flex flex-col items-center">
              <span className="text-xs uppercase tracking-widest text-red-200">Support</span>
              <span className="text-lg">{awayTeamName}</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (status === 'checking' || status === 'connecting') {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500" />
        <p className="text-sm font-medium text-slate-300">Entering match arena for {team === 'home' ? homeTeamName : awayTeamName}…</p>
      </div>
    );
  }

  if (status === 'full') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-2xl text-amber-400">
          ⚠️
        </div>
        <h2 className="text-xl font-bold">This Match Room Is Full!</h2>
        <p className="max-w-md text-sm text-slate-400">
          The free stadium limit of {roomStats.limit.toLocaleString()} live fans has been reached for this fixture.
        </p>
        <a
          href={WAITLIST_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500"
        >
          Join VIP Waitlist & Notifications
        </a>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm text-slate-400">Couldn&apos;t establish connection to live chat.</p>
        <button
          type="button"
          onClick={() => checkAndJoin(team)}
          className="rounded-xl bg-blue-600 px-6 py-2.5 font-medium text-white hover:bg-blue-500"
        >
          Reconnect
        </button>
      </div>
    );
  }

  if (status === 'closed') {
    return (
      <div className="p-8 text-center text-sm text-slate-400">
        Chat has concluded for this match.
      </div>
    );
  }

  if (status === 'not_started') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <span className="text-4xl">⏳</span>
        <p className="text-lg font-bold text-slate-200">Chat Opens at Kickoff</p>
        <p className="text-sm text-slate-400">Come back when the match begins.</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-[min(78vh,680px)] min-h-[520px] flex-col bg-slate-950/60 backdrop-blur-md sm:h-[min(75vh,640px)]">
      {/* Floating Reactions Container */}
      <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            style={{ left: `${r.leftOffset}%` }}
            className="animate-float-up absolute bottom-20 text-3xl opacity-90 drop-shadow-md"
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Arena Header & Fan Rivalry Bar */}
      <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-3">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Fan Count & Status */}
          <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-end">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold text-slate-200">
              {roomStats.occupancy.toLocaleString()} Fans Live
            </span>
          </div>

          {/* User Badge & Profile Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute Arena SFX' : 'Enable Arena SFX'}
              className={`rounded-lg px-2 py-1 text-xs border ${
                soundEnabled ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : 'border-slate-800 bg-slate-900 text-slate-400'
              }`}
            >
              {soundEnabled ? '🔊 Sound On' : '🔇 Muted'}
            </button>

            <button
              type="button"
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-slate-700"
            >
              <span>{selectedBadge}</span>
              <span className="max-w-[30vw] truncate sm:max-w-[100px]">{displayName}</span>
              <span className="max-w-[28vw] truncate text-[10px] text-slate-400">({team === 'home' ? homeTeamName : awayTeamName})</span>
            </button>
          </div>
        </div>

        {/* Rivalry Heatmap Bar */}
        <div className="mt-3">
          <div className="mb-1 flex justify-between gap-2 text-[10px] font-semibold text-slate-400 sm:text-[11px]">
            <span className="text-blue-400">{homeTeamName} ({homePct}%)</span>
            <span className="text-slate-500">Rivalry Meter</span>
            <span className="text-red-400">{awayTeamName} ({awayPct}%)</span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div style={{ width: `${homePct}%` }} className="bg-blue-600 transition-all duration-500" />
            <div style={{ width: `${awayPct}%` }} className="bg-red-600 transition-all duration-500" />
          </div>
        </div>

        {/* Profile Edit Overlay Modal / Drawer */}
        {isEditingProfile && (
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Update Profile</span>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Close ✕
              </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                maxLength={24}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-100 focus:outline-none"
              />
              <div className="flex gap-1">
                {BADGES.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBadge(b.id)}
                    className={`rounded-lg px-2 py-1 text-xs border ${
                      selectedBadge === b.id ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-800'
                    }`}
                  >
                    {b.id}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => saveProfile(displayName, selectedBadge)}
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="no-scrollbar flex overflow-x-auto border-b border-slate-800/80 bg-slate-950/40 px-2 py-1.5 text-xs">
        <button
          type="button"
          onClick={() => setFilterTab('all')}
          className={`shrink-0 rounded-lg px-2.5 py-1 font-medium transition sm:px-3 ${
            filterTab === 'all' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Messages
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('home')}
          className={`shrink-0 rounded-lg px-2.5 py-1 font-medium transition sm:px-3 ${
            filterTab === 'home' ? 'bg-blue-600/30 text-blue-300' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {homeTeamName} Fans
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('away')}
          className={`shrink-0 rounded-lg px-2.5 py-1 font-medium transition sm:px-3 ${
            filterTab === 'away' ? 'bg-red-600/30 text-red-300' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {awayTeamName} Fans
        </button>
      </div>

      {/* System Warning Alert Toast */}
      {systemAlert && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs font-semibold text-amber-300">
          ⚠️ {systemAlert}
        </div>
      )}

      {/* Messages Stream */}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
        {filteredMessages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
            <span className="text-3xl">📣</span>
            <p className="text-sm">No messages in this channel yet. Kick off the discussion!</p>
          </div>
        )}
        {filteredMessages.map((m, i) => {
          const isMine = m.team === team;
          const isHomeMsg = m.team === 'home';

          return (
            <div key={`${m.ts}-${i}`} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`group max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-md transition-all sm:max-w-[70%] ${
                  isMine
                    ? isHomeMsg
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-xs'
                      : 'bg-gradient-to-br from-red-600 to-red-700 text-white rounded-br-xs'
                    : isHomeMsg
                    ? 'bg-slate-900 border border-blue-900/40 text-slate-100 rounded-bl-xs'
                    : 'bg-slate-900 border border-red-900/40 text-slate-100 rounded-bl-xs'
                }`}
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] opacity-80">
                  <div className="flex items-center gap-1 font-semibold">
                    <span>{m.badge || '⚽'}</span>
                    <span className={isMine ? 'text-slate-100' : isHomeMsg ? 'text-blue-400' : 'text-red-400'}>
                      {m.name}
                    </span>
                    <span className="text-[10px] opacity-60">
                      ({isHomeMsg ? homeTeamName : awayTeamName})
                    </span>
                  </div>
                  <span className="text-[10px] opacity-60">{formatTime(m.ts)}</span>
                </div>
                <div className="break-words leading-relaxed">{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Reactions Bar */}
      <div className="flex flex-col items-stretch gap-2 border-t border-slate-800/80 bg-slate-900/90 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-1.5">
        <div className="flex flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
          {REACTION_EMOJIS.map((r) => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => handleSendReaction(r.emoji)}
              className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1 text-xs transition hover:border-slate-600 hover:scale-105 active:scale-95"
            >
              <span>{r.emoji}</span>
              <span className="hidden text-[10px] text-slate-400 sm:inline">{r.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSendCheer}
          className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-md transition hover:scale-105 active:scale-95 sm:py-1 ${
            team === 'home' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'
          }`}
        >
          📣 CHEER!
        </button>
      </div>

      {/* Input Area */}
      <div className="flex gap-2 border-t border-slate-800 bg-slate-950 p-2.5 sm:p-3">
        <div className="relative flex-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            maxLength={300}
            placeholder={`Say something as ${displayName}…`}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
          />
          <span className="absolute right-3 top-3 text-[10px] text-slate-500">
            {draft.length}/300
          </span>
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={!draft.trim()}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 sm:px-5"
        >
          Send
        </button>
      </div>
    </div>
  );
}
