import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import MatchCard from '../components/MatchCard';
import { getFixtureStatus, getLocalMatches } from '../data/fixtures';

const TOURNAMENTS = [
  { id: 'premier-league', label: 'Premier League', competition: 'premier league', icon: '🦁' },
  { id: 'champions-league', label: 'UEFA Champions League', competition: 'champions league', icon: '🏆' }
];

function MatchSection({ title, fixtures, now, icon }) {
  if (fixtures.length === 0) return null;

  return (
    <section className="mb-9 sm:mb-12">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-lg">
          {icon}
        </span>
        <h2 className="text-base font-bold tracking-tight text-white sm:text-lg">{title}</h2>
        <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-400">
          {fixtures.length}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {fixtures.map((fixture) => (
          <MatchCard key={fixture.id} fixture={fixture} now={now} />
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const [now, setNow] = useState(() => Date.now());
  const [matches] = useState(() => getLocalMatches());
  const [showInstallHelp, setShowInstallHelp] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatchday, setSelectedMatchday] = useState('all'); // 'all' or matchday number
  const [selectedTournamentId, setSelectedTournamentId] = useState('premier-league');
  const selectedTournament = TOURNAMENTS.find((tournament) => tournament.id === selectedTournamentId);
  const tournamentMatches = matches.filter((fixture) =>
    fixture.competition.toLowerCase().includes(selectedTournament.competition)
  );

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  // Filter the selected tournament by search query and matchday.
  const filteredMatches = tournamentMatches.filter((f) => {
    const matchesSearch =
      !searchQuery.trim() ||
      f.homeTeam.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.awayTeam.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.competition.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesMatchday =
      selectedMatchday === 'all' || f.matchday === Number(selectedMatchday);

    return matchesSearch && matchesMatchday;
  });

  const live = filteredMatches.filter((f) => getFixtureStatus(f, now) === 'live');
  const upcoming = filteredMatches.filter((f) => getFixtureStatus(f, now) === 'upcoming');
  const finished = filteredMatches.filter((f) => getFixtureStatus(f, now) === 'finished');

  // Extract unique matchday numbers for filter dropdown/tabs
  const availableMatchdays = Array.from(
    new Set(tournamentMatches.map((m) => m.matchday).filter(Boolean))
  ).sort((a, b) => a - b);

  return (
    <Layout>
      {showInstallHelp && (
        <aside
          aria-labelledby="install-help-title"
          className="mb-5 rounded-2xl border border-violet-300/15 bg-[#171821] p-4 shadow-lg shadow-black/10 sm:mb-7 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xl text-white"
            >
              +
            </span>
            <button
              type="button"
              aria-label="Dismiss home screen instructions"
              onClick={() => setShowInstallHelp(false)}
              className="order-3 -mr-1 -mt-1 ml-auto shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
            <div className="min-w-0 flex-1">
              <h2 id="install-help-title" className="text-base font-bold leading-tight text-white sm:text-lg">
                Add BallArena to your home screen
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                Get back to the match in one tap. Choose your device:
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <section className="rounded-xl border border-white/[0.07] bg-black/20 p-3.5 sm:p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <span aria-hidden="true" className="text-base">🤖</span>
                Android
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                In <strong className="font-semibold text-white">Chrome</strong>, tap the menu{' '}
                <span className="whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 font-semibold text-white" aria-label="three-dot menu">
                  ⋮
                </span>
                , then choose <strong className="font-semibold text-violet-300">Install app</strong> or{' '}
                <strong className="font-semibold text-violet-300">Add to Home screen</strong>.
              </p>
            </section>
            <section className="rounded-xl border border-white/[0.07] bg-black/20 p-3.5 sm:p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <span aria-hidden="true" className="text-base">📱</span>
                iPhone / iPad
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                Open in <strong className="font-semibold text-white">Safari</strong>. Tap{' '}
                <strong className="font-semibold text-violet-300">Share</strong>{' '}
                <span aria-label="Share button" className="whitespace-nowrap">□↑</span>, then{' '}
                <strong className="font-semibold text-violet-300">Add to Home Screen</strong> →{' '}
                <strong className="font-semibold text-violet-300">Add</strong>.
              </p>
            </section>
          </div>
        </aside>
      )}

      <div className="mb-5 grid grid-cols-2 gap-2" role="tablist" aria-label="Choose tournament">
        {TOURNAMENTS.map((tournament) => {
          const isSelected = tournament.id === selectedTournamentId;
          return (
            <button
              key={tournament.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => {
                setSelectedTournamentId(tournament.id);
                setSearchQuery('');
                setSelectedMatchday('all');
              }}
              aria-label={tournament.label}
              className={`flex min-h-12 items-center justify-center rounded-2xl border px-2 py-2 text-center text-xs font-semibold transition-colors sm:rounded-full sm:px-4 sm:text-sm ${
                isSelected
                  ? 'border-white bg-white text-slate-950 shadow-lg shadow-white/10'
                  : 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              <span className="mr-1.5 shrink-0" aria-hidden="true">{tournament.icon}</span>
              {tournament.label}
            </button>
          );
        })}
      </div>

      {tournamentMatches.length === 0 ? (
        <p className="rounded-3xl border border-white/[0.07] bg-white/[0.03] py-16 text-center text-lg font-semibold text-slate-300">Matches coming soon</p>
      ) : (
        <>
      {/* Tournament Hero Banner */}
      <div className="relative mb-8 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#171821] p-5 shadow-2xl shadow-black/20 sm:mb-10 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-36 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 right-24 h-72 w-72 rounded-full bg-fuchsia-600/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-violet-200 sm:text-xs">
              {selectedTournament.icon} {selectedTournament.label}
            </span>
            <span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[10px] font-semibold text-slate-400 sm:text-xs">
              {tournamentMatches.length} fixtures
            </span>
          </div>
          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                Matchday, <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-orange-200 bg-clip-text text-transparent">together.</span>
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
                Find your match. Pick your side. Join the conversation.
              </p>
            </div>
            <div className="flex gap-2 text-center">
              <div className="min-w-[78px] rounded-2xl border border-white/[0.07] bg-black/20 px-3 py-2.5">
                <div className="text-xl font-black text-white">{live.length}</div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-300">Live</div>
              </div>
              <div className="min-w-[78px] rounded-2xl border border-white/[0.07] bg-black/20 px-3 py-2.5">
                <div className="text-xl font-black text-white">{upcoming.length}</div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Soon</div>
              </div>
              <div className="min-w-[78px] rounded-2xl border border-white/[0.07] bg-black/20 px-3 py-2.5">
                <div className="text-xl font-black text-white">{finished.length}</div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Final</div>
              </div>
            </div>
          </div>

        {/* Search & Matchday Filter Bar */}
        <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search teams or competition"
              aria-label="Search teams or competition"
              className="w-full rounded-2xl border border-white/[0.08] bg-black/25 px-4 py-3.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/10 sm:py-3"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-3 text-sm text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 sm:w-auto">
            <label className="text-xs font-medium text-slate-400 shrink-0">Round</label>
            <select
              value={selectedMatchday}
              onChange={(e) => setSelectedMatchday(e.target.value)}
              className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-[#101117] px-3 py-3.5 text-sm font-semibold text-slate-200 outline-none focus:border-violet-400/60 sm:flex-none sm:py-3"
            >
              <option value="all">All Matchdays ({tournamentMatches.length})</option>
              {availableMatchdays.map((md) => (
                <option key={md} value={md}>
                  Matchday {md}
                </option>
              ))}
            </select>
          </div>
        </div>
        </div>
      </div>

      {filteredMatches.length === 0 ? (
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-8 text-center">
          <p className="text-slate-400">No {selectedTournament.label} matches found matching your search filter.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedMatchday('all');
            }}
            className="mt-3 text-xs font-semibold text-violet-300 hover:underline"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          <MatchSection title={`Live ${selectedTournament.label} Matches`} fixtures={live} now={now} icon="⚡" />
          <MatchSection title={`Upcoming ${selectedTournament.label} Fixtures`} fixtures={upcoming} now={now} icon="📅" />
          <MatchSection title={`Completed ${selectedTournament.label} Matches`} fixtures={finished} now={now} icon="🏆" />
        </>
      )}
        </>
      )}
    </Layout>
  );
}
