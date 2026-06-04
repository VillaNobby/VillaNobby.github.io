# Villa Nobby — Claude Project Guide

**Live site:** https://www.villanobby.com  
**GitHub repo:** https://github.com/VillaNobby/VillaNobby.github.io (GitHub Pages, `main` branch auto-deploys)  
**Working directory:** `C:\Users\erics\OneDrive\00 OpenClaw\01 VillaNobby_Website`

---

## What this project is

Villa Nobby is a luxury Japandi-inspired guest suite in Miami, Gold Coast, Queensland. This repo is the marketing website (static HTML/JS/CSS on GitHub Pages). It shows the property, handles direct enquiries, displays live availability, and syncs Airbnb reviews.

---

## Key files

| File | Purpose |
|---|---|
| `index.html` | Main website — hero, amenities, location, booking, reviews |
| `explore.html` | Gold Coast events guide — updated weekly |
| `blocked-dates.json` | Airbnb blocked date ranges — powers the availability calendar on the site |
| `reviews.json` | Airbnb guest reviews — powers the reviews carousel |
| `analytics-dashboard.js` | Generates `analytics-dashboard.html` from Google Analytics API |
| `analytics-report.js` | CLI analytics report |
| `villa-nobby-analytics-a4de0661bd06.json` | Google service account key (GA4 Property ID: `528294646`) |
| `.github/scripts/sync-availability.js` | GitHub Action script — syncs Airbnb iCal to blocked-dates.json |
| `.github/workflows/sync-availability.yml` | Runs every 6 hours via GitHub Actions |
| `.github/workflows/sync-reviews.yml` | GitHub Action for reviews (backup method) |

---

## blocked-dates.json format

```json
{
  "updated": "ISO timestamp",
  "blocked": [
    { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }
  ]
}
```

- `start` = check-in day (first occupied night, inclusive)
- `end` = checkout day (exclusive — first free day)
- **NEVER remove the long owner block (Nov 2026 – Jun 2027)** — deliberately blocked by owner

---

## reviews.json format

```json
{
  "updated": "ISO timestamp",
  "rating": 5,
  "totalReviews": 57,
  "categories": { "cleanliness": 5, "accuracy": 5, "checkIn": 5, "communication": 5, "location": 5, "value": 5 },
  "reviews": [
    { "id": "unique_string", "name": "First name", "date": "Month Year", "rating": 5, "text": "Review text" }
  ]
}
```

**Airbnb listing ID:** `1554938675549327457`  
**Airbnb listing URL:** https://www.airbnb.com.au/rooms/1554938675549327457

---

## Automated routines

### 1. Daily Availability Sync (7:03 AM every day)
- Opens Airbnb listing in Chrome, reads the calendar via JavaScript DOM
- Extracts blocked date ranges using `td[aria-label]` + `data-is-day-blocked` attributes
- CSS classes: `_emqv0i7` / `_1ytdkbl5` = blocked (line-through); `_18qb17hx` / `_1rl50hqv` = checkout-only (check-in boundary)
- Clicks "Load more dates" to get up to 12 months of data
- Writes updated `blocked-dates.json`, validates JSON, commits and pushes

### 2. Weekly Reviews Sync (Monday 9:01 AM)
- Uses Firecrawl to scrape https://www.airbnb.com.au/rooms/1554938675549327457
- Compares scraped reviewer names against existing reviews.json
- Adds new reviews to the top of the array, updates totalReviews and timestamp
- Validates JSON, commits and pushes

### 3. Weekly Explore Page Update (Sunday 8:06 AM)
- Reads current `explore.html`
- Removes expired events (end date before today)
- Searches Must Do Gold Coast (https://www.mustdogoldcoast.com/whats-on) and HOTA (https://hota.com.au/whats-on/) for new events
- Updates Top 4 picks for the coming week, adds new events to Arts/Culture section
- **Always keeps** recurring markets: Sanctuary Markets, Surfers Paradise Beachfront Markets, HOTA Farmers Market, Palm Beach Farmers Market, Carrara Markets, Burleigh Heads Beachside Markets
- Updates header (e.g. "Early June 2026") and last-updated date
- Commits and pushes

### 4. Weekly Analytics Report (Monday 6:08 AM)
- Runs `node analytics-dashboard.js`
- Generates `analytics-dashboard.html` with last-28-day GA4 data
- Reports sessions, devices, traffic sources, top pages

### 5. Weekly MailerLite Form Sync (Sunday 9:05 AM)
- Checks MailerLite embed code is current in index.html
- Updates if the form embed has changed

---

## Git safety rules — CRITICAL

**Always validate JSON files before committing.** The `blocked-dates.json` and `reviews.json` files are parsed by the live website — invalid JSON silently breaks the site.

### Before every commit on a JSON file, run:
```bash
node -e "JSON.parse(require('fs').readFileSync('FILE.json','utf8')); console.log('Valid');"
```

### After every `git pull --rebase`, check for conflict markers:
```bash
node -e "const t=require('fs').readFileSync('FILE.json','utf8'); if(t.includes('<<<<<<<')){console.error('CONFLICT MARKERS FOUND');process.exit(1);} console.log('Clean');"
```

### Auto-fix conflict markers if found:
```bash
node -e "const fs=require('fs'); const t=fs.readFileSync('FILE.json','utf8'); const clean=t.replace(/^<<<<<<[^\n]*\n/gm,'').replace(/^=======[^\n]*\n/gm,'').replace(/^>>>>>>>[^\n]*\n/gm,''); fs.writeFileSync('FILE.json',clean); JSON.parse(clean); console.log('Fixed and valid');"
```

### Push workflow (always):
```bash
git push
# if rejected:
git pull --rebase
# validate JSON (see above)
git push
```

---

## Known issues / history

- **June 2026:** reviews.json had a `<<<<<<< HEAD` conflict marker on line 2 after a concurrent push from the GitHub Action and the local scheduled task. This caused the reviews section to silently break on the live site. Fixed 4 June 2026. All routines now include JSON validation + conflict marker auto-fix steps.
- **GitHub Action vs local sync:** The GitHub Actions workflow (`sync-availability.yml`) runs every 6 hours and also pushes to the repo. If the local Claude routine pushes at a similar time, a rebase conflict can occur. Always `git pull --rebase` before pushing and validate JSON after rebase.

---

## Deployment

Push to `main` → GitHub Pages auto-deploys within ~1 minute. No build step needed — pure static HTML/CSS/JS.

**Custom domain:** villanobby.com (CNAME file in repo root)
