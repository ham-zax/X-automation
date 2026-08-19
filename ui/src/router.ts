import { useEffect, useState } from 'react'

export interface HashRoute {
  segments: string[]
  query: URLSearchParams
  full: string
}

function parseHash(hash: string): HashRoute {
  const raw = hash.replace(/^#\/?/, '')
  const [pathPart, queryPart] = raw.split('?')
  const segments = pathPart.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment))
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
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  return route
}

export function navigate(path: string) {
  const target = path.startsWith('#') ? path : `#${path.startsWith('/') ? '' : '/'}${path}`
  if (window.location.hash === target) {
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    return
  }
  window.location.hash = target
}
