import { useCallback, useEffect, useRef, useState } from 'react'

export type ResourceState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: unknown }

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/**
 * Fetches one resource with cancellation and a monotonically increasing request identity.
 * The latest completed request wins even when a transport ignores abort signals.
 */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, dependencies: readonly unknown[]) {
  const [state, setState] = useState<ResourceState<T>>({ status: 'loading' })
  const requestId = useRef(0)
  const activeController = useRef<AbortController | null>(null)

  const reload = useCallback(async () => {
    activeController.current?.abort()
    const id = ++requestId.current
    const controller = new AbortController()
    activeController.current = controller
    setState({ status: 'loading' })
    try {
      const data = await load(controller.signal)
      if (id === requestId.current) setState({ status: 'ready', data })
    } catch (error) {
      if (id === requestId.current && !isAbortError(error)) setState({ status: 'error', error })
    }
  // The explicit dependency list keeps API factories stable at their caller boundary.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)

  // The caller owns the deliberately explicit dependency list.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    activeController.current?.abort()
    const controller = new AbortController()
    activeController.current = controller
    const id = ++requestId.current
    // Synchronizes UI state with a new external resource request.
    // oxlint-disable-next-line react/set-state-in-effect
    setState({ status: 'loading' })
    void load(controller.signal)
      .then((data) => {
        if (id === requestId.current) setState({ status: 'ready', data })
      })
      .catch((error: unknown) => {
        if (id === requestId.current && !isAbortError(error)) setState({ status: 'error', error })
      })
    return () => {
      controller.abort()
      if (activeController.current === controller) activeController.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)

  return { state, reload }
}
