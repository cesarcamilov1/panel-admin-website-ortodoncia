/* oxlint-disable react/set-state-in-effect -- authoritative fiscal-resource identity must reset the non-persistent form draft. */
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useResource } from '../../../shared/api/useResource'
import { Button } from '../../../shared/ui/atoms/Button'
import { TextField } from '../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import type { FiscalApi } from '../application/fiscalApi'
import { EMPTY_FISCAL_DRAFT, fiscalErrorMessage, toFiscalDraft, validateFiscalDraft, type FiscalDraft, type FiscalDraftErrors } from '../domain/fiscal'
import styles from '../../patient-record/ui/ClinicalRecordTabs.module.css'

export function FiscalDataPanel({ api, patientId, canManage }: { api: FiscalApi; patientId: string; canManage: boolean }) {
  const resource = useResource((signal) => api.get(patientId, signal), [api, patientId])
  const [draft, setDraft] = useState<FiscalDraft>(EMPTY_FISCAL_DRAFT)
  const [errors, setErrors] = useState<FiscalDraftErrors>({})
  const [actionError, setActionError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const inFlight = useRef(false)

  useEffect(() => {
    if (resource.state.status === 'ready') {
      setDraft(toFiscalDraft(resource.state.data))
      setErrors({})
    }
  }, [resource.state])

  const update = (field: keyof FiscalDraft, value: string) => setDraft((current) => ({ ...current, [field]: value }))
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!canManage || inFlight.current || resource.state.status !== 'ready') return
    const nextErrors = validateFiscalDraft(draft)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    inFlight.current = true
    setSaving(true)
    setActionError(null)
    try {
      await api.put(patientId, draft, resource.state.data?.version)
      await resource.reload()
    } catch (error) {
      setActionError(fiscalErrorMessage(error, 'write'))
      void resource.reload()
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!canManage || inFlight.current || resource.state.status !== 'ready' || !resource.state.data) return
    inFlight.current = true
    setSaving(true)
    setActionError(null)
    try {
      await api.delete(patientId, resource.state.data.version)
      setConfirmingDelete(false)
      await resource.reload()
    } catch (error) {
      setActionError(fiscalErrorMessage(error, 'delete'))
      void resource.reload()
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  if (resource.state.status === 'loading') return <p role="status">Cargando datos fiscales…</p>
  if (resource.state.status === 'error') return <FormAlert tone="error">{fiscalErrorMessage(resource.state.error)} <Button size="sm" variant="secondary" onClick={() => void resource.reload()}>Reintentar</Button></FormAlert>

  const profile = resource.state.data
  return <section className={styles.stack} aria-label="Datos fiscales">
    <div className={styles.heading}><div><h3>Datos fiscales</h3><p>La información fiscal permanece en el servidor; este dispositivo no la conserva.</p></div></div>
    {!profile ? <p className={styles.empty}>No hay datos fiscales registrados.</p> : <p>Versión fiscal actual: {profile.version}</p>}
    {actionError ? <FormAlert tone="error">{actionError}</FormAlert> : null}
    <form className={styles.form} onSubmit={(event) => void save(event)}>
      <TextField label="RFC" required value={draft.rfc} disabled={!canManage || saving} error={errors.rfc} onChange={(event) => update('rfc', event.target.value)} />
      <TextField label="Razón social" required value={draft.legalName} disabled={!canManage || saving} error={errors.legalName} onChange={(event) => update('legalName', event.target.value)} />
      <TextField label="Código postal fiscal" required value={draft.postalCode} disabled={!canManage || saving} error={errors.postalCode} onChange={(event) => update('postalCode', event.target.value)} />
      <TextField label="Régimen fiscal" required value={draft.taxRegimeCode} disabled={!canManage || saving} error={errors.taxRegimeCode} onChange={(event) => update('taxRegimeCode', event.target.value)} />
      <TextField label="Uso CFDI predeterminado" required value={draft.cfdiUseCode} disabled={!canManage || saving} error={errors.cfdiUseCode} onChange={(event) => update('cfdiUseCode', event.target.value)} />
      <TextField label="Correo de facturación" type="email" value={draft.billingEmail} disabled={!canManage || saving} error={errors.billingEmail} onChange={(event) => update('billingEmail', event.target.value)} />
      {canManage ? <div className={styles.actions}><Button type="submit" size="sm" disabled={saving}>{saving ? 'Guardando…' : 'Guardar datos fiscales'}</Button>{profile ? <Button type="button" size="sm" variant="danger" disabled={saving} onClick={() => setConfirmingDelete(true)}>Eliminar datos fiscales</Button> : null}</div> : <p className={styles.subtle}>Tu rol no tiene permiso para actualizar estos datos.</p>}
    </form>
    {confirmingDelete ? <section className={styles.confirm} role="alertdialog" aria-label="Confirmar eliminación fiscal"><p>¿Confirmás eliminar los datos fiscales actuales? Los comprobantes ya emitidos conservan sus datos históricos.</p><div className={styles.actions}><Button size="sm" variant="secondary" disabled={saving} onClick={() => setConfirmingDelete(false)}>Cancelar</Button><Button size="sm" variant="danger" disabled={saving} onClick={() => void remove()}>Confirmar eliminación</Button></div></section> : null}
  </section>
}
