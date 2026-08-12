import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  children: ReactNode
  className?: string
}

export default function StatCard({ label, children, className = '' }: StatCardProps) {
  return (
    <div className={`card p-5 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-subtle mb-3">
        {label}
      </p>
      {children}
    </div>
  )
}
