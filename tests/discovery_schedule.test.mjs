import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { discoveryBlock, normalizeSchedule } = await import(pathToFileURL(path.join(root, 'discovery_schedule.js')).href);
const { loadGrowthConfig } = await import(pathToFileURL(path.join(root, 'growth_config.js')).href);

const scratch = await mkdtemp(path.join(tmpdir(), 'discovery-schedule-'));
after(async () => {
  await rm(scratch, { recursive: true, force: true });
});

test('five-minute blocks alternate momentum and For You on wall clock', () => {
  const first = discoveryBlock({ now: 1_500_000 });
  assert.equal(first.blockSeconds, 300);
  assert.equal(first.blockIndex, 5);
  assert.equal(first.stream, 'forYou');
  assert.equal(first.nextStream, 'momentum');
  assert.equal(first.startedAt, 1_500_000);
  assert.equal(first.endsAt, 1_800_000);
  assert.equal(discoveryBlock({ now: 1_799_999 }).stream, 'forYou');
  assert.equal(discoveryBlock({ now: 1_800_000 }).stream, 'momentum');
});

test('a later session reads the current block, not the next rotation slot', () => {
  // A pass that overran two blocks: the next pass takes the block that is current now.
  assert.equal(discoveryBlock({ now: 0 }).stream, 'momentum');
  assert.equal(discoveryBlock({ now: 1_200_000 }).stream, 'momentum');
  assert.equal(discoveryBlock({ now: 1_500_000 }).stream, 'forYou');
});

test('order and durations come from schedule configuration', () => {
  const block = discoveryBlock({ now: 120_000, schedule: { blockSeconds: 60, order: 'forYou,momentum' } });
  assert.equal(block.blockSeconds, 60);
  assert.equal(block.blockIndex, 2);
  assert.equal(block.stream, 'forYou');
  assert.equal(block.nextStream, 'momentum');
  assert.equal(block.restWatchMinutes, 60);
});

test('invalid schedule values are rejected', () => {
  assert.throws(() => normalizeSchedule({ blockSeconds: 30 }), /blockSeconds/);
  assert.throws(() => normalizeSchedule({ order: 'momentum' }), /at least two streams/);
  assert.throws(() => normalizeSchedule({ order: 'momentum,trending' }), /unsupported stream/);
  assert.throws(() => normalizeSchedule({ order: 'momentum,momentum' }), /must not repeat/);
  assert.throws(() => normalizeSchedule({ restWatchMinutes: 5 }), /restWatchMinutes/);
});

test('growth config accepts a schedule section and rejects unknown keys', async () => {
  const valid = path.join(scratch, 'valid.yaml');
  await writeFile(valid, 'version: 1\nschedule:\n  blockSeconds: 300\n  order: momentum,forYou\n  restWatchMinutes: 60\n  builderRefreshMinutes: 60\n');
  const config = loadGrowthConfig({ env: { X_GROWTH_CONFIG_FILE: valid } });
  assert.equal(config.schedule.blockSeconds, 300);
  assert.equal(config.schedule.order, 'momentum,forYou');

  const unknown = path.join(scratch, 'unknown.yaml');
  await writeFile(unknown, 'version: 1\nschedule:\n  blockMinutes: 5\n');
  assert.throws(() => loadGrowthConfig({ env: { X_GROWTH_CONFIG_FILE: unknown } }), /unsupported key blockMinutes/);

  const invalid = path.join(scratch, 'invalid.yaml');
  await writeFile(invalid, 'version: 1\nschedule:\n  blockSeconds: 30\n');
  assert.throws(() => loadGrowthConfig({ env: { X_GROWTH_CONFIG_FILE: invalid } }), /blockSeconds/);
});
