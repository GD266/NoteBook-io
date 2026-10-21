import { ChevronRight, Moon, PanelLeft, Settings2, Sun } from 'lucide-react'
import type { Note, SaveStatus } from '../types'
import { formatFullTimestamp, noteTitle } from '../lib/utils'
import { IconButton } from './IconButton'
import { LogoMark } from './LogoMark'

interface TopBarProps {
  activeNote: Note | null
  saveStatus: SaveStatus
  saveError: string | null
  lastSavedAt: number | null
  resolvedTheme: 'dark' | 'light'
  sidebarExpanded: boolean
  onToggleSidebar: () => void
  onToggleTheme: () => void
  onOpenSettings: () => void
}

export function TopBar({
  activeNote,
  saveStatus,
  saveError,
  lastSavedAt,
  resolvedTheme,
  sidebarExpanded,
  onToggleSidebar,
  onToggleTheme,
  onOpenSettings,
}: TopBarProps) {
  const title = activeNote ? noteTitle(activeNote) : 'A quiet place to write'
  const label = !activeNote
    ? 'Local only'
    : saveStatus === 'saving'
      ? 'Saving'
      : saveStatus === 'error'
        ? 'Not saved'
        : 'Saved'

  const statusTitle = !activeNote
    ? 'Notes stay in this browser. Nothing is uploaded.'
    : saveStatus === 'error'
      ? (saveError ?? 'Changes could not be saved to this browser.')
      : saveStatus === 'saving'
        ? 'Saving changes in this browser…'
        : lastSavedAt
          ? `Saved in this browser at ${formatFullTimestamp(lastSavedAt)}`
          : 'All changes are saved in this browser.'

  return (
    <header className="topbar panel">
      <div className="topbar-left">
        <IconButton
          label={sidebarExpanded ? 'Hide notes list' : 'Show notes list'}
          className="sidebar-toggle"
          aria-expanded={sidebarExpanded}
          aria-controls="notes-sidebar"
          onClick={onToggleSidebar}
        >
          <PanelLeft size={17} strokeWidth={1.8} />
        </IconButton>

        <div className="brand">
          <LogoMark />
          <span className="brand-name hidden sm:inline">
            Notebook<span>.io</span>
          </span>
        </div>

        <span className="topbar-divider hidden md:block" aria-hidden="true" />
        <ChevronRight
          className="hidden md:block topbar-chevron"
          size={13}
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <span className="topbar-doc-text" title={title}>
          {title}
        </span>
      </div>

      <div className="topbar-actions">
        <div
          className="save-indicator"
          data-state={!activeNote ? 'local' : saveStatus}
          title={statusTitle}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="save-dot" aria-hidden="true" />
          <span className="save-label">{label}</span>
        </div>

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
}
