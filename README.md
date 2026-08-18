# X Research & Publishing Automation

Local Node.js automation for discovering technology momentum, ranking candidates for `@ham_zax`, and publishing to X through authenticated HTTP GraphQL. Browser posting remains available only as an explicit fallback.

## Components

- `x_http.js` — validates the cookie session, discovers the live `CreateTweet` operation ID from X's current web bundle, and performs HTTP GraphQL writes.
- `post_thread.js` — dry-run, HTTP session check, HTTP thread publishing, or explicit `--browser` publishing.
- `tech_news.js` — Hacker News, emerging GitHub repositories, X source feeds, relevance/freshness/momentum scoring, and post previews.
- `automation.js` — local polling daemon with threshold, cooldown, and duplicate prevention.

## Setup

Copy the non-secret settings you want from `.env.example` into `.env`. HTTP writes require both `AUTH_TOKEN` and `CT0`.

```bash
npm run http:check
```

That command validates the authenticated HTTP session and resolves X's current `CreateTweet` GraphQL operation without publishing anything.

## Research

```bash
npm run news
node tech_news.js --ranked --to-post
node tech_news.js --hn --limit=10
node tech_news.js --github --limit=10
node tech_news.js --x --limit=3
node tech_news.js --json --limit=5
```

GitHub candidates are restricted to recently created repositories and ranked by star velocity, rather than lifetime star count. `TOPICS` and `X_NEWS_ACCOUNTS` in `.env` control account-specific relevance and sources.

## Publishing

```bash
# Validate only; no X write
node post_thread.js --dry-run "preview only"

# Direct authenticated HTTP GraphQL (default)
node post_thread.js "first post" "reply in the thread"

# Explicit browser fallback
node post_thread.js --browser "browser-mode post"
```

HTTP mode fails closed if the session or live operation discovery cannot be validated. It does not silently switch to browser automation.

## Automation

```bash
# One research/decision cycle. AUTO_POST=false previews only.
npm run automation:once

# Keep polling while this process/PC environment is running.
npm run automation
```

Key settings:

```dotenv
POLL_MINUTES=30
POST_INTERVAL_HOURS=4
MIN_MOMENTUM_SCORE=70
AUTO_POST=false
```

Set `AUTO_POST=true` only after the generated previews meet the quality bar you want. Autonomous posts currently use Hacker News and GitHub candidates; X posts are discovery signals only until a stronger synthesis layer is added. Successful posts are recorded in `.automation-state.json` so the same candidate is not posted again.

## Web preview

```bash
npm run web
```

Then open `http://localhost:3030`. It shows the ranked candidates, highlights the item the automation would choose, and displays the exact generated post text. Refreshing the page refreshes the research.

## Important limitation

This project uses X's internal web GraphQL interface, not the official X API. Query IDs and private endpoints can change without notice, and automated use may carry platform-account risk. The live query-ID discovery removes one common breakage mode, but cannot make an unofficial interface contractually stable.
