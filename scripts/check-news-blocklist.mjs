#!/usr/bin/env node
// Checks outlet names against the news blocklist without booting the app.
//
// Why this exists: the weekly blocklist review (Sunday, scheduled task) proposes
// new outlets, and the failure mode when a bad entry lands is silent — a good
// source just stops appearing and nobody notices for weeks. Reading the diff is
// not enough, because the substring matcher makes short entries collide with
// legitimate outlets. Run this before applying a batch.
//
//   node scripts/check-news-blocklist.mjs --self-test
//   node scripts/check-news-blocklist.mjs WORLD "Reuters" "The Dispatch"
//   node scripts/check-news-blocklist.mjs ID < outlets.txt
//
// Exits non-zero if --self-test fails, so it can gate a ship.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SRC = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/lib/sources/googleNewsRss.ts'
);

// The lists are parsed out of the TypeScript source so this stays in lockstep
// with the app instead of drifting into a second copy. Comments are stripped
// first: an apostrophe inside a comment ("// Women's Wear Daily") otherwise
// pairs with a later quote and silently corrupts the parse.
function readList(src, constName, locale) {
  const from = src.indexOf(`const ${constName}`);
  if (from === -1) throw new Error(`${constName} not found in ${SRC}`);
  const region = src
    .slice(from, src.indexOf('};', from))
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');
  const start = region.indexOf(`${locale}: [`);
  if (start === -1) throw new Error(`${constName}.${locale} not found`);
  const body = region.slice(start, region.indexOf('],', start));
  return [...body.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
}

const src = fs.readFileSync(SRC, 'utf8');
const LOCALES = ['WORLD', 'ID'];
const substring = {};
const wordBoundary = {};
for (const loc of LOCALES) {
  substring[loc] = readList(src, 'BLOCKED_OUTLETS', loc);
  wordBoundary[loc] = readList(src, 'WORD_BLOCKED_OUTLETS', loc).map(
    (b) => new RegExp(`(?<![a-z0-9])${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`)
  );
}

// Mirrors isBlockedOutlet() in googleNewsRss.ts. Keep in sync.
export function isBlocked(outlet, locale) {
  const n = (outlet || '').toLowerCase().trim();
  if (!n) return false;
  if (substring[locale].some((b) => n === b || n.includes(b))) return true;
  return wordBoundary[locale].some((re) => re.test(n));
}

// Collisions the word-boundary list exists to prevent, plus outlets that must
// never be blocked. Add a row here whenever a short token is added.
const SELF_TEST = [
  ['ign', 'WORLD', true], ['ign.com', 'WORLD', true], ['ign southeast asia', 'WORLD', true],
  ['foreign policy', 'WORLD', false], ['foreign affairs', 'WORLD', false],
  ['design news', 'WORLD', false],
  ['patch', 'WORLD', true], ['chicago patch', 'WORLD', true],
  ['the dispatch', 'WORLD', false],
  ['komo', 'WORLD', true], ['komo news', 'WORLD', true], ['komodo dragon news', 'WORLD', false],
  ['reuters', 'WORLD', false], ['financial times', 'WORLD', false],
  ["barron's", 'WORLD', false], ['the economist', 'WORLD', false],
  ['bloomberg.com', 'WORLD', false], ['the motley fool', 'WORLD', false],
  ['espn', 'WORLD', true],
  ['antara news', 'ID', false], ['antara news gorontalo', 'ID', true],
  ['databoks katadata', 'ID', false], ['katadataoto', 'ID', true],
  ['harapan rakyat', 'ID', false], ['kompas.com', 'ID', false], ['investor.id', 'ID', false],
];

const args = process.argv.slice(2);

if (args[0] === '--self-test') {
  let failed = 0;
  for (const [name, loc, expected] of SELF_TEST) {
    const got = isBlocked(name, loc);
    if (got !== expected) {
      console.error(`FAIL [${loc}] "${name}" expected ${expected}, got ${got}`);
      failed++;
    }
  }
  const counts = LOCALES.map(
    (l) => `${l}: ${substring[l].length} substring + ${wordBoundary[l].length} word-boundary`
  ).join(', ');
  console.log(failed === 0 ? `PASS ${SELF_TEST.length} cases (${counts})` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

const locale = args[0];
if (!LOCALES.includes(locale)) {
  console.error('Usage: check-news-blocklist.mjs <WORLD|ID> [outlet...]   (or --self-test)');
  process.exit(2);
}

const names = args.length > 1
  ? args.slice(1)
  : fs.readFileSync(0, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);

const candidates = [];
for (const n of names) {
  const hit = isBlocked(n, locale);
  console.log(`${hit ? 'BLOCKED  ' : 'candidate'}  ${n}`);
  if (!hit) candidates.push(n);
}
console.log(`\n${names.length - candidates.length} blocked, ${candidates.length} candidates`);
