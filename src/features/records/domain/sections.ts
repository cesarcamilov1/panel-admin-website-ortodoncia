import type { Tone } from '../../../shared/ui/atoms/Badge'
import type { Kpi } from '../../../shared/ui/molecules/KpiCard'

export interface RecordColumn {
  label: string
  width?: string
  grow?: number
  align?: 'left' | 'right'
}

export interface RecordCell {
  text: string
  sub?: string
  /** When set the cell renders as a badge instead of text. */
  badge?: Tone
  strong?: boolean
  muted?: boolean
  emphasis?: 'ok' | 'warn' | 'danger'
}

export interface RecordRow {
  id: string
  cells: RecordCell[]
}

export interface RecordSection {
  action: string
  altAction?: string
  filters: string[]
  footer: string
  kpis?: Kpi[]
  columns: RecordColumn[]
  rows: RecordRow[]
}

export type RecordSectionId =
  | 'recetas'
  | 'consentimientos'
  | 'pagos'
  | 'facturacion'
  | 'recordatorios'
  | 'resenas'
  | 'ortodoncia'
  | 'reportes'

const t = (text: string, extra: Omit<RecordCell, 'text'> = {}): RecordCell => ({ text, ...extra })

export const RECORD_SECTIONS: Record<RecordSectionId, RecordSection> = {
  recetas: {
    action: 'Nueva receta',
    altAction: 'Vademécum',
    filters: ['Todas', 'Emitidas hoy', 'Sin firmar', 'Mis recetas'],
    footer: '6 de 214 recetas',
    columns: [
      { label: 'Folio', grow: 1 },
      { label: 'Medicamentos', grow: 1 },
      { label: 'Emitida', width: '112px' },
      { label: 'Profesional', width: '168px' },
      { label: 'Estado', width: '104px' },
    ],
    rows: [
      {
        id: 'RX-2026-0412',
        cells: [
          t('RX-2026-0412', { strong: true, sub: 'Lucía Mendoza Rivas' }),
          t('Clindamicina 300 mg', { sub: 'Ibuprofeno 400 mg' }),
          t('16 sep 2026', { muted: true }),
          t('Dra. M. Cázares', { muted: true }),
          t('Firmada', { badge: 'ok' }),
        ],
      },
      {
        id: 'RX-2026-0411',
        cells: [
          t('RX-2026-0411', { strong: true, sub: 'Jorge Lira Peña' }),
          t('Amoxicilina 500 mg', { sub: 'Paracetamol 500 mg' }),
          t('16 sep 2026', { muted: true }),
          t('Dr. I. Robledo', { muted: true }),
          t('Firmada', { badge: 'ok' }),
        ],
      },
      {
        id: 'RX-2026-0410',
        cells: [
          t('RX-2026-0410', { strong: true, sub: 'Renata Vidal Cobos' }),
          t('Ketorolaco 10 mg'),
          t('15 sep 2026', { muted: true }),
          t('Dra. M. Cázares', { muted: true }),
          t('Borrador', { badge: 'warn' }),
        ],
      },
      {
        id: 'RX-2026-0409',
        cells: [
          t('RX-2026-0409', { strong: true, sub: 'Camila Bravo Ortiz' }),
          t('Clorhexidina 0.12%', { sub: 'Enjuague, 7 días' }),
          t('15 sep 2026', { muted: true }),
          t('Dra. M. Cázares', { muted: true }),
          t('Firmada', { badge: 'ok' }),
        ],
      },
      {
        id: 'RX-2026-0408',
        cells: [
          t('RX-2026-0408', { strong: true, sub: 'Hugo Farías Lugo' }),
          t('Naproxeno 550 mg'),
          t('14 sep 2026', { muted: true }),
          t('Dr. I. Robledo', { muted: true }),
          t('Firmada', { badge: 'ok' }),
        ],
      },
      {
        id: 'RX-2026-0407',
        cells: [
          t('RX-2026-0407', { strong: true, sub: 'Sofía Aguirre Nava' }),
          t('Nitrato de potasio', { sub: 'Pasta desensibilizante' }),
          t('12 sep 2026', { muted: true }),
          t('Dra. M. Cázares', { muted: true }),
          t('Firmada', { badge: 'ok' }),
        ],
      },
    ],
  },

  consentimientos: {
    action: 'Nueva plantilla',
    altAction: 'Ver firmados',
    filters: ['Plantillas', 'Firmados', 'Pendientes', 'Revocados'],
    footer: '6 plantillas · 1,042 consentimientos firmados',
    columns: [
      { label: 'Plantilla', grow: 2 },
      { label: 'Versión vigente', width: '132px' },
      { label: 'Actualizada', width: '116px' },
      { label: 'Firmados', width: '104px', align: 'right' },
      { label: 'Pendientes', width: '112px', align: 'right' },
      { label: 'Estado', width: '112px' },
    ],
    rows: [
      {
        id: 'general',
        cells: [
          t('Tratamiento dental general', { strong: true, sub: 'Aplica a todos los servicios clínicos' }),
          t('v3'),
          t('2 jul 2026', { muted: true }),
          t('864', { strong: true }),
          t('2', { strong: true, emphasis: 'warn' }),
          t('Vigente', { badge: 'ok' }),
        ],
      },
      {
        id: 'endodoncia',
        cells: [
          t('Endodoncia', { strong: true, sub: 'Riesgos de fractura y retratamiento' }),
          t('v2'),
          t('14 abr 2026', { muted: true }),
          t('96', { strong: true }),
          t('1', { strong: true, emphasis: 'warn' }),
          t('Vigente', { badge: 'ok' }),
        ],
      },
      {
        id: 'extraccion',
        cells: [
          t('Extracción quirúrgica', { strong: true, sub: 'Incluye terceros molares' }),
          t('v4'),
          t('30 may 2026', { muted: true }),
          t('143', { strong: true }),
          t('0', { muted: true }),
          t('Vigente', { badge: 'ok' }),
        ],
      },
      {
        id: 'ortodoncia',
        cells: [
          t('Ortodoncia', { strong: true, sub: 'Duración estimada y compromiso de citas' }),
          t('v2'),
          t('9 ene 2026', { muted: true }),
          t('58', { strong: true }),
          t('0', { muted: true }),
          t('Vigente', { badge: 'ok' }),
        ],
      },
      {
        id: 'blanqueamiento',
        cells: [
          t('Blanqueamiento', { strong: true, sub: 'Sensibilidad posoperatoria' }),
          t('v1'),
          t('22 nov 2025', { muted: true }),
          t('34', { strong: true }),
          t('0', { muted: true }),
          t('Por revisar', { badge: 'warn' }),
        ],
      },
      {
        id: 'privacidad',
        cells: [
          t('Aviso de privacidad', { strong: true, sub: 'Tratamiento de datos personales' }),
          t('v5'),
          t('18 ago 2026', { muted: true }),
          t('1,284', { strong: true }),
          t('0', { muted: true }),
          t('Vigente', { badge: 'ok' }),
        ],
      },
    ],
  },

  pagos: {
    action: 'Registrar cobro',
    altAction: 'Cerrar caja',
    filters: ['Hoy', 'Esta semana', 'Reembolsos', 'Sin aplicar'],
    footer: '7 movimientos el 16 de septiembre',
    kpis: [
      { label: 'Efectivo', value: '$6,300', foot: '2 movimientos' },
      { label: 'Tarjeta', value: '$8,750', foot: '3 movimientos' },
      { label: 'Transferencia', value: '$3,400', foot: '1 movimiento' },
      { label: 'Total del día', value: '$18,450', foot: 'Menos $1,450 reembolsados', tone: 'accent' },
    ],
    columns: [
      { label: 'Recibo', width: '128px' },
      { label: 'Paciente', grow: 1 },
      { label: 'Método', width: '136px' },
      { label: 'Aplicado a', grow: 1 },
      { label: 'Importe', width: '116px', align: 'right' },
      { label: 'Estado', width: '120px' },
    ],
    rows: [
      {
        id: 'REC-4821',
        cells: [
          t('REC-4821', { strong: true }),
          t('Lucía Mendoza Rivas'),
          t('Tarjeta', { muted: true }),
          t('Ortodoncia · mensualidad', { muted: true }),
          t('$3,400.00', { strong: true }),
          t('Recibido', { badge: 'ok' }),
        ],
      },
      {
        id: 'REC-4820',
        cells: [
          t('REC-4820', { strong: true }),
          t('Tomás Iriarte Rangel'),
          t('Efectivo', { muted: true }),
          t('Limpieza dental', { muted: true }),
          t('$850.00', { strong: true }),
          t('Recibido', { badge: 'ok' }),
        ],
      },
      {
        id: 'REC-4819',
        cells: [
          t('REC-4819', { strong: true }),
          t('Renata Vidal Cobos'),
          t('Transferencia', { muted: true }),
          t('Plan 2026-031 · anticipo', { muted: true }),
          t('$3,400.00', { strong: true }),
          t('Recibido', { badge: 'ok' }),
        ],
      },
      {
        id: 'REC-4818',
        cells: [
          t('REC-4818', { strong: true }),
          t('Ana Belén Ruiz Toledo'),
          t('Tarjeta', { muted: true }),
          t('Resina 26', { muted: true }),
          t('$1,450.00', { strong: true }),
          t('Recibido', { badge: 'ok' }),
        ],
      },
      {
        id: 'REC-4817',
        cells: [
          t('REC-4817', { strong: true }),
          t('Jorge Lira Peña'),
          t('Tarjeta', { muted: true }),
          t('Endodoncia 36', { muted: true }),
          t('$3,900.00', { strong: true }),
          t('Recibido', { badge: 'ok' }),
        ],
      },
      {
        id: 'REM-0142',
        cells: [
          t('REM-0142', { strong: true, emphasis: 'danger' }),
          t('Camila Bravo Ortiz'),
          t('Tarjeta', { muted: true }),
          t('Cobro duplicado', { muted: true }),
          t('-$1,450.00', { strong: true, emphasis: 'danger' }),
          t('Reembolsado', { badge: 'danger' }),
        ],
      },
      {
        id: 'REC-4816',
        cells: [
          t('REC-4816', { strong: true }),
          t('Sofía Aguirre Nava'),
          t('Efectivo', { muted: true }),
          t('Blanqueamiento', { muted: true }),
          t('$5,450.00', { strong: true }),
          t('Recibido', { badge: 'ok' }),
        ],
      },
    ],
  },

  facturacion: {
    action: 'Nuevo CFDI',
    altAction: 'Descargar del mes',
    filters: ['Todos', 'Por timbrar', 'Timbrados', 'Cancelados'],
    footer: '7 de 128 comprobantes emitidos en septiembre',
    kpis: [
      { label: 'Timbrados en septiembre', value: '128', foot: 'Último hace 14 minutos' },
      { label: 'Monto facturado', value: '$412,300', foot: 'IVA incluido' },
      { label: 'Pagos sin CFDI', value: '5', foot: '3 sin datos fiscales', tone: 'warn' },
      { label: 'Cancelados', value: '2', foot: '1 con acuse pendiente', tone: 'danger' },
    ],
    columns: [
      { label: 'Folio fiscal', grow: 1 },
      { label: 'Receptor', grow: 1 },
      { label: 'RFC', width: '132px' },
      { label: 'Uso', width: '80px' },
      { label: 'Total', width: '112px', align: 'right' },
      { label: 'Estado', width: '120px' },
    ],
    rows: [
      {
        id: 'A-2026-1284',
        cells: [
          t('A-2026-1284', { strong: true, sub: '16 sep 2026 · 12:41' }),
          t('Lucía Mendoza Rivas'),
          t('MERL920312H45', { muted: true }),
          t('D01', { muted: true }),
          t('$3,400.00', { strong: true }),
          t('Timbrado', { badge: 'ok' }),
        ],
      },
      {
        id: 'A-2026-1283',
        cells: [
          t('A-2026-1283', { strong: true, sub: '16 sep 2026 · 11:02' }),
          t('Grupo Salud Aurora SA de CV'),
          t('GSA180422KM3', { muted: true }),
          t('G03', { muted: true }),
          t('$18,900.00', { strong: true }),
          t('Timbrado', { badge: 'ok' }),
        ],
      },
      {
        id: 'A-2026-1282',
        cells: [
          t('A-2026-1282', { strong: true, sub: '15 sep 2026 · 18:20' }),
          t('Jorge Lira Peña'),
          t('LIPJ880714R21', { muted: true }),
          t('D01', { muted: true }),
          t('$3,900.00', { strong: true }),
          t('Sustituido', { badge: 'info' }),
        ],
      },
      {
        id: 'A-2026-1281',
        cells: [
          t('A-2026-1281', { strong: true, sub: '15 sep 2026 · 17:55' }),
          t('Camila Bravo Ortiz'),
          t('BAOC950228T18', { muted: true }),
          t('D01', { muted: true }),
          t('$1,450.00', { strong: true }),
          t('Cancelado', { badge: 'danger' }),
        ],
      },
      {
        id: 'pendiente-1',
        cells: [
          t('Pago sin CFDI', { strong: true, emphasis: 'warn', sub: '15 sep 2026 · 16:10' }),
          t('Tomás Iriarte Rangel'),
          t('Sin datos fiscales', { muted: true }),
          t('—', { muted: true }),
          t('$850.00', { strong: true }),
          t('Por timbrar', { badge: 'warn' }),
        ],
      },
      {
        id: 'A-2026-1280',
        cells: [
          t('A-2026-1280', { strong: true, sub: '14 sep 2026 · 13:33' }),
          t('Sofía Aguirre Nava'),
          t('AUNS900105F72', { muted: true }),
          t('D01', { muted: true }),
          t('$4,200.00', { strong: true }),
          t('Timbrado', { badge: 'ok' }),
        ],
      },
      {
        id: 'A-2026-1279',
        cells: [
          t('A-2026-1279', { strong: true, sub: '14 sep 2026 · 10:07' }),
          t('Martín Ochoa Sandoval'),
          t('OOSM870930L09', { muted: true }),
          t('D01', { muted: true }),
          t('$1,200.00', { strong: true }),
          t('Timbrado', { badge: 'ok' }),
        ],
      },
    ],
  },

  recordatorios: {
    action: 'Nueva regla',
    altAction: 'Ver plantillas',
    filters: ['Bitácora', 'Reglas activas', 'Fallidos', 'Hoy'],
    footer: '7 de 342 envíos en los últimos 7 días',
    columns: [
      { label: 'Paciente', grow: 1 },
      { label: 'Canal', width: '104px' },
      { label: 'Tipo', width: '148px' },
      { label: 'Programado', width: '144px' },
      { label: 'Respuesta', width: '128px' },
      { label: 'Estado', width: '116px' },
    ],
    rows: [
      {
        id: 'rem-1',
        cells: [
          t('Renata Vidal Cobos', { strong: true, sub: 'Resina 14 · mié 17, 11:00' }),
          t('WhatsApp'),
          t('24 horas antes', { muted: true }),
          t('16 sep · 11:00', { muted: true }),
          t('Confirmó', { strong: true, emphasis: 'ok' }),
          t('Leído', { badge: 'ok' }),
        ],
      },
      {
        id: 'rem-2',
        cells: [
          t('Pablo Duarte Gil', { strong: true, sub: 'Revisión · mar 16, 12:30' }),
          t('WhatsApp'),
          t('Mismo día', { muted: true }),
          t('16 sep · 08:00', { muted: true }),
          t('Sin respuesta', { muted: true }),
          t('Entregado', { badge: 'info' }),
        ],
      },
      {
        id: 'rem-3',
        cells: [
          t('Valeria Nolasco Pérez', { strong: true, sub: 'Endodoncia 46 · mié 17, 15:00' }),
          t('SMS'),
          t('24 horas antes', { muted: true }),
          t('16 sep · 15:00', { muted: true }),
          t('—', { muted: true }),
          t('En cola', { badge: 'neutral' }),
        ],
      },
      {
        id: 'rem-4',
        cells: [
          t('Emilia Cortés Ibarra', { strong: true, sub: 'Ortodoncia · lun 15, 16:00' }),
          t('WhatsApp'),
          t('Confirmación', { muted: true }),
          t('14 sep · 09:12', { muted: true }),
          t('Número inválido', { strong: true, emphasis: 'danger' }),
          t('Falló', { badge: 'danger' }),
        ],
      },
      {
        id: 'rem-5',
        cells: [
          t('Fernanda Sosa Lira', { strong: true, sub: 'Corona 16 · jue 18, 10:00' }),
          t('Correo'),
          t('24 horas antes', { muted: true }),
          t('17 sep · 10:00', { muted: true }),
          t('—', { muted: true }),
          t('Programado', { badge: 'neutral' }),
        ],
      },
      {
        id: 'rem-6',
        cells: [
          t('Bruno Casal Aranda', { strong: true, sub: 'Limpieza · jue 18, 12:00' }),
          t('WhatsApp'),
          t('Confirmación', { muted: true }),
          t('13 sep · 19:40', { muted: true }),
          t('Pidió cambio', { strong: true, emphasis: 'warn' }),
          t('Leído', { badge: 'ok' }),
        ],
      },
      {
        id: 'rem-7',
        cells: [
          t('Nadia Quintero Blas', { strong: true, sub: 'Limpieza · sáb 20, 09:30' }),
          t('WhatsApp'),
          t('Confirmación', { muted: true }),
          t('13 sep · 12:05', { muted: true }),
          t('Confirmó', { strong: true, emphasis: 'ok' }),
          t('Entregado', { badge: 'info' }),
        ],
      },
    ],
  },

  resenas: {
    action: 'Invitar a reseñar',
    altAction: 'Configurar invitaciones',
    filters: ['Todas', 'Sin responder', '5 estrellas', 'Menos de 4'],
    footer: '6 de 214 reseñas publicadas',
    kpis: [
      { label: 'Promedio', value: '4.8', foot: 'Sobre 214 reseñas' },
      { label: 'Reseñas del mes', value: '32', foot: '+9 contra agosto' },
      { label: 'Invitaciones enviadas', value: '96', foot: '33% de respuesta' },
      { label: 'Sin responder', value: '4', foot: '1 con menos de 4 estrellas', tone: 'warn' },
    ],
    columns: [
      { label: 'Paciente', grow: 1 },
      { label: 'Calificación', width: '112px' },
      { label: 'Comentario', grow: 2 },
      { label: 'Fecha', width: '112px' },
      { label: 'Estado', width: '148px' },
    ],
    rows: [
      {
        id: 'rev-1',
        cells: [
          t('Rodrigo Salas Vega', { strong: true, sub: 'Limpieza dental' }),
          t('5.0', { strong: true, emphasis: 'warn' }),
          t('Puntualísima y explicó todo el procedimiento.'),
          t('15 sep 2026', { muted: true }),
          t('Respondida', { badge: 'ok' }),
        ],
      },
      {
        id: 'rev-2',
        cells: [
          t('Ana Belén Ruiz Toledo', { strong: true, sub: 'Resina 26' }),
          t('5.0', { strong: true, emphasis: 'warn' }),
          t('Cero dolor y el color quedó idéntico.'),
          t('15 sep 2026', { muted: true }),
          t('Sin responder', { badge: 'warn' }),
        ],
      },
      {
        id: 'rev-3',
        cells: [
          t('Jorge Lira Peña', { strong: true, sub: 'Endodoncia 36' }),
          t('4.0', { strong: true, emphasis: 'warn' }),
          t('Buen trabajo, aunque esperé 20 minutos.'),
          t('14 sep 2026', { muted: true }),
          t('Sin responder', { badge: 'warn' }),
        ],
      },
      {
        id: 'rev-4',
        cells: [
          t('Camila Bravo Ortiz', { strong: true, sub: 'Resina 37' }),
          t('5.0', { strong: true, emphasis: 'warn' }),
          t('Me explicaron el presupuesto antes de empezar.'),
          t('12 sep 2026', { muted: true }),
          t('Respondida', { badge: 'ok' }),
        ],
      },
      {
        id: 'rev-5',
        cells: [
          t('Óscar Belmont Cano', { strong: true, sub: 'Limpieza dental' }),
          t('3.0', { strong: true, emphasis: 'danger' }),
          t('El consultorio estaba muy frío ese día.'),
          t('10 sep 2026', { muted: true }),
          t('Requiere atención', { badge: 'danger' }),
        ],
      },
      {
        id: 'rev-6',
        cells: [
          t('Sofía Aguirre Nava', { strong: true, sub: 'Blanqueamiento' }),
          t('5.0', { strong: true, emphasis: 'warn' }),
          t('Resultado mejor de lo que esperaba.'),
          t('8 sep 2026', { muted: true }),
          t('Respondida', { badge: 'ok' }),
        ],
      },
    ],
  },

  ortodoncia: {
    action: 'Nuevo caso',
    altAction: 'Plantillas de fase',
    filters: ['Activos', 'En retención', 'Por iniciar', 'Todos'],
    footer: '6 de 58 casos activos',
    columns: [
      { label: 'Paciente', grow: 1 },
      { label: 'Aparatología', width: '176px' },
      { label: 'Fase', width: '128px' },
      { label: 'Mes', width: '80px' },
      { label: 'Próximo ajuste', width: '140px' },
      { label: 'Saldo', width: '108px', align: 'right' },
    ],
    rows: [
      {
        id: 'ORT-2025-041',
        cells: [
          t('Lucía Mendoza Rivas', { strong: true, sub: 'Caso ORT-2025-041' }),
          t('Brackets metálicos'),
          t('Activo', { badge: 'info' }),
          t('14 / 24', { muted: true }),
          t('jue 18 sep'),
          t('$3,400.00', { strong: true, emphasis: 'danger' }),
        ],
      },
      {
        id: 'ORT-2025-052',
        cells: [
          t('Emilia Cortés Ibarra', { strong: true, sub: 'Caso ORT-2025-052' }),
          t('Alineadores'),
          t('Activo', { badge: 'info' }),
          t('9 / 18', { muted: true }),
          t('lun 22 sep'),
          t('$0.00', { muted: true }),
        ],
      },
      {
        id: 'ORT-2024-118',
        cells: [
          t('Iker Zamudio Prado', { strong: true, sub: 'Caso ORT-2024-118' }),
          t('Brackets estéticos'),
          t('Retención', { badge: 'ok' }),
          t('26 / 26', { muted: true }),
          t('mié 8 oct'),
          t('$0.00', { muted: true }),
        ],
      },
      {
        id: 'ORT-2026-007',
        cells: [
          t('Leo Pastrana Mota', { strong: true, sub: 'Caso ORT-2026-007' }),
          t('Brackets metálicos'),
          t('Activo', { badge: 'info' }),
          t('3 / 22', { muted: true }),
          t('sáb 20 sep'),
          t('$850.00', { strong: true, emphasis: 'warn' }),
        ],
      },
      {
        id: 'ORT-2026-011',
        cells: [
          t('Paula Iglesias Rueda', { strong: true, sub: 'Caso ORT-2026-011' }),
          t('Alineadores'),
          t('Por iniciar', { badge: 'warn' }),
          t('0 / 20', { muted: true }),
          t('Sin agendar', { muted: true }),
          t('$12,500.00', { strong: true, emphasis: 'danger' }),
        ],
      },
      {
        id: 'ORT-2025-089',
        cells: [
          t('Diego Arriaga Nolasco', { strong: true, sub: 'Caso ORT-2025-089' }),
          t('Brackets autoligado'),
          t('Activo', { badge: 'info' }),
          t('7 / 20', { muted: true }),
          t('vie 26 sep'),
          t('$0.00', { muted: true }),
        ],
      },
    ],
  },

  reportes: {
    action: 'Exportar',
    altAction: 'Programar envío',
    filters: ['Este mes', 'Trimestre', 'Año', 'Comparar sedes'],
    footer: 'Septiembre 2026 · datos al día de hoy',
    kpis: [
      { label: 'Producción del mes', value: '$412,300', foot: 'Meta $480,000' },
      { label: 'Ocupación de agenda', value: '78%', foot: 'Sobre 312 horas hábiles' },
      { label: 'No-show', value: '6.4%', foot: '18 citas perdidas', tone: 'warn' },
      { label: 'Pacientes nuevos', value: '43', foot: '28 por reserva en línea' },
    ],
    columns: [
      { label: 'Reporte', grow: 1 },
      { label: 'Periodo', width: '144px' },
      { label: 'Valor', width: '144px', align: 'right' },
      { label: 'Contra el mes previo', width: '188px', align: 'right' },
    ],
    rows: [
      {
        id: 'produccion',
        cells: [
          t('Producción por servicio', { strong: true, sub: 'Ortodoncia concentra el 34%' }),
          t('1 – 16 sep', { muted: true }),
          t('$412,300', { strong: true }),
          t('+8.4%', { strong: true, emphasis: 'ok' }),
        ],
      },
      {
        id: 'ocupacion',
        cells: [
          t('Ocupación de agenda', { strong: true, sub: 'Horas ocupadas sobre horas disponibles' }),
          t('1 – 16 sep', { muted: true }),
          t('78%', { strong: true }),
          t('+3 puntos', { strong: true, emphasis: 'ok' }),
        ],
      },
      {
        id: 'cancelaciones',
        cells: [
          t('Cancelaciones y no-show', { strong: true, sub: 'Sobre citas agendadas' }),
          t('1 – 16 sep', { muted: true }),
          t('6.4%', { strong: true }),
          t('+1.2 puntos', { strong: true, emphasis: 'danger' }),
        ],
      },
      {
        id: 'cobranza',
        cells: [
          t('Cobranza', { strong: true, sub: 'Saldo vencido a más de 30 días' }),
          t('Al 16 sep', { muted: true }),
          t('$86,400', { strong: true }),
          t('-4.1%', { strong: true, emphasis: 'ok' }),
        ],
      },
      {
        id: 'nuevos',
        cells: [
          t('Pacientes nuevos', { strong: true, sub: '28 llegaron por reserva en línea' }),
          t('1 – 16 sep', { muted: true }),
          t('43', { strong: true }),
          t('+11', { strong: true, emphasis: 'ok' }),
        ],
      },
      {
        id: 'ticket',
        cells: [
          t('Ticket promedio', { strong: true, sub: 'Por cita completada' }),
          t('1 – 16 sep', { muted: true }),
          t('$1,840', { strong: true }),
          t('-2.0%', { strong: true, emphasis: 'danger' }),
        ],
      },
    ],
  },
}
