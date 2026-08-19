# Current-State UX Audit

**Date:** 2026-08-19

**Product:** local X growth workspace

**Audience assumption:** ordinary operators and stakeholders should be able to use the system without understanding developer tooling, professional-trading interfaces, SQLite, internal scorer names, or workflow implementation details.

## Current IA Inventory

Before the guided-shell work, the dashboard exposed these implementation-oriented destinations at the same navigation level:

- X posts
- Viral
- Saved
- Queue
- Engage Next
- Drafts
- Opportunities
- Relationships
- Account Health
- Audience
- Performance
- Experiments
- Learned Strategy
- GitHub
- Hacker News
- All

The underlying product capabilities are coherent, but the navigation mirrors code/domain owners rather than user goals.

## Primary User Jobs Found in the Current Product

1. Find something worth talking about.
2. Continue an existing conversation.
3. Decide whether a new conversation is worth entering.
4. Turn a signal into an original, quote, thread, or reply.
5. Review AI-produced content.
6. Understand why content is blocked.
7. Approve content without confusing approval with publication.
8. Understand when an approved post will publish.
9. Understand recent content and audience outcomes.
10. Understand whether account health needs intervention.
11. Create and inspect a test.
12. Decide whether to accept or retire a learned recommendation.

## Consequential State Inventory

### Content workflow

- triage
- researching
- drafting
- needs_review
- approved
- publishing
- published
- watching
- ignored
- expired
- failed

### Main-feed publication

Approval, scheduler timing, optional human timing override, publication claim, remote write, and persisted publication result are separate states. `AUTO_POST=false` means an approved/due recommendation does not automatically produce a transport write.

### Engagement replies

Reply drafting/review and explicit send remain separate from the main-feed scheduler. The exact approved reply text is the send boundary.

### Account Health

- HEALTHY
- WATCH
- CONSTRAINED

WATCH is advisory. CONSTRAINED requires supported observed evidence or an explicit provenance-backed hard constraint.

### Experiments

Evidence progresses:

- insufficient
- preliminary
- directional
- repeated

Even repeated evidence remains observational rather than causal.

### Learned Strategy

- suggested
- accepted
- retired

Suggested and retired rules have zero production effect. Accepted rules are bounded and cannot bypass hard gates, expiry, human approval, or explicit manual route/schedule choices.

## Baseline Heuristic Findings

### P0 - Consequential state comprehension

**Risk:** Internal workflow terminology can make approval, scheduling, readiness, and actual publication appear closer together than they are.

**Required repair:** User-facing status copy must state whether content is only approved, waiting for timing, publishing, or already published. Any action that sends/publishes immediately must say so before the click.

### P0 - Architecture-first navigation

**Risk:** A new user must understand Queue vs Drafts vs Engage Next vs Relationships vs Performance vs Experiments vs Learned Strategy before they can predict where common work lives.

**Required repair:** Primary navigation should follow user goals; legacy domain views remain reachable as secondary/advanced detail.

### P1 - Internal terminology as default language

Examples include Queue, Route, Pipeline, TargetScore, EngagePriority, SaturationPressure, Experiment, evidence-state labels, and mechanism tags.

**Required repair:** Use plain-language defaults and expose internal terminology under contextual technical details.

### P1 - Equal visual weight for primary and secondary actions

Several cards can expose save, source, routing, drafting, review, ignore, quote, timing, and other controls together.

**Required repair:** Each card should identify one dominant next action; alternatives stay available but visually secondary.

### P1 - Explanation density

The system has strong transparent reasoning, but exposing all score components and technical state at once increases cognitive load.

**Required repair:** Default to recommendation + reason + consequence, then progressive disclosure for score/evidence details.

### P1 - Tests require implementation knowledge

Experiment setup exposes dimensions, variants, metrics, population/configuration concepts that are appropriate for advanced operation but not ordinary use.

**Required repair:** Default test creation should ask what the user wants to learn, what to compare, what success means, and when the test applies. Exact experiment configuration remains available underneath.

### P1 - Learned Strategy requires scoring knowledge

Current learned-rule detail is transparent but asks ordinary users to reason about baseline/comparison, evidence state, adjustment targets, match context, and mechanism tags before understanding the product recommendation.

**Required repair:** Lead with finding, evidence quality/sample, suggested change, and what will change if accepted. Technical evidence remains expandable.

### P2 - Stakeholder view is fragmented

A stakeholder must currently combine Performance, Account Health, Audience, Relationships, Experiments, and Learned Strategy mentally.

**Required repair:** Results/Improve should summarize the answers first, then link to diagnostic detail.

## Baseline Cognitive Walkthroughs

### Task: Continue a conversation

**Goal recognition:** The user must infer that Engage Next is the relevant destination.

**Action visibility:** Once inside Engage Next, useful controls exist, but multiple metrics and actions compete with the core decision.

**Action-goal mapping:** Internal scores explain prioritization but do not naturally state `why reply now` in ordinary language.

**Feedback:** Explicit approval/send boundaries are strong and should be preserved.

### Task: Review and approve a post

**Goal recognition:** Queue and Drafts split the lifecycle across implementation owners.

**Action visibility:** Review and approval controls exist.

**Action-goal mapping:** `approved`, compatibility `ready`, scheduler state, and AUTO_POST require system knowledge.

**Feedback:** Deterministic gates are transparent, but `hard gate` terminology should be secondary to the user-facing fix/ready message.

### Task: Understand why publishing is blocked

**Goal recognition:** The user can find gate/scheduler blockers, but they are distributed across Drafts and Queue.

**Action visibility:** The system exposes exact failures and warnings.

**Action-goal mapping:** Technical codes are useful for diagnostics but should not be the first explanation.

**Feedback:** Strong underlying state; presentation should say exactly what the user must change next.

### Task: Understand recent performance

**Goal recognition:** Performance is discoverable only if the user already knows that is the reporting area.

**Action visibility:** Fixed-window measurements and attribution context are available.

**Action-goal mapping:** Rates, confidence, follower deltas, and health context need a plain-language summary before diagnostics.

### Task: Evaluate a learned recommendation

**Goal recognition:** Learned Strategy is an internal-domain label rather than a user question.

**Action visibility:** Accept/retire controls are explicit.

**Action-goal mapping:** Users need a direct `what will change if I accept?` explanation.

**Feedback:** The existing zero-effect-before-acceptance and bounded-rule semantics are strong and should remain unchanged.

## Guided-Shell Hypothesis

Primary navigation:

- Today
- Discover
- Conversations
- Create
- Results
- Improve
- Advanced

Grouped legacy views stay reachable through section navigation or Advanced.

The grouping is intentionally reversible and remains a hypothesis until user/card-sort/tree-test evidence validates it.

## Release-1 Success Conditions

- `/` opens Today.
- Today prioritizes decisions and actionable work rather than raw modules.
- Primary navigation is goal-oriented.
- Every existing legacy view remains reachable.
- No workflow/scoring/persistence/send/publish behavior changes.
- Plain-language state labels are default; technical detail remains accessible.
- Account-health and automation state remain visible without dominating the workspace.
