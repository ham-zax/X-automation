import test from 'node:test';
import assert from 'node:assert/strict';
import { xRead } from '../x_reads.js';

const tweet = (id, username, inReplyToStatusId, conversationId = '10000', overrides = {}) => ({
  id, username, text: `post ${id}`, inReplyToStatusId, conversationId,
  timeParsed: new Date(Number(id)), ...overrides,
});
function fakeScraper({
  fail = false,
  target = (id) => (id === '10002' ? tweet('10002', 'someone', '10001') : null),
  stream = null,
} = {}) {
  const queries = [];
  const modes = [];
  const counts = [];
  const calls = [];
  return {
    queries,
    modes,
    counts,
    calls,
    async getTweet(id) {
      calls.push(`getTweet:${id}`);
      return target(id);
    },
    async *searchTweets(query, count, mode) {
      calls.push(`searchTweets:${query}`);
      queries.push(query);
      modes.push(mode);
      counts.push(count);
      if (fail) throw new Error('HTTP 404: Not Found');
      if (stream) {
        for (const item of stream) yield item;
        return;
      }
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

test('x-read replies defaults to Top and keeps upstream order inside the candidate bound', async () => {
  const target = tweet('21000', 'root_author', null, '21000');
  const children = Array.from({ length: 45 }, (_, index) => {
    const id = String(21001 + index);
    return id === '21002'
      ? tweet(id, 'peer2', '21000', '21000', { likes: 500, retweets: 80, views: 9000 })
      : tweet(id, `peer${index}`, '21000', '21000');
  });
  const stream = [
    tweet('21005', 'peer5', '21000', '21000', { likes: 1 }),
    target,
    tweet('21005', 'peer5', '21000', '21000', { likes: 1 }),
    tweet('21099', 'elsewhere', '99999', '21000'),
    ...children.filter((item) => item.id !== '21005'),
  ];
  const scraper = fakeScraper({ target: (id) => (id === '21000' ? target : null), stream });
  const startedAt = Date.now();
  const read = await xRead({ kind: 'replies', id: '21000' }, { scraper });
  const finishedAt = Date.now();

  assert.equal(read.ok, true);
  assert.equal(read.kind, 'replies');
  assert.equal(read.mode, 'Top');
  assert.equal(read.target.id, '21000');
  assert.equal(read.target.url, 'https://x.com/root_author/status/21000');
  assert.equal(read.count, 20);
  assert.equal(read.posts.length, 20);
  assert.equal(read.posts[0].id, '21005');
  assert.equal(read.posts[0].author, 'peer5');
  assert.equal(read.posts[0].url, 'https://x.com/peer5/status/21005');
  assert.equal(read.posts[0].likes, 1);
  assert.equal(read.posts[0].replies, null);
  assert.equal(read.posts.filter((post) => post.id === '21005').length, 1);
  assert.ok(!read.posts.some((post) => post.id === '21000' || post.id === '21099'));
  assert.ok(read.posts.findIndex((post) => post.id === '21005') < read.posts.findIndex((post) => post.id === '21002'));
  assert.ok(read.observedAt >= startedAt && read.observedAt <= finishedAt);
  assert.deepEqual(scraper.queries, ['conversation_id:21000']);
  assert.deepEqual(scraper.modes, ['Top']);
  assert.deepEqual(scraper.counts, [40]);
  assert.deepEqual(scraper.calls, ['getTweet:21000', 'searchTweets:conversation_id:21000']);

  const dense = Array.from({ length: 45 }, (_, index) => tweet(String(21101 + index), `peer${index}`, '21000', '21000'));
  const denseScraper = fakeScraper({ target: (id) => (id === '21000' ? target : null), stream: dense });
  const maxRead = await xRead({ kind: 'replies', id: '21000', limit: 99 }, { scraper: denseScraper });
  assert.equal(maxRead.count, 40);
  assert.equal(maxRead.posts.length, 40);
  assert.deepEqual(denseScraper.counts, [40]);
});

test('x-read replies uses Latest, searches the conversation root and keeps only the exact target children', async () => {
  const target = tweet('20101', 'reply_author', '20100', '20100');
  const stream = [
    tweet('20102', 'peer_a', '20101', '20100'),
    tweet('20103', 'peer_b', '20100', '20100'),
    tweet('20102', 'peer_a', '20101', '20100'),
    tweet('20104', 'peer_c', '20101', '20100'),
    tweet('20105', 'peer_d', '20101', '20100'),
  ];
  const scraper = fakeScraper({ target: (id) => (id === '20101' ? target : null), stream });
  const read = await xRead({ kind: 'replies', id: '20101', mode: 'LATEST', limit: 2 }, { scraper });
  assert.deepEqual(read.posts.map((post) => post.id), ['20102', '20104']);
  assert.equal(read.mode, 'Latest');
  assert.equal(read.count, 2);
  assert.equal(read.target.id, '20101');
  assert.deepEqual(scraper.queries, ['conversation_id:20100']);
  assert.deepEqual(scraper.modes, ['Latest']);
});

test('x-read replies rejects an invalid mode before any scraper access', async () => {
  const scraper = fakeScraper();
  await assert.rejects(xRead({ kind: 'replies', id: '21000', mode: 'photos' }, { scraper }), /mode of top or latest/);
  assert.deepEqual(scraper.calls, []);
  await assert.rejects(xRead({ kind: 'replies' }, { scraper }), /requires a tweet id/);
  assert.deepEqual(scraper.calls, []);
});

test('x-read replies hands a failed read to the browser', async () => {
  const scraper = fakeScraper({ target: (id) => tweet(id, 'root_author', null, id), stream: [], fail: true });
  const read = await xRead({ kind: 'replies', id: '22000' }, { scraper });
  assert.deepEqual(read, { ok: false, kind: 'replies', fallback: 'browser', reason: 'HTTP 404: Not Found' });
});

test('x-read replies labels an empty sample as bounded, not proof of absence', async () => {
  const target = tweet('20200', 'root_author', null, '20200');
  const scraper = fakeScraper({ target: () => target, stream: [tweet('20201', 'peer', '20299', '20200')] });
  const read = await xRead({ kind: 'replies', id: '20200' }, { scraper });
  assert.equal(read.count, 0);
  assert.deepEqual(read.posts, []);
  assert.match(read.note, /bounded search sample/i);
  assert.match(read.note, /not proof of absence/i);
});

test('x-read thread keeps chronological order', async () => {
  const root = tweet('30009', 'root_author', null, '30000');
  const scraper = fakeScraper({
    target: () => root,
    stream: [
      tweet('30003', 'peer_c', '30009', '30000'),
      tweet('30001', 'peer_a', '30009', '30000'),
      tweet('30002', 'peer_b', '30009', '30000'),
    ],
  });
  const read = await xRead({ kind: 'thread', id: '30009', limit: 40 }, { scraper });
  assert.deepEqual(read.posts.map((post) => post.id), ['30001', '30002', '30003', '30009']);
  assert.deepEqual(scraper.modes, ['Latest']);
  assert.deepEqual(scraper.counts, [40]);
});
