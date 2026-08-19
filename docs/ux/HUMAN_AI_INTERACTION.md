# Human-AI Interaction Contract

## Roles

AI may:
- research;
- rank;
- recommend;
- draft;
- regenerate;
- explain;
- schedule-plan;
- measure;
- summarize evidence.

Human approval remains required where the current backend requires it.
Approval is NOT publication.

## Separation of States

Keep these states visibly separate:
- Needs review
- Approved — waiting
- Publishing
- Published

For replies:
- AI generation is separate from approval.
- Approval is separate from send.
- Send must not appear successful until the backend/X confirms it.

## Unfollow Rules
- One account per explicit user action.
- No bulk unfollow.
- No confirmation popup is required.
- After click show a pending state.
- Do not remove/decrement the account until XActions and local reconciliation confirm success.

## Tests (Experiments)
- Assignment remains explicit.
- Do NOT imply randomization.
- Only Active tests accept assignments.
- Preserve current lifecycle/integrity rules.

## Learned Recommendations
- suggested != accepted;
- accepted != hard constraint;
- show what changes before acceptance;
- require explicit user acceptance.

## Non-Negotiable Boundaries

Do not introduce:
- automatic unsolicited reply sending;
- mass follow/unfollow;
- bulk unfollow;
- fake-human timing/evasion;
- hidden reputation scores;
- fake progress;
- optimistic success for consequential actions.
