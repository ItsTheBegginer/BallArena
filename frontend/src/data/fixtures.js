import matches from './matches.json';

export function getLocalMatches() {
  return matches;
}

export function getFixtures() {
  return getLocalMatches();
}

export function getFixtureById(id) {
  return getLocalMatches().find((fixture) => fixture.id === id) ?? null;
}

export function getFixtureStatus(fixture, now = Date.now()) {
  if (now < fixture.kickoff) return 'upcoming';
  if (now < fixture.end) return 'live';
  return 'finished';
}

export function formatKickoff(ts) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(ts));
}

export function getMatchMinute(fixture, now = Date.now()) {
  if (now < fixture.kickoff) return null;
  const elapsed = Math.floor((now - fixture.kickoff) / 60000);
  return Math.min(elapsed, 90);
}
