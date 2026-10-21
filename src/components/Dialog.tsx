import type { ReactNode } from 'react'
import { useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { cn } from '../lib/utils'
import { IconButton } from './IconButton'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  icon?: ReactNode
  tone?: 'default' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  children?: ReactNode
  footer?: ReactNode
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  tone = 'default',
  size = 'md',
  children,
  footer,
}: DialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useFocusTrap<HTMLDivElement>(open, onClose)

  if (!open) return null

  return createPortal(
    <div className="dialog-layer">
      <div className="dialog-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn('dialog-panel panel', `dialog-${size}`)}
        data-tone={tone}
      >
        <div className="dialog-head">
          {icon ? (
            <span className="dialog-icon" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <div className="dialog-heading">
            <h2 id={titleId} className="dialog-title">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="dialog-description">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label="Close dialog" className="dialog-close" onClick={onClose}>
            <X size={17} strokeWidth={1.8} />
          </IconButton>
        </div>

        {children ? <div className="dialog-body scroll-area">{children}</div> : null}
        {footer ? <div className="dialog-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
