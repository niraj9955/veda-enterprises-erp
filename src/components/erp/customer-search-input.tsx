'use client'

import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, UserCheck, X, Loader2 } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// CustomerSearchInput — reusable searchable customer picker
//
// Replaces the old `<Select>` dropdown approach which becomes unusable
// when the customer list grows past a few dozen records. This component
// does live debounced search against /api/customers?search=... so even
// with thousands of customers, the user can find anyone by typing a few
// characters of their name or mobile number.
//
// Usage:
//   <CustomerSearchInput
//     value={formData.customerId}
//     onSelect={(c) => setFormData({ ...formData, customerId: c.id })}
//     onClear={() => setFormData({ ...formData, customerId: '' })}
//     required
//   />
// ─────────────────────────────────────────────────────────────────────────────

export interface CustomerOption {
  id: string
  name: string
  mobile?: string
  address?: string
  gstNumber?: string
}

interface Props {
  value: string | null | undefined
  onSelect: (customer: CustomerOption) => void
  onClear?: () => void
  placeholder?: string
  label?: string
  required?: boolean
  disabled?: boolean
  // Show the selected customer's name in the trigger instead of a generic
  // "Selected" label. Default true.
  showSelectedName?: boolean
  // Optional initial name to display when value is set but we haven't
  // fetched the customer record yet (e.g. on edit screens).
  initialSelectedName?: string
  className?: string
}

export default function CustomerSearchInput({
  value,
  onSelect,
  onClear,
  placeholder = 'Type customer name or mobile to search...',
  label = 'Customer',
  required = false,
  disabled = false,
  showSelectedName = true,
  initialSelectedName = '',
  className = '',
}: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerOption[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selectedName, setSelectedName] = useState(initialSelectedName)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // When the parent passes a new value (e.g. editing an existing record),
  // update the displayed selected name. If we don't have a name yet, try
  // to look it up by ID via the API.
  useEffect(() => {
    if (value && !selectedName) {
      // Try to find the customer's name from the API. We use the search
      // endpoint since there's no getById endpoint exposed via api.ts.
      // This is best-effort — if it fails, we just show the ID suffix.
      api.getCustomers('').then((data) => {
        const match = (data.customers as any[]).find((c) => c.id === value)
        if (match) setSelectedName(match.name)
      }).catch(() => {})
    }
    if (!value) {
      setSelectedName('')
    }
  }, [value, selectedName])

  // Debounced search — fires 350ms after the user stops typing
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const data = await api.getCustomers(query.trim())
        const list: CustomerOption[] = (data.customers as any[]).map((c) => ({
          id: c.id,
          name: c.name,
          mobile: c.mobile || '',
          address: c.address || '',
          gstNumber: c.gstNumber || '',
        }))
        setResults(list)
        setOpen(list.length > 0)
      } catch {
        setResults([])
        setOpen(false)
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handlePick = (c: CustomerOption) => {
    setSelectedName(c.name)
    onSelect(c)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const handleClear = () => {
    setSelectedName('')
    setQuery('')
    setResults([])
    setOpen(false)
    onClear?.()
    // Refocus the search input so the user can immediately search again
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const isLinked = !!value

  return (
    <div className={`grid gap-2 ${className}`}>
      {label && (
        <Label>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      <div ref={boxRef} className="relative">
        {isLinked ? (
          // Selected state — show the customer's name + Unlink button
          <div className="flex items-center justify-between gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-md px-3 py-2">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-medium truncate">
                {showSelectedName ? (selectedName || `Customer #${value.slice(-6)}`) : 'Customer selected'}
              </span>
              {selectedName && (
                <Badge variant="outline" className="text-[10px] shrink-0">Linked</Badge>
              )}
            </div>
            {!disabled && onClear && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs shrink-0"
                onClick={handleClear}
              >
                <X className="h-3 w-3 mr-1" /> Change
              </Button>
            )}
          </div>
        ) : (
          // Search state — input with dropdown results
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={inputRef}
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => results.length > 0 && setOpen(true)}
                className="pl-9"
                disabled={disabled}
                autoComplete="off"
              />
              {loading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground flex items-center gap-1 pointer-events-none">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </span>
              )}
            </div>

            {open && (
              <div className="absolute z-50 mt-1 w-full bg-background border rounded-md shadow-lg max-h-72 overflow-auto">
                {results.length > 0 ? (
                  results.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => handlePick(c)}
                      className="w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-b last:border-0 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[c.mobile, c.address].filter(Boolean).join(' • ') || 'No contact info'}
                          </p>
                        </div>
                        {c.gstNumber && (
                          <Badge variant="outline" className="text-[10px] shrink-0">GST</Badge>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  !loading && query.trim() && (
                    <div className="px-3 py-3 text-sm text-muted-foreground">
                      No matching customers found.
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
