import { Feather, HardDrive, Keyboard, Plus } from 'lucide-react'
import { formatShortcut } from '../lib/utils'

interface EmptyStateProps {
  hasNotes: boolean
  onCreateNote: () => void
  onOpenShortcuts: () => void
}

export function EmptyState({
  hasNotes,
  onCreateNote,
  onOpenShortcuts,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-content">
        <div className="empty-mark" aria-hidden="true">
          <Feather size={26} strokeWidth={1.5} />
        </div>

        <p className="empty-eyebrow">Your private notebook</p>
        <h1 className="empty-title">
          A quieter place
          <br />
          <em>to think.</em>
        </h1>
        <p className="empty-copy">
          Capture a thought, sketch a plan, or simply start. Everything you write
          is kept privately in this browser.
        </p>

        <div className="empty-actions">
          <button type="button" className="button-primary" onClick={onCreateNote}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            {hasNotes ? 'Create a note' : 'Create your first note'}
          </button>
          <span className="empty-shortcut" aria-hidden="true">
            <kbd>{formatShortcut('N', { alt: true })}</kbd>
          </span>
        </div>

        <button type="button" className="text-button empty-shortcuts" onClick={onOpenShortcuts}>
          <Keyboard size={14} strokeWidth={1.8} />
          View keyboard shortcuts
        </button>

        <p className="empty-local">
          <HardDrive size={13} strokeWidth={1.8} aria-hidden="true" />
          Stored only on this device
          <span aria-hidden="true">·</span>
          Never uploaded
        </p>
      </div>
    </div>
  )
}
