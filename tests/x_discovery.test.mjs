import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const originalCwd = process.cwd()
let tmpDir
let store
let sourceRefresh

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'x-discovery-test-'))
  process.chdir(tmpDir)
  store = await import(pathToFileURL(path.join(REPO, 'store.js')).href)
  sourceRefresh = await import(pathToFileURL(path.join(REPO, 'source_refresh.js')).href)
})

after(async () => {
  process.chdir(originalCwd)
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true })
})

function xCandidate(id, username = 'example') {
  return {
    key: `https://x.com/${username}/status/${id}`,
    source: 'x',
    title: `@${username}`,
    text: `candidate ${id}`,
    url: `https://x.com/${username}/status/${id}`,
    timestamp: 1_788_921_000_000,
    score: 10,
    niche: { score: 10, tags: ['ai'], matches: ['ai'] },
    metrics: { views: 100, likes: 10, retweets: 2, replies: 1 },
  }
}

test('snapshot taxonomy accepts browser and creator storage kinds while pull refresh remains bounded', () => {
  assert.deepEqual(store.SOURCE_SNAPSHOT_KINDS, [
    'x_latest',
    'x_momentum',
    'github_trending',
    'hn_top',
    'x_for_you',
    'x_creator_latest',
  ])
  assert.deepEqual(sourceRefresh.PULL_SOURCE_SNAPSHOT_KINDS, [
    'x_latest',
    'x_momentum',
    'github_trending',
    'hn_top',
  ])

  const now = 1_788_921_000_000
  for (const kind of store.SOURCE_SNAPSHOT_KINDS) {
    assert.doesNotThrow(() => store.saveDiscoverSnapshot(kind, [], now))
  }
})

function tweetIdForTimestamp(timestamp, sequence = 0n) {
  const epoch = 1288834974657n
  return (((BigInt(timestamp) - epoch) << 22n) + sequence).toString()
}

async function loadXDiscovery() {
  return import(pathToFileURL(path.join(REPO, 'x_discovery.js')).href)
}

async function loadEngagement() {
  return import(pathToFileURL(path.join(REPO, 'engagement.js')).href)
}

function runAgent(command, payload = {}) {
  const child = spawnSync(process.execPath, [path.join(REPO, 'agent_bridge.js'), command], {
    cwd: tmpDir,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env },
  })
  assert.equal(child.status, 0, child.stderr || child.stdout)
  return JSON.parse(child.stdout)
}

test('candidate source kinds reflect only current snapshot generations', () => {
  const candidate = xCandidate('2090000000000000000')
  store.upsertCandidates([candidate])

  const firstObservedAt = 1_788_921_000_000
  store.saveDiscoverSnapshot('x_latest', [candidate], firstObservedAt)
  store.recordSourceObservations([{
    candidateKey: candidate.key,
    snapshotKind: 'x_latest',
    observedAt: firstObservedAt,
    rank: null,
    metrics: { views: 100 },
  }])
  store.saveDiscoverSnapshot('x_for_you', [candidate], firstObservedAt)
  store.recordSourceObservations([{
    candidateKey: candidate.key,
    snapshotKind: 'x_for_you',
    observedAt: firstObservedAt,
    rank: 3,
    metrics: { views: 100, likes: 10 },
  }])

  assert.deepEqual(store.getCandidateSourceKinds(candidate.key), ['x_latest', 'x_for_you'])

  store.saveDiscoverSnapshot('x_for_you', [], firstObservedAt + 60_000)
  assert.deepEqual(store.getCandidateSourceKinds(candidate.key), ['x_latest'])
})

test('authenticated For You ingest validates, normalizes, deduplicates, and records only observed metrics', async () => {
  const discovery = await loadXDiscovery()
  const observedAt = 1_788_921_500_000
  const firstTimestamp = observedAt - 120_000
  const secondTimestamp = observedAt - 60_000
  const firstId = tweetIdForTimestamp(firstTimestamp, 7n)
  const secondId = tweetIdForTimestamp(secondTimestamp, 9n)
  const promotedId = tweetIdForTimestamp(observedAt - 30_000, 11n)
  const mismatchedId = tweetIdForTimestamp(observedAt - 20_000, 13n)
  const wrongUrlId = tweetIdForTimestamp(observedAt - 10_000, 15n)
  const malformedMetricId = tweetIdForTimestamp(observedAt - 5_000, 17n)

  assert.equal(discovery.deriveXTimestampFromTweetId(firstId), firstTimestamp)
  assert.equal(discovery.normalizeXUsername('  @Example_User  '), 'example_user')

  const payload = {
    kind: 'x_for_you',
    observedAt,
    accountHandle: 'ham_zax',
    posts: [
      {
        tweetId: firstId,
        url: `https://x.com/Example_User/status/${firstId}`,
        username: '@Example_User',
        text: 'portable context matters',
        timestamp: firstTimestamp + 10 * 60_000,
        rank: 2,
        metrics: { views: 120, likes: 3 },
      },
      {
        tweetId: firstId,
        url: `https://twitter.com/example_user/status/${firstId}?s=20`,
        username: 'example_user',
        text: 'portable context matters',
        rank: 1,
        metrics: { views: 120, likes: 3, reposts: 1, replies: 2 },
      },
      {
        tweetId: secondId,
        url: `https://twitter.com/OtherBuilder/status/${secondId}`,
        username: '@OtherBuilder',
        text: 'a second organic post',
        rank: 4,
      },
      {
        tweetId: promotedId,
        url: `https://x.com/ad_account/status/${promotedId}`,
        username: 'ad_account',
        text: 'sponsored',
        rank: 3,
        promoted: true,
      },
      {
        tweetId: mismatchedId,
        url: `https://x.com/bad/status/${wrongUrlId}`,
        username: 'bad',
        text: 'bad id mismatch',
        rank: 5,
      },
      {
        tweetId: malformedMetricId,
        url: `https://x.com/badmetric/status/${malformedMetricId}`,
        username: 'badmetric',
        text: 'bad metric',
        rank: 6,
        metrics: { views: '12' },
      },
    ],
  }

  const result = discovery.ingestXForYouObservation(payload)
  assert.equal(result.kind, 'x_for_you')
  assert.equal(result.observedAt, observedAt)
  assert.equal(result.acceptedCount, 2)
  assert.equal(result.rejectedCount, 2)
  assert.equal(result.skippedCount, 2)
  assert.equal(result.snapshotReplaced, true)
  assert.equal(result.preservedLastGood, false)
  assert.equal(result.candidates.length, 2)

  const first = result.candidates.find((candidate) => candidate.url.includes(firstId))
  const second = result.candidates.find((candidate) => candidate.url.includes(secondId))
  assert.equal(first.url, `https://x.com/example_user/status/${firstId}`)
  assert.equal(first.title, '@example_user')
  assert.equal(first.timestamp, firstTimestamp)
  assert.deepEqual(first.metrics, { views: 120, likes: 3, retweets: 1, replies: 2 })
  assert.equal(second.url, `https://x.com/otherbuilder/status/${secondId}`)
  assert.deepEqual(second.metrics, {})
  assert.ok(result.diagnostics.some((item) => item.code === 'TIMESTAMP_MISMATCH' && item.tweetId === firstId))
  assert.ok(result.diagnostics.some((item) => item.code === 'DUPLICATE_TWEET' && item.tweetId === firstId))

  const snapshot = store.getDiscoverSnapshot('x_for_you')
  assert.equal(snapshot.fetchedAt, observedAt)
  assert.deepEqual(snapshot.candidates.map((candidate) => candidate.key).sort(), result.candidates.map((candidate) => candidate.key).sort())

  const observation = store.getSourceMomentum(first.key, 'x_for_you')
  assert.equal(observation.current.rank, 1)
  assert.deepEqual(observation.current.metrics, { views: 120, likes: 3, reposts: 1, replies: 2 })
  assert.equal(observation.previous, null)

  const repeated = discovery.ingestXForYouObservation(payload)
  assert.equal(repeated.acceptedCount, 2)
  assert.equal(store.getSourceMomentum(first.key, 'x_for_you').previous, null)
})

test('invalid or zero-valid For You batches preserve last-known-good snapshot and record source error', async () => {
  const discovery = await loadXDiscovery()
  const priorObservedAt = 1_788_922_000_000
  const priorId = tweetIdForTimestamp(priorObservedAt - 60_000, 21n)
  const prior = xCandidate(priorId, 'keeper')
  store.upsertCandidates([prior])
  store.saveDiscoverSnapshot('x_for_you', [prior], priorObservedAt)
  store.recordSourceObservations([{
    candidateKey: prior.key,
    snapshotKind: 'x_for_you',
    observedAt: priorObservedAt,
    rank: 1,
    metrics: { views: 50 },
  }])

  const zeroValidAt = priorObservedAt + 60_000
  const promotedId = tweetIdForTimestamp(zeroValidAt - 1_000, 23n)
  const zeroValid = discovery.ingestXForYouObservation({
    kind: 'x_for_you',
    observedAt: zeroValidAt,
    accountHandle: 'ham_zax',
    posts: [{
      tweetId: promotedId,
      url: `https://x.com/promoted/status/${promotedId}`,
      username: 'promoted',
      text: 'ad',
      rank: 1,
      promoted: true,
    }],
  })
  assert.equal(zeroValid.snapshotReplaced, false)
  assert.equal(zeroValid.preservedLastGood, true)
  assert.equal(zeroValid.acceptedCount, 0)
  assert.deepEqual(store.getDiscoverSnapshot('x_for_you').candidates.map((candidate) => candidate.key), [prior.key])
  assert.equal(store.getDiscoverSnapshot('x_for_you').lastRefreshAttemptAt, zeroValidAt)
  assert.match(store.getDiscoverSnapshot('x_for_you').error, /zero valid organic posts/i)

  const invalidAt = zeroValidAt + 60_000
  const invalid = discovery.ingestXForYouObservation({ kind: 'x_latest', observedAt: invalidAt, posts: [] })
  assert.equal(invalid.snapshotReplaced, false)
  assert.equal(invalid.preservedLastGood, true)
  assert.deepEqual(store.getDiscoverSnapshot('x_for_you').candidates.map((candidate) => candidate.key), [prior.key])
  assert.equal(store.getDiscoverSnapshot('x_for_you').lastRefreshAttemptAt, invalidAt)
  assert.match(store.getDiscoverSnapshot('x_for_you').error, /kind must be x_for_you/i)
})

test('signal watchlist updates are normalized, versioned, and atomic', async () => {
  const discovery = await loadXDiscovery()
  assert.deepEqual(discovery.getXSignalWatchlist(), { revision: 0, updatedAt: null, targets: [] })

  const first = discovery.updateXSignalWatchlist({
    targets: [
      { username: ' @RauchG ', enabled: true, note: 'high-signal infra' },
      { username: '@DormantBuilder', enabled: false, note: 'keep configured' },
    ],
  })
  assert.equal(first.revision, 1)
  assert.ok(Number.isFinite(first.updatedAt) && first.updatedAt > 0)
  assert.deepEqual(first.targets, [
    { username: 'rauchg', enabled: true, note: 'high-signal infra' },
    { username: 'dormantbuilder', enabled: false, note: 'keep configured' },
  ])

  const beforeInvalid = discovery.getXSignalWatchlist()
  assert.throws(() => discovery.updateXSignalWatchlist({
    targets: [
      { username: '@RauchG', enabled: true, note: '' },
      { username: 'rauchg', enabled: true, note: 'duplicate after normalization' },
    ],
  }), /duplicate/i)
  assert.deepEqual(discovery.getXSignalWatchlist(), beforeInvalid)

  assert.throws(() => discovery.updateXSignalWatchlist({
    targets: [{ username: 'bad user!', enabled: true, note: '' }],
  }), /username/i)
  assert.deepEqual(discovery.getXSignalWatchlist(), beforeInvalid)

  const second = discovery.updateXSignalWatchlist({
    targets: [{ username: '@RauchG', enabled: true, note: 'note changed only' }],
  })
  assert.equal(second.revision, 2)
  assert.deepEqual(second.targets, [{ username: 'rauchg', enabled: true, note: 'note changed only' }])
})

test('creator target merge deduplicates relationship and enabled signal-watch origins', async () => {
  const discovery = await loadXDiscovery()
  assert.deepEqual(discovery.mergeCreatorTargets(
    [{ username: '@Alpha' }, { username: 'beta' }],
    [
      { username: 'ALPHA', enabled: true },
      { username: '@Gamma', enabled: true },
      { username: '@Disabled', enabled: false },
    ],
  ), [
    { username: 'alpha', origins: ['relationship', 'signal_watch'] },
    { username: 'beta', origins: ['relationship'] },
    { username: 'gamma', origins: ['signal_watch'] },
  ])
})

test('creator latest refresh fetches once and serves relationship plus watch-only discovery', async () => {
  const discovery = await loadXDiscovery()
  discovery.updateXSignalWatchlist({ targets: [
    { username: '@Alpha', enabled: true, note: 'overlap' },
    { username: '@WatchOnly', enabled: true, note: 'watch only' },
    { username: '@Disabled', enabled: false, note: '' },
  ] })
  const observedAt = 1_788_924_000_000
  const alphaId = tweetIdForTimestamp(observedAt - 60_000, 41n)
  const watchId = tweetIdForTimestamp(observedAt - 30_000, 43n)
  let calls = 0
  let receivedUsernames = null
  const result = await discovery.refreshCreatorLatestDiscovery({
    relationshipProfiles: [{ username: 'alpha', targetScore: 90 }],
    postsPerTarget: 4,
    since: observedAt - 3_600_000,
    observedAt,
    classifyNiche: (text) => ({ score: 30, tags: ['ai_infra'], matches: [text.includes('watch') ? 'watch' : 'alpha'] }),
    fetchRecentPosts: async (usernames) => {
      calls++
      receivedUsernames = usernames
      return {
        posts: [
          { id: alphaId, targetUsername: 'alpha', authorUsername: 'alpha', text: 'alpha infra release', timestamp: observedAt - 60_000, url: `https://x.com/alpha/status/${alphaId}`, views: 1000, likes: 50, reposts: 8, replies: 4 },
          { id: watchId, targetUsername: 'watchonly', authorUsername: 'watchonly', text: 'watch only compiler update', timestamp: observedAt - 30_000, url: `https://x.com/watchonly/status/${watchId}`, views: 800, likes: 40, reposts: 6, replies: 3 },
        ],
        errors: [],
        bounds: { maxTargets: 2 },
      }
    },
  })
  assert.equal(calls, 1)
  assert.deepEqual(receivedUsernames, ['alpha', 'watchonly'])
  assert.equal(result.snapshotReplaced, true)
  assert.equal(result.preservedLastGood, false)
  assert.equal(result.candidates.length, 2)
  assert.deepEqual(result.entries.find((entry) => entry.targetUsername === 'alpha').origins, ['relationship', 'signal_watch'])
  const watchEntry = result.entries.find((entry) => entry.targetUsername === 'watchonly')
  assert.deepEqual(watchEntry.origins, ['signal_watch'])
  assert.equal('relationship' in watchEntry.candidate, false)
  assert.deepEqual(store.getDiscoverSnapshot('x_creator_latest').candidates.map((candidate) => candidate.key).sort(), result.candidates.map((candidate) => candidate.key).sort())
  assert.deepEqual(store.getCandidateSourceKinds(watchEntry.candidate.key), ['x_creator_latest'])
})

test('creator latest empty, total-failure, and partial-failure snapshot semantics are distinct', async () => {
  const discovery = await loadXDiscovery()
  discovery.updateXSignalWatchlist({ targets: [{ username: '@Alpha', enabled: true, note: '' }, { username: '@Beta', enabled: true, note: '' }] })

  const staleId = tweetIdForTimestamp(1_788_924_100_000, 47n)
  const stale = xCandidate(staleId, 'stalecreator')
  store.upsertCandidates([stale])
  store.saveDiscoverSnapshot('x_creator_latest', [stale], 1_788_924_200_000)
  store.recordSourceObservations([{ candidateKey: stale.key, snapshotKind: 'x_creator_latest', observedAt: 1_788_924_200_000, rank: null, metrics: { views: 10 } }])

  let emptyCalls = 0
  const emptyAt = 1_788_924_300_000
  const empty = await discovery.refreshCreatorLatestDiscovery({
    relationshipProfiles: [],
    observedAt: emptyAt,
    fetchRecentPosts: async () => {
      emptyCalls++
      return { posts: [], errors: [], bounds: { maxTargets: 2 } }
    },
    classifyNiche: () => ({ score: 0, tags: [], matches: [] }),
  })
  assert.equal(emptyCalls, 1)
  assert.equal(empty.snapshotReplaced, true)
  assert.equal(empty.preservedLastGood, false)
  assert.deepEqual(store.getDiscoverSnapshot('x_creator_latest').candidates, [])

  store.upsertCandidates([stale])
  store.saveDiscoverSnapshot('x_creator_latest', [stale], emptyAt + 10_000)
  store.recordSourceObservations([{ candidateKey: stale.key, snapshotKind: 'x_creator_latest', observedAt: emptyAt + 10_000, rank: null, metrics: { views: 10 } }])
  let failureCalls = 0
  const failedAt = emptyAt + 20_000
  const failed = await discovery.refreshCreatorLatestDiscovery({
    relationshipProfiles: [],
    observedAt: failedAt,
    fetchRecentPosts: async () => {
      failureCalls++
      return {
        posts: [],
        errors: [
          { targetUsername: 'alpha', error: 'alpha failed' },
          { targetUsername: 'beta', error: 'beta failed' },
        ],
        bounds: { maxTargets: 2 },
      }
    },
    classifyNiche: () => ({ score: 0, tags: [], matches: [] }),
  })
  assert.equal(failureCalls, 1)
  assert.equal(failed.snapshotReplaced, false)
  assert.equal(failed.preservedLastGood, true)
  assert.deepEqual(store.getDiscoverSnapshot('x_creator_latest').candidates.map((candidate) => candidate.key), [stale.key])
  assert.match(store.getDiscoverSnapshot('x_creator_latest').error, /alpha failed|beta failed/)

  const alphaId = tweetIdForTimestamp(failedAt + 10_000, 53n)
  let partialCalls = 0
  const partialAt = failedAt + 20_000
  const partial = await discovery.refreshCreatorLatestDiscovery({
    relationshipProfiles: [],
    observedAt: partialAt,
    fetchRecentPosts: async () => {
      partialCalls++
      return {
        posts: [{ id: alphaId, targetUsername: 'alpha', authorUsername: 'alpha', text: 'alpha recovered', timestamp: partialAt - 5_000, url: `https://x.com/alpha/status/${alphaId}`, views: 20, likes: 2, reposts: 0, replies: 1 }],
        errors: [{ targetUsername: 'beta', error: 'beta still failed' }],
        bounds: { maxTargets: 2 },
      }
    },
    classifyNiche: () => ({ score: 10, tags: ['ai'], matches: ['alpha'] }),
  })
  assert.equal(partialCalls, 1)
  assert.equal(partial.snapshotReplaced, true)
  assert.equal(partial.preservedLastGood, false)
  assert.equal(partial.partialFailure, true)
  assert.equal(store.getDiscoverSnapshot('x_creator_latest').candidates.length, 1)
  assert.match(store.getDiscoverSnapshot('x_creator_latest').error, /beta still failed/)
})

test('engagement refresh invokes shared creator refresh without promoting watch-only entries into Engage', async () => {
  const engagement = await loadEngagement()
  const now = 1_788_924_900_000
  const tweetId = tweetIdForTimestamp(now - 30_000, 61n)
  let calls = 0
  const result = await engagement.refreshEngagementOpportunities({
    now,
    minTargetScore: 999,
    creatorRefresh: async ({ relationshipProfiles }) => {
      calls++
      assert.deepEqual(relationshipProfiles, [])
      return {
        entries: [{
          targetUsername: 'watchonly',
          origins: ['signal_watch'],
          candidate: xCandidate(tweetId, 'watchonly'),
        }],
        errors: [],
      }
    },
  })
  assert.equal(calls, 1)
  assert.equal(result.newOpportunities.some((item) => item.targetUsername === 'watchonly'), false)
})

test('agent bridge exposes canonical For You ingest and signal-watchlist commands', () => {
  const previousRevision = runAgent('x-signal-watchlist').watchlist.revision
  const updated = runAgent('x-signal-watchlist-update', {
    targets: [{ username: '@SignalDev', enabled: true, note: 'bridge test' }],
  })
  assert.equal(updated.watchlist.revision, previousRevision + 1)
  assert.deepEqual(updated.watchlist.targets, [{ username: 'signaldev', enabled: true, note: 'bridge test' }])

  const read = runAgent('x-signal-watchlist')
  assert.deepEqual(read.watchlist, updated.watchlist)

  const observedAt = 1_788_923_000_000
  const tweetId = tweetIdForTimestamp(observedAt - 30_000, 31n)
  const ingested = runAgent('x-for-you-ingest', {
    kind: 'x_for_you',
    observedAt,
    accountHandle: 'ham_zax',
    posts: [{
      tweetId,
      url: `https://x.com/SignalDev/status/${tweetId}`,
      username: '@SignalDev',
      text: 'bridge sensor observation',
      rank: 1,
      metrics: { views: 77 },
    }],
  })
  assert.equal(ingested.ingest.acceptedCount, 1)
  assert.equal(ingested.ingest.snapshotReplaced, true)
  assert.equal(store.getDiscoverSnapshot('x_for_you').fetchedAt, observedAt)
})
