import { useResource } from '../../../shared/api/useResource'
import { SelectField } from '../../../shared/ui/atoms/Field'
import type { FilesApi } from '../../files/application/filesApi'
import { isCleanFile } from '../../files/domain/file'

export function ConsentFileSelector({ api, patientId, label, value, onChange, disabled = false }: { api: FilesApi; patientId: string; label: string; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const files = useResource((signal) => api.list({ patientId, signal }), [api, patientId])
  if (files.state.status === 'loading') return <p role="status">Cargando archivos de consentimiento limpios…</p>
  if (files.state.status === 'error') return <p role="alert">No se pudieron cargar archivos de consentimiento seguros.</p>
  const options = files.state.data.filter((file) => file.category === 'CONSENT' && isCleanFile(file, patientId)).map((file) => ({ value: file.id, label: `${file.originalFilename} · ${file.mediaType}` }))
  return <SelectField label={label} value={value} disabled={disabled} options={[{ value: '', label: options.length ? 'Sin archivo' : 'No hay archivos CLEAN aptos' }, ...options]} onChange={(event) => onChange(event.target.value)} hint="Solo se muestran archivos CLEAN de consentimiento de este paciente." />
}
