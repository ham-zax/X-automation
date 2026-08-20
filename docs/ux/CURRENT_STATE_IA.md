# Current React Information Architecture

**Audit date:** 2026-08-20
**Audited baseline:** `004f7fc` on `agent/w7-ux-audit`
**Scope:** current React shell and the backend authority it exposes; this is not a proposed IA.

## Evidence discipline

This document uses three evidence classes deliberately:

- **Repository-observed** — visible route, label, object, action, or state is directly present in the current repository.
- **Likely novice failure hypothesis** — a usability risk inferred from the current product; it is not a user-research finding.
- **Research question** — a question that requires real users, analytics, or another empirical method.

The route inventory below is repository-observed. User goals and failure hypotheses are explicitly labeled as inference.

## React shell

**Repository-observed.** `ui/src/App.tsx` exposes eight peer destinations in the persistent primary navigation:

1. `Today` — `#/today`
2. `Discover` — `#/discover`
3. `Viral Styles` — `#/viral`
4. `Conversations` — `#/conversations`
5. `Posts` — `#/create`
6. `Performance` — `#/results`
7. `Experiments` — `#/improve`
8. `Diagnostics` — `#/advanced`

The same router also owns detail routes that are not primary-navigation entries: conversation detail, draft detail, Audience quality, AI Settings, and Your niche. Unknown hash routes silently render Today.

The primary labels mix different organizing principles:

- user goals or temporal orientation: `Today`;
- work objects/workspaces: `Conversations`, `Posts`;
- acquisition/review activity: `Discover`;
- analysis/research methods: `Viral Styles`, `Experiments`;
- outcome reporting: `Performance`;
- system/advanced access: `Diagnostics`.

This mixture is an observed property of the shell. It is not evidence that any alternate IA is preferable.

## Route inventory

| Route / visible entry | Visible purpose | Principal objects | Principal actions | Likely user goal — **inference** | IA classification | Dependencies and cross-links the user must currently follow |
| --- | --- | --- | --- | --- | --- | --- |
| `#/today` — **Today** | Shows current counts, AI Editorial Plan, work that needs attention, account status, and the next scheduled post | `TodayAction`, editorial recommendations, source freshness, account-health summary, schedule summary | Change editorial goal; refresh sources/recommendations; select or dismiss recommendation; attach research source; open an attention item | Decide what deserves attention now and take the next safe action | Goal/home surface plus recommendation analysis | Editorial selections leave Today for Draft, Posts, or Conversations; account-status detail lives in Performance/legacy health; scheduling detail lives in Posts |
| `#/discover` — **Discover** | Reviews persisted source candidates and current source snapshots | candidates, source snapshots, queue state, bookmarks, editorial-plan linkage | Change source/feed; refresh source; draft/reopen as original/quote/thread/reply; bookmark; discard; skip; open source | Find a useful source and decide what to do with it | Work intake / work-object inventory | Draft actions jump to Draft; workflow status comes from Posts/Conversations; editorial-plan state can originate on Today |
| `#/viral` — **Viral Styles** | Runs retrospective X research and inspects association/intent/style findings | research configuration, background research job, stored posts, association groups, AI intent/style labels | Configure scope; choose AI profile/runtime/model; run; stop; inspect findings | Learn what presentation patterns appear associated with strong performance in an external dataset | Analysis/research method | AI configuration may require `AI Settings`; findings have no current direct handoff to a draft or learned-writing-strategy surface |
| `#/conversations` — **Conversations** | Separates active conversations from new opportunities | engagement queue items, relationship context, health state | Open conversation/opportunity | Continue an existing conversation or decide whether to enter a new one | Work-object list organized around a user job | Detail route owns generation/review/send; health constraints link to legacy account status |
| `#/conversations/:candidateKey` — conversation detail | Shows exact source, contribution, relationship context, reply draft, approval/send controls, and alternatives | engagement item, candidate, relationship, reply draft, gates, health | Generate reply; save/edit through embedded DraftEditor; check readiness; approve-and-send; send approved reply; quote instead; skip; expire | Prepare and send one useful reply safely | Work-object detail / consequential action surface | Reply draft editing is shared with DraftEditor; a standalone reply Draft route sends the user back here for the actual send boundary |
| `#/create` — **Posts** | Shows main-feed queue grouped by lifecycle status | main-feed queue items, drafts, approval state, schedule plan | Route content type; save schedule; open draft; discard; review; approve; approve/record repost | Move selected source work from decision through draft, approval, and publication planning | Work-object lifecycle/workspace | Draft detail owns editing; publication itself is background automation when enabled/due; manual repost occurs on X and is only recorded here |
| `#/draft/:draftId` — draft detail | Edits the exact post/reply text and shows gates, quality feedback, AI generation, approval state, and publication/send handoff | draft, candidate, queue item, quality/gates, media plan | Generate/regenerate; edit; preview; save; check readiness; approve main-feed draft | Produce and verify the exact text before approval | Work-object detail / authoring | Main-feed schedule is in Posts after approval; reply sending is in Conversations; source opens externally |
| `#/results` — **Performance** | Summarizes account, audience, conversation, publication, and editorial outcome observations | account snapshots, follower quality, conversation metrics, health summary, publication measurements, editorial outcome cohorts | Refresh account metrics; open Audience quality; inspect detailed measurements | Understand what outcomes occurred without overclaiming causality | Goal/outcome analysis | Audience quality is a subroute; detailed health goes to legacy account status |
| `#/results/audience` — **Audience quality** | Reviews observed follower/following fit and single-account cleanup | audience profiles, fit classifications, AI review suggestions | Ask AI to review following; unfollow one account; view X profile; edit niche | Judge whether the observed audience/following fits the desired technical network | Outcome analysis plus account management | Niche criteria are edited under Diagnostics; AI review configuration is under AI Settings |
| `#/improve` — **Experiments** | Creates explicit tests, attaches variants, reviews measured evidence, and governs learned rules | tests, assignments, summaries, learned-rule suggestions/accepted rules | Create/activate/complete test; assign option; check for pattern; accept/retire learned change | Run a deliberate comparison and decide whether a bounded recommendation should change | Analysis/learning method | Effects of accepted learned rules appear later in recommendations/scoring; there is no current draft-time writing-strategy synthesis with Viral Styles |
| `#/advanced` — **Diagnostics** | Links to detailed/system views behind the main workflow | navigation cards only | Open Your niche, AI Settings, Relationships, Account status | Inspect or configure advanced system behavior | System/advanced hub | Two destinations are React settings; two leave the React hash router for legacy views |
| `#/advanced/ai` — **AI Settings** | Configures runtime/provider/model profiles and role bindings and exposes execution provenance | AI profiles, default profile, role bindings, runtimes, secrets, model catalogs, recent runs | Create/save/delete/enable profile; change key; assign default/role/fallback; test/check; refresh catalog | Configure the advisory AI execution layer | System/configuration, explicitly advanced | Viral research can depend on these profiles; settings affect advisory AI roles but not approval/routing/scheduling/publication authority |
| `#/advanced/niche` — **Your niche** | Edits topic and audience-fit terms | niche profile groups and term lists | Save niche; reset defaults | Change what the product treats as relevant for classification/audience-fit review | Strategy/configuration, advanced | Current note explicitly says this does **not** rewrite live X source-search queries; Audience links here |

## Cross-surface legacy destinations

**Repository-observed.** The React product intentionally links out of the hash router for two advanced details:

- `/legacy?source=relationships` — strategic relationship profiles and stages;
- `/legacy?source=health` — account-health evidence, repetition, saturation, and visibility provenance.

These are reachable from Diagnostics; health is also linked contextually from Conversations and Performance. They are part of the current operator journey even though they are not React routes in `App.tsx`.

## Current workflow topology

### Main-feed work

**Repository-observed.** The current visible lifecycle is distributed across several screens:

`Today/Discover recommendation or source` → `selection/routing` → `Draft` → `Needs review` → `Approved` → `Posts publishing plan` → `Publishing` → `Published` or `Action failed`.

Important authority boundaries:

- an editorial recommendation is advisory;
- selecting a recommendation records selection provenance and routes a queue item;
- selecting a text recommendation creates a draft scaffold but does not itself run AI generation;
- Discover's `Draft original/quote/thread/reply` actions do run initial AI generation when no draft exists;
- `Check readiness` evaluates the current draft and does not approve/publish;
- `Approve for publishing` records human approval and does not publish;
- `Save plan` changes timing/expiry metadata and does not approve/publish;
- there is no ordinary React `Publish now` control for main-feed posts; approved eligible posts are published by the existing automation path only when that mode is enabled;
- reposts remain manual on X, then `Mark reposted` records completion.

### Reply work

**Repository-observed.** Reply work is a separate engagement lane:

`Conversation/opportunity` → `Generate reply` → `edit/save` → `Check readiness` → either `Approve & send exact reply` or an already-approved `Send approved reply` → `Published`/sent, with failure/reconciliation states preserved by the backend.

Replies are never scheduled by the main-feed scheduler.

## Current information dependencies

**Repository-observed.** The following dependencies are visible in the present shell:

- Today depends on the operator understanding that its **AI Editorial Plan** is advisory while **Needs your attention** contains currently queued decisions/actions.
- Discover candidates can display both editorial-plan state and queue state, so source history and workflow state coexist on one card.
- Draft detail is not a self-contained lifecycle surface: approved main-feed drafts point to Posts for publishing plans; reply drafts point to Conversations for sending.
- Performance is the entry point to Audience quality, but niche criteria that explain audience fit live under Diagnostics.
- Viral Styles may require AI Settings knowledge when semantic analysis is enabled.
- Experiments contains internal account learning, while Viral Styles contains external retrospective evidence. There is no current synthesis surface joining those evidence classes to a draft-time strategy choice.

## Likely novice failure hypotheses

These are **inferences**, not observed user behavior.

1. **Two competing meanings of “what should I do now.”** Today first presents an `AI Editorial Plan` headed “What is worth doing now?” and only afterward presents `Needs your attention`. A novice may treat an optional recommendation as more urgent than a queued review/conversation/account constraint.
2. **Method-oriented peers may weaken findability.** `Viral Styles`, `Experiments`, and `Diagnostics` sit beside day-to-day work objects. An occasional operator may not know whether a question belongs in Performance, Experiments, Viral Styles, or Diagnostics without first knowing the product architecture.
3. **Lifecycle handoffs can become recall work.** A returning reviewer may remember the draft but not whether scheduling lives in Draft or Posts, or whether a reply can send from Draft versus Conversation detail.
4. **“Diagnostics” may not predict configuration.** Your niche and AI Settings are configuration surfaces, not only diagnostics. A user looking to change topic fit or AI model may not search under that label.
5. **Advanced research setup may dominate the goal.** Viral Styles exposes date windows, discovery floors, sample controls, thread reconstruction, runtime/model, and reasoning choices before a research run. An occasional user may need implementation knowledge before reaching the analysis goal.

## Research questions

These require real user evidence:

1. When operators open Today, do they distinguish advisory Editorial Plan items from work that already `Needs your attention` without coaching?
2. What labels do first-time and occasional users choose for finding external style research, account-specific learned patterns, audience quality, AI configuration, and niche configuration?
3. After approving a main-feed draft, can an occasional reviewer predict where timing/publication state lives one week later?
4. When a reply draft is open, do users correctly predict that the send boundary is Conversation detail rather than the standalone Draft route?
5. Does exposing bare recommendation scores (`Reach`, `Follow`, `Relationship`, `Objective fit`) improve confidence or create false precision?
6. Which Viral Styles controls do ordinary operators actually need before starting a useful run, and which should remain expert-only?
7. Where do users expect a future external/internal evidence synthesis and `Off / Suggest / Apply` writing-strategy choice to live?
8. Do users look under `Diagnostics` for AI model/profile changes and niche definition, or do they expect a settings/strategy destination?

## Complexity that is currently advanced

**Repository-observed.** The following detail is useful for advanced operation and provenance but is not necessary to describe the ordinary publishing/send authority model:

- exact AI runtime/provider/model/reasoning, capability state, secrets, catalogs, role resolution, and run provenance;
- Viral Styles discovery thresholds, same-author controls, exact research checkpoints, and exact AI execution configuration;
- raw experiment population JSON, metric identifiers, cohort/confounder detail, and learned-rule match/adjustment internals;
- raw health/relationship provenance in legacy views;
- technical recommendation mechanisms and AI provenance under disclosures.

This audit does not decide whether those capabilities move, collapse, or remain where they are. Their current presence and current access paths are the observed facts.

## Evidence anchors

Primary implementation anchors used for this inventory:

- `ui/src/App.tsx`
- `ui/src/features/today/Today.tsx`
- `ui/src/features/discover/Discover.tsx`
- `ui/src/features/viral/ViralStyles.tsx`
- `ui/src/features/conversations/Conversations.tsx`
- `ui/src/features/conversations/ConversationDetail.tsx`
- `ui/src/features/create/Create.tsx`
- `ui/src/features/create/DraftPage.tsx`
- `ui/src/features/create/DraftEditor.tsx`
- `ui/src/features/results/Results.tsx`
- `ui/src/features/results/Audience.tsx`
- `ui/src/features/improve/Improve.tsx`
- `ui/src/features/advanced/Advanced.tsx`
- `ui/src/features/settings/AISettings.tsx`
- `ui/src/features/settings/NicheSettings.tsx`
- `ui/src/api/client.ts`
- `web_api.js`
- `pipeline.js`
- `editorial.js`
- `audience.js`
