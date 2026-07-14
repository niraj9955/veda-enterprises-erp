'use client'

import React from 'react'
import { useAppStore, type ModuleKey } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { useAiConfig } from '@/hooks/use-ai-config'
import { Sparkles, Mic, MessageSquare, ArrowRight } from 'lucide-react'

// ─── Tile configuration ──────────────────────────────────────────────────────
// Each tile carries: real image URL, label, target module, accent gradient
// (used for hover glow + bottom bar tint). NO data / numbers are shown —
// the card is purely a navigation tile, exactly as the user requested.
//
// Images were fetched via z-ai image-search (Pexels / Unsplash / public web
// sources) and re-hosted on the ZAI OSS CDN for stable embedding.

interface Tile {
  label: string
  module: ModuleKey
  image: string          // real photo URL (OSS-hosted)
  gradient: string       // tailwind gradient used for the bottom label bar + glow
  glow: string           // shadow color on hover
}

const TILES: Tile[] = [
  {
    label: 'Production',
    module: 'production',
    image: 'https://sfile.chatglm.cn/images-ppt/ec011a3ede9a.jpg',
    gradient: 'from-emerald-600/90 to-emerald-900/95',
    glow: 'hover:shadow-emerald-500/50',
  },
  {
    label: 'Daily Sell',
    module: 'dailySell',
    image: 'https://sfile.chatglm.cn/images-ppt/6b4f87adbfd5.jpg',
    gradient: 'from-amber-600/90 to-orange-900/95',
    glow: 'hover:shadow-orange-500/50',
  },
  {
    label: 'Customer Payment',
    module: 'customerPayment',
    image: 'https://sfile.chatglm.cn/images-ppt/bed973270a5f.jpg',
    gradient: 'from-emerald-600/90 to-green-900/95',
    glow: 'hover:shadow-green-500/50',
  },
  {
    label: 'Stock Overview',
    module: 'stock',
    image: 'https://sfile.chatglm.cn/images-ppt/4d2446ac83c8.jpg',
    gradient: 'from-sky-600/90 to-indigo-900/95',
    glow: 'hover:shadow-blue-500/50',
  },
  {
    label: 'Orders',
    module: 'orders',
    image: 'https://sfile.chatglm.cn/images-ppt/56ab6c2bcaa3.jpg',
    gradient: 'from-indigo-600/90 to-violet-900/95',
    glow: 'hover:shadow-violet-500/50',
  },
  {
    label: 'Dispatch',
    module: 'dispatch',
    image: 'https://sfile.chatglm.cn/images-ppt/e8f45a6c8b3c.png',
    gradient: 'from-fuchsia-600/90 to-rose-900/95',
    glow: 'hover:shadow-pink-500/50',
  },
  {
    label: 'Expenses',
    module: 'expenses',
    image: 'https://sfile.chatglm.cn/images-ppt/b8438edc0259.jpg',
    gradient: 'from-violet-600/90 to-fuchsia-900/95',
    glow: 'hover:shadow-purple-500/50',
  },
  {
    label: 'Labour Payment',
    module: 'labourPayment',
    image: 'https://sfile.chatglm.cn/images-ppt/0f169f383e3e.jpg',
    gradient: 'from-rose-600/90 to-red-900/95',
    glow: 'hover:shadow-red-500/50',
  },
  {
    label: 'Tractor Payment',
    module: 'tractorPayment',
    image: 'https://sfile.chatglm.cn/images-ppt/82c7a4486d5e.jpeg',
    gradient: 'from-yellow-600/90 to-orange-900/95',
    glow: 'hover:shadow-amber-500/50',
  },
  {
    label: 'Dust Purchase',
    module: 'dustPurchase',
    image: 'https://sfile.chatglm.cn/images-ppt/7f175ecb08f6.jpg',
    gradient: 'from-stone-600/90 to-amber-900/95',
    glow: 'hover:shadow-stone-500/50',
  },
  {
    label: 'Cement Purchase',
    module: 'cementPurchase',
    image: 'https://sfile.chatglm.cn/images-ppt/3229c31b8653.jpg',
    gradient: 'from-slate-600/90 to-sky-900/95',
    glow: 'hover:shadow-slate-500/50',
  },
  {
    label: 'Hardner',
    module: 'hardner',
    image: 'https://sfile.chatglm.cn/images-ppt/9eab8d3bb5d8.jpg',
    gradient: 'from-cyan-600/90 to-blue-900/95',
    glow: 'hover:shadow-cyan-500/50',
  },
  {
    label: 'Electricity',
    module: 'electricity',
    image: 'https://sfile.chatglm.cn/images-ppt/e5e222ccdcd4.jpg',
    gradient: 'from-yellow-500/90 to-orange-800/95',
    glow: 'hover:shadow-yellow-500/50',
  },
  {
    label: 'Factory Stuff',
    module: 'factoryStuff',
    image: 'https://sfile.chatglm.cn/images-ppt/55cb0c7b2710.jpg',
    gradient: 'from-teal-600/90 to-green-900/95',
    glow: 'hover:shadow-teal-500/50',
  },
  {
    label: 'Bills',
    module: 'bills',
    image: 'https://sfile.chatglm.cn/images-ppt/c81b564bcf70.jpg',
    gradient: 'from-slate-600/90 to-zinc-900/95',
    glow: 'hover:shadow-gray-500/50',
  },
  {
    label: 'Customers',
    module: 'customers',
    image: 'https://sfile.chatglm.cn/images-ppt/a430edd9b2f5.jpg',
    gradient: 'from-pink-600/90 to-red-900/95',
    glow: 'hover:shadow-rose-500/50',
  },
  {
    label: 'Reports',
    module: 'reports',
    image: 'https://sfile.chatglm.cn/images-ppt/99feedd88280.png',
    gradient: 'from-blue-600/90 to-violet-900/95',
    glow: 'hover:shadow-indigo-500/50',
  },
  {
    label: 'Settings',
    module: 'settings',
    image: 'https://sfile.chatglm.cn/images-ppt/52b54b2a4777.jpg',
    gradient: 'from-zinc-600/90 to-slate-900/95',
    glow: 'hover:shadow-slate-500/50',
  },
]

// ─── Component ───────────────────────────────────────────────────────────────

// Memoized single tile — prevents all 18 tiles from re-rendering when the
// parent component re-renders (e.g. when the sidebar toggles). The only
// prop that ever changes is `onClick` (stable from useAppStore), so React.memo
// skips re-renders entirely after the first paint.
const DashboardTile = React.memo(function DashboardTile({
  tile,
  onClick,
}: {
  tile: Tile
  onClick: () => void
}) {
  return (
    <button
      key={tile.module}
      type="button"
      onClick={onClick}
      // Use will-change to hint to the browser that this element will
      // transform on hover, so the compositor can promote it to its own
      // layer and avoid repaints during the hover animation.
      className={`group relative overflow-hidden rounded-2xl shadow-lg ${tile.glow} hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 cursor-pointer aspect-[4/3] bg-gradient-to-br ${tile.gradient} will-change-transform`}
      aria-label={`Open ${tile.label} module`}
    >
      {/* Real photo as the visual centerpiece.
          We use loading="lazy" + decoding="async" + fetchPriority="low" so
          images don't compete with critical-path JS during initial paint.
          width/height are intrinsic to prevent layout shift. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tile.image}
        alt={tile.label}
        loading="lazy"
        decoding="async"
        // @ts-expect-error - fetchPriority is a valid HTML attribute but not yet in the React TS types
        fetchpriority="low"
        width={400}
        height={300}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 group-active:scale-95"
      />

      {/* Dark gradient overlay for label readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

      {/* Top-left accent dot (for visual rhythm) */}
      <div className="absolute top-3 left-3 size-2 rounded-full bg-white/80 shadow-sm" />

      {/* Bottom label bar with gradient tint */}
      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t ${tile.gradient} px-4 py-3 flex items-center justify-between backdrop-blur-sm`}>
        <span className="text-white font-bold text-sm sm:text-base tracking-wide drop-shadow-lg">
          {tile.label}
        </span>
        <span className="text-white/90 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
          Open →
        </span>
      </div>
    </button>
  )
})

export default function DashboardModule() {
  const { setActiveModule } = useAppStore()
  const { isEnabled, loading: aiLoading } = useAiConfig()
  const [aiBannerDismissed, setAiBannerDismissed] = React.useState(false)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tap any tile below to jump straight to that module.
        </p>
      </div>

      {/* AI Assistant banner — only shown when AI is enabled and not dismissed */}
      {isEnabled && !aiLoading && !aiBannerDismissed && (
        <Card className="border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-emerald-900/20 dark:to-amber-900/10 overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base text-emerald-800 dark:text-emerald-300">
                    AI Assistant is ON
                  </h3>
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200">
                    Active
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 mt-1 leading-relaxed">
                  Form bharna ab aur aasaan. Bottom-right corner me green button dabaiye, <b>Hindi/English me boliye ya type karein</b> — AI form fields auto-fill kar dega.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300 bg-white/60 dark:bg-zinc-900/40 px-2 py-1 rounded">
                    <Mic className="h-3 w-3" /> Voice input
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300 bg-white/60 dark:bg-zinc-900/40 px-2 py-1 rounded">
                    <MessageSquare className="h-3 w-3" /> Chat interface
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveModule('dailySell')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200 px-2 py-1 rounded hover:bg-white/80 dark:hover:bg-zinc-900/60"
                  >
                    Try on Daily Sell <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiBannerDismissed(true)}
                className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 text-xs shrink-0"
                aria-label="Dismiss"
              >
                Dismiss
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* When AI is disabled, show a subtle hint to admins to enable it */}
      {!aiLoading && !isEnabled && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <CardContent className="p-3 sm:p-4 text-xs sm:text-sm flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-amber-800 dark:text-amber-300">
                <b>AI Assistant</b> abhi disabled hai. Admin Panel → AI Assistant me jakar Groq (free) ya OpenAI key daalein, fir Hindi/English me bol kar ya type kar ke forms auto-fill kar sakte hain.
              </p>
              <button
                type="button"
                onClick={() => setActiveModule('admin')}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:underline"
              >
                Open Admin Panel <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tiles grid — bigger cards, real photos, no data */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {TILES.map((tile) => (
          <DashboardTile
            key={tile.module}
            tile={tile}
            onClick={() => setActiveModule(tile.module)}
          />
        ))}
      </div>

      {/* Footer hint card */}
      <Card className="border-dashed">
        <CardContent className="p-5 text-center">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Tip:</span>{' '}
            Click any tile above to open its module. Each tile is a shortcut — no data is shown on the dashboard by design.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
