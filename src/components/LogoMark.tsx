import { Feather } from 'lucide-react'
import { cn } from '../lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('logo-mark', className)} aria-hidden="true">
      <Feather strokeWidth={1.7} />
    </span>
  )
}
