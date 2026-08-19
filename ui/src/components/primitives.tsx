interface LoadingProps {
  message?: string
}

export function Loading({ message = 'Loading...' }: LoadingProps) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-slate-900 border-r-transparent"></div>
        <p className="mt-4 text-sm text-slate-600">{message}</p>
      </div>
    </div>
  )
}

interface ErrorProps {
  message: string
  onRetry?: () => void
}

export function Error({ message, onRetry }: ErrorProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <h3 className="text-sm font-medium text-red-900">Something went wrong</h3>
      <p className="mt-2 text-sm text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Try again
        </button>
      )}
    </div>
  )
}

interface EmptyProps {
  title: string
  message?: string
}

export function Empty({ title, message }: EmptyProps) {
  return (
    <div className="text-center py-12">
      <h3 className="text-sm font-medium text-slate-900">{title}</h3>
      {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
    </div>
  )
}
