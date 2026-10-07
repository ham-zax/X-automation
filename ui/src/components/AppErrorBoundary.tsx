import { Component, type ReactNode } from 'react'

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="mx-auto max-w-xl p-8" role="alert">
          <h1 className="text-xl font-semibold">The dashboard could not display this view.</h1>
          <p className="mt-3">Reload to recover. Unsaved changes may be lost; a pending action may have completed, so inspect its state before trying again.</p>
          <button className="action-button mt-4" onClick={() => window.location.reload()}>Reload dashboard</button>
        </main>
      )
    }
    return this.props.children
  }
}
