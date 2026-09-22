import { Component, type ErrorInfo, type ReactNode } from 'react'

interface RouteBoundaryProps {
  children: ReactNode
}

interface RouteBoundaryState {
  error: Error | null
}

/** Contains a failed route chunk without disturbing the authenticated application shell. */
export class RouteBoundary extends Component<RouteBoundaryProps, RouteBoundaryState> {
  state: RouteBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RouteBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unable to load route content.', error, info)
  }

  private reloadPage = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <section role="alert" aria-live="assertive">
        <h1>No pudimos cargar esta sección.</h1>
        <p>Recargá la página para intentar cargarla nuevamente.</p>
        <p>Las acciones pendientes no se reenviarán automáticamente.</p>
        <button type="button" onClick={this.reloadPage}>Recargar página</button>
      </section>
    )
  }
}
