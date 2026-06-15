'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Factory,
  Package,
  ShoppingCart,
  HardHat,
  Truck,
  CreditCard,
  Construction,
  Droplets,
  Zap,
  Wrench,
  IndianRupee,
  TrendingUp,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface StockItem {
  id: string
  date: string
  cement: number
  zigZagGrey80mm: number
  zigZagRed80mm: number
  zigZagYellow80mm: number
  zigZagGrey60mm: number
  zigZagRed60mm: number
  zigZagYellow60mm: number
  chequreTile: number
  curveStone: number
  dumbleGrey80mm: number
  dumbleRed80mm: number
  dumbleYellow80mm: number
}

interface ProductionItem {
  id: string
  date: string
  customerName: string
  address: string
  zigZagWhite80mm: number
  zigZagRed80mm: number
  zigZagYellow80mm: number
  zigZagWhite60mm: number
  zigZagRed60mm: number
  zigZagYellow60mm: number
  curveStone: number
  chequreTile: number
  transportationCharge: number
  remarks: string
}

interface DailySellItem {
  id: string
  date: string
  customerName: string
  amount: number
}

interface LabourPaymentItem {
  id: string
  date: string
  name: string
  amount: number
}

interface CustomerPaymentItem {
  id: string
  date: string
  name: string
  amount: number
}

interface TractorPaymentItem {
  id: string
  date: string
  vendorName: string
  totalAmount: number
  paidAmount: number
  remainingAmount: number
}

interface DustPurchaseItem {
  id: string
  date: string
  vendorName: string
  totalAmount: number
}

interface CementPurchaseItem {
  id: string
  date: string
  vendorName: string
  totalAmount: number
}

interface HardnerItem {
  id: string
  date: string
  amount: number
}

interface ElectricityItem {
  id: string
  date: string
  name: string
  amount: number
}

interface FactoryStuffItem {
  id: string
  date: string
  itemName: string
  amount: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)

const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-IN').format(value)

const today = () => new Date().toISOString().split('T')[0]

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardModule() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Stats
  const [todayProduction, setTodayProduction] = useState(0)
  const [todaySales, setTodaySales] = useState(0)
  const [todayLabourPayments, setTodayLabourPayments] = useState(0)
  const [totalStock, setTotalStock] = useState(0)
  const [todayCustomerPayments, setTodayCustomerPayments] = useState(0)
  const [totalTractorRemaining, setTotalTractorRemaining] = useState(0)
  const [todayDustPurchase, setTodayDustPurchase] = useState(0)
  const [todayCementPurchase, setTodayCementPurchase] = useState(0)
  const [todayHardner, setTodayHardner] = useState(0)
  const [todayElectricity, setTodayElectricity] = useState(0)
  const [todayFactoryStuff, setTodayFactoryStuff] = useState(0)
  const [totalStockCement, setTotalStockCement] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      try {
        setLoading(true)
        setError(null)

        const todayStr = today()

        // Fetch all data in parallel
        const [
          stockRes,
          productionRes,
          dailySellRes,
          labourPaymentRes,
          customerPaymentRes,
          tractorPaymentRes,
          dustPurchaseRes,
          cementPurchaseRes,
          hardnerRes,
          electricityRes,
          factoryStuffRes,
        ] = await Promise.allSettled([
          api.getStock(),
          api.getProduction(),
          api.getDailySells(),
          api.getLabourPayments(),
          api.getCustomerPayments(),
          api.getTractorPayments(),
          api.getDustPurchases(),
          api.getCementPurchases(),
          api.getHardners(),
          api.getElectricitys(),
          api.getFactoryStuffs(),
        ])

        if (cancelled) return

        // Process Stock
        if (stockRes.status === 'fulfilled') {
          const stocks = stockRes.value.stocks as StockItem[]
          // Get the latest stock entry
          if (stocks.length > 0) {
            const latest = stocks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
            const totalPieces = (latest.zigZagGrey80mm || 0) + (latest.zigZagRed80mm || 0) +
              (latest.zigZagYellow80mm || 0) + (latest.zigZagGrey60mm || 0) +
              (latest.zigZagRed60mm || 0) + (latest.zigZagYellow60mm || 0) +
              (latest.chequreTile || 0) + (latest.curveStone || 0) +
              (latest.dumbleGrey80mm || 0) + (latest.dumbleRed80mm || 0) +
              (latest.dumbleYellow80mm || 0)
            setTotalStock(totalPieces)
            setTotalStockCement(latest.cement || 0)
          }
        }

        // Process Production - today's total
        if (productionRes.status === 'fulfilled') {
          const prods = productionRes.value.productions as ProductionItem[]
          const todayProds = prods.filter((p) => p.date && p.date.split('T')[0] === todayStr)
          const totalPieces = todayProds.reduce((sum, p) =>
            sum + (p.zigZagWhite80mm || 0) + (p.zigZagRed80mm || 0) +
            (p.zigZagYellow80mm || 0) + (p.zigZagWhite60mm || 0) +
            (p.zigZagRed60mm || 0) + (p.zigZagYellow60mm || 0) +
            (p.curveStone || 0) + (p.chequreTile || 0), 0)
          setTodayProduction(totalPieces)
        }

        // Process Daily Sell - today's total
        if (dailySellRes.status === 'fulfilled') {
          const sells = dailySellRes.value.dailySells as DailySellItem[]
          const todaySells = sells.filter((s) => s.date && s.date.split('T')[0] === todayStr)
          setTodaySales(todaySells.reduce((sum, s) => sum + (s.amount || 0), 0))
        }

        // Process Labour Payments - today's total
        if (labourPaymentRes.status === 'fulfilled') {
          const payments = labourPaymentRes.value.labourPayments as LabourPaymentItem[]
          const todayPayments = payments.filter((p) => p.date && p.date.split('T')[0] === todayStr)
          setTodayLabourPayments(todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0))
        }

        // Process Customer Payments - today's total
        if (customerPaymentRes.status === 'fulfilled') {
          const payments = customerPaymentRes.value.customerPayments as CustomerPaymentItem[]
          const todayPayments = payments.filter((p) => p.date && p.date.split('T')[0] === todayStr)
          setTodayCustomerPayments(todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0))
        }

        // Process Tractor Payments - total remaining
        if (tractorPaymentRes.status === 'fulfilled') {
          const payments = tractorPaymentRes.value.tractorPayments as TractorPaymentItem[]
          setTotalTractorRemaining(payments.reduce((sum, p) => sum + (p.remainingAmount || 0), 0))
        }

        // Process Dust Purchase - today's total
        if (dustPurchaseRes.status === 'fulfilled') {
          const purchases = dustPurchaseRes.value.dustPurchases as DustPurchaseItem[]
          const todayPurchases = purchases.filter((p) => p.date && p.date.split('T')[0] === todayStr)
          setTodayDustPurchase(todayPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0))
        }

        // Process Cement Purchase - today's total
        if (cementPurchaseRes.status === 'fulfilled') {
          const purchases = cementPurchaseRes.value.cementPurchases as CementPurchaseItem[]
          const todayPurchases = purchases.filter((p) => p.date && p.date.split('T')[0] === todayStr)
          setTodayCementPurchase(todayPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0))
        }

        // Process Hardner - today's total
        if (hardnerRes.status === 'fulfilled') {
          const items = hardnerRes.value.hardners as HardnerItem[]
          const todayItems = items.filter((i) => i.date && i.date.split('T')[0] === todayStr)
          setTodayHardner(todayItems.reduce((sum, i) => sum + (i.amount || 0), 0))
        }

        // Process Electricity - today's total
        if (electricityRes.status === 'fulfilled') {
          const items = electricityRes.value.electricitys as ElectricityItem[]
          const todayItems = items.filter((i) => i.date && i.date.split('T')[0] === todayStr)
          setTodayElectricity(todayItems.reduce((sum, i) => sum + (i.amount || 0), 0))
        }

        // Process Factory Stuff - today's total
        if (factoryStuffRes.status === 'fulfilled') {
          const items = factoryStuffRes.value.factoryStuffs as FactoryStuffItem[]
          const todayItems = items.filter((i) => i.date && i.date.split('T')[0] === todayStr)
          setTodayFactoryStuff(todayItems.reduce((sum, i) => sum + (i.amount || 0), 0))
        }

      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [])

  if (loading) return <DashboardSkeleton />

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

  const totalExpensesToday = todayLabourPayments + todayDustPurchase + todayCementPurchase + todayHardner + todayElectricity + todayFactoryStuff

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Paver Block Manufacturing &mdash; Overview of operations and performance
        </p>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Today's Production"
          value={formatNumber(todayProduction)}
          icon={<Factory className="h-5 w-5" />}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
          borderColor="border-l-emerald-500"
          sublabel="pieces produced today"
        />
        <KpiCard
          label="Today's Sales"
          value={formatCurrency(todaySales)}
          icon={<ShoppingCart className="h-5 w-5" />}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          iconColor="text-amber-600 dark:text-amber-400"
          borderColor="border-l-amber-500"
          sublabel="daily sell amount"
        />
        <KpiCard
          label="Labour Payments Today"
          value={formatCurrency(todayLabourPayments)}
          icon={<HardHat className="h-5 w-5" />}
          iconBg="bg-rose-100 dark:bg-rose-900/30"
          iconColor="text-rose-600 dark:text-rose-400"
          borderColor="border-l-rose-500"
          sublabel="paid to labourers"
        />
        <KpiCard
          label="Stock Summary"
          value={formatNumber(totalStock)}
          icon={<Package className="h-5 w-5" />}
          iconBg="bg-sky-100 dark:bg-sky-900/30"
          iconColor="text-sky-600 dark:text-sky-400"
          borderColor="border-l-sky-500"
          sublabel={`${formatNumber(totalStockCement)} cement bags`}
        />
      </div>

      {/* Secondary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Customer Payments Today"
          value={formatCurrency(todayCustomerPayments)}
          icon={<CreditCard className="h-5 w-5" />}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
          borderColor="border-l-emerald-500"
          sublabel="received from customers"
        />
        <KpiCard
          label="Tractor Dues"
          value={formatCurrency(totalTractorRemaining)}
          icon={<Truck className="h-5 w-5" />}
          iconBg="bg-orange-100 dark:bg-orange-900/30"
          iconColor="text-orange-600 dark:text-orange-400"
          borderColor="border-l-orange-500"
          sublabel="total remaining amount"
        />
        <KpiCard
          label="Today's Expenses"
          value={formatCurrency(totalExpensesToday)}
          icon={<IndianRupee className="h-5 w-5" />}
          iconBg="bg-violet-100 dark:bg-violet-900/30"
          iconColor="text-violet-600 dark:text-violet-400"
          borderColor="border-l-violet-500"
          sublabel="all expenses combined"
        />
        <KpiCard
          label="Net Cash Flow"
          value={formatCurrency(todaySales + todayCustomerPayments - totalExpensesToday)}
          icon={<TrendingUp className="h-5 w-5" />}
          iconBg="bg-teal-100 dark:bg-teal-900/30"
          iconColor="text-teal-600 dark:text-teal-400"
          borderColor="border-l-teal-500"
          sublabel="income minus expenses"
        />
      </div>

      {/* Expense Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Today&apos;s Expense Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {totalExpensesToday === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No expenses recorded today
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <ExpenseCard icon={<HardHat className="h-4 w-4" />} label="Labour" amount={todayLabourPayments} total={totalExpensesToday} color="text-rose-600" />
              <ExpenseCard icon={<Mountain className="h-4 w-4" />} label="Dust Purchase" amount={todayDustPurchase} total={totalExpensesToday} color="text-amber-600" />
              <ExpenseCard icon={<Construction className="h-4 w-4" />} label="Cement Purchase" amount={todayCementPurchase} total={totalExpensesToday} color="text-sky-600" />
              <ExpenseCard icon={<Droplets className="h-4 w-4" />} label="Hardner" amount={todayHardner} total={totalExpensesToday} color="text-violet-600" />
              <ExpenseCard icon={<Zap className="h-4 w-4" />} label="Electricity" amount={todayElectricity} total={totalExpensesToday} color="text-yellow-600" />
              <ExpenseCard icon={<Wrench className="h-4 w-4" />} label="Factory Stuff" amount={todayFactoryStuff} total={totalExpensesToday} color="text-emerald-600" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, iconBg, iconColor, borderColor, sublabel }: {
  label: string
  value: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  borderColor: string
  sublabel: string
}) {
  return (
    <Card className={`border-l-4 ${borderColor} hover:shadow-md transition-shadow`}>
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
    </Card>
  )
}

function ExpenseCard({ icon, label, amount, total, color }: {
  icon: React.ReactNode
  label: string
  amount: number
  total: number
  color: string
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0
  return (
    <div className="text-center space-y-2">
      <div className={`flex items-center justify-center gap-1 ${color}`}>{icon}<span className="text-xs font-medium">{label}</span></div>
      <p className="text-sm font-bold">{formatCurrency(amount)}</p>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
    </div>
  )
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
