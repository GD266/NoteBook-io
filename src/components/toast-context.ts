import { createContext } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  message: string
  description?: string
  tone?: ToastTone
  duration?: number
  action?: ToastAction
}

export interface ToastContextValue {
  toast: (options: ToastOptions) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
