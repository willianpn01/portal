import { cn } from '@/utils/cn'

const variants = {
  default:   'bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700',
  outline:   'border border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800 hover:text-gray-100',
  ghost:     'bg-transparent text-gray-400 hover:bg-gray-800 hover:text-gray-100',
  destructive: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700',
}

const sizes = {
  default: 'h-9 px-4 py-2 text-sm',
  sm:      'h-7 px-3 text-xs',
  lg:      'h-11 px-6 text-base',
  icon:    'h-9 w-9',
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  disabled,
  children,
  ...props
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant] ?? variants.default,
        sizes[size] ?? sizes.default,
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
