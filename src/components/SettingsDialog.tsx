import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  CircleAlert,
  HardDrive,
  Lock,
  Monitor,
  Moon,
  RotateCcw,
  Settings2,
  Sun,
} from 'lucide-react'
import type { AppSettings, FontPreference, LineSpacing, ThemePreference } from '../types'
import { formatBytes, pluralize } from '../lib/utils'
import { Dialog } from './Dialog'
import { SegmentedControl } from './SegmentedControl'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  settings: AppSettings
  noteCount: number
  storageBytes: number
  saveError: string | null
  onChange: (patch: Partial<AppSettings>) => void
  onResetEditorPreferences: () => void
}

const themeOptions: Array<{
  value: ThemePreference
  label: string
  icon: LucideIcon
}> = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

const fontOptions: Array<{
  value: FontPreference
  label: string
  preview: string
  previewClassName: string
}> = [
  { value: 'sans', label: 'Sans', preview: 'Aa', previewClassName: 'preview-sans' },
  { value: 'serif', label: 'Serif', preview: 'Aa', previewClassName: 'preview-serif' },
  { value: 'mono', label: 'Mono', preview: 'Aa', previewClassName: 'preview-mono' },
]

const spacingOptions: Array<{ value: LineSpacing; label: string }> = [
  { value: 'compact', label: 'Compact' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'airy', label: 'Airy' },
]

export function SettingsDialog({
  open,
  onClose,
  settings,
  noteCount,
  storageBytes,
  saveError,
  onChange,
  onResetEditorPreferences,
}: SettingsDialogProps) {
  const rangeProgress = ((settings.fontSize - 15) / (21 - 15)) * 100

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Settings"
      description="A few quiet refinements for your writing space."
      icon={<Settings2 size={19} strokeWidth={1.7} />}
      size="lg"
      footer={
        <>
          <span className="dialog-footnote">Preferences save automatically.</span>
          <button type="button" className="button-primary button-small" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <section className="settings-section" aria-labelledby="settings-appearance">
        <div className="settings-section-head">
          <h3 id="settings-appearance" className="settings-section-title">
            Appearance
          </h3>
          <p className="settings-section-copy">Choose the light you want to write in.</p>
        </div>
        <SegmentedControl
          label="Theme"
          value={settings.theme}
          options={themeOptions}
          onChange={(theme) => onChange({ theme })}
          layout="cards"
        />
      </section>

      <section className="settings-section" aria-labelledby="settings-editor">
        <div className="settings-section-head">
          <h3 id="settings-editor" className="settings-section-title">
            Editor
          </h3>
          <p className="settings-section-copy">Shape the page around the way you think.</p>
        </div>

        <SegmentedControl
          label="Typeface"
          value={settings.font}
          options={fontOptions}
          onChange={(font) => onChange({ font })}
          layout="cards"
        />

        <div className="setting-field">
          <div className="setting-label-row">
            <label htmlFor="editor-font-size" className="setting-label">
              Text size
            </label>
            <output htmlFor="editor-font-size" className="setting-output">
              {settings.fontSize} px
            </output>
          </div>
          <div className="range-row">
            <span className="range-bound" aria-hidden="true">
              A
            </span>
            <input
              id="editor-font-size"
              type="range"
              min={15}
              max={21}
              step={1}
              value={settings.fontSize}
              onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
              className="range-input"
              style={{ '--range-progress': `${rangeProgress}%` } as CSSProperties}
              aria-valuetext={`${settings.fontSize} pixels`}
            />
            <span className="range-bound range-bound-large" aria-hidden="true">
              A
            </span>
          </div>
        </div>

        <SegmentedControl
          label="Line spacing"
          value={settings.lineSpacing}
          options={spacingOptions}
          onChange={(lineSpacing) => onChange({ lineSpacing })}
        />

        <label className="switch-row">
          <span className="switch-copy">
            <span className="switch-title">Spellcheck</span>
            <span className="switch-description">
              Underline misspelled words while you write.
            </span>
          </span>
          <span className="switch-control">
            <input
              type="checkbox"
              checked={settings.spellcheck}
              onChange={(event) => onChange({ spellcheck: event.target.checked })}
              className="sr-only"
            />
            <span className="switch-track" aria-hidden="true">
              <span className="switch-thumb" />
            </span>
          </span>
        </label>

        <div className="settings-inline-action">
          <button
            type="button"
            className="text-button"
            onClick={onResetEditorPreferences}
          >
            <RotateCcw size={13} strokeWidth={1.9} />
            Restore editor defaults
          </button>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-data">
        <div className="settings-section-head">
          <h3 id="settings-data" className="settings-section-title">
            Your data
          </h3>
        </div>

        <div className="storage-card">
          <span className="storage-icon" aria-hidden="true">
            <HardDrive size={18} strokeWidth={1.7} />
          </span>
          <div className="storage-copy">
            <p className="storage-title">Stored on this device</p>
            <p className="storage-meta">
              {noteCount} {pluralize(noteCount, 'note')} · about {formatBytes(storageBytes)}
            </p>
          </div>
          <Lock className="storage-lock" size={14} strokeWidth={1.8} aria-hidden="true" />
        </div>

        <p className="settings-hint">
          Notebook.io saves notes in this app&apos;s local storage. They don&apos;t
          sync between devices or browsers, and clearing this app&apos;s data will
          remove them permanently.
        </p>

        {saveError ? (
          <p className="setting-warning" role="alert">
            <CircleAlert size={14} strokeWidth={1.9} aria-hidden="true" />
            {saveError}
          </p>
        ) : null}
      </section>
    </Dialog>
  )
}
