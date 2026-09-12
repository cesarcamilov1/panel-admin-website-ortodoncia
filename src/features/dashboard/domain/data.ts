import type { Kpi } from '../../../shared/ui/molecules/KpiCard'

export const DAY_KPIS: Kpi[] = [
  { label: 'Citas de hoy', value: '14', foot: '11 confirmadas · 3 sin confirmar' },
  { label: 'Cobrado hoy', value: '$18,450', foot: '7 movimientos' },
  { label: 'Por cobrar', value: '$6,200', foot: '4 pacientes con saldo vencido', tone: 'danger' },
  { label: 'Ocupación de la semana', value: '78%', foot: '9 huecos libres esta semana' },
]

export interface Alert {
  id: string
  title: string
  detail: string
  tone: 'warn' | 'info' | 'danger' | 'neutral'
  to: string
}

export const ALERTS: Alert[] = [
  {
    id: 'consents',
    title: '3 consentimientos sin firmar',
    detail: 'Endodoncia de Valeria Nolasco es para mañana.',
    tone: 'warn',
    to: '/consentimientos',
  },
  {
    id: 'cfdi',
    title: '5 pagos sin CFDI',
    detail: '3 pacientes no tienen datos fiscales cargados.',
    tone: 'info',
    to: '/facturacion',
  },
  {
    id: 'reminder',
    title: '1 recordatorio falló',
    detail: 'Emilia Cortés tiene un número inválido.',
    tone: 'danger',
    to: '/recordatorios',
  },
  {
    id: 'review',
    title: 'Reseña de 3 estrellas',
    detail: 'Óscar Belmont mencionó la espera en sala.',
    tone: 'neutral',
    to: '/resenas',
  },
]

export const CASH_BREAKDOWN = [
  { label: 'Efectivo', value: '$6,300.00' },
  { label: 'Tarjeta', value: '$8,750.00' },
  { label: 'Transferencia', value: '$3,400.00' },
]
