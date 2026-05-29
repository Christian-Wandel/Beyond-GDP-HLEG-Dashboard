# Beyond GDP HLEG — Project Summary

## Mission

Build a standalone dashboard visualising only the 20 UN HLEG Tier I indicators from the "Counting What Counts" report (May 2026). Framework-pure — 4 HLEG components, no GDP+/MLSI mixing. Loneliness (#11) rendered as explicit No-Data tile (Gallup paywall).

## v0.1 — 2026-05-29

**Built:** Full dashboard v0.1

- `index.html` — Landing hub with 4 component status cards + HLEG composite (19-indicator average)
- `foundational.html` — 3 cards: IPV (#1), GHG Total (#2), BII (#3)
- `wellbeing.html` — 9 live cards + loneliness no-data tile (#4–#13)
- `equality.html` — 3 cards: Gini (#14), Societal Poverty (#15), Gender Pay (#16)
- `sustainability.html` — 4 cards: Produced Capital (#17), NEET (#18), Gov Confidence (#19), Trust (#20)
- `aggregate.html` — HLEG Option A + Option B for DK/VN/KEN (ported from sister project)
- `js/core.js` — HLEG Tier I render functions, `computeHLEGAggregate`, `computeComponentStatus`
- `js/aggregates.js` — Option A/B (ported verbatim)
- `data/` — 23 JSON files
- `sync_data.py` — data sync from `Beyond GDP Project/` pipeline

**Decisions locked:**
- hhinc (#4): GDP proxy, labelled as proxy in drawer
- loneliness (#11): no-data tile, no WHR proxy
- Aggregates: DK/VN/KEN composites, Tier I indicators only
- Data sync: copy script (not symlink, not independent fetch)
- Repo name: `beyond-gdp-hleg`

**Open:**
- GitHub repo not yet created (next step: `/github-push`)
- Workspace CLAUDE.md routing table not yet updated (same session)
