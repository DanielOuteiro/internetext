# INTERNETEXT

Live teletext for the internet. 40×25 characters, 8 colours, no accounts, no API keys.

Site: [internetext.com](https://internetext.com)

## Run

```bash
npm start
```

Open [http://localhost:8888](http://localhost:8888). Node 20+.

Optional: `HOME_NAME`, `HOME_LAT`, `HOME_LON` set the local forecast on page 402. `PORT` defaults to 8888.

## Controls

- Type 3 digits to open a page
- Left / right: previous / next page
- Up / down: subpage
- `h` hold, `i` index
- `r` `g` `y` `c` colour shortcuts
- Click page numbers on directory screens

## Pages

About 570 live pages, numbered 100–899.

| Range | Content |
| --- | --- |
| 100, 199 | Index and A–Z directory |
| 1xx | Headlines, Wikipedia, Hacker News |
| 2xx | Bundesliga, F1 drivers and races |
| 3xx | Currencies, crypto, power prices |
| 4xx | Weather, air quality, earthquakes |
| 5xx | Launches, ISS, space weather |
| 6xx | Public status pages |
| 7xx–8xx | One page per country |

## Sources

All public, no keys: Wikipedia, Hacker News, OpenLigaDB, Jolpica F1, Frankfurter/ECB, CoinGecko, Energy-Charts, Open-Meteo, USGS, Launch Library 2, NOAA SWPC, World Bank, Nager.Date, mledoze/countries.

## License

MIT. Font: [Bedstead](https://bjh21.me.uk/bedstead/) by Ben Harris.
