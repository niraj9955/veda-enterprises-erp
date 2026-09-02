'use client'

import * as React from 'react'
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion'

/**
 * TiltCard (EXPERIMENTAL — part of the motion system)
 * ===================================================
 * 3D perspective tilt that follows the mouse (desktop). On touch devices
 * there is no hover, so users just get the entrance animation. Respects
 * prefers-reduced-motion (renders a plain static div).
 *
 * The child is rendered inside a preserve-3d layer, so you can give inner
 * elements translateZ() for real depth — as long as no intermediate element
 * uses backdrop-filter (it flattens 3D).
 *
 * TO REVERT: remove this file + its usage in login-page.tsx.
 */

interface TiltCardProps {
  children: React.ReactNode
  className?: string
  /** Max tilt in degrees. Default 6 — keep small, it sits behind a form. */
  max?: number
}

export function TiltCard({ children, className, max = 6 }: TiltCardProps) {
  const reduce = useReducedMotion()
  // Normalized pointer position 0..1 within the card
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 170, damping: 22 })
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 170, damping: 22 })

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return // touch → no tilt
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    px.set((e.clientX - rect.left) / rect.width)
    py.set((e.clientY - rect.top) / rect.height)
  }
  const onPointerLeave = () => {
    px.set(0.5)
    py.set(0.5)
  }

  if (reduce) return <div className={className}>{children}</div>

  return (
    <div className={className} style={{ perspective: 1100 }}>
      <motion.div
        // Entrance + tilt on the same layer
        initial={{ opacity: 0, y: 22, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1] }}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        {children}
      </motion.div>
    </div>
  )
}

export default TiltCard
