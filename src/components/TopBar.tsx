import { memo } from 'react'
import { Moon, Sun, Settings2 } from 'lucide-react'
import type { SaveStatus } from '../types'
import { formatFullTimestamp } from '../lib/utils'
import { IconButton } from './IconButton'
import { LogoMark } from './LogoMark'

interface TopBarProps {
  hasNote: boolean
  saveStatus: SaveStatus
  saveError: string | null
  lastSavedAt: number | null
  resolvedTheme: 'dark' | 'light'
  onToggleTheme: () => void
  onOpenSettings: () => void
}

// Memoized: with a stable `hasNote` flag the bar no longer re-renders on every
// keystroke, only when the save state or theme changes.
export const TopBar = memo(function TopBar({
  hasNote,
  saveStatus,
  saveError,
  lastSavedAt,
  resolvedTheme,
  onToggleTheme,
  onOpenSettings,
}: TopBarProps) {
  const label = !hasNote
    ? 'Local only'
    : saveStatus === 'saving'
      ? 'Saving'
      : saveStatus === 'error'
        ? 'Not saved'
        : 'Saved'

  const statusTitle = !hasNote
    ? 'Notes stay on this device. Nothing is uploaded.'
    : saveStatus === 'error'
      ? (saveError ?? 'Changes could not be saved on this device.')
      : saveStatus === 'saving'
        ? 'Saving changes on this device…'
        : lastSavedAt
          ? `Saved on this device at ${formatFullTimestamp(lastSavedAt)}`
          : 'All changes are saved on this device.'

  return (
    <header className="topbar panel">
      <div className="topbar-left">
        <LogoMark />

        <span className="brand">
          <span className="brand-name">Notebook<span>.io</span></span>
        </span>

        <div
          className="save-indicator"
          data-state={!hasNote ? 'local' : saveStatus}
          title={statusTitle}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="save-dot" aria-hidden="true" />
          <span className="save-label">{label}</span>
        </div>
      </div>

      <div className="topbar-actions">
        <IconButton
          label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={onToggleTheme}
        >
          {resolvedTheme === 'dark' ? (
            <Sun size={17} strokeWidth={1.8} />
          ) : (
            <Moon size={17} strokeWidth={1.8} />
          )}
        </IconButton>

        <IconButton label="Open settings" onClick={onOpenSettings}>
          <Settings2 size={17} strokeWidth={1.8} />
        </IconButton>
      </div>
    </header>
  )
})
