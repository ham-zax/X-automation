# Useful Tech Discoveries — Integrated XGrowth Plan

**Goal:** Make @ham_zax consistently find, judge, publish, and learn from practical, surprising technology discoveries through the **existing** XGrowth features.

**Architecture:** Keep Growth Focus as topic preferences; reuse For You, X Latest/Momentum, Viral Styles, Scout, Editorial, Writer/persona, existing governed media/Thread publishing, and Measurements/Experiments/Learning. A discovery **format** (surprising capability, useful resource, trustworthy how-to) is not a new niche or a new feed. The original creator owns its claim and media; the account's existing review and publication ledger owns outbound actions.

**Stack:** Node.js, SQLite Growth OS, current X and GitHub/HN collectors, React Discover/Learn/Create, existing persona and Writer contracts.

## Constraints

- No new dashboard section, competing scraper/publisher, mandatory posting target, hidden algorithm threshold, token/financial semantics, or unattended prompt-self-modification.
- Preserve the owner-configurable developer/builder identity. Owner-curated public examples are a format reference only; this is not a crypto-niche pivot.
- Creator text, screenshots, videos, personal testimony and tests are not ours to copy. Paraphrasing a viral post without a new reader payoff is insufficient for an Original.
- The source's factual claims require primary-source verification. Label screenshots and metrics by provenance, and preserve unknown measurements as unknown.
- All content, media, delegated approval, browser action, publication attempt, and result reconciliation constraints remain fully intact.

## A. Integrated initial revision — in review branch

### 1. Discover in existing feeds

**Files:** strategy.js; tech_news.js

**Input/output:** Current configured Growth Focus -> existing X Latest and Momentum query groups -> current source snapshots and Viral Styles seed search.

**Work (independently reviewed correction):** Opt operational search into four distinct query lenses: utility/open-source, curated resources, unexpected capabilities, and demonstrable projects. Alternate one existing slot every other rotation when its configured budget is at least three and at least one matching owner-enabled Growth Focus group has nonzero target share. All other slots remain configured-topic opportunities. Historical Viral Styles retains the baseline query set by default via `getXSearchQueryGroups({ includeFormatLenses: false })`; `selectRotatingXQueryGroups` opts in. Historical sweeps must not silently change study cohorts. Search parser support and recall remain live-validation tasks; do not claim they have been verified.

**Acceptance:** The standard discovery loop now searches this class of post in addition to broad technical keywords without additional slots or a new collection service.

### 2. Observe why a post spreads

**Files:** viral_style.js; scout.js

**Input/output:** Observed X text/media/metrics -> existing hook/style classification and Scout cards.

**Work (independently reviewed correction):** Identify unexpected-capability hooks, free-resource promises, website/app lists, and visual demonstrations. Separate `first_person_build` from `first_person_test`. Report current classifier version and explicitly label historical style features `recomputed_current`; original samples store the version at collection. Visual-demo classification requires explicitly observed media metadata (For You or X search), never a guess from source text. Bookmarks/1,000 views are **descriptive only**, calculated when both metrics are known; because sensor coverage is uneven, there is **no bookmark-derived ranking bonus**.

**Acceptance:** The CarPlay-like example can be recognized as an unexpected capability, a 50-sites list as a curated resource. Unavailable saves do not become zero, and no structure label authorizes publication.

### 3. Write useful discoveries in the owner's voice

**Files:** growth_agent_runner.js; docs/POST_GENERATION_PROMPT.md; docs/EDITORIAL_RECOMMENDATION_PROMPT.md; docs/NICHE_AND_KEYWORDS.md; docs/AGENT_WORKFLOW.md; docs/PERSISTENT_GROWTH_OPERATOR_PROMPT.md; docs/GROWTH_OS_MOMENTUM_OPERATOR.md; AGENTS.md.

**Input/output:** Existing research candidate + source + primary verification + active persona -> existing Original, Quote, Thread, Repost, Reply, or research-only decision -> Writer and normal review gates.

**Work:** Assess the hook's true promise; name the actual reader payoff, real source, prerequisites, compatibility, cost and limitation, and distinct contribution. Use an Original only when it stands on its own with something new; a Quote if the demo/creator context is material; a real Thread when multiple nonredundant steps justify one; a Repost for unchanged sharing. Include a direct project link when utility requires it. Do not treat a clip or image displayed on X as reusable media. Perform up to two internal passes reviewing hook clarity, truth, originality and persona; existing independent gates remain authoritative.

**Acceptance (expanded):** The default `executorPrompt`, not merely legacy `operatorPrompt`, recognizes T1 useful discoveries and T2 source-linked `xDiscoveryInspirations` with exact candidate keys, routes source-grounded Originals/Threads through the existing main-feed draft and delegated approval lane, and preserves direct `act` vs queued `browser-publish-claim` authority. `discovery_verification.js` is a pure adapter over **existing** editorial evidence; on autonomous standalone X-tech discoveries it requires a cited, stored `primary_supported` material implementation document (`github_readme`, `github_release`, or explicitly verified official documentation) before mission-agent approval. This is a minimum provenance requirement, not blanket proof of every assertion: exact content review still checks claimed facts. A creator-only claim or GitHub metadata cannot be silently treated as independently verified. Human decisions and unrelated content routes retain existing authority.

## B. Upgrade existing visible experiences — Discover evidence display integrated; further polish proposed

### 4. Present useful-discovery evidence inside Discover and Learn

**Files:** web_api.js; ui/src/api/client.ts; ui/src/features/discover/Discover.tsx (initial hook/format/bookmark observations integrated); ui/src/features/viral/ViralStyles.tsx (existing hook breakdown retained; improved comparative filtering still proposed).

**Interfaces:** Existing candidate cards, virality report, hook/style tags, observed media and metrics.

**Work:** Existing Discover candidate cards now include hook/style evidence, actual observed media type when present, classifier version, available observation time/source, and bookmark rate with a denominator. Missing X metrics display `unavailable` rather than fabricated zero. The optional `sourceStyle` type allows staged API/UI deployment. The already-existing save/route actions remain intact. Future Viral Styles enhancements may improve explicit matched-author filtering; preserve the current cohort/evidence-class method. Never display a synthetic probability of going viral.

**Acceptance:** Someone seeing an interesting For You or viral post can trace its hook, inspect its source, and choose the existing content route without visiting a new section.

### 5. Finish media and multi-post content through existing governed publishing

**Files:** docs/AGENT_WORKFLOW.md and existing draft/media/queue interface code only if a concrete missing operation is identified.

**Interfaces:** Current ingest, route, writer-packet, apply-writer-output, .x-media uploader, browser-publish-claim, publication-attempt-send-start and record-action.

**Work:** Collect or make legally usable evidence media, save an immutable approved attachment and alt text, and publish only after the exact artifact and text pass gates. When no lawful/usable asset exists, provide the project's link, choose a source-dependent Quote, or defer. For meaningful multi-step instructions, use approved Thread parts with distinct content and verify their sequence. Unsupported remote videos do not become successful attachments.

**Acceptance for a *later* independently validated media/Thread increment:** Confirm image upload against a controlled live/sandbox X session, capture reuse rights/license or owner's original production alongside the SHA-256-bound JPEG/PNG/WebP/GIF artifact, and verify *every* rendered Thread child's approved text as well as ID/parent chain. Current local controls already protect attachment identity and Thread structure, but did not prove real browser upload or per-child text fidelity; video is **not** a supported end-to-end path. Partial, ambiguous sends remain fenced for reconciliation; never resend the root/child blindly. These claims are explicitly excluded from the corrected initial text/link rollout.

## C. Evidence-backed, bounded continuous improvement — proposed

### 6. Learn from account-owned outcomes, not viral inspiration alone

**Files:** growth_performance_learning.js, existing editorial strategy and experiment/learning integration, and docs/PERSISTENT_GROWTH_OPERATOR_PROMPT.md.

**Interfaces:** Existing analytics-record, growth-analysis, experiments, experiment-summary, learning, learning-refresh, learning-accept, and Writing Strategy off/suggest/apply.

**Cycle:** Observe source and audience -> research and verify -> choose a purposeful format -> draft -> critique in bounded passes -> publish through existing authority -> measure at comparable post ages -> compare with the account's own baselines -> suggest one narrow change -> accept only with repeated eligible evidence. If actual bookmarks, profile visits, follower quality, author-cohort data or comparable owned samples are absent, say so and do not claim causality.

**Acceptance:** Strategy evolves only through auditable current experiment/learning records and existing authority. No self-rewriting prompts, infinite critique, one-post overfit or bypass of persona and review gates.

## Independent review remediation and exact interface contract (2026-10-10)

The independent reviewer assigned REQUEST CHANGES (F01–F13). These are the **first-increment corrections**, not a promise of live-media/video operation:

| Review finding | Correction and executable owner |
|---|---|
| F01 / F03 — inactive instructions / missing X-to-Original route | Default `executorPrompt` explicitly evaluates T1/T2 useful-tech sources with exact candidate keys and directs the existing `editorial-select` / `route` / Writer / delegated approval path. `scout.js` exposes candidate-key-specific `xDiscoveryInspirations` without changing reply/quote permission or inventing another lane. |
| F02 / F05 / F06 — historical contamination, unbounded lens allocation, narrow queries | `strategy.js` selects format lenses only by explicit opt-in; historical `viral_style_sweep.js` uses unchanged default selectors, preserving baseline 42/84/112 job counts in deterministic fixtures. `tech_news.js` probes within owner-enabled Growth Focus and existing budgets; four diverse query variants alternate with regular topics. Actual X search parsing and search recall still need live read-only evaluation. |
| F04 — not independently verified | Pure `discovery_verification.js` consumes already-linked X source(s) and stored `Editorial` evidence; `drafting.js` / `agent_bridge.js` exposes status and source IDs inside the Writer packet. `pipeline.js` mission-agent approval for discovery Originals/Threads rejects absent **actually cited** material `primary_supported` implementation evidence. A quoted X claim or repository metadata is insufficient. This is a minimum provenance gate; per-claim verification still belongs to exact-content review. |
| F07 / F09 — visual claims, inaccurate hooks, unversioned studies | Optional explicit For You/X-search `mediaType` observations flow through existing candidate metrics; no inferred video label. `viral_style.js` separates built vs tested, exposes classifier v2, and reports historical labels as recomputed; collection records the version at sampling. |
| F08 — sensor-coverage ranking bias | Remove bookmark score boost. Bookmark/1,000 views is an optional observation, never a gate or automatic ranking advantage. |
| F11 — UI/source context | Existing Discover sourceStyle is optional in the TypeScript contract, includes available classifier/observation/media metadata and displays unavailable X metrics as unavailable. No new tab. |
| F10 / F12 / F13 — deferred | Controlled live image/Thread checks, every-child text reconciliation, media-rights proof, more concise prompt factoring, and experimental learning detail remain separate follow-ups. No video upload or recursive prompt rewrite is claimed. |

### Deterministic offline acceptance fixtures

- `tests/useful_tech_discovery.test.mjs` — query budget and historical cohort identity, positive and negative hooks, media observation dependency, bookmark neutrality, stored primary-evidence status and citation requirements, mission approval rejection, X candidate → editorial selection → exact source/evidence → Writer packet.
- `tests/growth_agent_runner.test.mjs` — active default executor receives discovery-selection, evidence and governed claim instructions; legacy remains available.
- `tests/x_discovery.test.mjs` — real observed-media provenance survives For You ingestion; invalid media is rejected without losing last-good data.
- Existing discover/scout/viral/runner suites must remain green; UI TS/Vite build must succeed.

### Rollback and live validation

The **review branch is not merged or deployed** by these changes. Rollback of a staged merge means reverting to a verified build or disabling operational format probes; do not reset production SQLite or delete a potentially unresolved publication attempt. Preserve run/session/claim and measurement history across rollback. Before enabling live automation, inspect real X query syntax and relevance, compare per-query cost and error/rate-limit signals to baseline, verify For You source provenance, and perform a controlled **read-only** candidate-to-draft rehearsal. Production image attachment, video, and exact multi-post Thread verification require independent controlled tests and rights attestations; do not claim them based on the draft metadata alone.

### Current verification evidence and limitations

The 76 focused discovery/runner/Scout/viral/For You tests passed; JavaScript syntax, TypeScript compile and the existing UI Vite build passed. Full `npm test` executed 187 tests: 182 passed, **five failed during the configured 01:00–08:30 IST rest window** in existing run/repost suites (one failure polluted the next lease fixture). This is a wall-clock-dependent baseline test weakness; it is not a green full suite. Deterministic test-clock fixtures must be provided separately before calling the entire suite consistently passing. No live X search, media upload, video, public post, or Thread publication was performed.

## Second independent review corrective contract (2026-10-10)

**Review input:** Second independent audit of `cf6f83b` found P1 claim/evidence semantic gaps (XG2-01), unreviewed direct act Originals (XG2-02), and a verification trigger tied to unreliable viral hook labels (XG2-03); it also identified nonfaithful Growth Focus target shares (XG2-04) and an evidence/review approval fingerprint gap (XG2-05).

**This revision remains limited to existing surfaces and existing ownership.**

| Boundary | Enforced behavior |
| --- | --- |
| Verification trigger | All **X source-linked** autonomous Originals/Threads require material verification, irrespective of opening hook or viral classifier label. This deliberately fails closed for source-dependent standalone work that cannot identify the underlying project. A Quote can remain explicitly attributed rather than pretending to be a separately verified discovery. |
| Project and claim support | `discovery_verification.js` checks a linked GitHub repository identity, a cited material README/release excerpt, a complete per-public-sentence factual claim inventory, and independent review support judgments for project match, contradictions, and limitations. Missing or altered claims and unsupported or mismatched evidence are rejected before delegated approval. This is a *conservative mechanical/evidence contract*, **not** deterministic natural-language entailment or a guarantee that an AI review cannot err. |
| Atomic publication | The unreviewed `act` Original path is denied for **all** single-text Originals because the atomic claim cannot establish whether free-form text is source-dependent. Reply and Quote remain available. Standalone Originals/Threads use the existing Writer + current independent review + mission-agent or human approval + `browser-publish-claim` path. The queue atomic claim rechecks the discovery contract for delegated originals. |
| Approval freshness | The existing queue approval snapshot now records `evidenceReviewHash` over the actually used Editorial evidence rows, their IDs and the bound content-review object. Reference-only or review-only edits invalidate a newly approved item; atomic queue claims reject mismatched snapshots. Older delegated X-discovery snapshots lacking this field are not automatically grandfathered in. |
| Discovery preferences | `tech_news.js` uses configured positive target shares for operational query-slot allocation and only permits zero-share group probes through explicitly enabled exploration. Query budget and historical `getXSearchQueryGroups()` remain distinct; historical Viral Styles jobs and query identity stay baseline-equivalent. |
| Offline acceptance | Tests cover missing/fabricated content review, mismatched projects, contradiction/negation, unsourced nonquantitative facts, source-grounded approval, act claim denial, approval evidence-only invalidation and weighted query allocation; existing focused and UI checks must remain green. |

**Intentional compatibility change:** a short, genuinely first-party Original no longer uses the direct `act` transport. It must go through the already-existing approved queue too. This sacrifices the fastest Original path to remove an otherwise unauditable publication bypass, without imposing a posting quota or adding another publisher.

**Limitations of the second corrective increment (superseded by the final closure below):** Automatic source-project matching initially recognized only explicit GitHub URLs. Non-GitHub first-party HTTPS documentation and independent review invocation provenance are handled by the final corrective increment; unresolved shortlinks or indirect project identity still remain research-only until verified. The independent content reviewer assesses semantic support but its judgments are still fallible; overlapping words and a model declaration do not *prove* an assertion. Full agent-operator behavior, live read-only X recall, video, media rights, and per-child live Thread text verification still require further controlled evidence. No new database, browser transport, or background AI orchestration was introduced.

## Final independent-review closure and merge scope (2026-10-10)

The third external audit identified an independently reproduced review-authority bypass (XG3-01), an official-documentation project-identity gap (XG3-02), inconsistent generated Writer packets for aggregated X candidates (XG3-03), and narrower deterministic qualifier/slot-zero defects (XG3-04/05). The last corrective increment addresses these within existing owners:

- **Trusted review provenance:** `applyWriterOutput()` treats every caller-supplied review as `external_agent`, regardless of supplied `reviewer` or `execution` fields. `writer_runtime.independentlyReviewAndSaveDraft()` executes an additional independent model review *inside the server process*, binds its result to the exact draft/evidence/persona, persists the reviewed draft and stamps the reviewed snapshot in existing SQLite `app_state`. The delegated X-source Original/Thread approval and atomic queue claim both require `hasTrustedIndependentWriterReview()`; a forged review remains editable but is not publication authority. A failed reviewer leaves an editable, blocked draft. This record is **not** a guarantee that any model review is infallible.
- **First-party documentation:** Explicitly linked first-party HTTPS documentation on a documentation host or documentation path may be recorded by existing `research.js` as `official_documentation` when the guarded fetch succeeds and destination remains the same verified documentation family. `discovery_verification.js` compares that exact official hostname to the observed source URL and persisted evidence identity. Generic pages and unrelated vendor domains do **not** receive this standing. Domain/URL evidence alone does not establish actual product truth: a separately executed independent reviewer still assesses project identity, support, qualifications, pricing, and contradictions. Shared hosting platforms remain excluded from the automatic first-party classification.
- **Writer packet consistency:** The existing automatic `generateDraftCandidate()` and operator `writer-packet` routes now include canonical linked `sourceCandidates`; the exported pure `buildGeneratedWriterPacket()` lets isolated integration fixtures verify aggregate X-source identity without invoking live AI or publishing.
- **Deterministic edge cases:** No disabled-exploration query at timestamp zero. A citation cannot silently omit an `except`/`only`/`unless` qualifier or quote a hosted-paid tier as unconditionally free. These are supplementary checks, not a semantic entailment engine.

**Verification at this merge point:** Full repository Node test suite 189/189 passing in one invocation, UI TypeScript/Vite production build and JavaScript syntax to be checked before publishing main; additionally, focused tests exercise forged-review denial, a real separate reviewer invocation with a deterministic fake AI adapter, attestation freshness at claim time, official-documentation acceptance/rejection, and aggregation through the actual automated Writer packet constructor. No authentic AI review quality, live X search parser/recall, image/video transport, or real Thread publication has been demonstrated. Keep advanced media/Thread claims outside the initial rollout. The production application remains subject to its existing owner approval, queue claim fencing, attempt reconciliation and rollout/monitoring policies; merging repository code does not itself authorize new live posts.

## Rollout

**Review branch:** Phase A plus source-shape/bookmark evidence shown in existing Discover cards; no live X actions, no production main change, no UI new tab. Check syntax and diff before merge.

**First deployment:** After review and safe production update, monitor current source health, X query errors, freshness, and actual editorial picks. Cross-topic search results are candidates, not automatic posts.

**Follow-up:** Complete the remainder of Phase B within existing Discover/Learn/Create surfaces, then Phase C once genuine owned performance samples exist. Avoid introducing an unrequested media generation service just to fulfill the plan.

**Out of scope:** DM crawling; bulk near-copying sources; misleading hands-on claims; reusing creator videos without permission; forcing entertainment/health content into the core technical account; and autonomous rewriting of safety policy.
