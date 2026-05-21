import { cn } from '@/utils/cn'

export function Progress({ value = 0, className, indicatorClassName, ...props }) {
  return (
    <div
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-gray-800', className)}
      {...props}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-500', indicatorClassName ?? 'bg-blue-500')}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
