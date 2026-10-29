import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const originalCwd = process.cwd()
const OWNER = 'owner'
const PASSWORD = 'web-readiness-views-password'
const AUTH = `Basic ${Buffer.from(`${OWNER}:${PASSWORD}`).toString('base64')}`
const SOURCE_TEXT = 'Qwen inference deployment latency reliability tradeoff for developers'
const BLOCKED_BODY = 'A stale transaction handle often explains the spike pattern.'
const READY_TEXT = 'The install receipt should pin the audited revision, so the agent cannot execute a newer build.'
const BLOCKED_REPLY = 'The retry boundary sits inside the agent session.'
const READY_REPLY = 'The install receipt should pin the audited revision before the agent runs it.'

let tmpDir
let store
let pipeline
let webApi

before(async () => {
  process.env.WEB_AUTH_USER = OWNER
  process.env.WEB_AUTH_PASSWORD = PASSWORD
  process.env.X_ACCOUNT = 'ham_zax'
  process.env.AUTO_POST = 'false'
  delete process.env.X_API_ACCESS_TOKEN
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'web-readiness-views-'))
  process.chdir(tmpDir)
  store = await import(pathToFileURL(path.join(REPO, 'store.js')).href)
  pipeline = await import(pathToFileURL(path.join(REPO, 'pipeline.js')).href)
  webApi = await import(pathToFileURL(path.join(REPO, 'web_api.js')).href)
})

after(async () => {
  process.chdir(originalCwd)
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true })
})

function actBehavior(reasonToExist) {
  return {
    decision: 'ACT',
    primaryPurpose: 'technical_value',
    socialMode: 'explainer',
    informationDepth: 'compact_reason',
    affectStrategy: 'neutral',
    affectProvenance: 'none',
    reasonToExist,
  }
}

// Supported fixture writers only: candidate, routing, queue review and strategy
// records. No scoring mocks and no direct database access.
function seedReviewDraft({ key, pipelineKey, body, reasonToExist }) {
  store.upsertCandidates([{
    key,
    source: 'x',
    author: 'builder',
    username: 'builder',
    title: '@builder',
    text: SOURCE_TEXT,
    url: key,
    timestamp: Date.now(),
    metrics: { views: 12000, likes: 180, retweets: 24, replies: 9 },
  }])
  const behavior = actBehavior(reasonToExist)
  if (pipeline.inspectGrowthOpportunity(key).recommendation?.pipeline === 'ignore') {
    pipeline.setRoutingDecision(key, { decision: 'use_anyway', reason: 'Disposable display fixture', actor: 'human' })
  }
  pipeline.routeCandidate(key, pipelineKey, { actor: 'human', routeContext: { behavior, reasonToExist } })
  const draft = store.getDraftByCandidate(key)
  store.saveDraft({ ...draft, body, status: 'draft' })
  const queueItem = store.getQueueItemByCandidate(key)
  if (pipelineKey !== 'reply') {
    store.recordWritingStrategySelection({
      queueItemId: queueItem.id,
      draftId: draft.id,
      mode: 'off',
      selectionSource: 'manual',
      selectedBy: 'human',
    })
  }
  pipeline.requestQueueReview(key)
  return { draftId: draft.id, candidateKey: key, queueItemId: queueItem.id }
}

async function getApi(route) {
  let status = null
  let body = ''
  const response = {
    setHeader() {},
    once() {},
    writeHead(nextStatus) { status = nextStatus },
    end(chunk = '') { body += String(chunk) },
  }
  await webApi.handleApi({ method: 'GET', headers: { authorization: AUTH } }, response, new URL(`http://localhost${route}`))
  assert.equal(status, 200, body)
  const parsed = JSON.parse(body)
  assert.equal(parsed.state, 'success', body)
  return parsed.data
}

function assertAnalysisPrecondition(editor, { packagingReady }) {
  assert.ok(Number(editor.analysis?.score) >= 40, `expected a passing score, got ${editor.analysis?.score}`)
  assert.equal(editor.analysis?.gates?.passed, true, JSON.stringify(editor.analysis?.gates?.failures))
  assert.equal(editor.analysis?.growthPackaging?.ready, packagingReady)
}

function blockerCodes(editor) {
  return (editor.analysis?.growthPackaging?.blockers || []).map((blocker) => blocker.code)
}

test('conversation detail does not advertise approval for a blocked reply', async () => {
  const fixture = seedReviewDraft({
    key: 'https://x.com/builder/status/7001',
    pipelineKey: 'reply',
    body: BLOCKED_REPLY,
    reasonToExist: 'Name the retry boundary that changes the decision.',
  })
  const editor = await getApi(`/api/drafts/${fixture.draftId}`)
  assertAnalysisPrecondition(editor, { packagingReady: false })
  assert.ok(blockerCodes(editor).includes('NO_CLEAR_PURPOSE_PAYOFF'), JSON.stringify(blockerCodes(editor)))
  assert.equal(editor.flags.canApproveReply, false)

  const detail = await getApi(`/api/conversations/${encodeURIComponent(fixture.candidateKey)}`)
  assert.ok(detail.editor, 'conversation detail must embed the editor it mirrors')
  assert.equal(detail.flags.canApproveReply, editor.flags.canApproveReply)
  assert.equal(detail.flags.canApproveReply, false)
})

test('conversation detail advertises approval for a ready reply', async () => {
  const fixture = seedReviewDraft({
    key: 'https://x.com/builder/status/7002',
    pipelineKey: 'reply',
    body: READY_REPLY,
    reasonToExist: 'Name the audited artifact boundary that changes the decision.',
  })
  const editor = await getApi(`/api/drafts/${fixture.draftId}`)
  assertAnalysisPrecondition(editor, { packagingReady: true })
  assert.equal(editor.flags.canApproveReply, true)

  const detail = await getApi(`/api/conversations/${encodeURIComponent(fixture.candidateKey)}`)
  assert.ok(detail.editor, 'conversation detail must embed the editor it mirrors')
  assert.equal(detail.flags.canApproveReply, editor.flags.canApproveReply)
  assert.equal(detail.flags.canApproveReply, true)
})

test('Today reports a blocked original draft as needing a fix', async () => {
  const fixture = seedReviewDraft({
    key: 'https://x.com/builder/status/7003',
    pipelineKey: 'original',
    body: BLOCKED_BODY,
    reasonToExist: 'Explain the stale transaction handle that changes the debugging decision.',
  })
  const editor = await getApi(`/api/drafts/${fixture.draftId}`)
  assertAnalysisPrecondition(editor, { packagingReady: false })
  assert.ok(blockerCodes(editor).includes('NO_CLEAR_PURPOSE_PAYOFF'), JSON.stringify(blockerCodes(editor)))
  assert.equal(editor.flags.canApprove, false)

  const today = await getApi('/api/today')
  const actions = today.actions.filter((action) => action.eyebrow === 'Review a post')
  assert.equal(actions.length, 1, JSON.stringify(today.actions))
  const [action] = actions
  assert.equal(action.href, `#/draft/${fixture.draftId}`)
  assert.equal(action.tone, 'warning')
  assert.doesNotMatch(action.body, /ready for your approval/i)
  assert.match(action.body, /still needs a fix or confirmation/i)
  assert.equal(action.tone === 'success', editor.flags.canApprove)

  // Leave only one main-lane review item so the next case is deterministic.
  store.saveQueueItem({ candidateKey: fixture.candidateKey, status: 'drafting' })
})

test('Today reports a ready original draft as ready for approval', async () => {
  const fixture = seedReviewDraft({
    key: 'https://x.com/builder/status/7004',
    pipelineKey: 'original',
    body: READY_TEXT,
    reasonToExist: 'Name the audited revision boundary that changes the decision.',
  })
  const editor = await getApi(`/api/drafts/${fixture.draftId}`)
  assertAnalysisPrecondition(editor, { packagingReady: true })
  assert.equal(editor.flags.canApprove, true)

  const today = await getApi('/api/today')
  const actions = today.actions.filter((action) => action.eyebrow === 'Review a post')
  assert.equal(actions.length, 1, JSON.stringify(today.actions))
  const [action] = actions
  assert.equal(action.href, `#/draft/${fixture.draftId}`)
  assert.equal(action.tone, 'success')
  assert.equal(action.body, 'The draft passed its checks and is ready for your approval.')
  assert.equal(action.tone === 'success', editor.flags.canApprove)
})
