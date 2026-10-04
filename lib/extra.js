import { rssPage } from './sources/rss.js';
import { tablePage, resultsPage } from './sources/openliga.js';
import { leaguePage } from './sources/sportsdb.js';
import { mlbStandings, mlbScores } from './sources/mlb.js';
import { nhlStandings, nhlScores } from './sources/nhl.js';
import {
  wikiSports, pollenPage, marinePage, floodPage, nwsAlerts, volcanoes, gdacs, eonet,
  opensky, metSafe, openLibrary, musicbrainz, lichess, gbif, openFda, worldBankSnap, worldClocks,
} from './sources/rest.js';

export function registerExtra(page) {

page(161, 'NEWS', 'BBC World', 'B', rssPage('https://feeds.bbci.co.uk/news/world/rss.xml', 'BBC News World RSS'), { short: 'BBC World' });
page(162, 'NEWS', 'BBC Sport', 'B', rssPage('https://feeds.bbci.co.uk/sport/rss.xml', 'BBC Sport RSS'), { short: 'BBC Sport' });
page(163, 'NEWS', 'DW World', 'B', rssPage('https://rss.dw.com/rdf/rss-en-world', 'Deutsche Welle World RSS'), { short: 'DW World' });
page(164, 'NEWS', 'Al Jazeera', 'B', rssPage('https://www.aljazeera.com/xml/rss/all.xml', 'Al Jazeera RSS'), { short: 'Al Jazeera' });
page(165, 'NEWS', 'Guardian World', 'B', rssPage('https://www.theguardian.com/world/rss', 'The Guardian World RSS'), { short: 'Guardian' });

page(200, 'SPORT', 'Sport index', 'G', async () => ({
  blocks: [[
    '{y}FOOTBALL',
    '{w}Bundesliga          {y}201  {w}Results {y}202',
    '{w}2. Bundesliga       {y}206  {w}3. Liga {y}208',
    '{w}Champions League    {y}289  {w}UCL res {y}290',
    '{w}DFB-Pokal           {y}291  {w}Frauen  {y}292',
    '{w}World Cup 2026      {y}294',
    '{w}Premier League      {y}295  {w}La Liga {y}296',
    '{w}Serie A             {y}297  {w}Ligue 1 {y}298',
    '{w}Eredivisie          {y}299  {w}Portugal {y}300',
    '{w}MLS                 {y}229  {w}Brazil  {y}259',
    '',
    '{y}OTHER',
    '{w}F1 drivers          {y}203  {w}F1 cal  {y}260',
    '{w}2026 in sports      {y}526',
    '{w}MLB standings       {y}527  {w}Scores  {y}528',
    '{w}NHL standings       {y}529  {w}Scores  {y}530',
  ]],
  source: 'Sport directory',
  linkify: true,
}), { short: 'Sport index' });

page(229, 'SPORT', 'MLS', 'G', leaguePage(4346, 'MLS'), { short: 'MLS' });
page(259, 'SPORT', 'Brasileirao', 'G', leaguePage(4351, 'Brasileirao'), { short: 'Brazil A' });

page(289, 'SPORT', 'Champions League table', 'G', tablePage('ucl', { legend: '{g}Top of league phase' }), { short: 'UCL table' });
page(290, 'SPORT', 'Champions League results', 'G', resultsPage('ucl'), { short: 'UCL results' });
page(291, 'SPORT', 'DFB-Pokal', 'G', resultsPage('dfb'), { short: 'DFB-Pokal' });
page(292, 'SPORT', 'Frauen-Bundesliga', 'G', tablePage('ffb1'), { short: 'Frauen-BL' });
page(293, 'SPORT', 'Frauen-BL results', 'G', resultsPage('ffb1'), { short: 'Frauen res' });
page(294, 'SPORT', 'World Cup 2026 table', 'G', tablePage('wm2026', { legend: '{w}Qualifying / groups' }), { short: 'WC 2026' });
page(295, 'SPORT', 'Premier League', 'G', leaguePage(4328, 'Premier League'), { short: 'Premier Lge' });
page(296, 'SPORT', 'La Liga', 'G', leaguePage(4335, 'La Liga'), { short: 'La Liga' });
page(297, 'SPORT', 'Serie A', 'G', leaguePage(4332, 'Serie A'), { short: 'Serie A' });
page(298, 'SPORT', 'Ligue 1', 'G', leaguePage(4334, 'Ligue 1'), { short: 'Ligue 1' });
page(299, 'SPORT', 'Eredivisie', 'G', leaguePage(4337, 'Eredivisie'), { short: 'Eredivisie' });
page(300, 'SPORT', 'Primeira Liga', 'G', leaguePage(4344, 'Primeira Liga'), { short: 'Primeira' });

page(407, 'WEATHER', 'Pollen', 'C', pollenPage, { short: 'Pollen' });
page(408, 'WEATHER', 'Sea state', 'C', marinePage, { short: 'Marine' });
page(409, 'WEATHER', 'Rivers', 'C', floodPage, { short: 'Rivers' });

page(505, 'SPACE', 'Flights NW Europe', 'R', opensky, { short: 'Flights' });

page(526, 'SPORT', '2026 in sports', 'G', wikiSports, { short: '2026 sports' });
page(527, 'SPORT', 'MLB standings', 'G', mlbStandings, { short: 'MLB table' });
page(528, 'SPORT', 'MLB scores', 'G', mlbScores, { short: 'MLB scores' });
page(529, 'SPORT', 'NHL standings', 'G', nhlStandings, { short: 'NHL table' });
page(530, 'SPORT', 'NHL scores', 'G', nhlScores, { short: 'NHL scores' });

page(561, 'EARTH', 'US severe alerts', 'C', nwsAlerts, { short: 'US alerts' });
page(562, 'EARTH', 'Volcanoes', 'C', volcanoes, { short: 'Volcanoes' });
page(563, 'EARTH', 'Disasters', 'C', gdacs, { short: 'Disasters' });
page(564, 'EARTH', 'Earth events', 'C', eonet, { short: 'EONET' });

page(623, 'CULTURE', 'Met Museum', 'Y', metSafe, { short: 'Met' });
page(624, 'CULTURE', 'Trending books', 'Y', openLibrary, { short: 'Books' });
page(625, 'CULTURE', 'New releases', 'Y', musicbrainz, { short: 'Releases' });
page(626, 'CULTURE', 'Lichess TV', 'Y', lichess, { short: 'Lichess' });
page(627, 'CULTURE', 'Species records', 'Y', gbif, { short: 'GBIF' });
page(628, 'CULTURE', 'Food recalls', 'Y', openFda, { short: 'FDA' });

page(681, 'WORLD', 'World in numbers', 'Y', worldBankSnap, { short: 'World stats' });
page(682, 'WORLD', 'World clocks', 'Y', worldClocks, { short: 'Clocks' });
}
