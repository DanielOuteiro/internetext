import { get } from '../fetch.js';
import { fit } from '../text.js';

const ymd = () => new Date().toISOString().slice(0, 10);

export async function nhlStandings() {
  const j = await get(`https://api-web.nhle.com/v1/standings/${ymd()}`, 600);
  const rows = (j.standings ?? []).slice().sort((a, b) => (a.conferenceName + a.divisionName).localeCompare(b.conferenceName + b.divisionName) || (b.points - a.points));
  if (!rows.length) throw new Error('No NHL standings');
  let div = '';
  const lines = [];
  for (const t of rows) {
    const d = `${t.conferenceAbbrev} ${t.divisionAbbrev}`;
    if (d !== div) { div = d; lines.push(`{y}${t.conferenceName} / ${t.divisionName}`); }
    lines.push(`{w}${fit(t.teamAbbrev?.default ?? t.teamName?.default ?? '?', 12)}${String(t.gamesPlayed).padStart(3)}{g}${String(t.wins).padStart(3)}{r}${String(t.losses).padStart(3)}{c}${String(t.otLosses ?? 0).padStart(3)}{y}${String(t.points).padStart(4)}`);
  }
  return { blocks: [['{c}Team         GP  W  L OT Pts', ...lines]], source: 'NHL api-web' };
}

export async function nhlScores() {
  const j = await get(`https://api-web.nhle.com/v1/score/${ymd()}`, 120);
  const games = j.games ?? [];
  if (!games.length) return { blocks: [['{w}No NHL games today.']], source: 'NHL api-web' };
  const rows = games.map((g) => {
    const st = g.gameState === 'LIVE' || g.gameState === 'CRIT' ? 'r' : g.gameState === 'OFF' || g.gameState === 'FINAL' ? 'y' : 'c';
    const as = g.awayTeam?.score != null ? String(g.awayTeam.score) : '-';
    const hs = g.homeTeam?.score != null ? String(g.homeTeam.score) : '-';
    return `{${st}}${fit(g.gameState ?? '', 6)} {w}${fit(g.awayTeam?.abbrev, 10, true)} {y}${as.padStart(2)}-${hs.padEnd(2)} {w}${fit(g.homeTeam?.abbrev, 10)}`;
  });
  return { blocks: [[`{c}${j.currentDate ?? ymd()}  ${games.length} games`, ...rows]], source: 'NHL api-web' };
};
