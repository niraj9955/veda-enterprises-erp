'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * ProductSuggestInput — mobile-safe replacement for <input list=...><datalist>.
 *
 * WHY: native <datalist> is unreliable on mobile browsers — Android Chrome and
 * iOS Safari often only show suggestions AFTER typing, and tapping an empty
 * input shows nothing (works fine on desktop Chrome). This component renders
 * the same suggestion list as a custom dropdown that opens on focus/tap on
 * EVERY device, while keeping free-text typing fully supported (custom item
 * names like "Transportation Charge" still work).
 *
 * Behaviour:
 *  - Focus / tap        -> opens the suggestion list (all options when empty).
 *  - Typing             -> filters options case-insensitively (substring).
 *  - Tap / click option -> fills the value and closes.
 *  - Keyboard           -> ArrowUp/Down + Enter/Tab select, Escape closes.
 *                          (Enter is preventDefault-ed only while the list is
 *                          open so the surrounding form does not submit.)
 *  - No matches         -> dropdown hidden, user keeps typing freely.
 *  - Outside pointerdown -> closes.
 */

interface ProductSuggestInputProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  className?: string
  ariaLabel?: string
}

export function ProductSuggestInput({ value, onChange, options, placeholder, className, ariaLabel }: ProductSuggestInputProps) {
  const [open, setOpen] = React.useState(false)
  const [highlight, setHighlight] = React.useState(-1)
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const query = value.trim().toLowerCase()
  const filtered = React.useMemo(() => {
    if (!query) return options
    return options.filter((o) => o.toLowerCase().includes(query))
  }, [options, query])

  const close = React.useCallback(() => {
    setOpen(false)
    setHighlight(-1)
  }, [])

  // Close on any pointer press outside the wrapper (touch + mouse).
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open, close])

  // Keep the highlighted option in view during keyboard navigation.
  React.useEffect(() => {
    if (highlight < 0 || !listRef.current) return
    const el = listRef.current.children[highlight] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  const pick = (option: string) => {
    onChange(option)
    close()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlight >= 0 && highlight < filtered.length) {
      // Only swallow Enter when the user is actually navigating the list —
      // otherwise the surrounding <form> submit behaviour stays unchanged.
      e.preventDefault()
      pick(filtered[highlight])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <Input
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHighlight(-1)
        }}
        onFocus={() => setOpen(true)}
        // Click must ALSO open: a re-tap on an already-focused input fires no
        // focus event (classic mobile trap — e.g. reopening the list right
        // after selecting an option), so focus alone is not enough.
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {filtered.map((opt, i) => (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={opt === value}
              // preventDefault on pointerdown keeps the input focused (mobile
              // keyboards stay open, no blur flash) and lets the click land.
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(opt)}
              className={cn(
                'block w-full truncate rounded-sm px-2 py-1.5 text-left text-sm',
                i === highlight ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ProductSuggestInput
