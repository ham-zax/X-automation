import test from 'node:test';
import assert from 'node:assert/strict';
import { assertBrowserResourceBudget } from '../ops/agent_browser_session.js';

const GiB = 1024 ** 3;

test('legacy baseline can be provisioned under the bounded memory-aware page ceiling', () => {
  assert.doesNotThrow(() => assertBrowserResourceBudget({ pageCount:20, availableBytes:8*GiB }));
  assert.doesNotThrow(() => assertBrowserResourceBudget({ pageCount:23, availableBytes:4*GiB }));
});

test('browser allocation fails closed on exhausted page or memory budget', () => {
  assert.throws(() => assertBrowserResourceBudget({ pageCount:24, availableBytes:8*GiB }), /limit 24/);
  assert.throws(() => assertBrowserResourceBudget({ pageCount:20, availableBytes:3*GiB }), /4 GiB/);
  assert.throws(() => assertBrowserResourceBudget({ pageCount:20, availableBytes:NaN }), /4 GiB/);
  assert.throws(() => assertBrowserResourceBudget({ pageCount:1, maxPages:100, availableBytes:8*GiB }), /Invalid/);
});
