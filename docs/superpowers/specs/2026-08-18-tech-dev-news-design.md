# Tech & Dev News Aggregator Design Specification

- **Date:** 2026-08-18
- **Target File:** `/home/hamza/repo/x_test/tech_news.js`
- **Goal:** Provide a CLI script that aggregates real-time tech and developer news from multiple sources (Hacker News, GitHub Trending, and X/Twitter tech feeds via XActions).

---

## 1. Requirements

### 1.1 Data Sources
1. **Hacker News:**
   - Fetch top story IDs via Firebase API (`https://hacker-news.firebaseio.com/v0/topstories.json`).
   - Fetch metadata for the top N stories: title, URL, score, author, comments count.
2. **GitHub Trending:**
   - Fetch trending repositories via GitHub search / trending endpoints (`https://api.github.com/search/repositories?q=created:>...&sort=stars` and trending feeds).
   - Display repo full name, description, primary language, star count.
3. **X / Twitter Tech Posts:**
   - Fetch recent posts from key tech accounts (e.g. `@github`, `@ycombinator`, `@TechCrunch`, `@TheVerge`) using XActions public scraper (`scrapeTweets`).
   - Display text snippet, author, date, and engagement.

### 1.2 CLI Interface
- `node tech_news.js` -> Full news digest
- `node tech_news.js --hn` -> Filter Hacker News only
- `node tech_news.js --github` -> Filter GitHub only
- `node tech_news.js --x` -> Filter X/Twitter tech only
- `node tech_news.js --limit <N>` -> Custom limit per section (default: 5)
- `node tech_news.js --to-thread` -> Output as an X thread format compatible with `post_thread.js`

### 1.3 Resilience
- Parallel fetching with `Promise.allSettled`.
- Graceful fallbacks if any network source fails or times out.
