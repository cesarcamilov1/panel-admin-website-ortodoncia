import { createContext, useContext } from 'react'

export interface PanelActions {
  openNewAppointment: () => void
  notify: (message: string) => void
}

export const PanelActionsContext = createContext<PanelActions | null>(null)

export function usePanelActions(): PanelActions {
  const actions = useContext(PanelActionsContext)
  if (!actions) throw new Error('usePanelActions must be used inside PanelShell')
  return actions
}
