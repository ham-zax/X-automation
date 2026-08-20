# Low-Fidelity Wireflows — Desktop and Phone

**Scope:** connected, testable low-fidelity screens for the Wave-2 UX research program. These are prototype stimuli, not production designs, validated participant preferences, or a final IA.

The wireflows preserve the current backend authority model while changing hierarchy and action presentation where Wave 1 identified P1 comprehension/recovery problems.

## Legend

- **[RO]** current repository capability/authority.
- **[P]** prototype presentation or recomposition to test.
- **[F]** future capability not currently implemented.
- **[H1] / [H2]** alternate navigation hypotheses.
- `ACTION -> effect` means the effect must be understandable **before** activation.
- `... later ...` marks a cross-session/background boundary.

Exact user-facing wording in the boxes is provisional unless it expresses a frozen authority fact such as “not published yet” or the canonical `off|suggest|apply` behavior.

## What is intentionally not designed here

- final colors, typography, spacing, icons, animation, or component library;
- a final desktop navigation style;
- a final phone navigation component;
- final names for H1/H2 children or writing-strategy modes;
- a new backend reconciliation mutation;
- any participant-derived ranking or preference.

## Common prototype patterns

### 1. Decision card anatomy [P]

Every consequential card exposes the four frozen questions before the action:

```text
+----------------------------------------------------+
| WHAT                                               |
| Concrete work item / recommendation / failure      |
|                                                    |
| WHY NOW                                            |
| Reason, freshness, blocker, or obligation          |
|                                                    |
| WHAT CAN I DO                                      |
| Primary action + secondary alternatives            |
|                                                    |
| WHAT HAPPENS NEXT                                  |
| Immediate effect; public side effect if any        |
+----------------------------------------------------+
```

### 2. Object lifecycle strip [P]

Use the same sequence anywhere a post is summarized or opened:

```text
Draft -> Needs review -> Approved / waiting -> Publishing -> Published
                                                 \-> Failed / reconcile
```

The current step is shown by position plus text, not by color alone. `Approved / waiting` must say **not public yet**.

### 3. Recovery block [P]

```text
+----------------------------------------------------+
| NEEDS RECOVERY                                     |
| Operation: <what failed>                           |
| Remote effect: none / may have happened / known    |
| Current authoritative state: <state>               |
| Safe retry: yes / no / not yet known               |
| Next step: <read, fix, wait, inspect, escalate>     |
|                                                    |
| [safe action]     [secondary read-only action]      |
| (No resend/publish control while remote uncertain) |
+----------------------------------------------------+
```

### 4. Evidence provenance labels [P]

A comparison can visually align evidence, but it never collapses ownership:

```text
[EXTERNAL] comparable niche posts
[OUR ACCOUNT] observed outcomes for this account
[TEST] explicit declared comparison
```

Each lane carries its own time/sample/evidence-strength/limitations summary.

---

# A. Shell wireflows — H1 and H2 remain separate stimuli

## Desktop shell H1 [P/RH]

```text
+--------------------------------------------------------------------------------+
| Today | Discover | Conversations | Posts | Results                             |
+--------------------------------------------------------------------------------+
| Page content                                                                   |
+--------------------------------------------------------------------------------+

Results sections:
Overview | Audience | Recent outcomes | External patterns | Own patterns | Tests |
Strategy recommendations | More (AI / niche / diagnostics)
```

**Testable risk:** Results may become a catch-all and technical settings may feel misplaced.

## Desktop shell H2 [P/RH]

```text
+--------------------------------------------------------------------------------+
| Today | Discover | Conversations | Posts | Results | Learn        | Advanced    |
+--------------------------------------------------------------------------------+
| Page content                                                                   |
+--------------------------------------------------------------------------------+

Learn sections:
External patterns | Own-account evidence | Tests | Strategy recommendations
```

**Testable risk:** `Learn` may be interpreted as tutorials/help or may make separate evidence lanes feel like one AI score.

## Phone shell H1 [P/RH]

Exact compact-navigation mechanic is intentionally unspecified.

```text
+------------------------------+
| <Page title>            [Nav] |
+------------------------------+
| page content                  |
|                              |
+------------------------------+

[Nav]
Today
Discover
Conversations
Posts
Results
```

H1 secondary evidence/settings are reached from the Results section list.

## Phone shell H2 [P/RH]

```text
+------------------------------+
| <Page title>            [Nav] |
+------------------------------+
| page content                  |
|                              |
+------------------------------+

[Nav]
Today
Discover
Conversations
Posts
Results
Learn
Advanced / Settings
```

**Research rule:** use the same compact-navigation mechanic for H1 and H2 in a comparison round. Change only the hierarchy being tested.

---

# 1. Today wireflow — obligations versus advisory Editorial Plan

## Desktop

### [D-T1] Today orientation [P]

```text
+--------------------------------------------------------------------------------+
| TODAY                                                     Find new signals     |
| 2 decisions need you                                                           |
+--------------------------------------------------------------------------------+
| NEEDS YOUR DECISION                                                           |
|                                                                                |
| +--------------------------------------+  +----------------------------------+ |
| | Review a post                        |  | Continue a conversation          | |
| | State: Needs review                  |  | @builder replied                 | |
| | Why now: exact blockers resolved     |  | Why now: active conversation     | |
| | [Review exact draft]                 |  | [Open conversation]              | |
| | Next: opens review; nothing publishes|  | Next: opens context; nothing sends| |
| +--------------------------------------+  +----------------------------------+ |
+--------------------------------------------------------------------------------+
| ADVISORY OPPORTUNITIES                                                         |
| Optional AI recommendations. Selecting one is a workflow choice, not approval. |
|                                                                                |
| +--------------------------------------------------------------------------+   |
| | Original recommended: <story>                                            |   |
| | Why now: ...   Evidence: ...                                             |   |
| | [Use as Original] [Choose another type] [Dismiss]                        |   |
| | Next: selects the work and opens preparation. No draft is generated yet. |   |
| +--------------------------------------------------------------------------+   |
+--------------------------------------------------------------------------------+
| ACCOUNT / OUTCOME SNAPSHOT                                                     |
| Account status: Normal      Next approved post: 15:30 (not public yet)          |
+--------------------------------------------------------------------------------+
```

Connections:

```text
[D-T1] Review exact draft --------> [D-P2] Draft review
[D-T1] Open conversation ---------> [D-C2] Conversation detail
[D-T1] Use as Original -----------> [D-P2a] Draft preparation (empty/scaffold state)
[D-T1] Choose another type -------> [D-D2] Content-type selection
[D-T1] Find new signals ----------> [D-D1] Discover
```

**P1 repair under test:** obligations are a distinct primary region; advisory recommendations remain useful but cannot visually masquerade as the queue counted by Today.

## Phone

### [P-T1] Today orientation [P]

```text
+------------------------------+
| TODAY                   [Nav]|
| 2 decisions need you         |
+------------------------------+
| NEEDS YOUR DECISION          |
|                              |
| Review a post                |
| Needs review                 |
| Why now: ready for decision  |
| [Review exact draft]         |
| -> Opens review only         |
|    Nothing publishes        |
+------------------------------+
| Continue a conversation      |
| @builder replied             |
| [Open conversation]          |
| -> Nothing sends            |
+------------------------------+
| ADVISORY OPPORTUNITIES       |
| Optional recommendation      |
| Original: <story>            |
| [Use as Original]            |
| [Other type] [Dismiss]       |
| -> Selects work only         |
|    No draft generated yet    |
+------------------------------+
| Account: Normal              |
| Next post: waiting, 15:30    |
+------------------------------+
```

Connections mirror desktop:

```text
[P-T1] Review exact draft -> [P-P2]
[P-T1] Open conversation  -> [P-C2]
[P-T1] Use as Original    -> [P-P2a]
[P-T1] Find new signals   -> [P-D1]
```

**Phone test:** ask which item already requires a decision before allowing scrolling past the advisory section.

---

# 2. Discover wireflow — consistent route/select versus generation consequences

## Desktop

### [D-D1] Discover signals [P over RO capability]

```text
+--------------------------------------------------------------------------------+
| DISCOVER                          Source: [For you v]   Topic: [All v]           |
| Snapshot: 12:05                  [Refresh source -> fetches source only]         |
+--------------------------------------------------------------------------------+
| <candidate title>                                                            |
| Source / freshness / brief niche context                                      |
| Source text...                                                                |
|                                                                                |
| Recommended treatment: Quote   Why: additive commentary opportunity           |
|                                                                                |
| [Choose what this becomes]  [Bookmark]  [Skip source]  [Open source]           |
+--------------------------------------------------------------------------------+
| <next candidate>                                                               |
+--------------------------------------------------------------------------------+
```

### [D-D2] Choose treatment [P]

```text
+--------------------------------------------------------------+
| WHAT SHOULD THIS BECOME?                                     |
|                                                              |
| ( ) Original   ( ) Thread   ( ) Quote   ( ) Reply            |
| ( ) Repost     ( ) Research ( ) Pause   ( ) Skip             |
|                                                              |
| Selected: Quote                                              |
| What happens next:                                           |
| - records Quote as your workflow choice                      |
| - opens preparation                                          |
| - does NOT generate copy yet                                 |
| - does NOT approve, send, or publish                         |
|                                                              |
| [Select Quote]    [Cancel]                                   |
+--------------------------------------------------------------+
```

Connections:

```text
[D-D1] Choose what this becomes -> [D-D2]
[D-D2] Original/Thread/Quote ------> [D-P2a] Draft preparation
[D-D2] Reply ----------------------> [D-C2] Conversation detail / reply prep
[D-D2] Repost ---------------------> [D-P6] Repost preparation
[D-D2] Research -------------------> [researching state / evidence task]
[D-D2] Pause/Skip -----------------> [D-D1] with On hold/Skipped state
```

### [D-P2a] Authored draft before generation [P recomposition]

```text
+--------------------------------------------------------------------------------+
| < Back to Posts       QUOTE POST                                  Draft          |
| Lifecycle: [Draft] -> Needs review -> Approved/waiting -> Publishing -> Published|
+--------------------------------------------------------------------------------+
| Source: <X post>                                                               |
| Selected type: Quote                                                           |
|                                                                                |
| No generated text yet.                                                         |
| [Generate draft]                                                               |
| -> AI will create editable commentary. Nothing is approved or public.           |
+--------------------------------------------------------------------------------+
```

**P1 repair under test:** Today and Discover no longer use the same “Draft” word for different effects. Selecting/routing is one visible concept; generation is another. This recomposes existing route and generation authorities and does not imply a new API.

## Phone

### [P-D1] Discover candidate

```text
+------------------------------+
| DISCOVER                [Nav]|
| For you v   All topics v     |
| Snapshot 12:05 [Refresh]     |
+------------------------------+
| <candidate>                  |
| source / freshness           |
| text...                      |
|                              |
| Suggested: Quote             |
| Why: ...                     |
| [Choose treatment]           |
| [Bookmark] [Skip]            |
+------------------------------+
```

### [P-D2] Treatment sheet/page [P]

```text
+------------------------------+
| CHOOSE TREATMENT             |
| Original    Thread           |
| Quote       Reply            |
| Repost      Research         |
| Pause       Skip             |
|                              |
| Quote selected               |
| Next: saves this choice and  |
| opens preparation.           |
| No copy generated yet.       |
| [Select Quote]               |
+------------------------------+
```

`[P-D2] -> [P-P2a]` for authored posts, `[P-C2]` for Reply, or `[P-P6]` for Repost.

---

# 3. Conversations wireflow — exact send authority and safe recovery

## Desktop

### [D-C1] Conversations list [P over RO]

```text
+--------------------------------------------------------------------------------+
| CONVERSATIONS                                                                  |
| Continue existing discussions before weaker new opportunities.                 |
+--------------------------------------------------------------------------------+
| ACTIVE                                                                         |
| @builder     Waiting for your reply        What you can add: <contribution>     |
| [Review reply]                                                                 |
+--------------------------------------------------------------------------------+
| NEW OPPORTUNITIES                                                              |
| @researcher  Fresh opportunity             What you can add: <contribution>     |
| [Review opportunity]                                                           |
+--------------------------------------------------------------------------------+
```

### [D-C2] Conversation detail [P over RO]

```text
+--------------------------------------------------------------------------------+
| < Conversations      @builder                              State: Draft          |
| Reply lifecycle: Draft -> Needs review -> Approved -> Sending -> Sent           |
+--------------------------------------------------------------------------------+
| WHAT YOU CAN ADD                                                              |
| <plain-language contribution>                                                  |
|                                                                                |
| SOURCE / RELATIONSHIP                                                          |
| source text...                     relationship context...                      |
+--------------------------------------------------------------------------------+
| REPLY TEXT                                                                     |
| <editable reply>                                                               |
| [Save changes] [Regenerate]                                                    |
+--------------------------------------------------------------------------------+
| READINESS                                                                      |
| [ ] I checked the facts      [ ] I checked supporting proof (when required)     |
| [Check readiness]                                                              |
| -> Evaluates this reply. Nothing sends.                                        |
+--------------------------------------------------------------------------------+
| READY TO SEND                                                                  |
| [Approve & send exact reply]                                                   |
| -> This exact reply will be posted to X now.                                   |
| [More: Quote instead | Skip | No longer useful]                                |
+--------------------------------------------------------------------------------+
```

### [D-C3] Sent [RO truth, P presentation]

```text
+--------------------------------------------------------------+
| SENT                                                         |
| Exact reply is now public on X.                              |
| Output: <link/identity when available>                        |
| [View on X]   [Back to Conversations]                        |
+--------------------------------------------------------------+
```

### [D-C4] Partial-success reconciliation [P around RO state]

```text
+--------------------------------------------------------------------------+
| NEEDS RECONCILIATION                                                     |
| Operation: Send reply                                                    |
| Remote effect: the reply may already have reached X                      |
| Current authoritative state: Publishing / recording incomplete           |
| Safe retry: NO — do not send again yet                                   |
|                                                                          |
| [Refresh authoritative state]   [View known X output, if available]      |
| Next: confirm remote/local truth; wait/escalate if still unresolved.      |
|                                                                          |
|                         (NO SEND BUTTON)                                  |
+--------------------------------------------------------------------------+
```

Connections:

```text
[D-C1] Review reply -> [D-C2]
[D-C2] successful send -> [D-C3]
[D-C2] remote/local uncertainty -> [D-C4]
[D-C4] refresh -> [D-C3] OR [D-C4] OR known-failed normal review path
```

## Phone

### [P-C2] Conversation detail

```text
+------------------------------+
| < CONVERSATION          [Nav]|
| @builder                     |
| State: Draft                 |
| Draft > Review > Send > Sent |
+------------------------------+
| WHAT YOU CAN ADD             |
| <contribution>               |
+------------------------------+
| SOURCE                       |
| text...                      |
| [Context details]            |
+------------------------------+
| REPLY                        |
| <editable text>              |
| [Save] [Regenerate]          |
+------------------------------+
| READINESS                    |
| [confirmations]              |
| [Check readiness]            |
| -> Nothing sends             |
+------------------------------+
| [Approve & send exact reply] |
| -> Posts this exact reply    |
|    to X now                  |
+------------------------------+
```

### [P-C4] Reconciliation

```text
+------------------------------+
| NEEDS RECONCILIATION         |
| Send may have reached X      |
| State: Publishing            |
| Retry: NOT SAFE YET          |
|                              |
| [Refresh state]              |
| [View X output if known]     |
| No resend action             |
+------------------------------+
```

**Phone test:** after showing `[P-C4]`, ask what the participant would do next and whether they believe another send is safe.

---

# 4. Posts + draft lifecycle wireflow — one recognizable state model

## Desktop

### [D-P1] Posts overview [P]

```text
+--------------------------------------------------------------------------------+
| POSTS                                                                          |
| Every item shows the same lifecycle state and next human decision.             |
+--------------------------------------------------------------------------------+
| NEEDS REVIEW                                                                   |
| <post title>   Original                                                        |
| Draft -> [Needs review] -> Approved/waiting -> Publishing -> Published          |
| Blockers: none / <plain blocker>                                                |
| [Review exact draft]                                                           |
+--------------------------------------------------------------------------------+
| APPROVED / WAITING                                                             |
| <post title>   Thread                                                          |
| Draft -> Needs review -> [Approved/waiting] -> Publishing -> Published          |
| Planned: 15:30   Auto-publishing: on   PUBLIC NOW? No                           |
| [Review publishing plan]                                                       |
+--------------------------------------------------------------------------------+
| PUBLISHING                                                                     |
| <post title>   Quote                                                           |
| ... -> [Publishing] -> ...                                                      |
| Remote transport in progress.                                                  |
+--------------------------------------------------------------------------------+
| FAILED / RECONCILE                                                             |
| <post title>   <state>                                                         |
| [Open recovery]                                                                |
+--------------------------------------------------------------------------------+
```

### [D-P2] Draft review [P over RO]

```text
+--------------------------------------------------------------------------------+
| < Posts         <post title>                               State: Needs review   |
| Draft -> [Needs review] -> Approved/waiting -> Publishing -> Published          |
+--------------------------------------------------------------------------------+
| SOURCE / SELECTED TYPE                                                         |
| <source>                     Original / Thread / Quote                           |
+--------------------------------------------------------------------------------+
| WRITING STRATEGY [F placement stimulus]                                        |
| Current: Advice only / No influence / Deliberately use / Not selected           |
| [Inspect / change]  -> writing influence only; no approval effect               |
+--------------------------------------------------------------------------------+
| EXACT DRAFT                                                                     |
| <editable text>                                                                 |
| [Save changes]                                                                  |
+--------------------------------------------------------------------------------+
| CHECKS                                                                          |
| Fix before approval: <blockers or none>                                         |
| Human confirmations: [ ] facts  [ ] evidence when required                      |
| [Check readiness] -> checks only; nothing publishes                             |
+--------------------------------------------------------------------------------+
| WHEN READY                                                                      |
| [Approve exact post]                                                            |
| -> Marks this text approved. It is NOT public yet.                              |
+--------------------------------------------------------------------------------+
```

### [D-P3] Approved / publishing plan [P over RO]

```text
+--------------------------------------------------------------------------------+
| < Posts         <post title>                          State: Approved / waiting  |
| Draft -> Needs review -> [Approved/waiting] -> Publishing -> Published          |
+--------------------------------------------------------------------------------+
| APPROVAL                                                                        |
| Exact content approved at <time>. Not public yet.                               |
+--------------------------------------------------------------------------------+
| PUBLISHING PLAN                                                                 |
| Recommended: 15:30    Human time override: [________]                           |
| Eligibility/expiry summary: <plain language>                                    |
| Auto-publishing: ON / OFF                                                       |
| [Save plan] -> changes timing only; does not publish                            |
| [Why this time?]                                                               |
+--------------------------------------------------------------------------------+
| WHAT HAPPENS NEXT                                                               |
| ON: when approved + eligible + due, background publication may start.           |
| OFF: nothing will auto-publish.                                                 |
+--------------------------------------------------------------------------------+
```

### [D-P4] Publishing / published

```text
Publishing:
+--------------------------------------------------------------+
| PUBLISHING                                                   |
| Remote publication is in progress.                           |
| Ordinary reroute/discard controls are unavailable.           |
+--------------------------------------------------------------+

Published:
+--------------------------------------------------------------+
| PUBLISHED                                                    |
| Public on X at <time>.                                       |
| <read-only exact text>                                       |
| [View on X] [View later results]                              |
+--------------------------------------------------------------+
```

### [D-P5] Failure / reconciliation

```text
Known failure:
+------------------------------------------------------------------+
| PUBLISH FAILED                                                   |
| What failed: <operation>                                         |
| Remote effect: <known state from owner>                          |
| Current state: Failed                                            |
| Safe next step: <normal review path only if safe>                |
| [Open recovery details]                                          |
+------------------------------------------------------------------+

Remote/local uncertainty:
+------------------------------------------------------------------+
| NEEDS RECONCILIATION                                             |
| Remote publication may already exist.                            |
| Current state: Publishing / recording incomplete                 |
| Retry: not safe yet                                              |
| [Refresh state] [Inspect known output]                            |
| (No publish/retry control until authoritative state resolves)     |
+------------------------------------------------------------------+
```

### [D-P6] Repost preparation

```text
+------------------------------------------------------------------+
| REPOST                                                           |
| Writing strategy: Not applicable — no authored body              |
|                                                                  |
| [Approve repost]                                                 |
| -> Approves the local repost plan. The app does NOT repost on X. |
|                                                                  |
| After you manually repost on X:                                  |
| [Mark reposted]                                                  |
| -> Records your completed repost; does not perform it.           |
+------------------------------------------------------------------+
```

Connections:

```text
[D-P1] Needs review ----------> [D-P2]
[D-P2] Approve ---------------> [D-P3]
[D-P3] ... later ... ---------> [D-P4 Publishing]
[D-P4] success ---------------> [D-P4 Published]
[D-P4] failure/uncertainty ---> [D-P5]
[D-P5] resolved --------------> [D-P4 Published] OR normal review path OR explicit wait
```

## Phone

### [P-P1] Posts overview

```text
+------------------------------+
| POSTS                   [Nav]|
+------------------------------+
| NEEDS REVIEW                 |
| <post>                       |
| Draft > [Review] > Approved  |
| > Publishing > Published     |
| [Review exact draft]         |
+------------------------------+
| APPROVED / WAITING           |
| <post>                       |
| Planned 15:30                |
| Public now? NO               |
| [Publishing plan]            |
+------------------------------+
| FAILED / RECONCILE           |
| <post>                       |
| [Open recovery]              |
+------------------------------+
```

### [P-P2a] Authored draft before generation [P recomposition]

```text
+------------------------------+
| < POST                  [Nav]|
| State: Draft                 |
| [Draft] > Review > Approved  |
+------------------------------+
| Selected type: Quote         |
| No generated text yet.       |
|                              |
| [Generate draft]             |
| -> Creates editable AI text  |
|    Nothing is approved/public|
+------------------------------+
```

### [P-P2] Draft review

```text
+------------------------------+
| < POST                  [Nav]|
| State: Needs review          |
| Draft > [Review] > Approved  |
+------------------------------+
| Exact draft                  |
| <text>                       |
| [Save]                       |
+------------------------------+
| Writing guidance [F]         |
| Advice only                  |
| [Inspect/change]             |
+------------------------------+
| Blockers / confirmations     |
| ...                          |
| [Check readiness]            |
| -> Nothing publishes        |
+------------------------------+
| [Approve exact post]         |
| -> Approved, NOT public yet  |
+------------------------------+
```

### [P-P3] Approved / plan

```text
+------------------------------+
| APPROVED / WAITING           |
| Public now? NO               |
| Planned: 15:30               |
| Auto-publishing: ON          |
|                              |
| [Change time]                |
| [Save plan]                  |
| -> timing only               |
+------------------------------+
```

**Phone test:** leave the prototype after `[P-P3]`, then re-enter on a later task and ask the participant to find whether the post is public yet.

---

# 5. Results wireflow — own-account outcomes without evidence-source collapse

Results remains the primary place for observed account outcomes in both H1 and H2. The difference is whether broader learning evidence also lives inside Results.

## Desktop H1 [P/RH]

### [D-R1-H1] Results as outcome + learning hub

```text
+--------------------------------------------------------------------------------+
| RESULTS                                                                        |
| Overview | Audience | Recent outcomes | External patterns | Own patterns |      |
| Tests | Strategy recommendations | More                                       |
+--------------------------------------------------------------------------------+
| WHAT CHANGED                                                                   |
| Relevant audience: ...    Useful conversations: ...    Account status: ...      |
+--------------------------------------------------------------------------------+
| RECENT CONTENT OUTCOMES                                                        |
| <post>  24h views/replies/reposts   associated follower change   isolation ...  |
| Observational/attribution caveat                                               |
+--------------------------------------------------------------------------------+
| WHAT ARE WE LEARNING?                                                          |
| [External patterns] [Own-account patterns] [Tests] [Strategy recommendations]  |
+--------------------------------------------------------------------------------+
| MORE                                                                           |
| AI settings | niche definition | detailed diagnostics                          |
+--------------------------------------------------------------------------------+
```

**H1 testable concern:** outcome review, external evidence, tests, strategy, and technical settings may make Results too broad.

## Desktop H2 [P/RH]

### [D-R1-H2] Results focused on account outcomes

```text
+--------------------------------------------------------------------------------+
| RESULTS                                                                        |
| Overview | Audience quality | Recent content | Conversation outcomes            |
+--------------------------------------------------------------------------------+
| WHAT CHANGED                                                                   |
| Relevant audience: ...    Useful conversations: ...    Account status: ...      |
+--------------------------------------------------------------------------------+
| RECENT CONTENT OUTCOMES                                                        |
| <post>  24h views/replies/reposts   associated follower change   isolation ...  |
+--------------------------------------------------------------------------------+
| INTERPRETATION BOUNDARY                                                        |
| These are observed account outcomes/proxies, not direct business conversions.  |
+--------------------------------------------------------------------------------+
| Need to compare market patterns, own patterns, or tests?  [Open Learn]          |
+--------------------------------------------------------------------------------+
```

### H1/H2 shared detail

```text
+------------------------------------------------------------------+
| AUDIENCE QUALITY                                                 |
| Newly observed: 12    Relevant: 8                               |
| What this means: observed profile fit, not causal post attribution|
| [Review profiles] [Evidence/detail]                              |
+------------------------------------------------------------------+
```

## Phone H1

```text
+------------------------------+
| RESULTS                 [Nav]|
| [Sections]                    |
+------------------------------+
| What changed                 |
| Relevant audience ...        |
| Conversations ...            |
+------------------------------+
| Recent content               |
| <post outcome>               |
+------------------------------+
| Learning / evidence          |
| > External patterns          |
| > Own patterns               |
| > Tests                      |
| > Strategy recommendations   |
| > More / settings            |
+------------------------------+
```

## Phone H2

```text
+------------------------------+
| RESULTS                 [Nav]|
+------------------------------+
| What changed                 |
| Relevant audience ...        |
| Conversations ...            |
+------------------------------+
| Recent content               |
| <post outcome>               |
+------------------------------+
| Evidence caveat              |
| [Open Learn]                 |
+------------------------------+
```

**Research tasks:** find audience quality, a fixed-window post result, and the place to compare external versus own evidence. The H1/H2 difference should be the only intentional route-variable.

---

# 6. Learn / Viral research / evidence comparison / strategy wireflow

This area is where H1 and H2 materially differ. Screen bodies below should be reused under either shell so the research tests placement rather than different content quality.

## Entry map

```text
H1: Results
      |- External patterns ------------> [L-EXT]
      |- Own-account patterns ---------> [L-INT]
      |- Tests ------------------------> [L-TEST]
      |- Strategy recommendations -----> [L-STRAT]

H2: Learn
      |- External patterns ------------> [L-EXT]
      |- Own-account patterns ---------> [L-INT]
      |- Tests ------------------------> [L-TEST]
      |- Strategy recommendations -----> [L-STRAT]
```

Names are provisional stimuli; provenance is not.

## Desktop

### [D-L0-H2] H2 Learn index [P/RH]

```text
+--------------------------------------------------------------------------------+
| LEARN                                                                          |
| What evidence do you want to inspect?                                          |
+--------------------------------------------------------------------------------+
| EXTERNAL                         OUR ACCOUNT                    TESTS             |
| Comparable niche posts          Our measured outcomes          Declared compares |
| [Open external patterns]        [Open own evidence]            [Open tests]      |
+--------------------------------------------------------------------------------+
| STRATEGY RECOMMENDATIONS [F]                                                |
| Evidence-backed writing guidance for a specific work item; human-controlled.    |
| [Open recommendations]                                                        |
+--------------------------------------------------------------------------------+
```

For H1, use the same four destinations as Results sub-sections rather than a separate Learn index.

### [D-L-EXT1] External patterns + simplified research [P over RO]

```text
+--------------------------------------------------------------------------------+
| EXTERNAL PATTERNS                                      [EXTERNAL EVIDENCE]      |
| Observed associations in comparable niche posts; not a causal ranking claim.   |
+--------------------------------------------------------------------------------+
| STUDY SCOPE                                                                     |
| Period: [Last 21 days v]       Niches: [AI agents] [Devtools] [+]               |
| Depth:  ( ) Quick   (*) Standard   ( ) Deep                                     |
| Semantic analysis: [x] Intent + presentation style                              |
|                                                                                |
| [Advanced setup]  -> exact thresholds, controls, threads, runtime/model/etc.    |
+--------------------------------------------------------------------------------+
| RUN SUMMARY                                                                     |
| <plain description of selected scope/depth>                                     |
| [Run research]                                                                 |
| -> Starts read-only background research. It never posts/replies/follows.        |
+--------------------------------------------------------------------------------+
| LATEST FINDINGS                                                                 |
| <pattern>  Evidence: directional/repeated according to source semantics         |
| Intent: teach/explain   Style: how-to   Sample: ...   [Why / examples]          |
+--------------------------------------------------------------------------------+
```

**Advanced behavior:** exact current controls remain inspectable, but the default run does not require AI profile/runtime/model reasoning knowledge.

### [D-L-EXT2] Research progress [P over RO]

```text
+--------------------------------------------------------------------------------+
| RESEARCH RUN                                                                   |
| Status: Running     Started: ...                                                |
| Discovering -> Enriching -> Controls -> Intent analysis -> Analyze -> Complete  |
|                         [current checkpoint]                                    |
| Current unit: <niche/window>     Progress: ...     Errors: ...                  |
|                                                                                |
| [Stop after current unit]                                                       |
| -> Stops between bounded units; completed/stored observations remain.           |
|                                                                                |
| You can leave this page. Re-entry shows this run separately from older data.    |
+--------------------------------------------------------------------------------+
```

### [D-L-COMP] Evidence comparison [P/F synthesis presentation]

```text
+--------------------------------------------------------------------------------+
| COMPARE EVIDENCE FOR <strategy question / work item>                            |
+--------------------------------------------------------------------------------+
| [EXTERNAL]                  | [OUR ACCOUNT]               | [TEST]              |
| Comparable niche posts     | Our observed outcomes       | Declared comparison |
| Window/sample: ...         | Window/sample: ...          | Assignments: ...    |
| Pattern: ...               | Pattern: ...                | Difference: ...     |
| Strength: ...              | Evidence state: ...         | Evidence state: ... |
| Limitation: observational  | Attribution/confounders...  | Confounders...      |
| [Inspect evidence]         | [Inspect evidence]          | [Inspect test]      |
+--------------------------------------------------------------------------------+
| SYNTHESIS [F]                                                                   |
| Agreement: ... / Disagreement: ... / Insufficient: ...                          |
| No opaque combined score.                                                       |
| [Open possible writing strategy]   [Gather more evidence]                       |
+--------------------------------------------------------------------------------+
```

### [D-L-STRAT] Strategy recommendation [F]

```text
+--------------------------------------------------------------------------------+
| WRITING STRATEGY FOR <work item>                                                |
| This is writing guidance, not an editorial selection or approval.               |
+--------------------------------------------------------------------------------+
| Suggested intent: Teach/explain        Suggested style: Field note              |
| Why it may fit: ...                                                            |
|                                                                                |
| EVIDENCE                                                                        |
| [EXTERNAL]  ...   [OUR ACCOUNT] ...   [TEST] ...                                |
| Limitations: ...                                                               |
+--------------------------------------------------------------------------------+
| WRITING INFLUENCE — labels are research stimuli                                |
|                                                                                |
| ( ) No influence       canonical: off                                          |
|     Writer receives no strategy instruction.                                   |
|                                                                                |
| ( ) Advice only        canonical: suggest                                      |
|     Guidance stays visible; Writer generation is unchanged.                    |
|                                                                                |
| ( ) Deliberately use   canonical: apply                                        |
|     Human allows this guidance to shape ONE generation only.                   |
|                                                                                |
| No mode approves, schedules, sends, publishes, accepts a learned rule, or       |
| assigns a test.                                                                 |
+--------------------------------------------------------------------------------+
| [Continue to work item]                                                         |
+--------------------------------------------------------------------------------+
```

### [D-L-STRAT-NA] Repost not applicable [F semantic rule]

```text
+------------------------------------------------------------------+
| REPOST                                                           |
| Writing strategy: NOT APPLICABLE                                 |
| Reason: a repost has no authored body for Writer generation.     |
| [Continue to repost review]                                      |
+------------------------------------------------------------------+
```

### Strategy placement stimuli

Use the same `[D-L-STRAT]` content but vary where the mode decision appears.

```text
S1 — Evidence-area selection
[H1 Results/H2 Learn recommendation] -- choose mode --> [Draft mirrors + can change]

S2 — Draft-only selection
[H1 Results/H2 Learn recommendation: evidence only] --> [Draft chooses mode]

S3 — Dual responsibility
[H1 Results/H2 Learn: “Use with this work item”] --> [Draft confirms/changes mode]
```

Do not combine placement variants in one participant task unless the study is explicitly comparing them.

## Phone

### [P-L0-H2] Learn index

```text
+------------------------------+
| LEARN                   [Nav]|
| What do you want to inspect? |
+------------------------------+
| EXTERNAL                     |
| Comparable niche patterns    |
| [Open]                       |
+------------------------------+
| OUR ACCOUNT                  |
| Observed account patterns    |
| [Open]                       |
+------------------------------+
| TESTS                        |
| Declared comparisons         |
| [Open]                       |
+------------------------------+
| STRATEGY [F]                 |
| Guidance for a work item     |
| [Open]                       |
+------------------------------+
```

For H1, present the same entries inside Results sections rather than a Learn page.

### [P-L-EXT1] Simplified research

```text
+------------------------------+
| EXTERNAL PATTERNS       [Nav]|
| [EXTERNAL EVIDENCE]          |
| Association, not causation   |
+------------------------------+
| Period: Last 21 days v       |
| Niches: AI agents +1         |
|                              |
| Depth                        |
| Quick | [Standard] | Deep    |
|                              |
| [x] Intent/style analysis    |
| [Advanced setup]             |
+------------------------------+
| Run summary: ...             |
| [Run research]               |
| -> read-only background run  |
+------------------------------+
| Latest pattern ...           |
| Evidence ...                 |
| [Why / examples]             |
+------------------------------+
```

### [P-L-COMP] Evidence comparison

```text
+------------------------------+
| COMPARE EVIDENCE             |
+------------------------------+
| [EXTERNAL]                   |
| <pattern, sample, limits>    |
| [Inspect]                    |
+------------------------------+
| [OUR ACCOUNT]                |
| <outcome, sample, caveats>   |
| [Inspect]                    |
+------------------------------+
| [TEST]                       |
| <comparison, assignments>    |
| [Inspect]                    |
+------------------------------+
| Synthesis: agree / disagree  |
| / insufficient              |
| [Possible strategy]          |
+------------------------------+
```

### [P-L-STRAT] Strategy mode

```text
+------------------------------+
| WRITING STRATEGY             |
| for <work item>              |
+------------------------------+
| Intent: Teach/explain        |
| Style: Field note            |
| [Evidence & limitations]     |
+------------------------------+
| ( ) No influence   [off]     |
|     Writer unchanged         |
|                              |
| ( ) Advice only    [suggest] |
|     Writer unchanged         |
|                              |
| ( ) Deliberately use [apply] |
|     This generation only     |
+------------------------------+
| No approval/send/publication |
| effect                       |
| [Continue]                   |
+------------------------------+
```

### [P-P2-STRAT] Point-of-use draft state [F]

```text
+------------------------------+
| DRAFT                        |
| Writing guidance: APPLY      |
| Teach/explain / Field note   |
| [Change] [Remove]            |
| -> writing influence only    |
+------------------------------+
| [Generate draft]             |
| -> editable text only        |
+------------------------------+
```

**Applicable types:** Original, Thread, Quote, Reply. For Repost, render the not-applicable explanation instead of a mode selector.

---

# 7. Advanced/configuration branch — kept out of ordinary task setup

Configuration findability was a Wave-1 P1 hypothesis. The prototype does not choose its final label/placement, but ordinary Viral/drafting flows must not require it.

## H1 branch [P/RH]

```text
Results
  -> More
      -> AI Settings
      -> Niche / audience definition
      -> Account status / diagnostics
```

## H2 branch [P/RH]

```text
Advanced / Settings
  -> AI Settings
  -> Niche / audience definition
  -> Account status / diagnostics
```

## Contextual expert access from research [P]

```text
Simplified External Research
  -> Advanced setup
      -> technical research controls
      -> optional link to AI Settings when configuration itself must change
```

**Test:** ordinary users should be able to run external research without entering this branch; advanced users should still locate exact provider/model/niche/diagnostic controls deliberately.

---

# 8. Desktop end-to-end wireflow scenarios

## Scenario D1 — obligation -> approved/waiting -> later published

```text
[D-T1 Today]
   | Review exact draft
   v
[D-P2 Draft: Needs review]
   | Check readiness
   | Approve exact post -> “approved, not public”
   v
[D-P3 Approved / publishing plan]
   | Save plan -> timing only
   v
... later / background eligibility ...
   |
   v
[D-P4 Publishing]
   | success
   v
[D-P4 Published]
   |
   v
... later measurement windows ...
   |
   v
[D-R1 Results]
```

## Scenario D2 — advisory recommendation -> explicit generation

```text
[D-T1 Advisory opportunity]
   | Use as Original -> selection only
   v
[D-P2a Draft preparation: no generated text]
   | optional strategy point-of-use [F]
   | Generate draft -> editable text only
   v
[D-P2 Draft review]
```

## Scenario D3 — reply -> partial remote/local failure

```text
[D-C1 Conversations]
   v
[D-C2 Conversation detail]
   | Approve & send exact reply -> public X action now
   v
[D-C4 Needs reconciliation]
   | Refresh / inspect / wait
   | NO resend while uncertain
   +------> [D-C3 Sent] when authoritative truth resolves
   +------> normal review path only if owner confirms failed/safe
```

## Scenario D4 — external research -> compare evidence -> optional strategy

H1:

```text
Results > External patterns -> [D-L-EXT1] -> [D-L-EXT2] -> [D-L-COMP]
Results > Own patterns ------------------------------------------^
Results > Tests -------------------------------------------------^
[D-L-COMP] -> [D-L-STRAT] -> Draft/Conversation
```

H2:

```text
Learn > External patterns -> [D-L-EXT1] -> [D-L-EXT2] -> [D-L-COMP]
Learn > Own-account evidence ------------------------------------^
Learn > Tests ---------------------------------------------------^
[D-L-COMP] -> [D-L-STRAT] -> Draft/Conversation
```

---

# 9. Phone end-to-end wireflow scenarios

## Scenario P1 — quick daily decision

```text
[P-T1 Today]
  -> Review exact draft
[P-P2 Draft review]
  -> Approve exact post (not public)
[P-P3 Approved/waiting]
  -> leave session
... later ...
[Nav -> Posts]
  -> same item shows Publishing / Published / Failed truth
```

## Scenario P2 — discover and prepare without surprise generation

```text
[P-D1 Discover]
  -> Choose treatment
[P-D2 Treatment]
  -> Select Quote (route only)
[P-P2a Draft before generation]
  -> Generate draft explicitly
[P-P2 Draft review]
  -> Review
```

## Scenario P3 — safe reply failure recovery

```text
[P-C2 Conversation]
  -> Approve & send exact reply
[P-C4 Needs reconciliation]
  -> Refresh state / inspect X
  -> NO resend until resolved
```

## Scenario P4 — evidence comparison

H1:

```text
[Nav -> Results -> External patterns] -> [P-L-EXT1]
[Results -> Own patterns] -------------> [P-L-COMP]
[Results -> Tests] ---------------------> [P-L-COMP]
```

H2:

```text
[Nav -> Learn -> External] -> [P-L-EXT1]
[Learn -> Our account] ------> [P-L-COMP]
[Learn -> Tests] ------------> [P-L-COMP]
```

Phone evidence cards stack vertically but retain provenance labels on every card; stacking must not erase the distinction between evidence owners.

---

# 10. Wave-1 P1 defect -> prototype repair/test matrix

| Wave-1 P1 issue | Prototype repair in these wireflows | What remains a research question |
|---|---|---|
| Today priority ambiguity | `[D/P-T1]` separates **Needs your decision** obligations from advisory opportunities and makes advisory selection semantics explicit. | Exact ordering/labels and whether this distinction is noticed without coaching. |
| Inconsistent Draft consequences | Today/Discover selection is shown as route/selection only; authored generation has a separate explicit `Generate draft/reply` action using existing authorities. | Best user-facing action words; whether a two-step interaction improves prediction enough to justify later implementation. |
| Fragmented post lifecycle | `[D/P-P1..P5]` repeats one lifecycle model across Posts/Draft/Today summaries and makes re-entry after waiting explicit. | Exact state labels and whether object-level lifecycle is sufficient on phone/after time away. |
| Incomplete exceptional recovery | `[D/P-C4]` and `[D-P5]` replace ordinary send/publish actions with remote-effect/current-state/retry-safety/next-step recovery. | Whether refresh + inspection/wait is sufficient or a dedicated reconciliation action is required for real failure classes. |
| Viral Styles default complexity | `[D/P-L-EXT1]` reduces default setup to period, niches, depth, optional semantic analysis; exact current controls remain under Advanced. | Which controls ordinary users need; exact Quick/Standard/Deep mappings and labels. |
| Configuration findability | Ordinary research does not require settings; H1 `Results > More` and H2 `Advanced / Settings` remain separate findability stimuli, with contextual expert links. | Which hierarchy/label users predict for AI/niche/diagnostics. |
| Strategy synthesis gap | `[D/P-L-COMP]`, `[D/P-L-STRAT]`, and point-of-use draft state make evidence provenance and canonical `off|suggest|apply` semantics testable before implementation. | Whether strategy selection belongs in evidence area, draft, or both; exact user-facing labels. |

---

# 11. Prototype evaluation prompts

These prompts test comprehension rather than preference.

1. **Today:** “Which item already requires your decision? Which item is only advice?”
2. **Recommendation/Discover:** before activation, “What will happen if you press this? Will text be generated? Will anything publish?”
3. **Draft approval:** “If you approve this, is it public immediately? What state will it enter?”
4. **Later re-entry:** after a simulated time gap, “Is this post public yet? Where can you tell?”
5. **Reply send:** “What will happen if you press this button now?”
6. **Reconciliation:** “Did the reply definitely fail? Is it safe to send again? What would you do next?”
7. **Viral research:** “Start a sensible study without changing AI/runtime settings.”
8. **Evidence comparison:** “Which finding came from outside posts, which came from this account, and which came from a deliberate test?”
9. **Strategy suggest:** “If this mode is selected, will the Writer change how it generates the draft?”
10. **Strategy apply:** “What exactly changes, for how long, and what does not change?”
11. **Repost:** “Can writing strategy affect this action? Why or why not?”
12. **H1/H2:** run equivalent findability tasks without mentioning `Results` or `Learn` in the prompt.

## Research recording rule

Record first path, backtracking, action prediction, current-state explanation, evidence provenance interpretation, and any requested help. Do not convert these wireflows into “validated” product decisions until real participant evidence exists.