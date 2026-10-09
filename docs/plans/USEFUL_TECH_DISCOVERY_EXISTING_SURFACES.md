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

**Work:** Append two cross-topic search patterns for verified useful software/open-source finds and unexpected computing capabilities. Rotate one variant through the existing query budget when it has capacity. Leave the other query slots available for the configured topics, honoring disabled groups. Do not add a feed or persist an owner-profile override.

**Acceptance:** The standard discovery loop now searches this class of post in addition to broad technical keywords without additional slots or a new collection service.

### 2. Observe why a post spreads

**Files:** viral_style.js; scout.js

**Input/output:** Observed X text/media/metrics -> existing hook/style classification and Scout cards.

**Work:** Identify unexpected-capability hooks, free-resource promises, website/app lists, and visual demonstrations. Show the discovered hook and style as *hypotheses*, not voice instructions. Compute observed bookmarks per 1,000 views only when both measures are present; apply a capped soft selection hint, not a publishing gate.

**Acceptance:** The CarPlay-like example can be recognized as an unexpected capability, a 50-sites list as a curated resource. Unavailable saves do not become zero, and no structure label authorizes publication.

### 3. Write useful discoveries in the owner's voice

**Files:** growth_agent_runner.js; docs/POST_GENERATION_PROMPT.md; docs/EDITORIAL_RECOMMENDATION_PROMPT.md; docs/NICHE_AND_KEYWORDS.md; docs/AGENT_WORKFLOW.md; docs/PERSISTENT_GROWTH_OPERATOR_PROMPT.md; docs/GROWTH_OS_MOMENTUM_OPERATOR.md; AGENTS.md.

**Input/output:** Existing research candidate + source + primary verification + active persona -> existing Original, Quote, Thread, Repost, Reply, or research-only decision -> Writer and normal review gates.

**Work:** Assess the hook's true promise; name the actual reader payoff, real source, prerequisites, compatibility, cost and limitation, and distinct contribution. Use an Original only when it stands on its own with something new; a Quote if the demo/creator context is material; a real Thread when multiple nonredundant steps justify one; a Repost for unchanged sharing. Include a direct project link when utility requires it. Do not treat a clip or image displayed on X as reusable media. Perform up to two internal passes reviewing hook clarity, truth, originality and persona; existing independent gates remain authoritative.

**Acceptance:** The operator distinguishes inspiration from source truth, keeps Hamza's persona, and does not claim that the quick text-only act path has working image or thread upload.

## B. Upgrade existing visible experiences — Discover evidence display integrated; further polish proposed

### 4. Present useful-discovery evidence inside Discover and Learn

**Files:** web_api.js; ui/src/api/client.ts; ui/src/features/discover/Discover.tsx (initial hook/format/bookmark observations integrated); ui/src/features/viral/ViralStyles.tsx (existing hook breakdown retained; improved comparative filtering still proposed).

**Interfaces:** Existing candidate cards, virality report, hook/style tags, observed media and metrics.

**Work:** Display source-linked capability/demo tags, observed bookmark rate with denominator, visual media indicators and a route to the existing saved/draft workflow. Preserve evidence class, author-matched comparison and actual metric age in Viral Styles. Never display a synthetic probability of going viral.

**Acceptance:** Someone seeing an interesting For You or viral post can trace its hook, inspect its source, and choose the existing content route without visiting a new section.

### 5. Finish media and multi-post content through existing governed publishing

**Files:** docs/AGENT_WORKFLOW.md and existing draft/media/queue interface code only if a concrete missing operation is identified.

**Interfaces:** Current ingest, route, writer-packet, apply-writer-output, .x-media uploader, browser-publish-claim, publication-attempt-send-start and record-action.

**Work:** Collect or make legally usable evidence media, save an immutable approved attachment and alt text, and publish only after the exact artifact and text pass gates. When no lawful/usable asset exists, provide the project's link, choose a source-dependent Quote, or defer. For meaningful multi-step instructions, use approved Thread parts with distinct content and verify their sequence. Unsupported remote videos do not become successful attachments.

**Acceptance:** A publication's claimed media and each Thread part match the approved snapshot, source attribution, and reconciled live output.

## C. Evidence-backed, bounded continuous improvement — proposed

### 6. Learn from account-owned outcomes, not viral inspiration alone

**Files:** growth_performance_learning.js, existing editorial strategy and experiment/learning integration, and docs/PERSISTENT_GROWTH_OPERATOR_PROMPT.md.

**Interfaces:** Existing analytics-record, growth-analysis, experiments, experiment-summary, learning, learning-refresh, learning-accept, and Writing Strategy off/suggest/apply.

**Cycle:** Observe source and audience -> research and verify -> choose a purposeful format -> draft -> critique in bounded passes -> publish through existing authority -> measure at comparable post ages -> compare with the account's own baselines -> suggest one narrow change -> accept only with repeated eligible evidence. If actual bookmarks, profile visits, follower quality, author-cohort data or comparable owned samples are absent, say so and do not claim causality.

**Acceptance:** Strategy evolves only through auditable current experiment/learning records and existing authority. No self-rewriting prompts, infinite critique, one-post overfit or bypass of persona and review gates.

## Rollout

**Review branch:** Phase A plus source-shape/bookmark evidence shown in existing Discover cards; no live X actions, no production main change, no UI new tab. Check syntax and diff before merge.

**First deployment:** After review and safe production update, monitor current source health, X query errors, freshness, and actual editorial picks. Cross-topic search results are candidates, not automatic posts.

**Follow-up:** Complete the remainder of Phase B within existing Discover/Learn/Create surfaces, then Phase C once genuine owned performance samples exist. Avoid introducing an unrequested media generation service just to fulfill the plan.

**Out of scope:** DM crawling; bulk near-copying sources; misleading hands-on claims; reusing creator videos without permission; forcing entertainment/health content into the core technical account; and autonomous rewriting of safety policy.
