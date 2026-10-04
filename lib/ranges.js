import { get, settle } from './fetch.js';
import { clean, fit, wrap, stripHtml, spark, pct, upDown, num, hhmm, dayMon, ago } from './text.js';
import {
  wikiFeedWith, hnTop, hnItem, hostOf, geocode, forecastBlocks, WMO, vChart, downsample,
  blTable, blSeasonMatches, finalScore, team, f1, gp, countries, allCountries, populations, worldBank, wikiSummary,
  coins, fxCurrencies, fxLatest, priceFmt, STATUS, statusSummary, STATUS_LABEL, launchesUpcoming,
  compact, daysAgo,
} from './shared.js';

// A range maps a list of items onto consecutive page numbers starting at `start`.
// `dir` (optional) is an auto-generated directory page linking to every item.
export const ranges = [];
const range = (spec) => ranges.push(spec);

const NO_COMMENT_TAGS = /<p>/g;
const kv = (k, v, c = 'c') => `{w}${k.padEnd(11)}{${c}}${v}`;

// NEWS: trending articles ------------------------------------------

range({
  start: 111, max: 50, section: 'NEWS', color: 'B',
  list: async () => (await wikiFeedWith('mostread')).mostread.articles.slice(0, 50),
  title: (a) => a.titles.normalized,
  build: async (a) => {
    const hist = (a.view_history ?? []).map((h) => h.views);
    const lo = Math.min(...hist), hi = Math.max(...hist);
    return {
      blocks: [
        [
          ...(a.description ? wrap(a.description, '{c}') : []),
          `{w}Views yesterday {y}${num(a.views, 0)} {w}rank {y}#${a.rank}`,
          ...(hist.length > 1 ? [`{w}Trend {g}${hist.map((v) => spark(v, lo, hi)).join('')}`] : []),
          '',
        ],
        ...wrap(a.extract ?? '', '{w}').map((l) => [l]),
      ],
      source: 'Wikipedia (CC BY-SA) - back: 104',
    };
  },
});

// NEWS: Hacker News stories ----------------------------------------

range({
  start: 171, max: 28, section: 'NEWS', color: 'B',
  list: () => hnTop(28),
  title: (it) => it.title,
  build: async (it) => {
    const kids = (await settle((it.kids ?? []).slice(0, 6).map(hnItem))).filter((c) => c && !c.deleted && !c.dead && c.text);
    const blocks = [[
      ...wrap(it.title, '{y}'),
      `{c}${hostOf(it.url)}`,
      `{g}${it.score} pts {w}by {c}${clean(it.by)} {w}${ago(it.time * 1000)} ago`,
      `{w}${it.descendants ?? 0} comments`,
      '',
    ]];
    if (it.text) blocks.push([...wrap(stripHtml(it.text.replace(NO_COMMENT_TAGS, ' ')), '{w}').slice(0, 18), '']);
    for (const c of kids) {
      blocks.push([`{c}${clean(c.by)} {b}${ago(c.time * 1000)}`, ...wrap(stripHtml(c.text.replace(NO_COMMENT_TAGS, ' ')), '{w}').slice(0, 12), '']);
    }
    return { blocks, source: 'Hacker News API - back: 103' };
  },
});

// SPORT: Bundesliga clubs ------------------------------------------

range({
  dir: 210, dirTitle: 'Bundesliga clubs', start: 211, max: 18, section: 'SPORT', color: 'G',
  list: async () => {
    const t = await blTable('bl1');
    return t.map((r, i) => ({ ...r, pos: i + 1 })).sort((a, b) => a.teamName.localeCompare(b.teamName));
  },
  title: (c) => c.teamName,
  info: (c) => `${String(c.pos).padStart(2)}. ${String(c.points).padStart(3)} pts`,
  build: async (club) => {
    const ms = (await blSeasonMatches('bl1')).filter((m) => m.team1.teamId === club.teamInfoId || m.team2.teamId === club.teamInfoId);
    const form = [];
    const rows = ms.map((m) => {
      const home = m.team1.teamId === club.teamInfoId;
      const opp = home ? m.team2 : m.team1;
      const f = finalScore(m);
      let res = ' ', rc = 'w', score = '  -:-';
      if (f) {
        const [gf, ga] = home ? [f.pointsTeam1, f.pointsTeam2] : [f.pointsTeam2, f.pointsTeam1];
        score = `${gf}-${ga}`.padStart(5);
        if (m.matchIsFinished) { res = gf > ga ? 'W' : gf < ga ? 'L' : 'D'; rc = { W: 'g', L: 'r', D: 'y' }[res]; form.push(`{${rc}}${res}`); }
      }
      return `{c}${String(m.group.groupOrderID).padStart(2)} ${dayMon(m.matchDateTimeUTC, 'Europe/Berlin')} {w}${home ? 'H' : 'A'} ${fit(team(opp), 17)}{y}${score} {${rc}}${res}`;
    });
    const gd = club.goalDiff > 0 ? `+${club.goalDiff}` : club.goalDiff;
    return {
      blocks: [[
        `{w}Position {y}${club.pos}  {w}Points {y}${club.points}  {w}GD {y}${gd}`,
        `{w}P${club.matches} W${club.won} D${club.draw} L${club.lost}  {w}Form ${form.slice(-5).join('') || '-'}`,
        '',
        '{c}MD Date   H/A Opponent        Score',
        ...rows,
      ]],
      source: 'OpenLigaDB (ODbL) - table: 201',
    };
  },
});

// SPORT: F1 drivers ------------------------------------------------

range({
  dir: 230, dirTitle: 'F1 driver pages', start: 231, max: 28, section: 'SPORT', color: 'G',
  list: async () => (await f1('current/driverStandings.json')).StandingsTable.StandingsLists[0].DriverStandings,
  title: (s) => `${s.Driver.givenName} ${s.Driver.familyName}`,
  info: (s) => `P${s.position.padEnd(3)}${s.points.padStart(4)} pts`,
  build: async (s) => {
    const races = (await f1(`current/drivers/${s.Driver.driverId}/results.json`)).RaceTable.Races;
    const rows = races.map((r) => {
      const x = r.Results[0];
      const p = +x.position;
      const c = p === 1 ? 'y' : p <= 3 ? 'g' : p <= 10 ? 'w' : 'c';
      return `{c}${r.round.padStart(2)} {w}${fit(gp(r.raceName), 20)}{c}${x.grid.padStart(3)} {${c}}${fit(x.positionText, 3, true)} {g}${fit(x.points, 4, true)}`;
    });
    return {
      blocks: [[
        kv('Team', s.Constructors[0]?.name ?? '-'),
        kv('Number', s.Driver.permanentNumber ?? '-'),
        kv('Nation', s.Driver.nationality),
        kv('Standing', `P${s.position}, ${s.points} pts, ${s.wins} wins`, 'y'),
        '',
        '{c}Rd Grand Prix          Grid Pos  Pts',
        ...rows,
      ]],
      source: 'Jolpica F1 API - standings: 203',
    };
  },
});

// SPORT: F1 calendar -----------------------------------------------

range({
  dir: 260, dirTitle: 'F1 calendar', start: 261, max: 28, section: 'SPORT', color: 'G',
  list: async () => (await f1('current.json', 21600)).RaceTable.Races,
  title: (r) => `R${r.round} ${r.raceName}`,
  info: (r) => `${dayMon(`${r.date}T12:00Z`, 'UTC')}${new Date(`${r.date}T23:59Z`) < new Date() ? ' done' : ''}`,
  build: async (r) => {
    const sess = [['FirstPractice', 'FP1'], ['SecondPractice', 'FP2'], ['ThirdPractice', 'FP3'], ['SprintQualifying', 'Sprint Q'], ['Sprint', 'Sprint'], ['Qualifying', 'Quali']]
      .filter(([k]) => r[k])
      .map(([k, l]) => `{w}${l.padEnd(10)}{c}${dayMon(`${r[k].date}T${r[k].time ?? '12:00:00Z'}`, 'UTC')} ${r[k].time?.slice(0, 5) ?? '--:--'}Z`);
    const lines = [
      ...wrap(r.Circuit.circuitName, `{w}${'Circuit'.padEnd(11)}{c}`, `${' '.repeat(11)}{c}`),
      ...wrap(`${r.Circuit.Location.locality}, ${r.Circuit.Location.country}`, `{w}${'Location'.padEnd(11)}{c}`, `${' '.repeat(11)}{c}`),
      '',
      ...sess,
      `{y}${'Race'.padEnd(10)}{y}${dayMon(`${r.date}T12:00Z`, 'UTC')} ${r.time?.slice(0, 5) ?? '--:--'}Z`,
      '',
    ];
    if (new Date(`${r.date}T23:59Z`) < new Date()) {
      const res = (await f1(`current/${r.round}/results.json`, 86400)).RaceTable.Races[0]?.Results ?? [];
      lines.push('{y}RESULT', ...res.map((x) =>
        `{y}${x.positionText.padStart(2)} {w}${fit(x.Driver.familyName, 12)}{c}${fit(x.Constructor.name, 10)}{w}${fit(x.Time?.time ?? x.status, 12, true)}{g}${fit(x.points, 3, true)}`));
    }
    return { blocks: [lines], source: 'Jolpica F1 API (Ergast successor)' };
  },
});

// MONEY: currencies ------------------------------------------------

range({
  dir: 310, dirTitle: 'Currency pages', start: 311, max: 30, section: 'MONEY', color: 'M',
  list: async () => {
    const [names, latest] = await Promise.all([fxCurrencies(), fxLatest()]);
    return Object.keys(latest.rates).sort().map((code) => ({ code, name: names[code] ?? code, rate: latest.rates[code] }));
  },
  title: (c) => `${c.code} ${c.name}`,
  info: (c) => num(c.rate, c.rate >= 100 ? 1 : 4),
  build: async (c) => {
    const start = daysAgo(180).toISOString().slice(0, 10);
    const sym = c.code === 'USD' ? 'USD' : `${c.code},USD`;
    const j = await get(`https://api.frankfurter.dev/v1/${start}..?base=EUR&symbols=${sym}`, 3600);
    const dates = Object.keys(j.rates).sort();
    const s = dates.map((d) => j.rates[d][c.code]);
    const last = s.at(-1);
    const usd = j.rates[dates.at(-1)].USD;
    const chg = (n) => { const v = s.at(-1 - n); return v ? ((last - v) / v) * 100 : 0; };
    const d = last >= 100 ? 2 : 4;
    const series = downsample(s, 34);
    return {
      blocks: [[
        `{w}1 EUR = {y}${num(last, d)} ${c.code}`,
        `{w}1 USD = {y}${num(c.code === 'USD' ? 1 : last / usd, d)} ${c.code}`,
        `{w}1 ${c.code} = {y}${num(1 / last, 6)} EUR`,
        `{w}Day ${upDown(chg(1))}${pct(chg(1), 2)} {w}Month ${upDown(chg(21))}${pct(chg(21), 2)} {w}6m ${upDown(chg(s.length - 1))}${pct(chg(s.length - 1), 1)}`,
        '',
        ...vChart(series, { height: 9, fmt: (v) => num(v, v >= 100 ? 0 : 2), color: () => 'c' }),
        `{c}      ${dates[0].slice(5)}${' '.repeat(23)}${dates.at(-1).slice(5)}`,
        `{w}6-month range {g}${num(Math.min(...s), d)} {w}- {r}${num(Math.max(...s), d)}`,
      ]],
      source: 'Frankfurter / European Central Bank',
    };
  },
});

// MONEY: crypto ----------------------------------------------------

range({
  dir: 350, dirTitle: 'Crypto coin pages', start: 351, max: 49, section: 'MONEY', color: 'M',
  list: async () => (await coins()).slice(0, 49),
  title: (c) => `${c.name} (${c.symbol.toUpperCase()})`,
  info: (c) => `$${priceFmt(c.current_price)}`,
  build: async (c) => {
    const s = downsample(c.sparkline_in_7d?.price ?? [], 34);
    const p = (k) => c[`price_change_percentage_${k}_in_currency`] ?? 0;
    return {
      blocks: [[
        `{w}Price {y}$${priceFmt(c.current_price)} {w}rank {y}#${c.market_cap_rank}`,
        `{w}1h ${upDown(p('1h'))}${pct(p('1h'))} {w}24h ${upDown(p('24h'))}${pct(p('24h'))} {w}7d ${upDown(p('7d'))}${pct(p('7d'))}`,
        kv('Market cap', `$${compact(c.market_cap)}`),
        kv('Volume 24h', `$${compact(c.total_volume)}`),
        kv('24h range', `${priceFmt(c.low_24h)} - ${priceFmt(c.high_24h)}`),
        kv('ATH', `$${priceFmt(c.ath)} ${dayMon(c.ath_date, 'UTC')} ${c.ath_date?.slice(0, 4)}`),
        kv('From ATH', pct(c.ath_change_percentage ?? 0), (c.ath_change_percentage ?? 0) < 0 ? 'r' : 'g'),
        kv('Supply', `${compact(c.circulating_supply)}${c.max_supply ? ` / ${compact(c.max_supply)}` : ''}`),
        '',
        ...(s.length ? vChart(s, { height: 8, fmt: priceFmt, color: (v) => (v >= s[0] ? 'g' : 'r') }) : []),
        '{c}      7 days ago                    now',
      ]],
      source: 'CoinGecko public API - overview: 302',
    };
  },
});

// WEATHER: capital cities ------------------------------------------

async function capitals() {
  const [cs, pop] = await Promise.all([countries(), populations()]);
  return cs.filter((c) => c.capital?.[0])
    .map((c) => ({ city: c.capital[0], country: c.name.common, cca2: c.cca2, latlng: c.latlng, pop: pop.get(c.cca3) ?? 0 }))
    .sort((a, b) => b.pop - a.pop).slice(0, 89)
    .sort((a, b) => a.city.localeCompare(b.city));
}

range({
  dir: 410, dirTitle: 'Capital city forecasts', start: 411, max: 89, section: 'WEATHER', color: 'C',
  list: capitals,
  title: (c) => `${c.city}, ${c.country}`,
  build: async (c) => {
    const { lat, lon } = await geocode(c.city, c.cca2, c.latlng);
    return forecastBlocks(lat, lon);
  },
});

// SPACE: launch details --------------------------------------------

range({
  start: 511, max: 15, section: 'SPACE', color: 'R',
  list: async () => (await launchesUpcoming()).results,
  title: (l) => l.name,
  build: async (l) => {
    const m = l.mission;
    return {
      blocks: [
        [
          ...wrap(l.name, '{y}'),
          '',
          kv('Status', l.status?.name ?? '-', l.status?.abbrev === 'Go' ? 'g' : 'y'),
          kv('Launch', `${dayMon(l.net, 'UTC')} ${hhmm(l.net, 'UTC')} UTC`),
          kv('Provider', fit(l.launch_service_provider?.name ?? '-', 29)),
          kv('Rocket', fit(l.rocket?.configuration?.full_name ?? '-', 29)),
          ...(m ? [kv('Orbit', fit(m.orbit?.name ?? '-', 29)), kv('Type', fit(m.type ?? '-', 29))] : []),
          ...wrap(l.pad?.name ?? '', '{w}Pad        {c}', `${' '.repeat(11)}{c}`),
          ...wrap(l.pad?.location?.name ?? '', `${' '.repeat(11)}{b}`),
          '',
        ],
        ...(m?.description ? wrap(m.description, '{w}').map((x) => [x]) : []),
      ],
      source: 'Launch Library 2 - back: 501',
    };
  },
});

// STATUS: per-service components -----------------------------------

const COMP = { operational: ['OK', 'g'], degraded_performance: ['DEGRADED', 'y'], partial_outage: ['PARTIAL', 'r'], major_outage: ['OUTAGE', 'r'], under_maintenance: ['MAINT', 'c'] };

range({
  start: 611, max: STATUS.length, section: 'STATUS', color: 'Y',
  list: async () => STATUS.map(([name, host]) => ({ name, host })),
  title: (s) => `${s.name} status`,
  build: async (s) => {
    const j = await statusSummary(s.host);
    const [l, c] = STATUS_LABEL[j.status?.indicator] ?? ['?', 'w'];
    const comps = (j.components ?? []).filter((x) => !x.group).slice(0, 60);
    const blocks = [[`{${c}}${l} {w}${clean(j.status?.description ?? '')}`, '']];
    for (const inc of j.incidents ?? []) {
      blocks.push([...wrap(inc.name, '{y}'), ...wrap(stripHtml(inc.incident_updates?.[0]?.body ?? ''), '{w}').slice(0, 8), '']);
    }
    blocks.push(comps.map((x) => { const [cl, cc] = COMP[x.status] ?? [x.status, 'w']; return `{w}${fit(x.name, 30)}{${cc}}${fit(cl, 9, true)}`; }));
    return { blocks, source: `${s.host} - back: 601` };
  },
});

// WORLD: countries -------------------------------------------------

range({
  dir: 700, dirTitle: 'Countries A-Z', start: 702, max: 198, section: 'WORLD', color: 'Y',
  list: countries,
  title: (c) => c.name.common,
  info: (c) => c.capital?.[0] ?? '',
  build: async (c) => {
    const all = await allCountries();
    const byCode = new Map(all.map((x) => [x.cca3, x.name.common]));
    const [wb, wiki, hol, geo] = await settle([
      worldBank(c.cca3),
      wikiSummary(c.name.common),
      get(`https://date.nager.at/api/v3/NextPublicHolidays/${c.cca2}`, 21600),
      c.capital?.[0] ? geocode(c.capital[0], c.cca2, c.latlng) : null,
    ]);
    const wx = geo ? await get(`https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,weather_code,is_day&timezone=auto`, 900).catch(() => null) : null;
    const v = (k) => wb?.[k]?.value;
    const pop = v('SP.POP.TOTL');
    const facts = [
      ...wrap(c.name.official, '{y}'),
      kv('Capital', clean(c.capital?.join(', ') ?? '-')),
      kv('Region', clean(`${c.subregion || c.region}`)),
      ...(pop ? [kv('Population', `${compact(pop)} (${wb['SP.POP.TOTL'].year})`)] : []),
      kv('Area', `${num(c.area, 0)} km2${pop ? `, ${num(pop / c.area, 0)}/km2` : ''}`),
      ...(v('NY.GDP.MKTP.CD') ? [kv('GDP', `$${compact(v('NY.GDP.MKTP.CD'))}, $${num(v('NY.GDP.PCAP.CD') ?? 0, 0)}/head`)] : []),
      ...(v('SP.DYN.LE00.IN') ? [kv('Life exp.', `${num(v('SP.DYN.LE00.IN'), 1)} years`)] : []),
      ...wrap(Object.values(c.languages ?? {}).join(', ') || '-', `{w}${'Languages'.padEnd(11)}{c}`, `${' '.repeat(11)}{c}`),
      ...wrap(Object.entries(c.currencies ?? {}).map(([k, x]) => `${x.name} (${k})`).join(', ') || '-', `{w}${'Currency'.padEnd(11)}{c}`, `${' '.repeat(11)}{c}`),
      kv('Dial code', `${c.idd?.root ?? ''}${c.idd?.suffixes?.length === 1 ? c.idd.suffixes[0] : ''} {w}TLD {c}${c.tld?.[0] ?? '-'}`),
      ...(c.borders?.length ? wrap(c.borders.map((b) => byCode.get(b) ?? b).join(', '), `{w}${'Borders'.padEnd(11)}{c}`, `${' '.repeat(11)}{c}`) : [kv('Borders', c.landlocked ? 'none' : 'none (coastal/island)')]),
    ];
    if (wx?.current) {
      const [cond, col] = WMO(wx.current.weather_code, wx.current.is_day);
      facts.push(`{w}${'Weather'.padEnd(11)}{${col}}${cond} {y}${Math.round(wx.current.temperature_2m)}C {w}at ${wx.current.time.slice(11)}`);
    }
    const blocks = [facts];
    if (Array.isArray(hol) && hol.length) {
      blocks.push(['', '{y}NEXT PUBLIC HOLIDAYS', ...hol.slice(0, 4).map((h) => `{c}${dayMon(`${h.date}T12:00Z`, 'UTC')} {w}${fit(h.name, 33)}`)]);
    }
    if (wiki?.extract) blocks.push(['', '{y}ABOUT'], ...wrap(wiki.extract, '{w}').map((l) => [l]));
    return { blocks, source: 'mledoze/countries, World Bank, Wikipedia' };
  },
});
