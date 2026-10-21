import type {
  ClipboardEvent,
  CSSProperties,
  DragEvent,
  KeyboardEvent,
  MouseEvent,
} from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Copy, Download, Keyboard } from 'lucide-react'
import type { AppSettings, BlockStyle, FormatState, Note } from '../types'
import { findExternalLinks, normalizeExternalUrl } from '../lib/links'
import { getTextStats, htmlToPlainText } from '../lib/text'
import {
  formatFullTimestamp,
  formatNumber,
  formatRelativeTime,
  noteTitle,
  pluralize,
} from '../lib/utils'
import { FormattingToolbar } from './FormattingToolbar'
import { IconButton } from './IconButton'

const FONT_STACKS: Record<AppSettings['font'], string> = {
  sans: 'var(--font-ui)',
  serif: 'var(--font-display)',
  mono: 'var(--font-mono)',
}

const LINE_HEIGHTS: Record<AppSettings['lineSpacing'], string> = {
  compact: '1.4',
  balanced: '1.55',
  airy: '1.7',
}

const EMPTY_FORMAT: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  bulletList: false,
  numberedList: false,
  block: 'p',
}

function appendTextWithBreaks(parent: Node, text: string, doc: Document) {
  const lines = text.split('\n')

  lines.forEach((line, index) => {
    if (line) parent.appendChild(doc.createTextNode(line))
    if (index < lines.length - 1) parent.appendChild(doc.createElement('br'))
  })
}

function readBlockStyle(): BlockStyle {
  try {
    const value = String(document.queryCommandValue('formatBlock'))
      .toLowerCase()
      .replace(/[<>]/g, '')
    if (value === 'h1') return 'h1'
    if (value === 'h2') return 'h2'
    return 'p'
  } catch {
    return 'p'
  }
}

function readFormatState(): FormatState {
  try {
    return {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      bulletList: document.queryCommandState('insertUnorderedList'),
      numberedList: document.queryCommandState('insertOrderedList'),
      block: readBlockStyle(),
    }
  } catch {
    return EMPTY_FORMAT
  }
}

interface EditorProps {
  note: Note
  settings: AppSettings
  now: number
  autoFocusTitle: boolean
  onTitleFocused: () => void
  onTitleChange: (title: string) => void
  onContentChange: (html: string) => void
  onFlush: () => void
  onCopy: () => void
  onDownload: () => void
  onOpenShortcuts: () => void
}

type CaretDocument = Document & {
  caretRangeFromPoint?: (x: number, y: number) => Range | null
}

export function Editor({
  note,
  settings,
  now,
  autoFocusTitle,
  onTitleFocused,
  onTitleChange,
  onContentChange,
  onFlush,
  onCopy,
  onDownload,
  onOpenShortcuts,
}: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const initialContentRef = useRef(note.content)

  const [plainText, setPlainText] = useState(() => htmlToPlainText(note.content))
  const [formatState, setFormatState] = useState<FormatState>(EMPTY_FORMAT)

  const stats = useMemo(() => getTextStats(plainText), [plainText])
  const isEmpty = plainText.length === 0

  const editorStyle = {
    '--editor-font': FONT_STACKS[settings.font],
    '--editor-font-size': `${settings.fontSize}px`,
    '--editor-line-height': LINE_HEIGHTS[settings.lineSpacing],
  } as CSSProperties

  const syncFromDom = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const html = editor.innerHTML
    setPlainText(htmlToPlainText(html))
    onContentChange(html)
  }, [onContentChange])

  const rememberSelection = useCallback(() => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    if (editor.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange()
    }
  }, [])

  const refreshFormatState = useCallback(() => {
    setFormatState(readFormatState())
  }, [])

  const insertLinkifiedText = useCallback(
    (text: string) => {
      const editor = editorRef.current
      if (!editor) return false

      const links = findExternalLinks(text)
      if (!links.length) return false

      editor.focus({ preventScroll: true })

      const fragment = document.createDocumentFragment()
      let cursor = 0

      links.forEach((link) => {
        appendTextWithBreaks(fragment, text.slice(cursor, link.start), document)

        const anchor = document.createElement('a')
        anchor.href = link.href
        anchor.target = '_blank'
        anchor.rel = 'noopener noreferrer'
        anchor.textContent = link.text
        fragment.appendChild(anchor)

        cursor = link.end
      })

      appendTextWithBreaks(fragment, text.slice(cursor), document)

      const container = document.createElement('div')
      container.appendChild(fragment)

      try {
        document.execCommand('insertHTML', false, container.innerHTML)
      } catch {
        return false
      }

      syncFromDom()
      rememberSelection()
      refreshFormatState()
      return true
    },
    [refreshFormatState, rememberSelection, syncFromDom],
  )

  useLayoutEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    editor.innerHTML = initialContentRef.current

    try {
      document.execCommand('styleWithCSS', false, 'false')
      document.execCommand('defaultParagraphSeparator', false, 'p')
    } catch {
      // Older browsers can ignore these hints; the editor still works.
    }
  }, [])

  useEffect(() => {
    if (!autoFocusTitle) return
    const input = titleRef.current
    if (!input) return

    input.focus({ preventScroll: true })
    input.select()
    onTitleFocused()
  }, [autoFocusTitle, onTitleFocused])

  useEffect(() => {
    const handleSelectionChange = () => {
      const editor = editorRef.current
      const selection = window.getSelection()
      if (!editor || !selection?.anchorNode || !editor.contains(selection.anchorNode)) {
        return
      }

      rememberSelection()
      setFormatState(readFormatState())
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [rememberSelection])

  const runCommand = useCallback(
    (command: string, value?: string) => {
      const editor = editorRef.current
      if (!editor) return

      const wasFocused = document.activeElement === editor
      editor.focus({ preventScroll: true })

      if (!wasFocused && savedRangeRef.current) {
        const selection = window.getSelection()
        try {
          selection?.removeAllRanges()
          selection?.addRange(savedRangeRef.current)
        } catch {
          // The saved node may have been replaced; the browser caret is fine.
        }
      }

      try {
        document.execCommand('styleWithCSS', false, 'false')
        document.execCommand(command, false, value)
      } catch {
        // execCommand is best-effort, but supported in every current browser.
      }

      syncFromDom()
      rememberSelection()
      refreshFormatState()
    },
    [refreshFormatState, rememberSelection, syncFromDom],
  )

  const handleBlock = useCallback(
    (block: BlockStyle) => {
      const currentBlock = readBlockStyle()
      const next = block !== 'p' && currentBlock === block ? 'p' : block
      runCommand('formatBlock', next)
    },
    [runCommand],
  )

  const handleInline = (command: 'bold' | 'italic' | 'underline') => {
    runCommand(command)
  }

  const handleList = (kind: 'bullet' | 'numbered') => {
    runCommand(kind === 'bullet' ? 'insertUnorderedList' : 'insertOrderedList')
  }

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return

    const mod = event.metaKey || event.ctrlKey
    if (!mod) return

    const key = event.key.toLowerCase()

    if (!event.altKey && !event.shiftKey && (key === 'b' || key === 'i' || key === 'u')) {
      event.preventDefault()
      runCommand(key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline')
      return
    }

    if (event.altKey && !event.shiftKey) {
      if (event.code === 'Digit1' || event.code === 'Digit2') {
        event.preventDefault()
        handleBlock(event.code === 'Digit1' ? 'h1' : 'h2')
      } else if (event.code === 'Digit0') {
        event.preventDefault()
        handleBlock('p')
      }
      return
    }

    if (event.shiftKey && !event.altKey) {
      if (event.code === 'Digit7') {
        event.preventDefault()
        handleList('numbered')
      } else if (event.code === 'Digit8') {
        event.preventDefault()
        handleList('bullet')
      }
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    if (!text) return

    if (insertLinkifiedText(text)) return

    const editor = editorRef.current
    editor?.focus({ preventScroll: true })
    document.execCommand('insertText', false, text)
    syncFromDom()
    rememberSelection()
    refreshFormatState()
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const text = event.dataTransfer.getData('text/plain')
    if (!text) return

    const editor = editorRef.current
    if (!editor) return

    const caretDoc = document as CaretDocument
    const range =
      caretDoc.caretRangeFromPoint?.(event.clientX, event.clientY) ??
      (() => {
        const position = caretDoc.caretPositionFromPoint?.(event.clientX, event.clientY)
        if (!position) return null
        const nextRange = document.createRange()
        nextRange.setStart(position.offsetNode, position.offset)
        nextRange.collapse(true)
        return nextRange
      })()

    editor.focus({ preventScroll: true })
    if (range) {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }

    if (insertLinkifiedText(text)) return

    document.execCommand('insertText', false, text)
    syncFromDom()
    rememberSelection()
    refreshFormatState()
  }

  const handleEditorClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof Element)) return

    const anchor = target.closest('a')
    if (!anchor || !event.currentTarget.contains(anchor)) return

    const href = normalizeExternalUrl(anchor.getAttribute('href') ?? '')
    if (!href) return

    event.preventDefault()

    if (isTauri()) {
      void openUrl(href).catch(() => {
        window.open(href, '_blank', 'noopener,noreferrer')
      })
      return
    }

    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const placeCaretAtEnd = () => {
    const editor = editorRef.current
    if (!editor) return

    editor.focus({ preventScroll: true })
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    rememberSelection()
  }

  return (
    <div className="editor-shell" style={editorStyle}>
      <FormattingToolbar
        state={formatState}
        onInline={handleInline}
        onBlock={handleBlock}
        onList={handleList}
      />

      <div className="editor-scroll scroll-area">
        <div className="editor-page">
          <div className="editor-kicker">
            <span className="editor-eyebrow">
              <span className="eyebrow-dot" aria-hidden="true" />
              Local note
            </span>
            <span
              className="editor-edited"
              title={`Last edited ${formatFullTimestamp(note.updatedAt)}`}
            >
              Edited {formatRelativeTime(note.updatedAt, now).toLowerCase()}
            </span>
          </div>

          <input
            ref={titleRef}
            type="text"
            className="note-title-input"
            value={note.title}
            onChange={(event) => onTitleChange(event.target.value)}
            onBlur={onFlush}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                placeCaretAtEnd()
              }
            }}
            placeholder="Untitled note"
            maxLength={120}
            aria-label="Note title"
            autoComplete="off"
            spellCheck={false}
          />

          <div className="title-rule" aria-hidden="true" />

          <div className="editor-body">
            <div
              ref={editorRef}
              className="note-editor"
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label={`Content of ${noteTitle(note)}`}
              aria-placeholder="Begin writing…"
              spellCheck={settings.spellcheck}
              onInput={syncFromDom}
              onClick={handleEditorClick}
              onKeyDown={handleEditorKeyDown}
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={(event) => event.preventDefault()}
              onBlur={onFlush}
            />
            {isEmpty ? (
              <div className="editor-placeholder" aria-hidden="true">
                Begin writing…
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <footer className="editor-footer">
        <div
          className="editor-stats"
          aria-label={`${stats.words} ${pluralize(stats.words, 'word')}, ${
            stats.characters
          } ${pluralize(stats.characters, 'character')}`}
        >
          <span>
            <strong>{formatNumber(stats.words)}</strong>{' '}
            {pluralize(stats.words, 'word')}
          </span>
          <span className="stats-divider" aria-hidden="true">
            ·
          </span>
          <span>
            <strong>{formatNumber(stats.characters)}</strong>{' '}
            {pluralize(stats.characters, 'character')}
          </span>
        </div>

        <div className="editor-actions">
          <button
            type="button"
            className="footer-button tip"
            data-tip="Copy note text"
            data-tip-placement="top"
            aria-label="Copy note text"
            onClick={onCopy}
          >
            <Copy size={14} strokeWidth={1.9} aria-hidden="true" />
            <span className="footer-button-label">Copy</span>
          </button>
          <button
            type="button"
            className="footer-button tip"
            data-tip="Download as .txt"
            data-tip-placement="top"
            aria-label="Download note as text file"
            onClick={onDownload}
          >
            <Download size={14} strokeWidth={1.9} aria-hidden="true" />
            <span className="footer-button-label">Download</span>
          </button>
          <span className="footer-separator" aria-hidden="true" />
          <IconButton
            label="Keyboard shortcuts"
            className="footer-icon-button"
            tipPlacement="top"
            onClick={onOpenShortcuts}
          >
            <Keyboard size={15} strokeWidth={1.8} />
          </IconButton>
        </div>
      </footer>
    </div>
  )
}
