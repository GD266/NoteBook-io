import { useMemo, useState } from 'react'
import {
  HardDrive,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  SearchX,
  Trash2,
  X,
} from 'lucide-react'
import type { Note } from '../types'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { htmlToPlainText } from '../lib/text'
import {
  cn,
  formatFullTimestamp,
  formatRelativeTime,
  isMacPlatform,
  noteTitle,
  pluralize,
} from '../lib/utils'
import { IconButton } from './IconButton'

// Notes are immutable snapshots, so parsing each note's HTML once per version
// keeps typing responsive even with a long note list.
const previewCache = new WeakMap<Note, string>()

function getPreview(note: Note): string {
  const cached = previewCache.get(note)
  if (cached !== undefined) return cached

  const preview = htmlToPlainText(note.content).replace(/\s+/g, ' ').trim()
  previewCache.set(note, preview)
  return preview
}

interface SidebarProps {
  notes: Note[]
  activeNoteId: string | null
  sidebarOpen: boolean
  collapsed: boolean
  isDesktop: boolean
  now: number
  onCloseSidebar: () => void
  onCreateNote: () => void
  onSelectNote: (id: string) => void
  onRenameNote: (id: string) => void
  onRequestDelete: (note: Note) => void
}

export function Sidebar({
  notes,
  activeNoteId,
  sidebarOpen,
  collapsed,
  isDesktop,
  now,
  onCloseSidebar,
  onCreateNote,
  onSelectNote,
  onRenameNote,
  onRequestDelete,
}: SidebarProps) {
  const [query, setQuery] = useState('')
  const overlayOpen = sidebarOpen && !isDesktop
  const hidden = isDesktop ? collapsed : !sidebarOpen
  const panelRef = useFocusTrap<HTMLElement>(overlayOpen, onCloseSidebar)

  const entries = useMemo(
    () =>
      notes.map((note) => {
        const text = getPreview(note)
        return {
          note,
          preview: text,
          searchText: `${note.title} ${text}`.toLocaleLowerCase(),
        }
      }),
    [notes],
  )

  const searchTerm = query.trim().toLocaleLowerCase()
  const filteredEntries = useMemo(() => {
    if (!searchTerm) return entries
    return entries.filter((entry) => entry.searchText.includes(searchTerm))
  }, [entries, searchTerm])

  const clearSearch = () => setQuery('')

  const handleSelect = (id: string) => {
    onSelectNote(id)
    if (!isDesktop) onCloseSidebar()
  }

  const handleRename = (id: string) => {
    onRenameNote(id)
    if (!isDesktop) onCloseSidebar()
  }

  const handleDelete = (note: Note) => {
    onRequestDelete(note)
    if (!isDesktop) onCloseSidebar()
  }

  return (
    <aside
      ref={panelRef}
      id="notes-sidebar"
      className="notes-sidebar panel"
      data-open={sidebarOpen}
      data-collapsed={collapsed ? 'true' : 'false'}
      data-overlay={!isDesktop}
      role={!isDesktop ? 'dialog' : undefined}
      aria-modal={overlayOpen ? 'true' : undefined}
      aria-label="Notes"
      aria-hidden={hidden ? 'true' : undefined}
      inert={hidden ? true : undefined}
      tabIndex={-1}
    >
      <div className="sidebar-head">
        <div className="sidebar-title-row">
          <div className="sidebar-title-group">
            <h2 className="sidebar-title">Notes</h2>
            <span
              className="note-count"
              aria-label={`${notes.length} ${pluralize(notes.length, 'note')}`}
            >
              {notes.length}
            </span>
          </div>
          <IconButton
            label="Close notes list"
            className="sidebar-close"
            onClick={onCloseSidebar}
          >
            <X size={17} strokeWidth={1.8} />
          </IconButton>
        </div>

        <button type="button" className="new-note-button" onClick={onCreateNote}>
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          New note
        </button>

        <div className="search-field">
          <Search
            className="search-icon"
            size={15}
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
      </div>

      <div className="sidebar-list-head">
        <span>
          {searchTerm
            ? `${filteredEntries.length} ${pluralize(filteredEntries.length, 'match', 'matches')}`
            : 'Recent'}
        </span>
        {searchTerm ? <span className="list-count">of {notes.length}</span> : null}
      </div>

      <div className="sidebar-list scroll-area">
        {notes.length === 0 ? (
          <div className="sidebar-empty">
            <span className="sidebar-empty-icon" aria-hidden="true">
              <NotebookPen size={19} strokeWidth={1.6} />
            </span>
            <p>No notes yet</p>
            <span>Start with a blank page.</span>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="sidebar-empty" role="status">
            <span className="sidebar-empty-icon" aria-hidden="true">
              <SearchX size={19} strokeWidth={1.6} />
            </span>
            <p>No notes found</p>
            <span>Try another word, or clear the search.</span>
            <button type="button" className="text-button" onClick={clearSearch}>
              Clear search
            </button>
          </div>
        ) : (
          <ul className="note-list">
            {filteredEntries.map(({ note, preview }) => {
              const title = noteTitle(note)
              const active = note.id === activeNoteId

              return (
                <li key={note.id}>
                  <div className={cn('note-row', active && 'is-active')}>
                    <button
                      type="button"
                      className="note-select"
                      onClick={() => handleSelect(note.id)}
                      aria-current={active ? 'true' : undefined}
                      aria-label={`Open note: ${title}, edited ${formatRelativeTime(
                        note.updatedAt,
                        now,
                      ).toLowerCase()}`}
                    >
                      <span className="note-title-line">
                        <span className={cn('note-title', !note.title.trim() && 'is-placeholder')}>
                          {title}
                        </span>
                      </span>
                      <span className="note-preview-line">
                        <span className={cn('note-preview', !preview && 'is-placeholder')}>
                          {preview || 'Empty note'}
                        </span>
                        <time
                          className="note-time"
                          dateTime={new Date(note.updatedAt).toISOString()}
                          title={`Edited ${formatFullTimestamp(note.updatedAt)}`}
                        >
                          {formatRelativeTime(note.updatedAt, now)}
                        </time>
                      </span>
                    </button>

                    <div className="note-actions">
                      <button
                        type="button"
                        className="note-action"
                        onClick={() => handleRename(note.id)}
                        aria-label={`Rename note: ${title}`}
                        title="Rename note"
                      >
                        <Pencil size={13} strokeWidth={1.9} />
                      </button>
                      <button
                        type="button"
                        className="note-action note-action-danger"
                        onClick={() => handleDelete(note)}
                        aria-label={`Delete note: ${title}`}
                        title="Delete note"
                      >
                        <Trash2 size={13} strokeWidth={1.9} />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="sidebar-foot">
        <HardDrive size={14} strokeWidth={1.8} aria-hidden="true" />
        <div>
          <p>Stored on this device</p>
          <span>Private to this device</span>
        </div>
      </div>
    </aside>
  )
}
