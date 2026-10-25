import { useCallback, useEffect, useRef, useState } from 'react';
import { CHAT_WS_URL } from '../config';

const HTTP_WORKER_URL = import.meta.env.VITE_CHAT_HTTP_URL || 'http://localhost:8787';
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
      if (!CHAT_WS_URL) {
        setStatus('config_error');
        return;
      }

      hasOpenedRef.current = false;
      setStatus('connecting');

      const params = new URLSearchParams({
        team: chosenTeam,
        anonId: anonIdRef.current,
        name: displayName,
        badge: selectedBadge
      });

      const ws = new WebSocket(`${CHAT_WS_URL}/room/${matchId}?${params.toString()}`);
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
      if (!CHAT_WS_URL) {
        setStatus('config_error');
        return;
      }
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

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 p-4 sm:gap-7 sm:p-10">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl shadow-lg shadow-violet-500/20">
            🏟️
          </div>
          <h2 className="text-xl font-bold text-slate-100 sm:text-2xl">Pick Your Match Side</h2>
          <p className="mt-1 text-sm text-slate-400">Choose your team and jump into the conversation.</p>
        </div>

        {/* Profile Card Preview */}
        <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#191a23] p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Your Fan Identity</span>
            <button
              type="button"
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="text-xs font-semibold text-violet-300 hover:text-violet-200 hover:underline"
            >
              {isEditingProfile ? 'Done' : 'Customize'}
            </button>
          </div>

          {!isEditingProfile ? (
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-400/10 text-xl shadow-inner">
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
                    className="w-full rounded-lg border border-white/[0.1] bg-[#101117] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400"
                  />
                  <button
                    type="button"
                    onClick={generateRandomName}
                    title="Randomize handle"
                    className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
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
                          ? 'border-violet-400/40 bg-violet-400/15 text-violet-200'
                          : 'border-white/[0.08] bg-[#101117] text-slate-400 hover:border-white/20'
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
        <div className="grid w-full max-w-sm gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => checkAndJoin('home')}
            className="group relative flex-1 overflow-hidden rounded-2xl border border-sky-300/20 bg-gradient-to-br from-sky-500 to-blue-700 px-5 py-4 font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:brightness-110"
          >
            <div className="relative z-10 flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-[0.18em] text-blue-100/80">I&apos;m backing</span>
              <span className="mt-1 text-base sm:text-lg">{homeTeamName}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => checkAndJoin('away')}
            className="group relative flex-1 overflow-hidden rounded-2xl border border-orange-300/20 bg-gradient-to-br from-orange-500 to-rose-700 px-5 py-4 font-semibold text-white shadow-lg shadow-rose-950/30 transition hover:-translate-y-0.5 hover:brightness-110"
          >
            <div className="relative z-10 flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-[0.18em] text-orange-100/80">I&apos;m backing</span>
              <span className="mt-1 text-base sm:text-lg">{awayTeamName}</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (status === 'checking' || status === 'connecting') {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-white/10 border-t-violet-400" />
        <p className="text-sm font-medium text-slate-300">Entering match arena for {team === 'home' ? homeTeamName : awayTeamName}…</p>
      </div>
    );
  }

  if (status === 'full') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-2xl text-amber-300">
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
          className="mt-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3 font-semibold text-white shadow-lg shadow-violet-950/30 hover:brightness-110"
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
          className="rounded-xl bg-violet-500 px-6 py-2.5 font-semibold text-white hover:bg-violet-400"
        >
          Reconnect
        </button>
      </div>
    );
  }

  if (status === 'config_error') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm font-semibold text-slate-200">Live chat is not configured for this deployment.</p>
        <p className="text-sm text-slate-400">
          Set <code className="rounded bg-white/10 px-1.5 py-0.5 text-violet-300">VITE_CHAT_WS_URL</code> in the frontend build environment and redeploy.
        </p>
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
    <div className="relative flex h-[min(76vh,720px)] min-h-[480px] flex-col bg-[#111219] sm:h-[min(75vh,680px)] sm:min-h-[520px]">
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
      <div className="border-b border-white/[0.07] bg-[#171821] px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Fan Count & Status */}
          <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-end">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-400" />
            </span>
            <span className="text-xs font-semibold text-slate-200">
              {roomStats.occupancy.toLocaleString()} here now
            </span>
          </div>

          {/* User Badge & Profile Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute Arena SFX' : 'Enable Arena SFX'}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold sm:text-xs ${
                soundEnabled ? 'border-violet-400/30 bg-violet-400/10 text-violet-200' : 'border-white/[0.08] bg-white/[0.04] text-slate-400'
              }`}
            >
              {soundEnabled ? '🔊 Sound On' : '🔇 Muted'}
            </button>

            <button
              type="button"
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="flex min-w-0 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08]"
            >
              <span>{selectedBadge}</span>
              <span className="max-w-[34vw] truncate sm:max-w-[120px]">{displayName}</span>
              <span className="hidden max-w-[28vw] truncate text-[10px] text-slate-400 sm:inline">({team === 'home' ? homeTeamName : awayTeamName})</span>
            </button>
          </div>
        </div>

        {/* Rivalry Heatmap Bar */}
        <div className="mt-3">
          <div className="mb-1 flex justify-between gap-2 text-[10px] font-semibold text-slate-400 sm:text-[11px]">
            <span className="truncate text-sky-300">{homeTeamName} ({homePct}%)</span>
            <span className="shrink-0 text-slate-500">Fan split</span>
            <span className="truncate text-orange-300">{awayTeamName} ({awayPct}%)</span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div style={{ width: `${homePct}%` }} className="bg-sky-400 transition-all duration-500" />
            <div style={{ width: `${awayPct}%` }} className="bg-orange-400 transition-all duration-500" />
          </div>
        </div>

        {/* Profile Edit Overlay Modal / Drawer */}
        {isEditingProfile && (
          <div className="mt-3 rounded-xl border border-white/[0.08] bg-[#101117] p-3">
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
                className="flex-1 rounded-lg border border-white/[0.1] bg-[#171821] px-3 py-2 text-xs text-slate-100 outline-none focus:border-violet-400"
              />
              <div className="flex gap-1">
                {BADGES.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBadge(b.id)}
                    className={`rounded-lg border px-2 py-1.5 text-xs ${
                      selectedBadge === b.id ? 'border-violet-400/40 bg-violet-400/15' : 'border-white/[0.08]'
                    }`}
                  >
                    {b.id}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => saveProfile(displayName, selectedBadge)}
                  className="rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-400"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-white/[0.06] bg-[#111219] px-2 py-2 text-xs">
        <button
          type="button"
          onClick={() => setFilterTab('all')}
          className={`shrink-0 rounded-full px-3 py-1.5 font-semibold transition sm:px-4 ${
            filterTab === 'all' ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
          }`}
        >
          All chat
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('home')}
          className={`shrink-0 rounded-full px-3 py-1.5 font-semibold transition sm:px-4 ${
            filterTab === 'home' ? 'bg-sky-400/15 text-sky-200' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
          }`}
        >
          {homeTeamName}
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('away')}
          className={`shrink-0 rounded-full px-3 py-1.5 font-semibold transition sm:px-4 ${
            filterTab === 'away' ? 'bg-orange-400/15 text-orange-200' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
          }`}
        >
          {awayTeamName}
        </button>
      </div>

      {/* System Warning Alert Toast */}
      {systemAlert && (
        <div className="border-b border-amber-400/20 bg-amber-400/10 px-4 py-2 text-center text-xs font-semibold text-amber-200">
          ⚠️ {systemAlert}
        </div>
      )}

      {/* Messages Stream */}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.05),transparent_60%)] p-3 sm:p-5">
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
                className={`group max-w-[86%] rounded-[20px] px-3.5 py-2.5 text-sm shadow-md transition-all sm:max-w-[72%] sm:px-4 ${
                  isMine
                    ? 'rounded-br-md bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-violet-950/20'
                    : isHomeMsg
                    ? 'rounded-bl-md border border-sky-300/10 bg-[#1a1c25] text-slate-100'
                    : 'rounded-bl-md border border-orange-300/10 bg-[#1a1c25] text-slate-100'
                }`}
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] opacity-80">
                  <div className="flex items-center gap-1 font-semibold">
                    <span>{m.badge || '⚽'}</span>
                    <span className={isMine ? 'text-white' : isHomeMsg ? 'text-sky-300' : 'text-orange-300'}>
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
      <div className="flex flex-col items-stretch gap-2 border-t border-white/[0.06] bg-[#171821] px-2.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-1.5 sm:px-4">
        <div className="flex flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
          {REACTION_EMOJIS.map((r) => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => handleSendReaction(r.emoji)}
              aria-label={`Send ${r.label} reaction`}
              className="flex h-9 shrink-0 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs transition hover:border-violet-300/30 hover:bg-violet-400/10 hover:scale-105 active:scale-95"
            >
              <span>{r.emoji}</span>
              <span className="hidden text-[10px] text-slate-400 sm:inline">{r.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSendCheer}
          className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:scale-[1.02] active:scale-95 sm:py-2 ${
            team === 'home' ? 'bg-sky-600 hover:bg-sky-500' : 'bg-orange-600 hover:bg-orange-500'
          }`}
        >
          📣 CHEER!
        </button>
      </div>

      {/* Input Area */}
      <div className="flex gap-2 border-t border-white/[0.06] bg-[#101117] p-2.5 sm:p-3">
        <div className="relative flex-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            maxLength={300}
            placeholder={`Say something as ${displayName}…`}
            aria-label="Chat message"
            className="w-full rounded-xl border border-white/[0.08] bg-[#1a1c25] px-3.5 py-3 pr-14 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/10 sm:px-4"
          />
          <span className="absolute right-3 top-3.5 text-[10px] text-slate-500">
            {draft.length}/300
          </span>
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={!draft.trim()}
          className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-40 sm:px-5"
        >
          Send
        </button>
      </div>
    </div>
  );
}
