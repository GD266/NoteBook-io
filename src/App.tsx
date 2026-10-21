import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Note } from './types'
import { useNotebook } from './hooks/useNotebook'
import { useToast } from './hooks/useToast'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useNow } from './hooks/useNow'
import { htmlToPlainText } from './lib/text'
import { DEFAULT_SETTINGS, estimateStorageBytes } from './lib/storage'
import {
  copyNoteToClipboard,
  downloadNoteAsText,
  noteTitle,
} from './lib/utils'
import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { EmptyState } from './components/EmptyState'
import { SettingsDialog } from './components/SettingsDialog'
import { ShortcutsDialog } from './components/ShortcutsDialog'
import { DeleteNoteDialog } from './components/DeleteNoteDialog'
import { ToastProvider } from './components/ToastProvider'

function NotebookApp() {
  const { toast } = useToast()
  const {
    notes,
    activeNote,
    settings,
    saveStatus,
    lastSavedAt,
    saveError,
    loadNotice,
    createNote,
    selectNote,
    updateContent,
    updateTitle,
    deleteNote,
    updateSettings,
    flushSave,
  } = useNotebook()

  const now = useNow()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [focusTitleNoteId, setFocusTitleNoteId] = useState<string | null>(null)

  const loadNoticeShown = useRef(false)
  const previousSaveError = useRef<string | null>(null)

  const resolvedTheme =
    settings.theme === 'system' ? (prefersDark ? 'dark' : 'light') : settings.theme
  const dialogOpen = settingsOpen || shortcutsOpen || deleteTargetId !== null
  const deleteTarget = notes.find((note) => note.id === deleteTargetId) ?? null
  const autoFocusTitle = Boolean(
    activeNote && focusTitleNoteId === activeNote.id,
  )

  const storageBytes = useMemo(
    () => (settingsOpen ? estimateStorageBytes(notes) : 0),
    [settingsOpen, notes],
  )

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (meta) meta.content = resolvedTheme === 'dark' ? '#060607' : '#f1efea'
  }, [resolvedTheme])

  const activeNoteHeading = activeNote ? noteTitle(activeNote) : null

  useEffect(() => {
    document.title = activeNoteHeading
      ? `${activeNoteHeading} — Notebook.io`
      : 'Notebook.io — A quiet place to write'
  }, [activeNoteHeading])

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)')
    const handleBreakpointChange = (event: MediaQueryListEvent) => {
      if (event.matches) setSidebarOpen(false)
    }

    desktopQuery.addEventListener('change', handleBreakpointChange)
    return () => desktopQuery.removeEventListener('change', handleBreakpointChange)
  }, [])

  useEffect(() => {
    if (!loadNotice || loadNoticeShown.current) return
    loadNoticeShown.current = true
    toast({
      message: 'A note about local storage',
      description: loadNotice,
      tone: 'error',
      duration: 10000,
    })
  }, [loadNotice, toast])

  useEffect(() => {
    if (saveError && saveError !== previousSaveError.current) {
      previousSaveError.current = saveError
      toast({
        message: 'Changes could not be saved',
        description: saveError,
        tone: 'error',
        duration: 10000,
        action: {
          label: 'Try again',
          onClick: () => {
            flushSave()
          },
        },
      })
    } else if (!saveError) {
      previousSaveError.current = null
    }
  }, [flushSave, saveError, toast])

  const focusSearch = useCallback(() => {
    setSidebarOpen(true)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const input = document.getElementById('notes-search')
        if (input instanceof HTMLInputElement) {
          input.focus()
          input.select()
        }
      })
    })
  }, [])

  const handleToggleSidebar = useCallback(() => {
    if (isDesktop) {
      setSidebarCollapsed((collapsed) => !collapsed)
    } else {
      setSidebarOpen((open) => !open)
    }
  }, [isDesktop])

  const handleCreateNote = useCallback(() => {
    const id = createNote()
    setFocusTitleNoteId(id)
    setSidebarOpen(false)
  }, [createNote])

  const handleSelectNote = useCallback(
    (id: string) => {
      selectNote(id)
      setFocusTitleNoteId(null)
      setSidebarOpen(false)
    },
    [selectNote],
  )

  const handleRenameNote = useCallback(
    (id: string) => {
      selectNote(id)
      setFocusTitleNoteId(id)
      setSidebarOpen(false)
    },
    [selectNote],
  )

  const handleRequestDelete = useCallback((note: Note) => {
    setDeleteTargetId(note.id)
    setSidebarOpen(false)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return
    const title = noteTitle(deleteTarget)
    deleteNote(deleteTarget.id)
    setDeleteTargetId(null)
    toast({
      message: 'Note deleted',
      description: `“${title}” was removed from this browser.`,
      tone: 'info',
    })
  }, [deleteNote, deleteTarget, toast])

  const handleToggleTheme = useCallback(() => {
    updateSettings({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' })
  }, [resolvedTheme, updateSettings])

  const handleCopy = useCallback(async () => {
    if (!activeNote) return
    if (!htmlToPlainText(activeNote.content).trim()) {
      toast({
        message: 'This note is empty',
        description: 'Write something before copying it.',
        tone: 'info',
      })
      return
    }

    try {
      await copyNoteToClipboard(activeNote)
      toast({
        message: 'Copied to clipboard',
        description: 'Formatting is preserved where your clipboard supports it.',
        tone: 'success',
      })
    } catch (error) {
      toast({
        message: 'Could not copy this note',
        description:
          error instanceof Error
            ? error.message
            : 'Clipboard access was blocked by the browser.',
        tone: 'error',
      })
    }
  }, [activeNote, toast])

  const handleDownload = useCallback(() => {
    if (!activeNote) return
    if (!htmlToPlainText(activeNote.content).trim()) {
      toast({
        message: 'This note is empty',
        description: 'Write something before downloading it.',
        tone: 'info',
      })
      return
    }

    try {
      const filename = downloadNoteAsText(activeNote)
      toast({
        message: 'Note downloaded',
        description: filename,
        tone: 'success',
      })
    } catch {
      toast({
        message: 'Could not download this note',
        description: 'Your browser blocked the download. Please try again.',
        tone: 'error',
      })
    }
  }, [activeNote, toast])

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true)
    setSidebarOpen(false)
  }, [])

  const handleOpenShortcuts = useCallback(() => {
    setShortcutsOpen(true)
    setSidebarOpen(false)
  }, [])

  const handleResetEditorPreferences = useCallback(() => {
    updateSettings({
      font: DEFAULT_SETTINGS.font,
      fontSize: DEFAULT_SETTINGS.fontSize,
      lineSpacing: DEFAULT_SETTINGS.lineSpacing,
      spellcheck: DEFAULT_SETTINGS.spellcheck,
    })
    toast({
      message: 'Editor preferences restored',
      tone: 'success',
      duration: 2800,
    })
  }, [toast, updateSettings])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || dialogOpen) return

      const key = event.key.toLowerCase()

      if (key === 's' && !event.altKey && !event.shiftKey) {
        event.preventDefault()
        const saved = flushSave()
        if (saved && activeNote) {
          toast({
            message: 'Note saved',
            description: 'Stored in this browser.',
            tone: 'success',
            duration: 2600,
          })
        }
        return
      }

      if (key === 'n' && event.altKey && !event.shiftKey) {
        event.preventDefault()
        if (!event.repeat) handleCreateNote()
        return
      }

      if (key === 'k' && !event.altKey && !event.shiftKey) {
        event.preventDefault()
        focusSearch()
        return
      }

      if (event.code === 'Slash' && !event.altKey) {
        event.preventDefault()
        handleOpenShortcuts()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    activeNote,
    dialogOpen,
    flushSave,
    focusSearch,
    handleCreateNote,
    handleOpenShortcuts,
    toast,
  ])

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <div
        className="app-shell"
        data-sidebar-collapsed={isDesktop && sidebarCollapsed ? 'true' : undefined}
      >
        <TopBar
          activeNote={activeNote}
          saveStatus={saveStatus}
          saveError={saveError}
          lastSavedAt={lastSavedAt}
          resolvedTheme={resolvedTheme}
          sidebarExpanded={isDesktop ? !sidebarCollapsed : sidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          onToggleTheme={handleToggleTheme}
          onOpenSettings={handleOpenSettings}
        />

        <div className="app-body">
          <Sidebar
            notes={notes}
            activeNoteId={activeNote?.id ?? null}
            sidebarOpen={sidebarOpen}
            collapsed={sidebarCollapsed}
            isDesktop={isDesktop}
            now={now}
            onCloseSidebar={() => setSidebarOpen(false)}
            onCreateNote={handleCreateNote}
            onSelectNote={handleSelectNote}
            onRenameNote={handleRenameNote}
            onRequestDelete={handleRequestDelete}
          />

          {sidebarOpen && !isDesktop ? (
            <div
              className="sidebar-backdrop"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          ) : null}

          <main id="main-content" className="main-area" tabIndex={-1}>
            <section className="editor-panel panel" aria-label="Notebook editor">
              {activeNote ? (
                <Editor
                  key={activeNote.id}
                  note={activeNote}
                  settings={settings}
                  now={now}
                  autoFocusTitle={autoFocusTitle}
                  onTitleFocused={() => setFocusTitleNoteId(null)}
                  onTitleChange={updateTitle}
                  onContentChange={updateContent}
                  onFlush={flushSave}
                  onCopy={handleCopy}
                  onDownload={handleDownload}
                  onOpenShortcuts={handleOpenShortcuts}
                />
              ) : (
                <EmptyState
                  hasNotes={notes.length > 0}
                  onCreateNote={handleCreateNote}
                  onOpenShortcuts={handleOpenShortcuts}
                />
              )}
            </section>
          </main>
        </div>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        noteCount={notes.length}
        storageBytes={storageBytes}
        saveError={saveError}
        onChange={updateSettings}
        onResetEditorPreferences={handleResetEditorPreferences}
      />

      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <DeleteNoteDialog
        note={deleteTarget}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <NotebookApp />
    </ToastProvider>
  )
}
