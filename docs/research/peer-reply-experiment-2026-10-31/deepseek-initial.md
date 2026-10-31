# DeepSeek peer-reply style test

Model: `opencode2api/deepseek-v4.1-flash-free` for all writers and raters.
Six writers, three raters, eight unseen source posts, 47 replies.

## Conditions

| Set | Brief | Replies |
|---|---|---|
| W1, W4 | Examples + "this is the wrong move" description + explicit rules | 16 |
| W2, W3 | Examples + "this is the wrong move" description | 16 |
| W5, W6 | Examples only, no failure description | 15 (W6 dropped post 1) |

## Result

| Measure | Briefed (32) | Examples only (15) | Target examples |
|---|---|---|---|
| Grader replies (score 0) | 3 (9%) | 2 (13%) | 0 of 10 |
| Ends with a question | 17 (53%) | 6 (40%) | 3 of 10 |
| Opens by echoing their number | ~19 | ~9 | 0 of 10 |

Rater agreement: 29 of 32 items identical across two raters. Disagreements were all 2 vs 1.

## Every grader reply

| ID | Reply | Marker |
|---|---|---|
| P07 | "Three weeks without a page is the real result here." | R |
| P08 | "Three quiet weeks is the real benchmark." | R |
| P10 | "Right now you are fixing things you imagined." | I |
| Q03 | "Three weeks without a page is the metric that matters." | R |
| Q13 | "Worth turning that bug into a case before adding more evals." | A, T |

Three different writers produced the same "the real X / the metric that matters" move.

## Convergence

Post 2, six independent writers:

1. "Three weeks without a page is the part I would brag about."
2. "Three weeks without a page is the metric I'd trust."
3. "Three weeks without a page is the real result here."
4. "Three quiet weeks is the real benchmark."
5. "Three weeks without a page is the metric that matters."
6. "Three weeks without a page is the metric that matters."

Two are identical apart from punctuation. All six share one sentence frame.

Post 5, two writers:

- "The cron job is doing a lot of work in that description."
- "The cron job is doing a lot of work in that sentence."

Post 8, six of six replies open the same way: "11 tokens a second is more/better than I expected."

## Raw pool

### Post 1
Shipped a CLI that turns a screenshot into Tailwind components. Paste the image, get the JSX. Free for the first 1,000 runs, then I'll figure out pricing.

- P01: "The screenshot to JSX step is the part I would actually use. How does it handle a messy screenshot with a few overlapping states?"
- P02: "Curious how you land on pricing after 1,000 free runs. That feels like the harder half of this."
- P03: "Screenshot to JSX is a good trade. Curious where pricing lands after the first thousand, since that is the moment people decide if it stays in their workflow."
- P04: "The 1,000 free runs will teach you more about pricing than any spreadsheet. How does it handle messy screenshots?"
- W5: "Paste the image, get the JSX, then spend an hour deleting the parts that do not match the design. Free for 1,000 runs is a good way to find out."

### Post 2
We replaced our flaky Redis queue with plain Postgres last month. Throughput is fine. Nobody has been paged in three weeks.

- P05: "Three weeks without a page is the part I would brag about. Did Redis stay around for anything?"
- P06: "Three weeks without a page is the metric I'd trust. What made Postgres the answer instead of fixing the Redis setup?"
- P07: "Three weeks without a page is the real result here. Did you keep Redis for anything, or is it gone completely?"
- P08: "Three quiet weeks is the real benchmark. What made the Redis queue flaky for you, memory pressure or the job semantics?"
- W5: "Three weeks without a page is the metric that matters. What made the queue flaky in the first place?"
- W6: "Three weeks without a page is the metric that matters. Did you have to rewrite much of the queue logic, or did the jobs fit Postgres as they were?"

### Post 3
How do you decide when a side project is ready to show other people? I keep finding one more thing to fix.

- P09: "When it does one thing without you explaining it. Ship the smallest version, watch where people get stuck, then fix that."
- P10: "Show it when the next fix is one a user asked for. Right now you are fixing things you imagined."
- P11: "Ship it when the next fix is something a user asked for, not something you noticed on your own."
- P12: "Ship it when the thing it does works and the bugs are annoying rather than confusing. The last 10% never ends."
- W5: "When the thing you keep fixing stops being the thing people would notice. Ship it and find out which bug was real."
- W6: "Show it when the thing it does works, not when the list is empty. People will tell you the one more thing you could not see yourself."

### Post 4
Our eval suite is at 92% and two users described the same bug this week. I don't think more evals would measure the thing that's actually breaking.

- P13: "Two users hitting the same bug says more than the 92%. What is the bug doing?"
- P14: "Evals measure what you thought to test. Two users hitting the same bug is the eval you did not write yet."
- P15: "Sounds like the eval covers the cases you already understand. What did the bug turn out to be?"
- P16: "92% means your eval set agrees with you. The two users found the part it does not cover. What was the bug?"
- W5: "The users found a gap your eval suite does not model. Worth turning that bug into a case before adding more evals."
- W6: "92% means the eval and the users care about different things. The bug they hit is probably outside what you wrote tests for."

All six restate the poster's own point. The poster already said more evals are the wrong move.

### Post 5
Hot take: most agent startups are a cron job with a Slack bot and a landing page.

- P17: "The cron job is doing a lot of work in that description. The retries and quiet failures are usually the hard part."
- P18: "Fair for a lot of them. The ones that last seem to have a queue that does not send twice and a person who reads the logs."
- P19: "the cron job is usually the only part that works"
- P20: "The cron job is doing a lot of work in that sentence, and I still recognise the landing page."
- W5: "Most of them, yes. The interesting ones are the ones where the cron job is not the hard part."
- W6: "A cron job with better branding is still a cron job. The ones I want to see are the ones that survive a restart mid-task."

### Post 6
Deleted 4,000 lines today. p95 latency dropped 40%. Should have done this a year ago.

- P21: "What was most of it, dead feature flags or duplicated paths? 40% off p95 from deletion is a good result."
- P22: "40% from deleting code is a good lesson. What was the biggest chunk you removed?"
- P23: "40% from deleting code is the most satisfying kind of perf work. What were those 4,000 lines doing?"
- P24: "40% from deletion is a strong argument that the code was the latency. What was the biggest chunk, a retry loop or a cache nobody needed?"
- W5: "40% from deletion is the best kind of performance work. Do you know which lines were costing you the latency?"
- W6: "Deleting code and getting faster is the best kind of win. Was most of it dead paths, or one hot path you kept paying for?"

Five of six open by repeating the 40% with a superlative.

### Post 7
First PR merged into a repo I've used for six years. It fixes a typo in the docs, but it's mine.

- P25: "A typo fix counts. Congrats on the first one."
- P26: "A typo still counts. Six years of using it and now your name is in the history."
- P27: "A docs typo still counts. Six years of reading it, and now you are in the history."
- P28: "Six years of using it and now your name is in the history. Typo or not, that counts."
- W5: "Six years of using a repo and then getting to fix it. Small patch, real moment."
- W6: "Six years of using it and now your name is in it. The typo does not matter, the first PR does."

Five of six reuse "six years ... your name in the history".

### Post 8
3B model running on a Steam Deck. 11 tokens per second, about 40 minutes of battery. Local weights, no network.

- P29: "11 tokens a second on battery is better than I expected. Does the fan stay quiet, or does it sound like a small plane?"
- P30: "11 tokens per second on a Steam Deck is better than I expected. Does it hold up as the battery drops?"
- P31: "11 tokens a second on a handheld is more than I expected. Is that with a short context or the full one?"
- P32: "11 tokens a second on a Deck is more than I expected. Is the 40 minutes with the screen on the whole time?"
- W5: "40 minutes of battery for local weights on a handheld is better than I expected. How warm does the deck get?"
- W6: "11 tokens per second on a handheld is better than I expected. How long before the fans make it uncomfortable to hold?"

## Round 2: three bans

Brief added to the ten examples:

1. Never write "real" before a noun as an intensifier.
2. Do not open by repeating their numbers or wording back.
3. Most replies end on a statement. At most two of eight may end with a question.
4. No two of the eight replies may share a sentence frame.

Result, two fresh writers, 16 replies, two blind raters:

| Measure | Round 1 (32) | Round 2 (16) |
|---|---|---|
| Grader replies | 3 (9%) | 0 |
| Ends with a question | 17 (53%) | 1 (6%) |
| "real" as intensifier | 3 | 0 |
| Restatement flagged | 3 | 2, plus 1 I would add |

Replies got longer and more essay-like. Restatement survived the bans.

- R01: "The time saver here is not typing the layout out. Handing it a half-finished mockup will be the fun part."
- R02: "Screenshot in, components out is a short path from an idea to something clickable. I would want to see how it handles a messy hand-drawn sketch."
- R03: "Postgres keeps taking jobs we invented whole services for. Nobody misses the extra moving part, and the pager stays quiet."
- R04: "Postgres as a queue gets dismissed too fast. One less system to keep alive is worth a lot of throughput."
- R05: "Show it once someone else can finish a task without you explaining it. Every fix before that is a guess."
- R06: "You will not feel done, so stop waiting for that. Show it once a stranger can reach the point of the thing without you talking them through it."
- R07: "Evals only cover the cases someone thought to write down. Your users found the case nobody pictured."
- R08: "A high score on written cases does not cover the paths two users found by accident."
- R09: "The survivors add the boring parts: retries, state, and someone to call when it breaks at night."
- R10: "Half of them, maybe. The rest are a cron job and a Slack bot still waiting on the landing page."
- R11: "Removing code and getting a faster system out of it never stops feeling like cheating."
- R12: "Removing code is the cheapest performance work I know. Our worst latency came from something nobody needed anymore."
- R13: "Six years of using a repo and you finally read that file closely. Typo fixes are a good door in."
- R14: "A typo still counts. Your name now sits in the history of something you have used for years."
- R15: "A handheld doing local inference with the network off beats most cloud demos I see. Which quantization?"
- R16: "Nothing leaves the machine, and you trade a full battery for it. That is a fair swap for a demo."

Nobody asked "is it local?", because the post already says it. That positive case works.
