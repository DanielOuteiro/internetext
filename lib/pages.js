import { get, settle } from './fetch.js';
import { clean, fit, wrap, stripHtml, bar, spark, pct, upDown, num, hhmm, dayMon, ago } from './text.js';
import {
  country, wikiFeedWith, onThisDay, currentEvents, hnTop, hostOf, WMO, forecastBlocks,
  blTable, matchLine, blSeason, f1, ZONES, powerPage, coins, priceFmt, STATUS, statusSummary, STATUS_LABEL,
  launchesUpcoming, launchesPrevious, daysAgo, vChart,
} from './shared.js';

export const pages = [];
const page = (num, section, title, color, build, extra = {}) => pages.push({ num, section, title, color, build, ...extra });

// NEWS -------------------------------------------------------------

page(101, 'NEWS', 'World headlines', 'B', async () => {
  const days = await currentEvents();
  const blocks = [];
  for (const { date, items } of days) {
    blocks.push([`{c}${date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).toUpperCase()}`]);
    let cat = null;
    for (const it of items) {
      const b = [];
      if (it.cat !== cat) { cat = it.cat; b.push(`{y}${clean(cat).toUpperCase()}`); }
      if (it.topic) b.push(...wrap(it.topic, '{c}> '));
      b.push(...wrap(it.text, '{w}'), '');
      blocks.push(b);
    }
  }
  return { blocks, source: 'Wikipedia Current events (CC BY-SA)' };
}, { short: 'Headlines' });

page(102, 'NEWS', 'In the news', 'B', async () => {
  const f = await wikiFeedWith('news');
  return { blocks: f.news.map((n, i) => [...wrap(stripHtml(n.story), i % 2 ? '{c}' : '{w}'), '']), source: 'Wikipedia In the news (CC BY-SA)' };
});

page(103, 'NEWS', 'Technology', 'B', async () => {
  const items = await hnTop(28);
  const blocks = items.map((it, i) => [
    ...wrap(it.title, `{y}${171 + i} {w}`, '    {w}'),
    `    {g}${it.score} pts {c}${it.descendants ?? 0} cmts {b}${fit(hostOf(it.url), 20)}`.trimEnd(),
  ]);
  return { blocks, source: 'Hacker News API (Y Combinator)', linkify: true };
});

page(104, 'NEWS', 'Trending on Wikipedia', 'B', async () => {
  const f = await wikiFeedWith('mostread');
  const blocks = f.mostread.articles.slice(0, 50).map((a, i) => [
    `{y}${111 + i} {w}${fit(a.titles.normalized, 29)}{g}${fit(`${Math.round(a.views / 1000)}k`, 6, true)}`,
    ...(a.description ? wrap(a.description, '    {c}') : []),
  ]);
  return { blocks, source: `Wikipedia pageviews ${f.mostread.date?.slice(0, 10) ?? ''}`, linkify: true };
}, { short: 'Trending' });

page(105, 'NEWS', 'On this day', 'B', async () => {
  const f = await wikiFeedWith('onthisday');
  const blocks = f.onthisday.sort((a, b) => b.year - a.year)
    .map((e) => [...wrap(e.text, `{y}${String(e.year).padStart(4)} {w}`, '     {w}'), '']);
  return { blocks, source: 'Wikipedia Selected anniversaries' };
});

page(106, 'NEWS', 'Did you know...', 'B', async () => {
  const f = await wikiFeedWith('dyk');
  return { blocks: f.dyk.map((d, i) => [...wrap(stripHtml(d.html ?? d.text), i % 2 ? '{c}' : '{w}'), '']), source: 'Wikipedia Did you know (CC BY-SA)' };
}, { short: 'Did you know' });

page(107, 'NEWS', 'Featured article', 'B', async () => {
  const f = await wikiFeedWith('tfa');
  const a = f.tfa;
  return {
    blocks: [[`{y}${clean(a.titles.normalized).toUpperCase()}`, ...(a.description ? wrap(a.description, '{c}') : []), ''], ...wrap(a.extract, '{w}').map((l) => [l])],
    source: "Wikipedia Today's featured article",
  };
});

const lifeEvents = (type) => async () => {
  const list = (await onThisDay(type)).sort((a, b) => b.year - a.year).slice(0, 80);
  return { blocks: list.map((e) => wrap(e.text, `{y}${String(e.year).padStart(4)} {w}`, '     {w}')), source: `Wikipedia On this day: ${type}` };
};
page(108, 'NEWS', 'Born on this day', 'B', lifeEvents('births'), { short: 'Births today' });
page(109, 'NEWS', 'Died on this day', 'B', lifeEvents('deaths'), { short: 'Deaths today' });

// SPORT ------------------------------------------------------------

const LEAGUES = {
  bl1: { name: 'Bundesliga', zones: (p, n) => (p <= 4 ? 'g' : p <= 6 ? 'c' : p === n - 2 ? 'y' : p > n - 2 ? 'r' : 'w'), legend: '{g}UCL {c}UEL {y}Playoff {r}Relegation' },
  bl2: { name: '2. Bundesliga', zones: (p, n) => (p <= 2 ? 'g' : p === 3 ? 'y' : p === n - 2 ? 'y' : p > n - 2 ? 'r' : 'w'), legend: '{g}Promotion {y}Playoff {r}Relegation' },
  bl3: { name: '3. Liga', zones: (p, n) => (p <= 2 ? 'g' : p === 3 ? 'y' : p > n - 4 ? 'r' : 'w'), legend: '{g}Promotion {y}Playoff {r}Relegation' },
};

const tablePage = (league) => async () => {
  const t = await blTable(league);
  const L = LEAGUES[league];
  const rows = t.map((r, i) => {
    const pos = i + 1;
    const gd = r.goalDiff > 0 ? `+${r.goalDiff}` : String(r.goalDiff);
    return `{${L.zones(pos, t.length)}}${String(pos).padStart(2)} {w}${fit(r.shortName || r.teamName, 15)}${[r.matches, r.won, r.draw, r.lost].map((n) => String(n).padStart(3)).join('')}${gd.padStart(5)}{y}${String(r.points).padStart(4)}`;
  });
  return { blocks: [['{c}   Team             P  W  D  L   GD Pts', ...rows, L.legend]], source: 'OpenLigaDB (ODbL)' };
};

const resultsPage = (league) => async () => {
  const cur = await get(`https://api.openligadb.de/getmatchdata/${league}`, 300);
  const g = cur[0]?.group?.groupOrderID;
  const prev = g > 1 ? await get(`https://api.openligadb.de/getmatchdata/${league}/${blSeason()}/${g - 1}`, 1800).catch(() => []) : [];
  const block = (ms, label) => (ms.length ? [[`{y}${label} ${ms[0].group.groupOrderID}`, ...ms.map(matchLine), '']] : []);
  return {
    blocks: [...block(prev, 'MATCHDAY'), ...block(cur, cur.every((m) => !m.matchIsFinished) ? 'NEXT: MATCHDAY' : 'MATCHDAY')],
    source: 'OpenLigaDB (ODbL) - times CET',
  };
};

page(201, 'SPORT', 'Bundesliga table', 'G', tablePage('bl1'), { short: 'Bundesliga' });
page(202, 'SPORT', 'Bundesliga results', 'G', resultsPage('bl1'), { short: 'BL results' });
page(206, 'SPORT', '2. Bundesliga table', 'G', tablePage('bl2'), { short: '2. Bundesliga' });
page(207, 'SPORT', '2. Bundesliga results', 'G', resultsPage('bl2'), { short: '2. BL results' });
page(208, 'SPORT', '3. Liga table', 'G', tablePage('bl3'), { short: '3. Liga' });
page(209, 'SPORT', '3. Liga results', 'G', resultsPage('bl3'), { short: '3. Liga results' });

page(203, 'SPORT', 'F1 drivers', 'G', async () => {
  const list = (await f1('current/driverStandings.json')).StandingsTable.StandingsLists[0];
  const rows = list.DriverStandings.map((s) =>
    `{y}${s.position.padStart(2)} {w}${fit(`${s.Driver.givenName[0]}. ${s.Driver.familyName}`, 18)}{c}${fit(s.Constructors[0]?.name ?? '', 11)}{y}${s.points.padStart(4)}{g}${s.wins.padStart(3)}`);
  return { blocks: [[`{c}${list.season} after round ${list.round}            Pts  W`, ...rows]], source: 'Jolpica F1 API. Driver pages: 230' };
});

page(204, 'SPORT', 'F1 constructors', 'G', async () => {
  const list = (await f1('current/constructorStandings.json')).StandingsTable.StandingsLists[0];
  const max = +list.ConstructorStandings[0].points || 1;
  const rows = list.ConstructorStandings.flatMap((s) => [
    `{y}${s.position.padStart(2)} {w}${fit(s.Constructor.name, 22)}{y}${s.points.padStart(5)}{g}${s.wins.padStart(4)}`,
    `   {c}${bar(+s.points, max, 34)}`,
  ]);
  return { blocks: [[`{c}${list.season} after round ${list.round}            Pts   W`, ...rows]], source: 'Jolpica F1 API (Ergast successor)' };
}, { short: 'F1 teams' });

page(205, 'SPORT', 'F1 last race', 'G', async () => {
  const r = (await f1('current/last/results.json')).RaceTable.Races[0];
  const rows = r.Results.map((x) =>
    `{y}${x.positionText.padStart(2)} {w}${fit(x.Driver.familyName, 12)}{c}${fit(x.Constructor.name, 10)}{w}${fit(x.Time?.time ?? x.status, 12, true)}{g}${fit(x.points, 3, true)}`);
  return { blocks: [[...wrap(`${r.raceName} - ${r.Circuit.Location.locality}, ${r.date}`, '{y}'), '', ...rows]], source: 'Jolpica F1 API (Ergast successor)' };
});

// MONEY ------------------------------------------------------------

const FX = ['USD', 'GBP', 'JPY', 'CHF', 'CNY', 'BRL', 'INR', 'AUD', 'CAD', 'MXN', 'KRW', 'ZAR', 'TRY', 'SEK', 'NOK', 'PLN', 'HKD', 'SGD'];

page(301, 'MONEY', 'Currencies', 'M', async () => {
  const start = daysAgo(35).toISOString().slice(0, 10);
  const j = await get(`https://api.frankfurter.dev/v1/${start}..?base=EUR&symbols=${FX.join(',')}`, 3600);
  const dates = Object.keys(j.rates).sort();
  const last = j.rates[dates.at(-1)], prev = j.rates[dates.at(-2)];
  const rows = FX.map((c) => {
    const series = dates.map((d) => j.rates[d][c]).filter(Boolean);
    const lo = Math.min(...series), hi = Math.max(...series);
    const ch = ((last[c] - prev[c]) / prev[c]) * 100;
    const perUsd = c === 'USD' ? 1 / last.USD : last[c] / last.USD;
    const d = (v) => (v >= 100 ? 1 : v >= 10 ? 3 : 4);
    return `{y}${c} {w}${num(last[c], d(last[c])).padStart(9)} ${num(perUsd, d(perUsd)).padStart(9)} ${upDown(ch)}${pct(ch, 2).padStart(6)} {c}${series.slice(-8).map((v) => spark(v, lo, hi)).join('')}`;
  });
  return {
    blocks: [['{c}    Per EUR    Per USD    Day   30d', ...rows, '', `{w}ECB reference rates, ${dates.at(-1)}`]],
    source: 'Frankfurter / ECB. Detail pages: 310',
  };
});

page(302, 'MONEY', 'Crypto markets', 'M', async () => {
  const m = (await coins()).slice(0, 19);
  const rows = m.map((c) => {
    const pts = (c.sparkline_in_7d?.price ?? []).filter((_, i, a) => i % Math.ceil(a.length / 6) === 0).slice(-6);
    const lo = Math.min(...pts), hi = Math.max(...pts);
    const d1 = c.price_change_percentage_24h_in_currency ?? 0;
    const d7 = c.price_change_percentage_7d_in_currency ?? 0;
    return `{y}${fit(c.symbol.toUpperCase(), 5)}{w}${priceFmt(c.current_price).padStart(11)} ${upDown(d1)}${pct(d1).padStart(7)} ${upDown(d7)}${pct(d7).padStart(7)} {c}${pts.map((v) => spark(v, lo, hi)).join('')}`;
  });
  return { blocks: [['{c}      Price USD     24h      7d  7d', ...rows]], source: 'CoinGecko. Coin pages: 350' };
}, { short: 'Crypto' });

Object.keys(ZONES).forEach((bzn, i) => {
  page(303 + i, 'MONEY', `Power price ${ZONES[bzn]}`, 'M', () => powerPage(bzn), { short: `Power ${bzn}`, noWarm: i > 0 });
});

// WEATHER ----------------------------------------------------------

export const CITIES = [
  ['London', 51.51, -0.13], ['Paris', 48.86, 2.35], ['Berlin', 52.52, 13.40], ['Madrid', 40.42, -3.70],
  ['Rome', 41.90, 12.50], ['Lisbon', 38.72, -9.14], ['Moscow', 55.76, 37.62], ['Cairo', 30.04, 31.24],
  ['Lagos', 6.52, 3.38], ['Dubai', 25.20, 55.27], ['Mumbai', 19.08, 72.88], ['Beijing', 39.90, 116.40],
  ['Tokyo', 35.68, 139.69], ['Sydney', -33.87, 151.21], ['New York', 40.71, -74.01], ['Los Angeles', 34.05, -118.24],
  ['Mexico City', 19.43, -99.13], ['Santiago', -33.45, -70.67], ['Buenos Aires', -34.60, -58.38],
];
const cityQS = () => `latitude=${CITIES.map((c) => c[1]).join(',')}&longitude=${CITIES.map((c) => c[2]).join(',')}`;

page(401, 'WEATHER', 'World cities now', 'C', async () => {
  const j = await get(`https://api.open-meteo.com/v1/forecast?${cityQS()}&current=temperature_2m,weather_code,is_day,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`, 900);
  const rows = j.map((c, i) => {
    const [cond, col] = WMO(c.current.weather_code, c.current.is_day);
    const local = new Date(Date.now() + c.utc_offset_seconds * 1000).toISOString().slice(11, 16);
    const t = Math.round(c.current.temperature_2m);
    const tc = t >= 30 ? 'r' : t >= 20 ? 'y' : t >= 10 ? 'g' : 'c';
    return `{w}${fit(CITIES[i][0], 11)} {c}${local} {${col}}${fit(cond, 10)}{${tc}}${String(t).padStart(3)}C {w}${String(Math.round(c.daily.temperature_2m_max[0])).padStart(3)}/${String(Math.round(c.daily.temperature_2m_min[0])).padEnd(3)}`;
  });
  return { blocks: [['{c}City        Time  Sky        Now  Hi/Lo', ...rows]], source: 'Open-Meteo. 89 capitals: page 410' };
}, { short: 'World weather' });

page(402, 'WEATHER', 'London 7 days', 'C', () => forecastBlocks(51.51, -0.13), { short: 'London 7d' });

const AQI = (v) => (v == null ? ['n/a', 'w'] : v <= 20 ? ['Good', 'g'] : v <= 40 ? ['Fair', 'g'] : v <= 60 ? ['Moderate', 'y'] : v <= 80 ? ['Poor', 'y'] : v <= 100 ? ['Very poor', 'r'] : ['Extreme', 'm']);

page(403, 'WEATHER', 'Air quality', 'C', async () => {
  const j = await get(`https://air-quality-api.open-meteo.com/v1/air-quality?${cityQS()}&current=european_aqi,pm2_5,pm10,uv_index`, 1800);
  const f = (v, n) => (v == null ? '-' : String(Math.round(v))).padStart(n);
  const rows = j.map((c, i) => {
    const [lbl, col] = AQI(c.current.european_aqi);
    return `{w}${fit(CITIES[i][0], 11)} {${col}}${f(c.current.european_aqi, 4)} ${fit(lbl, 10)}{c}${f(c.current.pm2_5, 5)}${f(c.current.pm10, 5)}{y}${f(c.current.uv_index, 3)}`;
  });
  return { blocks: [[`{c}${'City'.padEnd(12)}EAQI ${'Level'.padEnd(10)}PM2.5 PM10 UV`, ...rows]], source: 'Open-Meteo / CAMS (CC BY 4.0)' };
});

const quakePage = (feed, label) => async () => {
  const j = await get(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feed}.geojson`, 300);
  const blocks = j.features.slice(0, 60).map((f) => {
    const m = f.properties.mag ?? 0;
    const c = m >= 6 ? 'r' : m >= 5 ? 'y' : m >= 4 ? 'w' : 'c';
    return wrap(f.properties.place ?? 'Unknown', `{${c}}M${m.toFixed(1)} {g}${ago(f.properties.time).padStart(4)} {w}`, '           {w}');
  });
  const big = j.features.reduce((a, f) => ((f.properties.mag ?? 0) > (a?.properties.mag ?? -1) ? f : a), null);
  return {
    blocks: [[...wrap(`${j.metadata.count} quakes ${label}, largest M${big?.properties.mag?.toFixed(1) ?? '-'}`, '{y}'), ''], ...blocks],
    source: 'USGS Earthquake Hazards (public domain)',
  };
};
page(404, 'WEATHER', 'Earthquakes 24h', 'C', quakePage('2.5_day', 'M2.5+ in 24h'), { short: 'Quakes 24h' });
page(405, 'WEATHER', 'Significant quakes', 'C', quakePage('significant_week', 'significant this week'), { short: 'Big quakes' });
page(406, 'WEATHER', 'Earthquakes M4.5+ week', 'C', quakePage('4.5_week', 'M4.5+ in 7 days'), { short: 'Quakes week' });

// SPACE ------------------------------------------------------------

const launchRow = (l, n) => {
  const st = l.status?.abbrev ?? '?';
  const sc = st === 'Go' || st === 'Success' ? 'g' : st === 'TBC' ? 'y' : st === 'TBD' ? 'c' : 'r';
  return [
    `{y}${n ? `${n} ` : ''}{w}${dayMon(l.net, 'UTC')} ${hhmm(l.net, 'UTC')}Z {${sc}}${fit(st, 8)}{c}${fit(l.launch_service_provider?.name ?? '', n ? 13 : 17)}`,
    ...wrap(l.name, n ? '    {w}' : '{w}'),
    '',
  ];
};

page(501, 'SPACE', 'Upcoming launches', 'R', async () => {
  const j = await launchesUpcoming();
  return { blocks: j.results.map((l, i) => launchRow(l, 511 + i)), source: 'Launch Library 2 / The Space Devs', linkify: true };
}, { short: 'Launches' });

page(502, 'SPACE', 'ISS live position', 'R', async () => {
  const iss = await get('https://api.wheretheiss.at/v1/satellites/25544', 30);
  const lat = `${Math.abs(iss.latitude).toFixed(2)}${iss.latitude >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(iss.longitude).toFixed(2)}${iss.longitude >= 0 ? 'E' : 'W'}`;
  const period = ((2 * Math.PI * (6371 + iss.altitude)) / iss.velocity) * 60;
  return {
    blocks: [[
      '{y}INTERNATIONAL SPACE STATION',
      `{w}Position  {c}${lat} ${lon}`,
      `{w}Altitude  {c}${num(iss.altitude, 0)} km`,
      `{w}Speed     {c}${num(iss.velocity, 0)} km/h`,
      `{w}Orbit     {c}${num(period, 1)} min, ${num(1440 / period, 1)}/day`,
      `{w}Lighting  {c}${iss.visibility}`,
      '',
      ...worldMap(iss.latitude, iss.longitude),
      '',
      '{r}\u2588{w} ISS   {g}\u2593{w} land   {b}\u2591{w} ocean',
    ]],
    source: 'wheretheiss.at (live)',
  };
}, { short: 'ISS live' });

page(503, 'SPACE', 'Recent launches', 'R', async () => {
  const j = await launchesPrevious();
  return { blocks: j.results.map((l) => launchRow(l)), source: 'Launch Library 2 / The Space Devs' };
});

page(504, 'SPACE', 'Space weather', 'R', async () => {
  const [kp, wind, flux] = await settle([
    get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', 900),
    get('https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json', 300),
    get('https://services.swpc.noaa.gov/products/summary/10cm-flux.json', 3600),
  ]);
  const lines = [];
  if (kp?.length) {
    const vals = kp.slice(-24).map((k) => +k.Kp);
    const nowKp = vals.at(-1);
    const storm = nowKp >= 9 ? 'G5 extreme' : nowKp >= 8 ? 'G4 severe' : nowKp >= 7 ? 'G3 strong' : nowKp >= 6 ? 'G2 moderate' : nowKp >= 5 ? 'G1 minor' : 'No storm';
    lines.push(
      `{w}Planetary Kp {y}${nowKp.toFixed(2)}  {${nowKp >= 5 ? 'r' : 'g'}}${storm}`,
      '{w}Kp index, last 72 hours (3h steps)',
      '',
      ...vChart(vals, { height: 8, base: 0, fmt: (v) => v.toFixed(0), color: (v) => (v >= 5 ? 'r' : v >= 4 ? 'y' : 'g') }),
      '',
    );
  }
  if (wind?.[0]) lines.push(`{w}Solar wind   {c}${wind[0].proton_speed} km/s`);
  if (flux?.[0]) lines.push(`{w}F10.7 flux   {c}${flux[0].flux} sfu`);
  lines.push('', '{w}Kp 5+ means aurora possible at', '{w}mid-latitudes.');
  return { blocks: [lines], source: 'NOAA SWPC (public domain)' };
});

// Coarse 36x9 equirectangular land mask, 10 deg lon x 20 deg lat per cell.
const MAP = [
  '                                    ',
  '      ####    ###   ################',
  ' ##########   #  ##################  ',
  '   ########      ####################',
  '    #####       ######  ##########  ',
  '      ###       ######    # ##  #   ',
  '       #####     ####         ####  ',
  '        ###      ##          ####   ',
  '         #                          ',
];
function worldMap(lat, lon) {
  const r = Math.min(8, Math.max(0, Math.floor((90 - lat) / 20)));
  const c = Math.min(35, Math.max(0, Math.floor((lon + 180) / 10)));
  return MAP.map((row, i) => {
    let s = '{c}  ';
    for (let j = 0; j < 36; j++) s += i === r && j === c ? '{r}\u2588' : row[j] === '#' ? '{g}\u2593' : '{b}\u2591';
    return s;
  });
}

// STATUS -----------------------------------------------------------

page(601, 'STATUS', 'Internet services', 'Y', async () => {
  const res = await settle(STATUS.map(([, h]) => statusSummary(h)));
  const blocks = STATUS.map(([name], i) => {
    const s = res[i];
    if (!s) return [`{y}${611 + i} {w}${fit(name, 13)}{b}NO DATA`];
    const [l, c] = STATUS_LABEL[s.status?.indicator] ?? ['?', 'w'];
    const inc = (s.incidents ?? []).slice(0, 2).flatMap((x) => wrap(x.name, '    {y}- ', '      {y}'));
    return [`{y}${611 + i} {w}${fit(name, 13)}{${c}}${fit(l, 9)}{c}${s.status?.indicator === 'none' ? '' : fit(s.status?.description ?? '', 13)}`, ...inc];
  });
  return { blocks, source: 'Public Statuspage APIs', linkify: true };
}, { short: 'Service status' });

// CALENDAR ---------------------------------------------------------

page(701, 'WORLD', 'Public holidays', 'Y', async () => {
  const j = await get('https://date.nager.at/api/v3/NextPublicHolidaysWorldwide', 21600);
  const byDate = new Map();
  for (const h of j) (byDate.get(h.date) ?? byDate.set(h.date, []).get(h.date)).push(h);
  const blocks = [...byDate].map(([d, hs]) => [
    `{y}${new Date(`${d}T12:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}`,
    ...hs.flatMap((h) => wrap(h.name, `{c}${fit(country(h.countryCode), 14)}{w}`, `${' '.repeat(14)}{w}`)),
    '',
  ]);
  return { blocks, source: 'Nager.Date (MIT)' };
}, { short: 'Holidays' });
