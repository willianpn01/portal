import { cn } from '@/utils/cn'

export function Card({ className, children, style, ...props }) {
  return (
    <div
      className={cn('rounded-xl shadow-sm', className)}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', ...style }}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div className={cn('flex flex-col space-y-1 p-5 pb-3', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }) {
  return (
    <h3
      className={cn('text-sm font-semibold uppercase tracking-wider', className)}
      style={{ color: 'var(--text3)' }}
      {...props}
    >
      {children}
    </h3>
  )
}

export function CardContent({ className, children, ...props }) {
  return (
    <div className={cn('p-5 pt-0', className)} {...props}>
      {children}
    </div>
  )
}
