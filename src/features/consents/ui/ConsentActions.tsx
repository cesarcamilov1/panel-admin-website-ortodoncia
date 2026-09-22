import { useEffect, useRef, useState } from 'react'
import { useResource } from '../../../shared/api/useResource'
import { Button } from '../../../shared/ui/atoms/Button'
import { SelectField, TextArea, TextField } from '../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import type { FilesApi } from '../../files/application/filesApi'
import { isCleanFile, type PrivateFile } from '../../files/domain/file'
import type { ConsentsApi } from '../application/consentsApi'
import {
  canRevokeConsent,
  canSignConsent,
  canVoidConsent,
  consentErrorMessage,
  isConsentConflict,
  type PatientConsent,
} from '../domain/consent'
import { ConsentFileSelector } from './ConsentFileSelector'
import styles from '../../patient-record/ui/ClinicalRecordTabs.module.css'

type Action = 'sign' | 'revoke' | 'void' | null
type SignatureMethod = 'DRAWN' | 'DIGITAL_CONFIRMATION'
type BoundDocumentState =
  | { status: 'not-required' | 'loading' }
  | { status: 'ready'; file: PrivateFile; url: string }
  | { status: 'error'; message: string }

function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) return Promise.reject(new Error('Web Crypto is unavailable.'))
  return globalThis.crypto.subtle.digest('SHA-256', buffer).then((digest) =>
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
  )
}

function boundDocumentError(error: unknown): string {
  if (error instanceof Error && error.message === 'HASH_MISMATCH') {
    return 'El hash del documento vinculado no coincide con la evidencia inmutable. No es posible firmar.'
  }
  if (error instanceof Error && error.message === 'UNSAFE_DOCUMENT') {
    return 'El documento vinculado no es un archivo CLEAN de consentimiento del paciente actual. No es posible firmar.'
  }
  return 'No se pudo recuperar y verificar el documento vinculado. No es posible firmar.'
}

function useBoundConsentDocument(filesApi: FilesApi | undefined, consent: PatientConsent, patientId: string): BoundDocumentState {
  const [state, setState] = useState<BoundDocumentState>(() =>
    consent.documentFileId ? { status: 'loading' } : { status: 'not-required' },
  )

  useEffect(() => {
    let active = true
    if (!consent.documentFileId) {
      queueMicrotask(() => {
        if (active) setState({ status: 'not-required' })
      })
      return () => {
        active = false
      }
    }

    const controller = new AbortController()
    let objectUrl: string | null = null

    void Promise.resolve().then(async () => {
      if (!active) return
      setState({ status: 'loading' })
      try {
        if (!filesApi) throw new Error('UNSAFE_DOCUMENT')
        const file = await filesApi.get(consent.documentFileId, patientId, controller.signal)
        if (
          file.id !== consent.documentFileId ||
          file.category !== 'CONSENT' ||
          !isCleanFile(file, patientId) ||
          !['application/pdf', 'image/jpeg', 'image/png'].includes(file.mediaType)
        ) {
          throw new Error('UNSAFE_DOCUMENT')
        }

        const blob = await filesApi.download(consent.documentFileId, patientId, controller.signal)
        if (blob.type !== file.mediaType) throw new Error('UNSAFE_DOCUMENT')
        const hash = await sha256Hex(await blob.arrayBuffer())
        if (!/^[a-f0-9]{64}$/i.test(consent.documentHash) || hash !== consent.documentHash.toLowerCase()) {
          throw new Error('HASH_MISMATCH')
        }

        if (!active || controller.signal.aborted) return
        const nextObjectUrl = URL.createObjectURL(blob)
        if (!active || controller.signal.aborted) {
          URL.revokeObjectURL(nextObjectUrl)
          return
        }
        objectUrl = nextObjectUrl
        setState({ status: 'ready', file, url: objectUrl })
      } catch (error) {
        if (active && !controller.signal.aborted) setState({ status: 'error', message: boundDocumentError(error) })
      }
    })

    return () => {
      active = false
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [filesApi, consent.documentFileId, consent.documentHash, patientId])

  return state
}

export function ConsentActions({ api, filesApi, consent, patientId, role, ready, reload }: {
  api: ConsentsApi
  filesApi?: FilesApi
  consent: PatientConsent
  patientId: string
  role: string
  ready: boolean
  reload: () => Promise<void>
}) {
  const terms = useResource((signal) => api.getTemplateVersion(consent.templateVersionId, signal), [api, consent.templateVersionId])
  const boundDocument = useBoundConsentDocument(filesApi, consent, patientId)
  const [action, setAction] = useState<Action>(null)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [signerName, setSignerName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [method, setMethod] = useState<SignatureMethod>('DIGITAL_CONFIRMATION')
  const [signatureFileId, setSignatureFileId] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [acknowledgedDocumentKey, setAcknowledgedDocumentKey] = useState('')
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  const hasBoundDocument = Boolean(consent.documentFileId)
  const boundDocumentKey = `${consent.id}:${consent.documentFileId}:${consent.documentHash}`
  const boundDocumentConfirmed = acknowledgedDocumentKey === boundDocumentKey
  const canSign = canSignConsent(consent) && role !== 'BILLING'
  const canRevoke = canRevokeConsent(consent, role)
  const canVoid = canVoidConsent(consent, role)
  const matchingTerms = terms.state.status === 'ready' && terms.state.data.id === consent.templateVersionId
  const prerequisiteReady = hasBoundDocument ? boundDocument.status === 'ready' : matchingTerms
  const hasValidEvidence = method === 'DIGITAL_CONFIRMATION' ? confirmed : Boolean(signatureFileId)
  const signReady = ready && prerequisiteReady && signerName.trim().length > 0 && hasValidEvidence && (!hasBoundDocument || boundDocumentConfirmed)

  const execute = async () => {
    if (!action || inFlight.current || !ready || (action === 'sign' && !signReady)) return
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      if (action === 'sign') {
        await api.sign(consent.id, patientId, consent.version, {
          signerName,
          signerRelationship: relationship,
          method,
          signatureFileId: method === 'DRAWN' ? signatureFileId : '',
          confirmed: method === 'DIGITAL_CONFIRMATION' && confirmed,
        })
      } else if (action === 'revoke') {
        await api.revoke(consent.id, patientId, consent.version, reason)
      } else {
        await api.void(consent.id, patientId, consent.version)
      }
      setAction(null)
      await reload()
    } catch (cause) {
      setError(consentErrorMessage(cause))
      if (isConsentConflict(cause)) await reload()
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  const termsBlock = terms.state.status === 'ready' && matchingTerms ? <section aria-label="Términos inmutables de consentimiento"><h5>{hasBoundDocument ? 'Texto de plantilla complementario' : `Términos de la versión ${terms.state.data.versionNumber}`}</h5><pre>{terms.state.data.contentMarkdown}</pre></section> : null

  return <div className={styles.actions}>
    {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    {!action && hasBoundDocument && boundDocument.status === 'error' ? <FormAlert tone="error">{boundDocument.message}</FormAlert> : null}
    {action ? <div className={styles.confirm} role="alertdialog" aria-label="Confirmar acción de consentimiento">
      {action === 'sign' ? <>
        <p>Leé y confirmá la evidencia inmutable antes de registrar la firma.</p>
        {hasBoundDocument ? <>
          {boundDocument.status === 'loading' ? <p role="status">Recuperando y verificando el documento vinculado…</p> : null}
          {boundDocument.status === 'error' ? <FormAlert tone="error">{boundDocument.message}</FormAlert> : null}
          {boundDocument.status === 'ready' ? <section aria-label="Documento vinculado verificado"><h5>Documento vinculado verificado</h5><p>{boundDocument.file.originalFilename} · {boundDocument.file.mediaType}</p><a href={boundDocument.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Abrir documento vinculado verificado</a><label className={styles.check}><input type="checkbox" disabled={pending} checked={boundDocumentConfirmed} onChange={(event) => setAcknowledgedDocumentKey(event.target.checked ? boundDocumentKey : '')} /> Confirmo que revisé el documento vinculado verificado.</label></section> : null}
          {terms.state.status === 'loading' ? <p role="status">Cargando texto complementario de la plantilla…</p> : null}
          {terms.state.status === 'error' ? <FormAlert tone="error">No se pudieron cargar los términos complementarios de la plantilla.</FormAlert> : null}
          {termsBlock}
        </> : <>
          {terms.state.status === 'loading' ? <p role="status">Cargando los términos inmutables…</p> : null}
          {terms.state.status === 'error' ? <FormAlert tone="error">No se pudieron verificar los términos de la versión inmutable. No es posible firmar.</FormAlert> : null}
          {terms.state.status === 'ready' && !matchingTerms ? <FormAlert tone="error">Los términos cargados no corresponden a este consentimiento. No es posible firmar.</FormAlert> : null}
          {termsBlock}
        </>}
        <TextField label="Nombre de quien firma" required disabled={!prerequisiteReady || pending} value={signerName} onChange={(event) => setSignerName(event.target.value)} />
        <TextField label="Relación con la persona paciente" disabled={!prerequisiteReady || pending} value={relationship} onChange={(event) => setRelationship(event.target.value)} />
        {filesApi ? <SelectField label="Método de evidencia" disabled={!prerequisiteReady || pending} value={method} options={[{ value: 'DIGITAL_CONFIRMATION', label: 'Confirmación digital' }, { value: 'DRAWN', label: 'Archivo de firma existente' }]} onChange={(event) => { setMethod(event.target.value as SignatureMethod); setConfirmed(false); setSignatureFileId('') }} /> : null}
        {method === 'DRAWN' && filesApi ? <ConsentFileSelector api={filesApi} patientId={patientId} label="Archivo de firma CLEAN" value={signatureFileId} disabled={!prerequisiteReady || pending} onChange={setSignatureFileId} /> : null}
        {method === 'DIGITAL_CONFIRMATION' ? <label className={styles.check}><input type="checkbox" disabled={!prerequisiteReady || pending} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Confirmo que la persona expresó su aceptación de la evidencia mostrada.</label> : null}
      </> : action === 'revoke' ? <TextArea label="Motivo de revocación" required disabled={pending} value={reason} onChange={(event) => setReason(event.target.value)} /> : <p>¿Confirmás anular este consentimiento pendiente? La evidencia existente no se elimina.</p>}
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => setAction(null)}>Cancelar</Button>
      <Button size="sm" variant={action === 'void' ? 'danger' : 'primary'} disabled={pending || !ready || (action === 'sign' && !signReady) || (action === 'revoke' && !reason.trim())} onClick={() => void execute()}>{pending ? 'Guardando…' : 'Confirmar'}</Button>
    </div> : <>
      {canVoid ? <Button size="sm" variant="secondary" disabled={!ready || pending} onClick={() => setAction('void')}>Anular pendiente</Button> : null}
      {canRevoke ? <Button size="sm" variant="secondary" disabled={!ready || pending} onClick={() => setAction('revoke')}>Revocar consentimiento</Button> : null}
      {canSign ? <Button size="sm" disabled={!ready || pending || !prerequisiteReady} onClick={() => setAction('sign')}>{hasBoundDocument && boundDocument.status === 'loading' ? 'Verificando documento…' : terms.state.status === 'loading' && !hasBoundDocument ? 'Cargando términos…' : 'Registrar confirmación digital'}</Button> : null}
    </>}
  </div>
}
