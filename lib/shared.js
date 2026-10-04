import { get, getText, settle } from './fetch.js';
import { clean, fit, wrap, stripWikitext, spark, num, hhmm } from './text.js';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const ymd = (d) => `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
export const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);
const region = new Intl.DisplayNames(['en'], { type: 'region' });
export const country = (cc) => { try { return region.of(cc); } catch { return cc; } };
export const compact = (n) => Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

// ---------- Wikipedia ----------

export const wikiFeed = (offset = 0) =>
  get(`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${ymd(daysAgo(offset))}`, 900);

export async function wikiFeedWith(key) {
  for (const off of [0, 1, 2]) {
    const f = await wikiFeed(off).catch(() => null);
    if (f?.[key] && (f[key].length || f[key].articles?.length || f[key].extract)) return f;
  }
  throw new Error(`Wikipedia feed has no ${key}`);
}

export function onThisDay(type) {
  const d = new Date();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return get(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/${type}/${mm}/${dd}`, 21600).then((j) => j[type] ?? []);
}

export const wikiSummary = (title) =>
  get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, 86400);

function parseCurrentEvents(raw) {
  const out = [];
  const ctx = [];
  let cat = '';
  for (const line of raw.split('\n')) {
    const h = line.match(/^'''(.+?)'''\s*$/);
    if (h) { cat = stripWikitext(h[1]); ctx.length = 0; continue; }
    const b = line.match(/^(\*+)\s*(.*)$/);
    if (!b) continue;
    const depth = b[1].length;
    const text = stripWikitext(b[2]);
    if (!/\[https?:\/\//.test(b[2])) { ctx[depth - 1] = text; ctx.length = depth; continue; }
    if (text) out.push({ cat, topic: ctx[0] || '', text });
  }
  return out;
}

export async function currentEvents() {
  const days = [0, 1, 2].map(daysAgo);
  const raws = await settle(days.map((d) =>
    getText(`https://en.wikipedia.org/w/index.php?title=Portal:Current_events/${d.getUTCFullYear()}_${MONTHS[d.getUTCMonth()]}_${d.getUTCDate()}&action=raw`, 900)));
  return days.map((d, i) => ({ date: d, items: raws[i] ? parseCurrentEvents(raws[i]) : [] })).filter((x) => x.items.length);
}

// ---------- Hacker News ----------

export async function hnTop(n) {
  const ids = (await get('https://hacker-news.firebaseio.com/v0/topstories.json', 300)).slice(0, n);
  return (await settle(ids.map((id) => get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, 600)))).filter(Boolean);
}
export const hnItem = (id) => get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, 600);
export const hostOf = (url) => (url ? new URL(url).host.replace(/^www\./, '') : 'news.ycombinator.com');

// ---------- Weather ----------

export const WMO = (c, day = 1) => {
  if (c === 0) return day ? ['Sunny', 'y'] : ['Clear', 'w'];
  if (c === 1) return day ? ['Mostly sun', 'y'] : ['Mostly clr', 'w'];
  if (c === 2) return ['Pt cloudy', 'w'];
  if (c === 3) return ['Overcast', 'w'];
  if (c === 45 || c === 48) return ['Fog', 'w'];
  if (c >= 51 && c <= 57) return ['Drizzle', 'c'];
  if (c >= 61 && c <= 67) return ['Rain', 'c'];
  if (c >= 71 && c <= 77) return ['Snow', 'w'];
  if (c >= 80 && c <= 82) return ['Showers', 'c'];
  if (c === 85 || c === 86) return ['Snow shwr', 'w'];
  if (c >= 95) return ['Thunder', 'm'];
  return ['-', 'w'];
};

export async function geocode(name, cc, fallback) {
  const j = await get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&countryCode=${cc}`, 604800).catch(() => null);
  const r = j?.results?.find((x) => x.feature_code === 'PPLC') ?? j?.results?.[0];
  if (r) return { lat: r.latitude, lon: r.longitude };
  if (fallback) return { lat: fallback[0], lon: fallback[1] };
  throw new Error(`Could not locate ${name}`);
}

export async function forecastBlocks(lat, lon) {
  const j = await get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m&hourly=temperature_2m,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,uv_index_max&forecast_days=7&timezone=auto`, 900);
  const c = j.current, d = j.daily;
  const [cond, col] = WMO(c.weather_code, c.is_day);
  const idx = Math.max(0, j.hourly.time.findIndex((t) => t >= c.time.slice(0, 13)));
  const next = j.hourly.temperature_2m.slice(idx, idx + 24);
  const rain = j.hourly.precipitation_probability.slice(idx, idx + 24).map((v) => v ?? 0);
  const lo = Math.min(...next), hi = Math.max(...next);
  const rows = d.time.map((t, i) => {
    const [dc, dcol] = WMO(d.weather_code[i]);
    const day = new Date(`${t}T12:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', timeZone: 'UTC' });
    return `{w}${day.padEnd(7)}{${dcol}}${fit(dc, 10)}{r}${String(Math.round(d.temperature_2m_max[i])).padStart(3)}{c}${String(Math.round(d.temperature_2m_min[i])).padStart(3)} {b}${String(d.precipitation_probability_max[i] ?? 0).padStart(3)}% {w}${String(Math.round(d.wind_speed_10m_max[i])).padStart(3)}kmh`;
  });
  return {
    blocks: [[
      `{w}Local {c}${c.time.slice(11)} {w}Now {${col}}${cond} {y}${Math.round(c.temperature_2m)}C`,
      `{w}Feels {c}${Math.round(c.apparent_temperature)}C {w}Hum {c}${c.relative_humidity_2m}% {w}Wind {c}${Math.round(c.wind_speed_10m)}kmh`,
      `{w}Sunrise {y}${d.sunrise[0].slice(11)} {w}Sunset {y}${d.sunset[0].slice(11)} {w}UV {c}${d.uv_index_max[0] ?? '-'}`,
      '',
      `{w}Next 24h {c}${next.map((v) => spark(v, lo, hi)).join('')}`,
      `{w}${`${Math.round(lo)}-${Math.round(hi)}C`.padStart(8)} {b}${rain.map((v) => spark(v, 0, 100)).join('')}`,
      '{w}         {c}temp      {b}rain chance',
      '',
      '{c}Day    Sky        Max Min Rain  Wind',
      ...rows,
    ]],
    source: `Open-Meteo (CC BY 4.0) - ${j.timezone_abbreviation}`,
  };
}

// ---------- Charts ----------

const BL = ' \u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588';

// Vertical bar chart: one column per value, eighth-block resolution.
export function vChart(vals, { height = 10, color = () => 'c', fmt = (v) => num(v, 0), base } = {}) {
  const ok = vals.filter((v) => v != null);
  const max = Math.max(...ok);
  const min = base ?? Math.min(...ok);
  const rows = [];
  for (let r = 0; r < height; r++) {
    const label = r === 0 ? fmt(max) : r === height - 1 ? fmt(min) : '';
    let row = `{c}${label.slice(0, 5).padStart(5)} `;
    vals.forEach((v, i) => {
      if (v == null) { row += ' '; return; }
      const lvl = Math.max(1, Math.round(((v - min) / (max - min || 1)) * height * 8));
      const floor = (height - r - 1) * 8;
      const ch = lvl >= floor + 8 ? BL[8] : lvl > floor ? BL[lvl - floor] : ' ';
      row += `{${color(v, i)}}${ch}`;
    });
    rows.push(row);
  }
  return rows;
}

export function downsample(arr, n) {
  if (arr.length <= n) return arr;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(((i + 1) * arr.length) / n) - 1]);
}

// ---------- Football (OpenLigaDB) ----------

export const blSeason = () => { const d = new Date(); return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; };
export const team = (t) => clean(t.shortName || t.teamName);
export const blTable = (league) => get(`https://api.openligadb.de/getbltable/${league}/${blSeason()}`, 600);
export const blSeasonMatches = (league) => get(`https://api.openligadb.de/getmatchdata/${league}/${blSeason()}`, 900);
export const finalScore = (m) => m.matchResults?.find((r) => r.resultTypeID === 2) ?? m.matchResults?.at(-1);

export function matchLine(m) {
  const final = finalScore(m);
  const score = final ? `${final.pointsTeam1}-${final.pointsTeam2}` : 'v';
  const when = new Date(m.matchDateTimeUTC);
  const day = when.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/Berlin' });
  const live = !m.matchIsFinished && final;
  return `{c}${day} ${hhmm(when, 'Europe/Berlin')} {w}${fit(team(m.team1), 12, true)} ${live ? '{r}' : '{y}'}${score.padStart(3).padEnd(5)}{w}${fit(team(m.team2), 12)}`;
}

// ---------- F1 (Jolpica) ----------

export const f1 = (path, ttl = 1800) => get(`https://api.jolpi.ca/ergast/f1/${path}`, ttl).then((j) => j.MRData);
export const gp = (name) => name.replace('Grand Prix', 'GP');

// ---------- Countries (mledoze/countries + World Bank) ----------

export const allCountries = () => get('https://raw.githubusercontent.com/mledoze/countries/master/countries.json', 86400);

export async function countries() {
  const all = await allCountries();
  return all.filter((c) => c.independent).sort((a, b) => a.name.common.localeCompare(b.name.common));
}

export async function populations() {
  const j = await get('https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&mrnev=1&per_page=400', 86400);
  return new Map((j[1] ?? []).map((x) => [x.countryiso3code, x.value]));
}

export async function worldBank(cca3) {
  const j = await get(`https://api.worldbank.org/v2/country/${cca3}/indicator/SP.POP.TOTL;NY.GDP.MKTP.CD;NY.GDP.PCAP.CD;SP.DYN.LE00.IN?source=2&format=json&mrnev=1`, 86400);
  const out = {};
  for (const x of j[1] ?? []) out[x.indicator.id] = { value: x.value, year: x.date };
  return out;
}

// ---------- Energy ----------

export const ZONES = {
  'DE-LU': 'Germany', FR: 'France', NL: 'Netherlands', AT: 'Austria', PL: 'Poland', SE3: 'Sweden (SE3)',
};

export async function powerPage(bzn) {
  const j = await get(`https://api.energy-charts.info/price?bzn=${bzn}`, 3600);
  const tz = 'Europe/Berlin';
  const hours = new Map();
  j.unix_seconds.forEach((t, i) => {
    if (j.price[i] == null) return;
    const h = +new Date(t * 1000).toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }) % 24;
    (hours.get(h) ?? hours.set(h, []).get(h)).push(j.price[i]);
  });
  const vals = Array.from({ length: 24 }, (_, h) => { const a = hours.get(h); return a ? a.reduce((x, y) => x + y, 0) / a.length : null; });
  const ok = vals.filter((v) => v != null);
  const max = Math.max(...ok), min = Math.min(...ok), avg = ok.reduce((a, b) => a + b, 0) / ok.length;
  const nowH = +new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }) % 24;
  const chart = vChart(vals, {
    base: Math.min(0, min),
    color: (v, h) => (h === nowH ? 'w' : v <= avg * 0.85 ? 'g' : v >= avg * 1.15 ? 'r' : 'y'),
  });
  const at = (v) => String(vals.indexOf(v)).padStart(2, '0');
  const day = new Date(j.unix_seconds[0] * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: tz });
  return {
    blocks: [[
      `{w}Day-ahead EUR/MWh, ${day} (CET)`,
      '',
      ...chart,
      '{c}      0     6     12    18    23',
      '',
      `{w}Now  {y}${num(vals[nowH] ?? NaN, 1).padStart(7)}  {w}Avg {y}${num(avg, 1).padStart(7)}`,
      `{w}Low  {g}${num(min, 1).padStart(7)} {c}${at(min)}h {w}High{r}${num(max, 1).padStart(7)} {c}${at(max)}h`,
      '{g}cheap {y}normal {r}expensive {w}now',
    ]],
    source: 'Energy-Charts / SMARD (CC BY 4.0)',
  };
}

// ---------- Markets ----------

export const coins = () => get('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&sparkline=true&price_change_percentage=1h,24h,7d', 180);
export const fxCurrencies = () => get('https://api.frankfurter.dev/v1/currencies', 86400);
export const fxLatest = () => get('https://api.frankfurter.dev/v1/latest?base=EUR', 3600);
export const priceFmt = (p) => (p >= 1000 ? num(p, 0) : p >= 1 ? num(p, 2) : p >= 0.01 ? num(p, 4) : num(p, 8));

// ---------- Status ----------

export const STATUS = [
  ['GitHub', 'www.githubstatus.com'], ['Cloudflare', 'www.cloudflarestatus.com'], ['Discord', 'discordstatus.com'],
  ['Reddit', 'www.redditstatus.com'], ['Vercel', 'www.vercel-status.com'], ['Atlassian', 'status.atlassian.com'],
  ['npm', 'status.npmjs.org'], ['DigitalOcean', 'status.digitalocean.com'], ['Dropbox', 'status.dropbox.com'],
  ['Zoom', 'status.zoom.us'], ['Twilio', 'status.twilio.com'], ['Netlify', 'www.netlifystatus.com'],
];
export const statusSummary = (host) => get(`https://${host}/api/v2/summary.json`, 300);
export const STATUS_LABEL = { none: ['OK', 'g'], minor: ['MINOR', 'y'], major: ['MAJOR', 'r'], critical: ['CRITICAL', 'r'], maintenance: ['MAINT', 'c'] };

// ---------- Space ----------

export const launchesUpcoming = () => get('https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=15', 1800);
export const launchesPrevious = () => get('https://ll.thespacedevs.com/2.2.0/launch/previous/?limit=15', 3600);

export { wrap };
