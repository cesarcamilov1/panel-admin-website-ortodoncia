import { useRef, useState } from 'react'
import { Button } from '../../../shared/ui/atoms/Button'
import { isApiError } from '../../../shared/api/problem'
import { Card } from '../../../shared/ui/molecules/Card'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import type { CommunicationsApi, TemplateDto } from '../application/communicationsApi'
import { CHANNELS, EMPTY_TEMPLATE_DRAFT, communicationErrorMessage, validateTemplateBody, type TemplateDraft } from '../domain/communications'

interface TemplateAttempt {
  operation: 'create' | 'update'
  id?: string
  code?: string
  channel?: TemplateDraft['channel']
  locale?: string
  providerTemplate?: string | null
  bodyTemplate: string
  isActive: boolean
  expectedVersion?: number
  idempotencyKey: string
}

interface TemplatesPanelProps {
  api: CommunicationsApi
  templates: TemplateDto[]
  owner: boolean
  refreshTemplates: () => Promise<TemplateDto[]>
  canLoadMore: boolean
  loadingMore: boolean
  error: string | null
  onLoadMore: () => void
}

function key(): string {
  return crypto.randomUUID()
}

function draftFrom(template: TemplateDto): TemplateDraft {
  return {
    code: template.code,
    channel: template.channel,
    locale: template.locale,
    providerTemplate: template.provider_template ?? '',
    bodyTemplate: template.body_template,
    isActive: template.is_active,
  }
}

function isTemplateAttempt(value: TemplateAttempt | null): value is TemplateAttempt {
  return value !== null
}

export function TemplatesPanel({ api, templates, owner, refreshTemplates, canLoadMore, loadingMore, error: listError, onLoadMore }: TemplatesPanelProps) {
  const [editing, setEditing] = useState<TemplateDto | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<TemplateDraft>(EMPTY_TEMPLATE_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [rebaseRequired, setRebaseRequired] = useState(false)
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  const frozen = useRef<TemplateAttempt | null>(null)
  const [frozenAttempt, setFrozenAttempt] = useState<TemplateAttempt | null>(null)

  const openCreate = () => {
    setCreating(true)
    setEditing(null)
    setDraft(EMPTY_TEMPLATE_DRAFT)
    setError(null)
    setSuccess(null)
    setRebaseRequired(false)
    frozen.current = null
    setFrozenAttempt(null)
  }
  const openEdit = (template: TemplateDto) => {
    setCreating(false)
    setEditing(template)
    setDraft(draftFrom(template))
    setError(null)
    setSuccess(null)
    setRebaseRequired(false)
    frozen.current = null
    setFrozenAttempt(null)
  }
  const close = () => {
    setCreating(false)
    setEditing(null)
    setError(null)
    setSuccess(null)
    setRebaseRequired(false)
    frozen.current = null
    setFrozenAttempt(null)
  }
  const updateDraft = <K extends keyof TemplateDraft>(field: K, value: TemplateDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }
  const retryAsNew = () => {
    frozen.current = null
    setFrozenAttempt(null)
    setRebaseRequired(false)
    setError(null)
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!owner || inFlight.current) return
    if (rebaseRequired) {
      setError('Prepará una acción nueva antes de enviar una versión actualizada.')
      return
    }
    const validation = validateTemplateBody(draft.bodyTemplate)
    if (validation) {
      setError(validation)
      return
    }
    inFlight.current = true
    setPending(true)
    setError(null)
    setSuccess(null)
    try {
      let attempt = frozen.current
      if (!isTemplateAttempt(attempt)) {
        const currentTemplates = await refreshTemplates()
        const current = editing ? currentTemplates.find((template) => template.id === editing.id) : null
        if (editing && !current) throw new Error('La plantilla ya no está disponible.')
        attempt = current
          ? { operation: 'update', id: current.id, providerTemplate: draft.providerTemplate || null, bodyTemplate: draft.bodyTemplate, isActive: draft.isActive, expectedVersion: current.version, idempotencyKey: key() }
          : { operation: 'create', code: draft.code.trim(), channel: draft.channel, locale: draft.locale.trim() || 'es-MX', providerTemplate: draft.providerTemplate || null, bodyTemplate: draft.bodyTemplate, isActive: draft.isActive, idempotencyKey: key() }
        if (!attempt.code && attempt.operation === 'create') {
          setError('El código de la plantilla es obligatorio.')
          return
        }
        frozen.current = attempt
        setFrozenAttempt(attempt)
      }
      if (attempt.operation === 'create') {
        await api.createTemplate({ code: attempt.code!, channel: attempt.channel!, locale: attempt.locale, providerTemplate: attempt.providerTemplate, bodyTemplate: attempt.bodyTemplate, isActive: attempt.isActive, idempotencyKey: attempt.idempotencyKey })
      } else {
        await api.updateTemplate({ id: attempt.id!, providerTemplate: attempt.providerTemplate, bodyTemplate: attempt.bodyTemplate, isActive: attempt.isActive, expectedVersion: attempt.expectedVersion!, idempotencyKey: attempt.idempotencyKey })
      }
      frozen.current = null
      setFrozenAttempt(null)
      await refreshTemplates()
      setSuccess(attempt.operation === 'create' ? 'La plantilla se creó.' : 'La plantilla se actualizó como una nueva versión.')
    } catch (requestError) {
      setError(communicationErrorMessage(requestError))
      if (isApiError(requestError) && requestError.status < 500) {
        frozen.current = null
        setFrozenAttempt(null)
        setRebaseRequired(true)
        try { await refreshTemplates() } catch { /* The mutation error remains authoritative. */ }
      }
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  const locked = Boolean(frozenAttempt)

  return <Card>
    <h2>Plantillas</h2>
    <p>Variables permitidas: {'{{patient_name}}'}, {'{{appointment_date}}'}, {'{{appointment_time}}'}, {'{{clinic_name}}'}.</p>
    {!owner ? <p role="status">Solo el odontólogo titular puede crear o actualizar plantillas.</p> : <Button onClick={openCreate}>Nueva plantilla</Button>}
    {listError ? <FormAlert tone="error">{listError}</FormAlert> : null}
    {templates.length === 0 ? <p>No hay plantillas en esta página.</p> : (
      <ul>
        {templates.map((template) => <li key={template.id}><Button variant="link" onClick={() => openEdit(template)}>{template.code}</Button> · {template.channel} · versión {template.version} · {template.is_active ? 'Activa' : 'Inactiva'}</li>)}
      </ul>
    )}
    {canLoadMore ? <Button variant="secondary" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? 'Cargando plantillas…' : 'Cargar más plantillas'}</Button> : null}
    {creating || editing ? (
      <form onSubmit={(event) => void submit(event)}>
        <h3>{creating ? 'Nueva plantilla' : 'Editar plantilla'}</h3>
        {error ? <FormAlert tone="error">{error}</FormAlert> : null}
        {success ? <FormAlert tone="success">{success}</FormAlert> : null}
        {locked && frozenAttempt ? <p>Reintentarás la solicitud original: {frozenAttempt.operation === 'create' ? `código ${frozenAttempt.code}, canal ${frozenAttempt.channel}` : `plantilla ${frozenAttempt.id}`} · cuerpo: {frozenAttempt.bodyTemplate}.</p> : null}
        {creating ? <label>Código de plantilla<input disabled={locked || pending} value={draft.code} onChange={(event) => updateDraft('code', event.target.value)} /></label> : null}
        {creating ? <label>Canal<select disabled={locked || pending} value={draft.channel} onChange={(event) => updateDraft('channel', event.target.value as TemplateDraft['channel'])}>{CHANNELS.map((channel) => <option key={channel} value={channel}>{channel}</option>)}</select></label> : null}
        {creating ? <label>Locale<input disabled={locked || pending} value={draft.locale} onChange={(event) => updateDraft('locale', event.target.value)} /></label> : null}
        <label>Plantilla del proveedor<input disabled={locked || pending} value={draft.providerTemplate} onChange={(event) => updateDraft('providerTemplate', event.target.value)} /></label>
        <label>Cuerpo de plantilla<textarea disabled={locked || pending} value={draft.bodyTemplate} onChange={(event) => updateDraft('bodyTemplate', event.target.value)} /></label>
        <label><input type="checkbox" disabled={locked || pending} checked={draft.isActive} onChange={(event) => updateDraft('isActive', event.target.checked)} /> Activa</label>
        {rebaseRequired ? <Button type="button" onClick={retryAsNew}>Preparar una acción nueva</Button> : null}
        <Button type="submit" disabled={pending || rebaseRequired}>{pending ? 'Guardando…' : 'Guardar plantilla'}</Button>
        <Button type="button" variant="link" disabled={locked || pending} onClick={close}>Cerrar</Button>
      </form>
    ) : null}
  </Card>
}
