import { Button } from '../../../shared/ui/atoms/Button'
import type { ApiError } from '../../../shared/api/problem'
import { authErrorMessage } from '../domain/auth'

export function SessionLoading() {
  return <p role="status">Cargando tu sesión…</p>
}

interface SessionUnavailableProps {
  error: ApiError
  onRetry: () => void
}

export function SessionUnavailable({ error, onRetry }: SessionUnavailableProps) {
  return (
    <div role="alert">
      <p>No pudimos comprobar tu sesión.</p>
      <p>{authErrorMessage(error, 'session')}</p>
      <Button onClick={onRetry}>Reintentar</Button>
    </div>
  )
}
