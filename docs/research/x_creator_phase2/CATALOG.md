# Phase 2 Creator Corpus Catalog

Current canonical corpus: **Schema V4**, promoted after independent R1/R2/R3 review on 2026-09-04.

## Current corpus

- Fixed anchor: `2026-09-03T20:59:08.867Z`
- 365-day boundary: `2025-09-03T20:59:08.867Z`
- Target creators: 52
- Authored records: 4517
- Replies: 2413
- Main lanes: 40 complete / 12 partial
- Reply lanes: 48 complete / 4 partial
- Reposts in canonical authored corpus: 0
- Authored sample ceiling: 100
- Reply sample ceiling: 50

The V4 corpus intentionally separates authored main-feed posts from replies. A value below the sample ceiling is not automatically exhaustive: consult each lane's `complete`, `exhausted`, and `stopReason` fields in `manifest.json`.

## Canonical files

- `posts.jsonl` — canonical authored main-feed corpus (originals + quote posts).
- `authored_posts.jsonl` — reviewed V4 authored aggregate containing the same authored post IDs as `posts.jsonl`; two quoted-context text payloads differ only in preserved Unicode line-separator normalization, so `posts.jsonl` is the canonical analysis entry point.
- `replies.jsonl` — separate reply-behavior corpus.
- `reposts.jsonl` — separate repost aggregate; currently empty because the V4 authored collection route excludes reposts.
- `manifest.json` — schema, collection window, provenance, per-creator lane status, and totals.
- `posts.csv` — flat compatibility projection of `posts.jsonl`; nested V4 fields such as quoted-post/media objects and metric-availability maps remain authoritative in JSONL.
- `creator_summary.json` — flat per-creator summary derived from the V4 manifest.
- `corpus_v4/` — independently reviewed promotion source, including per-creator `main/`, `replies/`, aggregates, manifest, and repair report.

## Legacy material

- `raw/` contains the pre-promotion V3 per-creator snapshots. It is retained for historical audit/reproducibility and is **not** the current canonical V4 source.
- Research documents written before V4 promotion describe the dataset state that existed when they were authored; use Git history and the retained V4 repair/audit reports when reproducing those historical analyses.

## Analysis restrictions

- Do not interpret authored row counts as annual posting frequency. The corpus is capped at 100 authored posts per creator and 12 authored lanes are truthfully partial.
- Equal-size recent-post comparisons should use the 39 creators that reached the 100-post ceiling; George Hotz is a distinct zero-public-post exhausted case.
- Reply analysis uses an up-to-50 ceiling. Forty-seven creators reached 50; four creators have partial stalled samples (37, 13, 8, and 5); George Hotz is the separate zero-public-post exhausted case.
- Low-N partial reply samples may support appropriately caveated qualitative analysis but are not exhaustive reply histories.
- Follower counts are observation-time snapshots, not historical follower counts at each post's publication time.

## Creator coverage

| # | Creator | Handle | Lane | Authored | Authored status | Replies | Reply status | Newest authored | Oldest authored |
|---:|---|---|---|---:|---|---:|---|---|---|
| 1 | Pieter Levels | `@levelsio` | AI indie builder | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T15:29:42.000Z | 2026-08-23T18:36:37.000Z |
| 2 | Theo Browne | `@theo` | AI coding / developer | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T20:09:09.000Z | 2026-08-25T01:42:09.000Z |
| 3 | Guillermo Rauch | `@rauchg` | AI devtools / Vercel | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T15:28:38.000Z | 2026-08-06T16:30:35.000Z |
| 4 | Aravind Srinivas | `@AravSrinivas` | AI agents / search / founder | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T18:58:23.000Z | 2026-06-28T22:25:18.000Z |
| 5 | Gergely Orosz | `@GergelyOrosz` | Software engineering | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T17:20:17.000Z | 2026-08-11T10:16:57.000Z |
| 6 | Michael Truell | `@mntruell` | AI coding / founder | 38 | partial (timeline_stalled) | 50 | complete (reply_target_reached) | 2026-08-29T02:52:39.000Z | 2025-11-12T23:45:46.000Z |
| 7 | Boris Cherny | `@bcherny` | Claude Code / agentic coding | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T19:11:27.000Z | 2026-02-17T19:32:45.000Z |
| 8 | Peter Steinberger | `@steipete` | AI agents / open source | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T19:52:16.000Z | 2026-07-04T00:20:56.000Z |
| 9 | Dax | `@thdxr` | OpenCode / developer tools | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T19:27:30.000Z | 2026-08-20T21:02:35.000Z |
| 10 | Matt Pocock | `@mattpocockuk` | Developer education / AI coding | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T16:47:09.000Z | 2026-08-02T06:48:27.000Z |
| 11 | Riley Brown | `@rileybrown` | Agent-native / vibe coding | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T01:22:05.000Z | 2026-07-28T20:33:50.000Z |
| 12 | Ethan Mollick | `@emollick` | Applied AI | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T20:15:27.000Z | 2026-08-13T14:35:41.000Z |
| 13 | Greg Brockman | `@gdb` | Frontier AI / founder | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T19:44:36.000Z | 2026-07-17T21:26:14.000Z |
| 14 | Sam Altman | `@sama` | Frontier AI / founder | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T19:54:52.000Z | 2026-05-21T17:33:05.000Z |
| 15 | Dario Amodei | `@DarioAmodei` | Frontier AI / founder | 5 | partial (timeline_stalled) | 13 | partial (timeline_stalled) | 2026-08-15T22:44:43.000Z | 2025-10-11T13:57:35.000Z |
| 16 | Amjad Masad | `@amasad` | AI coding / founder | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T20:24:09.000Z | 2026-07-16T17:07:24.000Z |
| 17 | Greg Isenberg | `@gregisenberg` | AI products / founder | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T20:27:43.000Z | 2026-06-20T16:37:34.000Z |
| 18 | Alex Finn | `@AlexFinn` | Vibe coding / solo building | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T18:33:54.000Z | 2026-06-26T15:56:03.000Z |
| 19 | Marc Lou | `@marclou` | Indie building / AI | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T15:19:07.000Z | 2026-08-07T07:49:53.000Z |
| 20 | Andrew Ng | `@AndrewYNg` | AI engineering / education | 91 | partial (timeline_stalled) | 8 | partial (timeline_stalled) | 2026-08-28T17:23:19.000Z | 2025-09-04T15:54:14.000Z |
| 21 | Matt Shumer | `@mattshumer_` | AI builder / investor | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T20:27:49.000Z | 2026-07-26T16:57:56.000Z |
| 22 | Logan Kilpatrick | `@OfficialLoganK` | Gemini / developer platform | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-02T15:54:10.000Z | 2026-05-08T18:22:13.000Z |
| 23 | Harrison Chase | `@hwchase17` | LangChain / agents | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T16:47:28.000Z | 2026-07-13T21:42:41.000Z |
| 24 | Simon Willison | `@simonw` | LLM engineering / open source | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-02T14:18:34.000Z | 2026-06-21T23:36:34.000Z |
| 25 | shadcn | `@shadcn` | UI/devtools / AI building | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-02T17:43:27.000Z | 2026-06-30T07:38:59.000Z |
| 26 | swyx | `@swyx` | AI engineering / developer community | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-08-26T06:02:53.000Z | 2026-07-12T04:04:58.000Z |
| 27 | Mckay Wrigley | `@mckaywrigley` | AI building / education | 36 | partial (timeline_stalled) | 50 | complete (reply_target_reached) | 2026-08-13T00:53:40.000Z | 2025-12-06T20:29:41.000Z |
| 28 | Elvis Saravia | `@omarsar0` | AI research / agents education | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T19:55:42.000Z | 2026-08-22T15:06:07.000Z |
| 29 | Andrej Karpathy | `@karpathy` | Deep learning / AI coding | 93 | partial (timeline_stalled) | 50 | complete (reply_target_reached) | 2026-08-02T03:00:09.000Z | 2025-09-05T17:38:51.000Z |
| 30 | Francois Chollet | `@fchollet` | AI research / reasoning | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T20:09:58.000Z | 2026-06-10T02:59:44.000Z |
| 31 | Sebastian Raschka | `@rasbt` | ML engineering / education | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-02T13:26:15.000Z | 2025-11-18T18:24:35.000Z |
| 32 | Jim Fan | `@DrJimFan` | Physical AI / robotics | 29 | partial (timeline_stalled) | 50 | complete (reply_target_reached) | 2026-08-21T16:06:04.000Z | 2025-09-13T14:51:45.000Z |
| 33 | Alexandr Wang | `@alexandr_wang` | Frontier AI / Meta | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T19:28:42.000Z | 2026-07-10T18:42:58.000Z |
| 34 | George Hotz | `@realGeorgeHotz` | AI systems / hacker | 0 | complete (timeline_exhausted) | 0 | complete (timeline_exhausted) |  |  |
| 35 | Alex Albert | `@alexalbert__` | Anthropic research | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-01T20:45:01.000Z | 2025-10-09T16:23:54.000Z |
| 36 | Yann LeCun | `@ylecun` | AI research | 74 | partial (timeline_stalled) | 50 | complete (reply_target_reached) | 2026-08-16T09:42:31.000Z | 2025-09-13T06:35:25.000Z |
| 37 | Jeremy Howard | `@jeremyphoward` | Applied ML / open source | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-08-18T20:51:00.000Z | 2025-12-05T23:36:07.000Z |
| 38 | Chip Huyen | `@chipro` | AI systems engineering | 15 | partial (timeline_stalled) | 5 | partial (timeline_stalled) | 2026-08-25T17:29:27.000Z | 2025-10-22T15:54:11.000Z |
| 39 | Fei-Fei Li | `@drfeifei` | AI / spatial intelligence | 59 | partial (timeline_stalled) | 50 | complete (reply_target_reached) | 2026-08-23T21:16:40.000Z | 2025-09-11T22:21:16.000Z |
| 40 | Demis Hassabis | `@demishassabis` | Frontier AI / science | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-02T16:44:21.000Z | 2025-11-20T02:41:32.000Z |
| 41 | Mira Murati | `@miramurati` | Frontier AI / founder | 19 | partial (timeline_stalled) | 37 | partial (timeline_stalled) | 2026-07-31T23:48:36.000Z | 2025-09-10T17:23:45.000Z |
| 42 | John Carmack | `@ID_AA_Carmack` | AGI / systems engineering | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T01:10:21.000Z | 2025-12-21T16:10:48.000Z |
| 43 | Shubham Saboo | `@Saboo_Shubham_` | AI agents / open source | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T17:28:01.000Z | 2026-06-03T17:12:23.000Z |
| 44 | Bindu Reddy | `@bindureddy` | AI models / founder | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T19:56:58.000Z | 2026-08-04T06:24:11.000Z |
| 45 | Rowan Cheung | `@rowancheung` | AI news / creator | 61 | partial (timeline_stalled) | 50 | complete (reply_target_reached) | 2026-09-03T15:44:00.000Z | 2025-09-08T17:05:06.000Z |
| 46 | Dan Shipper | `@danshipper` | Applied AI / media founder | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T19:35:11.000Z | 2026-08-10T17:35:33.000Z |
| 47 | Sahil Lavingia | `@shl` | Technical founder / indie building | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T02:08:13.000Z | 2026-05-12T20:03:28.000Z |
| 48 | DHH | `@dhh` | Software engineering / founder | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T19:31:53.000Z | 2026-08-30T10:59:14.000Z |
| 49 | Lee Robinson | `@leerob` | Developer tools / model behavior | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T18:11:03.000Z | 2026-02-03T19:34:30.000Z |
| 50 | Addy Osmani | `@addyosmani` | Web engineering / AI devtools | 97 | partial (timeline_stalled) | 50 | complete (reply_target_reached) | 2026-09-03T10:00:03.000Z | 2025-09-09T06:37:18.000Z |
| 51 | Peter Yang | `@petergyang` | Practical AI / product | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T19:46:34.000Z | 2026-08-11T17:27:31.000Z |
| 52 | Linus Ekenstam | `@LinusEkenstam` | AI tools / creator | 100 | complete (authored_sample_target_reached) | 50 | complete (reply_target_reached) | 2026-09-03T20:38:36.000Z | 2026-08-12T23:37:55.000Z |
