# Growth Learning UX Wave 1 Synthesis

**Integrated evidence:** Agent A1 `f827b70` + Agent B1 `08bfce9`, integrated on `main` as `7e6c8b6` and `407e6a8`.

**Purpose:** Record which UX contracts are supported strongly enough to guide the next prototype/content-design wave, and which decisions remain hypotheses requiring real participant evidence.

## Evidence status

Wave 1 produced repository-grounded expert evidence and research instruments. It did **not** produce participant findings. Therefore this synthesis freezes only product-authority and interaction invariants that do not depend on user preference; navigation and terminology remain prototype hypotheses where the research package explicitly says they are falsifiable.

## Repository-observed baseline findings

No repository-confirmed P0 defect was found under the authoritative severity definition. The highest current issues are P1:

1. **Today priority ambiguity.** The advisory AI Editorial Plan appears before the actual `Needs your attention` workflow obligations counted by the Today headline.
2. **Inconsistent Draft consequences.** Today `Draft this` selects/routes and creates a scaffold; Discover `Draft …` can immediately trigger AI generation.
3. **Fragmented post lifecycle.** Draft review/approval, Posts scheduling, and later publication status are distributed across surfaces, increasing recall burden for occasional users.
4. **Incomplete exceptional recovery.** Partial remote/local send reconciliation and failed publication states do not yet have a complete React recovery model; mutation errors can leave stale controls until another authoritative read.
5. **Viral Styles default complexity.** The current run path exposes sampling and AI-runtime machinery before the occasional-user goal of learning which styles/intents appear to work.
6. **Configuration findability.** Niche and AI settings are partly reached through `Diagnostics`, which may not match a novice user's expected destination.
7. **Strategy synthesis gap.** External Viral evidence and internal account learning exist separately; no current draft-time evidence synthesis or human writing-strategy mode exists.

## Contracts frozen now

These are implementation/prototype invariants, not naming preferences.

### 1. Authority contract

Keep these distinct everywhere:

`recommendation -> human selection -> draft/review -> human approval -> schedule/wait -> publish/send transport -> published/sent result`

No UI label or learned-strategy action may collapse these authorities.

### 2. Consequence contract

Every consequential action surface must make four things understandable before activation:

- **What is this?**
- **Why now?**
- **What can I do?**
- **What happens next if I choose this?**

Action wording must describe the immediate effect. A control that only selects/routes must not imply that generated copy already exists. A control that sends/publishes immediately must say so explicitly.

### 3. Lifecycle contract

The user should be able to recognize the current content/conversation state without remembering which module owns it. The prototype must make transitions and handoffs visible, especially review -> approval -> waiting/scheduled -> publishing -> published/failed.

### 4. Recovery contract

Exceptional errors must distinguish:

- what operation failed;
- whether a remote action may already have happened;
- what authoritative state is known now;
- whether retry is safe;
- the next recovery/reconciliation action.

A partial-success transport error must not leave a visible ordinary resend path based only on stale client state.

### 5. Learning provenance contract

Never visually or semantically blend these evidence owners into one unexplained score:

- **external evidence** — what appears to work among comparable niche posts;
- **internal evidence** — what has been observed for this account;
- **experiment evidence** — explicit declared comparisons/tests.

Users must be able to inspect source/evidence strength and limitations on demand.

### 6. Writing-strategy semantics

The behavior is frozen; the final user-facing words are not.

- **No influence** (`off`) — learned strategy does not affect Writer generation.
- **Advice only** (`suggest`) — strategy/evidence is shown to the human; Writer generation is unchanged.
- **Deliberately use** (`apply`) — the human explicitly allows selected intent/style guidance to shape this generation only.

`apply` is never approval, publication, account-wide automation, or learned-rule acceptance. Repost has no authored-body strategy application.

### 7. Growth-purpose contract

Default strategic framing remains **qualified growth velocity**: grow relevant audience quickly, not raw followers or likes. Reach, technical authority, relationships/opportunities, build visibility, experiments, and later revenue remain distinct goals/outcomes rather than one opaque score.

## Decisions not frozen

The following require participant evidence or an explicit later product decision that acknowledges the lack of participant evidence:

1. Final primary IA: current C0 vs five-destination H1 vs six-destination H2.
2. Whether `Learn` communicates evidence/adaptation or is misread as education/help.
3. Exact labels such as `Current winning styles`, `What works for you`, `Tests`, and `Strategy recommendations`.
4. Exact user-facing words for `off|suggest|apply` semantics.
5. Whether strategy selection belongs primarily in Learn, in the draft surface, or in both with different responsibilities.
6. Which Viral research controls ordinary users need outside Advanced setup.
7. Whether configuration should be labeled Settings, Advanced, Diagnostics, or another user-derived term.
8. Whether bare recommendation/quality scores help judgment or create false precision.
9. Whether a forced authoritative refresh is sufficient for partial-success reconciliation or a dedicated reconciliation flow is required for specific failure classes.

## Wave 2 implication

Do **not** mutate React navigation or backend behavior yet.

Wave 2 should turn the frozen interaction contracts and unresolved IA/language hypotheses into testable low-fidelity wireflows and a coherent content/Human-AI language system. Navigation-dependent wireflows should preserve both H1 and H2 where the participant research has not selected a winner.

After Wave 2, perform expert walkthrough repair and moderated usability/card-sort/tree-test work before treating a navigation or terminology hypothesis as validated product truth.
