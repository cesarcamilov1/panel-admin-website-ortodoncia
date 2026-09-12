import type { Tone } from '../../../shared/ui/atoms/Badge'
import type { OdontogramMarks } from './odontogram'

export const PATIENT = {
  record: 'EXP-0421',
  name: 'Lucía Mendoza Rivas',
  age: '34 años · 12 mar 1992',
  phone: '55 1874 2093',
  email: 'lucia.mendoza@correo.mx',
  since: 'Alta el 4 feb 2023',
  nextVisit: 'jue 18 sep, 10:30',
  alerts: [
    { label: 'Activa', tone: 'ok' as Tone },
    { label: 'Alergia a penicilina', tone: 'danger' as Tone },
  ],
}

export const SEEDED_MARKS: OdontogramMarks = {
  '16:O': 'caries',
  '24:D': 'caries',
  '26:M': 'obturacion',
  '36:O': 'obturacion',
  '37:O': 'sellador',
  '11:V': 'fractura',
  '46:ALL': 'corona',
  '21:ALL': 'endodoncia',
  '38:ALL': 'ausente',
}

export const MEDICAL_HISTORY = [
  { label: 'Alergias', value: 'Penicilina (urticaria, 2019)', critical: true },
  { label: 'Padecimientos', value: 'Ninguno declarado', critical: false },
  { label: 'Medicación actual', value: 'Anticonceptivo oral', critical: false },
  { label: 'Anticoagulantes', value: 'No', critical: false },
  { label: 'Embarazo o lactancia', value: 'No', critical: false },
  { label: 'Hábitos', value: 'Bruxismo nocturno, usa guarda', critical: false },
]

export const TIMELINE = [
  {
    date: '16 sep',
    title: 'Ajuste de ortodoncia',
    detail: 'Cambio de ligas, sin incidencias. Dra. Cázares.',
    tone: 'info' as const,
  },
  {
    date: '16 sep',
    title: 'Pago recibido $3,400',
    detail: 'Tarjeta · aplicado a mensualidad de septiembre.',
    tone: 'ok' as const,
  },
  {
    date: '2 sep',
    title: 'Odontograma actualizado',
    detail: 'Caries oclusal en 16, se agregó al plan.',
    tone: 'warn' as const,
  },
  {
    date: '22 ago',
    title: 'Plan 2026-014 aceptado',
    detail: 'Rehabilitación superior por $24,800.',
    tone: 'neutral' as const,
  },
  {
    date: '14 ago',
    title: 'Radiografía panorámica',
    detail: 'Archivo PAN-0421 revisado y firmado.',
    tone: 'neutral' as const,
  },
]

export const RECORD_PENDING = [
  { label: 'Consentimiento de endodoncia sin firmar', tone: 'warn' as const },
  { label: 'Falta constancia de situación fiscal', tone: 'warn' as const },
  { label: 'Mensualidad de septiembre vencida', tone: 'danger' as const },
]

export const CLINICAL_NOTES = [
  {
    id: 'note-1',
    title: 'Ajuste de ortodoncia',
    state: 'Firmada',
    tone: 'ok' as Tone,
    meta: '16 sep 2026 · Dra. Cázares',
    body: 'Motivo: control mensual de ortodoncia.\nExploración: buena higiene, sin descalcificaciones. Arco 016x022 en su lugar.\nPlan: cambio de ligas, cita en cuatro semanas.',
    chips: ['Ortodoncia', 'Caso ORT-2025-041'],
  },
  {
    id: 'note-2',
    title: 'Valoración de caries en 16',
    state: 'Firmada',
    tone: 'ok' as Tone,
    meta: '2 sep 2026 · Dra. Cázares',
    body: 'Motivo: sensibilidad al frío en cuadrante superior derecho.\nExploración: caries oclusal en 16 sin compromiso pulpar. Vitalidad positiva.\nPlan: resina posterior, se agrega al plan de tratamiento.',
    chips: ['Diente 16', 'Plan 2026-014'],
  },
  {
    id: 'note-3',
    title: 'Control posoperatorio',
    state: 'Con adenda',
    tone: 'info' as Tone,
    meta: '14 ago 2026 · Dr. Robledo',
    body: 'Motivo: revisión a siete días de la extracción de 18.\nExploración: alveolo en cicatrización, sin signos de alveolitis.\nAdenda del 15 ago: la paciente reportó dolor leve, se indicó analgésico.',
    chips: ['Cirugía', 'Diente 18'],
  },
  {
    id: 'note-4',
    title: 'Nota inicial',
    state: 'Borrador',
    tone: 'warn' as Tone,
    meta: '4 feb 2023 · Dra. Cázares',
    body: 'Primera consulta. Historia médica capturada, se solicita panorámica antes de continuar.',
    chips: ['Ingreso'],
  },
]

export const PLAN_LINES = [
  { n: 1, name: 'Resina posterior', code: 'SRV-214', tooth: '16 · O', amount: '$1,450.00', state: 'Completado', tone: 'ok' as Tone },
  { n: 2, name: 'Resina posterior', code: 'SRV-214', tooth: '24 · D', amount: '$1,450.00', state: 'Programado', tone: 'info' as Tone },
  { n: 3, name: 'Corona de zirconia', code: 'SRV-540', tooth: '46', amount: '$9,800.00', state: 'En progreso', tone: 'info' as Tone },
  { n: 4, name: 'Endodoncia unirradicular', code: 'SRV-330', tooth: '21', amount: '$3,900.00', state: 'Completado', tone: 'ok' as Tone },
  { n: 5, name: 'Blanqueamiento en consultorio', code: 'SRV-620', tooth: 'Arcada completa', amount: '$4,200.00', state: 'Propuesto', tone: 'warn' as Tone },
  { n: 6, name: 'Guarda oclusal', code: 'SRV-710', tooth: 'Superior', amount: '$4,000.00', state: 'Propuesto', tone: 'warn' as Tone },
]

export const PLAN_TOTALS = [
  { label: 'Completado', value: '$5,350.00' },
  { label: 'En progreso', value: '$9,800.00' },
  { label: 'Propuesto', value: '$8,200.00' },
  { label: 'Descuento aplicado', value: '-$550.00' },
]

export const PRESCRIPTIONS = [
  {
    folio: 'RX-2026-0412',
    state: 'Firmada',
    tone: 'ok' as Tone,
    date: '16 sep 2026',
    signer: 'Dra. Mariana Cázares · Céd. 4821330',
    items: [
      { name: 'Clindamicina 300 mg', dose: '1 cápsula cada 8 horas por 5 días. Alternativa por alergia a penicilina.' },
      { name: 'Ibuprofeno 400 mg', dose: '1 tableta cada 8 horas por 3 días, con alimentos.' },
    ],
  },
  {
    folio: 'RX-2026-0388',
    state: 'Firmada',
    tone: 'ok' as Tone,
    date: '2 sep 2026',
    signer: 'Dra. Mariana Cázares · Céd. 4821330',
    items: [{ name: 'Clorhexidina 0.12%', dose: 'Enjuague 15 ml dos veces al día por 7 días.' }],
  },
  {
    folio: 'RX-2025-1204',
    state: 'Vencida',
    tone: 'neutral' as Tone,
    date: '14 ago 2025',
    signer: 'Dr. Iván Robledo · Céd. 5510992',
    items: [{ name: 'Ketorolaco 10 mg', dose: '1 tableta cada 8 horas por 2 días si hay dolor.' }],
  },
]

export const PAYMENT_KPIS = [
  { label: 'Saldo pendiente', value: '$3,400.00', tone: 'danger' as const },
  { label: 'Pagado este año', value: '$41,200.00' },
  { label: 'Plan activo', value: '$24,800.00' },
  { label: 'Próximo vencimiento', value: '5 oct', tone: 'warn' as const },
]

export const PAYMENT_METHODS = ['Efectivo', 'Tarjeta', 'Transferencia', 'Vale']

export const PAYMENTS = [
  { id: 'REC-4821', concept: 'Mensualidad de ortodoncia', meta: 'REC-4821 · 16 sep 2026', method: 'Tarjeta ····4417', amount: '$3,400.00', state: 'Recibido', tone: 'ok' as Tone, refund: false },
  { id: 'REC-4702', concept: 'Resina posterior 16', meta: 'REC-4702 · 2 sep 2026', method: 'Efectivo', amount: '$1,450.00', state: 'Recibido', tone: 'ok' as Tone, refund: false },
  { id: 'REC-4655', concept: 'Anticipo corona 46', meta: 'REC-4655 · 22 ago 2026', method: 'Transferencia', amount: '$4,900.00', state: 'Recibido', tone: 'ok' as Tone, refund: false },
  { id: 'REC-4590', concept: 'Mensualidad de agosto', meta: 'REC-4590 · 5 ago 2026', method: 'Tarjeta ····4417', amount: '$3,400.00', state: 'Recibido', tone: 'ok' as Tone, refund: false },
  { id: 'CAR-0088', concept: 'Cargo por no asistir', meta: 'CAR-0088 · 30 jul 2026', method: 'Pendiente', amount: '$400.00', state: 'Por cobrar', tone: 'warn' as Tone, refund: false },
  { id: 'REM-0121', concept: 'Reembolso de duplicado', meta: 'REM-0121 · 18 jul 2026', method: 'Tarjeta ····4417', amount: '-$850.00', state: 'Reembolsado', tone: 'danger' as Tone, refund: true },
]

export const FILE_FILTERS = ['Todos', 'Radiografías', 'Fotografías', 'Documentos', 'CFDI']

export const FILES = [
  { name: 'Panorámica 2026.jpg', meta: 'Radiografía · 2 sep', scan: 'Limpio', tone: 'ok' as Tone, kind: 'xray' as const },
  { name: 'Periapical 16.jpg', meta: 'Radiografía · 2 sep', scan: 'Limpio', tone: 'ok' as Tone, kind: 'xray' as const },
  { name: 'Intraoral frontal.jpg', meta: 'Fotografía · 22 ago', scan: 'Limpio', tone: 'ok' as Tone, kind: 'photo' as const },
  { name: 'Intraoral lateral.jpg', meta: 'Fotografía · 22 ago', scan: 'Limpio', tone: 'ok' as Tone, kind: 'photo' as const },
  { name: 'Consentimiento endodoncia.pdf', meta: 'Documento · 20 ago', scan: 'Revisando', tone: 'warn' as Tone, kind: 'doc' as const },
  { name: 'Constancia fiscal.pdf', meta: 'Documento · 14 ago', scan: 'Limpio', tone: 'ok' as Tone, kind: 'doc' as const },
  { name: 'A-2026-1284.xml', meta: 'CFDI · 16 sep', scan: 'Limpio', tone: 'ok' as Tone, kind: 'code' as const },
  { name: 'Modelo digital superior.stl', meta: 'Documento · 3 jul', scan: 'Rechazado', tone: 'danger' as Tone, kind: 'cube' as const },
]

export const PATIENT_CONSENTS = [
  { name: 'Tratamiento dental general', meta: 'Plantilla v3 · firmado el 4 feb 2023', state: 'Firmado', tone: 'ok' as Tone, action: 'Ver PDF' },
  { name: 'Endodoncia', meta: 'Plantilla v2 · enviado el 14 sep 2026', state: 'Pendiente', tone: 'warn' as Tone, action: 'Recolectar firma' },
  { name: 'Ortodoncia', meta: 'Plantilla v2 · firmado el 12 mar 2025', state: 'Firmado', tone: 'ok' as Tone, action: 'Ver PDF' },
  { name: 'Aviso de privacidad', meta: 'Plantilla v5 · firmado el 18 ago 2026', state: 'Firmado', tone: 'ok' as Tone, action: 'Ver PDF' },
]

export const SIGNATURE_EVIDENCE = [
  { label: 'Documento', value: 'Ortodoncia v2' },
  { label: 'Firmado', value: '12 mar 2025, 11:42' },
  { label: 'Método', value: 'Firma en tableta' },
  { label: 'Testigo', value: 'Paola Nieto' },
]

export const FISCAL_FIELDS = [
  { label: 'RFC', value: 'MERL920312H45', hint: '13 caracteres para persona física' },
  { label: 'Razón social', value: 'LUCIA MENDOZA RIVAS', hint: 'Tal como aparece en la constancia' },
  { label: 'Código postal fiscal', value: '11550', hint: 'Domicilio fiscal registrado ante el SAT' },
  { label: 'Régimen fiscal', value: '605 · Sueldos y salarios', hint: 'Catálogo del SAT' },
  { label: 'Uso de CFDI', value: 'D01 · Honorarios médicos', hint: 'Deducible por gastos dentales' },
  { label: 'Correo de facturación', value: 'lucia.mendoza@correo.mx', hint: 'Ahí llegan el XML y el PDF' },
]

export const PATIENT_CFDI = [
  { label: 'A-2026-1284 · 16 sep', total: '$3,400.00' },
  { label: 'A-2026-1102 · 5 ago', total: '$3,400.00' },
  { label: 'A-2026-0987 · 4 jul', total: '$3,400.00' },
]

export const ODONTOGRAM_VERSIONS = [
  { label: 'v4 · borrador actual', date: 'hoy', tone: 'warn' as const },
  { label: 'v3 · bloqueada', date: '2 sep', tone: 'ok' as const },
  { label: 'v2 · bloqueada', date: '14 ago', tone: 'ok' as const },
]
