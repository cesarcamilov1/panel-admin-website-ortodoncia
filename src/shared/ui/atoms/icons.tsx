import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base(size: number, { size: _size, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  }
}

export type IconComponent = (props: IconProps) => React.ReactElement

export function ToothIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 5.5c-1.6-1.4-3.3-1.9-4.9-1.3C5 5 4.2 7.4 4.7 10.3c.4 2.3 1.2 4.6 2.2 6.7.6 1.2 1.2 2.5 2.2 2.5 1.1 0 1.3-1.6 1.6-3.2.2-1.3.6-2.4 1.3-2.4s1.1 1.1 1.3 2.4c.3 1.6.5 3.2 1.6 3.2 1 0 1.6-1.3 2.2-2.5 1-2.1 1.8-4.4 2.2-6.7.5-2.9-.3-5.3-2.4-6.1-1.6-.6-3.3-.1-4.9 1.3Z" />
    </svg>
  )
}

export function HomeIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M4 10.6 12 4.2l8 6.4" />
      <path d="M6.4 9.5V19.8h11.2V9.5" />
    </svg>
  )
}

export function CalendarIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="3" y="6" width="18" height="14" rx="1.6" />
      <path d="M3 10.5h18M8 3.5v4M16 3.5v4" />
    </svg>
  )
}

export function UsersIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M16 20v-1.6a4 4 0 0 0-4-4H7.5a4 4 0 0 0-4 4V20" />
      <circle cx="9.7" cy="7.4" r="3.2" />
      <path d="M17 5.4a3 3 0 0 1 0 5.7M21 20v-1.5a3.6 3.6 0 0 0-2.7-3.4" />
    </svg>
  )
}

export function BracesIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M4 9.5h16M4 15h16" />
      <path d="M7 9.5v5.5M12 9.5v5.5M17 9.5v5.5" />
    </svg>
  )
}

export function PrescriptionIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M7 4.4h5a3.4 3.4 0 0 1 0 6.8H7V4.4Z" />
      <path d="M7 11.2v8.4M11.6 11.2l6 8.4" />
    </svg>
  )
}

export function ShieldCheckIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 3.4 4.6 6.3v5c0 4.5 3.1 8.6 7.4 9.6 4.3-1 7.4-5.1 7.4-9.6v-5L12 3.4Z" />
      <path d="m8.9 11.9 2.2 2.2 4.2-4.5" />
    </svg>
  )
}

export function WalletIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M3.2 8.6A2.5 2.5 0 0 1 5.7 6.1H18a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2H5.7a2.5 2.5 0 0 1-2.5-2.5V8.6Z" />
      <path d="M16.2 12h2.4M3.4 9.4h13" />
    </svg>
  )
}

export function ReceiptIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M6.4 3.6h11.2v17l-2.3-1.5-2.2 1.1-1.1-1-1.1 1-2.2-1.1L6.4 20.6v-17Z" />
      <path d="M9.6 8.4h4.8M9.6 12.2h4.8" />
    </svg>
  )
}

export function GridIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M4.2 5.6h6v6h-6zM13.8 5.6h6v6h-6z" />
      <path d="M4.2 14.8h6v3.6h-6zM13.8 14.8h6v3.6h-6z" />
    </svg>
  )
}

export function ClockIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="7.8" />
      <path d="M12 7.9V12l2.7 1.7" />
    </svg>
  )
}

export function MessageIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M20 14.6a2 2 0 0 1-2 2H8.2L4 19.8V6.2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8.4Z" />
      <path d="M8 9.2h8M8 12.4h5" />
    </svg>
  )
}

export function StarIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="m12 4.6 2.3 4.8 5.3.8-3.8 3.7.9 5.3-4.7-2.5-4.7 2.5.9-5.3-3.8-3.7 5.3-.8L12 4.6Z" />
    </svg>
  )
}

export function ChartIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M4 19.8h16" />
      <path d="M7.2 19.8v-7.6M12 19.8V6.4M16.8 19.8v-5.2" />
    </svg>
  )
}

export function UserIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="8.1" r="4.1" />
      <path d="M4.6 20.4v-1a5 5 0 0 1 5-5h4.8a5 5 0 0 1 5 5v1" />
    </svg>
  )
}

export function SlidersIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M4 7.6h9.6M17.6 7.6H20M4 16.4h3.6M11.6 16.4H20" />
      <circle cx="15.6" cy="7.6" r="2" />
      <circle cx="9.6" cy="16.4" r="2" />
    </svg>
  )
}

export function SearchIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)} strokeWidth={props.strokeWidth ?? 1.7}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

export function BellIcon({ size = 17, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9Z" />
      <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
    </svg>
  )
}

export function PlusIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)} strokeWidth={props.strokeWidth ?? 2}>
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  )
}

export function CloseIcon({ size = 17, ...props }: IconProps) {
  return (
    <svg {...base(size, props)} strokeWidth={props.strokeWidth ?? 1.9}>
      <path d="M6.5 6.5 12 12l5.5 5.5M17.5 6.5 12 12l-5.5 5.5" />
    </svg>
  )
}

export function ChevronLeftIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)} strokeWidth={props.strokeWidth ?? 2}>
      <path d="m14 6-6 6 6 6" />
    </svg>
  )
}

export function ChevronRightIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)} strokeWidth={props.strokeWidth ?? 2}>
      <path d="m10 6 6 6-6 6" />
    </svg>
  )
}

export function ChevronDownIcon({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base(size, props)} strokeWidth={props.strokeWidth ?? 1.8}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function MoreIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)} strokeWidth={props.strokeWidth ?? 1.7}>
      <path d="M12 6.5v.01M12 12v.01M12 17.5v.01" />
    </svg>
  )
}

export function AlertIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.6M12 16v.01" />
    </svg>
  )
}

export function CheckCircleIcon({ size = 17, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.6 12.2 2.3 2.3 4.5-4.8" />
    </svg>
  )
}

export function LockIcon({ size = 17, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="4" y="10.5" width="16" height="10" rx="2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    </svg>
  )
}

export function UploadIcon({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base(size, props)} strokeWidth={props.strokeWidth ?? 1.9}>
      <path d="M12 18V6M7 10.5 12 5.5l5 5" />
      <path d="M4.5 19.5h15" />
    </svg>
  )
}

export function FileIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M14 3.4H7.4a1 1 0 0 0-1 1v15.2a1 1 0 0 0 1 1h9.2a1 1 0 0 0 1-1V7.2l-3.6-3.8Z" />
      <path d="M13.8 3.8v3.6h3.8" />
    </svg>
  )
}

export function XrayIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="6" y="3.6" width="12" height="16.8" rx="1.4" />
      <path d="M9.4 8.4h5.2M9.4 12.4h5.2M9.4 16h3" />
    </svg>
  )
}

export function PhotoIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M4 7.6h4l1.6-2h4.8l1.6 2H20v11.2H4V7.6Z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  )
}

export function CodeIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M9 8.4 5.4 12 9 15.6" />
      <path d="M15 8.4 18.6 12 15 15.6" />
    </svg>
  )
}

export function CubeIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="m12 3.6 8 4.6v7.6l-8 4.6-8-4.6V8.2l8-4.6Z" />
      <path d="m4 8.2 8 4.6 8-4.6M12 12.8v7.6" />
    </svg>
  )
}

export function PinIcon({ size = 17, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

export function DatabaseIcon({ size = 17, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M4 7.4c0-1.5 3.6-2.8 8-2.8s8 1.3 8 2.8-3.6 2.8-8 2.8-8-1.3-8-2.8Z" />
      <path d="M4 7.4v9.2c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8V7.4M4 12c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8" />
    </svg>
  )
}

export function CutleryIcon({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M6.5 3.5v7a2.5 2.5 0 0 0 5 0v-7" />
      <path d="M9 10.5V20.5M15.5 3.5c-1.2 1.4-1.5 3.4-1.5 5.2 0 1.4.6 2.3 1.5 2.3v9.5" />
    </svg>
  )
}

export function SunIcon({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 3.4v2.6M12 18v2.6M4.6 12h2.6M16.8 12h2.6M6.8 6.8l1.8 1.8M15.4 15.4l1.8 1.8M17.2 6.8l-1.8 1.8M8.6 15.4l-1.8 1.8" />
    </svg>
  )
}

export function WrenchIcon({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M14.5 4.5a4.5 4.5 0 0 0-6 5.9L4 15v4.5h4.5l4.6-4.6a4.5 4.5 0 0 0 5.9-6l-2.8 2.8-2.5-2.5 2.8-2.7Z" />
    </svg>
  )
}

export function RefundIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M9 7.5 4.5 12 9 16.5" />
      <path d="M4.5 12h11a4 4 0 0 1 0 8" />
    </svg>
  )
}

export function EyeIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  )
}
