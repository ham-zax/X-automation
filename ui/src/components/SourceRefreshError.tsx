interface SourceRefreshErrorProps {
  message: string
  hasSnapshot: boolean
}

export function SourceRefreshError({ message, hasSnapshot }: SourceRefreshErrorProps) {
  // Preserve diagnostic text, but terminal escape sequences have no place in the UI.
  const diagnostic = message.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g'), '').trim()
  const summary = /ERR_INSUFFICIENT_RESOURCES/i.test(diagnostic)
    ? 'The source browser reported insufficient resources.'
    : /page crashed/i.test(diagnostic)
      ? 'The source browser crashed during refresh.'
    : /timeout|timed out/i.test(diagnostic)
      ? 'The source refresh timed out.'
      : 'The latest source refresh failed.'

  return (
    <div className="min-w-0 [overflow-wrap:anywhere]">
      <p>{summary}</p>
      <p className="mt-2 text-sm text-slate-500">{hasSnapshot
        ? 'The last saved snapshot is still available; it is not a fresh result.'
        : 'No saved snapshot is available for this source.'} Retry with the source refresh control.</p>
      <details className="mt-2">
        <summary>Refresh error details</summary>
        <pre className="source-refresh-log">{diagnostic}</pre>
      </details>
    </div>
  )
}
