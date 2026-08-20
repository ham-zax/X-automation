# User-Language Research Guide

This guide is for eliciting the words non-technical operators, occasional reviewers, advanced operators, and stakeholders naturally use for the product's jobs, states, evidence, and controls.

It is a **research protocol**, not a product-language decision and not a record of interviews already conducted.

## Evidence discipline

- **Repository-observed:** current behaviors that scenarios may faithfully represent.
- **Stakeholder-stated:** concepts the research must cover even when the current product does not yet implement them.
- **Research hypothesis:** candidate language to test only after participants have supplied their own words.

Do not create a “user language ledger” from this document. A ledger should contain only real participant evidence with source/context.

## Research objective

Elicit language that answers four questions:

1. What does the participant call the **job** they are trying to do?
2. What do they think each **state/action** will cause?
3. How do they distinguish different **sources of evidence** and degrees of uncertainty?
4. Which words make the **human-control boundary** clear without requiring implementation vocabulary?

The goal is prediction and comprehension, not whether a participant says they “like” a label.

## Moderator rules

### Before showing product terms

- Describe a realistic situation, not a feature name.
- Ask the participant what they would call the thing/action/state.
- Ask them to explain what would happen next.
- Capture their words verbatim before paraphrasing.
- Accept “I don't know” as useful data.
- Do not repair an answer with product vocabulary.

### After natural language is captured

Only then show candidate terms to test interpretation. Ask what each term means and what consequence it implies. Do not ask leading preference questions such as “Is `Learn` clearer?”

### Keep evidence and authority questions separate

If a participant understands where something is but predicts the wrong consequence, record that as a consequence/authority comprehension problem rather than a navigation failure.

If a participant reaches the right evidence but cannot tell whether it is external, own-account, or experimental, record that as evidence-provenance confusion rather than task success.

## Participant role framing

Use the smallest role framing needed for the scenario.

### Daily operator

> You are responsible for deciding what this account should pay attention to, what is worth writing or replying to, and whether the final wording should be approved.

Do not assume the participant knows social-media operations vocabulary.

### Owner / stakeholder

> You care whether this activity is building the right audience, useful relationships, and real opportunities. You do not necessarily operate every post or reply yourself.

### Occasional reviewer

> You return when something needs editorial judgment. You may not remember every status or internal workflow term from the last time you used the product.

### Advanced operator

> You sometimes configure the AI provider/model, audience definition, or diagnostics, but you still expect ordinary day-to-day work not to require those details.

## Warm-up: get the participant's outcome language

Ask before opening the product:

1. “Imagine you were responsible for growing a technical account with useful AI/developer content. What would make you say the work is going well?”
2. “What would make you say the audience is getting **better**, not just bigger?”
3. “What outcomes would matter more to you than likes or views?”
4. “If someone said the account was creating ‘opportunities,’ what would that word mean to you?”
5. “What would count as proof of a real opportunity rather than an encouraging signal?”
6. “How would you describe the difference between getting attention and creating business value?”

### What to capture

- words for relevant/qualified audience;
- words for useful relationships;
- words for leads, partnerships, signups, revenue, career/build visibility, or other direct outcomes;
- whether “opportunity” means content idea, conversation opening, or business outcome;
- what evidence the participant requires before making a causal/business claim.

## Topic 1 — “What should I do today?”

### Unprimed scenario

> You open the tool with about ten minutes available. Some things may need your judgment; other information may only be useful background. What would you want the first screen to tell you?

Follow-ups:

- “What makes something deserve your attention now?”
- “How would you distinguish ‘look at this’ from ‘you need to decide this’?”
- “If nothing is worth doing, what should the tool say?”
- “What would you call a list of things waiting on you?”
- “What words would tell you an item is urgent because it may expire versus merely high quality?”

### Candidate terms to test later

After natural language is recorded, show:

- Today
- Needs your attention
- Worth doing now
- Recommended next step
- To review

Ask what each would contain and whether any implies an action has already been chosen.

## Topic 2 — Recommendation versus human decision

### Unprimed scenario

> The system has examined several sources and thinks one story is worth pursuing. It explains why, suggests a format, and gives supporting evidence. You have not agreed to do anything yet. What would you call what the system has produced?

Then:

> You decide the suggestion is worth pursuing and choose the format you want to work on. Nothing has been approved for publication. What would you call **that** step?

Follow-ups:

- “What should the interface say so you know the first thing is advice rather than a decision?”
- “What word would you use for your act of choosing one option to work on?”
- “When would you expect the system to stop using the word ‘recommended’?”
- “If you choose a different valid format than the one suggested, what should be recorded?”

### Candidate terms to test later

- recommendation
- suggestion
- plan
- selection
- chosen format
- selected recommendation

Ask participants to explain the difference in their own words. Do not ask them to select a favorite word without consequence explanation.

## Topic 3 — Draft, review, approval, schedule, publication

This is a high-consequence language study. Ask the participant to predict **what happens immediately** after each hypothetical control before revealing the product result.

### Scenario sequence

1. **Draft exists**
   > “AI has prepared wording, and you can edit it. What state is this in?”

2. **Readiness check**
   > “You press a control that checks the current wording, required evidence, and confirmations but is not allowed to publish anything. What would you call that control?”

3. **Human approval**
   > “You decide the exact wording is acceptable for publication. That decision may allow a background publishing process later, but the post is not public yet. What would you call the state now?”

4. **Planned time**
   > “The system recommends when the approved post should go out. You can override the time. What would you call that time or plan?”

5. **Waiting**
   > “The post is approved and has a plan, but the time has not arrived or publishing automation is off. What should its status say?”

6. **Transport in progress**
   > “The system has started trying to post to X but does not yet have authoritative confirmation. What should the state say?”

7. **Success**
   > “X confirms the post and returns its identity/link. What should the state say?”

8. **Ambiguous failure**
   > “The network operation may have reached X, but the product could not fully record the final result. What wording would stop you from carelessly trying again?”

### Candidate terms to test later

- draft
- check readiness
- review
- approve
- approved — waiting
- schedule
- planned time
- publishing
- published
- failed
- needs reconciliation

Ask:

- “Which of these sound reversible?”
- “Which one sounds like the public action already happened?”
- “Does ‘approve for publishing’ sound immediate or conditional?”
- “Does ‘scheduled’ sound guaranteed?”
- “What wording would tell you approval is not publication?”

## Topic 4 — Reply review, approval, and send

### Unprimed scenario

> You are replying to someone. The reply text is ready, but nothing should be sent until a person approves the exact text. After approval, there is a separate send action. How would you name those two decisions?

Then:

> If someone edits one word after approval, what should happen to the approval?

Follow-ups:

- “Would ‘approve and send’ make you expect one immediate public action?”
- “What wording would make it clear which exact text is being authorized?”
- “If send fails, what information would you need before retrying?”

This topic should reveal whether participants use “publish” for replies or reserve “send” for conversational actions.

## Topic 5 — “Winning” and evidence strength

### Unprimed scenario

> You are looking at posts from comparable accounts in the same niche. Some writing patterns are repeatedly associated with stronger performance after normalizing for things like audience size and post age. The evidence is observational, not proof that the pattern caused the outcome. How would you describe those patterns to a colleague?

Follow-ups:

- “What would ‘winning’ mean to you here?”
- “Would ‘best-performing’ sound causal?”
- “What words tell you the evidence is promising but not settled?”
- “What words tell you a pattern appeared repeatedly?”
- “If you saw a 90% interval, what would you think the 90% meant?”
- “What wording would stop you interpreting it as ‘90% likely this post goes viral’?”

### Candidate terms to test later

- Current winning styles
- What is working now
- Supported association
- Consistent pattern — still observational
- Promising — needs more evidence
- Directional signal

The current product uses technical evidence-class language in places. The research should determine which concepts need plain-language translation while preserving statistical honesty.

## Topic 6 — Style versus communicative intent

### Unprimed examples

Describe two dimensions without naming them:

> “One label describes **what the writer is trying to accomplish in the text** — for example explain, challenge, announce, compare, invite discussion.”

> “Another label describes **how the message is presented** — for example concise analysis, narrative, checklist-like structure, contrarian framing, or other presentation patterns.”

Ask:

- “What would you call the first kind of label?”
- “What would you call the second?”
- “Would you use ‘purpose,’ ‘intent,’ ‘goal,’ ‘angle,’ ‘style,’ ‘format,’ or something else? What does each mean to you?”
- “What claim would feel too strong if the system only sees the text?”

After natural language, test candidate terms such as **communicative intent**, **author intent**, **presentation style**, **semantic style**, and **angle**.

Important semantic boundary: current external AI analysis can infer text-supported communicative purpose. It must not claim private motivation.

## Topic 7 — External evidence versus “what works for me”

### Unprimed scenario

> You have two pieces of evidence. One comes from a historical sample of comparable posts from other accounts. The other comes from repeated measured results on your own account. How would you name these two kinds of evidence so you would not confuse them later?

Follow-ups:

- “Which one would you trust more for understanding the market?”
- “Which one would you trust more for deciding what fits your account?”
- “Would you ever want them shown together? If so, how should their sources remain visible?”
- “If they disagree, what should the interface call out?”
- “Where would an explicit test you ran on your own work fit?”

### Candidate terms to test later

- external evidence
- market evidence
- current winning styles
- what works for you
- own-account evidence
- test evidence
- observed patterns

Do not ask which label is “best” until the participant has described the distinction accurately.

## Topic 8 — Tests and learned recommendations

### Unprimed scenario

> You deliberately compare two choices on real work, and you explicitly decide which item gets which option. The system never creates duplicate posts and does not randomize the choices. What would you call this activity?

Then:

> Later, the system sees enough qualified evidence to suggest a bounded change to future recommendations. The change does nothing until a person accepts it. What would you call that suggestion?

Follow-ups:

- “What does ‘experiment’ imply to you that ‘test’ does not?”
- “Would you expect randomization if the UI said experiment?”
- “What words make it clear there is no automatic winner?”
- “What does ‘learned rule’ sound like it can do?”
- “What would you want to see before accepting a recommendation based on past results?”

Candidate terms to test later:

- Test
- Experiment
- What we've learned
- Suggested change
- Strategy recommendation
- Accepted change
- Retire change

## Topic 9 — Future no-influence / suggestion / deliberate-apply strategy control

Do **not** introduce `Off / Suggest / Apply` first.

### Unprimed scenario

> The system has evidence about a writing approach that might fit the post you are about to create. There are three possible ways the product could behave:
>
> 1. do not let that evidence influence the Writer at all;
> 2. show you the advice, but do not use it unless you choose it;
> 3. you deliberately choose the approach and the Writer uses it when generating this draft.
>
> What would you call those three choices?

Follow-ups:

- “Are these settings for this draft, this session, or the whole account?”
- “Which choice would you expect to change generated wording?”
- “Which choice would you expect to publish or approve something?”
- “If the chosen strategy is later removed, what should happen?”
- “Where would you expect to make this choice: while reviewing evidence, while starting a draft, in settings, or somewhere else?”
- “How would you want to see what evidence supports the strategy?”

### Candidate labels to test only afterward

- Off / Suggest / Apply
- No guidance / Show suggestion / Use strategy
- Ignore / Recommend / Apply
- No influence / Advice only / Use for this draft

Ask the participant to predict exact behavior for each candidate set. `Apply` fails if it is interpreted as approval, publication, or account-wide autonomous behavior.

## Topic 10 — Qualified audience growth

### Unprimed scenario

> The account gained followers, but you care whether they are the kinds of technical people you actually want to reach. What would you call that measure or outcome?

Follow-ups:

- “What makes a follower relevant?”
- “Would you say audience quality, audience fit, qualified growth, relevant followers, or something else?”
- “What would make this classification feel too certain?”
- “How should the product talk about a follower first observed during a measurement window without claiming a specific post caused the follow?”

Candidate terms to test later:

- Audience quality
- Relevant followers
- Qualified audience growth
- Niche-aligned followers
- First-observed follower quality

## Topic 11 — Authority, relationships, opportunities, visibility, revenue

These stakeholder words are semantically overloaded. Elicit distinctions explicitly.

### Authority

- “If this account is becoming a trusted technical authority, what observable things would change?”
- “What would be evidence of authority versus simply more impressions?”

### Relationships

- “What makes an interaction a useful relationship outcome rather than just a reply?”
- “What words would you use for repeated useful interaction with the same person?”

### Opportunities

- “If the product says ‘new opportunities,’ what would you assume those are?”
- “How would you distinguish a conversation opportunity from a business opportunity?”

### Build visibility

- “What would ‘build visibility’ mean in practical terms?”
- “Would you expect it under content performance, audience, relationships, or business outcomes?”

### Revenue / business value

- “What would count as a directly observed business outcome?”
- “What linkage to a post or conversation would be enough to say ‘associated with’ versus ‘caused by’?”
- “If no business outcome is recorded, what should the product say instead of implying one?”

Record participant definitions before offering any product taxonomy.

## Topic 12 — Uncertainty and confidence

### Evidence prompt

> A result looks stronger than another, but the sample is small and other things happened during the same period. How should a product tell you what it knows and what it does not know?

Ask:

- “What does ‘confidence’ mean to you in this context?”
- “What does ‘attribution confidence’ sound like?”
- “Would ‘how isolated this result was’ mean something different?”
- “What does ‘directional’ mean to you?”
- “What does ‘repeated’ mean to you?”
- “How would you want a caveat shown without hiding the useful result?”
- “When would you open technical details?”

### Failure prompt

> The system is not sure whether a public action completed cleanly. What words would make you stop and verify instead of retrying immediately?

Capture language for uncertain transport separately from statistical uncertainty.

## Topic 13 — Advanced controls

### Unprimed scenario

> Most days you should not need to think about which AI runtime/provider/model the system uses. On a maintenance day, you need to change the model, connection, or audience definition. What would you call the place where those controls live?

Follow-ups:

- “What belongs under Settings?”
- “What belongs under Advanced?”
- “What does Diagnostics imply?”
- “Where would you expect raw evidence or model-usage detail?”
- “Would putting AI model controls inside a research screen make you think they are required for ordinary use?”

Candidate terms to test later:

- Advanced
- Settings
- Diagnostics
- AI Settings
- System details
- Technical details

The objective is a clean boundary: advanced operators can find precise controls, while ordinary operators do not need them to complete normal jobs.

## Realistic task prompts for moderated sessions

Use tasks rather than feature tours. Examples:

### Operator scenario A — morning decision

> You have twelve minutes before a call. Find the most important thing that requires your judgment. Explain what the system is recommending, what evidence you would inspect, and what has **not** happened yet.

### Operator scenario B — research-first opportunity

> This opportunity may be worthwhile, but the evidence is not sufficient to write confidently. Show what you would do next and what would convince you it is ready to become content.

### Operator scenario C — exact-text approval

> A draft contains a measurable performance claim. Get it as far as you safely can, but do not make anything public. Tell me at each step what the next action would authorize.

### Operator scenario D — delayed publication

> You approved a post earlier. Find out whether it is public, waiting for a planned time, blocked, or failed. Explain what could happen after you leave the product.

### Operator scenario E — reply consequence

> There is an active conversation with a draft reply. Review it and explain the last action you would take before the text becomes public.

### Learning scenario A — external versus own evidence

> Find a writing approach that appears strong among comparable accounts, then find whether your own account has evidence for the same approach. Explain the difference between the two sources.

### Learning scenario B — test

> Find a deliberate comparison that is still active. Explain how work gets assigned to the two choices and what the current evidence does or does not prove.

### Future strategy scenario

> Suppose a writing approach is supported by evidence and fits a draft you are about to generate. Show where you would expect to decide whether it should influence generation, and explain what that decision must **not** authorize.

### Stakeholder scenario A — “is this working?”

> You are not here to write a post. Determine whether the account is attracting a more relevant audience, whether useful conversations are happening, and what evidence exists about recent content performance.

### Stakeholder scenario B — business outcome boundary

> Determine whether the product can prove that recent growth produced a lead, signup, partnership, or revenue event. If it cannot, explain what evidence it does have instead.

### Advanced scenario

> Change where you would expect the exact AI provider/model for a role to be configured. Then return to the normal operator workflow and explain whether that technical setting should be visible there by default.

## Avoid leading language

Avoid questions like:

- “Do you like the Learn tab?”
- “Is `Apply` clear?”
- “Would you prefer Results?”
- “Do you understand the confidence interval?”
- “Is this a good recommendation?”
- “Does this feel safe?”

Prefer:

- “What would you expect to find under this label?”
- “What do you think this number means?”
- “What happens if you press this?”
- “What has already happened?”
- “What is still under your control?”
- “What evidence supports that conclusion?”
- “What would you call this in your own words?”

## Session capture template

Record observation before interpretation.

| Field | What to record |
|---|---|
| Participant role | Role being enacted for this task |
| Device | Desktop / phone-sized |
| Scenario | Prompt ID or exact prompt |
| Participant's term | Exact words used before product terminology |
| Participant definition | What they said the term means |
| Expected consequence | What they predicted would happen next |
| Actual current consequence | Repository/product behavior shown in session, if applicable |
| Evidence-source interpretation | External / own account / test / strategy / unclear |
| Uncertainty language | Exact caveat/confidence words used |
| Misunderstanding | Factual description without assigning motive |
| Moderator intervention | Exact prompt/help provided |
| Candidate term reaction | Paraphrase/behavior prediction after term shown |

Do not convert observations into percentages until the study design/sample supports that inference.

## Questions that still require real participants

This package intentionally leaves these unanswered:

1. What phrase do operators naturally use for “the work that needs my decision today”?
2. Does “recommendation” clearly remain advisory, and what word best describes the later human selection?
3. Which words most reliably separate readiness check, approval, scheduled/waiting, publishing, and published?
4. Do participants treat “review” as a system check, a human editorial read, or both?
5. Is “Current winning styles” understandable without implying causality or guaranteed virality?
6. What do users naturally call text-supported communicative intent versus presentation style?
7. What labels make external evidence and own-account evidence immediately distinguishable?
8. Do users naturally call explicit comparisons “tests,” “experiments,” or something else?
9. How do users describe an evidence-backed suggestion that has zero effect until accepted?
10. What three labels make the future no-influence / advice-only / deliberate-use writing strategy behavior predictable?
11. Do users expect the future strategy choice to live in Learn, in the draft workflow, or in both places for different purposes?
12. What does “qualified audience growth” mean in participant language, and which proxy measures are understandable without overclaiming?
13. Does “opportunity” primarily mean content opportunity, conversation opportunity, or business opportunity for each role?
14. How do stakeholders describe authority, relationship value, build visibility, and revenue outcomes without collapsing them into reach?
15. What wording communicates observational uncertainty and attribution limitations without making the evidence unusably technical?
16. Which technical controls do ordinary users expect to be hidden under Advanced/Settings, and which details do advanced operators need immediately?
17. Does `Learn` mean evidence/adaptation or tutorials/education to the target audience?
18. Are the same labels understandable on a phone-sized navigation treatment where explanatory subtext is limited?

Until real participant evidence answers these questions, candidate labels in planning documents remain hypotheses rather than validated product language.