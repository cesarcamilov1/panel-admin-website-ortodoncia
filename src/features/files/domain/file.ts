export type FileCategory = 'XRAY' | 'PHOTO' | 'DOCUMENT' | 'CONSENT' | 'PRESCRIPTION' | 'LAB_RESULT' | 'OTHER'
export type ScanStatus = 'PENDING' | 'CLEAN' | 'REJECTED' | 'ERROR'

export interface PrivateFile {
  id: string
  patientId: string
  category: FileCategory
  originalFilename: string
  mediaType: 'application/pdf' | 'image/jpeg' | 'image/png'
  sizeBytes: number
  scanStatus: ScanStatus
  createdAt: string
}

export interface PrivateFileDto {
  id: string
  patient_id: string
  category: FileCategory
  original_filename: string
  media_type: PrivateFile['mediaType']
  size_bytes: number
  scan_status: ScanStatus
  created_at: string
}

/** Backend default OBJECT_STORAGE_MAX_UPLOAD_BYTES. The server remains authoritative. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set<PrivateFile['mediaType']>(['application/pdf', 'image/jpeg', 'image/png'])

export function fromPrivateFileDto(dto: PrivateFileDto): PrivateFile {
  return {
    id: dto.id,
    patientId: dto.patient_id,
    category: dto.category,
    originalFilename: dto.original_filename,
    mediaType: dto.media_type,
    sizeBytes: dto.size_bytes,
    scanStatus: dto.scan_status,
    createdAt: dto.created_at,
  }
}

export function isWireSafeFilename(filename: string): boolean {
  return (
    filename.length > 0 &&
    filename.length <= 255 &&
    filename.trim() === filename &&
    /^[\x20-\x7e]+$/.test(filename) &&
    !filename.includes('/') &&
    !filename.includes('\\') &&
    !filename.includes('..') &&
    filename !== '.'
  )
}

export function validateUploadFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.has(file.type as PrivateFile['mediaType'])) return 'Solo se aceptan archivos PDF, JPEG o PNG.'
  if (!isWireSafeFilename(file.name)) return 'El nombre del archivo debe renombrarse con caracteres ASCII imprimibles, sin rutas ni controles, antes de subirlo.'
  if (file.size === 0) return 'El archivo no puede estar vacío.'
  if (file.size > MAX_UPLOAD_BYTES) return 'El archivo supera el límite configurado de 15 MiB.'
  return null
}

export function isCleanFile(file: Pick<PrivateFile, 'patientId' | 'scanStatus'>, patientId: string): boolean {
  return file.patientId === patientId && file.scanStatus === 'CLEAN'
}

export function scanStatusLabel(status: ScanStatus): string {
  return ({ PENDING: 'Pendiente de análisis', CLEAN: 'Limpio', REJECTED: 'Rechazado', ERROR: 'Error de análisis' })[status]
}

export function fileErrorMessage(error: unknown): string {
  const value = error as { code?: string; detail?: string; status?: number }
  if (value?.code === 'FORBIDDEN') return 'Tu rol no tiene permiso para acceder a los archivos del paciente.'
  if (value?.code === 'FILE_UNAVAILABLE') return 'El archivo todavía no está disponible porque no superó el análisis de seguridad.'
  if (value?.code === 'FILE_REJECTED') return 'El archivo fue rechazado por el análisis de seguridad.'
  if (value?.code === 'UNSUPPORTED_MEDIA_TYPE' || value?.code === 'MIME_MISMATCH') return 'El contenido del archivo no coincide con un PDF, JPEG o PNG permitido.'
  if (value?.code === 'FILE_TOO_LARGE') return 'El archivo supera el límite configurado por el servidor.'
  if (value?.code === 'CANCELLED') return 'La operación de archivo fue cancelada.'
  if (value?.status && value.status >= 500) return 'El servicio de archivos no está disponible por ahora. Intentá nuevamente.'
  return value?.detail ?? 'No pudimos completar la operación con el archivo. Intentá nuevamente.'
}
