import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Plus, Search, SearchX, Trash2, X } from 'lucide-react'
import type { Note } from '../types'
import { htmlToPlainText } from '../lib/text'
import {
  cn,
  formatFullTimestamp,
  formatRelativeTime,
  isMacPlatform,
  noteTitle,
} from '../lib/utils'

// Notes are immutable snapshots, so each note's searchable text is parsed once
// per version. The cache is only read while a search is active, so typing in
// the editor never re-parses note HTML.
const searchCache = new WeakMap<Note, string>()

function getSearchText(note: Note): string {
  const cached = searchCache.get(note)
  if (cached !== undefined) return cached

  const text = `${note.title} ${htmlToPlainText(note.content)}`.toLocaleLowerCase()
  searchCache.set(note, text)
  return text
}

interface NoteTabProps {
  note: Note
  active: boolean
  now: number
  onSelect: (id: string) => void
  onRename: (id: string) => void
  onDelete: (note: Note) => void
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
          onClick={() => onDelete(note)}
          aria-label={`Delete note: ${title}`}
          title="Delete note"
        >
          <Trash2 size={12} strokeWidth={1.9} />
        </button>
      </div>
    </div>
  )
})

interface TopNotesPanelProps {
  notes: Note[]
  activeNoteId: string | null
  now: number
  onCreateNote: () => void
  onSelectNote: (id: string) => void
  onRenameNote: (id: string) => void
  onDeleteNote: (note: Note) => void
}

export function TopNotesPanel({
  notes,
  activeNoteId,
  now,
  onCreateNote,
  onSelectNote,
  onRenameNote,
  onDeleteNote,
}: TopNotesPanelProps) {
  const [query, setQuery] = useState('')
  const tabsRef = useRef<HTMLDivElement>(null)

  const searchTerm = query.trim().toLocaleLowerCase()
  const visibleNotes = useMemo(() => {
    if (!searchTerm) return notes
    return notes.filter((note) => getSearchText(note).includes(searchTerm))
  }, [notes, searchTerm])

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

  const clearSearch = () => setQuery('')

  return (
    <section className="notes-bar panel" aria-label="Notes">
      <div className="notes-bar-start">
        <button type="button" className="new-note-button" onClick={onCreateNote}>
          <Plus size={15} strokeWidth={2} aria-hidden="true" />
          New note
        </button>

        <div className="search-field notes-search">
          <Search
            className="search-icon"
            size={14}
            strokeWidth={1.9}
            aria-hidden="true"
          />
          <input
            id="notes-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query) {
                event.preventDefault()
                event.stopPropagation()
                clearSearch()
              }
            }}
            placeholder="Search notes"
            aria-label="Search notes"
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              className="search-clear"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <X size={13} strokeWidth={2} />
            </button>
          ) : (
            <kbd className="search-shortcut" aria-hidden="true">
              {isMacPlatform() ? '⌘K' : 'Ctrl K'}
            </kbd>
          )}
        </div>

        <span
          className="notes-bar-count"
          aria-label={`${notes.length} notes`}
          title={`${notes.length} notes stored on this device`}
        >
          {notes.length}
        </span>
      </div>

      <div className="notes-tabs scroll-area" ref={tabsRef}>
        {notes.length === 0 ? (
          <p className="notes-bar-empty">
            No notes yet — press <strong>New note</strong> to start writing.
          </p>
        ) : visibleNotes.length === 0 ? (
          <p className="notes-bar-empty" role="status">
            <SearchX size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>
              No notes match “{query.trim()}”.
              <button type="button" className="text-button" onClick={clearSearch}>
                Clear search
              </button>
            </span>
          </p>
        ) : (
          visibleNotes.map((note) => (
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
    </section>
  )
}
