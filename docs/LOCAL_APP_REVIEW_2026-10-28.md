# Local Application Review — 2026-10-28

Bounded local inventory for XR-19. Read-only diagnosis on a disposable database. No
repair, approval, send or production check was performed. Findings below are proposals
for the parent, not permission to change code.

## Scope

Inspected the page-load GET contracts for these surfaces:

| Surface | Route | Page-load GETs |
| --- | --- | --- |
| Today | `#/today` | `/api/session`, `/api/today`, `/api/growth-focus`, `/api/editorial?objective=<objective>`, `/api/growth-operator` |
| Discover | `#/discover` | `/api/discover` and `/api/discover?feed=<feed>` for `x`, `trending`, `creators`, `x-for-you`, `github`, `hn`, `opportunities`, `saved`, `handled`, `all`, `to-review&tag=<tag>` |
| Conversations | `#/conversations` | `/api/conversations`; detail `/api/conversations/:key`; editor `/api/drafts/:id` |
| Posts / Create | `#/create` | `/api/create`; draft editor `/api/drafts/:id` |
| Results | `#/results` | `/api/results` |
| Learn / Improve | `#/learn`, `#/learn/external`, `#/improve` | `/api/results`, `/api/improve`, `/api/viral-research?days=21&limit=200`, `/api/viral-research/status`, `/api/ai/settings` |

Not invoked:

- `/api/ai/runtimes`, because the handler runs local CLI availability checks.
- `POST /api/discover/refresh`, which Discover fires automatically when an empty feed is refreshable.
- `POST /api/ai/catalog-preview`, which Learn External can fire from a page effect when an intent runtime is active.
- `POST /api/results/refresh-performance` and every other mutating route.
- Send, approval, follow, like, repost and browser paths.

## Method and disposable state

- Create a temporary directory, `process.chdir()` into it before importing `store.js`
  and `web_api.js`. `store.js` resolves `.x-research.sqlite` from the current directory,
  so this step isolates all state.
- Set `WEB_AUTH_USER` and `WEB_AUTH_PASSWORD` to disposable dummy values. Set
  `AUTO_POST=false`. Delete any X API tokens from the process environment.
- Call `webApi.handleApi()` directly with a mock `ServerResponse` that implements
  `setHeader`, `once`, `writeHead` and `end`. No HTTP server, socket or dashboard process
  is started.
- Seed fixtures through `store.js` and `pipeline.js` only. `pipeline.setRoutingDecision`
  with `use_anyway` is fixture setup, never an HTTP action.
- Inspect each handler before probing it and skip GETs that perform external work.
- Delete the temporary directory when the probe ends.

Empty-state run: 24 GETs, all HTTP 200, each in 0–9 ms in a single local process. These
times are not performance evidence.

The repository working tree already contained uncommitted XR-16 changes. This review
did not edit or revert them, and did not run the full suite.

## Observed empty state

All of these are ordinary empty or unconfigured state, not defects.

| GET | Status | Observed shape |
| --- | --- | --- |
| `/api/today` | 200 | `taskCount: 0`, `actions: []`, zero stats, `nextScheduled: null` |
| `/api/editorial?objective=qualified_growth` | 200 | `hasPlan: false`, `recommendations: []`, `sourceFreshness` has 6 entries with no snapshot, `noStrongAction: false` |
| `/api/discover?feed=x` | 200 | `candidates: []`, `total: 0`, `refreshable: "x"` |
| `/api/discover?feed=creators` | 200 | `candidates: []`, `refreshable: null` |
| `/api/conversations` | 200 | `activeConversations: []`, `newOpportunities: []` |
| `/api/create` | 200 | `sections: []`, all counts 0 |
| `/api/results` | 200 | `account: null`, `measuredPosts: []`, `technical: []`, strategy outcomes 0 |
| `/api/improve` | 200 | `tests: []`, learning counts 0 |
| `/api/viral-research` | 200 | `job: null`, report groups and posts empty |
| `/api/viral-research/status` | 200 | `job: null` |
| `/api/ai/settings` | 200 | `profiles: []`, `defaultProfile: null` |
| `/api/session` | 200 | account and health fields, empty next schedule |

Field access in the page components matches these empty shapes. Rendering was not
executed, so this is a contract check, not a visual check.

### Unavailable configured features

These states are unavailable, not broken:

- No AI profile or runtime exists in the disposable state. Learn External can show its
  empty profile list but cannot run research or preview a model catalog.
- No account metrics or publication measurements exist. Results shows the no-account and
  no-measured-post state instead of a delta or evidence.
- No editorial plan exists. Today shows the “No completed plan yet” branch because
  `hasPlan` is false; `noStrongAction` stays false and is not consulted on that branch.
- No source snapshot exists. Today shows “No snapshot yet” for each of the six kinds.

## Findings

### Finding 1 — Conversation detail advertises an approval that the server rejects

**Severity:** medium. **Confidence:** high, reproduced.

**Fixture:** an engagement reply in `needs_review`, score 44, all gates passed,
`growthPackaging.ready` false with blocker `NO_CLEAR_PURPOSE_PAYOFF`.

**Request:**

```http
GET /api/conversations/https%3A%2F%2Fx.com%2Fbuilder%2Fstatus%2F<id>
Authorization: Basic <dummy owner credentials>
```

**Observed (excerpt):** HTTP 200.

```json
{
  "flags": { "canReview": true, "canApproveReply": true, "approved": false },
  "editor": {
    "flags": { "canApprove": false, "canApproveReply": false },
    "analysis": {
      "score": 44,
      "gates": { "passed": true },
      "growthPackaging": {
        "ready": false,
        "blockers": [{ "code": "NO_CLEAR_PURPOSE_PAYOFF" }]
      }
    }
  }
}
```

A direct `evaluateDraftQuality` call for the same draft returns `publishable: false`. The
server approval path at `pipeline.js:1025` rejects any reply whose `analysis.publishable`
is false. Its guard builds this message:

```text
Reply is not approval-ready. Writing quality is 44/50. NO_CLEAR_PURPOSE_PAYOFF: The current draft does not visibly fulfill its selected purpose.
```

**Expected:** the outer `flags.canApproveReply` must not be true when the embedded
`editor.flags.canApproveReply` is false. The outer flag omits
`analysis.growthPackaging?.ready`, while the editor flags include it.

**Impact:** `ui/src/features/conversations/ConversationDetail.tsx:40` reads the outer
flag and renders the success panel around line 191 with an “Approve exact reply” button.
The operator clicks a control that the server refuses. No send occurs, so the failure is
a false affordance, not a publication risk.

**Owner:** `web_api.js:1307`, the `canApproveReply` expression in
`formatConversationDetail`. The UI is a consumer and already trusts the server flag.

**Acceptance check:** add a focused contract check with two replies:

1. Score ≥ 40, gates passed, `growthPackaging.ready: false` → outer
   `flags.canApproveReply` is false.
2. Score ≥ 40, gates passed, `growthPackaging.ready: true`, healthy account → outer
   `flags.canApproveReply` is true.

Also assert that the outer value matches `editor.flags.canApproveReply` when an editor
payload exists, and that the existing approval refusal remains unchanged.

### Finding 2 — Today calls a non-approvable draft “ready for your approval”

**Severity:** medium. **Confidence:** high, reproduced.

**Fixture:** an original post in `needs_review`, score 44, all gates passed,
`growthPackaging.ready` false with blocker `NO_CLEAR_PURPOSE_PAYOFF`. A saved
`No influence` writing-strategy selection (`mode: "off"`) removes the separate
`STRATEGY_DECISION_MISSING` blocker.

**Request:**

```http
GET /api/today
Authorization: Basic <dummy owner credentials>
```

**Observed:** HTTP 200, one action:

```json
{
  "eyebrow": "Review a post",
  "title": "@builder",
  "body": "The draft passed its checks and is ready for your approval.",
  "note": "Quality 44/50 · Original post",
  "href": "#/draft/1",
  "action": "Review draft",
  "tone": "success"
}
```

The same fixture returns HTTP 200 at `GET /api/drafts/1` with
`flags.canApprove: false` and `growthPackaging.ready: false`. A direct
`evaluateDraftQuality` call returns `score: 44`, `gates.passed: true`,
`publishable: false` and one blocker, `NO_CLEAR_PURPOSE_PAYOFF`. Without the strategy
selection, the analysis also reports `STRATEGY_DECISION_MISSING`.

`ui/src/features/today/Today.tsx` renders the body and the `success` tone without
rechecking readiness. The linked draft editor receives the blocked growth-packaging
payload, so the two surfaces contradict each other.

**Expected:** the readiness predicate must include
`analysis.growthPackaging?.ready === true`, matching `draftEditorPayload` at
`web_api.js:1234` and the approval path. A blocked draft should get a warning or neutral
action that says it still needs a fix or confirmation.

**Owner:** `web_api.js:2253`, the `ready` expression in the `/api/today` handler.

**Acceptance check:** add a focused `/api/today` check with the same two fixtures:

1. Blocked draft → `tone` is not `success` and the body does not claim approval readiness.
2. Ready draft → `tone: "success"` and the current body.

The existing `/api/drafts/:id` `canApprove` value must agree with the action result for
the same draft.

### Finding 3 — Today shows raw source kinds for two freshness entries

**Severity:** low. **Confidence:** high, reproduced from the payload and source.

**Request:**

```http
GET /api/editorial?objective=qualified_growth
Authorization: Basic <dummy owner credentials>
```

**Observed:** `sourceFreshness` returns all six kinds from `SOURCE_SNAPSHOT_KINDS`
(`store.js:68`):

```json
["x_latest", "x_momentum", "github_trending", "hn_top", "x_for_you", "x_creator_latest"]
```

`ui/src/features/today/Today.tsx:29` maps only `x_latest`, `x_momentum`,
`github_trending` and `hn_top`. Line 65 falls back to `source.kind`, so the Today page
would render `x_for_you` and `x_creator_latest` as raw machine labels. Discover has its
own complete label list.

**Expected:** every kind emitted by the server has a readable label on Today.

**Owner:** `ui/src/features/today/Today.tsx:29`, the `SOURCE_LABELS` map. The server list
is owned by `store.js:68`; a new kind needs a matching label.

**Acceptance check:** assert that Today renders a human label for every current
`SOURCE_SNAPSHOT_KINDS` value, and that no `snake_case` kind appears in the rendered
freshness row.

## Fixture corrections and non-defects

- An earlier seeded run showed `/api/results` `account.postsList: 0`. The fixture posts
  had no `id`, and `recordPerformanceSnapshot` skips such rows (`store.js:6683`). With an
  `id`, the same endpoint returned `postsList: 1`.
- A second results fixture added one published main-feed item, one 60-minute
  measurement and one account snapshot. `GET /api/results` then returned `account`
  non-null, `measuredPosts: 1`, `technical: 1`, and `measurementCapabilities` present.
  This is a working measured-state contract, not a defect.
- `account.followerDelta: null` with a single account snapshot is expected. The handler
  needs a previous snapshot to compute a delta.
- Empty `sourceFreshness` entries with `fetchedAt: null` are ordinary missing snapshots.
  XR-16 owns stale-source diagnosis; Finding 3 is only a label-map gap.

## Cross-references

- **XR-16:** owns stale discovery by source, refresh behavior and preserved last-good
  state. This review did not change XR-16 source or tests. Finding 3 is adjacent but
  distinct: it is a display label gap on Today, not a freshness claim.
- **XR-18:** the two recorded test failures were not rerun. No full-suite result is
  claimed here.
- **XR-19:** this report is the bounded inventory. Acceptance of the three findings is a
  parent decision.

## Untested limits

- No owner walkthrough. Owner preferences and unnamed quirks remain unknown.
- No real dashboard server. Middleware, static assets, routing, auth cookies and the
  built UI bundle were not exercised.
- No browser or native UI run. Layout, visual hierarchy, responsive behavior,
  accessibility, keyboard flow and rendered empty states were not checked.
- No repository or production database, no real credentials, no ARM host, no production
  deployment, no service and no network call. The local database was disposable and is
  not evidence about current production state.
- `/api/ai/runtimes` was skipped because it performs local CLI checks. Learn External can
  also POST `/api/ai/catalog-preview` from a page effect; that path was not run.
- Discover’s automatic empty-feed `POST /api/discover/refresh` was not run. The empty
  Discover shapes above are pre-refresh observations.
- No approval was submitted. The rejection in Finding 1 is established from
  `analysis.publishable: false` and the guard at `pipeline.js:1025`, not from an observed
  UI error message.
- No send, follow, like, repost or publication action was attempted.
- No concurrency, memory, load or latency claim. The 0–9 ms figures come from one local
  process.
- No security review. Only the six page-load surfaces and their immediate detail
  contracts were inspected.
- No whole-app acceptance claim.

## Minimal reproduction recipe

Run this from a fresh temporary directory. The example uses dummy credentials and
disposable state only.

```js
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = '/home/ubuntu/repo/x_test'
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xr19-'))

process.env.WEB_AUTH_USER = 'owner'
process.env.WEB_AUTH_PASSWORD = 'xr19-dummy'
process.env.X_ACCOUNT = 'ham_zax'
process.env.AUTO_POST = 'false'
delete process.env.X_API_ACCESS_TOKEN
process.chdir(tmpDir)

const store = await import(pathToFileURL(path.join(REPO, 'store.js')).href)
const pipeline = await import(pathToFileURL(path.join(REPO, 'pipeline.js')).href)
const webApi = await import(pathToFileURL(path.join(REPO, 'web_api.js')).href)

const auth = `Basic ${Buffer.from('owner:xr19-dummy').toString('base64')}`
const behavior = {
  decision: 'ACT',
  primaryPurpose: 'technical_value',
  socialMode: 'explainer',
  informationDepth: 'compact_reason',
  affectStrategy: 'neutral',
  affectProvenance: 'none',
  reasonToExist: 'Explain retry boundaries.',
}
const key = `https://x.com/builder/status/${Date.now()}`

store.upsertCandidates([{ key, source: 'x', author: 'builder', username: 'builder', title: '@builder', text: 'Agent API retries should preserve committed state.', url: key, timestamp: Date.now(), metrics: { views: 20000, likes: 300, retweets: 30, replies: 10 } }])
pipeline.setRoutingDecision(key, { decision: 'use_anyway', reason: 'disposable fixture', actor: 'human' })
pipeline.routeCandidate(key, 'original', { actor: 'human' })
const draft = store.getDraftByCandidate(key)
store.saveDraft({ ...draft, body: 'A stale transaction handle often explains the spike pattern.', editor: { pipeline: 'original', behavior }, status: 'draft' })
pipeline.requestQueueReview(key)
store.recordWritingStrategySelection({ queueItemId: store.getQueueItemByCandidate(key).id, draftId: draft.id, mode: 'off', selectionSource: 'manual', selectedBy: 'human' })

async function getApi(url) {
  let status = null
  let body = ''
  const response = { setHeader() {}, once() {}, writeHead(next) { status = next }, end(chunk = '') { body += String(chunk) } }
  await webApi.handleApi({ method: 'GET', headers: { authorization: auth } }, response, new URL(url))
  return { status, data: JSON.parse(body).data }
}

const today = await getApi('http://localhost/api/today')
const editor = await getApi(`http://localhost/api/drafts/${draft.id}`)
```

For Finding 1, route the same candidate with `reply` instead of `original`, then request
`/api/conversations/${encodeURIComponent(key)}`. For Finding 3, request
`/api/editorial?objective=qualified_growth` and inspect `sourceFreshness`.

The probe scripts that produced these results were created only in temporary
directories. They were removed after the review, so this document is the durable record.
