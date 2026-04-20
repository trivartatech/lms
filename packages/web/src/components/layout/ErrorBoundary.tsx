import { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  /** Optional fallback renderer. Defaults to a generic message card. */
  fallback?: (err: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/**
 * Route-level error boundary. Catches render errors in the subtree and shows a
 * recovery UI with a Try Again button that resets the boundary.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="max-w-md rounded-md border border-red-200 bg-red-50 p-6 text-center shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-red-900">Something broke on this page</h2>
          <p className="mb-4 text-sm text-red-800">{error.message || 'Unexpected error'}</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={this.reset}>Try again</Button>
            <Button onClick={() => window.location.reload()}>Reload page</Button>
          </div>
        </div>
      </div>
    )
  }
}
