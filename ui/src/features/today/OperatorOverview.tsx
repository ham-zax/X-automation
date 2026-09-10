import { useState } from 'react'
import { useAutonomousReplies, useGrowthOperator, usePersona } from '../../api/client'
import { Badge, formatDateTime } from '../../components/primitives'

const SESSION_BRIEF = `Use Growth OS in /home/hamza/repo/x_test for @ham_zax. Read AGENTS.md, docs/PERSISTENT_GROWTH_OPERATOR_PROMPT.md, and docs/GROWTH_RUN_PROTOCOL.md when present. Run operator-readiness through agent_bridge.js, then begin or resume the durable Growth Run instead of rebuilding account context from chat history.

Follow my current request: it may be a single post, ongoing engagement, a duration, or a ceiling on work. Keep the active versioned Hamza persona, Growth Focus, exact-content approval, grants, account-health constraints, publication-attempt identity, and browser claim/reconciliation contracts authoritative. Ceilings are limits, never targets; do not force low-value engagement.

Choose purposeful opportunities, sustain worthwhile conversations, verify material claims, execute each claimed public action at most once, structurally reconcile it, and improve from observed evidence. Relevant follower growth and useful relationships are the goal; output count alone is not success. Report completed, skipped, blocked, and uncertain work distinctly. Permission, an attached reasoning agent, browser capability, source freshness, reconciliation state, and scheduler state are separate facts.`

export function OperatorOverview() {
  const operator = useGrowthOperator()
  const persona = usePersona()
  const replies = useAutonomousReplies()
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const grant = operator.data?.grant
  const model = persona.data?.model
  const replyGrant = replies.data?.grant
  const readiness = operator.data?.readiness
  const browserReady = Boolean(readiness?.transports.browserAgent.runtimeAttached
    && readiness.transports.browserAgent.browserMutation
    && readiness.transports.browserAgent.xAuthenticated
    && readiness.transports.browserAgent.accountVerified)
  const forYouReady = Boolean(readiness?.sensors.xForYou.fresh && readiness.sensors.xForYou.authenticatedAccountVerified)
  const schedulerReady = Boolean(readiness?.scheduler.growthAgent.configured && readiness.scheduler.growthAgent.enabled)

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
      {readiness && (
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Growth Operator readiness chain">
          {[
            { label: 'Permission', ok: readiness.permission.live, value: readiness.permission.live ? 'Live' : readiness.permission.state },
            { label: 'Agent', ok: readiness.reasoningAgent.attached, value: readiness.reasoningAgent.attached ? 'Attached' : 'Detached' },
            { label: 'Browser', ok: browserReady, value: browserReady ? 'Ready' : 'Not ready' },
            { label: 'For You', ok: forYouReady, value: forYouReady ? `${readiness.sensors.xForYou.count} fresh` : 'Refresh' },
            { label: 'Reconcile', ok: readiness.reconciliation.activeCount === 0, value: readiness.reconciliation.activeCount === 0 ? 'Clear' : `${readiness.reconciliation.activeCount} active` },
            { label: 'Scheduler', ok: schedulerReady, value: schedulerReady ? 'Active' : 'Off' },
          ].map((item, index) => (
            <div key={item.label} className="relative rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
              {index < 5 && <span aria-hidden="true" className="absolute -right-2 top-1/2 hidden h-px w-2 bg-slate-300 xl:block" />}
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</span>
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{item.value}</div>
            </div>
          ))}
        </div>
      )}
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
        <p><strong>Continue in another agent session.</strong> Growth Runs now carry durable orchestration state in addition to persona, queue, relationship history, attempts, and results. A scheduled runtime may attach independently; this page reports its readiness but does not impersonate one.</p>
        <button type="button" className="action-button" onClick={() => void copyBrief()}>Copy session brief</button>
      </div>
      <div role="status" aria-live="polite" className="mt-2 text-sm text-slate-600">{copyState === 'copied' ? 'Session brief copied. Add your objective, duration, or work ceilings in the agent session.' : copyState === 'manual' ? 'Clipboard access is unavailable. Select and copy the brief below.' : ''}</div>
      {copyState === 'manual' && <textarea aria-label="Agent session brief" readOnly value={SESSION_BRIEF} rows={8} className="mt-3 w-full border p-3 text-sm" onFocus={(event) => event.target.select()} />}
    </section>
  )
}
