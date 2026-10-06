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
