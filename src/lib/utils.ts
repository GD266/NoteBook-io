import type { Note } from '../types'
import { htmlToPlainText } from './text'

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function noteTitle(note: Note | null | undefined): string {
  return note?.title.trim() || 'Untitled note'
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  if (!Number.isFinite(timestamp)) return 'Unknown'

  const diff = Math.max(0, now - timestamp)
  if (diff < 45_000) return 'Just now'

  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`

  const date = new Date(timestamp)
  const currentYear = new Date(now).getFullYear()
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== currentYear ? { year: 'numeric' } : {}),
  }).format(date)
}

export function formatFullTimestamp(timestamp: number | null): string {
  if (!timestamp) return 'Not saved yet'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value)
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024) return `${bytes} B`

  const kilobytes = bytes / 1024
  if (kilobytes < 1024) return `${kilobytes < 10 ? kilobytes.toFixed(1) : Math.round(kilobytes)} KB`
  return `${(kilobytes / 1024).toFixed(1)} MB`
}

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export interface ShortcutParts {
  alt?: boolean
  shift?: boolean
}

export function formatShortcut(key: string, { alt = false, shift = false }: ShortcutParts = {}): string {
  const mac = isMacPlatform()
  if (mac) {
    return `${shift ? '⇧' : ''}${alt ? '⌥' : ''}⌘${key}`
  }

  const parts = ['Ctrl']
  if (alt) parts.push('Alt')
  if (shift) parts.push('Shift')
  parts.push(key)
  return parts.join(' + ')
}

function safeFilename(title: string): string {
  const base = title
    .replace(/[\p{Cc}<>:"/\\|?*]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 80)

  return base || 'Untitled note'
}

/** Downloads the note's plain text. Returns the filename used. */
export function downloadNoteAsText(note: Note): string {
  const text = htmlToPlainText(note.content, { listMarkers: true })
  const base = safeFilename(note.title.trim() || 'Untitled note')
  const filename = /\.txt$/i.test(base) ? base : `${base}.txt`
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  // Leave the blob alive long enough for slower browsers to finish the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return filename
}

function legacyCopy(text: string): boolean {
  const previouslyFocused = document.activeElement as HTMLElement | null
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;'
  document.body.appendChild(textarea)
  textarea.select()

  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }

  textarea.remove()
  previouslyFocused?.focus({ preventScroll: true })
  return copied
}

/**
 * Copies both rich text and plain text when the browser supports it, then
 * falls back to a plain-text write and finally to the legacy copy command.
 */
export async function copyNoteToClipboard(note: Note): Promise<void> {
  const plainText = htmlToPlainText(note.content, { listMarkers: true })
  if (!plainText.trim()) throw new Error('The note is empty.')

  if (
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function' &&
    note.content.trim()
  ) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
          'text/html': new Blob([note.content], { type: 'text/html' }),
        }),
      ])
      return
    } catch {
      // Fall back to plain text below.
    }
  }

  if (typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(plainText)
      return
    } catch {
      // Fall back to the legacy command below.
    }
  }

  if (!legacyCopy(plainText)) {
    throw new Error('Clipboard access was blocked.')
  }
}
