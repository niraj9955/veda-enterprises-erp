'use client'

import { useAppStore, type ModuleKey } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'

// ─── Tile configuration ──────────────────────────────────────────────────────
// Each tile carries: emoji (big visual), label, target module, and a unique
// gradient background. NO data / numbers are shown — the card is purely a
// navigation tile, exactly as the user requested.

interface Tile {
  emoji: string
  label: string
  module: ModuleKey
  gradient: string        // tailwind gradient classes for the tile background
  glow: string            // shadow color on hover
}

const TILES: Tile[] = [
  {
    emoji: '🏭',
    label: 'Production',
    module: 'production',
    gradient: 'from-emerald-500 via-emerald-600 to-teal-700',
    glow: 'hover:shadow-emerald-500/40',
  },
  {
    emoji: '🛒',
    label: 'Daily Sell',
    module: 'dailySell',
    gradient: 'from-amber-500 via-orange-500 to-rose-600',
    glow: 'hover:shadow-orange-500/40',
  },
  {
    emoji: '💳',
    label: 'Customer Payment',
    module: 'customerPayment',
    gradient: 'from-emerald-500 via-green-600 to-lime-700',
    glow: 'hover:shadow-green-500/40',
  },
  {
    emoji: '📦',
    label: 'Stock Overview',
    module: 'stock',
    gradient: 'from-sky-500 via-blue-600 to-indigo-700',
    glow: 'hover:shadow-blue-500/40',
  },
  {
    emoji: '📋',
    label: 'Orders',
    module: 'orders',
    gradient: 'from-indigo-500 via-violet-600 to-purple-700',
    glow: 'hover:shadow-violet-500/40',
  },
  {
    emoji: '🚚',
    label: 'Dispatch',
    module: 'dispatch',
    gradient: 'from-fuchsia-500 via-pink-600 to-rose-700',
    glow: 'hover:shadow-pink-500/40',
  },
  {
    emoji: '💸',
    label: 'Expenses',
    module: 'expenses',
    gradient: 'from-violet-500 via-purple-600 to-fuchsia-700',
    glow: 'hover:shadow-purple-500/40',
  },
  {
    emoji: '👷',
    label: 'Labour Payment',
    module: 'labourPayment',
    gradient: 'from-rose-500 via-red-600 to-rose-800',
    glow: 'hover:shadow-red-500/40',
  },
  {
    emoji: '🚜',
    label: 'Tractor Payment',
    module: 'tractorPayment',
    gradient: 'from-yellow-500 via-amber-600 to-orange-700',
    glow: 'hover:shadow-amber-500/40',
  },
  {
    emoji: '⛰️',
    label: 'Dust Purchase',
    module: 'dustPurchase',
    gradient: 'from-stone-500 via-amber-700 to-stone-800',
    glow: 'hover:shadow-stone-500/40',
  },
  {
    emoji: '🏗️',
    label: 'Cement Purchase',
    module: 'cementPurchase',
    gradient: 'from-slate-500 via-sky-700 to-slate-800',
    glow: 'hover:shadow-slate-500/40',
  },
  {
    emoji: '💧',
    label: 'Hardner',
    module: 'hardner',
    gradient: 'from-cyan-500 via-teal-600 to-blue-700',
    glow: 'hover:shadow-cyan-500/40',
  },
  {
    emoji: '⚡',
    label: 'Electricity',
    module: 'electricity',
    gradient: 'from-yellow-400 via-amber-500 to-orange-600',
    glow: 'hover:shadow-yellow-500/40',
  },
  {
    emoji: '🔧',
    label: 'Factory Stuff',
    module: 'factoryStuff',
    gradient: 'from-teal-500 via-emerald-600 to-green-700',
    glow: 'hover:shadow-teal-500/40',
  },
  {
    emoji: '🧾',
    label: 'Bills',
    module: 'bills',
    gradient: 'from-slate-600 via-gray-700 to-zinc-800',
    glow: 'hover:shadow-gray-500/40',
  },
  {
    emoji: '👥',
    label: 'Customers',
    module: 'customers',
    gradient: 'from-pink-500 via-rose-600 to-red-700',
    glow: 'hover:shadow-rose-500/40',
  },
  {
    emoji: '📊',
    label: 'Reports',
    module: 'reports',
    gradient: 'from-blue-600 via-indigo-700 to-violet-800',
    glow: 'hover:shadow-indigo-500/40',
  },
  {
    emoji: '⚙️',
    label: 'Settings',
    module: 'settings',
    gradient: 'from-zinc-600 via-slate-700 to-gray-800',
    glow: 'hover:shadow-slate-500/40',
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

      {/* Tiles grid — bigger cards, no data, image-style visuals */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {TILES.map((tile) => (
          <button
            key={tile.module}
            type="button"
            onClick={() => setActiveModule(tile.module)}
            className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${tile.gradient} ${tile.glow} shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 cursor-pointer aspect-[4/3]`}
            aria-label={`Open ${tile.label} module`}
          >
            {/* Decorative pattern overlay */}
            <div
              className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.6) 0, transparent 35%), radial-gradient(circle at 80% 80%, rgba(0,0,0,0.4) 0, transparent 40%)',
              }}
            />

            {/* Big emoji as the visual centerpiece */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-6xl sm:text-7xl drop-shadow-lg select-none transition-transform duration-300 group-hover:scale-110 group-active:scale-95">
                {tile.emoji}
              </span>
            </div>

            {/* Bottom label bar */}
            <div className="absolute inset-x-0 bottom-0 bg-black/35 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
              <span className="text-white font-bold text-sm sm:text-base tracking-wide drop-shadow">
                {tile.label}
              </span>
              <span className="text-white/80 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
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
