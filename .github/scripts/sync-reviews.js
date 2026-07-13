const https = require('https');
const fs = require('fs');
const path = require('path');

const LISTING_ID = '1554938675549327457';
const REVIEWS_URL = `https://www.airbnb.com.au/rooms/${LISTING_ID}/reviews`;

function fetch(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    };
    https.get(url, options, (res) => {
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

function parseReviewsFromHTML(html) {
  // Airbnb embeds deferred state data in a script tag
  // Try to extract review data from the HTML
  const reviews = [];

  // Look for data-review-id patterns in the HTML
  const reviewIdPattern = /data-review-id="(\d+)"/g;
  const ids = [];
  let match;
  while ((match = reviewIdPattern.exec(html)) !== null) {
    ids.push(match[1]);
  }

  // Try to find the deferred state JSON
  const deferredMatch = html.match(/id="data-deferred-state-0"[^>]*>([\s\S]*?)<\/script>/);
  if (deferredMatch) {
    try {
      const data = JSON.parse(deferredMatch[1]);
      console.log('Found deferred state data');
      // Try to extract reviews from the deferred state
      const jsonStr = JSON.stringify(data);
      // Look for review-like structures
      const reviewPattern = /"id":"(\d+)"[^}]*"comments":"([^"]+)"[^}]*"reviewer":\{[^}]*"firstName":"([^"]+)"/g;
      let rMatch;
      while ((rMatch = reviewPattern.exec(jsonStr)) !== null) {
        reviews.push({
          id: rMatch[1],
          name: rMatch[3],
          text: rMatch[2].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
          rating: 5,
        });
      }
    } catch (e) {
      console.log('Failed to parse deferred state:', e.message);
    }
  }

  return { ids, reviews };
}

async function main() {
  const outputPath = path.join(__dirname, '..', '..', 'reviews.json');

  // Read existing reviews
  let existing = { updated: '', rating: 5.0, totalReviews: 0, categories: {}, reviews: [] };
  try {
    existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    console.log(`Existing reviews file has ${existing.reviews.length} reviews`);
  } catch (e) {
    console.log('No existing reviews file found');
  }

  let changed = false;
  try {
    console.log('Fetching Airbnb reviews page...');
    const html = await fetch(REVIEWS_URL);
    console.log(`Received ${html.length} bytes of HTML`);

    const { ids, reviews } = parseReviewsFromHTML(html);
    console.log(`Found ${ids.length} review IDs and ${reviews.length} parsed reviews in HTML`);

    if (reviews.length > 0) {
      // Merge new reviews with existing ones
      const existingIds = new Set(existing.reviews.map((r) => r.id));
      let newCount = 0;
      for (const review of reviews) {
        if (!existingIds.has(review.id)) {
          existing.reviews.unshift(review);
          newCount++;
        }
      }
      if (newCount > 0) {
        existing.updated = new Date().toISOString();
        existing.totalReviews = Math.max(existing.reviews.length, existing.totalReviews);
        changed = true;
      }
      console.log(`Added ${newCount} new reviews, total: ${existing.totalReviews}`);
    } else if (ids.length > existing.totalReviews) {
      // We found more review IDs than we have stored - update the count
      console.log(`Review count increased: found ${ids.length} IDs vs ${existing.totalReviews} stored`);
      existing.totalReviews = ids.length;
      existing.updated = new Date().toISOString();
      changed = true;
    } else {
      console.log('No new reviews found in HTML (Airbnb may require browser rendering).');
    }
  } catch (err) {
    console.log(`Warning: Could not fetch reviews page: ${err.message}`);
    console.log('Keeping existing reviews.json unchanged.');
  }

  // Only write when something real changed - a timestamp-only bump makes the
  // file look freshly synced while the content is stale.
  if (changed) {
    fs.writeFileSync(outputPath, JSON.stringify(existing, null, 2));
    console.log(`Written to ${outputPath}`);
  } else {
    console.log('No review changes - leaving reviews.json untouched.');
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
