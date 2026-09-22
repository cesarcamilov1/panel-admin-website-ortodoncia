/* oxlint-disable react/only-export-components, react/refs -- retained snapshots and action guards must survive async refreshes. */
import { type FormEvent, type ReactNode, useRef, useState } from 'react'
import { Button } from '../../../../shared/ui/atoms/Button'
import { FormAlert } from '../../../../shared/ui/molecules/FormAlert'
import { clinicalErrorMessage } from '../../domain/clinical'
import styles from '../ClinicalRecordTabs.module.css'

export type Loadable<T> = {
  state: { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: unknown }
  reload: () => Promise<void>
}

/** Keeps previously loaded content mounted during a refresh, so local mutation feedback is not discarded. */
export function isResourceReady<T>(resource: Loadable<T>): boolean {
  return resource.state.status === 'ready'
}

export function LoadingError<T>({ resource, children }: { resource: Loadable<T>; children: (data: T, reload: () => Promise<void>, ready: boolean) => ReactNode }) {
  const latest = useRef<T | null>(null)
  if (resource.state.status === 'ready') latest.current = resource.state.data
  if (resource.state.status === 'loading' && latest.current === null) return <p role="status">Cargando información clínica…</p>
  if (resource.state.status === 'error' && latest.current === null) return <FormAlert tone="error">{clinicalErrorMessage(resource.state.error)} <Button variant="secondary" size="sm" onClick={() => void resource.reload()}>Reintentar</Button></FormAlert>
  const data = latest.current as T
  return <>
    {resource.state.status === 'error' ? <FormAlert tone="error">{clinicalErrorMessage(resource.state.error)} <Button variant="secondary" size="sm" onClick={() => void resource.reload()}>Reintentar</Button></FormAlert> : null}
    {children(data, resource.reload, isResourceReady(resource))}
  </>
}

export function List<T extends { id: string }>({ items, empty, render }: { items: T[]; empty: string; render: (item: T) => ReactNode }) {
  return items.length ? <div className={styles.list}>{items.map((item) => <div className={styles.listItem} key={item.id}>{render(item)}</div>)}</div> : <p className={styles.empty}>{empty}</p>
}

export function InlineForm({ title, children, onCancel, onSave, disabled = false }: { title: string; children: ReactNode; onCancel: () => void; onSave: () => Promise<void>; disabled?: boolean }) {
  const inFlight = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (disabled || inFlight.current || !event.currentTarget.reportValidity()) return
    inFlight.current = true
    setSaving(true)
    setError(null)
    try { await onSave() } catch (cause) { setError(clinicalErrorMessage(cause)) } finally { inFlight.current = false; setSaving(false) }
  }
  return <form className={styles.form} onSubmit={(event) => void submit(event)}><h5>{title}</h5>{error ? <FormAlert tone="error">{error}</FormAlert> : null}{children}<div className={styles.actions}><Button type="button" variant="secondary" size="sm" disabled={saving} onClick={onCancel}>Cancelar</Button><Button type="submit" size="sm" disabled={saving || disabled}>{saving ? 'Guardando…' : 'Guardar'}</Button></div></form>
}

export function useActionGuard() {
  const inFlight = useRef(false)
  const [pending, setPending] = useState(false)
  const run = async (action: () => Promise<void>, enabled = true) => {
    if (!enabled || inFlight.current) return
    inFlight.current = true
    setPending(true)
    try { await action() } finally { inFlight.current = false; setPending(false) }
  }
  return { pending, run }
}
