# Beyond GDP HLEG

HLEG Tier I exclusive dashboard. 20 indicators from the UN HLEG "Counting What Counts" report (May 2026). Sister project: `Beyond GDP Project/` (full 34-card analytical version with GDP+/MLSI/6-pillar framework).

## Distinction from sister project

| | This project | Sister project |
|---|---|---|
| **Folder** | `projects/Beyond GDP HLEG/` | `projects/Beyond GDP Project/` |
| **Indicators** | 20 (HLEG Tier I only) | 34 (HLEG + GDP+ + MLSI + UNDP + SDG) |
| **Structure** | 4 HLEG components | 6 GDP+ pillars |
| **Framework** | Pure UN HLEG | Multi-framework analytical |

When the user says "the dashboard" and both projects are active, **ask which one** unless context is clear (open file, CWD, or mention of "HLEG" vs "pillars/GDP+").

## Structure

```
04_dashboard/     Static HTML dashboard (no build step)
  index.html      Landing hub — 4 component status cards + HLEG composite
  foundational.html  3 cards: IPV, GHG total, BII
  wellbeing.html     10 cards: 9 live + loneliness no-data tile
  equality.html      3 cards: Gini, societal poverty, gender pay ratio
  sustainability.html 4 cards: produced capital, NEET, gov conf, trust
  aggregate.html     HLEG Option A + Option B (DK/VN/KEN)
  js/core.js         HLEG Tier I render functions + computeHLEGAggregate
  js/aggregates.js   Option A/B computation (ported from sister project)
  data/              23 JSON files (20 Tier I + shared + aggregate deps)
  lib/echarts.min.js
sync_data.py      Copies Tier I JSON from sister project data pipeline
```

## How to run

```bash
cd "projects/Beyond GDP HLEG/04_dashboard"
python -m http.server 8080
# http://localhost:8080
```

## Data sync

After any pipeline update in the sister project:
```bash
python "projects/Beyond GDP HLEG/sync_data.py"
```

## Routing

| Task | File | Note |
|------|------|------|
| Add/edit a card | `04_dashboard/*.html` + `js/core.js` | One render fn per indicator in core.js |
| Change composite score | `js/core.js` → `computeHLEGAggregate` | 19 indicators (loneliness excluded) |
| Change component status | `js/core.js` → `computeComponentStatus` | Used by landing hub |
| Edit aggregate methodology | `js/aggregates.js` + `data/aggregate-presets.json` | Option A/B DK/VN/KEN |
| Sync fresh data | `sync_data.py` | Run after original pipeline |
| Push to GitHub | `/github-push` skill | Repo: `beyond-gdp-hleg` |
