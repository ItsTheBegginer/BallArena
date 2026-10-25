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
        <div className="rounded-3xl border border-white/[0.07] bg-[#15161e] p-8 text-center">
          <p className="text-slate-400">Premier League match not found.</p>
          <Link to="/" className="mt-4 inline-block text-violet-300 hover:text-violet-200">
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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
        <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
          <span aria-hidden="true">←</span> All matches
        </Link>

        {chatEnabled ? (
          status === 'live' && (
            <span className="flex items-center gap-1.5 rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1.5 text-[10px] font-bold tracking-wide text-rose-300 sm:text-xs">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
              <span className="hidden sm:inline">LIVE STADIUM FAN ARENA</span>
              <span className="sm:hidden">LIVE ARENA</span>
            </span>
          )
        ) : (
          <span className="flex items-center gap-1.5 rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1.5 text-[10px] font-bold tracking-wide text-rose-300 sm:text-xs">
            🚫 CHAT ROOM DISABLED
          </span>
        )}
      </div>

      {/* Match Score & Stadium Header */}
      <div className="relative mb-5 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#171821] p-4 shadow-xl shadow-black/20 sm:mb-7 sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-32 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:text-xs">
          <span className="text-violet-300">{fixture.competition}</span>
          <span className="truncate">{fixture.venue}</span>
        </div>

        <div className="relative mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:mt-8 sm:gap-5">
          <div className="flex min-w-0 flex-col items-center gap-2.5 text-center sm:gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-violet-300/15 bg-gradient-to-br from-violet-400/25 to-fuchsia-500/10 text-xl font-black text-violet-100 shadow-lg shadow-violet-950/30 sm:h-20 sm:w-20 sm:text-3xl">
              {fixture.homeTeam.slice(0, 1)}
            </span>
            <p className="w-full break-words text-sm font-black leading-tight text-white sm:text-2xl">{fixture.homeTeam}</p>
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 sm:text-[10px]">Home</span>
          </div>

          <div className="flex shrink-0 flex-col items-center justify-center px-1">
            <div className="rounded-2xl border border-white/[0.08] bg-black/25 px-3 py-2 text-xl font-black tracking-wider text-white shadow-inner sm:px-6 sm:py-3 sm:text-4xl">
              {hasScore ? `${fixture.homeScore} : ${fixture.awayScore}` : 'VS'}
            </div>
            <div className="mt-2">
              {status === 'live' && minute !== null ? (
                <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 text-[9px] font-bold tracking-wide text-rose-300 sm:text-xs">
                  {minute}&apos; LIVE
                </span>
              ) : (
                <span className="text-center text-[10px] font-medium text-slate-400 sm:text-xs">{formatKickoff(fixture.kickoff)}</span>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col items-center gap-2.5 text-center sm:gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-orange-300/15 bg-gradient-to-br from-orange-300/25 to-rose-500/10 text-xl font-black text-orange-100 shadow-lg shadow-rose-950/30 sm:h-20 sm:w-20 sm:text-3xl">
              {fixture.awayTeam.slice(0, 1)}
            </span>
            <p className="w-full break-words text-sm font-black leading-tight text-white sm:text-2xl">{fixture.awayTeam}</p>
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 sm:text-[10px]">Away</span>
          </div>
        </div>
      </div>

      {/* Main Chat / Status Section */}
      <div className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#12131a] shadow-xl shadow-black/20">
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
