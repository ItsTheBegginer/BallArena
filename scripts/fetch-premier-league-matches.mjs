import { readFile, writeFile, open, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(projectRoot, 'frontend/.env.development');
const outputPath = resolve(projectRoot, 'frontend/src/data/matches.json');
const workerOutputPath = resolve(projectRoot, 'worker/src/matches.json');
const rootEnvPath = resolve(projectRoot, '.env');
const rateLimitStatePath = resolve(projectRoot, 'scripts/.football-api-fetch-state.json');
const lockPath = resolve(projectRoot, 'scripts/.football-api-fetch.lock');
const MIN_FETCH_INTERVAL_MS = 60 * 1000;
const COMPETITIONS = {
  PL: {
    idPrefix: 'pl',
    label: 'Premier League',
    cutoff: Date.parse('2027-01-02T00:00:00Z')
  },
  CL: {
    idPrefix: 'cl',
    label: 'UEFA Champions League',
    cutoff: Date.parse('2027-01-01T00:00:00Z')
  }
};
const competitionCode = process.argv[2] || 'PL';
const selectedCompetition = COMPETITIONS[competitionCode];
const apiUrl = `https://api.football-data.org/v4/competitions/${competitionCode}/matches`;

async function readApiKey() {
  const environmentKey = process.env.FOOTBALL_API_KEY?.trim() || process.env.VITE_FOOTBALL_API_KEY?.trim();
  if (environmentKey) return environmentKey;

  for (const path of [rootEnvPath, envPath]) {
    try {
      const content = await readFile(path, 'utf8');
      const line = content.split(/\r?\n/).find((entry) =>
        entry.startsWith('FOOTBALL_API_KEY=') || entry.startsWith('VITE_FOOTBALL_API_KEY=')
      );
      const key = line?.slice(line.indexOf('=') + 1).trim().replace(/^['\"]|['\"]$/g, '');
      if (key) return key;
    } catch {}
  }

  return '';
}

function toFixture(match, competition) {
  const kickoff = new Date(match.utcDate).getTime();
  const matchday = match.matchday ? ` · Matchday ${match.matchday}` : '';

  return {
    id: `${competition.idPrefix}-${match.id}`,
    homeTeam: match.homeTeam?.shortName || match.homeTeam?.name || 'Home Team',
    awayTeam: match.awayTeam?.shortName || match.awayTeam?.name || 'Away Team',
    competition: `${competition.label}${matchday}`,
    venue: `${competition.label} Stadium`,
    kickoff,
    end: kickoff + 105 * 60 * 1000,
    homeScore: null,
    awayScore: null,
    matchday: match.matchday,
    apiStatus: match.status,
    chatEnabled: true
  };
}

async function main() {
  if (!selectedCompetition) {
    throw new Error(`Unsupported competition "${competitionCode}". Use PL or CL.`);
  }

  const token = await readApiKey();
  if (!token) {
    throw new Error('Missing FOOTBALL_API_KEY or VITE_FOOTBALL_API_KEY in frontend/.env.development');
  }

  let lock;
  try {
    lock = await open(lockPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error('Another fixture fetch is already running. No API call was made.');
    }
    throw error;
  }

  try {
    let lastAttemptAt = 0;
    try {
      const state = JSON.parse(await readFile(rateLimitStatePath, 'utf8'));
      lastAttemptAt = Number(state.lastAttemptAt) || 0;
    } catch {}

    const elapsed = Date.now() - lastAttemptAt;
    if (elapsed < MIN_FETCH_INTERVAL_MS) {
      const waitSeconds = Math.ceil((MIN_FETCH_INTERVAL_MS - elapsed) / 1000);
      throw new Error(`Free-tier cooldown active. Try again in ${waitSeconds} seconds. No API call was made.`);
    }

    // Record the attempt before calling the API so failures cannot cause rapid retries.
    await writeFile(rateLimitStatePath, `${JSON.stringify({ lastAttemptAt: Date.now() })}\n`, 'utf8');

  const response = await fetch(apiUrl, {
    headers: { 'X-Auth-Token': token }
  });

  if (response.status === 429) {
    throw new Error('Football-Data API rate limit reached. No local file was changed.');
  }
  if (!response.ok) {
    throw new Error(`Football-Data API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const now = Date.now();
  const matches = (Array.isArray(data.matches) ? data.matches : [])
    .map((match) => toFixture(match, selectedCompetition))
    .filter(
      (match) =>
        match.kickoff > now &&
        match.kickoff < selectedCompetition.cutoff &&
        ['SCHEDULED', 'TIMED'].includes(match.apiStatus)
    )
    .sort((first, second) => first.kickoff - second.kickoff);

  const existingMatches = JSON.parse(await readFile(outputPath, 'utf8'));
  if (!Array.isArray(existingMatches)) {
    throw new Error(`${outputPath} must contain a JSON array.`);
  }

  const refreshedPrefix = `${selectedCompetition.idPrefix}-`;
  const combinedMatches = [
    ...existingMatches.filter((match) => !String(match.id).startsWith(refreshedPrefix)),
    ...matches
  ].sort((first, second) => first.kickoff - second.kickoff);

  await writeFile(outputPath, `${JSON.stringify(combinedMatches, null, 2)}\n`, 'utf8');
  await writeFile(workerOutputPath, `${JSON.stringify(combinedMatches, null, 2)}\n`, 'utf8');
  console.log(`Stored ${matches.length} upcoming ${selectedCompetition.label} matches in ${outputPath}`);
  console.log(`Combined fixture list contains ${combinedMatches.length} matches.`);
  console.log('Review matches.json and delete any fixtures that should not have a chat room.');
  console.log('Run npm run sync:matches after manual deletions to update the Worker schedule.');
  } finally {
    await lock.close();
    await unlink(lockPath).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
