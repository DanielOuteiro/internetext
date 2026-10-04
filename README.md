# INTERNETEXT

Live teletext for the internet. 40×25 characters, 8 colours, no accounts, no API keys.

Site: [internetext.com](https://internetext.com)

## Run

```bash
npm start
```

Open [http://localhost:8888](http://localhost:8888). Node 20+. `PORT` defaults to 8888.

## Netlify

No keys. Form fields:

- Base directory: empty
- Build command: empty (`netlify.toml` runs `true`)
- Publish directory: `public`
- Functions directory: `netlify/functions`

Custom domain: `internetext.com` → the Netlify site.

## Controls

- Type 3 digits to open a page
- Left / right: previous / next page
- Up / down: subpage
- `h` hold, `i` index
- `r` `g` `y` `c` colour shortcuts
- Click page numbers on directory screens

## Pages

About 630 live pages, numbered 100–899.

| Range | Content |
| --- | --- |
| 100, 199 | Index and A–Z directory |
| 1xx | Headlines, Wikipedia, Hacker News, BBC/DW/Al Jazeera/Guardian RSS |
| 2xx | World football (PL, La Liga, Serie A, Ligue 1, UCL, MLS…), F1, Bundesliga |
| 3xx | Currencies, crypto, power prices |
| 4xx | Weather, pollen, sea state, rivers, air quality, earthquakes |
| 5xx | Launches, ISS, flights, MLB, NHL, 2026 in sports |
| 6xx | Status, US alerts, disasters, EONET, Met, books, Lichess, GBIF |
| 7xx–8xx | World stats, clocks, holidays, one page per country |

## Sources

All public, no private keys: Wikipedia, BBC/DW/Al Jazeera/Guardian RSS, Hacker News, OpenLigaDB, TheSportsDB (documented free key 123), MLB StatsAPI, NHL api-web, Jolpica F1, Frankfurter/ECB, CoinGecko, Energy-Charts, Open-Meteo, NWS, USGS, GDACS, NASA EONET, OpenSky, Launch Library 2, NOAA SWPC, World Bank, Nager.Date, Met Museum, Open Library, MusicBrainz, Lichess, GBIF, openFDA, mledoze/countries.

## License

MIT. Font: [Bedstead](https://bjh21.me.uk/bedstead/) by Ben Harris.
