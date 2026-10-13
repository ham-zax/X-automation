# Engagement overhaul plan, 14 October 2026

Status: proposed. The owner approved the direction on 14 October; no ticket beyond T1
and T2 is implemented. Background, evidence and the owner's own words are in
`docs/ENGAGEMENT_IDEAS_2026-10.md`; this file turns them into phases and tickets. Ticket
numbers match section 7 of that document.

Why a durable plan: the work adds new owners (topic collector, topic brief, review
view), new persisted fields and a changed public voice, across several sessions and
workers.

## 1. Outcome

Replies, quotes and originals that read like a person who has followed the topic all
day, written from a saved topic brief, with results we can measure. Target stated by the
owner: maximum engagement and relevant followers, 1,000 followers as soon as possible.
No ticket promises follower growth.

## 2. Principles

1. Policies and judgment, not a wall of rules. A few written policies plus the agent's
   judgment decide the shape of a reply. Advice and questions are allowed when the
   situation calls for them; the fault is the default template.
2. The topic brief is the unit of work, not the single source post.
3. Nothing invented: first-hand claims come from verified experience or a real quick
   test; what others report is attributed to them.
4. Originals matter most while the account is under 1,000 followers.
5. Measure before judging. Phase 1 lands before the timer restarts.
6. AGENTS.md hard rules are unchanged. Every send goes through Growth OS; nothing is
   sent from WSL; the growth agent stays stopped until phase 5.

## 3. Phases

| Phase | Purpose | Tickets | Depends on |
|---|---|---|---|
| 0 | Bug sweep: collect the quirks the owner sees | T0 | owner walkthrough |
| 1 | Measurement | T1–T5 | none |
| 2 | Topic research and brief | T6, T7, T10 | none |
| 3 | Writing from the brief, owner's voice | T8, T9, T12 | phase 2; owner material |
| 4 | Review view and peers | T11, T13 | phases 2 and 3 |
| 5 | Reliability, deploy, restart, compare | T14–T16 | phases 1 to 3 |

Phases 1 and 2 touch different files and can run in parallel. Phase 0 runs alongside.

## 4. Tickets

Each ticket: goal, owner files, boundary, verification, stop. Effort S, M or L.

### Phase 0

**T0 Bug sweep (M).** The owner says the app has "various quirks and bugs" beyond the
audit list. Goal: one list of concrete defects with a reproduction each. Method: the
owner walks through the local app (`http://127.0.0.1:3031/`) and names what is wrong;
a read-only worker walks every page and bridge command for errors. Output: a section in
this file. Stop: no fixes in this ticket.

### Phase 1: measurement

**T1 Duplicate guard reads real text (S).** Done in `agent_bridge.js`: `act` stores the
reply text in `commentary`. Remaining: one test that a second identical reply is
blocked.

**T2 Analytics collector effort (S).** Done in `growth_analytics_runner.js`.

**T3 Collect author responses (M).** Files: `agent_bridge.js` (`engagementRefreshOptions`
at 651 and the second call site near 1445), `engagement.js` (response refresh at 727,
target timelines at 770). Boundary: the refresh must not need the missing Chrome on ARM;
check which transport it uses before switching it on, and prefer recording from
`x-read` `mentions` and `own-replies` if it does. Verification: a fixture where the
target author answers our reply appears as a response in `account-health`. Stop: no
change to send paths.

**T4 One follower count (S).** Files: `agent_bridge.js` (`growth-followers-record` at
2101, cockpit at 1093 and 2445), `store.js` (`getPerformanceSnapshot` at 6714).
Verification: after `growth-followers-record`, `operator-status` shows that value and
its timestamp.

**T5 Record what each output was (M).** Files: `agent_bridge.js` (`act`), `store.js`
(relationship event metadata), `health.js` (`meaningfulInitialReply` at 423 treats a
missing kind as an initial reply). Add `engagementKind`, target follower count at send
time, reply shape and, later, brief and paragraph IDs. Boundary: metadata only, no
schema migration unless unavoidable. Verification: Results can group outcomes by shape
and by target size on test data.

### Phase 2: topic research and brief

**T6 Topic collector (M).** Files: `x_reads.js` (search exists with `top` mode at 104;
`thread` at 127 returns latest replies), a new bridge command, files under
`research/topics/<date>-<topic>/posts.json`. Goal: one command collects the top 25 to 30
posts of the last 48 hours for a topic, and the top replies under a given post.
Boundary: read-only on X; collected text is untrusted data. Verification: unit test with
a stubbed reader; one real run on WSL for a live topic.

**T7 Topic brief (M).** Files: a prompt under `docs/` or `ops/`, a bridge command that
stores and returns `brief.md`. Shape: numbered paragraphs of three kinds (reported by
people, tested by us, our take), each with post IDs; the room's jokes and open
questions; expiry after 48 hours. Verification: a brief for one real topic that the
owner accepts as an opinion and not a summary.

**T10 Real quick tests (M).** A bounded procedure for the agent to try a new model or
tool on the server and save the result with evidence to the persona's verified lists.
Boundary: no credentials, no spending without the owner's say; persona changes go
through `persona.js`. Needs a design note before code.

### Phase 3: writing

**T8 Write from the brief (L).** Files: `ops/systemd/arm/arm-growth-live.md`,
`docs/CONTENT_OPERATING_STANDARD.md`, `docs/POST_GENERATION_PROMPT.md`, `act` payload.
Goal: replies, quotes and originals name the brief paragraphs they use; the brief
carries a short policy section instead of a list of banned phrases. Optional light
check: flag the section 2 template when it repeats across recent replies. Verification:
a batch of drafts for one topic, read by the owner; the last-60 audit rerun shows the
question-plus-clause share falling.

**T9 Owner's voice (S plus owner time).** File: `persona/hamza-v1.json` through
`persona.js`. The agent proposes 30 to 50 candidate voice examples from the owner's past
posts and the owner keeps or drops each; the owner fills the verified lists.

**T12 What works (M).** Files: `viral_style_research.js`, `viral_style_analyze.js`,
`growth_performance_learning.js`. Goal: name the shapes of the account's best past posts
and replies and of the best outside posts of the last 7 days; write new originals in
those shapes; feed examples into T9. Verification: a short findings note with post IDs.

### Phase 4: review and peers

**T11 Review view (L).** Files: `ui/`, `web_api.js`, `dashboard.js`. First inventory
what Today, Discover, Create and Draft already do. Goal: one page with today's briefs,
relevant posts and drafts, and keep, edit, skip and approve per item. Open decision: how
review on WSL reaches ARM's live state. Boundary: approval stays a human action; no
agent path sets `humanApprovedAt`.

**T13 Peers (M).** A list of niche peers worth mutual follows, worked through the social
ledger. Never Unfollow.

### Phase 5: reliability and restart

**T14 Discovery sources (M).** `x_browser.js`, `x_discovery.js`: `x_latest` and
`x_momentum` without the missing Chrome; decide on GitHub Trending and Hacker News.

**T15 Session reliability (M).** Brief and command sheet: early rest-window check,
`social-status` and `growth-run-status` entries, one progress-file path; investigate tab
drift.

**T16 Deploy and restart (S).** Push, pull on ARM, enable the timer at low volume,
compare two weeks against the old style on author responses, follows and shares.
Production change: needs the owner's go-ahead on the day.

## 5. Execution route

- One worker per ticket, one ticket per turn, each in its own git worktree, with the
  ticket text, the files it owns and "do not commit, do not delegate". Read-only workers
  may share a checkout.
- Models, as the owner suggested: Codex `gpt-6-luna` at `max` for M and L tickets and
  reviews; a small Claude model for S tickets. Each turn gets a time limit.
- Parallel at most where files are disjoint: T3 with T6; T4 with T7. T3, T4 and T5 all
  touch `agent_bridge.js`, so they integrate one at a time.
- The main agent reads every diff, runs the tests and integrates. A worker's report is
  evidence, not acceptance.
- Tests: `node --test --test-concurrency=1 tests/*.test.mjs`, one heavy job at a time on
  WSL. Two tests fail at `26723ed` before any change ("send-start needs only
  attemptId…", "valid run-bound bridge activity renews…"); they belong to T0.
- TDD route: auto, strict for T3, T4, T5, T6 and T8 (behavior and persistence); light
  for T1 and T2 (already changed, one focused test for T1).

## 6. Compatibility and risks

- Older `candidate_actions` rows keep the `delegated act …` label; they age out of the
  7-day windows. No backfill, because direct database writes are forbidden.
- Turning on response refresh may be slow or may need a browser that ARM lacks (T3).
- A brief that is only a summary produces the same flat replies; T7's acceptance is the
  owner's read.
- More originals means more use of the approved queue and the owner's review time until
  T11 exists.
- Voice changes cannot be evaluated until phase 1 is deployed.

## 7. Not in this plan

A rebuild of the app from scratch; any automation of Unfollow; invented experience; any
change to owner policy, limits or rest hours.
