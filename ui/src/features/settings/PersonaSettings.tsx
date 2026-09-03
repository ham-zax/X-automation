import { useState } from 'react'
import { usePersona, useRecordPersonaStance } from '../../api/client'
import { Badge, Empty, Error, Loading, SectionHeader } from '../../components/primitives'

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function humanize(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function PersonaSettings() {
  const persona = usePersona('engagement')
  const recordStance = useRecordPersonaStance()
  const [subject, setSubject] = useState('')
  const [position, setPosition] = useState('')
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high'>('medium')
  const [status, setStatus] = useState<'exploring' | 'provisional' | 'held' | 'revised' | 'abandoned'>('provisional')
  const [basis, setBasis] = useState('')
  const [sourceRef, setSourceRef] = useState('')

  if (persona.isLoading) return <Loading message="Loading persona…" />
  if (persona.error) return <Error message={persona.error.message} onRetry={() => void persona.refetch()} />
  if (!persona.data) return <Empty title="Persona model unavailable" message="The active versioned Hamza model could not be read." />

  const { model, currentStances } = persona.data
  const identity = text(model.identity.statement) || text(model.identity.label) || 'Experimental Hamza model'

  const submit = () => {
    if (!subject.trim() || !position.trim() || !basis.trim()) return
    recordStance.mutate({
      subject: subject.trim(),
      position: position.trim(),
      confidence,
      status,
      basis: basis.trim(),
      sourceRef: sourceRef.trim(),
      confirmRecord: true,
    }, {
      onSuccess: () => {
        setSubject('')
        setPosition('')
        setBasis('')
        setSourceRef('')
        setConfidence('medium')
        setStatus('provisional')
      },
    })
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Persona & stances"
        note="Inspect the active model and append grounded stance changes. Generated posts do not silently rewrite these beliefs."
        right={<a href="#/settings" className="text-sm font-medium text-sky-700">Back to Settings</a>}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900">{model.version}</h3>
          <Badge tone="info">{humanize(model.status || 'experimental')}</Badge>
        </div>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-700">{identity}</p>
        <p className="mt-3 text-xs text-slate-500">Behavior is selected before writing. Public affect may be known, inferred, or strategic; factual and implied biography still require evidence.</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-900">Record a stance event</h3>
        <p className="mt-1 text-sm text-slate-600">Use append-only events for a tool, practice, product, or belief. Later revisions preserve the earlier position rather than rewriting history.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Subject
            <input value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Turborepo remote caching" />
          </label>
          <label className="text-sm font-medium text-slate-700">Position
            <input value={position} onChange={(event) => setPosition(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="What Hamza currently thinks" />
          </label>
          <label className="text-sm font-medium text-slate-700">Confidence
            <select value={confidence} onChange={(event) => setConfidence(event.target.value as typeof confidence)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Status
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {['exploring', 'provisional', 'held', 'revised', 'abandoned'].map((value) => <option key={value} value={value}>{humanize(value)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Basis
            <textarea value={basis} onChange={(event) => setBasis(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Owner statement, verified project result, explicit modelling choice, or other basis" />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Source reference <span className="font-normal text-slate-400">(optional)</span>
            <input value={sourceRef} onChange={(event) => setSourceRef(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Repository artifact, conversation, URL, or evidence ID" />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={submit} disabled={!subject.trim() || !position.trim() || !basis.trim() || recordStance.isPending} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {recordStance.isPending ? 'Recording…' : 'Record stance'}
          </button>
          {recordStance.isSuccess && <span className="text-sm font-medium text-emerald-700">Stance appended.</span>}
          {recordStance.error && <span className="text-sm text-red-700">{recordStance.error.message}</span>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-900">Current stances</h3>
        {currentStances.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No grounded stance events have been recorded yet. The alpha model therefore exposes candidate beliefs and known unknowns rather than pretending the calibration is complete.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {currentStances.map((stance) => (
              <div key={stance.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-slate-900">{stance.subject}</div>
                  <Badge tone={stance.status === 'held' ? 'success' : stance.status === 'abandoned' ? 'danger' : 'neutral'}>{humanize(stance.status)}</Badge>
                  <span className="text-xs text-slate-400">{stance.confidence} confidence</span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{stance.position}</p>
                <p className="mt-1 text-xs text-slate-500">Basis: {stance.basis}{stance.sourceRef ? ` · ${stance.sourceRef}` : ''}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-slate-900">Candidate beliefs</h3>
          <div className="mt-4 space-y-3">
            {model.candidateBeliefs.map((belief, index) => (
              <div key={belief.id || index} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex flex-wrap gap-2"><Badge tone="neutral">{humanize(belief.status || 'candidate')}</Badge><span className="text-xs text-slate-400">{belief.confidence || 'unknown'} confidence</span></div>
                <p className="mt-2 text-sm text-slate-800">{belief.statement || belief.id}</p>
                {belief.basis && <p className="mt-1 text-xs text-slate-500">{belief.basis}</p>}
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-slate-900">Known unknowns</h3>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
            {model.knownUnknowns.map((unknown) => <li key={unknown} className="rounded-lg bg-amber-50 px-3 py-2">{unknown}</li>)}
          </ul>
        </section>
      </div>
    </div>
  )
}
