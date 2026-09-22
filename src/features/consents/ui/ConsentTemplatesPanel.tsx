import { type FormEvent, type ReactNode, useRef, useState } from 'react'
import { useResource } from '../../../shared/api/useResource'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { TextArea, TextField } from '../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import styles from '../../patient-record/ui/ClinicalRecordTabs.module.css'
import type { ConsentsApi } from '../application/consentsApi'
import { consentErrorMessage } from '../domain/consent'

export function ConsentTemplatesPanel({ api, owner }: { api: ConsentsApi; owner: boolean }) {
  const templates = useResource((signal) => api.listTemplates(false, signal), [api])
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState('')

  if (templates.state.status === 'loading') return <p role="status">Cargando plantillas…</p>
  if (templates.state.status === 'error') return <FormAlert tone="error">{consentErrorMessage(templates.state.error)}</FormAlert>

  return (
    <section className={styles.stack} aria-label="Plantillas de consentimiento">
      <div className={styles.heading}>
        <div>
          <h3>Plantillas de consentimiento</h3>
          <p>Las versiones publicadas son inmutables.</p>
        </div>
        {owner ? <Button size="sm" onClick={() => setCreating(true)}>Nueva plantilla</Button> : null}
      </div>
      {templates.state.data.length ? (
        <div className={styles.list}>
          {templates.state.data.map((item) => (
            <button className={styles.rowButton} type="button" key={item.id} onClick={() => setSelected(item.id)}>
              <strong>{item.name}</strong><span>{item.code} · {item.active ? 'Activa' : 'Inactiva'}</span>
            </button>
          ))}
        </div>
      ) : <p className={styles.empty}>No hay plantillas registradas.</p>}
      {creating ? <TemplateForm onCancel={() => setCreating(false)} onSave={async (input) => {
        await api.createTemplate(input)
        setCreating(false)
        await templates.reload()
      }} /> : null}
      {selected ? <TemplateDetail key={selected} api={api} id={selected} owner={owner} onChanged={templates.reload} /> : null}
    </section>
  )
}

function TemplateForm({ onCancel, onSave }: { onCancel: () => void; onSave: (input: { code: string; name: string; active: boolean }) => Promise<void> }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')

  return <Form title="Nueva plantilla" onCancel={onCancel} onSave={() => onSave({ code, name, active: true })}>
    <TextField label="Código" required value={code} onChange={(event) => setCode(event.target.value)} />
    <TextField label="Nombre" required value={name} onChange={(event) => setName(event.target.value)} />
  </Form>
}

function TemplateDetail({ api, id, owner, onChanged }: { api: ConsentsApi; id: string; owner: boolean; onChanged: () => Promise<void> }) {
  const template = useResource((signal) => api.getTemplate(id, signal), [api, id])
  const versions = useResource((signal) => api.listTemplateVersions(id, signal), [api, id])
  const [publishing, setPublishing] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const updateInFlight = useRef(false)

  const refresh = async () => {
    await template.reload()
    await versions.reload()
    await onChanged()
  }

  const updateActive = async () => {
    if (template.state.status !== 'ready' || updateInFlight.current) return
    updateInFlight.current = true
    setUpdating(true)
    setError(null)
    try {
      await api.updateTemplate(template.state.data.id, template.state.data.version, !template.state.data.active)
      await refresh()
    } catch (cause) {
      setError(consentErrorMessage(cause))
    } finally {
      updateInFlight.current = false
      setUpdating(false)
    }
  }

  if (template.state.status !== 'ready') return <p role="status">Verificando plantilla…</p>

  const item = template.state.data
  return (
    <article className={styles.card}>
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <p><Badge tone={item.active ? 'ok' : 'neutral'}>{item.active ? 'Activa' : 'Inactiva'}</Badge> Versión {item.version}</p>
      {versions.state.status === 'ready' ? (
        <div className={styles.nested}>
          <h5>Versiones publicadas</h5>
          {versions.state.data.length ? versions.state.data.map((version) => <p key={version.id}>Versión {version.versionNumber} · {version.contentHash}</p>) : <p className={styles.empty}>No hay versiones publicadas.</p>}
        </div>
      ) : <p role="status">Cargando versiones…</p>}
      {owner ? <>
        <Button size="sm" variant="secondary" disabled={updating} onClick={() => void updateActive()}>{updating ? 'Guardando…' : item.active ? 'Desactivar' : 'Activar'}</Button>
        <Button size="sm" disabled={updating} onClick={() => setPublishing(true)}>Publicar versión</Button>
      </> : null}
      {publishing ? <PublishForm onCancel={() => setPublishing(false)} onSave={async (contentMarkdown) => {
        await api.publishVersion(item.id, contentMarkdown)
        await refresh()
        setPublishing(false)
      }} /> : null}
    </article>
  )
}

function PublishForm({ onCancel, onSave }: { onCancel: () => void; onSave: (content: string) => Promise<void> }) {
  const [content, setContent] = useState('')
  return <Form title="Publicar versión inmutable" onCancel={onCancel} onSave={() => onSave(content)}>
    <TextArea label="Contenido de la plantilla" required rows={8} value={content} onChange={(event) => setContent(event.target.value)} />
  </Form>
}

function Form({ title, children, onCancel, onSave }: { title: string; children: ReactNode; onCancel: () => void; onSave: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setError(null)
    try {
      await onSave()
    } catch (cause) {
      setError(consentErrorMessage(cause))
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <h5>{title}</h5>
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {children}
      <div className={styles.actions}>
        <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </form>
  )
}
