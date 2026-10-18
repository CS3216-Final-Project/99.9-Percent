import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectTests, balanceTests } from './browser-shards.mjs';

test('assigns every discovered project and nested test exactly once, including new tests', () => {
  const report = { suites: [{ title: 'example.spec.ts', specs: [
    { file: 'example.spec.ts', title: 'desktop', tests: [{ projectName: 'chromium', results: [] }] },
  ], suites: [{ title: 'nested', specs: [
    { file: 'example.spec.ts', title: 'touch', tests: [{ projectName: 'mobile-chromium', results: [{ duration: 42 }] }] },
  ] }] }] };
  const tests = collectTests(report);
  assert.equal(tests[1].key, '[mobile-chromium] › example.spec.ts › nested › touch');
  const result = balanceTests(tests, { [tests[0].key]: 60_000 }, 2);
  assert.deepEqual(result.flatMap(shard => shard.tests).sort(), tests.map(test => test.key).sort());
  assert.equal(result[1].duration, 30_000);
  assert.deepEqual(balanceTests([...tests].reverse(), { [tests[0].key]: 60_000 }, 2), result);
});

test('separates the slowest tests and refuses unsafe shard inputs', () => {
  const tests = ['a', 'b', 'c', 'd'].map(key => ({ key }));
  const shards = balanceTests(tests, { a: 100, b: 90, c: 20, d: 10 }, 2);
  assert.deepEqual(shards.map(shard => shard.duration), [110, 110]);
  assert.throws(() => balanceTests(tests, {}, 0), /positive integer/);
  assert.throws(() => balanceTests([{ key: 'same' }, { key: 'same' }], {}, 2), /Duplicate/);
});
