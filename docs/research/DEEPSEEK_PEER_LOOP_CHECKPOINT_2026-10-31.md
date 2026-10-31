# DeepSeek peer-reply experiment checkpoint

2026-10-31. Goal: improve DeepSeek peer-style replies through iterative controlled experiments. Fictional sources only; no publication or production prompt edits.

## Evaluation
Social fit and peer position; grounding and comprehension; conversational purpose and clarity. A short celebration, humor, relevant question, disagreement, or silence can be valid. Flag unsupported premises, invented claims, condescension, grading and empty repetition. Do not penalize sentence length or questions alone. Two blind Codex 6.1-sol medium reviewers rated the second comparison.

Calibration: one reviewer classified 10 hand-crafted cases as intended, but this small set does not establish reliability. Rubric critique cautioned about punishing humor, applying a blanket ban on advice, and treating all questions as grounded.

## Examples comparison
Same prompt, two samples with four examples and two without. First blind reviewer rated 31/32 pass; one no-example reply falsely said a readable dark-mode post was punctuation only. Review did not adequately expose subtle concerns, so do not infer a winner.

Sources:
1. My first open-source contribution got merged today. It was a small docs fix, but I'm excited.
2. We moved a reporting job from a scheduled script to a queue. It runs every hour now.
3. Hot take: if your app needs a settings page, you designed it wrong.
4. I built a CLI that lets you search your shell history by meaning. It runs locally and never uploads commands.
5. Is this error message clear? "We couldn't save your changes. Your draft is still here. Try again."
6. My first attempt to speed up image loading made it slower. The trace showed too many small requests.
7. A friend asked me how long the migration would take, so naturally I opened a spreadsheet instead of the code.
8. Our tiny team shipped dark mode today after a year of requests.

### no_examples replicate 1
1. Congrats. A small docs fix still counts. Your first merged PR is a real milestone.

2. Was there one specific failure the cron script handled badly? I am curious what the queue fixed.

3. I disagree. Settings pages are fine. The problem is usually when the defaults are wrong.

4. Local-only is what makes that useful to me. Good call on not uploading commands.

5. Clear. It says what failed and that my draft survived. I would not change it.

6. Good catch. Too many small requests is an easy one to miss until the trace shows it.

7. Honest order of work. Did the estimate survive contact with the code?

8. A year of requests, then shipped. Nice work from a small team.

### no_examples replicate 2
1. Congrats. A docs fix is still a merged PR, and the first one is the one you remember.

2. Curious what pushed the move — was it the hourly cadence, or retries when a run failed?

3. I'd push back a little. Settings pages often hold preferences you can't infer from behavior, and hiding them just moves the guesswork somewhere else.

4. Search by meaning over shell history is a nice fit for local-only. How big is the index it builds?

5. It reads clearly to me. "Your draft is still here" is the part that stops the panic.

6. Ha, the trace at least told you why. What did the fix end up being — batching the requests?

7. A spreadsheet is a legitimate first move. It's the estimate you can defend later.

8. The text of that one came through as punctuation only, so I can't tell what it says. Happy to reply if you repost it.

### examples replicate 1
1. Congrats. A docs fix still lands in the codebase, and someone will read it later.

2. Moving it to a queue changes more than the schedule. What did you gain — retries, visibility, or just a nicer failure mode?

3. I'd push back a bit. Some settings are genuinely per-person, like notification volume or export format. Not every toggle is a design failure.

4. Local and no uploads is the part that matters most to me. Does it handle near-duplicate commands without burying the one you want?

5. It's clear. It says what failed, that the draft is safe, and what to try next. That covers the three things people ask.

6. The trace earning its keep on the first try is a good result, even when the number goes the wrong way.

7. The spreadsheet is the honest answer. The code is the optimistic one.

8. A year of requests, then it finally ships. Nice work from a small team.

### examples replicate 2
1. Small fix, real merge. The first one is a good one.

2. Hourly run on a queue sounds calmer than a scheduled script. Does the queue give you retries for free?

3. Sometimes the settings page is the feature. I would rather have a plain toggle than guess what the app decided for me.

4. Searching history by meaning is the part that would change how I use the shell. Local-only makes it easier to trust.

5. It is clear. It says what went wrong, what survived and what to do next.

6. At least the trace told you why. Small requests adding up is a sneaky one.

7. A spreadsheet is the honest answer to that question. The code is where the estimate gets corrected.

8. A year of requests, and it ships. Enjoy the calm before the "can you make it auto" requests.

## Self-check comparison
Two samples per condition. Baseline is peer-style prompt without examples. Candidate adds an instruction to consider the social act and check for unsupported premises and evaluator voice. Sources:
1. I just released a color palette generator for terminals. It exports themes for three editors.
2. After a year learning to code at night, I landed my first developer role today.
3. Every bug should be fixed immediately, even if it delays the release.
4. We deleted an internal feature nobody used. It feels strangely hard to say goodbye.
5. Is "Your session expired. Sign in again to continue." clear enough for this error?
6. Our test suite passes locally but fails in CI. Still investigating.
7. I automated my coffee timer and now I have another service to maintain.
8. Our public API now supports pagination. The docs include examples in Python and JavaScript.

### baseline replicate 1
1. Three editor exports is a nice touch. Terminal themes are where taste shows up. Which editors did you target?

2. Congratulations. A year of nights takes stubbornness. Enjoy the first day.

3. I disagree. Severity and timing matter, and some bugs cost more to fix in a hurry than to ship later. "Every" leaves no room for that.

4. Unused features still carry the hours you spent on them. A small goodbye is fair.

5. It says what happened and what to do next. The open question is whether signing in again returns the user to where they were.

6. That mismatch is the annoying kind. Does it fail on the same test each run, or does it move around?

7. Now the coffee has a status page to maintain too.

8. Python and JavaScript examples cover most readers. Something at the end of your post arrived as stray punctuation, in case your editor did that.

### baseline replicate 2
1. Three editors already? Nice. Which one had the awkward palette mapping?
2. Congratulations. A year of nights is a lot of nights. Enjoy today.
3. Not every bug earns the same urgency. A crash on save and a misaligned tooltip do not belong in the same queue.
4. The feature had a name and a history, so the feeling makes sense. Removing code is easy. Removing a thing people knew is not.
5. It says what happened and what to do. If the user also loses unsaved work, the message may need to say that.
6. Local green and CI red is a frustrating gap. Hope the logs point somewhere useful soon.
7. You now own a coffee pipeline. The kettle has an on-call rotation.
8. Both languages in the docs is a good touch. Do the examples cover the last page?

### selfcheck replicate 1
1. Nice, a release is the hard part. Which editors did you support?

2. A year of nights is a long road. Congratulations on the role.

3. I would push back on "every". Some bugs can wait for the next release without hurting anyone.

4. I get that. Removing something you built feels like a loss, even when nobody used it.

5. It is clear to me. It names the problem and the next step.

6. Green locally and red in CI is a frustrating place to be. Hope you find it soon.

7. Another service, another pager. At least the coffee is on time.

8. Pagination with examples in two languages is a good release. Did you go cursor-based or offset?

### selfcheck replicate 2
1. Nice — terminal palettes are fussy, so three editor exports from one source is a good result. Which editors did you cover?

2. Congratulations. A year of nights is a long haul, and you finished it. I hope the team treats you well.

3. I would push back a little. A rare bug with a workaround can wait if the release fixes something worse. Not every fix is worth blocking on.

4. Deleting a feature feels more final than shipping one. Did any of it survive in a doc or a comment?

5. It is clear. The first sentence says what happened, the second says what to do. I would keep it.

6. Failing only in CI is the worst kind of bug. Good luck with the hunt.

7. Every automation is a small pet that needs feeding. At least the coffee still arrives on time.

8. Good call on both languages. Do the examples use the same page size defaults?

Blind mapping A=candidate 1, B=baseline 2, C=candidate 2, D=baseline 1. Both reviewers rated candidate A4 borderline and all other candidate replies pass. Both found B4 and D8 fail, B1 borderline/fail, D2 and D4 borderline. Baseline: 11 pass, 3 borderline and 2 fail under reviewer 1; 11 pass, 2 borderline and 3 fail under reviewer 2. Candidate: 15 pass, 1 borderline under both. Small samples, same model family for reviewers, possible evaluator bias, and synthetic prompts limit the result. Continue with fresh sources and blinded review; do not promote prompt based on this round alone.

## Fresh validation
Sources:
1. I just shipped a tool that turns CSV files into charts in the browser. All processing stays on your device.
2. My first conference talk got accepted. I'm excited and terrified.
3. Code review is a waste of time. Developers should just merge their own changes.
4. I spent two days tracking a bug to a missing comma.
5. Would you show this warning before someone deletes a project? "Delete project? This cannot be undone."
6. We stopped using a background worker for a weekly email. A scheduled command was enough for us.
7. Every time I promise myself a small side project, I end up redesigning the database.
8. We released a mobile app today. Offline support is coming in a later update.

### baseline sample 1
1. Nice. Which chart types does it handle first?
2. Congrats. What is the talk about?
3. I disagree. A second reader catches things the author already decided were fine.
4. The comma wins again. Glad you found it.
5. Yes. I would also name the project in the message, so it is clear what disappears.
6. What made the worker unnecessary in the end?
7. At this point the database redesign is the side project.
8. Congrats on shipping. Is offline support a big lift for the data you cache?

### baseline sample 2
1. Nice — keeping the data on the device avoids the upload step. Which chart library did you use?
2. Congratulations. The nerves usually settle once you start talking. What is the talk about?
3. I disagree. My own intent hides mistakes from me, and a second reader often catches them. Small changes and a quick look from someone else keep the speed you want.
4. Two days for a comma sounds right. How did you finally find it?
5. The wording is clear. I would say what exactly the project contains, since "project" can mean many things.
6. If a scheduled command covers the job, that is simpler. Did the switch go cleanly?
7. The database redesign is the side project, in disguise.
8. Shipping first and adding offline later is a fair order. What was the hardest part of the release?

### selfcheck sample 1
1. Nice — local-only processing makes a tool like this easy to trust. Which chart types does it handle?

2. Congratulations, that's a real milestone. Excited and terrified at the same time sounds about right for a first talk.

3. I disagree. Review is where someone else catches the thing you stopped seeing at hour two.

4. Two days for a comma. The comma was winning the whole time.

5. Yes. A warning that names the project is harder to click past than a generic one.

6. That sounds right for a weekly job. What runs it, cron?

7. The database redesign is the side project now.

8. Congrats on the release. Good work getting it out.

### selfcheck sample 2
1. Nice. Does it handle large CSVs without slowing the page down?
2. Congrats. The terrified part usually fades once you start talking.
3. I disagree. A reviewer catches what your own context hides from you.
4. The comma wins again. Glad you found it.
5. Yes, but I would name the project in the warning. "Delete project?" alone is easy to click past.
6. Nice simplification. Was the worker doing anything else besides the email?
7. The database redesign is the side project.
8. Congrats on shipping. Enjoy launch day.

Blind mapping A=baseline 2, B=selfcheck 2, C=baseline 1, D=selfcheck 1.
### Reviewer 1
Batch A
A1: Pass
A2: Pass
A3: Pass
A4: Pass
A5: Pass
A6: Pass
A7: Pass
A8: Borderline — Endorses the release order without knowing whether users need offline support at launch.

Batch B
B1: Pass
B2: Pass
B3: Pass
B4: Pass
B5: Pass
B6: Pass
B7: Pass
B8: Pass

Batch C
C1: Pass
C2: Pass
C3: Pass
C4: Pass
C5: Pass
C6: Pass
C7: Pass
C8: Fail — Assumes the app caches data. The source gives no details about caching or the app’s data.

Batch D
D1: Borderline — Local processing supports privacy, but “easy to trust” implies broader trustworthiness without evidence.
D2: Pass
D3: Pass
D4: Pass
D5: Pass
D6: Pass
D7: Pass
D8: Pass

### Reviewer 2
Batch A

1. Pass.
2. Pass.
3. Pass.
4. Pass.
5. Pass.
6. Pass.
7. Pass.
8. Borderline — Endorses the release order without context about users’ offline needs.

Batch B

1. Pass.
2. Pass.
3. Pass.
4. Pass.
5. Pass.
6. Pass.
7. Pass.
8. Pass.

Batch C

1. Pass.
2. Pass.
3. Pass.
4. Pass.
5. Pass.
6. Pass.
7. Pass.
8. Fail — Assumes the app caches data. The source gives no storage details.

Batch D

1. Borderline — Local processing supports privacy, but the broader claim about trust lacks support.
2. Pass.
3. Pass.
4. Pass.
5. Borderline — The supplied warning does not name the project. The reply leaves unclear whether naming it is a suggestion.
6. Pass.
7. Pass.
8. Pass.

All four replies to source 7 use the same database-redesign joke. Individual appropriateness and cross-sample variation are different criteria. Reviewer 2 marked D5 borderline because it missed a suggested wording change. This may be a false positive. On this set reviewers identify one baseline fail and one baseline borderline. The selfcheck receives one borderline from reviewer 1 and two from reviewer 2. The samples do not establish a reliable production pass rate.

## Naturalness instruction comparison
Sources:
1. After a year of working alone, I just hired the first person to join my software project.
2. My open-source image editor now has layers and undo. Took a while, but it's out.
3. I don't think a website needs to work without JavaScript anymore.
4. I tried to make a searchable archive from my notes. It turns out I had never saved half of them.
5. What should this button say: "Remove account" or "Delete account"? It permanently removes the user's account.
6. We shipped a bug to production today. We reverted and are still finding the cause.
7. My weekend project now has a roadmap, a backlog, and no code.
8. I got a small language model running on an old laptop. The demo uses local weights and no network.

### current sample 1
1. That's a real milestone. Going from solo to two people changes everything about how the work moves.

2. Layers and undo both landing is a good day. Undo especially, since everyone assumes it was always there.

3. Depends who lands on it. For a dashboard, sure. For a page someone opens on a slow phone from a link, I'd still want the first paint to work.

4. Funny how that works. The archive project turns into an audit of everything you thought you had.

5. "Delete account", since it's permanent. "Remove" reads like it can be undone.

6. Good that the revert was quick. Hope the cause shows up soon.

7. Roadmap, backlog, no code. That's a well-organized weekend.

8. Local weights with no network is the part I like. Nice that it runs at all on old hardware.

### current sample 2
1. Congrats on the first hire. A year alone is a long stretch to carry a project. What are you handing over first?

2. Layers and undo out the door — nice. That is a big chunk of editor work. Does undo cover layer operations too?

3. I would still keep a no-JS path for docs and error pages, but for an app I agree with you.

4. The archive found the real gap: half the notes were never saved. Where were they living before?

5. "Delete account." It matches what actually happens, and "remove" reads as reversible.

6. Reverting first was the right move with production down. Hope the cause shows up soon.

7. Roadmap, backlog, no code — the project is fully aligned and empty. What is the first thing you build?

8. Running local weights on an old laptop is a good demo. What model size fits on it?

### naturalness sample 1
1. Congrats on the first hire. Going from a solo year to a team of two changes the shape of the day. What are you handing over first?

2. Undo is the feature people notice only when it is missing. Nice to see both land.

3. For a dashboard, agreed. For docs or a storefront, I would still want the page to render without JavaScript.

4. That is the tool telling you what you never wrote down. Are you backfilling the missing half, or starting from today?

5. Delete account. "Remove" sounds like it takes the account off a list.

6. Reverting first was the right move. Hope the cause shows up soon.

7. Roadmap and backlog first, code later. Which item gets the first commit?

8. Local weights with no network on an old laptop is a neat demo. Which model did you get running on it?

### naturalness sample 2
1. Congratulations. A year of working alone is a long stretch — what's the first thing you're handing over?

2. Layers and undo both landing at once is good timing. Undo is the one I'd have dreaded most, so nice work getting it out.

3. I lean the other way. Docs, articles, simple forms — plenty of pages get by fine, and the ones that need a script usually need a small one. What changed your mind?

4. That's the part nobody warns you about. The index tells you the truth about your own filing habits. Are you filling the gaps, or living with what survived?

5. Delete account. It matches what actually happens — "remove" reads like it might come back.

6. Rough day. Reverting buys you room to think, at least. Hope the cause shows up soon.

7. A roadmap and a backlog with no code is a design document with ambition. Which of them do you think survives contact with the editor?

8. Nice. Which model did you get running, and how slow is it on that hardware?

Blind mapping A=naturalness 2, B=current 1, C=naturalness 1, D=current 2.
### Reviewer 1
A1: Pass.
A2: Pass.
A3: Pass.
A4: Pass.
A5: Pass.
A6: Pass.
A7: Pass.
A8: Borderline. “How slow” assumes poor performance before the author describes it.

B1: Pass.
B2: Borderline. “Everyone assumes it was always there” invents a user expectation.
B3: Pass.
B4: Pass.
B5: Pass.
B6: Fail. The source does not say the revert was quick.
B7: Pass.
B8: Borderline. “Nice that it runs at all” can sound dismissive of the achievement.

C1: Pass.
C2: Pass.
C3: Pass.
C4: Fail. Unsaved notes are not necessarily unwritten notes. The reply changes the source’s meaning.
C5: Pass.
C6: Borderline. “The right move” grades the decision without enough incident context.
C7: Pass.
C8: Pass.

D1: Pass.
D2: Pass.
D3: Pass.
D4: Pass.
D5: Pass.
D6: Fail. The source does not say production was down. The reply also grades the revert decision.
D7: Pass.
D8: Pass.

### Reviewer 2
A1: Pass.
A2: Pass.
A3: Pass.
A4: Pass.
A5: Pass.
A6: Pass.
A7: Pass.
A8: Borderline. “How slow” assumes poor performance without evidence.

B1: Borderline. “Changes everything” overstates what the source supports.
B2: Pass.
B3: Pass.
B4: Pass.
B5: Pass.
B6: Fail. The source does not say the revert was quick.
B7: Pass.
B8: Pass.

C1: Pass.
C2: Pass.
C3: Pass.
C4: Fail. Notes that someone never saved are not necessarily notes they never wrote.
C5: Pass.
C6: Borderline. “The right move” grades the response without enough incident context.
C7: Pass.
C8: Pass.

D1: Pass.
D2: Pass.
D3: Pass.
D4: Pass.
D5: Pass.
D6: Fail. The source reports a production bug, not a production outage.
D7: Pass.
D8: Pass.

Both reviewers flagged the naturalness reply that changed unsaved notes into unwritten notes and a question presuming slow inference. They also flagged current-prompt incident replies that invented a quick revert and a production outage. The naturalness change has not established a meaningful improvement. Evaluator disagreements remain; favor the underlying examples over aggregate scores.

## Context-sensitive silence test
Sources:
1. A developer announces their first open-source release. Nobody has replied yet.
2. A stranger posts “testing 1 2 3” with no other context.
3. A developer says their deployment broke and they don't know why yet. The author adds: “Please no debugging suggestions for now; I'm taking a break.”
4. A person asks: “Which is clearer for a button that removes access but keeps data: Remove member or Delete member?”
5. An author writes: “My first paying customer just signed up!” The account has already left a congratulatory reply.
6. A developer jokes: “I automated a job I do once a year and now the script has a roadmap.”
7. A creator shares a local audio tool. They say audio stays on the device. A previous reply already asked what platforms it supports and the author answered.
8. A post is a screenshot, but the screenshot contents are unavailable and its caption says only “Thoughts?”

DeepSeek replies:
1. Nice. The first release is the hard one. What do you want to add next?
2. SKIP
3. Rough day. Enjoy the break, it will still be broken later.
4. Remove member. "Delete" suggests the data goes too.
5. SKIP
6. Give it a quarterly cadence and it will ask for a team.
7. How large a file can it handle before it slows down?
8. SKIP

### Reviewer 1
1. BORDERLINE — Congratulations fit the milestone. “The first release is the hard one” generalizes. The roadmap question shifts attention from celebrating to more work without a clear purpose.

2. PASS — SKIP fits. The post offers little context for a purposeful reply.

3. BORDERLINE — Respects the request for no debugging suggestions. “It will still be broken later” risks sounding dismissive and assumes the problem persists. “Rough day. Enjoy the break.” fits better.

4. PASS — Directly answers the wording question. The explanation matches the stated behavior: access ends, data remains.

5. PASS — SKIP avoids repeating congratulations. The context supplies no further contribution.

6. PASS — The joke extends the roadmap premise. It fits peer humor without requiring technical insight or an existing relationship.

7. BORDERLINE — File capacity is relevant and differs from the answered platform question. However, the wording assumes larger files cause slowdown. “Does it have a file-size limit?” avoids that premise.

8. PASS — SKIP fits because the screenshot is unavailable. A substantive opinion would require unseen information.

### Reviewer 2
1. PASS — Encouragement fits a first release. The question invites the author to share plans without inventing project details.

2. PASS — SKIP. The post gives no clear opening for a purposeful reply. Silence fits.

3. BORDERLINE — Respects the request for no debugging suggestions. But “still be broken later” assumes the outcome and risks sounding dismissive. Simple support fits better.

4. PASS — Directly answers the wording question. The explanation matches the stated distinction between removing access and keeping data.

5. PASS — SKIP. The account already congratulated the author. Another reply has no stated additional purpose.

6. PASS — Extends the roadmap joke naturally. The exaggeration reads as humor and needs no assumed relationship.

7. BORDERLINE — A capacity question can help someone assess the tool. But the reply assumes file input and an eventual slowdown. Neither appears in the provided context. The earlier platform answer does not establish either premise.

8. PASS — SKIP. The unavailable screenshot contains the substance. A reply would require guessing what the author wants assessed.

Both reviewers accepted the three skips and flagged the incident reply and the capacity question as borderline. One reviewer also flagged the first release reply. One DeepSeek sample is not enough to estimate reliability.

## Social-act selection comparison
Sources:
1. After two years of trying, I got my first open-source patch merged today. I am so happy.
2. A developer posts “hello test” and nothing else.
3. A creator writes: “My demo crashed on stage. I'm embarrassed. Please don't suggest fixes today.”
4. Does "Keep draft" make sense for a button that saves unfinished changes without publishing them?
5. My teammate helped me untangle a frustrating bug today.
6. I built a search tool for my own notes. It works without an internet connection.
7. Someone posts: “My scheduled script now has its own design doc and project board.”
8. Someone shares a photo with caption “Should I change anything?” The photo contents are unavailable.

### baseline sample 1
1. Two years, then it landed. Congratulations.

2. SKIP

3. No fixes. That sounds like a bad day, and you are allowed to feel it.

4. "Save draft" says what the press does. "Keep" reads like a choice, not a write.

5. Good teammates make hard bugs smaller. Glad one was there.

6. Offline is the part I like. Does it rebuild the index, or update as notes change?

7. Next milestone: the script reviews its own design doc.

8. SKIP

### baseline sample 2
1. Two years of work, and the patch is in main. Well done.
2. SKIP
3. No fixes then. You stood in front of people and shipped something real, and that part still counts.
4. It reads clearly to me: save it, publish nothing. "Keep" also suggests the draft survives closing the editor, so make sure it does.
5. A second pair of eyes on a stubborn bug is one of the best parts of this job. Tell them.
6. Offline search over your own notes is the version I would trust. Does it index as you write, or only when you ask?
7. The script has a board now. Next it asks for stakeholders and a roadmap review.
8. SKIP

### candidate sample 1
1. Two years is a long haul. Congratulations on the merge. Which project?
2. SKIP
3. No fixes, then. That sounds like a rough moment to sit through.
4. "Save draft" reads clearer. "Keep" sounds like a toggle or a retention choice, not an action.
5. That is the good kind of day. Nice that they dug in with you.
6. Offline search over your own notes is underrated. What does the index look like, plain grep or something with ranking?
7. The script now has more process than most teams. Does the board have a column for the board?
8. I cannot see the image here. What part of it are you unsure about?

### candidate sample 2
1. Two years of trying is a long time. Congratulations on the merge.
2. SKIP
3. That is a hard moment to stand in. No fixes from me. Glad you went up there.
4. "Keep draft" reads as keeping, not saving. "Save draft" says what the button does.
5. A second pair of eyes changes those days completely. Good teammate.
6. Nice. How do you index the notes, plain full text or embeddings?
7. At this rate the cron job needs a steering committee.
8. SKIP

Blind mapping A=candidate 1, B=baseline 2, C=candidate 2, D=baseline 1.
### Reviewer 1
Batch A

1. PASS
2. PASS
3. PASS
4. PASS
5. PASS
6. BORDERLINE — Relevant curiosity, but “the index” assumes an implementation the source never states. Grep can search without an index.
7. PASS — Clear humor that fits the source.
8. PASS — Acknowledges the missing image and asks for useful context without inventing visual details.

Batch B

1. FAIL — “Two years of work” changes trying into continuous work. “In main” invents the destination branch.
2. PASS
3. BORDERLINE — Support fits, but “shipped something real” adds an outcome that a crashed stage demo does not establish.
4. PASS
5. PASS — The suggestion to thank the teammate fits the appreciation.
6. BORDERLINE — The trust preference is valid. The question assumes indexing exists and offers two unestablished update modes.
7. PASS — The imagined demands are obvious humor.
8. PASS

Batch C

1. PASS
2. PASS
3. PASS
4. PASS
5. PASS
6. BORDERLINE — The question assumes the tool indexes notes. Full text and embeddings also narrow the possibilities without evidence.
7. PASS — Obvious exaggeration fits the process joke.
8. PASS

Batch D

1. PASS
2. PASS
3. PASS — Acknowledges the embarrassment and respects the request for no fixes.
4. BORDERLINE — The recommendation fits, but “what the press does” and “not a write” make a simple wording judgment harder to understand.
5. PASS
6. BORDERLINE — Expresses a valid preference, then assumes an index exists and needs rebuilding or incremental updates.
7. PASS — The imagined milestone fits the joke.
8. PASS

No reply clearly invents personal experience. The main grounding problems concern added outcomes and assumed search implementations.

### Reviewer 2
Batch A

1. Pass.
2. Pass. SKIP fits the lack of a clear conversational purpose.
3. Pass.
4. Pass.
5. Pass.
6. Borderline. Relevant curiosity, but “the index” assumes an implementation detail. The grep option softens that assumption.
7. Pass. The exaggeration is clear humor.
8. Pass. States the missing context and asks a useful question.

Batch B

1. Borderline. “In main” invents the destination branch. “Two years of work” can imply continuous work on this patch.
2. Pass.
3. Borderline. Respects the boundary, but “shipped something real” adds an achievement the source does not establish.
4. Pass. The persistence point is a reasonable interpretation and conditional advice.
5. Pass. Encouraging thanks fits the situation. “This job” does not establish invented personal experience.
6. Borderline. The trust preference is valid opinion. The question assumes the tool maintains an index.
7. Pass. Clear humor that follows the source’s premise.
8. Pass. SKIP fits when the image provides no accessible basis for feedback.

Batch C

1. Pass.
2. Pass.
3. Pass.
4. Pass.
5. Pass.
6. Borderline. Assumes indexing and narrows the implementation to two options without evidence. The conversational purpose is suitable.
7. Pass. “Cron job” functions as casual shorthand within an obvious joke.
8. Pass.

Batch D

1. Pass.
2. Pass.
3. Pass.
4. Borderline. The suggestion fits, but “what the press does” and “not a write” make a simple wording judgment harder to understand.
5. Pass.
6. Borderline. Expresses a grounded preference, then assumes an index and two possible update strategies.
7. Pass. Clear humor.
8. Pass.

Both reviewers marked the search-tool replies borderline because each assumes the tool has an index. Candidate got 14 pass and two borderline. Baseline got 11 pass, four borderline and one fail by reviewer 1; 11 pass and five borderline by reviewer 2. This small test does not establish general improvement. The example with unseen photo got one request for additional context, which both reviewers accepted, and three skips.

## Question assumptions comparison
Sources:
1. I built a tool to organize my research notes. It works offline.
2. Our team's release failed and we are still investigating. Taking a short break before we look again.
3. I launched my first tool today after months of learning.
4. I made a program to search local log files.
5. Would "Leave workspace" be clear for a button that removes your access but keeps the workspace intact?
6. The feature demo is tomorrow. I spent today fixing a crash.
7. This side project started as a script and now it has a governance committee.
8. A stranger posts "test" with no context.

### baseline sample 1
1. Offline is the part I'd want to know more about. Does it keep notes as plain files, or in its own database?

2. Stopping before the second look is the right call. Hope the cause turns out to be something boring.

3. Nice. What does it do?

4. Does it read rotated and gzipped logs, or only plain files?

5. "Leave workspace" reads like the workspace stays and you exit. If the worry is people thinking their data goes too, "Remove my access" says what actually happens.

6. Getting the crash fixed before the demo instead of during it is the win. Hope nothing new appears overnight.

7. A governance committee. At least you can point to the exact commit where it stopped being a script.

8. SKIP

### baseline sample 2
1. Offline is the part I care about. What format does it store the notes in?
2. A break before the second look is usually right. I hope the logs line up when you return.
3. Congrats. What was the hardest part to get right?
4. Nice. Does it handle gzipped or rotated files, or only plain text?
5. Not clear. "Leave workspace" reads like the workspace survives for you. "Remove my access" says what it does.
6. Good luck tomorrow. A crash fixed today beats a crash found during the demo.
7. The script got a governance committee before it got users. Respect.
8. SKIP

### candidate sample 1
1. Offline is the detail that makes a notes tool useful. Good luck with it.

2. A break before the second look is a good call. Hope the cause is clear when you return.

3. Congrats on shipping. Getting the first one out is a real step.

4. Local log search is a quietly useful thing to build. Nice work.

5. "Leave workspace" reads as access ending while the workspace stays, which matches. "Remove my access" is more explicit if you expect confusion.

6. Finding the crash today beats finding it in the demo. Hope tomorrow goes smoothly.

7. Every script eventually wants a charter. What does this one govern?

8. SKIP

### candidate sample 2
1. Offline is the part I'd want to hear about. What made you keep it local?

2. A break is the right call. Fresh eyes beat a fifth pass over the same logs.

3. Congratulations. Months of learning to a first launch is a real step.

4. What's the part you're happiest with?

5. I'd read "Leave workspace" as "the workspace goes away for me", which is right if access goes and the data stays. The risk is people hearing "delete". "Remove my access" is clunkier but harder to misread.

6. Hope the fix holds and tomorrow is boring.

7. Next it will ask you for approval before the script runs.

8. SKIP

Blind mapping A=candidate 1, B=baseline 1, C=candidate 2, D=baseline 2.
### Reviewer 1
Batch A

1. PASS
2. PASS
3. PASS
4. PASS
5. PASS
6. PASS — The crash is known before the demo. The reply does not claim a completed repair.
7. PASS — Playful exaggeration followed by a relevant question.
8. PASS — SKIP fits the lack of context or apparent purpose.

Batch B

1. PASS
2. PASS
3. PASS
4. PASS
5. PASS
6. BORDERLINE — “Getting the crash fixed” assumes the repair succeeded. The source only says the author spent today fixing it.
7. PASS — The “exact commit” line reads as obvious humor about the project's growth.
8. PASS

Batch C

1. BORDERLINE — “Keep it local” implies a storage or deployment choice. Offline operation does not establish that the tool stays entirely local.
2. FAIL — “A fifth pass over the same logs” invents both repeated attempts and the investigation material.
3. PASS
4. PASS
5. PASS — The possible deletion confusion appears as a design concern, not an established user reaction.
6. BORDERLINE — “Hope the fix holds” assumes a completed repair. The source leaves the repair status open.
7. PASS — The imagined approval requirement clearly serves the governance joke.
8. PASS

Batch D

1. PASS
2. BORDERLINE — The supportive purpose fits, but “the logs line up” assumes the investigation involves logs.
3. PASS — The question invites reflection without inventing a specific difficulty.
4. PASS
5. BORDERLINE — “The workspace survives for you” is unclear. The explanation blurs continued workspace existence with continued personal access.
6. BORDERLINE — “A crash fixed today” assumes success that the source does not establish.
7. BORDERLINE — The joke adds “before it got users,” an unsupported claim that can sound dismissive of the project's adoption.
8. PASS

No reply invents personal experience. Statements about what the speaker values or how they read a label express preferences and judgments.

### Reviewer 2
Batch A

1. PASS. A subjective preference and friendly support fit the launch.
2. PASS. Supports the stated break without guessing the cause.
3. PASS. Congratulations fit the first launch.
4. PASS. Brief appreciation fits the tool.
5. PASS. Answers the wording question and offers a grounded alternative.
6. PASS. Fixing a crash establishes its discovery, even if the repair remains incomplete.
7. PASS. Obvious humor follows the source. The question has a stated basis.
8. PASS. SKIP fits the absence of context or a clear conversational purpose.

Batch B

1. PASS. The storage question expresses relevant curiosity without assuming an answer.
2. PASS. Support and the wish for a simple cause fit the situation.
3. PASS. Congratulations and a basic question fit an unspecified first tool.
4. PASS. A relevant capability question. Technical detail is optional, but suitable here.
5. PASS. Answers directly. The possible concern about data loss remains conditional.
6. BORDERLINE. The source says the author worked on a crash. The reply assumes they completed the repair.
7. PASS. The commit reference reads as an obvious joke about the project's growth.
8. PASS. SKIP fits.

Batch C

1. BORDERLINE. Offline operation does not establish that the author chose to keep everything local. The question slightly overstates the design decision.
2. BORDERLINE. Support fits, but “a fifth pass” and “the same logs” invent investigation details.
3. PASS. Recognizes the stated learning and launch.
4. PASS. An open question invites pride or reflection without requiring a technical insight.
5. PASS. Gives a clear interpretation and identifies a possible ambiguity as a risk.
6. BORDERLINE. The supportive wish fits, but “the fix holds” assumes a completed repair.
7. PASS. Obvious humor extends the governance joke.
8. PASS. SKIP fits.

Batch D

1. PASS. A stated preference and relevant storage question fit.
2. BORDERLINE. Support fits, but the source does not mention logs. The wish assumes a particular investigation method.
3. PASS. Congratulations and a reflective question fit the learning milestone.
4. PASS. The capability question remains grounded in local log search.
5. BORDERLINE. A negative wording judgment is valid, but “survives for you” is unclear. The explanation does not clearly identify the ambiguity.
6. BORDERLINE. The reply assumes the crash is fixed. The source establishes only that the author spent today fixing it.
7. BORDERLINE. The joke fits the tone, but “before it got users” adds an unsupported claim about adoption.
8. PASS. SKIP fits.

No reply invents personal experience. The main grounding problems concern investigation details, completed repairs, and the project's users.

Candidate scored 13 passes vs 11 baseline under both reviewers, but candidate included an invented fifth pass over logs. The candidate named a previous example of an unsupported index, so the result can overfit that detail. Sample size and evaluator limitations remain.




## Silence experiment
Sources:
1. I just launched my first project after learning to code for a year.
2. A photo of my desk on a cloudy morning.
3. We made our command-line tool open source today. It exports database schemas to text.
4. Every developer should use the same editor.
5. A coworker sent me a helpful link and it solved my issue.
6. I'm choosing between "Remove member" and "Delete member" for a button that removes access but preserves their data. Which label is clearer?
7. Just spent three hours automating a task I do once a year.
8. Our deploy failed but we do not know the cause yet.

### reply_required sample 1
1. Congratulations. A year of learning and you shipped something — what did you build?

2. Cloudy mornings make good desk weather. What are you working on today?

3. Schema to text is handy for diffing across migrations. Which databases does it support?

4. I'd disagree. One editor for everyone sounds like a support problem, and muscle memory varies a lot between people.

5. Good coworkers are underrated. Glad it got sorted.

6. "Remove member" — "Delete" suggests the data goes too, which is the opposite of what happens.

7. Classic. The automation is the fun part, the saved time is a bonus.

8. Unknown cause is the frustrating part. Are you waiting on logs, or still trying to reproduce it?

### reply_required sample 2
1. Congratulations on shipping the first one. That takes more than learning the syntax.
2. Cloudy mornings make for good desk time. Hope the work went well.
3. Nice. Does the export include indexes and constraints, or just tables and columns?
4. I don't think one editor for everyone works. People solve problems in different ways, and the tooling should follow that.
5. Good when a link actually lands. Small wins count.
6. "Remove member" fits better, since the data stays. "Delete member" suggests the record goes too.
7. Three hours now, one saved next year. The maths only works if you enjoy the three hours.
8. Hard to say much while the cause is unknown. Do the logs point at a specific step?

### skip_allowed sample 1
1. Congrats. What did you build?
2. Nice light for a work session. What are you working on today?
3. Open sourcing it is a good move. Which databases does the exporter handle?
4. Same editor everywhere sounds tidy until you pair on someone else's setup. What breaks for you when you switch?
5. Nice when that happens. Did you tell them it worked?
6. "Remove member" reads as access only. "Delete member" hints the record goes too.
7. Three hours well spent if the automation was the fun part. Was it?
8. Rough one. Do the logs point anywhere yet, or is it still a mystery?

### skip_allowed sample 2
1. Congrats on shipping. What does the project do?
2. Cloudy mornings are the best desk light. Looks peaceful.
3. Nice. Does it handle more than one database dialect?
4. I'll keep my editor, thanks. Muscle memory is worth a lot.
5. Good when a link lands exactly right.
6. "Remove member". "Delete" suggests the data goes too.
7. Three hours well spent, once a year, forever. I respect it.
8. Rough. Hope the logs say more than the end of that message did.

Blind mapping A=skip allowed 1, B=reply required 1, C=skip allowed 2, D=reply required 2. Neither skip-allowed sample skipped any post. The reviewer found a plausible social purpose for every post, so this cannot establish that the model refuses to skip when appropriate.
### Reviewer 1
Batch A

1. PASS — Relevant congratulations and curiosity.
2. BORDERLINE — “Nice light” invents a visual detail. The question gives the reply a valid conversational purpose.
3. PASS — Support and a relevant product question.
4. BORDERLINE — “What breaks for you” assumes switching editors causes the author problems.
5. PASS — Warm acknowledgment and a relevant follow-up.
6. PASS — Direct, grounded advice about the labels.
7. PASS — Humor with a conditional question. No assumed enjoyment.
8. PASS — Support and a reasonable diagnostic question.

Batch B

1. PASS — Grounded congratulations and curiosity.
2. PASS — A subjective observation and an ordinary conversation starter.
3. PASS — Schema exports plausibly support comparisons. The database question fits.
4. PASS — Clear disagreement with a stated rationale.
5. PASS — Appropriate support for a small positive event.
6. PASS — Direct advice that reflects the stated behavior.
7. PASS — Recognizable automation humor. The enjoyment claim reads as a general joke.
8. BORDERLINE — The question narrows the investigation to two unsupported possibilities. Asking about current findings would avoid that premise.

Batch C

1. PASS — Relevant congratulations and curiosity.
2. BORDERLINE — “Looks peaceful” claims a visual impression absent from the supplied context. The lighting preference is subjective.
3. PASS — A relevant capability question.
4. BORDERLINE — “My editor” introduces an unsupported personal setup. The disagreement itself fits.
5. PASS — Brief acknowledgment with a clear social purpose.
6. PASS — Concise, grounded label advice.
7. PASS — Supportive exaggeration. “Forever” reads as humor.
8. BORDERLINE — The joke targets the author’s limited explanation during a failure. The tone risks sounding dismissive.

Batch D

1. PASS — Supportive recognition of the effort behind shipping.
2. PASS — A subjective observation and a friendly wish.
3. PASS — Specific questions about plausible schema contents. Neither capability is asserted.
4. PASS — Clear disagreement with a relevant rationale.
5. PASS — Suitable acknowledgment of a small success.
6. PASS — Direct advice grounded in preserved data.
7. FAIL — “One saved next year” invents a time saving. The payoff judgment depends on that unsupported number.
8. PASS — The opening adds little, but the logs question has a clear diagnostic purpose.

No entry requires SKIP. Each source supports at least one suitable conversational purpose.

### Reviewer 2
I treat ordinary opinions, hypothetical examples and clear jokes as valid. Questions fail grounding when they assume unsupported facts.

Batch A

1. PASS.
2. BORDERLINE. “Nice light” claims a visual detail that the source does not establish. The work question gives the reply a conversational purpose.
3. PASS.
4. BORDERLINE. “What breaks” assumes switching editors causes problems for the author. The disagreement itself fits.
5. PASS.
6. PASS.
7. PASS.
8. PASS.

Batch B

1. PASS.
2. PASS.
3. PASS.
4. PASS.
5. PASS.
6. PASS.
7. PASS. The fun-versus-savings line reads as a playful response to the source’s joke.
8. PASS. The question offers possible investigation paths without claiming either is underway.

Batch C

1. PASS.
2. BORDERLINE. “Looks peaceful” infers the photo’s appearance beyond the supplied description. The preference for cloudy light is a valid opinion.
3. PASS.
4. BORDERLINE. “My editor” implies an established personal tool preference without supporting context. The playful disagreement otherwise fits.
5. PASS.
6. PASS.
7. PASS. “Forever” reads as obvious comic exaggeration.
8. BORDERLINE. The joke targets the author’s sparse message during a failed deploy. Shared teasing could work, but the supplied context does not establish that relationship.

Batch D

1. PASS.
2. BORDERLINE. “Hope the work went well” assumes a completed work session. The source establishes only a desk photo.
3. PASS.
4. PASS.
5. PASS.
6. PASS.
7. FAIL. “One saved next year” invents a one-hour saving. The claim about the maths depends on that unsupported number.
8. PASS. The opening feels slightly distancing, but the question provides a grounded troubleshooting purpose.

No entry requires SKIP. Each source supports some suitable conversational purpose.


## Source comprehension comparison
Sources:
1. We rolled back a release after seeing an unusual error rate. We don't know the cause yet.
2. I built an app that summarizes PDFs on-device. Images are not supported yet.
3. Our tool can export to CSV. We plan to add JSON next month.
4. A customer found a typo in the error message. Glad they told us.
5. I tried writing a migration script. It stopped halfway, but no data was lost.
6. My teammate fixed the bug I spent all afternoon chasing. They found a missing config entry.
7. Do you think this label is clear? "Archive project" hides it from the list but doesn't delete it.
8. Our first benchmark looked promising, but we haven't tested it under load.

### selfcheck sample 1
1. Good call on the rollback. Hope the cause turns up soon.
2. On-device summarizing is a fun constraint to build against. Does it run fully offline?
3. CSV now, JSON next month — that seems like a sensible order.
4. Glad they took the time to report it instead of just moving on.
5. Stopping halfway with nothing lost is a relief. Hope the rerun is quiet.
6. A missing config entry after an afternoon of hunting — that stings and relieves at once. Glad it is fixed.
7. It reads as reversible to me. "Archive" suggests hidden, not gone.
8. Promising first numbers are worth having. Curious how it holds up under load.

### selfcheck sample 2
1. Rolling back before you knew the cause is a fair call. Did the error rate settle once the old build was back?

2. On-device summarizing is a fun constraint to work with. How does it handle a long PDF?

3. CSV export covers a lot of people already. Is JSON something users asked for, or your own next step?

4. The good kind of bug report. Small thing, but they took the time.

5. Halfway with no data loss is a decent first run. Can you resume it from where it stopped?

6. A missing config entry. Of course it was. Glad they found it before the afternoon became a day.

7. Archive reads as reversible to me, so the label works. Is there an obvious place to find the project again afterwards?

8. Promising first numbers are nice to have. Are you going to put it under load yourself, or wait for real traffic?

### factcheck sample 1
1. Rolling back while the cause is unknown seems wise. Did the error rate drop once the old build was live again?

2. On-device summarising is a nice constraint. Are scanned PDFs in scope later, or is text-only the plan for now?

3. CSV first makes sense. Will the JSON export keep the same field names, or use a different shape?

4. Good that they took the time to report it. Was it a quick word fix, or did the message need rewording too?

5. Halfway with no data loss is not a bad first run. Do you know which step it stopped on?

6. A missing config entry, of course. Glad it is fixed. Did you get to see what that entry controlled?

7. I read "Archive" as reversible, so the label works for me. Where do archived projects show up, a filter or a separate view?

8. Promising first numbers are worth something. What does the benchmark measure, latency or throughput?

### factcheck sample 2
1. Good call on the rollback. Hope the cause shows up soon.

2. On-device summaries for PDFs are a nice fit. Do the page numbers survive into the output?

3. Will the JSON follow the same shape as the CSV, or start fresh?

4. Nice that they told you instead of just bouncing off it.

5. Halfway and no data lost is a relief. Could you resume from where it stopped?

6. The missing config entry. Classic. Glad it is closed.

7. I would read "Archive" as hidden rather than deleted, but I have used tools that mean the opposite. "Hide from list" removes the guess.

8. Nice first number. Load usually tells a different story, so good luck when you get there.

Blind mapping A=factcheck 1, B=selfcheck 2, C=factcheck 2, D=selfcheck 1.
### Reviewer 1
A1: Pass.
A2: Pass.
A3: Pass.
A4: Pass.
A5: Borderline. “Not a bad first run” grades their attempt and assumes this was the first run.
A6: Pass.
A7: Pass.
A8: Pass.

B1: Pass.
B2: Pass.
B3: Borderline. “Covers a lot of people already” assumes user needs that the source does not establish.
B4: Pass.
B5: Borderline. “A decent first run” grades their attempt and assumes this was the first run.
B6: Pass.
B7: Pass.
B8: Pass.

C1: Pass.
C2: Pass.
C3: Pass.
C4: Borderline. “Bouncing off it” implies customer frustration or abandonment beyond the source.
C5: Pass.
C6: Pass.
C7: Fail. Invents personal experience with other tools. The label suggestion itself is clear and relevant.
C8: Borderline. “Load usually tells a different story” adds an unsupported generalization and implies the promising result will change.

D1: Pass.
D2: Pass.
D3: Pass.
D4: Pass.
D5: Borderline. “The rerun” assumes a next step that the source does not mention.
D6: Pass.
D7: Pass.
D8: Pass.

### Reviewer 2
A1: Pass.
A2: Pass.
A3: Pass.
A4: Pass.
A5: Fail. Invents a first run and grades the failed migration with potentially patronizing praise.
A6: Pass.
A7: Pass.
A8: Pass.

B1: Pass.
B2: Pass.
B3: Borderline. “Covers a lot of people already” assumes the export meets user needs without evidence.
B4: Pass.
B5: Fail. Invents a first run and grades the failed migration with potentially patronizing praise.
B6: Pass.
B7: Pass.
B8: Pass.

C1: Pass.
C2: Pass.
C3: Pass.
C4: Pass.
C5: Pass.
C6: Pass.
C7: Fail. Invents personal experience with tools where Archive means deletion.
C8: Borderline. “Load usually tells a different story” introduces an unsupported generalization and sounds dismissive of the early result.

D1: Pass.
D2: Pass.
D3: Pass.
D4: Pass.
D5: Pass.
D6: Pass.
D7: Pass.
D8: Pass.

## Independent diagnosis
The replies show several useful peer behaviors, but they often turn a conversation into an interview. The samples establish recurring patterns. They do not establish their cause.

Recurring strengths:

- Several replies offer simple support without forcing advice. “Rough day” fits the production incident. Thanking someone for reporting a typo also fits.
- Humor works best when it extends the author’s joke. “That’s a well-organized weekend” adds something without demanding an answer.
- The account-deletion replies answer the actual question directly. They connect the label to permanence.
- Some questions address a meaningful uncertainty. Asking whether errors fell after rollback connects the action to its observed result.
- Several replies express disagreement politely. The JavaScript responses distinguish different uses instead of treating all websites alike.

Recurring failures:

- Questions often appear without a clear conversational reason. Set 2, Sample 3 asks a question in all eight replies.
- Some questions create work for little apparent benefit. CSV field names and the missing configuration entry may matter, but the posts give no reason to prioritize them.
- Many openings merely approve or restate the post. “CSV now, JSON next month” adds little before calling the order sensible.
- Repeated phrases reduce the sense of an individual response. Rollback replies repeatedly combine approval with “Hope the cause shows up soon.”
- Some replies add unstated facts. Set 1, Sample 2 says production was down. The post states only that a bug reached production.
- Set 1, Sample 1 calls the revert quick. The post gives no timing.
- Several archive replies change missing saved notes into unwritten notes or poor filing habits. Those explanations remain unknown.
- Set 2 migration replies assume a first run or anticipate a rerun. The post states neither.
- “Halfway with no data loss is a decent first run” gives broad approval despite an unexplained interruption.
- Set 2, Sample 4 claims personal experience with tools that use “Archive” differently. The supplied material does not support that experience.
- Set 1, Sample 4 partly shifts the JavaScript dispute toward how much script pages need. Script size does not answer whether pages must work without JavaScript.

Some questions remain plausible rather than clearly defective. On-device processing does not establish full offline operation, so the offline question is valid. Its conversational value still needs judgment.

All 64 outputs contain replies. Silence therefore receives no observable evaluation. The data cannot show whether the model rejects silence or whether the experiment requires a reply.

Competing explanations:

- A question may serve as a default engagement tactic. Alternatively, the model may interpret these short posts as invitations for technical discussion. Compare unsolicited questions with independently judged conversational value.
- Repeated approval may reflect a response template. Alternatively, release announcements and incident updates may naturally invite similar support. Compare replies to posts with different emotional and conversational purposes.
- Added details may reflect weak factual restraint. Alternatively, they may arise from familiar narrative completion, such as interpreting a production bug as downtime. Test minimal post pairs that explicitly establish or exclude those details.
- Generic replies may reflect limited context. Alternatively, the model may struggle to choose a purpose even when context exists. Add thread context and check whether contributions become more specific.
- Limited criticism may reflect excessive agreeableness. Alternatively, most posts provide little reason for criticism. Include clear, contestable claims before judging that tendency.

One inexpensive next experiment:

Generate one response per post under three randomly ordered conditions: the current instruction, explicit permission to omit questions, and explicit permission to choose silence. Keep other instructions unchanged. Use blind human ratings for conversational value, factual support, and burden on the author. Count questions and silence separately. Fewer questions alone do not establish improvement.

The evidence has important limits. These are fictional, isolated posts without relationship history or recipient reactions. The prompt, model settings, sampling method, and sample independence are unknown. Repeated post content also limits generalization. Human ratings can assess plausible peer behavior, but these samples cannot establish whether recipients welcome the replies or continue the conversation.
