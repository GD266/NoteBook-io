import { isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNotebook } from './hooks/useNotebook'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useNow } from './hooks/useNow'
import { readTextFile, takePendingTextFiles } from './lib/files'
import { htmlToPlainText, plainTextToHtml } from './lib/text'
import { DEFAULT_SETTINGS, estimateStorageBytes } from './lib/storage'
import {
  copyNoteToClipboard,
  downloadNoteAsText,
  noteTitle,
} from './lib/utils'
import { TopBar } from './components/TopBar'
import { Editor } from './components/Editor'
import { EmptyState } from './components/EmptyState'
import { SettingsDialog } from './components/SettingsDialog'
import { ShortcutsDialog } from './components/ShortcutsDialog'

function NotebookApp() {
  const {
    notes,
    activeNote,
    settings,
    saveStatus,
    lastSavedAt,
    saveError,
    createNote,
    importNote,
    selectNote,
    updateContent,
    updateTitle,
    deleteNote,
    updateSettings,
    flushSave,
  } = useNotebook()

  const now = useNow()
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [focusTitleNoteId, setFocusTitleNoteId] = useState<string | null>(null)

  const openPendingTextFiles = useCallback(async (): Promise<boolean> => {
    let paths: string[]
    try {
      paths = await takePendingTextFiles()
    } catch {
      return false
    }

    let opened = false
    for (const path of paths) {
      try {
        const file = await readTextFile(path)
        importNote(file.name, plainTextToHtml(file.content))
        opened = true
      } catch {
        // Silently ignore files that cannot be opened.
      }
    }

    return opened
  }, [importNote])

  const resolvedTheme =
    settings.theme === 'system' ? (prefersDark ? 'dark' : 'light') : settings.theme
  const dialogOpen = settingsOpen || shortcutsOpen
  const autoFocusTitle = Boolean(
    activeNote && focusTitleNoteId === activeNote.id,
  )

  const storageBytes = useMemo(
    () => (settingsOpen ? estimateStorageBytes(notes) : 0),
    [settingsOpen, notes],
  )

  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined

    const handleOpenRequest = () => {
      void openPendingTextFiles()
    }

    const prepareStartup = async () => {
      if (isTauri()) {
        try {
          unlisten = await listen('open-text-file', handleOpenRequest)
        } catch {
          // The desktop event bridge is unavailable; startup files still work.
        }
      }

      if (disposed) {
        unlisten?.()
        return
      }

      // Files handed over by the OS open as soon as the app mounts.
      await openPendingTextFiles()
    }

    void prepareStartup()

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [openPendingTextFiles])

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (meta) meta.content = resolvedTheme === 'dark' ? '#060607' : '#f1efea'

    if (isTauri()) {
      void getCurrentWindow().setTheme(resolvedTheme).catch(() => {
        // The web app is unaffected if the native window cannot update its title bar.
      })
    }
  }, [resolvedTheme])

  const activeNoteHeading = activeNote ? noteTitle(activeNote) : null

  useEffect(() => {
    document.title = activeNoteHeading
      ? `${activeNoteHeading} — Notebook.io`
      : 'Notebook.io — A quiet place to write'
  }, [activeNoteHeading])

  const handleCreateNote = useCallback(() => {
    setFocusTitleNoteId(createNote())
  }, [createNote])

  const handleSelectNote = useCallback(
    (id: string) => {
      selectNote(id)
      setFocusTitleNoteId(null)
    },
    [selectNote],
  )

  const handleRenameNote = useCallback(
    (id: string) => {
      selectNote(id)
      setFocusTitleNoteId(id)
    },
    [selectNote],
  )

  const handleTitleFocused = useCallback(() => {
    setFocusTitleNoteId(null)
  }, [])

  const handleToggleTheme = useCallback(() => {
    updateSettings({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' })
  }, [resolvedTheme, updateSettings])

  const handleCopy = useCallback(async () => {
    if (!activeNote) return
    if (!htmlToPlainText(activeNote.content).trim()) {
      return
    }

    try {
      await copyNoteToClipboard(activeNote)
    } catch {
      // Clipboard access can be blocked; the note stays unchanged.
    }
  }, [activeNote])

  const handleDownload = useCallback(() => {
    if (!activeNote) return
    if (!htmlToPlainText(activeNote.content).trim()) {
      return
    }

    try {
      downloadNoteAsText(activeNote)
    } catch {
      // The browser can block downloads; the note stays unchanged.
    }
  }, [activeNote])

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true)
  }, [])

  const handleOpenShortcuts = useCallback(() => {
    setShortcutsOpen(true)
  }, [])

  const handleResetEditorPreferences = useCallback(() => {
    updateSettings({
      font: DEFAULT_SETTINGS.font,
      fontSize: DEFAULT_SETTINGS.fontSize,
      lineSpacing: DEFAULT_SETTINGS.lineSpacing,
      spellcheck: DEFAULT_SETTINGS.spellcheck,
    })
  }, [updateSettings])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || dialogOpen) return

      const key = event.key.toLowerCase()

      if (key === 's' && !event.altKey && !event.shiftKey) {
        event.preventDefault()
        flushSave()
        return
      }

      if (key === 'n' && event.altKey && !event.shiftKey) {
        event.preventDefault()
        if (!event.repeat) handleCreateNote()
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
    dialogOpen,
    flushSave,
    handleCreateNote,
    handleOpenShortcuts,
  ])

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <div className="app-shell">
        <TopBar
          notes={notes}
          activeNoteId={activeNote?.id ?? null}
          now={now}
          saveStatus={saveStatus}
          saveError={saveError}
          lastSavedAt={lastSavedAt}
          resolvedTheme={resolvedTheme}
          onCreateNote={handleCreateNote}
          onSelectNote={handleSelectNote}
          onRenameNote={handleRenameNote}
          onDeleteNote={deleteNote}
          onToggleTheme={handleToggleTheme}
          onOpenSettings={handleOpenSettings}
        />

        <main id="main-content" className="main-area" tabIndex={-1}>
          <section className="editor-panel panel" aria-label="Notebook editor">
            {activeNote ? (
              <Editor
                key={activeNote.id}
                note={activeNote}
                settings={settings}
                now={now}
                autoFocusTitle={autoFocusTitle}
                onTitleFocused={handleTitleFocused}
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
    </>
  )
}

export default function App() {
  return <NotebookApp />
}
