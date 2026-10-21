import { useId } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'

interface SegmentOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
  preview?: string
  previewClassName?: string
}

interface SegmentedControlProps<T extends string> {
  label: string
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
  layout?: 'inline' | 'cards'
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  layout = 'inline',
}: SegmentedControlProps<T>) {
  const groupName = useId()

  return (
    <fieldset className="setting-field">
      <legend className="setting-label">{label}</legend>
      <div className={cn('segmented', layout === 'cards' && 'segmented-cards')}>
        {options.map((option) => {
          const Icon = option.icon
          const active = option.value === value

          return (
            <label
              key={option.value}
              className="segment"
              data-active={active ? 'true' : 'false'}
            >
              <input
                type="radio"
                name={groupName}
                value={option.value}
                checked={active}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {Icon ? <Icon size={14} strokeWidth={1.8} aria-hidden="true" /> : null}
              {option.preview ? (
                <span
                  className={cn('segment-preview', option.previewClassName)}
                  aria-hidden="true"
                >
                  {option.preview}
                </span>
              ) : null}
              <span>{option.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
