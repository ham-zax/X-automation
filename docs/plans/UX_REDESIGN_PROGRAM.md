# Human-Centered UX Redesign Implementation Plan

**Goal:** Redesign the current X growth operating system so a non-technical operator or stakeholder can understand what deserves attention, take the correct next action confidently, and understand outcomes without learning the internal architecture first.

**Architecture:** Preserve the existing workflow, safety, scoring, scheduling, measurement, and learned-strategy engines as the system of record. Introduce a user-goal-oriented presentation shell on top of those owners, using progressive disclosure: simple default language, contextual explanations on demand, and technical diagnostics only when explicitly expanded. Implement the redesign incrementally so current approval, send, scheduling, health, experiment, and learning contracts remain authoritative throughout.

**Tech Stack:** Node.js, built-in HTTP server, server-rendered HTML in `dashboard.js`, Tailwind CSS for the guided visual layer, Bootstrap retained temporarily for legacy grid/component compatibility, SQLite-backed state through `store.js`, existing workflow/scoring owners.

## Global Constraints

- Primary users are ordinary operators and stakeholders, not developers or professional traders.
- Preserve all existing human approval and explicit send boundaries.
- Preserve `AUTO_POST=false` behavior and existing scheduler publication authority.
- Do not weaken content hard gates, Account Health hard evidence, expiry, manual routes, or manual schedule overrides.
- Keep AI recommendations distinguishable from deterministic system rules and human decisions.
- Keep advanced metrics and technical terminology available, but do not require them for ordinary operation.
- No redesign step should require direct SQLite access, JSON configuration, or internal scorer knowledge for common tasks.
- Keep the server-rendered dashboard architecture. Tailwind CSS is the guided visual layer after the Bootstrap-only presentation proved insufficient; retain Bootstrap only where legacy markup still depends on it, and avoid a risky all-at-once frontend rewrite.
- Keep the existing legacy views reachable while the guided UX is rolled out.
- User research and IA validation remain required before treating proposed labels/groupings as final product truth; initial implementation should therefore be reversible and preserve legacy access.

## Product Outcome

The product should answer five questions exceptionally well:

1. What needs my attention?
2. What should I do?
3. Why is the system recommending it?
4. What will happen if I continue?
5. Is what I am doing working?

The target interaction model is:

**simple default -> explanation on demand -> advanced detail on demand**

## Primary Behavioral Roles

### Operator

Uses the product frequently and needs a prioritized work surface: conversations to continue, content to review, posts ready to schedule, and exceptions that require attention.

### Owner / Stakeholder

Needs concise answers about what happened, whether the system is working, what is wrong, what requires a human decision, and what has been learned.

### Advanced Operator

Needs the same everyday workflow plus optional access to scorer breakdowns, evidence, experiment configuration, diagnostics, and overrides.

These are research segments and information-priority models, not separate applications.

## Proposed Information Architecture Hypothesis

The current implementation-oriented navigation is collapsed into six user-goal areas:

- **Today** — what needs attention right now.
- **Discover** — what is worth talking about.
- **Conversations** — who to talk to and what value to add.
- **Create** — what to publish and where it is in the review/publish lifecycle.
- **Results** — whether content, conversations, audience quality, and account health are improving.
- **Improve** — tests, patterns, recommendations, accepted strategy changes, and retired learnings.

The existing detailed screens remain reachable through contextual links and an **Advanced** area during rollout. The six labels are a design hypothesis until card sorting/tree testing validates them.

## Plain-Language Translation Layer

Default UI language should prefer user goals over internal architecture:

| Internal term | Default UI language |
|---|---|
| Queue | To review |
| Route | Use this as... |
| Pipeline | Content type |
| Engage Next | Conversations |
| TargetScore | Relationship fit |
| EngagePriority | Reply priority |
| SaturationPressure | Recent interaction level |
| WATCH | Needs attention |
| CONSTRAINED | Some actions are temporarily limited |
| Experiment | Test |
| Learned Strategy | What we've learned |
| directional | Promising - needs more evidence |
| repeated | Consistent pattern - still observational |
| attribution confidence | How isolated this result was |

Internal names remain visible under **Technical details** where they are useful for auditability.

## Human-AI Interaction Contract

Every recommendation surface should make the following understandable without requiring technical knowledge:

- what the AI recommended;
- why the recommendation appeared;
- what deterministic rule or hard gate applies;
- what the human is deciding;
- whether an action sends/publishes now, merely approves, or waits;
- how to dismiss/correct the recommendation;
- what evidence supports a learned suggestion;
- what will change if a learned suggestion is accepted;
- what the system will never do automatically from that action.

Explanations should inform rather than persuade. Uncertainty, sample size, and observational limitations stay visible when relevant.

# Research and Design Program

### Task 1: Current-State Baseline Audit

**Files:**
- Create: `docs/ux/CURRENT_STATE_AUDIT.md`
- Inspect: `dashboard.js`

**Interfaces:**
- Consumes: current navigation, screens, actions, states, warnings, errors, and system terminology.
- Produces: current-state IA/action/state inventory and severity-ranked baseline heuristic findings.

**Steps:**
- [ ] Inventory every current top-level destination and the primary/secondary actions exposed on each.
- [ ] Map consequential states visible to users: draft/review/approved/publishing/published/failed, Account Health state, experiment evidence state, learned-rule status, and AUTO_POST state.
- [ ] Record terminology that exposes implementation architecture or requires scorer/domain knowledge.
- [ ] Perform a baseline heuristic review focused on system status, real-world language, recognition vs recall, error prevention, recovery, consistency, and information density.
- [ ] Perform baseline cognitive walkthroughs for five representative tasks: reply to a conversation, review/approve a post, understand a publishing block, understand recent performance, and evaluate a learned recommendation.

**Acceptance criteria:**
- Every current primary screen/action/state has an explicit inventory entry.
- P0/P1 usability defects are stated as observable user failures rather than aesthetic opinions.

### Task 2: Research Framing and Task Analysis

**Files:**
- Create: `docs/ux/RESEARCH_PLAN.md`
- Create: `docs/ux/TASK_ANALYSIS.md`

**Interfaces:**
- Consumes: current-state audit and the three behavioral roles.
- Produces: research questions, recruitment criteria, user-language task hierarchy, task frequency/criticality, and terminology evidence.

**Steps:**
- [ ] Frame research around actual user goals, not current module names.
- [ ] Define interview/observation prompts for operators and stakeholders.
- [ ] Capture tasks such as finding something worthwhile, continuing a conversation, creating/reviewing content, approving/publishing, understanding blocks, understanding outcomes, creating a test, and deciding whether to accept a learned recommendation.
- [ ] Distinguish frequent operator tasks from occasional stakeholder/advanced tasks.
- [ ] Record terms users naturally use before showing them internal product vocabulary.

**Acceptance criteria:**
- Core product tasks can be described without Queue/Pipeline/TargetScore/EngagePriority/Experiment terminology.
- Proposed terminology remains explicitly provisional until user evidence exists.

### Task 3: Journey Maps and Service Blueprint

**Files:**
- Create: `docs/ux/USER_JOURNEYS.md`
- Create: `docs/ux/SERVICE_BLUEPRINT.md`

**Interfaces:**
- Consumes: task analysis and existing workflow/state contracts.
- Produces: operator journey, stakeholder journey, cross-session journey, and frontstage/backstage state blueprint.

**Steps:**
- [ ] Map the operator backbone: Orient -> Discover -> Decide -> Converse/Create -> Review -> Act -> Understand result -> Improve.
- [ ] Map the stakeholder backbone: Orient -> Understand status -> Understand outcomes -> Identify problems -> Understand learning -> Decide on intervention.
- [ ] Map multi-session flows for delayed scheduling, publication, measurement windows, experiment accumulation, and later learned recommendations.
- [ ] For consequential steps, pair visible UI state with backstage engine/state transitions so `approved`, `ready`, `scheduled`, `publishing`, and `published` cannot be conflated.

**Acceptance criteria:**
- Every major delayed/background state has a visible re-entry/status expectation.
- Approval vs scheduling vs actual publication is unambiguous in the blueprint.

### Task 4: Task Flows and User Flows

**Files:**
- Create: `docs/ux/USER_FLOWS.md`

**Interfaces:**
- Consumes: task hierarchy, journey maps, service blueprint.
- Produces: Mermaid happy paths plus decision/error/recovery branches for the ten core jobs.

**Steps:**
- [ ] Map each core goal as a simple task flow first.
- [ ] Add decisions, validation failures, blocked states, retry/recovery, explicit exits, and session boundaries.
- [ ] Annotate likely friction/risk points and metrics to observe later without inventing target percentages.
- [ ] Ensure every branch terminates in success, recovery, explicit wait, or exit.

**Acceptance criteria:**
- Core flows cover conversation, creation, approval/publication, blocked-state comprehension, Results, Account Health, Tests, and learned recommendations.

### Task 5: IA Validation

**Files:**
- Create: `docs/ux/IA_VALIDATION.md`

**Interfaces:**
- Consumes: proposed six-area IA and user-language task hierarchy.
- Produces: card-sorting plan, tree-testing tasks, accepted/rejected navigation labels, and final IA recommendation.

**Steps:**
- [ ] Treat Today/Discover/Conversations/Create/Results/Improve as a hypothesis.
- [ ] Define open/closed card-sorting prompts around real content/tasks.
- [ ] Define tree-test questions such as finding audience quality, continuing a conversation, reviewing a post, and understanding a learned recommendation.
- [ ] Record unresolved placements such as Audience/Relationships rather than forcing them prematurely.

**Acceptance criteria:**
- Primary navigation is backed by observed findability evidence before legacy navigation is removed.

### Task 6: Content Design and Human-AI Patterns

**Files:**
- Create: `docs/ux/PRODUCT_LANGUAGE.md`
- Create: `docs/ux/HUMAN_AI_INTERACTION.md`

**Interfaces:**
- Consumes: terminology evidence, existing hard boundaries, AI/deterministic/human ownership.
- Produces: product language system and reusable recommendation/explanation/status patterns.

**Steps:**
- [ ] Define screen names, action verbs, status language, warning/error/success language, AI recommendation language, and technical-detail labels.
- [ ] Define one recommendation-card anatomy: What / Why now / What you can add / Primary action / Secondary action / Why? / Technical details.
- [ ] Define how approval, scheduling, sending, and publication are worded so users can predict the consequence before clicking.
- [ ] Define how learned recommendations explain evidence, uncertainty, proposed effect, and what acceptance cannot override.

**Acceptance criteria:**
- A normal workflow can be completed using default language without internal scorer or database terminology.
- AI suggestion, deterministic rule, and human decision are visually/textually distinguishable.

### Task 7: Low-Fidelity Wireflows

**Files:**
- Create: `docs/ux/WIREFLOWS.md`

**Interfaces:**
- Consumes: validated flows, provisional/final IA, language/Human-AI patterns.
- Produces: connected low-fi wireflows for Today, Conversations, Create, Results, and Improve.

**Steps:**
- [ ] Design Today around `Needs a decision`, `Worth doing`, and `For awareness`, with human-required actions first.
- [ ] Design Conversations around active threads and specific contribution before technical scores.
- [ ] Design Create around idea -> content type -> draft -> review -> facts/evidence -> approval -> publication timing/status.
- [ ] Design Results around understandable outcomes before raw analytics.
- [ ] Design Improve around simple Tests and `What we've learned`, with advanced experiment/rule mechanics behind disclosure.

**Acceptance criteria:**
- Core tasks are possible without navigating through legacy module boundaries.
- One dominant next action is visually obvious on each primary card.

### Task 8: Prototype Expert Evaluation

**Files:**
- Modify: `docs/ux/WIREFLOWS.md`
- Create: `docs/ux/PROTOTYPE_EVALUATION.md`

**Interfaces:**
- Consumes: low-fi prototype/wireflows.
- Produces: second cognitive walkthrough and prototype heuristic issue matrix.

**Steps:**
- [ ] Repeat the baseline task set on the proposed design.
- [ ] Record failures using goal visibility, action visibility, action-goal mapping, and feedback comprehension.
- [ ] Rank prototype defects P0-P3 and repair P0/P1 design defects before usability sessions.

**Acceptance criteria:**
- No known P0/P1 learnability defect remains in the prototype before user testing.

### Task 9: Usability Sessions

**Files:**
- Create: `docs/ux/USABILITY_SESSION_GUIDE.md`
- Create: `docs/ux/USABILITY_FINDINGS.md`

**Interfaces:**
- Consumes: prototype and representative users.
- Produces: observed task success, wrong-path behavior, backtracking, assistance, terminology failures, action prediction, and recommendation comprehension.

**Steps:**
- [ ] Run realistic operator tasks without coaching.
- [ ] Run stakeholder comprehension tasks separately.
- [ ] Ask `What do you think will happen if you click this?` before consequential actions.
- [ ] Record where users disagree with AI and whether correction/dismissal is obvious.
- [ ] Do not convert isolated preference comments into requirements unless they reveal a task/comprehension failure.

**Acceptance criteria:**
- Key workflows can be completed without coaching and users correctly predict consequential actions.

### Task 10: User Story Map and Delivery Slices

**Files:**
- Create: `docs/ux/UX_STORY_MAP.md`

**Interfaces:**
- Consumes: validated journeys and usability findings.
- Produces: P0/P1/P2 backlog organized by user journey.

**Steps:**
- [ ] Use Orient -> Discover -> Decide -> Converse/Create -> Review -> Act -> Understand result -> Improve as the backbone.
- [ ] Place implementation stories beneath the activity they enable, not beneath source files/modules.
- [ ] Slice releases by user value and preserve existing backend owners.

**Acceptance criteria:**
- Engineering order follows validated user value rather than dashboard module order.

# Incremental Implementation Program

### Task 11: UX Release 1 - Guided Shell

**Implementation status (2026-08-19):** complete. The dashboard defaults to Today, uses goal-oriented primary navigation, keeps every legacy view reachable through section navigation/Advanced, prioritizes human-required work, and applies a plain-language/progressive-disclosure shell without changing backend authority. Terminology and IA remain research hypotheses for later user validation.

**Files:**
- Modify: `dashboard.js`
- Modify: `README.md`
- Modify: `docs/AGENT_WORKFLOW.md` only where operator-facing navigation descriptions change.

**Interfaces:**
- Consumes: existing dashboard views and store/read APIs.
- Produces: new Today homepage, goal-oriented primary navigation, plain-language labels, contextual Advanced access, and clearer status/next-action copy.

**Steps:**
- [x] Add `Today` as the default dashboard source without deleting any legacy route.
- [x] Replace the 16-item primary navigation with Today / Discover / Conversations / Create / Results / Improve / Advanced.
- [x] Keep current detailed views reachable through secondary navigation inside their new parent area or Advanced.
- [x] Build Today entirely from existing read APIs; do not create new persistence or scoring behavior for Release 1.
- [x] Prioritize human-required decisions first, then useful recommendations, then awareness/status.
- [x] Translate primary user-facing labels while retaining internal terms in expandable/secondary technical details.
- [x] Make approval/publishing status language explicitly say whether content is merely approved, waiting, scheduled, publishing, or published.

**Acceptance criteria:**
- A user opening `/` sees Today rather than a raw research feed.
- Every existing legacy dashboard view remains reachable.
- Everyday primary navigation is organized around user goals rather than implementation modules.
- Existing actions call the same workflow owners as before; no approval/send/publish semantics change.

### Task 12: UX Release 2 - Daily Work Journeys

**Files:**
- Modify: `dashboard.js`
- Modify: operator-facing docs where labels/routes change.

**Interfaces:**
- Consumes: existing Engage Next, relationship, drafting, queue, review, and scheduling contracts.
- Produces: redesigned Conversations and Create journeys.

**Steps:**
- [ ] Merge Active Conversations, new engagement opportunities, and contextual relationship evidence into one Conversations experience.
- [ ] Put contribution/action first and technical scores behind disclosure.
- [ ] Reframe Queue + Drafts + scheduler into Create lifecycle sections: Ideas / Drafting / Needs review / Approved or ready / Published.
- [ ] Use one dominant action per item and move alternative actions under secondary controls.
- [ ] Keep exact human-approved reply and main-feed approval boundaries unchanged.

**Acceptance criteria:**
- Frequent operator tasks no longer require understanding Queue vs Drafts vs Engage Next as separate system modules.

### Task 13: UX Release 3 - Results and Stakeholder Experience

**Files:**
- Modify: `dashboard.js`
- Modify: operator-facing docs where labels/routes change.

**Interfaces:**
- Consumes: Performance, Account Health, audience, relationship, and measurement summaries.
- Produces: Results experience optimized for comprehension before diagnostics.

**Steps:**
- [ ] Present recent content/conversation/audience outcomes as plain-language summaries first.
- [ ] Present Account Health as `Everything looks normal`, `Needs attention`, or `Some actions are temporarily limited`, with provenance/technical state available underneath.
- [ ] Present newly observed relevant follower quality and relationship progression without causal overclaiming.
- [ ] Keep raw fixed-window metrics and health evidence accessible under detailed views.

**Acceptance criteria:**
- A stakeholder can answer what happened, whether it worked, whether something is wrong, and what needs intervention without opening technical details.

### Task 14: UX Release 4 - Improve

**Files:**
- Modify: `dashboard.js`
- Modify: operator-facing docs where labels/routes change.

**Interfaces:**
- Consumes: existing experiment and learned-rule APIs.
- Produces: simple Tests and `What we've learned` journeys with advanced mechanics secondary.

**Steps:**
- [ ] Replace default experiment creation fields with guided questions: what to learn, options to compare, success metric, applicable audience/context.
- [ ] Keep explicit experiment assignment and non-random semantics visible in confirmation/status copy.
- [ ] Present learned suggestions as finding -> evidence quality/sample -> suggested change -> what changes if accepted -> Accept / Not now / Why.
- [ ] Keep exact experiment summary, evidence state, confounders, match context, rule adjustment, mechanism tags, and retirement controls under explanation/advanced detail.

**Acceptance criteria:**
- A non-technical user can understand and act on tests and learned recommendations without experiment/scorer terminology.
- Accepting a learned recommendation still uses the existing explicit human transition and bounded production application.

### Task 15: Measurement and Iteration

**Files:**
- Create or modify: `docs/ux/UX_OUTCOME_REPORT.md`

**Interfaces:**
- Consumes: baseline tasks and post-release observations.
- Produces: before/after UX outcome report.

**Steps:**
- [ ] Compare task completion, first-click success, wrong-path actions, backtracking, assistance required, error recovery, action prediction, terminology failures, delayed-state comprehension, recommendation comprehension, and stakeholder comprehension.
- [ ] Do not optimize time-on-task when faster behavior reduces comprehension or control.
- [ ] Use findings to reprioritize the story map rather than adding cosmetic work by taste.

**Acceptance criteria:**
- Major redesign claims are supported by observed behavior rather than visual preference alone.

# Release Sequence

1. **UX 1 - Guided shell:** Today, goal-oriented navigation, plain language, status hierarchy, Advanced disclosure.
2. **UX 2 - Daily work:** Conversations + Create + Review + Publish.
3. **UX 3 - Understand results:** Results + Health + Audience + Relationships.
4. **UX 4 - Improve:** Tests + What we've learned.

# Definition of Done

A first-time non-technical operator can:

1. understand what needs attention;
2. identify a worthwhile conversation;
3. prepare/review a reply;
4. understand exactly when sending occurs;
5. prepare and approve a post;
6. understand why something is blocked;
7. understand whether recent work performed well;
8. recognize when account health deserves attention;
9. understand a test without experiment terminology;
10. accept/reject a learned recommendation without understanding scoring internals;
11. distinguish an AI recommendation from a human decision;
12. recover when an AI recommendation is wrong;
13. understand whether approved means ready, scheduled, publishing, or published;
14. understand what will change before accepting a learned recommendation.

A stakeholder can answer within a few minutes:

- What happened?
- Is it working?
- Is anything wrong?
- What needs a human decision?
- What are we learning?
- How certain are we?

without requiring technical-detail views.

# Explicitly Out of Scope for the UX Redesign

- Replacing the current backend/scoring architecture solely for visual simplicity.
- Weakening human approval or explicit send/publish controls.
- Automated likes/follow churn/batch unsolicited replies.
- Fake-human timing/jitter or hidden account-risk scoring.
- Randomized or duplicate-post A/B testing.
- Media upload/attachment readiness unless separately commissioned.
- New frontend frameworks/dependencies unless the existing rendering model later blocks a validated UX requirement.
