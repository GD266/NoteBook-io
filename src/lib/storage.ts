import type {
  AppSettings,
  FontPreference,
  LineSpacing,
  LoadResult,
  Note,
  NotebookData,
  ThemePreference,
} from '../types'
import { sanitizeNoteHtml } from './text'
import { createId, sortNotes } from './utils'

export const STORAGE_KEY = 'notebook.io/v1'
const BACKUP_PREFIX = 'notebook.io/backup/'
const MAX_TITLE_LENGTH = 120
const MIN_FONT_SIZE = 15
const MAX_FONT_SIZE = 21

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  font: 'sans',
  fontSize: 17,
  lineSpacing: 'balanced',
  spellcheck: true,
}

const THEMES: ThemePreference[] = ['dark', 'light', 'system']
const FONTS: FontPreference[] = ['sans', 'serif', 'mono']
const LINE_SPACINGS: LineSpacing[] = ['compact', 'balanced', 'airy']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function createDefaultData(): NotebookData {
  return {
    version: 1,
    notes: [],
    activeNoteId: null,
    settings: { ...DEFAULT_SETTINGS },
  }
}

function parseSettings(value: unknown): AppSettings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS }

  const theme = THEMES.includes(value.theme as ThemePreference)
    ? (value.theme as ThemePreference)
    : DEFAULT_SETTINGS.theme

  const font = FONTS.includes(value.font as FontPreference)
    ? (value.font as FontPreference)
    : DEFAULT_SETTINGS.font

  const lineSpacing = LINE_SPACINGS.includes(value.lineSpacing as LineSpacing)
    ? (value.lineSpacing as LineSpacing)
    : DEFAULT_SETTINGS.lineSpacing

  const rawFontSize = typeof value.fontSize === 'number' ? value.fontSize : DEFAULT_SETTINGS.fontSize
  const fontSize = Number.isFinite(rawFontSize)
    ? Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(rawFontSize)))
    : DEFAULT_SETTINGS.fontSize

  return {
    theme,
    font,
    fontSize,
    lineSpacing,
    spellcheck:
      typeof value.spellcheck === 'boolean' ? value.spellcheck : DEFAULT_SETTINGS.spellcheck,
  }
}

function parseNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) return []

  const now = Date.now()
  const usedIds = new Set<string>()
  const notes: Note[] = []

  for (const candidate of value) {
    if (!isRecord(candidate)) continue

    let id =
      typeof candidate.id === 'string' && candidate.id.trim() && candidate.id.length <= 100
        ? candidate.id
        : createId()
    while (usedIds.has(id)) id = createId()
    usedIds.add(id)

    const rawCreatedAt =
      typeof candidate.createdAt === 'number' && Number.isFinite(candidate.createdAt)
        ? candidate.createdAt
        : now
    const rawUpdatedAt =
      typeof candidate.updatedAt === 'number' && Number.isFinite(candidate.updatedAt)
        ? candidate.updatedAt
        : rawCreatedAt

    const content =
      typeof candidate.content === 'string' ? sanitizeNoteHtml(candidate.content) : ''

    notes.push({
      id,
      title:
        typeof candidate.title === 'string'
          ? candidate.title.slice(0, MAX_TITLE_LENGTH)
          : '',
      content,
      createdAt: rawCreatedAt,
      updatedAt: Math.max(rawCreatedAt, rawUpdatedAt),
    })
  }

  return sortNotes(notes)
}

function makeBackup(raw: string): boolean {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    window.localStorage.setItem(`${BACKUP_PREFIX}${stamp}`, raw)
    return true
  } catch {
    return false
  }
}

export function loadNotebook(): LoadResult {
  let raw: string | null

  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return {
      data: createDefaultData(),
      notice:
        'Local storage is unavailable in this browser. You can keep writing, but notes may not survive a refresh.',
    }
  }

  if (!raw) return { data: createDefaultData() }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) throw new Error('Unexpected notebook data')

    const notes = parseNotes(parsed.notes)
    const requestedActiveId =
      typeof parsed.activeNoteId === 'string' ? parsed.activeNoteId : null
    const activeNoteId = notes.some((note) => note.id === requestedActiveId)
      ? requestedActiveId
      : (notes[0]?.id ?? null)

    return {
      data: {
        version: 1,
        notes,
        activeNoteId,
        settings: parseSettings(parsed.settings),
      },
    }
  } catch {
    const backedUp = makeBackup(raw)
    const data = createDefaultData()

    // Replace unreadable data once it is safely backed up, so every reload
    // does not create another backup of the same corrupt payload.
    if (backedUp) {
      try {
        persistNotebook(data)
      } catch {
        // The notice below still explains what happened if this write fails.
      }
    }

    return {
      data,
      notice: backedUp
        ? 'Your saved notes could not be read. A backup was kept in this browser while we started a fresh notebook.'
        : 'Your saved notes could not be read, so we started a fresh notebook.',
    }
  }
}

/**
 * Writes synchronously and deliberately lets storage errors bubble so the UI
 * can tell the user their changes may not be safe. Content is sanitized one
 * final time before it reaches persistent storage.
 */
export function persistNotebook(data: NotebookData): void {
  const safeData: NotebookData = {
    version: 1,
    notes: sortNotes(
      data.notes.map((note) => ({
        ...note,
        title: note.title.slice(0, MAX_TITLE_LENGTH),
        content: sanitizeNoteHtml(note.content),
        updatedAt: Number.isFinite(note.updatedAt) ? note.updatedAt : Date.now(),
        createdAt: Number.isFinite(note.createdAt) ? note.createdAt : Date.now(),
      })),
    ),
    activeNoteId: data.activeNoteId,
    settings: parseSettings(data.settings),
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safeData))
}

export function estimateStorageBytes(notes: Note[]): number {
  try {
    return new TextEncoder().encode(JSON.stringify(notes)).length
  } catch {
    return 0
  }
}
