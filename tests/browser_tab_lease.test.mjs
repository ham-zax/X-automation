import test from 'node:test';
import assert from 'node:assert/strict';
import { assertBrowserResourceBudget, verifyOwnedTabClosed } from '../ops/agent_browser_session.js';

const GiB = 1024 ** 3;

test('legacy baseline can be provisioned under the bounded memory-aware page ceiling', () => {
  assert.doesNotThrow(() => assertBrowserResourceBudget({ pageCount:20, availableBytes:8*GiB }));
  assert.doesNotThrow(() => assertBrowserResourceBudget({ pageCount:23, availableBytes:4*GiB }));
});

test('owned tab deletion waits for the eventual CDP target-list update', async () => {
  const targetId = 'A'.repeat(32);
  const browserWs = 'ws://127.0.0.1:9222/devtools/browser/first';
  let observations = 0;
  let waits = 0;
  const result = await verifyOwnedTabClosed({
    browserWs, targetId,
    readSnapshot: async () => ({ browserWs, pages: new Map(observations++ < 2 ? [[targetId, {}]] : []) }),
    wait: async () => { waits += 1; },
  });
  assert.equal(result, 'closed');
  assert.equal(observations, 3);
  assert.equal(waits, 2);
});

test('owned tab deletion fails closed when Chrome restarts or the target persists', async () => {
  const targetId = 'B'.repeat(32);
  const browserWs = 'ws://127.0.0.1:9222/devtools/browser/first';
  assert.equal(await verifyOwnedTabClosed({ browserWs, targetId,
    readSnapshot: async () => ({ browserWs: browserWs + 'changed', pages: new Map() }),
  }), 'browser_restarted');
  assert.equal(await verifyOwnedTabClosed({ browserWs, targetId, attempts: 2,
    readSnapshot: async () => ({ browserWs, pages: new Map([[targetId, {}]]) }), wait: async () => {},
  }), 'still_present');
});

test('browser allocation fails closed on exhausted page or memory budget', () => {
  assert.throws(() => assertBrowserResourceBudget({ pageCount:24, availableBytes:8*GiB }), /limit 24/);
  assert.throws(() => assertBrowserResourceBudget({ pageCount:20, availableBytes:3*GiB }), /4 GiB/);
  assert.throws(() => assertBrowserResourceBudget({ pageCount:20, availableBytes:NaN }), /4 GiB/);
  assert.throws(() => assertBrowserResourceBudget({ pageCount:1, maxPages:100, availableBytes:8*GiB }), /Invalid/);
});
