import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppSettings, Note, NotebookData, SaveStatus } from '../types'
import { loadNotebook, persistNotebook } from '../lib/storage'
import { createId, sortNotes } from '../lib/utils'

const SAVE_DELAY_MS = 600

function describeStorageError(error: unknown): string {
  if (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  ) {
    return 'This browser is out of local storage space. Delete a note or free up space, then try again.'
  }

  return 'Your browser blocked local storage. Your changes are still open here, but they may not survive a reload.'
}

export function useNotebook() {
  const [initialLoad] = useState(loadNotebook)
  const [data, setData] = useState<NotebookData>(initialLoad.data)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const dataRef = useRef<NotebookData>(initialLoad.data)
  const unsavedRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  const clearSaveTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const writeSnapshot = useCallback((snapshot: NotebookData): boolean => {
    try {
      persistNotebook(snapshot)
      unsavedRef.current = false
      setSaveStatus('saved')
      setLastSavedAt(Date.now())
      setSaveError(null)
      return true
    } catch (error) {
      setSaveStatus('error')
      setSaveError(describeStorageError(error))
      return false
    }
  }, [])

  const commitData = useCallback((next: NotebookData) => {
    dataRef.current = next
    unsavedRef.current = true
    setData(next)
  }, [])

  const scheduleSave = useCallback(() => {
    clearSaveTimer()
    setSaveStatus('saving')

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      writeSnapshot(dataRef.current)
    }, SAVE_DELAY_MS)
  }, [clearSaveTimer, writeSnapshot])

  const createNote = useCallback((): string => {
    clearSaveTimer()
    const now = Date.now()
    const note: Note = {
      id: createId(),
      title: '',
      content: '',
      createdAt: now,
      updatedAt: now,
    }

    const current = dataRef.current
    const next: NotebookData = {
      ...current,
      notes: sortNotes([note, ...current.notes]),
      activeNoteId: note.id,
    }

    commitData(next)
    writeSnapshot(next)
    return note.id
  }, [clearSaveTimer, commitData, writeSnapshot])

  const selectNote = useCallback(
    (id: string) => {
      const current = dataRef.current
      if (current.activeNoteId === id) return
      if (!current.notes.some((note) => note.id === id)) return

      clearSaveTimer()
      const next: NotebookData = { ...current, activeNoteId: id }
      commitData(next)
      writeSnapshot(next)
    },
    [clearSaveTimer, commitData, writeSnapshot],
  )

  const updateActiveNote = useCallback(
    (updater: (note: Note) => Note) => {
      const current = dataRef.current
      if (!current.activeNoteId) return

      let changed = false
      const notes = current.notes.map((note) => {
        if (note.id !== current.activeNoteId) return note
        const nextNote = updater(note)
        if (nextNote === note) return note
        changed = true
        return nextNote
      })

      if (!changed) return

      const next = { ...current, notes: sortNotes(notes) }
      commitData(next)
      scheduleSave()
    },
    [commitData, scheduleSave],
  )

  const updateContent = useCallback(
    (content: string) => {
      updateActiveNote((note) => {
        if (note.content === content) return note
        return { ...note, content, updatedAt: Date.now() }
      })
    },
    [updateActiveNote],
  )

  const updateTitle = useCallback(
    (title: string) => {
      updateActiveNote((note) => {
        const nextTitle = title.slice(0, 120)
        if (note.title === nextTitle) return note
        return { ...note, title: nextTitle, updatedAt: Date.now() }
      })
    },
    [updateActiveNote],
  )

  const deleteNote = useCallback(
    (id: string) => {
      const current = dataRef.current
      const index = current.notes.findIndex((note) => note.id === id)
      if (index === -1) return

      clearSaveTimer()
      const notes = current.notes.filter((note) => note.id !== id)
      let activeNoteId = current.activeNoteId

      if (activeNoteId === id) {
        activeNoteId = notes[Math.min(index, notes.length - 1)]?.id ?? null
      }

      const next: NotebookData = { ...current, notes, activeNoteId }
      commitData(next)
      writeSnapshot(next)
    },
    [clearSaveTimer, commitData, writeSnapshot],
  )

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      const current = dataRef.current
      const next: NotebookData = {
        ...current,
        settings: { ...current.settings, ...patch },
      }
      commitData(next)
      writeSnapshot(next)
    },
    [commitData, writeSnapshot],
  )

  const flushSave = useCallback((): boolean => {
    clearSaveTimer()
    return writeSnapshot(dataRef.current)
  }, [clearSaveTimer, writeSnapshot])

  useEffect(() => {
    const persistIfNeeded = () => {
      if (!unsavedRef.current) return
      clearSaveTimer()
      try {
        persistNotebook(dataRef.current)
        unsavedRef.current = false
      } catch {
        // The beforeunload handler warns when persistence still fails.
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') persistIfNeeded()
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      persistIfNeeded()
      if (unsavedRef.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }

    window.addEventListener('pagehide', persistIfNeeded)
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      persistIfNeeded()
      window.removeEventListener('pagehide', persistIfNeeded)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [clearSaveTimer])

  useEffect(() => clearSaveTimer, [clearSaveTimer])

  const activeNote =
    data.notes.find((note) => note.id === data.activeNoteId) ?? null

  return {
    notes: data.notes,
    activeNote,
    activeNoteId: data.activeNoteId,
    settings: data.settings,
    saveStatus,
    lastSavedAt,
    saveError,
    loadNotice: initialLoad.notice,
    createNote,
    selectNote,
    updateContent,
    updateTitle,
    deleteNote,
    updateSettings,
    flushSave,
  }
}
