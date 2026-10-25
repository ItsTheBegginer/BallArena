import { Link } from 'react-router-dom';
import { formatKickoff, getFixtureStatus, getMatchMinute } from '../data/fixtures';

const STATUS_STYLES = {
  live: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  upcoming: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  finished: 'border-white/[0.08] bg-white/[0.04] text-slate-400'
};

const STATUS_LABELS = {
  live: 'LIVE',
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
      className="group relative block overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#15161e] p-4 transition duration-300 hover:-translate-y-1 hover:border-violet-300/25 hover:bg-[#191a24] hover:shadow-xl hover:shadow-violet-950/30 sm:p-5"
    >
      <div className="mb-5 flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 sm:text-[11px]">
          {fixture.competition}
        </span>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider sm:text-[10px] ${STATUS_STYLES[status]}`}>
          {status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-300" />}
          {status === 'live' && minute !== null ? `${STATUS_LABELS.live} · ${minute}'` : STATUS_LABELS[status]}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 sm:gap-2">
        <div className="flex min-w-0 flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-300/10 bg-gradient-to-br from-violet-400/20 to-fuchsia-400/10 text-base font-black text-violet-100 shadow-inner sm:h-14 sm:w-14 sm:text-lg">
            {fixture.homeTeam.slice(0, 1)}
          </span>
          <p className="w-full truncate text-xs font-bold text-white transition-colors group-hover:text-violet-200 sm:text-sm">
            {fixture.homeTeam}
          </p>
        </div>

        <div className="flex min-w-[58px] flex-col items-center px-1 text-center">
          <span className="rounded-xl border border-white/[0.07] bg-black/25 px-3 py-2 text-sm font-black tabular-nums text-white sm:px-4 sm:text-base">
            {hasScore ? `${fixture.homeScore} - ${fixture.awayScore}` : 'VS'}
          </span>
          <span className="mt-1.5 max-w-[90px] truncate text-[9px] font-medium text-slate-500">
            {status === 'upcoming' ? formatKickoff(fixture.kickoff) : status === 'live' ? 'Match in progress' : 'Final score'}
          </span>
        </div>

        <div className="flex min-w-0 flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-300/10 bg-gradient-to-br from-orange-300/20 to-rose-400/10 text-base font-black text-orange-100 shadow-inner sm:h-14 sm:w-14 sm:text-lg">
            {fixture.awayTeam.slice(0, 1)}
          </span>
          <p className="w-full truncate text-xs font-bold text-white transition-colors group-hover:text-violet-200 sm:text-sm">
            {fixture.awayTeam}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
        <span
          className={`inline-flex min-w-0 items-center gap-1.5 truncate text-[10px] font-semibold sm:text-[11px] ${
            chatEnabled ? 'text-violet-300' : 'text-slate-500'
          }`}
        >
          <span aria-hidden="true">{chatEnabled ? '●' : '○'}</span>
          {chatEnabled ? 'Fan chat' : 'Chat unavailable'}
        </span>
        <span className="shrink-0 text-[10px] font-medium text-slate-500 sm:text-[11px]">
          {fixture.venue}
        </span>
      </div>
    </Link>
  );
}
