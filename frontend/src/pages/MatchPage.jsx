import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ChatRoom from '../components/ChatRoom';
import Layout from '../components/Layout';
import {
  formatKickoff,
  getFixtureById,
  getFixtureStatus,
  getMatchMinute
} from '../data/fixtures';

export default function MatchPage() {
  const { matchId } = useParams();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  const fixture = matchId ? getFixtureById(matchId, now) : null;

  if (!fixture) {
    return (
      <Layout>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
          <p className="text-slate-400">Premier League match not found.</p>
          <Link to="/" className="mt-4 inline-block text-emerald-400 hover:text-emerald-300">
            ← Back to Premier League matches
          </Link>
        </div>
      </Layout>
    );
  }

  const status = getFixtureStatus(fixture, now);
  const minute = getMatchMinute(fixture, now);
  const hasScore = typeof fixture.homeScore === 'number' && typeof fixture.awayScore === 'number';
  const chatEnabled = fixture.chatEnabled !== false;

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200">
          <span>←</span> Premier League Matches
        </Link>

        {chatEnabled ? (
          status === 'live' && (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="hidden sm:inline">LIVE STADIUM FAN ARENA</span>
              <span className="sm:hidden">LIVE ARENA</span>
            </span>
          )
        ) : (
          <span className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-400">
            🚫 CHAT ROOM DISABLED
          </span>
        )}
      </div>

      {/* Match Score & Stadium Header */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 p-4 shadow-2xl sm:mb-6 sm:p-6">
        <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-emerald-400">{fixture.competition}</span>
          <span>{fixture.venue}</span>
        </div>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:flex sm:gap-4">
          {/* Home Team */}
          <div className="flex flex-1 flex-col items-end text-right">
            <div className="flex items-center gap-3">
              <p className="break-words text-lg font-black text-slate-100 sm:text-2xl">{fixture.homeTeam}</p>
            </div>
            <span className="text-xs text-blue-400 font-medium">Home Squad</span>
          </div>

          {/* Score & Time */}
          <div className="flex shrink-0 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950 px-5 py-3 shadow-inner">
            <div className="text-xl font-black tracking-wider text-slate-100 sm:text-3xl">
              {hasScore ? `${fixture.homeScore} : ${fixture.awayScore}` : 'VS'}
            </div>
            <div className="mt-1">
              {status === 'live' && minute !== null ? (
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                  {minute}&apos; IN PLAY
                </span>
              ) : (
                <span className="text-xs text-slate-400 font-medium">{formatKickoff(fixture.kickoff)}</span>
              )}
            </div>
          </div>

          {/* Away Team */}
          <div className="flex flex-1 flex-col items-start text-left">
            <div className="flex items-center gap-3">
              <p className="break-words text-lg font-black text-slate-100 sm:text-2xl">{fixture.awayTeam}</p>
            </div>
            <span className="text-xs text-red-400 font-medium">Away Squad</span>
          </div>
        </div>
      </div>

      {/* Main Chat / Status Section */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl">
        {!chatEnabled ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <span className="text-4xl">🚫</span>
            <p className="text-lg font-bold text-slate-200">Chat Room Not Enabled</p>
            <p className="max-w-md text-sm text-slate-400">
              A live fan chat room is not currently assigned to this Premier League match.
            </p>
            <Link
              to="/"
              className="mt-2 rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            >
              Back to Premier League Matches
            </Link>
          </div>
        ) : status === 'upcoming' ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center sm:p-12">
            <span className="text-4xl">⏳</span>
            <p className="text-lg font-bold text-slate-200">Chat Starts at Kickoff</p>
            <p className="text-sm text-slate-400">
              Fan chat will open when the match begins at {formatKickoff(fixture.kickoff)}.
            </p>
          </div>
        ) : status === 'finished' ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center sm:p-12">
            <span className="text-4xl">🏁</span>
            <p className="text-lg font-bold text-slate-200">Chat Closed</p>
            <p className="text-sm text-slate-400">Fan chat is closed because this match has ended.</p>
          </div>
        ) : (
          <ChatRoom matchId={fixture.id} homeTeamName={fixture.homeTeam} awayTeamName={fixture.awayTeam} />
        )}
      </div>
    </Layout>
  );
}
