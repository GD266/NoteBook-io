import type { ReactNode } from 'react'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Underline,
} from 'lucide-react'
import type { BlockStyle, FormatState } from '../types'
import { formatShortcut } from '../lib/utils'

interface FormattingToolbarProps {
  state: FormatState
  onInline: (command: 'bold' | 'italic' | 'underline') => void
  onBlock: (block: BlockStyle) => void
  onList: (kind: 'bullet' | 'numbered') => void
}

interface ToolbarButtonProps {
  label: string
  shortcut?: string
  active: boolean
  onClick: () => void
  children: ReactNode
}

function ToolbarButton({
  label,
  shortcut,
  active,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className="toolbar-button"
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function FormattingToolbar({
  state,
  onInline,
  onBlock,
  onList,
}: FormattingToolbarProps) {
  return (
    <div className="formatting-bar" role="toolbar" aria-label="Text formatting">
      <div className="toolbar-group" role="group" aria-label="Text style">
        <ToolbarButton
          label="Paragraph"
          active={state.block === 'p'}
          onClick={() => onBlock('p')}
        >
          <Pilcrow size={15} strokeWidth={1.8} />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 1"
          shortcut={formatShortcut('1', { alt: true })}
          active={state.block === 'h1'}
          onClick={() => onBlock('h1')}
        >
          <span className="toolbar-letter">H1</span>
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          shortcut={formatShortcut('2', { alt: true })}
          active={state.block === 'h2'}
          onClick={() => onBlock('h2')}
        >
          <span className="toolbar-letter">H2</span>
        </ToolbarButton>
      </div>

      <span className="toolbar-separator" role="separator" aria-orientation="vertical" />

      <div className="toolbar-group" role="group" aria-label="Inline formatting">
        <ToolbarButton
          label="Bold"
          shortcut={formatShortcut('B')}
          active={state.bold}
          onClick={() => onInline('bold')}
        >
          <Bold size={15} strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          shortcut={formatShortcut('I')}
          active={state.italic}
          onClick={() => onInline('italic')}
        >
          <Italic size={15} strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          shortcut={formatShortcut('U')}
          active={state.underline}
          onClick={() => onInline('underline')}
        >
          <Underline size={15} strokeWidth={2} />
        </ToolbarButton>
      </div>

      <span className="toolbar-separator" role="separator" aria-orientation="vertical" />

      <div className="toolbar-group" role="group" aria-label="Lists">
        <ToolbarButton
          label="Bulleted list"
          shortcut={formatShortcut('8', { shift: true })}
          active={state.bulletList}
          onClick={() => onList('bullet')}
        >
          <List size={15} strokeWidth={1.9} />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          shortcut={formatShortcut('7', { shift: true })}
          active={state.numberedList}
          onClick={() => onList('numbered')}
        >
          <ListOrdered size={15} strokeWidth={1.9} />
        </ToolbarButton>
      </div>
    </div>
  )
}
