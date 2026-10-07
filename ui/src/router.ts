import { useEffect, useState } from 'react'

export interface HashRoute {
  segments: string[]
  query: URLSearchParams
  full: string
}

function decodeSegment(segment: string): string {
  try { return decodeURIComponent(segment) } catch { return segment }
}

const leaveGuards = new Set<() => boolean>()
const routeListeners = new Set<() => void>()
function handleHashChange(event: HashChangeEvent) {
  if ([...leaveGuards].some((guard) => !guard())) {
    window.history.replaceState(null, '', event.oldURL)
    return
  }
  for (const listener of routeListeners) listener()
}

export function useUnsavedChanges(unsaved: boolean) {
  useEffect(() => {
    if (!unsaved) return
    const guard = () => window.confirm('Leave this editor? Unsaved changes or an unfinished request may be lost.')
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    leaveGuards.add(guard)
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      leaveGuards.delete(guard)
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [unsaved])
}

export function parseHash(hash: string): HashRoute {
  const raw = hash.replace(/^#\/?/, '')
  const [pathPart, queryPart] = raw.split('?')
  const segments = pathPart.split('/').filter(Boolean).map((segment) => decodeSegment(segment))
  return {
    segments,
    query: new URLSearchParams(queryPart || ''),
    full: raw,
  }
}

export function useHashRoute(): HashRoute {
  const [route, setRoute] = useState<HashRoute>(() => parseHash(window.location.hash))

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash))
    if (!routeListeners.size) window.addEventListener('hashchange', handleHashChange)
    routeListeners.add(handler)
    return () => {
      routeListeners.delete(handler)
      if (!routeListeners.size) window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  return route
}

export function navigate(path: string) {
  const target = path.startsWith('#') ? path : `#${path.startsWith('/') ? '' : '/'}${path}`
  if (window.location.hash === target) {
    for (const listener of routeListeners) listener()
    return
  }
  window.location.hash = target
}
