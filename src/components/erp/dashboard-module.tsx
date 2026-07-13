'use client'

import { useAppStore, type ModuleKey } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'

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

export default function DashboardModule() {
  const { setActiveModule } = useAppStore()

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

      {/* Tiles grid — bigger cards, real photos, no data */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {TILES.map((tile) => (
          <button
            key={tile.module}
            type="button"
            onClick={() => setActiveModule(tile.module)}
            className={`group relative overflow-hidden rounded-2xl shadow-lg ${tile.glow} hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 cursor-pointer aspect-[4/3] bg-gradient-to-br ${tile.gradient}`}
            aria-label={`Open ${tile.label} module`}
          >
            {/* Real photo as the visual centerpiece */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tile.image}
              alt={tile.label}
              loading="lazy"
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
