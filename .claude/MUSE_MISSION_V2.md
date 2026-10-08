# Mission V2: a working 24/7 reply / quote / post agent (WSL, Muse)

You are the engineer for `/home/hamza/repo/x_test` (the `@ham_zax` Growth OS). The previous mission
(`.claude/MUSE_MISSION.md`, patching the 13-step pipeline) is cancelled. The owner approved a simpler
architecture on 2026-10-08. Read `AGENTS.md` (the invariants you will amend), `.claude/HANDOFF.md`, then this.

## Why (measured)
At 62 followers, and over 2 days: 14 confirmed outputs, 0 quotes, 14 of 52 browser attempts `closed_unresolved`
(uncertain send outcome), and no main-feed approval since 10-07 07:56. Run 96 (Muse) spent 13 min on one
draft, was rejected at 34/50 ("unattributed claim"), and posted nothing. Causes:
- subjective blocking gates: the 50-point score and the LLM content review;
- a ~13-call LLM-driven bridge ceremony for each post;
- every pass reads 8 docs and re-scrapes For You;
- the LLM itself clicks the browser (quote never worked; output verification is weak);
- one-shot reply generation;
- 4h spacing.

## Target architecture
1. **`act` (deterministic, one call).** A new bridge command, `npm run --silent agent -- act`. JSON in:
   `{action: reply|quote|original, text, targetUrl?, targetTweetId?, candidateKey?, runId?, sessionId?, card?}`.
   Steps in one process:
   - hard checks (below);
   - create and claim a `publication_attempts` row (reuse store functions, transport `browser_agent`), then
     send-start;
   - drive the logged-in Windows Chrome through the WebHarness agent-browser CLI
     (`growth_agent_runner.js` `runtimeConfig`: agentBrowserCli, cdpPort 9222), in a named session. Direct
     CDP is allowed only if the CLI cannot do the job; say why in the report. The legacy `x_browser_publish.js`
     xactions writer stays disabled.
   - Target integrity comes by construction, using X web intent URLs:
     - reply: `https://x.com/intent/post?in_reply_to=<id>&text=<enc>`;
     - quote: a new post whose text ends with the source status URL (X embeds it as a quote);
     - original: `intent/post?text=`.
     Verify the prefilled composer text and reply context, then click the Post button once.
   - Definitive outcome: capture the CreateTweet GraphQL response (rest_id, in_reply_to / quoted status)
     through the CLI's network facility or CDP. Fall back to the toast "View" link or a profile check. Then:
     - success: `record-action` `confirmed_published` with output URL and evidence;
     - the click never dispatched: `confirmed_not_sent` with the proof the contract requires;
     - anything else: `closed_unresolved` with evidence. Never retry automatically.
   - Record the relationship event and candidate action exactly once (as Engage Next does now).
   - Live-verify the quote-by-URL embed once before relying on it. If X does not embed it, implement
     Repost-menu → Quote in the deterministic script instead.
2. **`scout` (deterministic, no LLM).** A bridge command that returns ranked **action cards**:
   `{cardId, action, targetUrl, targetTweetId, author, sourceText, context(thread/parent text), why,
   scoreBreakdown, expiresAt}`. Reuse the existing sources and scorers: `source_refresh.js` (X Latest/Momentum),
   `x_discovery.js`, `engagement.js`, `opportunity.js`, `growth-next`, GitHub Trending/HN, Growth Focus.
   The owner's rubric:
   - **T0, conversation:** someone replied to, quoted, or mentioned us → reply back when there is a purpose.
     Highest priority. Find our existing notifications/relationship ingestion; add a read source if none exists.
   - **T1, viral:** a relevant dev/AI/tech post crossing a velocity threshold (engagement per minute, scaled to
     author size), fresh (reply window ≈ ≤90 min, longer for huge threads), with reply room (not buried).
     Action: reply. Also quote when it is one of the biggest and has room for a distinct take. The owner
     prefers both replies and quotes.
   - **T2, original:** a useful dev/AI post seeded from GitHub Trending/HN/live trends ("how devs actually
     use X"). Target 2–4 per day.
   - **Volume is dynamic. No cap, no quota.** Every card above threshold is actionable ("if 10 go viral, 10 it
     is"). Daily floor: 15–20 replies. When behind the floor pace for the time of day, relax the threshold
     step by step, never below the relevance floor.
   - Repeat-author and saturation stay soft penalties (AGENTS.md).
   - Account Health CONSTRAINED pauses public actions; WATCH only logs.
   - Spacing: about 90 min between originals and about 30 min between any two main-feed posts (quote or
     original). Replies have no spacing. Put this in `scheduler.js`, not in the prompt.
   - Cards already acted on, skipped, or fenced never resurface.
3. **Executor loop (LLM + `act`).** A compact operator prompt in `growth_agent_runner.js` for delegated Live
   runs:
   - one short voice guide (≤1 page, derived from `persona/hamza-v1.json` and `docs/POST_GENERATION_PROMPT.md`)
     plus AGENTS.md hard limits;
   - no reading of 8 docs, no route / writing-strategy / writer-packet / update-draft / mission-approve chain;
   - loop: `scout` → open the target if more context is needed → write the text → `act` → next card, until the
     window ends;
   - `growth-run-begin/finish` and the lease stay;
   - an unknown-outcome attempt still blocks re-sending that target.
   The old pipeline stays available for the human dashboard lane; do not delete it.
4. **Runner resilience for 24/7.** Classify runtime failures: rate limit 429, deadline, startup stall,
   agent error. Keep the durable run resumable, back off, and relaunch the next pass inside the window
   instead of closing `capability_unavailable`. Preserve orphan-resume and attempt ownership
   (b69cc21, 3fdb9b2, 26c6d5e, 5a5db32).

## Gate policy (owner-approved; amend AGENTS.md and the operating docs to match)
- **Hard, objective, fast:**
  - duplicate target and duplicate/near-copy text fence;
  - never re-send a target with an investigating or `closed_unresolved` attempt;
  - Account Health CONSTRAINED;
  - length and format, no placeholders;
  - the live autonomous-reply / delegation grant still exists (it is the owner's authority).
- **Auto-fix, not reject:** a number or "X announced/says" claim must name its source. `act` returns a
  structured `needs_rewrite` with the reason (cheap deterministic check); the executor rewrites once.
- **Advisory:** the 50-point score, the LLM content/factual review, persona tone, and the approval
  ceremony. Compute them where it is cheap, log them on the attempt, and use them for ranking and learning.
  Never block with them.
- Delegated `act` never sets `humanApprovedAt`. The dashboard's human lane keeps its current gates.

## Order and checkpoints (update `.claude/MUSE_REPORT.md` after each; overwrite, ≤80 lines)
1. `act` for reply. Live: one real, purposeful reply on a fresh relevant viral post, confirmed with its URL.
2. `act` for quote and original. Live: one of each, both confirmed. These 3 live tests are the only public
   actions you take directly; make them real, useful content, never "test".
3. `scout` with the rubric, then the executor prompt and loop, then the scheduler spacing, then the gate
   demotion plus AGENTS.md/docs.
4. Runner resilience.
5. Unattended run: `X_GROWTH_AGENT_RUNTIME=muse X_GROWTH_AGENT_WINDOW_MINUTES=60 npm run --silent growth-agent
   > .claude/runs/run-$(date +%s).log 2>&1` (background; poll the log and the DB read-only). Fix, then repeat.
   Never edit code while a runner is live; never run two runners.
- Tests: affected files only, `systemd-run --user --scope -q -p MemoryMax=5G -p MemorySwapMax=0 -- node --test
  tests/<file>.test.mjs`. Add focused tests for `act` checks, `scout` ranking/floor, and spacing. Run the full
  `npm test` once (same cap) before the final report. Update tests that encode the old blocking policy;
  never delete tests to get green.

**Acceptance:** an unattended runner session, with no commands from you, confirms ≥3 replies and ≥1 quote or
original (attempts in `confirmed_published` with URLs), handles one T0 conversation card if one exists, and the
next session continues. `closed_unresolved` rate in that session ≤ 1 per 10 sends. Running is not evidence.

## Hard boundaries (violating any fails the mission)
- `.x-research.sqlite` writes only through the bridge; `sqlite3 -readonly` for reads.
- Never set or fake `humanApprovedAt`; never click dashboard approval/config; never enable `AUTO_POST`;
  never start continuous `automation.js`.
- Never blind-retry an uncertain send; never reopen a `closed_unresolved`/investigating attempt;
  `confirmed_not_sent` needs definitive transport evidence.
- Never print cookies, tokens, or API keys.
- No git commit/push/stash/reset; leave changes unstaged.
- No nemotron/ling models. Don't touch ARM, systemd units, or opencode2api.
- WSL is the only operator; the ARM timers are stopped.
- Escalate (write it in the report and continue with other items) on: schema migrations beyond additive
  columns/tables, anything that removes the owner's grant/revocation control, or behaviour beyond this brief.

Stop when acceptance is met and a following session continues cleanly, after ~5 hours, or if Muse quota runs
out. Finish by stating exactly what is and is not verified, with attempt IDs and URLs.
