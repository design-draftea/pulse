import './LiveIndicator.css'

interface LiveIndicatorProps {
  className?: string
}

export function LiveIndicator({ className = '' }: LiveIndicatorProps) {
  return (
    <span
      className={`live-indicator${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    />
  )
}
