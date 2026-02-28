# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Weather dashboard for the Ma'abarot meteorological station (Davis Vantage Pro). Hebrew-language RTL interface displaying live weather data, sensor readings, rain history, and an embedded map.

## Commands

- **Run dev server:** `npm start` or `node server.js` (serves on `http://localhost:3000`)
- No build step, no bundler, no test framework configured

## Architecture

**Zero-dependency Node.js server** (`server.js`) using only `node:http` and `node:fs`. It serves static files and acts as a CORS proxy for the upstream weather station:

- `/api/weather` → proxies `http://weather.maabarot.org.il/Current_Vantage_Pro.htm` (windows-1255 encoded)
- `/api/sensors` → proxies `http://62.128.42.5/weather/Tag-List.htm` (full sensor tag list)
- `/station/*` → proxies images/GIFs from `http://weather.maabarot.org.il/`

**Pages** (each an independent HTML file with its own JS/CSS):

| Page | HTML | JS | Description |
|------|------|----|-------------|
| Main dashboard | `index.html` | `app.js` | Gauge images from station, Netanya weather via Open-Meteo API, lightbox for graphs |
| Sensors | `sensors.html` | `sensors.js` | Parses Tag-List HTML into structured data, renders all sensor readings with high/low/monthly/yearly stats |
| Rain history | `rain.html` | `rain.js` | Fetches rain data from Google Sheets (JSONP), sortable/filterable table with pagination, statistics panel, CSV export |
| Map | `map.html` | (inline) | Embedded map view |

**Key patterns:**
- All client JS is vanilla (no framework), uses ES modules (`type: "module"` in package.json)
- Data auto-refreshes: gauges every 2.5 min, Netanya weather every 10 min, sensors every 2.5 min
- Rain data cached in localStorage for 6 hours
- `sensors.js` parses raw HTML table cells from the Davis station into a structured data object via `parseTagList()`

## External Data Sources

- **Station gauges:** GIF images from `weather.maabarot.org.il` (proxied through `/station/`)
- **Sensor data:** HTML table from `62.128.42.5/weather/Tag-List.htm`
- **Netanya weather:** Open-Meteo free API (no key needed)
- **Rain history:** Google Sheets public spreadsheet (ID: `1AfOkRqGLd915bBpV6pRLnAKT2Ux3AXauxPaqLGBXlGE`)

## Deployment

Configured for Render.com free tier via `render.yaml`. Uses `PORT` env variable.

## Workflow

- Always commit and push changes when done and tested. No approval needed — push directly.
