'use client'

import React from 'react'

// ═══ ScrollableTable ════════════════════════════════════════════════════════
// A single scroll container that gives a table:
//   • vertical scroll (capped by `maxHeight`)
//   • horizontal scroll (native scrollbar)
//   • a STICKY HEADER that stays pinned at the top while you scroll
//
// Why we need the `scrollable-table-wrapper` class: the shadcn `Table`
// component wraps `<table>` in its own `<div className="overflow-x-auto">`,
// which creates a new scroll context. That interferes with `position: sticky`
// on the header — the header ends up sticking to the inner wrapper (which
// has no height constraint) instead of the outer ScrollableTable.
//
// The CSS rule `.scrollable-table-wrapper [data-slot="table-container"]`
// overrides that inner wrapper's `overflow` to `visible`, so the only
// scroll context is this component's outer div — and `sticky top-0` on
// `<thead>` works correctly.
//
// Header stickiness is achieved with the `.sticky-header` class applied to
// `<TableHeader>`. The CSS rule for `.sticky-header th` pins each `<th>`
// to the top of the scroll container.
// ════════════════════════════════════════════════════════════════════════════
export function ScrollableTable({
  children,
  maxHeight = 'max-h-[60vh]',
  className = '',
}: {
  children: React.ReactNode
  maxHeight?: string
  className?: string
}) {
  return (
    <div
      className={`scrollable-table-wrapper rounded-md border overflow-auto ${maxHeight} ${className}`}
    >
      <div className="w-full min-w-max">{children}</div>
    </div>
  )
}
