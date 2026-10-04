import { pages } from './pages.js';
import { ranges } from './ranges.js';
import { fit, wrap } from './text.js';
import { currentEvents } from './shared.js';

const SECTION_COLOR = { NEWS: 'c', SPORT: 'g', MONEY: 'm', WEATHER: 'c', SPACE: 'r', STATUS: 'y', WORLD: 'y' };
const SECTION_BG = { NEWS: 'B', SPORT: 'G', MONEY: 'M', WEATHER: 'C', SPACE: 'R', STATUS: 'Y', WORLD: 'Y' };

const safeList = (r) => r.list().catch(() => []);

export async function listAll() {
  const out = [{ num: 100, section: 'INDEX', title: 'Index' }, { num: 199, section: 'INDEX', title: 'A-Z index' }];
  for (const p of pages) out.push({ num: p.num, section: p.section, title: p.short ?? p.title });
  const lists = await Promise.all(ranges.map(safeList));
  ranges.forEach((r, i) => {
    if (r.dir) out.push({ num: r.dir, section: r.section, title: r.dirTitle });
    lists[i].slice(0, r.max).forEach((it, j) => out.push({ num: r.start + j, section: r.section, title: r.title(it) }));
  });
  return out.sort((a, b) => a.num - b.num);
}

function dirLines(r, items) {
  return items.slice(0, r.max).map((it, i) => {
    const info = r.info?.(it);
    return info
      ? `{y}${r.start + i} {w}${fit(r.title(it), 22)}{c}${fit(info, 14, true)}`
      : `{y}${r.start + i} {w}${fit(r.title(it), 36)}`;
  });
}

const INDEX_ENTRIES = [
  ['NEWS', [[101, 'Headlines'], [103, 'Technology'], [104, 'Trending'], [105, 'On this day'], [107, 'Featured']]],
  ['SPORT', [[201, 'Bundesliga'], [210, 'BL clubs'], [206, '2. Bundesliga'], [203, 'F1 standings'], [260, 'F1 calendar']]],
  ['MONEY', [[301, 'Currencies'], [310, 'FX pages'], [302, 'Crypto'], [350, 'Coin pages'], [303, 'Power prices']]],
  ['WEATHER', [[401, 'World now'], [410, 'Capitals'], [403, 'Air quality'], [404, 'Earthquakes']]],
  ['SPACE', [[501, 'Launches'], [502, 'ISS live'], [504, 'Space weather']]],
  ['STATUS', [[601, 'Services']]],
  ['WORLD', [[700, 'Countries A-Z'], [701, 'Holidays']]],
];

async function indexPage() {
  const logo = ['{h}{c} INTERNETEXT', '{h}'];
  const entries = INDEX_ENTRIES.flatMap(([s, list]) => [`{${SECTION_COLOR[s]}}${s}`, ...list.map(([n, t]) => `{w}${fit(t, 14)} {y}${n}`)]);
  const half = Math.ceil(entries.length / 2);
  const cols = [];
  for (let i = 0; i < half; i++) {
    const a = entries[i] ?? '', b = entries[i + half] ?? '';
    cols.push(`${a}${' '.repeat(Math.max(1, 20 - a.replace(/\{[a-zA-Z]\}/g, '').length))}${b}`);
  }
  const total = (await listAll()).length;
  return { blocks: [['', ...logo, ...cols]], source: `${total} pages. Full A-Z index: 199`, linkify: true };
}

async function azPage() {
  const all = await listAll();
  const dirs = new Set([100, 199, ...ranges.map((r) => r.dir).filter(Boolean), ...pages.map((p) => p.num)]);
  const lines = all.filter((p) => dirs.has(p.num) && p.num !== 199)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((p) => `{w}${fit(p.title, 30)}{${SECTION_COLOR[p.section] ?? 'w'}}${String(p.num).padStart(9)}`);
  return { blocks: [lines], source: `${all.length} pages incl. detail pages`, linkify: true };
}

async function run(base, build) {
  try {
    return { ...base, ...(await build()), updated: Date.now() };
  } catch (err) {
    return {
      ...base,
      blocks: [['{r}SOURCE TEMPORARILY UNAVAILABLE', '', ...wrap(String(err.message || err), '{w}'), '', '{c}The page will retry automatically.']],
      source: 'error',
      updated: Date.now(),
    };
  }
}

export async function render(n) {
  if (n === 100) return run({ num: 100, section: 'INDEX', title: 'internetext.com', color: 'B' }, indexPage);
  if (n === 199) return run({ num: 199, section: 'INDEX', title: 'A-Z index', color: 'B' }, azPage);

  const p = pages.find((x) => x.num === n);
  if (p) return run({ num: p.num, section: p.section, title: p.title, color: p.color }, p.build);

  for (const r of ranges) {
    const base = { section: r.section, color: SECTION_BG[r.section] ?? r.color };
    if (n === r.dir) {
      return run({ ...base, num: n, title: r.dirTitle }, async () => {
        const items = await r.list();
        return { blocks: [dirLines(r, items)], source: `${Math.min(items.length, r.max)} pages: ${r.start}-${r.start + Math.min(items.length, r.max) - 1}`, linkify: true };
      });
    }
    if (n >= r.start && n < r.start + r.max) {
      let items;
      try { items = await r.list(); } catch (err) {
        return run({ ...base, num: n, title: 'Unavailable' }, () => { throw err; });
      }
      const item = items[n - r.start];
      if (!item) return null;
      return run({ ...base, num: n, title: r.title(item) }, () => r.build(item, n));
    }
  }
  return null;
}

export const warmable = () => pages.filter((p) => !p.noWarm).map((p) => p.num);
