import { memo, useEffect, useRef } from 'react'
import { Moon, Pencil, Plus, Settings2, Sun, Trash2 } from 'lucide-react'
import type { Note, SaveStatus } from '../types'
import { cn, formatFullTimestamp, formatRelativeTime, noteTitle } from '../lib/utils'
import { IconButton } from './IconButton'

interface NoteTabProps {
  note: Note
  active: boolean
  now: number
  onSelect: (id: string) => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
}

// Memoized so typing in a note only re-renders its own tab.
const NoteTab = memo(function NoteTab({
  note,
  active,
  now,
  onSelect,
  onRename,
  onDelete,
}: NoteTabProps) {
  const title = noteTitle(note)
  const edited = formatRelativeTime(note.updatedAt, now)

  return (
    <div className={cn('note-tab', active && 'is-active')} data-note-id={note.id}>
      <button
        type="button"
        className="note-tab-select"
        onClick={() => onSelect(note.id)}
        aria-current={active ? 'true' : undefined}
        aria-label={`Open note: ${title}, edited ${edited.toLowerCase()}`}
        title={`${title} — edited ${formatFullTimestamp(note.updatedAt)}`}
      >
        <span className={cn('note-tab-title', !note.title.trim() && 'is-placeholder')}>
          {title}
        </span>
        <time className="note-tab-time" dateTime={new Date(note.updatedAt).toISOString()}>
          {edited}
        </time>
      </button>

      <div className="note-tab-actions">
        <button
          type="button"
          className="note-tab-action"
          onClick={() => onRename(note.id)}
          aria-label={`Rename note: ${title}`}
          title="Rename note"
        >
          <Pencil size={12} strokeWidth={1.9} />
        </button>
        <button
          type="button"
          className="note-tab-action note-tab-action-danger"
          onClick={() => onDelete(note.id)}
          aria-label={`Delete note: ${title}`}
          title="Delete note"
        >
          <Trash2 size={12} strokeWidth={1.9} />
        </button>
      </div>
    </div>
  )
})

interface TopBarProps {
  notes: Note[]
  activeNoteId: string | null
  now: number
  saveStatus: SaveStatus
  saveError: string | null
  lastSavedAt: number | null
  resolvedTheme: 'dark' | 'light'
  onCreateNote: () => void
  onSelectNote: (id: string) => void
  onRenameNote: (id: string) => void
  onDeleteNote: (id: string) => void
  onToggleTheme: () => void
  onOpenSettings: () => void
}

// The app's one bar, in the spirit of the Windows 11 Notepad tab strip: note
// tabs and the new-note `+` on the left, save state and actions on the right.
// The former brand "home bar" was merged in and its logo removed.
export const TopBar = memo(function TopBar({
  notes,
  activeNoteId,
  now,
  saveStatus,
  saveError,
  lastSavedAt,
  resolvedTheme,
  onCreateNote,
  onSelectNote,
  onRenameNote,
  onDeleteNote,
  onToggleTheme,
  onOpenSettings,
}: TopBarProps) {
  const tabsRef = useRef<HTMLDivElement>(null)

  const hasNote = activeNoteId !== null
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

  // Keep the open note reachable when the strip scrolls horizontally.
  useEffect(() => {
    if (!activeNoteId) return
    const tabs = tabsRef.current
    if (!tabs) return

    const active = tabs.querySelector<HTMLElement>(
      `[data-note-id="${CSS.escape(activeNoteId)}"]`,
    )
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeNoteId])

  return (
    <header className="topbar panel">
      <div className="notes-tabs scroll-area" ref={tabsRef}>
        {notes.length === 0 ? (
          <p className="notes-bar-empty">
            No notes yet — press the <strong>+</strong> button to start writing.
          </p>
        ) : (
          notes.map((note) => (
            <NoteTab
              key={note.id}
              note={note}
              active={note.id === activeNoteId}
              now={now}
              onSelect={onSelectNote}
              onRename={onRenameNote}
              onDelete={onDeleteNote}
            />
          ))
        )}
      </div>

      <button
        type="button"
        className="new-note-tab"
        onClick={onCreateNote}
        aria-label="Create new note"
        title="New note"
      >
        <Plus size={19} strokeWidth={2} aria-hidden="true" />
      </button>

      <div className="topbar-right">
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
      </div>
    </header>
  )
})
