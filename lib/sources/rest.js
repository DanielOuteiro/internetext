import { get, getText } from '../fetch.js';
import { clean, fit, wrap, stripWikitext, spark, num } from '../text.js';
import { compact } from '../shared.js';

export async function wikiSports() {
  const raw = await getText(`https://en.wikipedia.org/w/index.php?title=2026_in_sports&action=raw`, 3600);
  const lines = [];
  for (const line of raw.split('\n')) {
    const b = line.match(/^\*\s+(.*)/);
    if (!b) continue;
    const text = stripWikitext(b[1]);
    if (text.length > 20) lines.push(text);
    if (lines.length >= 40) break;
  }
  const sum = await get('https://en.wikipedia.org/api/rest_v1/page/summary/2026_in_sports', 86400).catch(() => null);
  const blocks = [];
  if (sum?.extract) blocks.push([...wrap(sum.extract, '{w}'), '']);
  blocks.push(...lines.map((t) => wrap(t, '{c}* {w}', '  {w}')));
  if (!blocks.length) throw new Error('No sports year page');
  return { blocks, source: 'Wikipedia 2026 in sports (CC BY-SA)' };
}

const POLLEN_CITIES = [
  ['London', 51.51, -0.13], ['Paris', 48.86, 2.35], ['Berlin', 52.52, 13.40],
  ['Madrid', 40.42, -3.70], ['Rome', 41.90, 12.50], ['New York', 40.71, -74.01],
];

export async function pollenPage() {
  const qs = `latitude=${POLLEN_CITIES.map((c) => c[1]).join(',')}&longitude=${POLLEN_CITIES.map((c) => c[2]).join(',')}`;
  const j = await get(`https://air-quality-api.open-meteo.com/v1/air-quality?${qs}&current=alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen`, 1800);
  const rows = (Array.isArray(j) ? j : [j]).map((c, i) => {
    const p = c.current ?? {};
    const vals = [p.grass_pollen, p.birch_pollen, p.alder_pollen, p.ragweed_pollen, p.olive_pollen, p.mugwort_pollen].map((v) => v ?? 0);
    const max = Math.max(...vals);
    const col = max >= 50 ? 'r' : max >= 20 ? 'y' : 'g';
    return `{w}${fit(POLLEN_CITIES[i][0], 10)} {${col}}${String(Math.round(p.grass_pollen ?? 0)).padStart(4)} ${String(Math.round(p.birch_pollen ?? 0)).padStart(4)} ${String(Math.round(p.alder_pollen ?? 0)).padStart(4)} ${String(Math.round(p.ragweed_pollen ?? 0)).padStart(4)}`;
  });
  return { blocks: [['{c}City       Gras Birc Alde Ragw', ...rows, '{w}grains/m3  Open-Meteo CAMS']], source: 'Open-Meteo pollen (CC BY 4.0)' };
}

const SEAS = [
  ['Dover', 51.13, 1.34], ['Biscay', 45.0, -4.0], ['Med West', 40.0, 5.0],
  ['Caribbean', 15.0, -75.0], ['Tokyo Bay', 35.3, 139.8], ['Cape Town', -34.3, 18.4],
];

export async function marinePage() {
  const qs = `latitude=${SEAS.map((c) => c[1]).join(',')}&longitude=${SEAS.map((c) => c[2]).join(',')}`;
  const j = await get(`https://marine-api.open-meteo.com/v1/marine?${qs}&current=wave_height,wave_period,wave_direction`, 900);
  const rows = (Array.isArray(j) ? j : [j]).map((c, i) => {
    const h = c.current?.wave_height ?? 0;
    const col = h >= 3 ? 'r' : h >= 1.5 ? 'y' : 'c';
    return `{w}${fit(SEAS[i][0], 11)} {${col}}${String(h.toFixed(1)).padStart(5)}m {w}${String(Math.round(c.current?.wave_period ?? 0)).padStart(3)}s {c}${String(Math.round(c.current?.wave_direction ?? 0)).padStart(3)}deg`;
  });
  return { blocks: [['{c}Sea         Height  Per  Dir', ...rows]], source: 'Open-Meteo marine (CC BY 4.0)' };
}

const RIVERS = [
  ['Thames', 51.5, -0.12], ['Rhine', 50.94, 6.96], ['Seine', 48.86, 2.35],
  ['Danube', 48.21, 16.37], ['Nile', 30.04, 31.24], ['Amazon', -3.12, -60.02],
];

export async function floodPage() {
  const qs = `latitude=${RIVERS.map((c) => c[1]).join(',')}&longitude=${RIVERS.map((c) => c[2]).join(',')}`;
  const j = await get(`https://flood-api.open-meteo.com/v1/flood?${qs}&daily=river_discharge&forecast_days=7`, 1800);
  const rows = (Array.isArray(j) ? j : [j]).map((c, i) => {
    const d = c.daily?.river_discharge ?? [];
    const lo = Math.min(...d), hi = Math.max(...d);
    return `{w}${fit(RIVERS[i][0], 8)} {c}${String(d[0]?.toFixed(0) ?? '-').padStart(6)} {y}${d.map((v) => spark(v, lo, hi)).join('')} {w}${hi.toFixed(0)}`;
  });
  return { blocks: [['{c}River      Now m3/s  7d           max', ...rows]], source: 'Open-Meteo flood (CC BY 4.0)' };
}

export async function nwsAlerts() {
  const j = await get('https://api.weather.gov/alerts/active?status=actual&severity=Extreme,Severe', 300);
  const feats = (j.features ?? []).slice(0, 30);
  if (!feats.length) return { blocks: [['{w}No severe US alerts.']], source: 'NWS (public domain)' };
  const blocks = feats.map((f) => {
    const p = f.properties ?? {};
    const sev = p.severity === 'Extreme' ? 'r' : 'y';
    return [...wrap(`${p.event ?? 'Alert'} - ${p.headline ?? p.areaDesc ?? ''}`, `{${sev}}`, `{${sev}}`)];
  });
  return { blocks, source: 'US National Weather Service' };
}

export async function volcanoes() {
  const j = await get('https://volcanoes.usgs.gov/hans-public/api/volcano/getCapElevated', 900);
  const list = (Array.isArray(j) ? j : []).slice(0, 30);
  if (!list.length) throw new Error('No elevated volcanoes');
  const rows = list.map((v) => {
    const c = /red|warning/i.test(v.color_code + v.alert_level) ? 'r' : /orange|watch/i.test(v.color_code + v.alert_level) ? 'y' : 'c';
    return `{${c}}${fit(v.color_code ?? '', 7)} {w}${fit(v.volcano_name_appended ?? v.volcanoName ?? '?', 20)}{c}${fit(v.alert_level ?? '', 10)}`;
  });
  return { blocks: [['{c}Color   Volcano              Alert', ...rows]], source: 'USGS Volcano Hazards' };
}

export async function gdacs() {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const j = await get(`https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?fromdate=${from}&todate=${to}&alertlevel=Orange;Red`, 900);
  const feats = (j.features ?? []).slice(0, 25);
  if (!feats.length) throw new Error('No GDACS events');
  const blocks = feats.map((f) => {
    const p = f.properties ?? {};
    const c = /red/i.test(p.alertlevel ?? p.alertscore ?? '') ? 'r' : 'y';
    return wrap(p.name || p.eventname || p.description || 'Event', `{${c}}${fit(p.eventtype ?? '?', 3)} {w}`, '    {w}');
  });
  return { blocks, source: 'GDACS / JRC' };
}

export async function eonet() {
  const j = await get('https://eonet.gsfc.nasa.gov/api/v3/events?limit=25&status=open', 900);
  const blocks = (j.events ?? []).map((e) => {
    const cat = e.categories?.[0]?.title ?? e.categories?.[0]?.id ?? '';
    const c = /storm|fire|volcano/i.test(cat) ? 'r' : 'y';
    return wrap(`${e.title} (${cat})`, `{${c}}`, `{${c}}`);
  });
  if (!blocks.length) throw new Error('No EONET events');
  return { blocks, source: 'NASA EONET' };
}

export async function opensky() {
  const j = await get('https://opensky-network.org/api/states/all?lamin=48&lomin=-5&lamax=54&lomax=10', 180);
  const states = (j.states ?? []).filter((s) => s[1] && !s[8]).slice(0, 20);
  if (!states.length) throw new Error('No OpenSky traffic');
  const rows = states.map((s) => {
    const alt = s[7] != null ? `${Math.round(s[7] / 1000)}km` : 'gnd';
    const spd = s[9] != null ? `${Math.round(s[9] * 3.6)}` : '-';
    return `{y}${fit(s[1], 8)} {w}${fit(s[2] ?? '', 12)}{c}${fit(alt, 5)} {w}${fit(spd, 4, true)}kmh`;
  });
  return { blocks: [['{c}Call     Country      Alt   Speed', ...rows, `{w}${states.length} airborne, NW Europe sample`]], source: 'OpenSky Network (anon)' };
}

const MET_IDS = [436535, 436121, 437329, 11122, 436528, 437394, 11417, 437853, 436947, 459106];

export async function metObject() {
  const id = MET_IDS[Math.floor(Date.now() / 86400000) % MET_IDS.length];
  const o = await get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, 86400);
  const lines = [
    `{y}${clean(o.title ?? 'Untitled').toUpperCase()}`,
    `{c}${clean(o.artistDisplayName || 'Unknown artist')}`,
    `{w}${clean([o.objectDate, o.medium].filter(Boolean).join(' - '))}`,
    `{w}${clean(o.department ?? '')}`,
    o.isPublicDomain ? '{g}Public domain' : '{c}Collection object',
    '',
    ...wrap(o.creditLine || o.repository || 'The Metropolitan Museum of Art', '{w}'),
  ];
  return { blocks: [lines], source: 'Met Museum Open Access (CC0)' };
}

export async function openLibrary() {
  const j = await get('https://openlibrary.org/trending/daily.json', 3600);
  const works = (j.works ?? []).slice(0, 20);
  if (!works.length) throw new Error('No trending books');
  const blocks = works.map((w, i) => [
    `{y}${String(i + 1).padStart(2)} {w}${fit(w.title, 36)}`,
    `   {c}${fit((w.author_name ?? []).join(', ') || 'Unknown', 28)} {g}${w.first_publish_year ?? ''}`,
  ]);
  return { blocks, source: 'Open Library / Internet Archive' };
}

export async function musicbrainz() {
  const month = new Date().toISOString().slice(0, 7);
  const j = await get(`https://musicbrainz.org/ws/2/release?query=date:${month}%20AND%20status:official&fmt=json&limit=20`, 1800);
  const rel = j.releases ?? [];
  if (!rel.length) throw new Error('No releases');
  const blocks = rel.map((r) => {
    const artist = r['artist-credit']?.map((a) => a.name).join('') ?? '?';
    return [`{y}${fit(r.date ?? '', 10)} {w}${fit(r.title, 28)}`, `           {c}${fit(artist, 28)}`];
  });
  return { blocks, source: 'MusicBrainz (CC BY-NC-SA)' };
}

export async function lichess() {
  const j = await get('https://lichess.org/api/tv/channels', 60);
  const rows = Object.entries(j).slice(0, 16).map(([ch, g]) =>
    `{y}${fit(ch, 12)} {w}${fit(g.user?.name ?? '?', 16)}{c}${String(g.rating ?? '').padStart(5)} {g}${g.color ?? ''}`);
  return { blocks: [['{c}Channel      Player           Elo', ...rows]], source: 'Lichess TV (AGPL)' };
}

export async function gbif() {
  const j = await get('https://api.gbif.org/v1/occurrence/search?limit=20&hasCoordinate=true', 900);
  const blocks = (j.results ?? []).map((r) =>
    wrap(`${r.species || r.scientificName || '?'} - ${r.country || r.countryCode || ''} ${r.eventDate ?? ''}`, '{c}', '{c}'));
  if (!blocks.length) throw new Error('No GBIF rows');
  return { blocks: [[`{w}${compact(j.count ?? 0)} occurrence records`], ...blocks], source: 'GBIF' };
}

export async function openFda() {
  const j = await get('https://api.fda.gov/food/enforcement.json?limit=15&sort=report_date:desc', 3600);
  const blocks = (j.results ?? []).map((r) =>
    wrap(`${r.recalling_firm || r.city || 'Recall'}: ${r.product_description || r.reason_for_recall || ''}`, '{y}', '{w}'));
  if (!blocks.length) throw new Error('No FDA recalls');
  return { blocks, source: 'openFDA' };
}

export async function worldBankSnap() {
  const ids = ['SP.POP.TOTL', 'NY.GDP.MKTP.CD', 'FP.CPI.TOTL.ZG', 'SP.DYN.LE00.IN'];
  const parts = await Promise.all(ids.map((id) => get(`https://api.worldbank.org/v2/country/WLD/indicator/${id}?format=json&mrnev=1`, 86400)));
  const rows = parts.flatMap((j) => j[1] ?? []).map((x) => {
    const v = x.value;
    const shown = x.indicator.id === 'SP.POP.TOTL' || x.indicator.id === 'NY.GDP.MKTP.CD' ? compact(v) : num(v, 1);
    return `{w}${fit(x.indicator.value.replace(/\s*\(.*?\)\s*/g, ''), 24)}{y}${fit(`${shown} ${x.date}`, 15, true)}`;
  });
  return { blocks: [['{y}WORLD', ...rows]], source: 'World Bank Open Data (CC BY 4.0)' };
}

const CLOCKS = [
  ['UTC', 'UTC'], ['London', 'Europe/London'], ['Paris', 'Europe/Paris'], ['Berlin', 'Europe/Berlin'],
  ['Cairo', 'Africa/Cairo'], ['Dubai', 'Asia/Dubai'], ['Mumbai', 'Asia/Kolkata'], ['Beijing', 'Asia/Shanghai'],
  ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney'], ['LA', 'America/Los_Angeles'], ['New York', 'America/New_York'],
  ['Sao Paulo', 'America/Sao_Paulo'], ['Buenos Aires', 'America/Argentina/Buenos_Aires'],
];

export async function worldClocks() {
  const now = new Date();
  const rows = CLOCKS.map(([name, tz]) => {
    const t = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tz, hour12: false });
    const d = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: tz });
    return `{w}${fit(name, 14)}{y}${t}  {c}${d}`;
  });
  return { blocks: [['{c}City          Time      Date', ...rows]], source: 'IANA time zones (local compute)' };
}

export async function metSafe() {
  const start = Math.floor(Date.now() / 86400000) % MET_IDS.length;
  let last = 'No Met object';
  for (let i = 0; i < MET_IDS.length; i++) {
    try { return await get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${MET_IDS[(start + i) % MET_IDS.length]}`, 86400).then((o) => {
      if (!o?.title) throw new Error('empty');
      return {
        blocks: [[
          `{y}${clean(o.title).toUpperCase()}`,
          `{c}${clean(o.artistDisplayName || 'Unknown artist')}`,
          `{w}${clean([o.objectDate, o.medium].filter(Boolean).join(' - '))}`,
          `{w}${clean(o.department ?? '')}`,
          o.isPublicDomain ? '{g}Public domain' : '{c}Collection object',
          '',
          ...wrap(o.creditLine || 'The Metropolitan Museum of Art', '{w}'),
        ]],
        source: 'Met Museum Open Access (CC0)',
      };
    }); } catch (e) { last = e.message; }
  }
  throw new Error(last);
}
