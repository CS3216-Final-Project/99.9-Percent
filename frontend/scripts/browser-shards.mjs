import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

export function collectTests(report) {
  const tests = [];
  function visit(suite, parents = []) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests) {
      const file = spec.file.replaceAll('\\', '/');
      const title = [test.projectName, file, ...parents, spec.title];
      tests.push({ key: '[' + title[0] + '] › ' + title.slice(1).join(' › '), duration: Math.max(0, ...(test.results ?? []).map(result => result.duration)) });
    }
    for (const child of suite.suites ?? []) visit(child, [...parents, child.title]);
  }
  // Top-level suites name files; the list format already supplies that file separately.
  for (const suite of report.suites) visit(suite);
  return tests;
}

export function balanceTests(tests, durations, count) {
  if (!Number.isInteger(count) || count < 1) throw Error('Shard count must be a positive integer');
  if (new Set(tests.map(test => test.key)).size !== tests.length) throw Error('Duplicate test names cannot be safely sharded');
  const shards = Array.from({ length: count }, () => ({ tests: [], duration: 0 }));
  const cost = test => Number.isFinite(durations[test.key]) && durations[test.key] > 0 ? durations[test.key] : 30_000;
  const sorted = [...tests].sort((a, b) => cost(b) - cost(a) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  for (const test of sorted) {
    const shard = shards.reduce((best, next) => next.duration < best.duration ? next : best);
    shard.tests.push(test.key);
    shard.duration += cost(test);
  }
  return shards;
}

function main() {
  const [selection, ...extra] = process.argv.slice(2);
  if (selection === '--record') {
    if (!extra.length) throw Error('Provide browser-timings.json reports from a complete CI run');
    const durations = {};
    for (const path of extra) for (const test of collectTests(JSON.parse(readFileSync(path, 'utf8')))) {
      if (test.duration > 0) durations[test.key] = Math.max(durations[test.key] ?? 0, test.duration);
    }
    if (!Object.keys(durations).length) throw Error('Reports contain no measured tests');
    writeFileSync(join(root, 'e2e/browser-durations.json'), JSON.stringify(Object.fromEntries(Object.entries(durations).sort()), null, 2) + '\n');
    console.log('Recorded ' + Object.keys(durations).length + ' test durations');
    return;
  }
  const match = /^(\d+)\/(\d+)$/.exec(selection ?? '');
  if (!match) throw Error('Usage: node scripts/browser-shards.mjs CURRENT/TOTAL [--list]');
  const [, currentText, totalText] = match;
  const current = Number(currentText), total = Number(totalText);
  if (current < 1 || current > total) throw Error('Shard index must be between 1 and total');
  if (extra.some(arg => arg !== '--list')) throw Error('Only --list is supported');
  const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
  const listing = spawnSync(process.execPath, [cli, 'test', '--list', '--reporter=json'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (listing.status !== 0) throw Error(listing.stderr || listing.stdout || String(listing.error));
  const tests = collectTests(JSON.parse(listing.stdout));
  if (!tests.length) throw Error('No browser tests discovered');
  const durations = JSON.parse(readFileSync(join(root, 'e2e/browser-durations.json'), 'utf8'));
  const shards = balanceTests(tests, durations, total);
  const plan = join(root, '.cache/browser-shard-' + current + '.txt');
  mkdirSync(dirname(plan), { recursive: true });
  writeFileSync(plan, shards[current - 1].tests.join('\n') + '\n');
  for (const [index, shard] of shards.entries()) console.log('Shard ' + (index + 1) + ': ' + shard.tests.length + ' tests; estimated ' + Math.round(shard.duration / 1000) + 's');
  console.log('Discovered ' + tests.length + ' tests; each assigned exactly once.');
  if (extra.includes('--list')) return;
  if (!shards[current - 1].tests.length) throw Error('Empty shard; reduce the shard count');
  const run = spawnSync(process.execPath, [cli, 'test', '--test-list', plan], { cwd: root, stdio: 'inherit' });
  process.exitCode = run.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
