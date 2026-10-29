const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const review = path.resolve(__dirname, '../test-results');
fs.mkdirSync(review, { recursive: true });
module.exports = {
  chromium,
  review,
  url: process.env.LOCKTODO_URL || 'http://localhost:8793',
  launchOptions: {
    headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHANNEL }
      : process.platform === 'win32' ? { channel: 'msedge' } : {})
  }
};
