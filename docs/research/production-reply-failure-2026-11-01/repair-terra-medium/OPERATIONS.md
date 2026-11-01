# Operational checkpoint, 1 November 2026

The operator service is failed. Its timer is inactive. No new Growth Run starts.
Terra6.1 medium authors through writer/reply_writer profile17. Sol6.1 high reviews
through content_review profile18. DeepSeek remains the executor. No fallback binds.
Before integration the dashboard process loads older code and rejects the new
content_review filter. After commit0a9f2bd the dashboard restarts. The same endpoint
returns HTTP200 with a content_review receipt. The older failure is process drift.

The attached launcher now uses the existing persistent failure backoff. The exact
“Free usage limit reached” message classifies as rate_limited. A disposable failed
child exercise proves one allocation, one cleanup, and no child or tab allocation
on the next deferred invocation. Existing lifecycle/runner/lease tests pass50/50.
The first run failed one log-position assertion after deadline logging moved ahead
of the owned-target line. Moving deadline logging to actual child launch fixes it.
The launcher prints actual start/deadline/elapsed data. The historical alleged
13-minute early finish is not causally reconstructed and remains unproven.
Backoff uses existing 2-to-30-minute delays. It is not a provider quota reset.
No service restart policy, grant, AUTO_POST or uncertain-send rule changes.

operational-backlog.json records supported bridge readback:
- 74 measurement windows are due. operator-status exposes ten identities.
- 20 closed-unresolved sends retain their exact IDs, targets and recorded times.
- No active claimed/send-started/investigating attempt is reported.
- No additional measurement or historical resolution is claimed.

The ten displayed due examples are historical windows from August. A current
view count cannot reconstruct the view count at those historical deadlines.
The other64 due identities are outside this bridge preview and remain uninspected.
The report therefore provides an aggregate disposition, not a full74-row audit.
All74 remain due/uncaptured here. All20 closed-unresolved outcomes remain unknown.
A later authenticated collector can add only observations it actually sees and
must preserve their real capture time. This checkpoint neither resends old work
nor invents recovered measurements. The later bounded browser check confirms the authenticated @ham_zax profile.
Historical measurement windows remain uncaptured. No recovery is claimed.
