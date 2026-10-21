import { Keyboard } from 'lucide-react'
import { formatShortcut, isMacPlatform } from '../lib/utils'
import { Dialog } from './Dialog'

interface ShortcutsDialogProps {
  open: boolean
  onClose: () => void
}

interface Shortcut {
  label: string
  keys: string
}

const groups: Array<{ title: string; shortcuts: Shortcut[] }> = [
  {
    title: 'Formatting',
    shortcuts: [
      { label: 'Bold', keys: formatShortcut('B') },
      { label: 'Italic', keys: formatShortcut('I') },
      { label: 'Underline', keys: formatShortcut('U') },
      { label: 'Heading 1', keys: formatShortcut('1', { alt: true }) },
      { label: 'Heading 2', keys: formatShortcut('2', { alt: true }) },
      { label: 'Bulleted list', keys: formatShortcut('8', { shift: true }) },
      { label: 'Numbered list', keys: formatShortcut('7', { shift: true }) },
    ],
  },
  {
    title: 'Notes',
    shortcuts: [
      { label: 'Save now', keys: formatShortcut('S') },
      { label: 'New note', keys: formatShortcut('N', { alt: true }) },
      { label: 'Search notes', keys: formatShortcut('K') },
      { label: 'Keyboard shortcuts', keys: formatShortcut('/') },
      { label: 'Close a dialog', keys: 'Esc' },
    ],
  },
]

function Kbd({ keys }: { keys: string }) {
  const parts = isMacPlatform() ? Array.from(keys) : keys.split(' + ')

  return (
    <span className="shortcut-keys">
      {parts.map((part, index) => (
        <kbd key={`${part}-${index}`}>{part}</kbd>
      ))}
    </span>
  )
}

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="Keep your hands on the page."
      icon={<Keyboard size={19} strokeWidth={1.7} />}
      size="md"
      footer={
        <>
          <span className="dialog-footnote">
            {isMacPlatform() ? 'Uses ⌘ on macOS.' : 'Uses Ctrl on Windows and Linux.'}
          </span>
          <button type="button" className="button-secondary button-small" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div className="shortcuts-grid">
        {groups.map((group) => (
          <section key={group.title} className="shortcut-group" aria-labelledby={`shortcut-${group.title}`}>
            <h3 id={`shortcut-${group.title}`} className="settings-section-title">
              {group.title}
            </h3>
            <dl className="shortcut-list">
              {group.shortcuts.map((shortcut) => (
                <div key={shortcut.label} className="shortcut-row">
                  <dt>{shortcut.label}</dt>
                  <dd>
                    <Kbd keys={shortcut.keys} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className="settings-hint shortcuts-note">
        Formatting shortcuts work while your cursor is inside a note. Saving also
        happens automatically as you write.
      </p>
    </Dialog>
  )
}
