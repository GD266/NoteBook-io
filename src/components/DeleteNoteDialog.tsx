import { FileText, Trash2 } from 'lucide-react'
import type { Note } from '../types'
import { noteTitle } from '../lib/utils'
import { Dialog } from './Dialog'

interface DeleteNoteDialogProps {
  note: Note | null
  onClose: () => void
  onConfirm: () => void
}

export function DeleteNoteDialog({ note, onClose, onConfirm }: DeleteNoteDialogProps) {
  const title = noteTitle(note)

  return (
    <Dialog
      open={Boolean(note)}
      onClose={onClose}
      title="Delete this note?"
      description="This can't be undone."
      icon={<Trash2 size={19} strokeWidth={1.8} />}
      tone="danger"
      size="sm"
      footer={
        <>
          <button
            type="button"
            className="button-secondary button-small"
            onClick={onClose}
            data-autofocus
          >
            Cancel
          </button>
          <button type="button" className="button-danger button-small" onClick={onConfirm}>
            Delete note
          </button>
        </>
      }
    >
      <p className="confirm-copy">
        This will permanently remove the note from this browser.
      </p>
      <div className="confirm-note">
        <span className="confirm-note-icon" aria-hidden="true">
          <FileText size={16} strokeWidth={1.8} />
        </span>
        <span className="confirm-note-title">{title}</span>
      </div>
    </Dialog>
  )
}
