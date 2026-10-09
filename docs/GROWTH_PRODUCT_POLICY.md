# XGrowth product controls, performance learning and analytics agent

## Single source of truth

Use **Settings → Publishing strategy** (`#/settings/publishing`) or the authenticated `GET/POST /api/growth-policy` endpoints. The JSON policy lives in SQLite `app_state.growth_product_policy_v1`, not a duplicated scheduler/prompt environment setting. The existing **Voice & preferences** screen remains the identity/stances authority; `policy.editorial.voiceGuidance` is additional and cannot authorize impersonation, fabrication or override real owner facts. The API validates the entire versioned schema, rejects unknown keys and requires `confirmChange: true` for writes. The CLI read-only command `npm run --silent agent -- growth-policy` shows the same policy and current observed follower tier.

- `activity`: IANA timezone, HH:MM rest window, normal full-feed discovery interval (the host still performs short breaking-event probes every five minutes).
- `lanes.reply|quote|original`: on/off, priority, editorial selectivity and optional rolling-24h `dailyLimit`. **Null dailyLimit means unlimited**; only user-set values become hard claims gates. Uncertain sends count toward optional caps to avoid silent retries.
- `social.follow|like`: independently configurable enable switches, safety ceilings over a rolling 24 hours (defaults: max four follows and twenty likes, **never quotas**), minimum observed-source evidence, and recommendation priorities. Likes and Follows use their own durable claim/start/resolve ledger; uncertainty blocks duplicate action. Follows require at least two distinct useful posts by the same account, real live profile verification and a future-interest reason, not generic virality. Likes need the actual worthwhile post and are never automatic side-effects of replies. No automated Unfollow exists; humans retain full control of unfollowing.
- `editorial.interests`: independent ranking preferences for code/build examples, AI/model breakthroughs, tool discoveries, practical builder lessons and commentary. They do not blacklist unlisted topics. `voiceGuidance` is supplemental to the active persona.
- `breakthrough`: configurable recent-window engagement-density and independently measured likes/replies growth thresholds. A verified first-hand release/research breakthrough may override rest if the source, actual verification time, urgent value and distinct contribution are provided. Rest exceptions do **not** bypass grants, claims, factual/source review, health or duplicate-send fencing.
- `audience`: optional follower milestones and tier-specific editorial selectivity. Tiers update only from reasonably fresh **observed account follower metrics** or owner-profile follower counts recorded by the independent collector (`growth-followers-record`, account and capture-time validated). Increased reach lowers the evidence-completeness bar for useful standalone posts; it does not generate posts or assume followers were caused by any individual post.
- `learning`: measured analytics lookback and minimum comparable sample size. Learning is descriptive; weak data cannot silently rewrite persona or change product policy.

The claim path is transactionally authoritative for owner-enabled lane gates and user-set rolling limits. The prompt and scout provide opportunity judgments and factual review; numeric completeness cannot prove a claim true. Human manual actions outside a Growth Run are not restricted by inferred sleep hours. The operator run mutation ceiling remains separate for atomic resource accounting.

## Second agent: historical engagement collector

The independent `growth_analytics_runner.js`/`ops/analytics_collector_prompt.md` workflow is scheduled by `x-test-growth-analytics.timer`. It skips when another Growth Luna worker owns the active browser and records its own last start in private local state to prevent repeated costly agent launches. It never receives a growth-run publication lease. It uses the existing authenticated X Analytics screen in read-only mode and uses the bridge's `analytics-record` command to persist observed historical post and reply metrics; mandatory impressions, likes, replies and reposts must actually be visible. Missing analytics stay missing, never zero. No direct SQL writes or X mutations.

Commands:

```sh
printf '%s\n' '{}' | npm run --silent agent -- growth-policy
printf '%s\n' '{}' | npm run --silent agent -- growth-analysis
printf '%s\n' '{}' | npm run --silent agent -- growth-analysis-refresh
```

`analytics-record` now recomputes the performance-learning report after a confirmed local metric write. `growth-analysis-refresh` performs the same recalculation from stored observations without needing new browser access. Both are safe for another delegated, non-publishing analysis agent to call. `growth-analysis` exposes measured sample counts, style/pipeline comparisons, median impressions/engagement rates, examples, provenance and caveats. Growth Luna reads the current report before its next writing/selection loop. Empty/gated analytics is a valid result, not a reason to fabricate a performance snapshot.

The model comparison intentionally distinguishes observed engagement from causal follower conversion. Code snippets, tools and breaking analysis are compared using explicit text heuristics, not a claim to understand audience taste from one viral outlier. The product learning and observation data remain separate from owner persona and immutable publication ledger.

## Deployment

The production UI must be rebuilt (`npm run ui:build`) after checking out the commit. Install the optional analytics timer/service from `ops/systemd/arm/` to `~/.config/systemd/user/`, reload systemd and enable the analytics timer. Growth Luna's own recurring 5-minute discovery timer remains independent. The collector skips an active Growth worker and never starts `automation.js`.
