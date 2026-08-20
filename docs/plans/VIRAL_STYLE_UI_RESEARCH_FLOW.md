# Viral Styles Research UI Implementation Plan

**Implementation status (2026-08-20): Implemented.** The React tab, bounded web research job, selectable historical/niche/discovery controls, Phase-6 AI model selection, AI intent cache, explicit progress checkpoints/activity history, and intent/niche-aware retrospective views are integrated. Opening the tab remains read-only; collection/inference starts only from the explicit Run research action.

**Goal:** Expose the viral-style research system as an operator-controlled React tab where the user chooses historical scope, niche coverage, discovery thresholds, thread/control depth, and the exact Phase-6 AI profile/runtime/model used for semantic intent analysis.

**Architecture:** Keep deterministic collection/style metrics in the existing `viral_style_research.js` + `viral_style.js` owners, semantic intent in `viral_style_intent.js` through `runStructuredAI()`, and retrospective statistics in `viral_style_analyze.js`. Add one bounded sweep orchestrator, one in-process web job facade, and one React `Viral Styles` tab. Expensive collection or inference occurs only after an explicit user action.

**Tech Stack:** Node.js, existing X read-only scraper, existing Phase-6 structured AI runtime, React, TanStack Query, Tailwind.

## Global Constraints

- The operator selects the research scope; opening the page performs reads only.
- Historical windows: 14, 21, or 30 days.
- Niche choices come from the existing seven `NICHE_GROUPS`; do not invent a parallel taxonomy.
- Discovery floors are candidate filters, not virality claims: `breakout` = min_faves:30/min_retweets:3/min_replies:2; `strong` = min_faves:100/min_retweets:10/min_replies:5.
- Semantic author intent must use `runStructuredAI()` and an explicit configured AI profile or explicit installed runtime/model. Do not infer private psychology; classify only text-supported communicative intent.
- AI intent output must include constrained labels, confidence, short rationale, exact evidence spans, and runtime/model provenance.
- Cached AI intent labels prevent repeat token spend unless the operator explicitly asks to refresh.
- Collection remains read-only on X. No like/follow/reply/repost/publish actions.
- No tests are authorized.

## User flow

1. Open **Viral Styles**.
2. Read current dataset/evidence summary without starting collection or model calls.
3. Configure **Research scope**: date window, niches, discovery floor, result limit, controls, threads.
4. Configure **AI semantic analysis**: off, AI Settings profile, or structured CLI runtime + exact model/reasoning.
5. Review an explicit run summary estimating the number of search jobs before starting.
6. Press **Run research**.
7. Watch live state through explicit checkpoints: `queued -> discovering -> enriching -> controls -> threads -> intent_ai -> analyzing -> exporting -> complete`, with current niche/window/threshold, completed jobs, per-query candidate progress, discovered/saved counts, errors, AI batches, elapsed time, and a bounded activity log.
8. When collection finishes, semantic intent enrichment runs if enabled, then the retrospective report regenerates.
9. Browse findings by **Supported**, **Directional**, **Intent**, **Niche**, and **Posts**.
10. Inspect individual posts with text, normalized metrics, hook/style features, AI intent/confidence/evidence, source query, author size, and thread completeness.

## Progress checkpoint contract

The web job owns one in-memory checkpoint stream for the current run. It is observable through the status API and is not persisted as a second research ledger. Checkpoints are:

```text
queued
discovering
enriching
controls
threads
intent_ai
analyzing
exporting
complete | stopped | failed
```

Each checkpoint event contains `at`, `checkpoint`, `message`, and bounded contextual details. The job status also exposes a monotonically non-decreasing `progressPercent` and the current bounded unit counts. The React tab renders both a progress bar and the recent activity stream. Stop is cooperative and takes effect between bounded candidate/search/AI-batch units.

### Task 1: Complete sweep + AI intent owners

**Files:**
- Create: `viral_style_sweep.js`
- Create: `viral_style_intent.js`
- Modify: `viral_style_analyze.js`

**Interfaces:**
- Consumes: `NICHE_GROUPS`, `viralStyleResearch.collect()`, `runStructuredAI()`, gitignored research JSONL.
- Produces: bounded sweep progress events, cached AI intent rows, intent/niche-aware retrospective reports.

**Acceptance criteria:**
- All requested niche/window/threshold jobs are explicit and observable.
- Intent classification uses the selected Phase-6 AI runtime/profile and exact model, with no hidden browsing or model substitution.

### Task 2: Add web research job facade

**Files:**
- Modify: `web_api.js`

**Interfaces:**
- Produces: `GET /api/viral-research`, `POST /api/viral-research/run`, `POST /api/viral-research/stop`, and read-only report/post detail data.

**Acceptance criteria:**
- GET is read-only.
- Run rejects a second concurrent job.
- Stop requests cancellation between bounded sweep/intent units.
- Consequential X publication authority remains untouched.

### Task 3: Add React Viral Styles tab

**Files:**
- Create: `ui/src/features/viral/ViralStyles.tsx`
- Modify: `ui/src/api/client.ts`
- Modify: `ui/src/App.tsx`

**Interfaces:**
- Consumes: viral research API plus existing AI profile/runtime/catalog APIs.
- Produces: operator-controlled research builder, live progress, findings, and evidence inspection.

**Acceptance criteria:**
- Every expensive setting is visible before Run.
- Exact AI profile/runtime/model is visible in the form and result provenance.
- No collection or inference occurs merely by visiting the page.

### Task 4: Document current findings and operational contract

**Files:**
- Create: `docs/VIRAL_STYLE_FINDINGS_2026-08-20.md`
- Modify: `docs/plans/README.md`

**Acceptance criteria:**
- Baseline 83-post findings are preserved separately from subsequent all-niche runs.
- Report distinguishes deterministic style features from AI semantic intent and makes confidence/sample-size limitations explicit.
