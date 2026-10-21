import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import type { ToastOptions, ToastTone } from './toast-context'
import { ToastContext } from './toast-context'

interface ToastEntry extends ToastOptions {
  id: number
  tone: ToastTone
}

const TONE_ICONS = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
} as const

const MAX_TOASTS = 3

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const timers = useRef(new Map<number, number>())
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++
      const tone = options.tone ?? 'info'
      const duration = options.duration ?? (tone === 'error' ? 7000 : 4200)

      setToasts((current) => [...current, { ...options, id, tone }].slice(-MAX_TOASTS))

      const timer = window.setTimeout(() => {
        timers.current.delete(id)
        setToasts((current) => current.filter((item) => item.id !== id))
      }, duration)
      timers.current.set(id, timer)
    },
    [],
  )

  useEffect(() => {
    const activeTimers = timers.current
    return () => {
      activeTimers.forEach((timer) => window.clearTimeout(timer))
      activeTimers.clear()
    }
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-viewport" aria-label="Notifications">
          {toasts.map((item) => {
            const Icon = TONE_ICONS[item.tone]
            return (
              <div
                key={item.id}
                className="toast"
                data-tone={item.tone}
                role={item.tone === 'error' ? 'alert' : 'status'}
                aria-atomic="true"
              >
                <span className="toast-icon" aria-hidden="true">
                  <Icon size={16} strokeWidth={1.8} />
                </span>
                <div className="toast-copy">
                  <p className="toast-message">{item.message}</p>
                  {item.description ? (
                    <p className="toast-description">{item.description}</p>
                  ) : null}
                </div>
                {item.action ? (
                  <button
                    type="button"
                    className="toast-action"
                    onClick={() => {
                      dismiss(item.id)
                      item.action?.onClick()
                    }}
                  >
                    {item.action.label}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="toast-close"
                  onClick={() => dismiss(item.id)}
                  aria-label="Dismiss notification"
                >
                  <X size={14} strokeWidth={1.8} />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
