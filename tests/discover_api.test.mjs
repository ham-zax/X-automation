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
let webApi

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'discover-api-test-'))
  process.chdir(tmpDir)
  store = await import(pathToFileURL(path.join(REPO, 'store.js')).href)
  webApi = await import(pathToFileURL(path.join(REPO, 'web_api.js')).href)
})

after(async () => {
  process.chdir(originalCwd)
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true })
})

function candidate(id = '2090000000000000000') {
  return {
    key: `https://x.com/signaldev/status/${id}`,
    source: 'x',
    title: '@signaldev',
    text: 'Qwen inference deployment latency reliability tradeoff for developers',
    url: `https://x.com/signaldev/status/${id}`,
    timestamp: Date.now() - 60_000,
    score: 30,
    niche: { score: 30, tags: ['models'], matches: ['qwen', 'inference'] },
    metrics: { views: 5000, likes: 200, retweets: 20, replies: 25 },
  }
}

function saveObserved(kind, item, observedAt, rank = null) {
  store.upsertCandidates([item])
  store.saveDiscoverSnapshot(kind, [item], observedAt)
  store.recordSourceObservations([{
    candidateKey: item.key,
    snapshotKind: kind,
    observedAt,
    rank,
    metrics: { views: 5000, likes: 200, reposts: 20, replies: 25 },
  }])
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

async function getApi(url) {
  let status = null
  let body = ''
  const response = {
    writeHead(nextStatus) { status = nextStatus },
    end(chunk = '') { body += String(chunk) },
  }
  await webApi.handleApi({ method: 'GET' }, response, new URL(url))
  assert.equal(status, 200, body)
  const parsed = JSON.parse(body)
  assert.equal(parsed.state, 'success')
  return parsed.data
}

test('Growth Operator merges authenticated provenance without a source-count priority bonus', () => {
  const item = candidate('2091000000000000000')
  const observedAt = Date.now()
  saveObserved('x_latest', item, observedAt)

  const first = runAgent('growth-next', { limit: 20, includeIgnored: true, includeLowSignal: true })
  const firstItem = first.items.find((entry) => entry.key === item.key)
  assert.ok(firstItem)
  assert.deepEqual(firstItem.sourceKinds, ['x_latest'])
  const priority = firstItem.operatorPriority

  saveObserved('x_for_you', item, observedAt + 1_000, 2)
  const second = runAgent('growth-next', { limit: 20, includeIgnored: true, includeLowSignal: true })
  const matches = second.items.filter((entry) => entry.key === item.key)
  assert.equal(matches.length, 1)
  assert.deepEqual(matches[0].sourceKinds, ['x_latest', 'x_for_you'])
  assert.equal(matches[0].operatorPriority, priority)
})

test('Discover canonicalizes aggregate identity and exposes real X For You and creator feeds with active provenance', async () => {
  const item = candidate('2092000000000000000')
  const observedAt = Date.now() + 10_000
  saveObserved('x_for_you', item, observedAt, 1)
  saveObserved('x_creator_latest', item, observedAt + 1_000)

  const defaultFeed = await getApi('http://localhost/api/discover')
  assert.equal(defaultFeed.feed, 'to-review')
  const aggregate = defaultFeed.candidates.find((entry) => entry.key === item.key)
  assert.ok(aggregate)
  assert.deepEqual(aggregate.sourceKinds, ['x_for_you', 'x_creator_latest'])

  const legacy = await getApi('http://localhost/api/discover?feed=for-you')
  assert.equal(legacy.feed, 'to-review')

  const forYou = await getApi('http://localhost/api/discover?feed=x-for-you')
  assert.equal(forYou.feed, 'x-for-you')
  assert.equal(forYou.sourceKind, 'x_for_you')
  assert.equal(forYou.refreshable, null)
  assert.deepEqual(forYou.candidates.map((entry) => entry.key), [item.key])
  assert.deepEqual(forYou.candidates[0].sourceKinds, ['x_for_you', 'x_creator_latest'])

  const creators = await getApi('http://localhost/api/discover?feed=creators')
  assert.equal(creators.feed, 'creators')
  assert.equal(creators.sourceKind, 'x_creator_latest')
  assert.equal(creators.refreshable, null)
  assert.deepEqual(creators.candidates.map((entry) => entry.key), [item.key])
})
