import { get } from '../fetch.js';
import { fit, wrap } from '../text.js';

const ymd = () => new Date().toISOString().slice(0, 10);

export async function mlbStandings() {
  const year = new Date().getUTCFullYear();
  const j = await get(`https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${year}&standingsTypes=regularSeason&hydrate=division,team`, 600);
  const blocks = (j.records ?? []).map((div) => {
    const name = div.division?.nameShort ?? div.division?.name ?? 'Division';
    const rows = (div.teamRecords ?? []).map((t, i) => {
      const w = t.leagueRecord?.wins ?? t.wins ?? 0;
      const l = t.leagueRecord?.losses ?? t.losses ?? 0;
      const gb = t.gamesBack ?? '-';
      return `{${i === 0 ? 'y' : 'w'}}${String(i + 1).padStart(2)} {w}${fit(t.team?.name ?? t.team?.clubName ?? '?', 16)}{g}${String(w).padStart(4)}{r}${String(l).padStart(4)} {c}${fit(String(gb), 5, true)}{w}${fit(t.leagueRecord?.pct ?? '', 6, true)}`;
    });
    return [`{y}${name}`, '{c}   Club              W   L    GB   Pct', ...rows, ''];
  });
  if (!blocks.length) throw new Error('No MLB standings');
  return { blocks, source: 'MLB StatsAPI' };
}

export async function mlbScores() {
  const j = await get(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${ymd()}&hydrate=linescore,team`, 120);
  const games = (j.dates ?? []).flatMap((d) => d.games ?? []);
  if (!games.length) return { blocks: [['{w}No MLB games today.']], source: 'MLB StatsAPI' };
  const rows = games.map((g) => {
    const a = g.teams?.away, h = g.teams?.home;
    const st = g.status?.abstractGameState === 'Live' ? 'r' : g.status?.abstractGameState === 'Final' ? 'y' : 'c';
    const as = a?.score != null ? String(a.score) : '-';
    const hs = h?.score != null ? String(h.score) : '-';
    return `{${st}}${fit(g.status?.detailedState ?? '', 8)} {w}${fit(a?.team?.abbreviation ?? a?.team?.teamName, 11, true)} {y}${as.padStart(2)}-${hs.padEnd(2)} {w}${fit(h?.team?.abbreviation ?? h?.team?.teamName, 11)}`;
  });
  return { blocks: [[`{c}${ymd()}  ${games.length} games`, ...rows]], source: 'MLB StatsAPI' };
}

export { wrap };
