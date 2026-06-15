#!/usr/bin/env node
'use strict';

const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const fs = require('fs');
const path = require('path');

const PROPERTY_ID = '528294646';
const KEY_FILE = path.join(__dirname, 'villa-nobby-analytics-a4de0661bd06.json');
const OUTPUT_FILE = path.join(__dirname, 'analytics-dashboard.html');

async function runReport() {
  if (!fs.existsSync(KEY_FILE)) {
    throw new Error(`Service account key not found: ${KEY_FILE}`);
  }

  const client = new BetaAnalyticsDataClient({ keyFilename: KEY_FILE });
  const property = `properties/${PROPERTY_ID}`;

  const [sessions, sources, devices, pages] = await Promise.all([
    client.runReport({
      property,
      dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
    }),

    client.runReport({
      property,
      dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    }),

    client.runReport({
      property,
      dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    }),

    client.runReport({
      property,
      dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10,
    }),
  ]);

  return { sessions, sources, devices, pages };
}

function metricVal(row, idx) {
  return row.metricValues?.[idx]?.value ?? '0';
}
function dimVal(row, idx = 0) {
  return row.dimensionValues?.[idx]?.value ?? '';
}

function fmt(n) {
  return Number(n).toLocaleString();
}
function fmtPct(n) {
  return (Number(n) * 100).toFixed(1) + '%';
}
function fmtDur(seconds) {
  const s = Math.round(Number(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

function deviceIcon(cat) {
  const map = { desktop: '🖥', mobile: '📱', tablet: '📟' };
  return map[cat.toLowerCase()] || '💻';
}

function generateHtml(data, generated) {
  const { sessions, sources, devices, pages } = data;

  const totals = sessions[0].rows?.[0];
  const totalSessions   = totals ? metricVal(totals, 0) : '0';
  const totalUsers      = totals ? metricVal(totals, 1) : '0';
  const totalPageviews  = totals ? metricVal(totals, 2) : '0';
  const bounceRate      = totals ? metricVal(totals, 3) : '0';
  const avgDuration     = totals ? metricVal(totals, 4) : '0';

  const totalSessionsNum = Number(totalSessions);

  const sourceRows = (sources[0].rows || []).map(r => {
    const channel  = dimVal(r);
    const sess     = metricVal(r, 0);
    const users    = metricVal(r, 1);
    const pct      = totalSessionsNum > 0 ? ((Number(sess) / totalSessionsNum) * 100).toFixed(1) : '0.0';
    return `
      <tr>
        <td>${channel}</td>
        <td>${fmt(sess)}</td>
        <td>${fmt(users)}</td>
        <td>
          <div class="bar-wrap"><div class="bar" style="width:${pct}%"></div></div>
          ${pct}%
        </td>
      </tr>`;
  }).join('');

  const deviceRows = (devices[0].rows || []).map(r => {
    const cat  = dimVal(r);
    const sess = metricVal(r, 0);
    const pct  = totalSessionsNum > 0 ? ((Number(sess) / totalSessionsNum) * 100).toFixed(1) : '0.0';
    return `
      <div class="device-card">
        <div class="device-icon">${deviceIcon(cat)}</div>
        <div class="device-name">${cat.charAt(0).toUpperCase() + cat.slice(1)}</div>
        <div class="device-sessions">${fmt(sess)} sessions</div>
        <div class="device-pct">${pct}%</div>
      </div>`;
  }).join('');

  const pageRows = (pages[0].rows || []).map(r => {
    const pg    = dimVal(r);
    const views = metricVal(r, 0);
    const users = metricVal(r, 1);
    return `
      <tr>
        <td><code>${pg}</code></td>
        <td>${fmt(views)}</td>
        <td>${fmt(users)}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Villa Nobby — Analytics Dashboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f1ec; color: #2d2926; padding: 2rem 1rem; }
  .container { max-width: 1100px; margin: 0 auto; }
  header { margin-bottom: 2rem; }
  header h1 { font-size: 1.8rem; font-weight: 700; color: #5a3e2b; }
  header p  { color: #7a6a5a; margin-top: .3rem; font-size: .9rem; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); gap: 1rem; margin-bottom: 2rem; }
  .kpi { background: #fff; border-radius: 12px; padding: 1.25rem 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
  .kpi-label { font-size: .75rem; text-transform: uppercase; letter-spacing: .08em; color: #9a8a78; margin-bottom: .35rem; }
  .kpi-value { font-size: 2rem; font-weight: 700; color: #5a3e2b; }
  .kpi-sub   { font-size: .78rem; color: #aaa; margin-top: .2rem; }
  section { background: #fff; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,.06); margin-bottom: 1.5rem; }
  section h2 { font-size: 1rem; font-weight: 600; color: #5a3e2b; margin-bottom: 1rem; }
  table { width: 100%; border-collapse: collapse; font-size: .88rem; }
  th { text-align: left; padding: .5rem .75rem; border-bottom: 2px solid #f0ebe4; color: #9a8a78; font-weight: 600; font-size: .75rem; text-transform: uppercase; letter-spacing: .06em; }
  td { padding: .55rem .75rem; border-bottom: 1px solid #f7f3ef; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .bar-wrap { display: inline-block; width: 80px; height: 8px; background: #f0ebe4; border-radius: 4px; vertical-align: middle; margin-right: .4rem; }
  .bar { height: 8px; background: #c9a97a; border-radius: 4px; }
  .device-grid { display: flex; gap: 1rem; flex-wrap: wrap; }
  .device-card { flex: 1; min-width: 120px; text-align: center; background: #faf7f3; border-radius: 10px; padding: 1rem; }
  .device-icon { font-size: 2rem; margin-bottom: .4rem; }
  .device-name { font-weight: 600; color: #5a3e2b; font-size: .9rem; }
  .device-sessions { color: #7a6a5a; font-size: .82rem; margin-top: .2rem; }
  .device-pct { font-size: 1.3rem; font-weight: 700; color: #c9a97a; margin-top: .3rem; }
  code { background: #f0ebe4; padding: .15rem .35rem; border-radius: 4px; font-size: .83rem; }
  footer { text-align: center; color: #bbb; font-size: .8rem; margin-top: 2rem; }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>Villa Nobby — Analytics Dashboard</h1>
    <p>Last 28 days &nbsp;·&nbsp; Generated ${generated} &nbsp;·&nbsp; GA4 Property ${PROPERTY_ID}</p>
  </header>

  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Sessions</div>
      <div class="kpi-value">${fmt(totalSessions)}</div>
      <div class="kpi-sub">last 28 days</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Active Users</div>
      <div class="kpi-value">${fmt(totalUsers)}</div>
      <div class="kpi-sub">last 28 days</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Page Views</div>
      <div class="kpi-value">${fmt(totalPageviews)}</div>
      <div class="kpi-sub">last 28 days</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Bounce Rate</div>
      <div class="kpi-value">${fmtPct(bounceRate)}</div>
      <div class="kpi-sub">last 28 days</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Avg. Session</div>
      <div class="kpi-value">${fmtDur(avgDuration)}</div>
      <div class="kpi-sub">duration</div>
    </div>
  </div>

  <section>
    <h2>Traffic Sources</h2>
    <table>
      <thead><tr><th>Channel</th><th>Sessions</th><th>Users</th><th>Share</th></tr></thead>
      <tbody>${sourceRows}</tbody>
    </table>
  </section>

  <section>
    <h2>Device Breakdown</h2>
    <div class="device-grid">${deviceRows}</div>
  </section>

  <section>
    <h2>Top Pages</h2>
    <table>
      <thead><tr><th>Page</th><th>Views</th><th>Users</th></tr></thead>
      <tbody>${pageRows}</tbody>
    </table>
  </section>

  <footer>Villa Nobby Analytics &nbsp;·&nbsp; villanobby.com</footer>
</div>
</body>
</html>`;
}

(async () => {
  try {
    console.log('Fetching GA4 data for last 28 days...');
    const data = await runReport();
    const generated = new Date().toLocaleString('en-AU', {
      timeZone: 'Australia/Brisbane',
      dateStyle: 'long',
      timeStyle: 'short',
    });
    const html = generateHtml(data, generated);
    fs.writeFileSync(OUTPUT_FILE, html, 'utf8');
    console.log(`Dashboard written to ${OUTPUT_FILE}`);

    // Print key metrics to stdout
    const totals = data.sessions[0].rows?.[0];
    if (totals) {
      console.log('\n=== Key Metrics (last 28 days) ===');
      console.log(`Sessions:       ${fmt(metricVal(totals, 0))}`);
      console.log(`Active Users:   ${fmt(metricVal(totals, 1))}`);
      console.log(`Page Views:     ${fmt(metricVal(totals, 2))}`);
      console.log(`Bounce Rate:    ${fmtPct(metricVal(totals, 3))}`);
      console.log(`Avg Session:    ${fmtDur(metricVal(totals, 4))}`);
    }

    const srcRows = data.sources[0].rows || [];
    if (srcRows.length) {
      console.log('\n=== Top Traffic Sources ===');
      srcRows.forEach(r => {
        console.log(`  ${dimVal(r).padEnd(30)} ${metricVal(r, 0)} sessions`);
      });
    }

    const devRows = data.devices[0].rows || [];
    if (devRows.length) {
      const total = devRows.reduce((s, r) => s + Number(metricVal(r, 0)), 0);
      console.log('\n=== Device Breakdown ===');
      devRows.forEach(r => {
        const pct = total > 0 ? ((Number(metricVal(r, 0)) / total) * 100).toFixed(1) : '0.0';
        console.log(`  ${dimVal(r).padEnd(12)} ${metricVal(r, 0)} sessions (${pct}%)`);
      });
    }

    const pgRows = data.pages[0].rows || [];
    if (pgRows.length) {
      console.log('\n=== Top Pages ===');
      pgRows.slice(0, 5).forEach(r => {
        console.log(`  ${dimVal(r).padEnd(30)} ${metricVal(r, 0)} views`);
      });
    }

  } catch (err) {
    console.error('Error generating analytics dashboard:', err.message);
    process.exit(1);
  }
})();
