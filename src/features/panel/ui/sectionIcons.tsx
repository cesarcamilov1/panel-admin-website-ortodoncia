import {
  BracesIcon,
  CalendarIcon,
  ChartIcon,
  ClockIcon,
  GridIcon,
  HomeIcon,
  MessageIcon,
  PinIcon,
  PrescriptionIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  SlidersIcon,
  StarIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from '../../../shared/ui/atoms/icons'
import type { NavItem } from '../domain/navigation'

type IconFor = Record<NavItem['id'], (props: { size?: number }) => React.ReactElement>

export const SECTION_ICONS: IconFor = {
  inicio: HomeIcon,
  agenda: CalendarIcon,
  pacientes: UsersIcon,
  ortodoncia: BracesIcon,
  recetas: PrescriptionIcon,
  consentimientos: ShieldCheckIcon,
  pagos: WalletIcon,
  facturacion: ReceiptIcon,
  servicios: GridIcon,
  sedes: PinIcon,
  horarios: ClockIcon,
  recordatorios: MessageIcon,
  resenas: StarIcon,
  reportes: ChartIcon,
  cuenta: UserIcon,
  ajustes: SlidersIcon,
}
