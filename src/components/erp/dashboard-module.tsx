'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Factory,
  Package,
  Truck,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  DollarSign,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

// ─── Types ───────────────────────────────────────────────────────────────────

interface RecentProduction {
  id: string
  date: string
  brickType: string
  quantityProduced: number
  shift: string
}

interface RecentDispatch {
  id: string
  date: string
  quantity: number
  truckNumber: string
  customerName: string
}

interface MonthlyProductionItem {
  date: string
  quantity: number
}

interface MonthlyExpenseItem {
  category: string
  amount: number
}

interface DashboardData {
  todayProduction: number
  totalStock: number
  todayDispatch: number
  pendingOrders: number
  outstandingPayments: number
  monthlySales: number
  monthlyProfit: number
  recentProductions: RecentProduction[]
  recentDispatches: RecentDispatch[]
  monthlyProductionData: MonthlyProductionItem[]
  monthlyExpenseData: MonthlyExpenseItem[]
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

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Chart Colors ────────────────────────────────────────────────────────────

const CHART_COLORS = ['#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#8b5cf6']

// ─── KPI Config ──────────────────────────────────────────────────────────────

interface KpiConfig {
  key: keyof Pick<DashboardData, 'todayProduction' | 'totalStock' | 'todayDispatch' | 'pendingOrders' | 'outstandingPayments' | 'monthlySales' | 'monthlyProfit'>
  label: string
  icon: React.ReactNode
  format: 'number' | 'currency'
  iconBg: string
  iconColor: string
  borderColor: string
}

const kpiConfigs: KpiConfig[] = [
  {
    key: 'todayProduction',
    label: "Today's Production",
    icon: <Factory className="h-5 w-5" />,
    format: 'number',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-l-emerald-500',
  },
  {
    key: 'totalStock',
    label: 'Total Stock',
    icon: <Package className="h-5 w-5" />,
    format: 'number',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-l-amber-500',
  },
  {
    key: 'todayDispatch',
    label: "Today's Dispatch",
    icon: <Truck className="h-5 w-5" />,
    format: 'number',
    iconBg: 'bg-sky-100 dark:bg-sky-900/30',
    iconColor: 'text-sky-600 dark:text-sky-400',
    borderColor: 'border-l-sky-500',
  },
  {
    key: 'pendingOrders',
    label: 'Pending Orders',
    icon: <ShoppingCart className="h-5 w-5" />,
    format: 'number',
    iconBg: 'bg-rose-100 dark:bg-rose-900/30',
    iconColor: 'text-rose-600 dark:text-rose-400',
    borderColor: 'border-l-rose-500',
  },
  {
    key: 'outstandingPayments',
    label: 'Outstanding Payments',
    icon: <CreditCard className="h-5 w-5" />,
    format: 'currency',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    iconColor: 'text-violet-600 dark:text-violet-400',
    borderColor: 'border-l-violet-500',
  },
  {
    key: 'monthlySales',
    label: 'Monthly Sales',
    icon: <TrendingUp className="h-5 w-5" />,
    format: 'currency',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-l-emerald-500',
  },
  {
    key: 'monthlyProfit',
    label: 'Monthly Profit',
    icon: <DollarSign className="h-5 w-5" />,
    format: 'currency',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-l-amber-500',
  },
]

// ─── Custom Tooltip for Bar Chart ────────────────────────────────────────────

function ProductionTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
        {formatNumber(payload[0].value)} units
      </p>
    </div>
  )
}

// ─── Custom Tooltip for Pie Chart ────────────────────────────────────────────

function ExpenseTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill: string } }> }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">{payload[0].name}</p>
      <p className="text-sm font-semibold" style={{ color: payload[0].payload.fill }}>
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  )
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Card key={i} className="border-l-4 border-l-transparent">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DashboardModule() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        const result = await api.getDashboard()
        if (!cancelled) {
          setData(result as unknown as DashboardData)
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
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <DashboardSkeleton />

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="h-6 w-6 text-rose-600 dark:text-rose-400" />
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

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Veda Enterprises &mdash; Overview of operations and performance
        </p>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {kpiConfigs.map((kpi) => {
          const value = data[kpi.key] as number
          return (
            <Card
              key={kpi.key}
              className={`border-l-4 ${kpi.borderColor} hover:shadow-md transition-shadow`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${kpi.iconBg} ${kpi.iconColor}`}
                  >
                    {kpi.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                    <p className="text-lg font-bold tracking-tight truncate">
                      {kpi.format === 'currency' ? formatCurrency(value) : formatNumber(value)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Charts Section ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Production Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Factory className="h-4 w-4 text-emerald-500" />
              Monthly Production
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.monthlyProductionData}
                  margin={{ top: 8, right: 8, left: -12, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => formatNumber(v)}
                  />
                  <Tooltip content={<ProductionTooltip />} />
                  <Bar
                    dataKey="quantity"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Expenses by Category Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-amber-500" />
              Monthly Expenses by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.monthlyExpenseData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="amount"
                    nameKey="category"
                    stroke="none"
                  >
                    {data.monthlyExpenseData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ExpenseTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => (
                      <span className="text-xs text-muted-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Activity ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Productions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Factory className="h-4 w-4 text-emerald-500" />
              Recent Productions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentProductions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent productions found
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Brick Type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Shift</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentProductions.map((prod) => (
                      <TableRow key={prod.id}>
                        <TableCell className="text-xs">{formatDate(prod.date)}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                            {prod.brickType}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {formatNumber(prod.quantityProduced)}
                        </TableCell>
                        <TableCell className="text-xs capitalize">{prod.shift}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Dispatches */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Truck className="h-4 w-4 text-amber-500" />
              Recent Dispatches
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentDispatches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent dispatches found
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Truck</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentDispatches.map((disp) => (
                      <TableRow key={disp.id}>
                        <TableCell className="text-xs">{formatDate(disp.date)}</TableCell>
                        <TableCell className="text-xs font-medium">{disp.customerName}</TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {formatNumber(disp.quantity)}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                            {disp.truckNumber}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
