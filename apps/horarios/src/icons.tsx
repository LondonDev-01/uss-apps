// Lucide-style SVG icons
import { forwardRef, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const iconStyle = { display: 'block', flexShrink: 0 }

function createIcon(name: string, paths: React.ReactNode) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(
    ({ size = 24, className, style, ...props }, ref) => (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ ...iconStyle, ...style }}
        aria-hidden="true"
        {...props}
      >
        {paths}
      </svg>
    )
  )
  Icon.displayName = name
  return Icon
}

export const Calendar = createIcon('Calendar', [
  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />,
  <line x1="16" y1="2" x2="16" y2="6" />,
  <line x1="8" y1="2" x2="8" y2="6" />,
  <line x1="3" y1="10" x2="21" y2="10" />,
])

export const CalendarClock = createIcon('CalendarClock', [
  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />,
  <line x1="16" y1="2" x2="16" y2="6" />,
  <line x1="8" y1="2" x2="8" y2="6" />,
  <line x1="3" y1="10" x2="21" y2="10" />,
  <circle cx="16" cy="16" r="6" />,
  <path d="M16 12v4l2 2" />,
])

export const Bell = createIcon('Bell', [
  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />,
  <path d="M13.73 21a2 2 0 0 1-3.46 0" />,
])

export const Download = createIcon('Download', [
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />,
  <polyline points="7 10 12 15 17 10" />,
  <line x1="12" y1="15" x2="12" y2="3" />,
])

export const RotateCcw = createIcon('RotateCcw', [
  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />,
  <path d="M3 3v5h5" />,
])

export const ChevronRight = createIcon('ChevronRight', [
  <path d="M9 18l6-6-6-6" />,
])

export const ChevronLeft = createIcon('ChevronLeft', [
  <path d="M15 18l-6-6 6-6" />,
])

export const ChevronDown = createIcon('ChevronDown', [
  <path d="M6 9l6 6 6-6" />,
])

export const ChevronUp = createIcon('ChevronUp', [
  <path d="M18 15l-6-6-6 6" />,
])

export const Check = createIcon('Check', [
  <polyline points="20 6 9 17 4 12" />,
])

export const CheckCircle = createIcon('CheckCircle', [
  <circle cx="12" cy="12" r="10" />,
  <polyline points="20 6 9 17 4 12" />,
])

export const X = createIcon('X', [
  <line x1="18" y1="6" x2="6" y2="18" />,
  <line x1="6" y1="6" x2="18" y2="18" />,
])

export const Loader2 = createIcon('Loader2', [
  <path d="M21 12a9 9 0 1 1-6.219-8.56" />,
])

export const Plus = createIcon('Plus', [
  <line x1="12" y1="5" x2="12" y2="19" />,
  <line x1="5" y1="12" x2="19" y2="12" />,
])

export const Trash2 = createIcon('Trash2', [
  <polyline points="3 6 5 6 21 6" />,
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />,
])

export const FileText = createIcon('FileText', [
  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />,
  <polyline points="14 2 14 8 20 8" />,
  <line x1="16" y1="13" x2="8" y2="13" />,
  <line x1="16" y1="17" x2="8" y2="17" />,
  <line x1="10" y1="9" x2="8" y2="9" />,
])

export const FileCode = createIcon('FileCode', [
  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />,
  <polyline points="14 2 14 8 20 8" />,
  <path d="m10 12-2 2 2 2" />,
  <path d="m14 16-2-2 2-2" />,
])

export const FileSpreadsheet = createIcon('FileSpreadsheet', [
  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />,
  <polyline points="14 2 14 8 20 8" />,
  <line x1="8" y1="10" x2="16" y2="10" />,
  <line x1="8" y1="14" x2="16" y2="14" />,
  <line x1="10" y1="8" x2="10" y2="16" />,
  <line x1="14" y1="8" x2="14" y2="16" />,
])

export const Upload = createIcon('Upload', [
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />,
  <polyline points="17 8 12 3 7 8" />,
  <line x1="12" y1="3" x2="12" y2="15" />,
])

export const ArrowRight = createIcon('ArrowRight', [
  <line x1="5" y1="12" x2="19" y2="12" />,
  <polyline points="12 5 19 12 12 19" />,
])

export const AlertCircle = createIcon('AlertCircle', [
  <circle cx="12" cy="12" r="10" />,
  <line x1="12" y1="8" x2="12" y2="12" />,
  <line x1="12" y1="16" x2="12.01" y2="16" />,
])

export const AlertTriangle = createIcon('AlertTriangle', [
  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />,
  <line x1="12" y1="9" x2="12" y2="13" />,
  <line x1="12" y1="17" x2="12.01" y2="17" />,
])

export const Info = createIcon('Info', [
  <circle cx="12" cy="12" r="10" />,
  <line x1="12" y1="16" x2="12" y2="12" />,
  <line x1="12" y1="8" x2="12.01" y2="8" />,
])

export const Target = createIcon('Target', [
  <circle cx="12" cy="12" r="10" />,
  <circle cx="12" cy="12" r="6" />,
  <circle cx="12" cy="12" r="2" />,
])

export const Flag = createIcon('Flag', [
  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />,
  <line x1="4" y1="22" x2="4" y2="15" />,
])

export const Star = createIcon('Star', [
  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
])

export const Sun = createIcon('Sun', [
  <circle cx="12" cy="12" r="5" />,
  <line x1="12" y1="1" x2="12" y2="3" />,
  <line x1="12" y1="21" x2="12" y2="23" />,
  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />,
  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />,
  <line x1="1" y1="12" x2="3" y2="12" />,
  <line x1="21" y1="12" x2="23" y2="12" />,
])

export const Moon = createIcon('Moon', [
  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
])

export const Zap = createIcon('Zap', [
  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
])

export const Sparkles = createIcon('Sparkles', [
  <path d="M12 3v1m0 16v1m9-9h-1m4 0h1m-15-1h1m-4 0h1m7-8v1m-8 0v1" />,
  <path d="M17 5 20 2" />,
  <path d="M17 19 20 22" />,
  <path d="M4 16 7 13" />,
  <path d="M4 8 7 11" />,
])

export const Layers = createIcon('Layers', [
  <polygon points="12 2 2 7 12 12 22 7 12 2" />,
  <polyline points="2 17 12 22 22 17" />,
  <polyline points="2 12 12 17 22 12" />,
])

export const HelpCircle = createIcon('HelpCircle', [
  <circle cx="12" cy="12" r="10" />,
  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />,
  <line x1="12" y1="17" x2="12.01" y2="17" />,
])

export const Eye = createIcon('Eye', [
  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />,
  <circle cx="12" cy="12" r="3" />,
])

export const EyeOff = createIcon('EyeOff', [
  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />,
  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />,
  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12c0 7 3 10 10 10a9.74 9.74 0 0 0 5.39-1.61" />,
  <line x1="2" y1="2" x2="22" y2="22" />,
])

export const Settings = createIcon('Settings', [
  <circle cx="12" cy="12" r="3" />,
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />,
])

export const Search = createIcon('Search', [
  <circle cx="11" cy="11" r="8" />,
  <line x1="21" y1="21" x2="16.65" y2="16.65" />,
])

export const ClipboardList = createIcon('ClipboardList', [
  <rect x="9" y="9" width="12" height="12" rx="2" ry="2" />,
  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />,
  <line x1="9" y1="14" x2="17" y2="14" />,
  <line x1="9" y1="18" x2="17" y2="18" />,
  <line x1="9" y1="10" x2="17" y2="10" />,
])

export const Clock = createIcon('Clock', [
  <circle cx="12" cy="12" r="10" />,
  <polyline points="12 6 12 12 16 14" />,
])

export const Palette = createIcon('Palette', [
  <circle cx="13.5" cy="6.5" r="1.5" fill="currentColor" />,
  <circle cx="17.5" cy="10.5" r="1.5" fill="currentColor" />,
  <circle cx="8.5" cy="7.5" r="1.5" fill="currentColor" />,
  <circle cx="6.5" cy="12.5" r="1.5" fill="currentColor" />,
  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />,
])