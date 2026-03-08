const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ICAL_URL = process.env.AIRBNB_ICAL_URL;

if (!ICAL_URL) {
  console.error('AIRBNB_ICAL_URL environment variable is not set');
  process.exit(1);
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'VillaNobby-Sync/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseICalDate(value) {
  // Handles formats: 20260310, 20260310T150000, 20260310T150000Z
  const clean = value.replace(/[^0-9T]/g, '');
  const year = clean.substring(0, 4);
  const month = clean.substring(4, 6);
  const day = clean.substring(6, 8);
  return `${year}-${month}-${day}`;
}

function parseICal(icalData) {
  const events = [];
  const blocks = icalData.split('BEGIN:VEVENT');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    let start = null;
    let end = null;
    let summary = '';

    const lines = block.split(/\r?\n/);
    for (const line of lines) {
      // Handle DTSTART with or without parameters (e.g., DTSTART;VALUE=DATE:20260310)
      if (line.match(/^DTSTART/)) {
        const value = line.split(':').pop().trim();
        if (value) start = parseICalDate(value);
      }
      if (line.match(/^DTEND/)) {
        const value = line.split(':').pop().trim();
        if (value) end = parseICalDate(value);
      }
      if (line.startsWith('SUMMARY:')) {
        summary = line.substring(8).trim();
      }
    }

    if (start && end) {
      events.push({ start, end, summary });
    }
  }

  return events;
}

function filterFutureDates(events) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  return events
    .filter((e) => e.end >= todayStr)
    .map(({ start, end }) => ({ start, end }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

async function main() {
  console.log('Fetching Airbnb iCal feed...');
  const icalData = await fetch(ICAL_URL);
  console.log(`Received ${icalData.length} bytes of iCal data`);

  const events = parseICal(icalData);
  console.log(`Parsed ${events.length} total events`);

  const blocked = filterFutureDates(events);
  console.log(`${blocked.length} future blocked date ranges`);

  const output = {
    updated: new Date().toISOString(),
    blocked,
  };

  const outputPath = path.join(__dirname, '..', '..', 'blocked-dates.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Written to ${outputPath}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
