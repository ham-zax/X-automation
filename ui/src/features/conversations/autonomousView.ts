import type { SemanticTone } from '../../components/primitives'

export function autonomousLabel(decision: string): string {
  const labels: Record<string, string> = {
    sent: 'Sent · recorded',
    eligible_live: 'Ready for live execution · not sent',
    sending: 'Execution in progress · not confirmed',
    dry_run_send: 'Dry run · would send',
    review: 'Needs human review',
    dry_run_review: 'Dry run · would review',
    reconciliation_required: 'Outcome uncertain · reconcile',
    send_failed: 'Send failed',
    skipped: 'Skipped',
    dry_run_skipped: 'Dry run · skipped',
  }
  return labels[decision] || decision.replaceAll('_', ' ')
}

export function autonomousTone(decision: string): SemanticTone {
  if (decision === 'sent') return 'success'
  if (decision === 'send_failed') return 'danger'
  if (decision === 'review' || decision === 'reconciliation_required') return 'warning'
  if (decision === 'eligible_live' || decision === 'sending') return 'info'
  return 'neutral'
}
