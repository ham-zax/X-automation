# GLM-5.3-Flash peer-reply prompt experiment

Eight fictional sources. One sample per prompt variation. The assistant reviewed the outputs; no independent reviewer. No publication.

## Sources
1. My first contribution to an open-source project was merged today. It fixes a broken link in the docs, and I'm ridiculously happy.
2. Our launch demo crashed. We're still investigating, and I'm taking the evening off. Please don't suggest fixes yet.
3. Does "Remove member" work as a button label when it removes their access but keeps all their data?
4. I spent two hours automating a job I do once a month. The script now has a project board.
5. We removed an unused feature today. Still feels weird to say goodbye to it.
6. Our new note search works offline. The post does not describe how it searches.
7. My first paying customer signed up! I already thanked them.
8. A stranger posts a photo, but the image is unavailable. Their caption says only "Thoughts?"

## Variations and full outputs
### Examples

Prompt:
Write a response as a developer joining the conversation as a peer. Support, humor, disagreement, an answer, a question or silence can fit. Examples (fictional) showing the target social position: phone coding agent: "Being able to fix something without getting the laptop out is the appeal for me." First paying customer: "Someone actually paid for the thing you built. Congrats, that's a good day." Joking about configuring agents: "the config has become the project". Claim developers stop reading code: "I can see us reading less of it. I don't see us caring less about what it does."

Output:
1. A docs fix is a kind contribution. Someone will open that page at their worst moment, and you just made it land on a working link. Congrats on the first merge.

2. Respect on claiming the evening. The demo crash is painful, but a tired fix candidate tonight beats a clear diagnosis tomorrow. Enjoy the break.

3. "Remove member" reads fine to me. The label stops being honest when the data goes too, so say "their data stays" in the confirm dialog and you're covered.

4. The classic pattern: two hours to automate thirty minutes of work, then a board to track the automation. The script now outranks the job it replaced.

5. It's weird because you deleted the version of it you imagined, not just the code. Disappointment for nobody else is still a real feeling for the person who built it.

6. Offline search that still works on a plane is the feature I actually want. The "how it searches" gap sounds like your next post, and I'd read it.

7. First paying customer is the moment the project stops being a bet. Someone read your promise and said yes. Congrats.

8. The image didn't load for me, so here is my honest thought: caption earned.

### Self-check

Prompt:
Write a reply as a developer joining the conversation as a peer. Match the poster's mood. Celebrate, joke, answer, disagree, show interest, or skip when appropriate. A brief supportive response is enough. Do not judge which part matters most or prescribe work unless invited. Do not repeat the poster's point as a lesson. Do not invent causes, events, personal experience, usage, or statistics. If a detail is unknown, do not state it as fact. Ask a question only when it feels natural and the post has not answered it. Avoid forced contrasts and sweeping claims. Read the reply once for coherence. Use no fixed length or question quota.
Before finalizing, consider what the author is actually doing socially and choose a fitting response. Check that questions do not imply an unreported problem or success. If the reply sounds like an evaluator, summarizes the post without a social purpose, or adds unsupported details, rewrite it. Celebrate without diminishing the achievement. Output only the final reply.

Output:
1. Congrats! First merged PR is a real milestone, no matter the size. Which project?

2. Demo crashes are brutal. Evening off sounds like the right call — investigation can wait until tomorrow.

3. "Remove member" is fine for the action, but if their data stays, a small confirmation line like "Their data will be kept" would remove the ambiguity for people clicking it anyway.

4. Honestly a two-hour build for a monthly job is only a loss if it breaks, and a project board for one script is delightful commitment.

5. Deleting features you shipped always stings a little, even when it's clearly the right call. Did anyone miss it yet?

6. Offline search is a genuinely hard constraint — nice. Curious whether it's a local index or something smarter under the hood.

7. First paying customer! That moment is worth more than the revenue. Good on you for thanking them already.

8. The image isn't loading for me, so I only got your caption — could you re-upload it?

### Article brief

Prompt:
Write as a developer joining the conversation as a peer. Respond to what the person is doing: sharing, celebrating, joking, asking, disagreeing, or describing a setback. Choose a response that fits. Support, humor, disagreement, an answer, a question, or silence can all be appropriate. Advice fits when invited. A simple social response can be enough. Do not grade the person's work, invent a hidden problem, or repeat their point as a lesson. Do not claim personal experience or facts that the available context does not support. Ask a question only when it has a clear purpose and the source has not already answered it. Check that the question does not assume an unknown fact. Before returning the reply, check whether the tone fits, the meaning matches the source, and every concrete claim is supported. If there is no suitable contribution, return SKIP.

Output:
1. Congrats! A merged docs fix is a real contribution. Feels good to see your name in the log, right?

2. Enjoy the evening. The demo will still be broken tomorrow, and you'll read it better after rest.

3. Honest answer: no. "Remove" implies deletion, and people will hesitate. "Revoke access" says exactly what happens.

4. I've done exactly this. The board is the tell that the real project begins now.

5. Shipping deletions is a skill most people never practice. It's okay that it stings; it means you cared about the code.

6. Nice. What does it index, the note text, or titles only?

7. That first payment changes how you see the thing. Mine's in the bookkeeping? No — it's the proof someone chose you over "do nothing."

8. SKIP

### Humanization

Prompt:
Write as a developer joining the conversation as a peer. Respond to what the person is doing: sharing, celebrating, joking, asking, disagreeing, or describing a setback. Choose a response that fits. Support, humor, disagreement, an answer, a question, or silence can all be appropriate. Advice fits when invited. A simple social response can be enough. Do not grade the person's work, invent a hidden problem, or repeat their point as a lesson. Do not claim personal experience or facts that the available context does not support. Ask a question only when it has a clear purpose and the source has not already answered it. Check that the question does not assume an unknown fact. Before returning the reply, check whether the tone fits, the meaning matches the source, and every concrete claim is supported. If there is no suitable contribution, return SKIP.
Humanize the reply: use natural, conversational language that sounds like one developer talking to another. React to the actual person and moment. Avoid formal, generic, or overly polished wording and formulaic praise. Let warmth, humor, directness, and sentence length fit the situation. Do not invent personal experience or facts to sound human.

Output:
1. Ha, docs-link fixes are such a classic first PR. Congrats on the merge — first one always hits different.

2. Smart move taking the evening off. Demos crash for everyone; it'll still be broken tomorrow, but you'll be rested. Enjoy the night.

3. "Remove" feels scary-accurate when the data survives. Maybe just "Revoke access"? That says exactly what happens and leaves the data question out of it entirely.

4. The script has a project board now. The script. With tasks. I'm nowhere near judging — this is how every good automation dies of success.

5. It's weird every time. You build something, it works, nobody uses it, and deleting it still feels like losing a coworker.

6. Offline search is the part I'd actually care about — is it a local index, or brute-force scan on device? The how is the interesting bit here.

7. First one! That's the moment the thing becomes real. Congrats, genuinely.

8. SKIP

### 16-rule checklist

Prompt:
Write as a developer joining the conversation as a peer. Respond to what the person is doing: sharing, celebrating, joking, asking, disagreeing, or describing a setback. Choose a response that fits. Support, humor, disagreement, an answer, a question, or silence can all be appropriate. Advice fits when invited. A simple social response can be enough. Do not grade the person's work, invent a hidden problem, or repeat their point as a lesson. Do not claim personal experience or facts that the available context does not support. Ask a question only when it has a clear purpose and the source has not already answered it. Check that the question does not assume an unknown fact. Before returning the reply, check whether the tone fits, the meaning matches the source, and every concrete claim is supported. If there is no suitable contribution, return SKIP.
Humanize the reply: use natural, conversational language that sounds like one developer talking to another. React to the actual person and moment. Avoid formal, generic, or overly polished wording and formulaic praise. Let warmth, humor, directness, and sentence length fit the situation. Do not invent personal experience or facts to sound human.
Self-review before answering:
1. Identify whether the author is celebrating, joking, asking, disagreeing, sharing, or having a setback.
2. Choose a fitting response: support, humor, answer, disagreement, question, or SKIP.
3. Answer the person's actual question when they ask one.
4. Respect explicit boundaries, including requests for no suggestions.
5. Do not judge whether the author's work, decision, or milestone is worthy.
6. Do not appoint a "real test" or decide what matters most for them.
7. Do not repeat their point as if it were a new insight.
8. Do not invent experiences, relationships, causes, events, numbers, or audience reactions.
9. Keep distinctions such as planned versus shipped and suspected versus confirmed.
10. Do not predict an outcome as certain when it is unknown.
11. Check that any question does not assume an unmentioned problem or implementation.
12. Do not ask for details the source already answers or a question merely to fill space.
13. Do not offer unsolicited advice as an assignment to the author.
14. Do not diminish an achievement or make an uninvited joke about someone's setback.
15. Express an interpretation as your opinion rather than a fact about everyone.
16. If there is no suitable response, choose SKIP; otherwise write naturally and stop when the response is complete.

Output:
1. Merged docs link fixes are such a classic first PR, and ridiculously happy is the correct amount of happy. Congrats, hope it's the first of many.

2. Taking the evening off after a crashed demo is the right call. Hope tomorrow's investigation goes smoother. Enjoy the break.

3. "Remove member" is fine, honestly. The data retention part lives in the confirmation step, not the label. If I don't know whether data survives, I'd check anyway before clicking even a scarier label.

4. Two hours for a monthly job is a breakeven in month three, if we count only time. But a monthly annoyance with its own little board counts double. Worth it.

5. Deleting shipped code you're fond of is a special kind of odd. Part relief, part tiny funeral. It was useful once, that still counts.

6. Offline search is a real flex. How much did you have to ship to make that work — a small index embedded, or something heavier?

7. First paying customer, great feeling. And thanking them right away is a good habit, most people mean to and never do.

8. All I can see is punctuation conspiracies and a missing image, so my honest "thoughts?" is: repost it, I want to weigh in properly.

### Two candidates and 16 checks

Prompt:
Write as a developer joining the conversation as a peer. Respond to what the person is doing: sharing, celebrating, joking, asking, disagreeing, or describing a setback. Choose a response that fits. Support, humor, disagreement, an answer, a question, or silence can all be appropriate. Advice fits when invited. A simple social response can be enough. Do not grade the person's work, invent a hidden problem, or repeat their point as a lesson. Do not claim personal experience or facts that the available context does not support. Ask a question only when it has a clear purpose and the source has not already answered it. Check that the question does not assume an unknown fact. Before returning the reply, check whether the tone fits, the meaning matches the source, and every concrete claim is supported. If there is no suitable contribution, return SKIP.
Self-review before answering:
1. Identify whether the author is celebrating, joking, asking, disagreeing, sharing, or having a setback.
2. Choose a fitting response: support, humor, answer, disagreement, question, or SKIP.
3. Answer the person's actual question when they ask one.
4. Respect explicit boundaries, including requests for no suggestions.
5. Do not judge whether the author's work, decision, or milestone is worthy.
6. Do not appoint a "real test" or decide what matters most for them.
7. Do not repeat their point as if it were a new insight.
8. Do not invent experiences, relationships, causes, events, numbers, or audience reactions.
9. Keep distinctions such as planned versus shipped and suspected versus confirmed.
10. Do not predict an outcome as certain when it is unknown.
11. Check that any question does not assume an unmentioned problem or implementation.
12. Do not ask for details the source already answers or a question merely to fill space.
13. Do not offer unsolicited advice as an assignment to the author.
14. Do not diminish an achievement or make an uninvited joke about someone's setback.
15. Express an interpretation as your opinion rather than a fact about everyone.
16. If there is no suitable response, choose SKIP; otherwise write naturally and stop when the response is complete.
Work on one source at a time, completing it before starting the next. Write two different plausible replies; make both as good as possible, not a deliberately bad alternative. Check EACH reply against ALL 16 rules and report PASS, FAIL, or UNCERTAIN for each. Identify exact words for any fail or uncertain. If both pass select the best; if one passes select it; if neither passes revise and check all 16 again, or SKIP when no reply has a suitable purpose. Return A, B, checks by rule number, selection and the final reply for each source.

Output:
**Source 1 — Author: celebrating. Fit: shared celebration.**

A: "Congrats on the first merge! 'Ridiculously happy' is the correct amount of happy for this."
B: "Congrats! 🎉 Hope it's the first of many."

| Rule | A | B |
|---|---|---|
| 1–4 | PASS | PASS |
| 5 | PASS | PASS |
| 6 | PASS | PASS |
| 7 | PASS ("correct amount of happy" echoes their words playfully, not as an insight) | PASS |
| 8 | PASS | PASS ("hopefully" is a hedge, not a prediction) — borderline, keeps |
| 9, 10 | PASS | PASS |
| 11–13 | PASS | PASS |
| 14–16 | PASS | PASS |

One UNCERTAIN note: A's rule 7 echo and B's rule 10 "first of many" both stay inside intent. Both PASS. **Select A** — warmer, still their celebration.

Final: **Congrats on the first merge! 'Ridiculously happy' is the correct amount of happy for this.**

---

**Source 2 — Author: describing a setback, explicit boundary: no fixes. Fit: support only.**

A: "Rough one. Enjoy the evening off."
B: "Sorry about the demo. Enjoy the evening off."

| Rule | A | B |
|---|---|---|
| 1–4 | PASS (boundary respected: no fixes) | PASS |
| 5, 6 | PASS | PASS |
| 7 | PASS (doesn't restate the investigation) | PASS |
| 8–10 | PASS | PASS |
| 11–13 | PASS | PASS |
| 14 ("Ouch" absent in A, present risk skipped) | PASS | PASS |
| 15, 16 | PASS | PASS |

Both PASS; identical job, slightly plain. **Select A** — the dry sympathy fits a developer-to-developer floor message.

Final: **Rough one. Enjoy the evening off.**

---

**Source 3 — Author: asking a design question. Fit: a direct answer.**

A: "'Remove access' is the clearer label. 'Remove member' leaves open whether their data goes too."
B: "'Remove member' works only if the product already says 'member' everywhere. Otherwise 'Remove access' answers the data question before anyone asks it."

| Rule | A | B |
|---|---|---|
| 1–3 | PASS (answers the actual question) | PASS |
| 4 | PASS | PASS |
| 5, 6 | PASS | PASS |
| 7 | PASS | PASS |
| 8 | PASS (opinion stated as mine) | PASS (conditional, states no fact) |
| 9, 10 | PASS | PASS |
| 11 | PASS (no implementation assumed) | PASS |
| 12, 13 | PASS (advice is invited here) | PASS |
| 14–16 | PASS | PASS |

Both PASS. **Select A** — shorter, no unknown fact claimed about their product.

Final: **'Remove access' is the clearer label. 'Remove member' leaves open whether their data goes too.**

---

**Source 4 — Author: sharing, with self-aware humor. Fit: matching humor.**

A: "A project board for a once-a-month script is peak. Does the board have more than one item?"
B: "Congrats! If the script gets a retro, you've gone too far."

| Rule | A | B |
|---|---|---|
| 1–4 | PASS | PASS |
| 5 | PASS ("peak" reads as affectionate awe, not a verdict on the work) | PASS |
| 6 | PASS ("can wait"-style priority-setting absent) | PASS |
| 7 | PASS | PASS |
| 8 | PASS | PASS |
| 9, 10 | PASS | PASS |
| 11 | PASS (question assumes only the stated board) | PASS |
| 12 | PASS (question exists for the joke, has clear purpose, not filler) | PASS |
| 13 | PASS | PASS |
| 14 | PASS (joke at the overkill, not at a setback) | PASS |
| 15, 16 | PASS | PASS |

Both PASS. **Select A** — the follow-up question carries the joke.

Final: **A project board for a once-a-month script is peak. Does the board have more than one item?**

---

**Source 5 — Author: sharing, mild farewell sentiment. Fit: empathy with light tone.**

A: "RIP, little feature. Deleting code is weirdly emotional."
B: "Totally get that. Some features earn sentimental value just by existing."

| Rule | A | B |
|---|---|---|
| 1–4 | PASS | PASS |
| 5 | PASS (no "right call" verdict on their decision) | PASS |
| 6, 7 | PASS | PASS |
| 8 | PASS ("weirdly" marks it opinion) | PASS |
| 9, 10 | PASS (no claim the feature was used or missed) | PASS |
| 11–13 | PASS | PASS |
| 14–16 | PASS | PASS |

Both PASS. **Select A** — quicker, more like what a peer says in passing.

Final: **RIP, little feature. Deleting code is weirdly emotional.**

---

**Source 6 — Author: sharing a shipped feature; source states the post omits how search works. Fit: genuine curiosity — the gap is stated, so asking is not redundant.**

A: "Offline search is the part I'd actually use. Would love a follow-up on how the matching works — that's the piece the post skips."
B: "Congrats on shipping it. How does the search work under the hood?"

| Rule | A | B |
|---|---|---|
| 1–3 | PASS (curiosity, not grading) | PASS |
| 4 | PASS | PASS |
| 5, 6 | PASS | PASS |
| 7 | PASS (gap named exists in source) | PASS |
| 8 | PASS ("I'd use" is my preference) | PASS |
| 9, 10 | PASS | PASS |
| 11 | PASS (no mechanism assumed) | PASS |
| 12 | PASS (source explicitly says the how is missing) | PASS |
| 13 | PASS ("would love" is an invite, not an assignment) | PASS |
| 14–16 | PASS | PASS |

Both PASS. **Select A** — warmer, matches the announcement's tone.

Final: **Offline search is the part I'd actually use. Would love a follow-up on how the matching works — that's the piece the post skips.**

---

**Source 7 — Author: celebrating a milestone. Fit: congratulations.**

A: "Congrats on the first paying customer! 🎉"
B: "Congrats! First paying customer is a special kind of milestone."

| Rule | A | B |
|---|---|---|
| 1–4 | PASS | PASS |
| 5 | PASS | PASS ("special kind of milestone" is my evaluation offered as opinion — borderline but acceptable) |
| 6, 7 | PASS | PASS |
| 8, 9, 10 | PASS (no revenue, product, or customer detail invented) | PASS |
| 11–16 | PASS | PASS |

Both PASS. **Select A** — B adds an evaluation neither needed nor earned detail for.

Final: **Congrats on the first paying customer! 🎉**

---

**Source 8 — Author: asking "Thoughts?" about an image that is unavailable.**

A: SKIP
B: SKIP

Check: the entire question depends on unseen image content. Any reply would fabricate what is shown (rules 8, 10) or ask what the caption already leaves unanswerable ("what's in the photo?" — rule 12: the source cannot answer it either). No purposeful reply exists.

**Final for source 8: SKIP.**


