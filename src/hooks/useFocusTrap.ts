import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Focuses and traps keyboard navigation inside a modal-like container,
 * closes on Escape, and restores focus to the trigger on unmount.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean, onClose: () => void) {
  const containerRef = useRef<T>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!active) return

    const container = containerRef.current
    if (!container) return

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => {
          if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') {
            return false
          }
          const style = window.getComputedStyle(element)
          return style.display !== 'none' && style.visibility !== 'hidden'
        },
      )

    const animationFrame = window.requestAnimationFrame(() => {
      const target =
        container.querySelector<HTMLElement>('[data-autofocus]') ?? container
      target.focus({ preventScroll: true })
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = getFocusable()
      if (!focusable.length) {
        event.preventDefault()
        container.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey) {
        if (
          activeElement === first ||
          activeElement === container ||
          !container.contains(activeElement)
        ) {
          event.preventDefault()
          last.focus({ preventScroll: true })
        }
      } else if (
        activeElement === last ||
        activeElement === container ||
        !container.contains(activeElement)
      ) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow

      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true })
      } else {
        document.getElementById('main-content')?.focus({ preventScroll: true })
      }
    }
  }, [active])

  return containerRef
}
