'use client'

import React from 'react'

// ═══ ScrollableTable ════════════════════════════════════════════════════════
// A simple wrapper around a single native `overflow-auto` div.
//
// History: this component previously used a dual-scroll-area trick with a
// JS-synced "fake" bottom scrollbar to keep the horizontal scrollbar pinned
// to the bottom of the viewport. That approach caused TWO horizontal
// scrollbars to render at the bottom (the body's native one was not reliably
// hidden by `::-webkit-scrollbar:horizontal { display: none }` across browsers),
// which confused users. We've reverted to the simplest possible design:
// one scroll container, one scrollbar — both vertical and horizontal are
// handled by the browser's native scrollbar.
//
// The container's height is capped by `maxHeight` so very tall tables
// scroll vertically inside the dialog. Wide tables scroll horizontally
// with the same native scrollbar.
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
      className={`rounded-md border overflow-auto ${maxHeight} ${className}`}
    >
      <div className="min-w-max">{children}</div>
    </div>
  )
}
