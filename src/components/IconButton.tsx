import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/utils'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  tip?: string
  tipPlacement?: 'top' | 'bottom'
  tone?: 'default' | 'danger'
  children: ReactNode
}

export function IconButton({
  label,
  tip = label,
  tipPlacement = 'bottom',
  tone = 'default',
  className,
  children,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      data-tip={tip}
      data-tip-placement={tipPlacement}
      className={cn('icon-button tip', tone === 'danger' && 'icon-button-danger', className)}
      {...props}
    >
      {children}
    </button>
  )
}
