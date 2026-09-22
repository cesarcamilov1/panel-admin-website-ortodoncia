import { type ChangeEvent, useRef, useState } from 'react'
import { useResource } from '../../../shared/api/useResource'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { SelectField } from '../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import type { FilesApi } from '../application/filesApi'
import { fileErrorMessage, isCleanFile, scanStatusLabel, type FileCategory, type PrivateFile, validateUploadFile } from '../domain/file'
import { triggerBlobDownload } from './fileDownload'
import styles from '../../patient-record/ui/ClinicalRecordTabs.module.css'

const CATEGORIES: Array<{ value: FileCategory; label: string }> = [
  { value: 'DOCUMENT', label: 'Documento' }, { value: 'XRAY', label: 'Radiografía' }, { value: 'PHOTO', label: 'Fotografía' },
  { value: 'CONSENT', label: 'Consentimiento' }, { value: 'PRESCRIPTION', label: 'Receta' }, { value: 'LAB_RESULT', label: 'Resultado de laboratorio' }, { value: 'OTHER', label: 'Otro' },
]

function scanTone(file: PrivateFile): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (file.scanStatus === 'CLEAN') return 'ok'
  if (file.scanStatus === 'PENDING') return 'warn'
  if (file.scanStatus === 'REJECTED') return 'danger'
  return 'neutral'
}

export function FilesPanel({ api, patientId }: { api: FilesApi; patientId: string }) {
  const files = useResource((signal) => api.list({ patientId, signal }), [api, patientId])
  const [category, setCategory] = useState<FileCategory>('DOCUMENT')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const uploadController = useRef<AbortController | null>(null)
  const uploadInFlight = useRef(false)
  const downloadInFlight = useRef<string | null>(null)

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const candidate = event.target.files?.[0] ?? null
    const error = candidate ? validateUploadFile(candidate) : null
    setSelectedFile(error ? null : candidate)
    setSelectionError(error)
    setOperationError(null)
  }

  const upload = async () => {
    if (!selectedFile || selectionError || uploadInFlight.current) return
    uploadInFlight.current = true
    const controller = new AbortController()
    uploadController.current = controller
    setUploading(true)
    setOperationError(null)
    try {
      await api.upload({ patientId, category, file: selectedFile, signal: controller.signal })
      setSelectedFile(null)
      await files.reload()
    } catch (error) {
      setOperationError(fileErrorMessage(error))
    } finally {
      if (uploadController.current === controller) uploadController.current = null
      uploadInFlight.current = false
      setUploading(false)
    }
  }

  const download = async (file: PrivateFile) => {
    if (!isCleanFile(file, patientId) || downloadInFlight.current) return
    downloadInFlight.current = file.id
    setDownloading(file.id)
    setOperationError(null)
    try {
      const authoritative = await api.get(file.id, patientId)
      if (!isCleanFile(authoritative, patientId)) {
        setOperationError('El archivo ya no está limpio o no pertenece al paciente actual; no se puede descargar.')
        return
      }
      const blob = await api.download(file.id, patientId)
      triggerBlobDownload(blob, authoritative.originalFilename)
    } catch (error) {
      setOperationError(fileErrorMessage(error))
    } finally {
      downloadInFlight.current = null
      setDownloading(null)
    }
  }

  if (files.state.status === 'loading') return <p role="status">Cargando archivos privados…</p>
  if (files.state.status === 'error') return <FormAlert tone="error">{fileErrorMessage(files.state.error)} <Button size="sm" variant="secondary" onClick={() => void files.reload()}>Reintentar</Button></FormAlert>

  return <section className={styles.stack} aria-label="Archivos del paciente">
    <div className={styles.heading}><div><h3>Archivos del paciente</h3><p>Los archivos se revisan por seguridad antes de poder descargarse.</p></div></div>
    {operationError ? <FormAlert tone="error">{operationError}</FormAlert> : null}
    <section className={styles.form} aria-label="Subir archivo privado">
      <SelectField label="Categoría" value={category} options={CATEGORIES} disabled={uploading} onChange={(event) => setCategory(event.target.value as FileCategory)} />
      <label>Elegir archivo<input aria-label="Elegir archivo" type="file" accept="application/pdf,image/jpeg,image/png" disabled={uploading} onChange={selectFile} /></label>
      {selectedFile ? <p>Seleccionado: {selectedFile.name}</p> : null}
      {selectionError ? <FormAlert tone="error">{selectionError}</FormAlert> : null}
      <div className={styles.actions}>
        <Button size="sm" disabled={!selectedFile || Boolean(selectionError) || uploading} onClick={() => void upload()}>{uploading ? 'Subiendo…' : 'Subir archivo'}</Button>
        {uploading ? <Button size="sm" variant="secondary" onClick={() => uploadController.current?.abort()}>Cancelar subida</Button> : null}
      </div>
    </section>
    {files.state.data.length ? <div className={styles.list}>{files.state.data.map((file) => {
      const clean = isCleanFile(file, patientId)
      return <article className={styles.card} key={file.id}><div className={styles.heading}><div><strong>{file.originalFilename}</strong><p>{file.category} · {file.mediaType} · {file.sizeBytes} bytes</p></div><Badge tone={scanTone(file)}>{scanStatusLabel(file.scanStatus)}</Badge></div>
        <Button size="sm" variant="secondary" disabled={!clean || downloading === file.id} aria-label={`Descargar ${file.originalFilename}`} onClick={() => void download(file)}>{downloading === file.id ? 'Descargando…' : 'Descargar'}</Button>
      </article>
    })}</div> : <p className={styles.empty}>No hay archivos privados registrados para este paciente.</p>}
  </section>
}
