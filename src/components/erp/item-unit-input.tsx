'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'

/** Quick-pick unit suggestions. The field itself accepts ANY text — these
 *  are only hints ("pcs", "mtr", "area" were requested; typing bag/ton/lot/
 *  sq ft etc. works exactly the same). */
export const UNIT_SUGGESTIONS = ['pcs', 'mtr', 'area']

interface ItemUnitInputProps {
  value: string
  onChange: (value: string) => void
  className?: string
  ariaLabel?: string
}

/**
 * Unit field for bill/quotation/order item rows.
 *
 * Uses a native <input list> + <datalist>: ONE control that shows a dropdown
 * of common units (tap to pick) AND allows free typing (e.g. "sq ft", "bag").
 * No picker library, no dialog — fastest possible UX on a phone keyboard.
 */
export function ItemUnitInput({ value, onChange, className, ariaLabel }: ItemUnitInputProps) {
  const listId = React.useId()
  return (
    <>
      <Input
        className={className}
        placeholder="Unit"
        aria-label={ariaLabel || 'Unit'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        autoComplete="off"
        inputMode="text"
      />
      <datalist id={listId}>
        {UNIT_SUGGESTIONS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </>
  )
}

export default ItemUnitInput
