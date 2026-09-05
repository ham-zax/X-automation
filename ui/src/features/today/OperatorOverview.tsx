import { useState } from 'react'
import { useAutonomousReplies, useGrowthOperator, usePersona } from '../../api/client'
import { Badge, formatDateTime } from '../../components/primitives'

const SESSION_BRIEF = `Use Growth OS in /home/hamza/repo/x_test for @ham_zax. Read AGENTS.md and docs/PERSISTENT_GROWTH_OPERATOR_PROMPT.md, then run operator-status through agent_bridge.js. Resume from durable state rather than starting the account history again.

Follow my current request: it may be a single post, ongoing engagement, a duration, or action-count bounds. Keep the active versioned Hamza persona, Growth Focus, exact-content approval, grants, account-health constraints, and browser claim/reconciliation contracts authoritative. Do not treat a count as permission to force low-value engagement or use an unsupported route.

Choose purposeful opportunities, sustain worthwhile conversations, verify public actions, record outcomes, and improve from observed evidence. Relevant follower growth is the goal; output count alone is not success. Report completed, skipped, blocked, and uncertain work distinctly. An active delegation is not proof that a browser/model session is running.`

export function OperatorOverview() {
  const operator = useGrowthOperator()
  const persona = usePersona()
  const replies = useAutonomousReplies()
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const grant = operator.data?.grant
  const model = persona.data?.model
  const replyGrant = replies.data?.grant

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(SESSION_BRIEF)
      setCopyState('copied')
    } catch {
      setCopyState('manual')
    }
  }

  return (
    <section className="operator-surface operator-overview" aria-labelledby="operator-overview-title">
      <div className="operator-overview-heading">
        <div>
          <h3 id="operator-overview-title">Your agent's operating context</h3>
          <p>Give the agent an objective. Inspect its authority and voice here, then judge the work by relevant followers and conversations that continue.</p>
        </div>
        <a href="#/settings/growth-operator" className="action-button">Manage delegation</a>
      </div>
      <div className="operator-status-grid">
        <div className="operator-status-cell">
          <h4>Permission to act</h4>
          {operator.error ? <Badge tone="warning">Status unavailable</Badge> : grant ? (
            <div className="flex flex-wrap gap-2">
              <Badge tone={grant.state === 'running' ? 'info' : 'neutral'}>{grant.state}</Badge>
              <Badge>{grant.mode === 'live' ? 'Live delegation' : 'Dry run'}</Badge>
            </div>
          ) : <span className="text-sm text-slate-500">Loading delegation…</span>}
          <p>{operator.error ? operator.error.message : grant ? `Revision ${grant.revision}. Permission is separate from an active agent session and from publication readiness.` : 'No readiness is assumed until the saved delegation is available.'}</p>
          {grant?.updatedAt && <p>Changed {formatDateTime(grant.updatedAt)}</p>}
          <a href="#/settings/growth-operator">Inspect or pause delegation →</a>
        </div>
        <div className="operator-status-cell">
          <h4>Hamza's persona</h4>
          {persona.error ? <Badge tone="warning">Model unavailable</Badge> : model ? (
            <div className="flex flex-wrap gap-2"><Badge tone="primary">{model.version}</Badge><Badge>{model.status}</Badge></div>
          ) : <span className="text-sm text-slate-500">Loading persona…</span>}
          <p>{persona.error ? persona.error.message : 'The saved model guides purpose, voice, and social behavior. Each authored action still needs its own content and provenance checks.'}</p>
          <a href="#/settings/persona">Inspect persona & evidence →</a>
        </div>
        <div className="operator-status-cell">
          <h4>Autonomous replies</h4>
          {replies.error ? <Badge tone="warning">Reply status unavailable</Badge> : replyGrant ? (
            <div className="flex flex-wrap gap-2"><Badge tone={replyGrant.mode === 'live' && replyGrant.state === 'running' ? 'info' : 'neutral'}>{replyGrant.state}</Badge><Badge>{replyGrant.mode === 'live' ? 'Live replies' : 'Dry run · not sending'}</Badge></div>
          ) : <span className="text-sm text-slate-500">Loading reply authority…</span>}
          <p>{replies.error ? replies.error.message : replyGrant ? `${replyGrant.budgetUsed} budget units used · ${replyGrant.remainingBudget == null ? 'no fixed count limit' : `${replyGrant.remainingBudget} remaining`}. This is a work bound, not a growth result.` : 'Reply authority is checked independently of main-feed delegation.'}</p>
          <a href="#/settings/autonomous-replies">Inspect reply scope & budget →</a>
        </div>
      </div>
      <div className="operator-handoff">
        <p><strong>Continue in another agent session.</strong> The repository carries persona, queue, relationship history, and results. Browser execution still needs an active agent; this page does not launch one.</p>
        <button type="button" className="action-button" onClick={() => void copyBrief()}>Copy session brief</button>
      </div>
      <div role="status" aria-live="polite" className="mt-2 text-sm text-slate-600">{copyState === 'copied' ? 'Session brief copied. Add your objective, duration, or action-count bounds in the agent session.' : copyState === 'manual' ? 'Clipboard access is unavailable. Select and copy the brief below.' : ''}</div>
      {copyState === 'manual' && <textarea aria-label="Agent session brief" readOnly value={SESSION_BRIEF} rows={8} className="mt-3 w-full border p-3 text-sm" onFocus={(event) => event.target.select()} />}
    </section>
  )
}
