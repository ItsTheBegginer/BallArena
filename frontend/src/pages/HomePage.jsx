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
    <section className="mb-8">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">{title}</h2>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-400">
          {fixtures.length}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-1">
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
          className="mb-4 rounded-2xl border border-emerald-500/30 bg-slate-900 p-4 shadow-lg shadow-black/10 sm:mb-6 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-xl text-emerald-300"
            >
              +
            </span>
            <button
              type="button"
              aria-label="Dismiss home screen instructions"
              onClick={() => setShowInstallHelp(false)}
              className="order-3 -mr-1 -mt-1 ml-auto shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
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
            <section className="rounded-xl border border-slate-700 bg-slate-950/70 p-3.5 sm:p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <span aria-hidden="true" className="text-base">🤖</span>
                Android
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                In <strong className="font-semibold text-white">Chrome</strong>, tap the menu{' '}
                <span className="whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 font-semibold text-white" aria-label="three-dot menu">
                  ⋮
                </span>
                , then choose <strong className="font-semibold text-emerald-300">Install app</strong> or{' '}
                <strong className="font-semibold text-emerald-300">Add to Home screen</strong>.
              </p>
            </section>
            <section className="rounded-xl border border-slate-700 bg-slate-950/70 p-3.5 sm:p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <span aria-hidden="true" className="text-base">📱</span>
                iPhone / iPad
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                Open in <strong className="font-semibold text-white">Safari</strong>. Tap{' '}
                <strong className="font-semibold text-emerald-300">Share</strong>{' '}
                <span aria-label="Share button" className="whitespace-nowrap">□↑</span>, then{' '}
                <strong className="font-semibold text-emerald-300">Add to Home Screen</strong> →{' '}
                <strong className="font-semibold text-emerald-300">Add</strong>.
              </p>
            </section>
          </div>
        </aside>
      )}

      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Choose tournament">
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
              className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${
                isSelected
                  ? 'border-emerald-400 bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
            >
              <span className="mr-2" aria-hidden="true">{tournament.icon}</span>
              {tournament.label}
            </button>
          );
        })}
      </div>

      {tournamentMatches.length === 0 ? (
        <p className="py-12 text-center text-lg font-semibold text-slate-300">Matches coming soon</p>
      ) : (
        <>
      {/* Tournament Hero Banner */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 p-4 shadow-2xl sm:mb-8 sm:rounded-3xl sm:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400 sm:px-3 sm:text-xs">
                {selectedTournament.icon} {selectedTournament.label.toUpperCase()}
              </span>
              <span className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-0.5 text-[10px] font-semibold text-slate-400">
                {tournamentMatches.length} Matches Loaded
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-4xl">
              {selectedTournament.label} Arena
            </h1>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Live fixtures and fan chat rooms for {selectedTournament.label}.
            </p>
          </div>
        </div>

        {/* Search & Matchday Filter Bar */}
        <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team (e.g. Arsenal, Man City, Liverpool)..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950/90 px-3.5 py-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none shadow-inner sm:px-4 sm:py-2.5"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 sm:justify-start">
            <label className="text-xs font-medium text-slate-400 shrink-0">Matchday:</label>
            <select
              value={selectedMatchday}
              onChange={(e) => setSelectedMatchday(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-slate-200 focus:border-emerald-500 focus:outline-none sm:flex-none"
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

      {filteredMatches.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
          <p className="text-slate-400">No {selectedTournament.label} matches found matching your search filter.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedMatchday('all');
            }}
            className="mt-3 text-xs font-semibold text-emerald-400 hover:underline"
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
