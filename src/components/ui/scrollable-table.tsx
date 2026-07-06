'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'

// ═══ ScrollableTable ════════════════════════════════════════════════════════
// A wrapper that gives a table BOTH vertical scroll (capped by maxHeight) AND
// a horizontal scrollbar that is ALWAYS visible at the bottom of the viewport.
//
// Why we need this: a plain `overflow-auto` div puts the horizontal scrollbar
// at the bottom of the SCROLL CONTENT — so when a table has 48 rows, the user
// has to scroll all the way down to reach the horizontal scrollbar. That makes
// wide tables (e.g. Production with 14 columns) unusable.
//
// This component uses two synced scroll areas:
//   1. The main area scrolls both vertically and horizontally (but its native
//      horizontal scrollbar is hidden via CSS).
//   2. A thin "fake" horizontal scrollbar below the main area is always
//      visible and is bidirectionally synced with the main area's scrollLeft.
//
// Result: the user always sees a horizontal scrollbar at the bottom of the
// visible area, no matter how many rows the table has.
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
  const bodyRef = useRef<HTMLDivElement>(null)
  const fakeScrollRef = useRef<HTMLDivElement>(null)
  const [contentWidth, setContentWidth] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)

  // Measure the inner content width AND the viewport width so the fake
  // scrollbar only shows when content is actually wider than the viewport.
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const measure = () => {
      const inner = body.firstElementChild as HTMLElement | null
      if (inner) {
        setContentWidth(inner.scrollWidth)
        setViewportWidth(body.clientWidth)
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(body)
    if (body.firstElementChild) ro.observe(body.firstElementChild as Element)
    return () => ro.disconnect()
  }, [children])

  const onBodyScroll = useCallback(() => {
    if (bodyRef.current && fakeScrollRef.current) {
      fakeScrollRef.current.scrollLeft = bodyRef.current.scrollLeft
    }
  }, [])

  const onFakeScroll = useCallback(() => {
    if (bodyRef.current && fakeScrollRef.current) {
      bodyRef.current.scrollLeft = fakeScrollRef.current.scrollLeft
    }
  }, [])

  const showFakeBar = contentWidth > viewportWidth

  return (
    <div className={`flex flex-col rounded-md border overflow-hidden ${className}`}>
      <div
        ref={bodyRef}
        onScroll={onBodyScroll}
        className={`${maxHeight} overflow-auto scrollable-table-body`}
      >
        <div className="min-w-max">{children}</div>
      </div>
      {showFakeBar && (
        <div
          ref={fakeScrollRef}
          onScroll={onFakeScroll}
          className="overflow-x-auto overflow-y-hidden border-t bg-muted/40 scrollable-table-fakebar"
        >
          <div style={{ width: contentWidth, height: 12 }} />
        </div>
      )}
    </div>
  )
}
