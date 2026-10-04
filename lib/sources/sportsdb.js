import { get } from '../fetch.js';
import { fit, wrap } from '../text.js';

const KEY = '123'; // documented public free key, not a secret
const base = (path) => `https://www.thesportsdb.com/api/v1/json/${KEY}/${path}`;

export const sdbTable = (id) => get(base(`lookuptable.php?l=${id}`), 900).then((j) => j.table ?? []);
export const sdbPast = (id) => get(base(`eventspastleague.php?id=${id}`), 600).then((j) => j.events ?? []);
export const sdbNext = (id) => get(base(`eventsnextleague.php?id=${id}`), 600).then((j) => j.events ?? []);

const eventLine = (e) => {
  const score = e.intHomeScore != null && e.intAwayScore != null ? `${e.intHomeScore}-${e.intAwayScore}` : 'v';
  const live = /in play|live/i.test(e.strStatus ?? '');
  return `{c}${fit((e.dateEvent ?? '').slice(5), 5)} {w}${fit(e.strHomeTeam, 12, true)} ${live ? '{r}' : '{y}'}${score.padStart(3).padEnd(5)}{w}${fit(e.strAwayTeam, 11)}`;
};

export const leaguePage = (id, name) => async () => {
  const [table, past, next] = await Promise.all([sdbTable(id), sdbPast(id), sdbNext(id)]);
  const blocks = [];
  if (table.length) {
    const rows = table.map((r) => {
      const pos = +r.intRank;
      const gd = +r.intGoalDifference;
      const gds = gd > 0 ? `+${gd}` : String(gd);
      const c = pos <= 4 ? 'g' : pos > table.length - 3 ? 'r' : 'w';
      return `{${c}}${String(pos).padStart(2)} {w}${fit(r.strTeam, 15)}${[r.intPlayed, r.intWin, r.intDraw, r.intLoss].map((n) => String(n).padStart(3)).join('')}${gds.padStart(5)}{y}${String(r.intPoints).padStart(4)}`;
    });
    blocks.push(['{c}   Team             P  W  D  L   GD Pts', ...rows, table[0].strSeason ? `{c}${table[0].strSeason}` : '']);
  }
  if (past.length) blocks.push(['{y}RECENT', ...past.slice(0, 12).map(eventLine), '']);
  if (next.length) blocks.push(['{y}NEXT', ...next.slice(0, 12).map(eventLine)]);
  if (!blocks.length) throw new Error(`No ${name} data`);
  return { blocks, source: `TheSportsDB (free) - ${name}` };
};

export { wrap };
