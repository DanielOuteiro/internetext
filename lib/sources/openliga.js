import { get } from '../fetch.js';
import { fit } from '../text.js';
import { blTable, blSeason, matchLine } from '../shared.js';

export const tablePage = (league, { legend = '', source = 'OpenLigaDB (ODbL)' } = {}) => async () => {
  const t = await blTable(league);
  if (!t?.length) throw new Error(`No table for ${league}`);
  const rows = t.map((r, i) => {
    const pos = i + 1;
    const n = t.length;
    const c = pos <= Math.min(4, n) ? 'g' : pos > n - 3 ? 'r' : 'w';
    const gd = r.goalDiff > 0 ? `+${r.goalDiff}` : String(r.goalDiff);
    return `{${c}}${String(pos).padStart(2)} {w}${fit(r.shortName || r.teamName, 15)}${[r.matches, r.won, r.draw, r.lost].map((n) => String(n).padStart(3)).join('')}${gd.padStart(5)}{y}${String(r.points).padStart(4)}`;
  });
  return { blocks: [['{c}   Team             P  W  D  L   GD Pts', ...rows, legend].filter(Boolean)], source };
};

export const resultsPage = (league, source = 'OpenLigaDB (ODbL) - times CET') => async () => {
  const cur = await get(`https://api.openligadb.de/getmatchdata/${league}`, 300);
  if (!cur?.length) throw new Error(`No matches for ${league}`);
  const g = cur[0]?.group?.groupOrderID;
  const prev = g > 1 ? await get(`https://api.openligadb.de/getmatchdata/${league}/${blSeason()}/${g - 1}`, 1800).catch(() => []) : [];
  const block = (ms, label) => (ms.length ? [[`{y}${label} ${ms[0].group?.groupName ?? ms[0].group?.groupOrderID ?? ''}`, ...ms.map(matchLine), '']] : []);
  return {
    blocks: [...block(prev, 'PREV'), ...block(cur, cur.every((m) => !m.matchIsFinished) ? 'NEXT' : 'ROUND')],
    source,
  };
};
