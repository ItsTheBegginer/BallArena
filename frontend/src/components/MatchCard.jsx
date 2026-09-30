import { Link } from 'react-router-dom';
import { formatKickoff, getFixtureStatus, getMatchMinute } from '../data/fixtures';

const STATUS_STYLES = {
  live: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse',
  upcoming: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  finished: 'bg-slate-500/20 text-slate-400 border-slate-500/40'
};

const STATUS_LABELS = {
  live: 'LIVE ARENA',
  upcoming: 'Upcoming',
  finished: 'Full Time'
};

/**
 * @param {{
 *   fixture: import('../data/fixtures.types').Fixture,
 *   now: number
 * }} props
 */
export default function MatchCard({ fixture, now }) {
  const status = getFixtureStatus(fixture, now);
  const minute = getMatchMinute(fixture, now);
  const hasScore = typeof fixture.homeScore === 'number' && typeof fixture.awayScore === 'number';
  const chatEnabled = fixture.chatEnabled !== false;

  return (
    <Link
      to={`/match/${fixture.id}`}
      className="group relative block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900 hover:shadow-xl hover:shadow-emerald-500/5 sm:p-5"
    >
      <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            {fixture.competition}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
              chatEnabled
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-800 bg-slate-950 text-slate-500'
            }`}
          >
            {chatEnabled ? '💬 Fan Arena Active' : '🚫 Chat Unavailable'}
          </span>
        </div>

        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold sm:px-3 sm:py-0.5 sm:text-[11px] ${STATUS_STYLES[status]}`}>
          {status === 'live' && minute !== null ? `${STATUS_LABELS.live} · ${minute}'` : STATUS_LABELS[status]}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 py-2 sm:flex sm:gap-4">
        {/* Home Team */}
        <div className="flex items-center justify-end gap-3 min-w-0 flex-1 text-right">
          <p className="truncate text-lg font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
            {fixture.homeTeam}
          </p>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-400 shrink-0">
            {fixture.homeTeam.slice(0, 1)}
          </span>
        </div>

        {/* Score */}
        <div className="flex shrink-0 items-center justify-center rounded-xl bg-slate-950 px-3.5 py-1 text-base font-extrabold text-slate-200 border border-slate-800 shadow-inner">
          {hasScore ? `${fixture.homeScore} - ${fixture.awayScore}` : 'VS'}
        </div>

        {/* Away Team */}
        <div className="flex items-center justify-start gap-3 min-w-0 flex-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-400 shrink-0">
            {fixture.awayTeam.slice(0, 1)}
          </span>
          <p className="truncate text-lg font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
            {fixture.awayTeam}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1 border-t border-slate-800/80 pt-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>📍 {fixture.venue}</span>
        <span>🕒 {formatKickoff(fixture.kickoff)}</span>
      </div>
    </Link>
  );
}
