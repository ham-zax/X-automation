import test from 'node:test';
import assert from 'node:assert/strict';
import { xRead } from '../x_reads.js';

const tweet = (id, username, inReplyToStatusId, conversationId = '10000') => ({ id, username, text: `post ${id}`, inReplyToStatusId, conversationId, timeParsed: new Date(Number(id)) });
function fakeScraper({ fail = false } = {}) {
  const queries = [];
  const modes = [];
  return {
    queries,
    modes,
    async getTweet(id) { return id === '10002' ? tweet('10002', 'someone', '10001') : null; },
    async *searchTweets(query, count, mode) {
      queries.push(query);
      modes.push(mode);
      if (fail) throw new Error('HTTP 404: Not Found');
      yield tweet('10003', 'ham_zax', '10002');
      yield tweet('10004', 'ham_zax', '10001');
    },
  };
}

test('x-read replied reports only our direct replies to the exact target', async () => {
  const scraper = fakeScraper();
  const read = await xRead({ kind: 'replied', id: 'https://x.com/someone/status/10002' }, { scraper, handle: '@ham_zax' });
  assert.equal(read.replied, true);
  assert.deepEqual(read.ourReplies.map((post) => post.id), ['10003']);
  assert.deepEqual(scraper.queries, ['from:ham_zax conversation_id:10000']);
  assert.equal(read.target.url, 'https://x.com/someone/status/10002');
});

test('x-read hands a failed read to the browser and rejects a malformed request', async () => {
  const failed = await xRead({ kind: 'mentions' }, { scraper: fakeScraper({ fail: true }) });
  assert.deepEqual(failed, { ok: false, kind: 'mentions', fallback: 'browser', reason: 'HTTP 404: Not Found' });
  assert.equal((await xRead({ kind: 'post', id: '10009' }, { scraper: fakeScraper() })).fallback, 'browser');
  await assert.rejects(xRead({ kind: 'post' }, { scraper: fakeScraper() }), /requires a tweet id/);
  await assert.rejects(xRead({ kind: 'like' }, { scraper: fakeScraper() }), /kind must be one of/);
});

test('x-read search passes the query and mode through and rejects a malformed search', async () => {
  const scraper = fakeScraper();
  const read = await xRead({ kind: 'search', query: '  rust   cli min_faves:50 ', mode: 'latest', limit: 1 }, { scraper });
  assert.equal(read.ok, true);
  assert.deepEqual([read.query, read.mode, read.count], ['rust cli min_faves:50', 'Latest', 1]);
  assert.deepEqual([scraper.queries, scraper.modes], [['rust cli min_faves:50'], ['Latest']]);
  await assert.rejects(xRead({ kind: 'search', query: ' ' }, { scraper }), /requires a query/);
  await assert.rejects(xRead({ kind: 'search', query: 'rust', mode: 'photos' }, { scraper }), /mode of top or latest/);
});
