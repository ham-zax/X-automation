# Agent A9 — Autonomous Reply Operator

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** mixed
**Workspace:** `/home/hamza/repo/x_test-w8-autoreply`
**Branch:** `agent/w8-autonomous-reply`
**Isolation reason:** A8 is concurrently writing the main worktree and currently touches shared workflow/publication authority owners.
**Can start:** read-only inspection immediately; shared-authority mutation only after A8 Growth Decision Recovery lands a stable integrated commit on `main`
**Depends on:** A8 Growth Decision Recovery + Live Growth Pilot integration
**Execution lifetime:** `persistent-agent-loop` required
**Wake strategy:** repository state/event observation while dependency is active; Terminal + event wait for persistent app/runtime processes during verification
**Developer visibility:** headless by default; passive presentation on request

## Read first

- `docs/agent-plans/2026-08-21-autonomous-reply-operator/README.md`
- `AGENTS.md`
- `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`
- `docs/GROWTH_DISTRIBUTION_PLAYBOOK.md`
- `docs/AGENT_WORKFLOW.md`
- `docs/RELATIONSHIP_INTELLIGENCE.md`
- `docs/ACCOUNT_HEALTH_AND_VISIBILITY.md`
- `docs/ALGORITHM_EVIDENCE_LEDGER.md`
- `docs/POST_GENERATION_PROMPT.md`
- the landed A8 Growth Decision Recovery artifacts/report when available

Use @Causal Coding before source mutation.
Use @Persistent Agent Loop for execution lifetime.

## Objective

Turn the existing human-reviewed Engage Next capability into a **bounded, explicitly enabled autonomous reply operator** without turning the account into a spam bot.

The system should be able to notice relevant X conversations — high-momentum or ordinary — decide whether a reply is worth making, choose an appropriate reply intent and tone, generate a concise context-aware reply, and send it automatically **only when an explicit operator autonomy grant allows it and all deterministic safety/value conditions pass**.

This is a persistent operator, not a one-shot "find one reply" action. Once the operator explicitly starts autonomous replies, the running service should keep refreshing the relevant X inputs, evaluate newly observed opportunities, act on every independently eligible opportunity allowed by the current grant, then continue waiting for the next refresh until the operator pauses/stops/revokes the grant or the process is intentionally stopped. A refresh may legitimately produce zero, one, or several sends.

The goal is legitimate network growth through useful participation in existing conversations, not reply volume.

## Current state

The repository already has a real reply pipeline:

- `refreshEngagementOpportunities()` / Engage Next;
- `queue_items(lane=engagement, pipeline=reply)`;
- initial replies, follow-ups, and responses to our own posts;
- relationship, conversation-potential, reply-visibility, freshness, expiry, saturation/repetition, and contribution scoring;
- contribution archetypes such as implementation detail, caveat, comparison, correction, informed question, synthesis, etc.;
- AI-assisted reply drafting;
- deterministic Draft-quality/content gates;
- exact human approval snapshot;
- explicit one-reply send transport;
- relationship and candidate-action recording after success.

What does **not** exist today:

- autonomous reply-send authority;
- an explicit autonomy grant/configuration model;
- a bounded autonomous candidate claim/send loop;
- persistent start/pause/stop loop semantics that continue without a human keeping the UI open;
- durable new-item/watermark or equivalent decision state so each refresh distinguishes newly observed opportunities from already-decided targets;
- a first-class separation between reply **intent/contribution** and reply **tone**;
- humor/playfulness as a deliberate, context-safe tone option;
- an autonomous dry-run/read model explaining why the system would or would not reply;
- autonomous-send provenance distinct from human approval.

The current main branch also says automation refreshes Engage Next but never sends replies. This mission is explicitly authorized to change that product contract while preserving explicit persisted operator control.

## Dependency gate

A8 is currently modifying shared authority files in the main worktree, including `pipeline.js`, `store.js`, and `web_api.js`.

Do not race those files from the stale `92ccd17` base.

You may inspect/design reply-owned changes while A8 runs. Before changing any shared approval/send/publication authority file:

1. verify A8 has landed a stable commit on `main`;
2. update this branch to that stable `main` state as an explicit part of this mission;
3. inspect the landed contracts again;
4. adapt to current reality rather than reintroducing pre-A8 semantics.

If no stable A8 commit becomes available, checkpoint and report blocked rather than fabricating a parallel authority layer.

## Product model

### 1. Separate reply intent from tone

Do not model "humor" as if it were evidence or substantive technical value.

Create or extend the smallest owner needed to represent a reply strategy with at least:

**Reply intent / contribution**
- technical insight / implementation detail;
- useful question;
- constructive feedback;
- caveat / edge case;
- correction when verified;
- comparison;
- synthesis;
- helpful resource/pointer where grounded;
- lightweight social/playful reaction when the context genuinely supports it.

**Tone**
- direct;
- warm;
- conversational;
- light humor;
- dry wit.

The exact canonical IDs may differ if the existing taxonomy has a better seam. Preserve the conceptual separation.

A humorous tone does not excuse a useless reply. For cold opportunities, require either a real contribution or a contextually appropriate lightweight social response with clear relationship/conversation value.

### 2. Humor must be context-safe

Automatic humor must be conservative about context, not about style.

Do not auto-joke about or at:
- death, injury, disaster, layoffs, harassment, personal vulnerability, or tragedy;
- serious security incidents where humor would trivialize harm;
- private/sensitive personal information;
- protected characteristics;
- an individual's appearance or identity;
- active hostile disputes where wit becomes pile-on behavior.

Light humor may be used for normal developer/product conversation when it is clearly non-degrading and adds social value.

Do not make every humorous reply sarcastic. Do not imitate a specific real person's voice.

### 3. High-momentum and normal tweets are both eligible

Do not require a viral/high-engagement threshold.

The opportunity model should understand at least:

- active conversation / direct response to us;
- high-momentum relevant public X post;
- normal relevant public X post with strong relationship/conversation/contribution value.

Momentum is a distribution feature, not a hard admission gate.

A smaller account/tweet can outrank a viral post when relationship fit or contribution value is better.

### 4. Explicit autonomous-reply grant

Autonomous sending must be **off by default**.

Implement an explicit persisted operator grant/configuration owner. It should make the authority legible and revocable.

The grant must cover the equivalent of:

- enabled / paused;
- dry-run versus live-send mode;
- persistent start/stop semantics: "Start" enables/resumes the loop; it does not mean "run once";
- allowed source classes (active conversation / momentum / normal);
- allowed reply intents;
- allowed tones, including whether light humor is allowed;
- an operator-selected autonomy/send budget;
- an inspectable refresh cadence or equivalent source-refresh policy suitable for continuously discovering new tweets while respecting the existing source/provider rate limits;
- revision / updated-at provenance.

Do not invent a hard-coded "optimal daily reply quota" and do not describe the budget as an X algorithm law.

The budget is an **operator safety/autonomy limit**, not a growth heuristic. If a numerical budget is required for live mode, require the operator to set it explicitly rather than silently choosing one for them.

Do not make "one reply per refresh" an implicit safety budget. If three or four independently eligible opportunities arrive before one refresh and the operator's remaining grant budget permits them, the service may send three or four in that cycle. Conversely, if nothing is worth replying to, it must send zero.

### 5. Autonomous-send eligibility

Live autonomous send should require all applicable conditions, including:

- grant is enabled and in live mode;
- candidate is a real X reply target;
- Growth Focus/relevance permits the topic or an existing explicit human use-anyway decision exists;
- Account Health is not in a supported constrained state that blocks replies;
- opportunity is not expired unless an existing active-conversation override legitimately applies;
- no duplicate send/reply to the same target tweet;
- no exact/near-duplicate reply text;
- no unresolved required media path;
- reply intent/tone is allowed by the grant;
- writing/content gates pass;
- autonomous-specific risk/value gate passes;
- send budget has capacity;
- one atomic claim prevents duplicate sends from concurrent automation cycles.

For ambiguous cases, downgrade to human review rather than auto-send.

Existing WATCH/saturation/repetition diagnostics are not platform laws. However autonomous mode may legitimately be more conservative than human mode: a soft warning can cause "review instead of auto-send" without deleting the opportunity.

Active bidirectional conversation should receive higher consideration than cold reply hunting.

### 6. Preserve human Engage Next

Do not replace the human workflow.

After this mission, there should be two explicit authorities:

**Human-reviewed reply**
- current draft/review/approval/exact-send semantics;
- remains available for any candidate.

**Autonomous reply**
- requires explicit operator grant;
- cannot fake `humanApprovedAt`;
- records its own authority/provenance;
- can only send an exact draft that passed the autonomous eligibility contract.

If practical, factor the transport + successful-recording behavior into one shared low-level owner so human and autonomous sends do not duplicate remote-send bookkeeping.

Do not weaken the human path simply to add autonomous mode.

### 7. Autonomous provenance

Every autonomous decision should remain inspectable.

Persist enough provenance to answer:

- why this tweet was selected;
- source class: active / momentum / normal;
- opportunity/relationship/contribution context;
- chosen reply intent;
- chosen tone;
- generated exact text;
- AI runtime/model/execution provenance when AI wrote the reply;
- deterministic gate results;
- autonomy-grant revision;
- dry-run / live mode;
- why it auto-sent, downgraded to review, or skipped;
- resulting X reply ID/URL when sent.

Do not store private chain-of-thought. Store bounded reasons/decision codes.

### 8. AI behavior

Use the existing AI runtime/provider layer.

Do not create a separate ad hoc model runner.

Prefer a bounded structured reply-strategy/reply-writing contract that uses:

- exact source tweet/thread context available;
- target/relationship context;
- Growth Focus;
- current contribution opportunity;
- recent replies/archetypes to avoid repetition;
- accepted learned rules only through existing owner;
- any applicable writing/viral evidence without treating it as causal truth.

The AI may choose among allowed reply intents/tones, but it may not widen send authority beyond the explicit grant and deterministic eligibility owner.

For `light_humor` / `dry_wit`, require the output to remain understandable even if the joke is ignored. No contextless meme spam.

### 9. Automatic loop

Extend the existing automation lifecycle rather than creating a second daemon when possible.

The autonomous reply loop should conceptually:

```text
operator starts / grant is enabled
        ↓
refresh current X inputs needed by Engage Next
        ↓
discover newly observed active + momentum + normal opportunities
        ↓
dedupe against already-decided / already-replied targets
        ↓
inspect autonomy grant / budget
        ↓
rank eligible opportunities
        ↓
for each independently eligible opportunity, serially:
    re-check current budget + account/relationship state
        ↓
    choose reply intent + tone
        ↓
    generate exact reply
        ↓
    deterministic autonomous eligibility
        ↓
    atomic claim
        ↓
    send one reply
        ↓
    record candidate + relationship + autonomy provenance
        ↓
    decrement/re-read remaining operator grant budget
        ↓
when no more independently eligible opportunities remain
        ↓
wait for the configured/allowed refresh boundary
        ↓
refresh again
        ↓
repeat until paused/stopped/revoked/process stopped
```

Do not add fake-human jitter, circadian delays, or arbitrary behavior designed to evade platform detection.

Process sends serially and re-evaluate state after each send so relationship concentration, account health, duplicate state, and remaining autonomy budget are current.

If no opportunity is strong enough, send nothing and keep the loop active for the next refresh.

The loop must not depend on a ChatGPT/agent session remaining alive. Prefer the repository's existing long-running automation/process owner so the application itself owns continuity. The UI is a control/observability surface, not the process lifetime authority.

Refreshing must actually make new X observations available. Do not implement a loop that repeatedly ranks the same stale local snapshot. Reuse the existing source-refresh/Engage Next owners and provider limits; add only the smallest distinct engagement refresh cadence/state necessary if the current main automation cadence is too slow for the intended feature.

Persist enough decision/watermark state that a restart does not reinterpret every old eligible tweet as newly discovered. A restart may resume an enabled persisted grant, subject to the application's existing process/startup policy, but must remain idempotent with respect to already-decided and already-sent targets.

### 10. Settings and operator visibility

Add the smallest clear UI surface, preferably under Settings and/or Conversations, that allows the operator to:

- see autonomous replies are off/on;
- explicitly Start / Pause / Stop the continuous operator;
- switch dry-run/live mode;
- select allowed source classes;
- select allowed reply intents/tones;
- explicitly configure the safety budget needed for live mode;
- inspect the current refresh cadence/source-refresh state and the last successful refresh;
- pause immediately;
- inspect recent autonomous decisions/sends/skips;
- see why an item was downgraded to human review.

Conversations should distinguish:
- human-review opportunity;
- autonomous dry-run candidate;
- auto-sent reply;
- blocked/skipped autonomous candidate.

Do not bury autonomous sending behind a generic AI toggle.

### 11. Measurement and learning

Reuse existing relationship/candidate-action history and existing measurement owners where applicable.

At minimum make it possible to compare descriptive outcomes by:
- reply intent;
- tone;
- source class (active/momentum/normal);
- relationship stage;
- response/continuation outcome when observed.

Do not auto-promote a permanent strategy rule from a tiny number of replies.

Humor/feedback/question performance is an empirical question, not a platform law.

## Live-send authority for this mission

**No live X reply send is authorized by this mission.**

The user has authorized building the capability, but has not yet supplied a bounded live autonomous-reply send budget for the implementation agent.

Therefore:

- default the product to autonomous replies OFF;
- implement dry-run mode;
- verify selection/generation/provenance without remote X mutation;
- do not send a real reply merely to prove the feature works;
- return the exact UI/control needed for the user to enable a bounded live pilot later.

A separate explicit user instruction may authorize a pilot after integration.

## Ownership

You own the complete autonomous-reply capability after the A8 dependency clears, including:

- reply intent/tone domain contract;
- persisted autonomy grant and provenance;
- autonomous opportunity eligibility;
- dry-run decision read model;
- autonomous generation orchestration;
- atomic live-send authority path distinct from human approval;
- integration with the existing engagement refresh/automation lifecycle;
- Settings/Conversations operator surface;
- documentation updates required because the old invariant "automation never sends replies" is no longer universally true.

Avoid broad unrelated changes.

## Coordination contract

Do not change main-feed publication authority.

Do not rewrite Growth Focus, Writing Strategy, Editorial Director, or A8 Growth Packaging owners unless a tiny adapter is necessary.

If A8 introduces a current strategy-decision or growth-packaging requirement for replies, consume it rather than re-creating a parallel rule.

The final design must preserve:

- main-feed and engagement lanes remain separate;
- human approval remains human when used;
- autonomous authority is explicit and independently inspectable;
- no fake human provenance;
- no duplicate remote sends;
- no arbitrary platform-law claims;

## Success conditions

Do not call this mission complete until all are observable:

1. Existing human Engage Next still works and retains explicit human authority.
2. Autonomous replies are OFF by default.
3. An explicit operator grant can enable dry-run/live mode and can be paused/revoked.
4. Start means a persistent loop, not a one-shot run: after a refresh with zero eligible tweets it remains active and refreshes again until paused/stopped/revoked or the application process stops.
5. One refresh may legitimately produce zero, one, or several autonomous sends. The implementation must not hard-code one send per cycle; it may process multiple independently eligible opportunities serially while grant budget remains.
6. Newly observed tweets become eligible without a human manually clicking Refresh, and stale/already-decided targets are not repeatedly reconsidered as new after each cycle or process restart.
7. Operator must explicitly configure the live autonomy/send budget; no silent quota is invented.
8. High-momentum and normal relevant tweets can both enter autonomous consideration; viral status is not required.
9. Active conversations/direct responses receive appropriate priority without becoming an unconditional auto-send.
10. Reply intent and tone are separately represented.
11. Useful question, constructive feedback, technical insight/caveat/comparison, and light-humor behavior are supported.
12. Humor is context-safe and non-degrading.
13. Autonomous mode can downgrade a candidate to human review instead of forcing a send.
14. Dry-run runs continuously too and explains selection, intent, tone, exact proposed text, and skip/review/send decision without transport mutation.
15. Live path uses an atomic claim/idempotency boundary and cannot duplicate-send the same candidate, including across daemon restarts.
16. Autonomous sends record authority/provenance distinct from `humanApprovedAt`.
17. Candidate action and relationship history are recorded exactly once after a successful send.
18. Settings/Conversations make autonomy state, last refresh, and recent decisions legible.
19. Existing docs describe the explicit grant boundary.
20. No live X reply is sent during this implementation mission without fresh bounded user authorization.

## Required validation

Do not create, modify, or run tests.

Use only directly relevant non-test validation:

- targeted syntax/runtime checks on changed JS files;
- production UI build if UI changes materially;
- `git diff --check`;
- dry-run over real current engagement opportunities;
- browser walkthrough of Settings → autonomy configuration → Conversations decision visibility;
- isolated/local-state exercise proving human and autonomous provenance are distinct;
- atomic claim/idempotency inspection without live X mutation;
- final diff review.

## Out of scope

- automatic follow/unfollow;
- engagement pods;
- fake-human timing/jitter;
- automatic DMs;
- quote/main-feed autonomy redesign;
- decorative media generation;
- declaring humor, questions, hashtags, or momentum to be universally superior;
- live autonomous reply pilot without fresh bounded authorization.

## Working style

Explore the landed repository before deciding implementation details. Prefer existing engagement, store, AI-runtime, transport, account-health, and relationship owners. Do not create a parallel engagement database or second daemon unless the current architecture genuinely cannot express the feature.

Follow current A8 contracts after the dependency clears, even if they differ from this mission's base commit assumptions.

Do not create another worktree. Do not merge this branch into `main`. Return clean commits for central integration.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. dependency resolution and the A8/main commit used as final implementation base;
3. branch and commits created;
4. existing Engage Next behavior preserved;
5. final reply-intent and tone model;
6. autonomy grant/configuration contract;
7. normal/high-momentum/active opportunity-selection behavior;
8. autonomous dry-run behavior;
9. autonomous send authority and idempotency design;
10. human-vs-autonomous provenance distinction;
11. Settings/Conversations UX;
12. documentation changes;
13. non-test validation actually performed;
14. confirmation that no live X reply was sent;
15. unresolved risks before enabling a bounded live pilot.
