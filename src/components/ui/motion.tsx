'use client'

import * as React from 'react'
import { motion, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Veda ERP Motion System (EXPERIMENTAL)
 * =====================================
 * Small, reusable, performance-safe animation primitives built on
 * framer-motion. Everything is transform/opacity only (GPU friendly),
 * and every component respects `prefers-reduced-motion` (accessibility:
 * users who disable motion in their OS settings get static UI).
 *
 * TO REVERT: remove this file + remove its usages (search "motion.tsx
 * imports" below) — nothing else in the app depends on it.
 *
 * Usage map (so a revert is easy):
 *  - src/app/page.tsx        → <FadeIn> around <ModuleRenderer> (module switch)
 *  - login-page.tsx          → <FadeUp> on the login card
 *  - dashboard-module.tsx    → <Stagger>/<StaggerItem> on tiles
 *  - app-shell.tsx           → CSS micro-interactions only (no imports)
 */

interface MotionProps {
  children: React.ReactNode
  className?: string
  /** Delay in seconds before the entrance starts. */
  delay?: number
  /** Duration in seconds. */
  duration?: number
}

/**
 * FadeIn — opacity-only entrance. Safe to wrap ANY content including
 * fixed-position children (no transform = no containing-block side effects).
 */
export function FadeIn({ children, className, delay = 0, duration = 0.28 }: MotionProps) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

/**
 * FadeUp — fade + gentle 12px rise. Use for cards, headers, standalone
 * blocks. Do NOT wrap fixed-position elements (chat widget etc.).
 */
export function FadeUp({ children, className, delay = 0, duration = 0.38 }: MotionProps) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** Stagger container — direct <StaggerItem> children animate in sequence. */
export function Stagger({ children, className, step = 0.05, delay = 0 }: MotionProps & { step?: number }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: step, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  )
}

/** StaggerItem — one child inside <Stagger>. Fades in with a soft rise. */
export function StaggerItem({ children, className }: MotionProps) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 0.61, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  )
}

/**
 * AnimatedNumber — value counts up/down smoothly instead of jumping.
 * Indian-style grouping by default via toLocaleString('en-IN').
 */
export function AnimatedNumber({
  value,
  className,
  format,
}: {
  value: number
  className?: string
  format?: (n: number) => string
}) {
  const reduce = useReducedMotion()
  const spring = useSpring(value, { stiffness: 90, damping: 22, mass: 0.6 })
  const display = useTransform(spring, (v) =>
    format ? format(v) : Math.round(v).toLocaleString('en-IN')
  )
  React.useEffect(() => {
    spring.set(value)
  }, [value, spring])
  if (reduce) {
    return <span className={className}>{format ? format(value) : value.toLocaleString('en-IN')}</span>
  }
  return <motion.span className={className}>{display}</motion.span>
}

/**
 * HoverCard — subtle lift + shadow on hover/focus (desktop pointers only).
 * Wraps any card-like block.
 */
export function HoverCard({ children, className }: MotionProps) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      whileHover={{ y: -3, transition: { duration: 0.18, ease: 'easeOut' } }}
      whileTap={{ scale: 0.985 }}
    >
      {children}
    </motion.div>
  )
}

export default { FadeIn, FadeUp, Stagger, StaggerItem, AnimatedNumber, HoverCard }
