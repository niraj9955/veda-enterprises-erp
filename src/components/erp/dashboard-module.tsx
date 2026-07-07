'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Factory,
  Package,
  ShoppingCart,
  CreditCard,
  Construction,
  Droplets,
  Zap,
  Wrench,
  IndianRupee,
  TrendingUp,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardStats {
  todayProduction: number
  todaySales: number
  todayLabourPayments: number
  todayCustomerPayments: number
  totalTractorRemaining: number
  todayDustPurchase: number
  todayCementPurchase: number
  todayHardner: number
  todayElectricity: number
  todayFactoryStuff: number
  totalStock: number
  totalStockCement: number
  totalExpensesToday: number
  netCashFlow: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0)

const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-IN').format(value || 0)

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardModule() {
  const { setActiveModule } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchStats() {
      try {
        setLoading(true)
        setError(null)
        // Single round-trip — server does ALL aggregation via MongoDB pipelines.
        // This replaced 11 parallel API calls each returning ALL records.
        const data = (await api.getDashboardStats()) as unknown as DashboardStats
        if (!cancelled) setStats(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchStats()
    return () => { cancelled = true }
  }, [])

  if (loading || !stats) return <DashboardSkeleton />

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-4">
              <Package className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Failed to Load Dashboard</h3>
            <p className="text-muted-foreground text-sm mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-emerald-600 dark:text-emerald-400 hover:underline text-sm font-medium"
            >
              Try Again
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Paper Block Manufacturing &mdash; Overview of operations and performance
        </p>
        <p className="text-muted-foreground/70 text-xs mt-1">
          Tip: click any card below to jump straight to that module.
        </p>
      </div>

      {/* Primary KPI Cards — clickable to navigate to their modules */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Today's Production"
          value={formatNumber(stats.todayProduction)}
          icon={<Factory className="h-5 w-5" />}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
          borderColor="border-l-emerald-500"
          sublabel="pieces produced today"
          onClick={() => setActiveModule('production')}
        />
        <KpiCard
          label="Today's Sales"
          value={formatCurrency(stats.todaySales)}
          icon={<ShoppingCart className="h-5 w-5" />}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          iconColor="text-amber-600 dark:text-amber-400"
          borderColor="border-l-amber-500"
          sublabel="daily sell amount"
          onClick={() => setActiveModule('dailySell')}
        />
        <KpiCard
          label="Customer Payments Today"
          value={formatCurrency(stats.todayCustomerPayments)}
          icon={<CreditCard className="h-5 w-5" />}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
          borderColor="border-l-emerald-500"
          sublabel="received from customers"
          onClick={() => setActiveModule('customerPayment')}
        />
        <KpiCard
          label="Stock Summary"
          value={formatNumber(stats.totalStock)}
          icon={<Package className="h-5 w-5" />}
          iconBg="bg-sky-100 dark:bg-sky-900/30"
          iconColor="text-sky-600 dark:text-sky-400"
          borderColor="border-l-sky-500"
          sublabel={`${formatNumber(stats.totalStockCement)} cement bags`}
          onClick={() => setActiveModule('stock')}
        />
      </div>

      {/* Secondary KPI Cards — clickable */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Today's Expenses"
          value={formatCurrency(stats.totalExpensesToday)}
          icon={<IndianRupee className="h-5 w-5" />}
          iconBg="bg-violet-100 dark:bg-violet-900/30"
          iconColor="text-violet-600 dark:text-violet-400"
          borderColor="border-l-violet-500"
          sublabel="all expenses combined"
          onClick={() => setActiveModule('expenses')}
        />
        <KpiCard
          label="Net Cash Flow"
          value={formatCurrency(stats.netCashFlow)}
          icon={<TrendingUp className="h-5 w-5" />}
          iconBg="bg-teal-100 dark:bg-teal-900/30"
          iconColor="text-teal-600 dark:text-teal-400"
          borderColor="border-l-teal-500"
          sublabel="income minus expenses"
          onClick={() => setActiveModule('reports')}
        />
        <KpiCard
          label="Orders"
          value={formatCurrency(stats.todaySales)}
          icon={<ShoppingCart className="h-5 w-5" />}
          iconBg="bg-indigo-100 dark:bg-indigo-900/30"
          iconColor="text-indigo-600 dark:text-indigo-400"
          borderColor="border-l-indigo-500"
          sublabel="jump to orders module"
          onClick={() => setActiveModule('orders')}
        />
        <KpiCard
          label="Dispatch"
          value={formatCurrency(stats.todaySales)}
          icon={<Package className="h-5 w-5" />}
          iconBg="bg-fuchsia-100 dark:bg-fuchsia-900/30"
          iconColor="text-fuchsia-600 dark:text-fuchsia-400"
          borderColor="border-l-fuchsia-500"
          sublabel="jump to dispatch module"
          onClick={() => setActiveModule('dispatch')}
        />
      </div>

      {/* Expense Breakdown — each card clickable to its purchase module */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Today&apos;s Expense Breakdown</CardTitle>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Click any expense to open its module.
          </p>
        </CardHeader>
        <CardContent>
          {stats.totalExpensesToday === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No expenses recorded today
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <ExpenseCard icon={<Factory className="h-4 w-4" />} label="Labour" amount={stats.todayLabourPayments} total={stats.totalExpensesToday} color="text-rose-600" onClick={() => setActiveModule('labourPayment')} />
              <ExpenseCard icon={<Mountain className="h-4 w-4" />} label="Dust Purchase" amount={stats.todayDustPurchase} total={stats.totalExpensesToday} color="text-amber-600" onClick={() => setActiveModule('dustPurchase')} />
              <ExpenseCard icon={<Construction className="h-4 w-4" />} label="Cement Purchase" amount={stats.todayCementPurchase} total={stats.totalExpensesToday} color="text-sky-600" onClick={() => setActiveModule('cementPurchase')} />
              <ExpenseCard icon={<Droplets className="h-4 w-4" />} label="Hardner" amount={stats.todayHardner} total={stats.totalExpensesToday} color="text-violet-600" onClick={() => setActiveModule('hardner')} />
              <ExpenseCard icon={<Zap className="h-4 w-4" />} label="Electricity" amount={stats.todayElectricity} total={stats.totalExpensesToday} color="text-yellow-600" onClick={() => setActiveModule('electricity')} />
              <ExpenseCard icon={<Wrench className="h-4 w-4" />} label="Factory Stuff" amount={stats.todayFactoryStuff} total={stats.totalExpensesToday} color="text-emerald-600" onClick={() => setActiveModule('factoryStuff')} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, iconBg, iconColor, borderColor, sublabel, onClick }: {
  label: string
  value: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  borderColor: string
  sublabel: string
  onClick?: () => void
}) {
  // Render as a <button> when onClick is supplied so the entire card is
  // keyboard-focusable and click-anywhere-on-card navigates. Visual styling
  // stays identical to the non-clickable variant (no extra padding / borders).
  const inner = (
    <>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${iconBg} ${iconColor}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-lg font-bold tracking-tight truncate">{value}</p>
            <p className="text-xs text-muted-foreground/70 truncate">{sublabel}</p>
          </div>
        </div>
      </CardContent>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`text-left border-l-4 ${borderColor} hover:shadow-md hover:-translate-y-0.5 transition-all bg-card border border-card rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer`}
      >
        {inner}
      </button>
    )
  }

  return (
    <Card className={`border-l-4 ${borderColor} hover:shadow-md transition-shadow`}>
      {inner}
    </Card>
  )
}

function ExpenseCard({ icon, label, amount, total, color, onClick }: {
  icon: React.ReactNode
  label: string
  amount: number
  total: number
  color: string
  onClick?: () => void
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0

  const inner = (
    <>
      <div className={`flex items-center justify-center gap-1 ${color}`}>
        {icon}<span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-sm font-bold">{formatCurrency(amount)}</p>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-center space-y-2 p-2 rounded-lg hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
      >
        {inner}
      </button>
    )
  }

  return <div className="text-center space-y-2">{inner}</div>
}

// ─── Mountain icon (inline since it's used in expense breakdown) ─────────────

function MountainIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </svg>
  )
}

function Mountain({ className }: { className?: string }) {
  return <MountainIcon className={className} />
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-l-4 border-l-transparent">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-l-4 border-l-transparent">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="text-center space-y-2">
                <Skeleton className="h-4 w-16 mx-auto" />
                <Skeleton className="h-4 w-20 mx-auto" />
                <Skeleton className="h-1.5 w-full" />
                <Skeleton className="h-3 w-8 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
