#!/usr/bin/env node
/**
 * Captures README screenshots for Layout Editor (Workbench), Event Analysis, and Timeline.
 * Run with dev server up: npm run dev (in another terminal), then npm run docs:screenshots
 * Or: node scripts/screenshot-docs.mjs (BASE=http://localhost:5173)
 */

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'docs');

const BASE = process.env.BASE || 'http://localhost:5173';

const VIEWS = [
  { path: '/workbench', name: 'workbench', label: 'Layout Editor (Workbench)' },
  { path: '/event-analysis', name: 'analysis', label: 'Event Analysis' },
  { path: '/timeline', name: 'timeline', label: 'Timeline' },
];

const VIEWPORT = { width: 1440, height: 900 };

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  for (const { path: route, name, label } of VIEWS) {
    const url = `${BASE}${route}`;
    console.log(`Capturing ${label} → ${name}.png`);
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      await page.waitForSelector('#root', { timeout: 10000 });
      await delay(600);
      const outPath = path.join(OUT_DIR, `${name}.png`);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`  Wrote ${outPath}`);
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
  }

  await browser.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
