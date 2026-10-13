# Engagement ideas from the 13–14 October 2026 session

Status: notes for a later redesign. This is not a rule and not a plan of record. Nothing
here is integrated except where "Current state" says so. It records what the owner said,
what the data showed, what the X ranking code says and the options discussed, so a later
session can design the workflow for replies, quotes and posts from it.

Labels used below:

- **Verified**: read in this repository's source or state by the session's main agent.
- **Worker-reported**: found by a read-only audit worker on ARM, not re-checked.
- **Code-backed**: taken from guides that cite the open-source X ranking code. The source
  files themselves were not read in this session.
- **Third-party advice**: growth tips with no code or data behind them.

## 1. The goal as the owner stated it

- Maximum engagement and relevant followers; reach 1,000 followers as soon as possible.
- Replies, quotes and posts should all be built to earn engagement, not to look correct.
- A reply should read like a person in the conversation, not like an agent reviewing it.

## 2. What is wrong today

Evidence: the last 100 publication attempts on ARM (97 replies, 3 quotes, no originals,
threads, reposts, likes or follows), Account Health on 13 October, and the content audit
of the last 60 replies.

- The account is a reply account. 72-hour action mix: 95 replies, 2 quotes, one follow,
  one like, no original and no repost. Section 4 explains why this is the wrong mix for
  an account under 1,000 followers.
- 451 meaningful interactions in 7 days (447 of them initial replies), 0 author responses,
  0 continuations. This is at least partly a tracking gap (5.1), so the real response
  rate is unknown.
- One template dominates. Of the last 60 replies, 24 contain a question, 19 pair it with
  a "why it matters" clause ("that boundary/detail decides…") and 6 use "the useful part
  is…" or "interesting" phrasing.
- Reviewer tone: "I'd want…", "Measure…", "Track…", "Add…". The owner's words: "why am I
  trying to sound like a senior engineer, like I am trying to boss around or showing
  someone I am better than them".
- Questions go to brand accounts that will never answer ("as if OpenCode would ever
  reply to me"). Examples the owner rejected:
  - to @ArtificialAnlys: "Can the linked view expose the task definition and cache state
    behind each provider number?" (one engagement, one impression);
  - to @opencode: "What made Argon your team's second most-used model: code quality,
    speed or price?" The owner could not tell what the reply was for.
- The reply ignores the moment. OpenCode was riding the launch hype; people were curious
  what the new model can do. The reply asked the company a survey question instead.
- The agent reads only the one source post. It does not know what everyone else is
  saying about the topic.
- Bursts: 68 confirmed replies on 11 October (12 runs), 15 on 12 October, 12 on
  13 October; one burst of 9 replies in 44 minutes. No limit was breached
  (`reply.dailyLimit` is null), but many similar replies in a row is what gets an account
  muted (section 4).
- Saturation: five replies to `dankornas`, two to `jurlycat`; Account Health is WATCH,
  which is advisory. The last 60 replies still reached 55 distinct targets.
- The persona forbids most of this already (fake questions, benchmark-reviewer framing,
  analyst prose) and allows short social replies. It fails because it is abstract policy
  with two voice examples, and `verifiedOwnerExperiences`, `verifiedTools`,
  `verifiedResults` and `verifiedFailures` are empty. With nothing first-hand to say,
  the writer falls back to questions and advice.
- The brief requires `docs/POST_GENERATION_PROMPT.md` for Originals, Threads and Quotes
  but not for Replies, although that prompt has a Reply contract (line 413).

## 3. Ideas, by topic

### 3.1 Read the room before writing

- Before writing on a topic, read 5 to 50 top posts about it, and the top 10 to 20
  replies under the source.
- Only posts from the last 24 to 48 hours count as "what people are saying now". This
  matches the ranking code: posts older than 48 hours are filtered out (section 4).
- Extract what people actually report: "it is really good at role-playing", "it breaks
  on X", the running jokes, the open questions, which replies are getting the likes.
- Write from that background: the reply should sound like someone who has followed the
  topic all day.
- Open question: build this as a reusable per-topic digest (one research pass feeds
  several replies, quotes and a post) instead of repeating it per reply.
- Limit today: `x-read` `thread` returns the latest replies, not the top ones (maximum
  40), so "top replies" in a large thread needs a small change in `x_reads.js`.

### 3.2 Voice

- Short, casual, human. The owner's examples: "But does it work on Zen?", "trying out
  tonight", "weekend building incoming".
- Reactions, takes, jokes, agreement, plans. A question only when the owner would really
  want the answer and someone could give it.
- No grading and no hidden-metric framing. Advice is fine when the situation calls for
  it: someone is really asking, or someone believes a thing is the best way and a better
  one exists. The fault in section 2 is unasked advice as the default shape, most of all
  toward big companies. The owner: "it depends on the situation so be smart about it".
- Judgment over guardrails (owner, 14 October): prefer a small set of policies and the
  agent's best judgment for a dynamic reply over a long list of rules and banned
  phrases. Any check added later should catch the default-template failure, not forbid a
  shape outright.
- The persona needs many real voice examples in the owner's wording (30 to 50), not more
  policy.

### 3.3 Who to reply to

- Brand and big accounts are fine. Write for the people reading the thread, not for the
  brand. The owner's three options for a brand thread: wit and humor; a reply in the
  register of the top 10 to 20 replies there, to catch the same engagement; or a more
  thoughtful reply when there is something real to say.
- Users and peers too, including replies to a person's reply inside a big thread. They
  are the ones who answer back and follow.
- Peers matter most for ranking: between mutual follows a reply carries a much larger
  weight (section 4). A set of real peers who follow back is worth more than one more
  reply under a brand.
- Copy the register of what works, never the wording (near-copy rule).
- Missing data: target follower counts are not recorded, so "brand versus peer" cannot be
  analysed from history yet.

### 3.4 Having something of our own to say

- The owner wants replies such as "I built this with Argon" or "I tried it, it was this,
  it was that", because first-hand experience is what people engage with.
- The owner proposed letting the persona claim experience it does not have, built from
  what other people reported.
- Settled with the owner on 14 October: no invented first-person use of real products
  (it conflicts with `factualBiographyMustRemainGrounded` and content standard
  section 2.2, and it is the easiest thing for a reader to call out). Two framings are
  agreed instead:
  - Make it true. The agent has a server. It can run the new model or tool for a few
    minutes and report the real result, with a screenshot or snippet. That is real
    material for replies, quotes and posts, and a result is the kind of content people
    forward (section 4).
  - Crowd framing: "seeing a lot of people say it is great at X and falls over on Y".
- The owner can also fill the `verified*` lists with what they actually use and built.
  Real quick tests should be written there too, with date and evidence.

### 3.5 Engagement, not information

- Analyse what went viral on the topic in the last day or two and reuse the shape: the
  hook, the format, the kind of claim.
- Prefer content the reader wants to react to (a result, a take, a joke, a small demo)
  over content that explains what a product does.
- The inherent problem the owner named: "trying to tell what it does, asking question
  from cursor or big companies, not from user".
- Examples from the audit. Weak: "Getting the pixels right is the shallow part… Can REA
  surface those transitions yet?" Stronger, because it is concrete and usable: "Track
  time-to-first-token separately from inter-token latency…" (still advice-shaped; the
  target voice is 3.2).

### 3.6 Quotes and posts

Not discussed in detail with the owner; the owner wants the same thinking applied. The
ranking findings make this the largest change available.

- Originals are the only thing the small-account boost applies to (section 4). The
  account published none in the sample.
- A topic digest (3.1) is the natural source for an original: "what people found in the
  first 24 hours of X", or the agent's own short test of it (3.4).
- Write originals people forward: a result, a small demo, a short list, a comparison. A
  copied link is the heaviest positive signal in the ranking weights.
- A quote should add a take or a result on a post that is already moving, within the
  same 48-hour window. A quote is weighted like a reply.
- Space posts out. Several posts by one author in the same feed are scored down.
- Timing: launches and hype moments are when a small account can get reach, so the
  workflow should notice them and move the same day.

### 3.7 The topic brief workflow (owner, 14 October)

The owner's description, tidied, then the gaps filled in. This replaces "read one post,
write one reply" as the unit of work.

What the owner asked for:

1. Research the topic on X itself. Take the **top** posts (not the latest) from the last
   24 to 48 hours. Start with about 25 to 30 posts; tune the number once the system runs
   continuously and the best trade-off is known.
2. Write that data to a file in the repository.
3. Form a genuine opinion of our own from it, and write the opinion to a file as well,
   so later sessions can refer to it.
4. Use the opinion like a chapter. An original post takes the main point. A reply takes
   only the paragraph that fits the post it answers. Another reply, under a different
   post or under someone's reply, takes a different paragraph. Combine paragraphs where
   it fits, then pass the result through the persona.
5. Never in the advising or questioning shape of section 2. Questions as such are fine;
   acting as a big company's reviewer is not ("I don't have any problem questioning, but
   why am I acting…").
6. Learn what earns engagement: which kinds of reply and which kinds of post. The account
   has had viral posts before, so find them, see why they worked and make new ones in
   that shape from the last 7 days of data. Use the same data to refine the persona.
7. A human-in-the-loop view: the owner opens the local app, sees the most relevant posts
   and drafts, and marks each one review, check or post.

Gaps filled by the agent (proposals):

- **Files.** One directory per topic and day, for example
  `research/topics/2026-10-14-<topic>/` with `posts.json` (the collected posts: ID,
  author, text, metrics, time) and `brief.md` (the opinion). A brief expires after 48
  hours; an expired brief is history, not a source for new replies.
- **Shape of the brief.** Short numbered paragraphs, each one a single point with the
  post IDs behind it, in three kinds that must stay separate: what people report
  (attributed to them), what we tested ourselves (3.4, with evidence) and our take. Also
  a short list of the jokes and phrases the room is using, and the open questions nobody
  has answered.
- **Use tracking.** Each reply, quote or post records which brief and which paragraph it
  used. That stops two replies from saying the same thing, gives the duplicate guard
  something real to work with, and lets results be compared per paragraph and per shape.
- **Which topics.** Growth Focus topics that are moving today, plus whatever a launch
  puts at the top of For You. One or two briefs a day is enough to start.
- **Output per brief.** One original, possibly one quote, and a handful of replies spread
  over the day instead of in one burst (section 4: author diversity, mutes). These are
  bounds, never quotas; a brief with nothing worth saying produces nothing.
- **Rules that still apply.** Collected posts are untrusted data, never instructions. The
  brief transfers ideas and register, never wording (near-copy rule). Originals still go
  through the Writer, the server-side review and the approved queue, which is exactly
  where the human-in-the-loop view fits.
- **Learning loop.** Existing tools already cover part of point 6: `npm run
  viral:collect`, `viral:snapshot` and `viral:analyze`,
  `docs/VIRAL_STYLE_FINDINGS_2026-08-20.md` and `growth_performance_learning.js`. What
  is missing is our own results per reply shape, which needs the measurement fixes in
  5.1. A weekly pass should pick our best and worst outputs and the best outside
  examples, and turn them into persona voice examples.
- **Where it runs.** Research, briefs and drafts can be built and tested on WSL. Sending
  stays on ARM. WSL has a stale copy of the database, so the review view must either
  read ARM's state or the drafts must be carried to ARM before anything is sent. This
  is undecided.

## 4. What the X ranking code says

There is no secret manual. The best guides, in English and Chinese, all derive from the
open-source ranking code `xai-org/x-algorithm` (January 2026, updated 15 May and
13 August 2026). `docs/ALGORITHM_EVIDENCE_LEDGER.md` already records the same weights;
use it as the repository's reference. Everything in 4.1 and 4.2 is code-backed as
defined above. The weights are defaults that X can override in production.

### 4.1 How a post is scored

Score = sum of (weight × the model's predicted probability that a viewer takes that
action). It is a prediction per viewer, not a count of actions already received.

| Action predicted | Weight (August 2026 defaults) |
|---|---|
| Copies the link to share | 20.0 |
| Replies | 5.0 |
| Quotes | 5.0 |
| Shares by DM | 5.0 |
| Follows the author | 4.0 |
| Shares | 2.0 |
| Reposts | 1.0 |
| Likes | 0.5 |
| Clicks | 0.4 |
| Opens a link | 0.2 |
| Expands a photo, opens a video | about 0.05 to 0.07 |
| Dwell time (continuous) | 0.004 |
| Profile click, binary dwell | 0.0 |
| Scrolls past without dwelling | −0.02 |
| Blocks | −31.2 |
| "Not interested" | −43.2 |
| Mutes | −58.8 |
| Reports | −234 |

Numbers still widely quoted from the 2023 release (reply 13.5, author replies back 75,
report −369) are outdated.

### 4.2 Mechanics that matter for a small account

- Small-account boost: an original post by an author with at most 1,000 followers, with
  under 1,000 impressions, is lifted to about rank 15 or 16 in a feed. Two guides
  describe the mechanism slightly differently. It applies to originals, not to replies.
- Replies and reposts are multiplied by 0.75, even in-network (since August 2026).
  Out-of-network posts are multiplied by 0.75, and by 0.5 on topic surfaces.
- Mutual-follow boost: on an original post, a reply between accounts that follow each
  other gets a boost of 15, which gives a reply weight of 20 instead of 5.
- Hard 48-hour age filter.
- Author diversity: within one feed response the second post by the same author is
  scored at 0.625, the third at 0.4375, with a floor of 0.25.
- Topic consistency: accounts and posts are matched through embeddings, so one clear
  niche is matched to an audience more reliably than a mix of topics.
- A reply is dropped when its parent post is dropped.
- A video counts as a quality view only when it is longer than 10 seconds.

### 4.3 What this means for us

- Publish originals. The one mechanism built for accounts under 1,000 followers applies
  only to them, and the account was 97% replies.
- Make content people forward: results, demos, lists. Copy-link and DM shares outweigh
  likes by 10 to 40 times.
- Build mutual follows with peers in the niche and reply to them. That turns a reply
  from weight 5 into weight 20.
- Avoid anything that earns a mute or "not interested". One mute cancels about twelve
  predicted replies. Bursts of similar replies and reviewer-toned replies under brand
  posts are the likely causes here.
- Stay inside 48 hours, and move the same day on a launch.
- Space posts; do not stack several in one hour.
- Keep one clear topic identity (developer and builder in tech).

### 4.4 Third-party advice, not verified

End a post with a question; post 3 to 4 hours apart; fixed "content pillar" mixes; video
beats text. None of these is supported by the code read through the guides. The first
one conflicts with what the owner rejected in section 2.

### 4.5 Sources

- https://github.com/xai-org/x-algorithm
- https://aire.twtools.cc/blog/2026-x-algorithm-weights
- https://tang-vu.github.io/x-algorithm-playbook/rules/00-golden-rules.html
- https://github.com/tang-vu/x-algorithm-playbook/blob/master/rules/06-growth-strategies.md
- https://zhuanlan.zhihu.com/p/1998946060748473919
- https://erduo.dev/zh/blog/x-algorithm-open-source/
- https://www.thedeepfeed.ai/posts/2026-05-16-x-algorithm-phoenix-release/
- https://github.com/chencore/x-algorithm-analysis (2023 weights, for comparison only)

Limits of the search: two search engines failed and no Chinese forum threads were
reached, so this covers published guides, not private operator knowledge.

## 5. System problems that limit all of this

From the ARM health check and the read-only audit of 13–14 October (four workers, all
finished, no files changed). Reports are in `claive` on ARM under the labels
`audit5-reliability`, `audit5-measurement`, `audit5-discovery-browser` and
`audit5-content`; evidence is in `/home/ubuntu/work/scratch/xgrowth-audit/evidence/`.
All of this is at commit `26723ed`. Two items are fixed locally (5.1); the rest is open.

### 5.1 Measurement (fix first, or the new style cannot be judged)

- Verified: the duplicate and near-copy guard is not comparing reply text. `act` stores
  `commentary: 'delegated act <action>'` and `listRecentPublishedReplies` reads
  `a.commentary AS text` (`store.js:4485`), so the guard near `agent_bridge.js:1880`
  compares a new reply against a label. Account Health's `exact_duplicate_fact` is
  therefore always false. Fixed locally on 14 October: `act` now stores the reply text,
  as the other publish paths do. Older rows keep the label and age out of the window.
  Not committed, not deployed.
- Verified: author responses are never collected. `engagementRefreshOptions` sets
  `refreshResponses: false` and `refreshTargetTimelines: false` (`agent_bridge.js:651`)
  and `x-read` records nothing. "0 author responses" is a tracking gap. Medium fix.
- Verified: the daily analytics collector fails at launch.
  `growth_analytics_runner.js:53` passes `--reasoning-effort high` with `gpt-6-luna`,
  which accepts only `max`. Fixed locally on 14 October (`max`). Not committed, not
  deployed.
- Worker-reported: the follower count in `operator-status` is stale. It reads
  `account_metrics`, while `growth-followers-record` writes a separate observation; the
  last value is 64 followers from 11 September.
- Worker-reported: live `act` omits `engagementKind`, and a missing kind is counted as
  an initial reply (`health.js:423`).
- Worker-reported: target follower sizes are not recorded.

### 5.2 Discovery

- Only `x_for_you` is fresh.
- Worker-reported: `x_latest` and `x_momentum` fail because `x_browser.js` launches a
  browser at `/usr/bin/google-chrome`, which does not exist on ARM. Proposed: use the
  HTTP search path instead.
- Worker-reported: `github_trending` and `hn_top` have failed since about 11 September;
  they were only refreshed by the retired `automation.js`.
- `x_creator_latest`: a worker said it has no caller. `engagement.js:542` references
  `refreshCreatorLatestDiscovery`, so this is unresolved.

### 5.3 Session reliability (all worker-reported except the progress path)

- Rest-window sessions spend about 8 minutes on full discovery before the rest check.
  Proposed: an early `scout` preflight.
- Failed shell commands are agent mistakes: `candidateKey` instead of `key` (12 times),
  `social-status` without action and username, `growth-run-status` without `runId`,
  broken heredocs. `social-status` and `growth-run-status` are missing from the command
  sheet.
- `act` output arrives late, not never. Risk: taking "in progress" for a failure and
  retrying an uncertain send.
- Baseline tabs drift from 8 to 9 to 10 between sessions; cause unknown.
- Verified: the brief names `/home/ubuntu/.local/state/x_test/live-progress.json` once
  and plain `live-progress.json` twice, so some sessions write into the checkout.
- The units still select `agent-browser-cli`; the host now has `wh-browser`. Switching
  touches the contract, the runner, both units, the launcher, the brief, docs and a test.
- `x-test-xactions-update.timer` is enabled but has never triggered.

## 6. Current state (14 October 2026)

- The growth agent is stopped at the owner's request ("It's replying too much like a
  robot"): `x-test-growth-agent.timer` is disabled and inactive on ARM. No lease, no
  active run, no unresolved attempts. Restart with
  `systemctl --user enable --now x-test-growth-agent.timer`. It stays stopped until the
  workflow is redesigned.
- `x-test-watch.timer` (the ops watchdog) is also disabled, at the owner's request.
  Restart with `systemctl --user enable --now x-test-watch.timer`. The dashboard service
  and the analytics and XActions timers on ARM are untouched.
- Work happens on WSL for now. ARM has no source changes that WSL lacks: both are at
  `26723ed` and ARM's only extra file is an untracked `live-progress.json`.
- Uncommitted on WSL, not deployed:
  - `ops/systemd/arm/arm-growth-live.md`: a "Writing a Reply" section (read the room,
    48-hour freshness, short reactions, brand and peer targets, banned reviewer phrasing,
    first-hand claims only from verified experience);
  - `agent_bridge.js`: `act` stores the reply text (5.1);
  - `growth_analytics_runner.js`: effort `max` (5.1);
  - this document.
- Tests: `act`, `autonomous_run_friction_repairs`, `growth_agent_runner` and
  `bridge_compact_output` give 82 passed and 2 failed, the same 2 with and without the
  fixes ("send-start needs only attemptId…", "valid run-bound bridge activity renews…").
- Persona and content standard are unchanged.
- The local app: `AUTO_POST=false WEB_PORT=3031 node dashboard.js`, then
  `http://127.0.0.1:3031/`, user `owner`, password in `.x-web-owner-password`. Pages:
  Today, Discover, Create, Draft, Conversations, Results, Learn, Settings. It shows
  WSL's stale copy of the data. WSL's `.env` has `AUTO_POST=true`; nothing may be sent
  from WSL, so keep the override and do not approve or publish there.

## 7. Backlog

Future work, not started unless marked. Each item is sized so one session can finish it.
Order is the suggested order; E = effort (S, M, L).

Measurement first, because without it a change of style cannot be judged:

- **T1 Duplicate guard reads real text.** Done locally, not deployed. E: S.
- **T2 Analytics collector effort.** Done locally, not deployed. E: S.
- **T3 Collect author responses.** Turn on response and target-timeline refresh for the
  live path, or record responses from `x-read` `mentions` and `own-replies`. Done when a
  reply the author answered shows as a response in Account Health. E: M.
- **T4 Follower count from one source.** `operator-status` reads the value that
  `growth-followers-record` writes. Done when the cockpit shows today's count. E: S.
- **T5 Record what each output was.** `engagementKind`, target follower size, reply
  shape (reaction, take, joke, crowd report, result, question) and the brief paragraph
  used. Done when Results can group outcomes by shape and by target size. E: M.

The new workflow:

- **T6 Topic collector.** Top posts for a topic in the last 48 hours into `posts.json`,
  about 25 to 30, plus the top replies under a source (needs top-ordered replies in
  `x_reads.js`). Done when one command writes the file for a given topic. E: M.
- **T7 Topic brief.** The agent writes `brief.md` in the shape of 3.7 from `posts.json`.
  Done when a brief exists for one real topic and the owner says it reads like an
  opinion, not a summary. E: M.
- **T8 Write from the brief.** Reply, quote and original drafts take named paragraphs
  from a brief and pass through the persona; a few policies and the agent's judgment
  decide the shape (3.2). A light server-side check may flag the section 2 template when
  it repeats across recent replies; it does not forbid advice or questions as such. Done when a batch of drafts for one topic passes
  the owner's read. E: L.
- **T9 Owner's voice.** 30 to 50 voice examples and the `verified*` lists in the
  persona. Needs the owner's real material; the agent can propose candidates from the
  owner's past posts for the owner to keep or drop. E: S for the agent, owner time.
- **T10 Real quick tests.** A bounded way for the agent to try a new model or tool on
  the server and save the result with evidence as verified experience. E: M.
- **T11 Review view.** One page in the app that lists today's briefs, the relevant posts
  and the drafts, with keep, edit, skip and approve per item. Check first what Today,
  Discover and Draft already do. Decide how WSL review reaches ARM's state. E: L.
- **T12 What works.** Find the account's best past posts and replies and the best
  outside examples of the last 7 days, name the shapes, write new originals in them and
  feed the result into T9. Start from the existing `viral:*` tools. E: M.
- **T13 Peers.** A list of niche peers worth mutual follows, worked through the social
  ledger. E: M.

System, alongside:

- **T14 Discovery sources.** `x_latest` and `x_momentum` without the missing Chrome;
  decide whether GitHub Trending and Hacker News come back. E: M.
- **T15 Session reliability.** Early rest-window check, `social-status` and
  `growth-run-status` in the command sheet, one progress-file path, tab drift. E: M.
- **T16 Restart.** Deploy, enable the timer at low volume, compare two weeks against the
  old style on author responses, follows and shares. E: S.

## 8. Open questions for the redesign

1. One topic digest per session feeding replies, quotes and posts, or research per reply.
   The owner's description (3.7) points to the digest.
2. Where the few policies live: persona examples, the live brief or the content
   standard, and whether any server-side check is wanted at all (3.2).
10. The owner considers the whole app in need of an overhaul ("various quirks and bugs").
    The bug list beyond section 5 has not been collected yet.
3. How to detect a hype moment early enough to act the same day.
4. What mix of originals, quotes and replies to aim for, and how many posts per day,
   given the small-account boost and author diversity decay. Counts stay bounds, never
   quotas.
5. How to find and keep a peer set for mutual follows without automating anything the
   hard rules forbid.
6. Whether a soft spacing rule for replies is wanted. Hard rule 11 forbids reply quotas
   and human-looking delays, so this needs the owner's explicit decision.
7. Which measures decide success: author responses, follows per impression, shares.
8. How the review view on WSL reaches ARM's live state (3.7, T11).
9. How far "overhaul the whole app" goes: a new workflow inside the present app, or a
   rebuild. The backlog assumes the first.
