import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../application/authContext'
import { SessionLoading, SessionUnavailable } from './SessionLoading'

export function RequireAuth() {
  const { state, refresh } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') return <SessionLoading />
  if (state.status === 'unavailable') {
    return <SessionUnavailable error={state.error} onRetry={refresh} />
  }
  if (state.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
