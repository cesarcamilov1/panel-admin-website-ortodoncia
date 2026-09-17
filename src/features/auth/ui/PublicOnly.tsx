import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../application/authContext'
import { SessionLoading } from './SessionLoading'

export function PublicOnly() {
  const { state } = useAuth()

  if (state.status === 'loading') return <SessionLoading />
  if (state.status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
