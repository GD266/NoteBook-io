export interface Note {
  id: string
  title: string
  /** Sanitized rich-text HTML produced by the editor. */
  content: string
  createdAt: number
  updatedAt: number
}

export type ThemePreference = 'dark' | 'light' | 'system'
export type FontPreference = 'sans' | 'serif' | 'mono'
export type LineSpacing = 'compact' | 'balanced' | 'airy'

export interface AppSettings {
  theme: ThemePreference
  font: FontPreference
  fontSize: number
  lineSpacing: LineSpacing
  spellcheck: boolean
}

export interface NotebookData {
  version: 1
  notes: Note[]
  activeNoteId: string | null
  settings: AppSettings
}

export type SaveStatus = 'saved' | 'saving' | 'error'

export type BlockStyle = 'p' | 'h1' | 'h2'

export interface FormatState {
  bold: boolean
  italic: boolean
  underline: boolean
  bulletList: boolean
  numberedList: boolean
  block: BlockStyle
}

export interface LoadResult {
  data: NotebookData
  notice?: string
}
