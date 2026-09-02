'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * LoginScene3D (EXPERIMENTAL — part of the motion system)
 * =======================================================
 * Pure-CSS animated 3D backdrop for the login page:
 *   1. Deep emerald base gradient
 *   2. Drifting aurora blobs (blurred colored orbs)
 *   3. Perspective grid floor scrolling toward the viewer
 *   4. A slowly rotating 3D glass cube (real CSS 3D — 6 faces)
 *   5. Floating glass orbs + twinkling sparkles
 *   6. Vignette to keep the center focused
 *
 * Everything is pointer-events-none, transform/opacity only (GPU friendly),
 * and the global prefers-reduced-motion rule in globals.css disables all
 * animation for users who opt out of motion.
 *
 * TO REVERT: remove this file + its usage in login-page.tsx.
 */

/** Real CSS 3D cube — 6 translucent faces rotating slowly. */
function GlassCube({ size = 84, className }: { size?: number; className?: string }) {
  const half = size / 2
  const faces = [
    `rotateY(0deg) translateZ(${half}px)`,
    `rotateY(90deg) translateZ(${half}px)`,
    `rotateY(180deg) translateZ(${half}px)`,
    `rotateY(-90deg) translateZ(${half}px)`,
    `rotateX(90deg) translateZ(${half}px)`,
    `rotateX(-90deg) translateZ(${half}px)`,
  ]
  return (
    <div
      className={cn('ved-cube-spin relative', className)}
      style={{ width: size, height: size, transformStyle: 'preserve-3d' }}
      aria-hidden
    >
      {faces.map((t, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-lg border border-emerald-300/25 bg-gradient-to-br from-emerald-400/12 via-teal-400/8 to-cyan-300/12 shadow-[0_0_24px_rgba(52,211,153,0.12)]"
          style={{ transform: t, backfaceVisibility: 'visible' }}
        />
      ))}
    </div>
  )
}

/** Small glowing orb with a soft float. */
function Orb({ className, slow }: { className?: string; slow?: boolean }) {
  return (
    <div
      className={cn('absolute rounded-full', slow ? 'ved-float-slow' : 'ved-float', className)}
      aria-hidden
    />
  )
}

/** Tiny twinkling sparkle dot. */
function Sparkle({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <span
      className={cn('ved-twinkle absolute size-1 rounded-full bg-emerald-200', className)}
      style={{ animationDelay: `${delay}s` }}
      aria-hidden
    />
  )
}

export function LoginScene3D() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
      {/* 1. Base: deep emerald night gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,#064e3b_0%,#022c22_45%,#010f0b_100%)]" />

      {/* 2. Aurora blobs — large blurred color fields drifting slowly */}
      <div className="ved-drift-a absolute -top-[15%] -left-[10%] h-[55vmax] w-[55vmax] rounded-full bg-emerald-500/25 blur-[110px] mix-blend-screen" />
      <div className="ved-drift-b absolute top-[30%] -right-[15%] h-[50vmax] w-[50vmax] rounded-full bg-teal-400/20 blur-[120px] mix-blend-screen" />
      <div className="ved-drift-c absolute -bottom-[20%] left-[15%] h-[45vmax] w-[45vmax] rounded-full bg-amber-400/12 blur-[110px] mix-blend-screen" />

      {/* 3. Perspective grid floor — scrolling toward the viewer */}
      <div
        className="ved-grid-move absolute inset-x-[-50%] bottom-[-6%] h-[58%] origin-bottom bg-[linear-gradient(rgba(110,231,183,0.28)_1.5px,transparent_1.5px),linear-gradient(90deg,rgba(110,231,183,0.28)_1.5px,transparent_1.5px)] bg-[size:44px_44px] opacity-70 [mask-image:linear-gradient(to_top,rgba(0,0,0,0.9)_0%,rgba(0,0,0,0.35)_45%,transparent_75%)] [transform:perspective(620px)_rotateX(64deg)]"
      />

      {/* 4. Rotating 3D glass cubes (needs a perspective parent each) */}
      <div className="absolute top-[10%] right-[8%] [perspective:900px]">
        <GlassCube size={88} />
      </div>
      <div className="absolute bottom-[18%] left-[6%] hidden sm:block [perspective:900px]">
        <GlassCube size={56} className="opacity-80" />
      </div>

      {/* 5. Floating glass orbs */}
      <Orb className="top-[16%] left-[12%] size-24 bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.5),rgba(16,185,129,0.18)_45%,transparent_70%)] blur-[2px] shadow-[0_0_40px_rgba(16,185,129,0.25)]" />
      <Orb slow className="top-[58%] right-[14%] size-14 bg-[radial-gradient(circle_at_30%_28%,rgba(255,255,255,0.45),rgba(45,212,191,0.2)_50%,transparent_72%)] blur-[1px] shadow-[0_0_30px_rgba(45,212,191,0.28)]" />
      <Orb className="bottom-[10%] right-[30%] size-20 bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.4),rgba(251,191,36,0.16)_48%,transparent_72%)] blur-[2px] shadow-[0_0_36px_rgba(251,191,36,0.2)]" />

      {/* 6. Sparkles */}
      <Sparkle className="top-[22%] left-[28%]" delay={0} />
      <Sparkle className="top-[36%] right-[26%]" delay={0.7} />
      <Sparkle className="top-[64%] left-[18%]" delay={1.4} />
      <Sparkle className="top-[12%] left-[48%]" delay={2.1} />
      <Sparkle className="bottom-[24%] right-[40%]" delay={1.1} />
      <Sparkle className="top-[44%] left-[6%] sm:hidden" delay={1.8} />

      {/* 7. Vignette — darkens the edges so the card stays the hero */}
      <div className="absolute inset-0 bg-[radial-gradient(90%_75%_at_50%_45%,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  )
}

export default LoginScene3D
