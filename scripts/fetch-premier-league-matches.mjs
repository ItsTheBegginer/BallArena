import { readFile, writeFile, open, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(projectRoot, 'frontend/.env.development');
const outputPath = resolve(projectRoot, 'frontend/src/data/matches.json');
const workerOutputPath = resolve(projectRoot, 'worker/src/matches.json');
const rateLimitStatePath = resolve(projectRoot, 'scripts/.football-api-fetch-state.json');
const lockPath = resolve(projectRoot, 'scripts/.football-api-fetch.lock');
const apiUrl = 'https://api.football-data.org/v4/competitions/PL/matches';
const MIN_FETCH_INTERVAL_MS = 60 * 1000;
const MATCH_CUTOFF_TIMESTAMP = Date.parse('2027-01-02T00:00:00Z');

function readApiKey() {
  if (process.env.FOOTBALL_API_KEY) return process.env.FOOTBALL_API_KEY.trim();

  return readFile(envPath, 'utf8')
    .then((content) => {
      const line = content.split(/\r?\n/).find((entry) => entry.startsWith('VITE_FOOTBALL_API_KEY='));
      return line?.slice('VITE_FOOTBALL_API_KEY='.length).trim().replace(/^["']|["']$/g, '') || '';
    })
    .catch(() => '');
}

function toFixture(match) {
  const kickoff = new Date(match.utcDate).getTime();

  return {
    id: `pl-${match.id}`,
    homeTeam: match.homeTeam?.shortName || match.homeTeam?.name || 'Home Team',
    awayTeam: match.awayTeam?.shortName || match.awayTeam?.name || 'Away Team',
    competition: `Premier League · Matchday ${match.matchday || ''}`,
    venue: 'Premier League Stadium',
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
  let lock;
  try {
    lock = await open(lockPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error('Another Premier League fetch is already running. No API call was made.');
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

  const token = await readApiKey();
  if (!token) {
    throw new Error('Missing FOOTBALL_API_KEY or VITE_FOOTBALL_API_KEY in frontend/.env.development');
  }

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
    .map(toFixture)
    .filter(
      (match) =>
        match.kickoff > now &&
        match.kickoff < MATCH_CUTOFF_TIMESTAMP &&
        ['SCHEDULED', 'TIMED'].includes(match.apiStatus)
    )
    .sort((first, second) => first.kickoff - second.kickoff);

  await writeFile(outputPath, `${JSON.stringify(matches, null, 2)}\n`, 'utf8');
  await writeFile(workerOutputPath, `${JSON.stringify(matches, null, 2)}\n`, 'utf8');
  console.log(`Stored ${matches.length} upcoming Premier League matches in ${outputPath}`);
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
