'use client'

import * as React from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import {
  FileSpreadsheet,
  FileText,
  Loader2,
  BarChart3,
  Factory,
  Users,
  Package,
  TrendingUp,
  AlertCircle,
  IndianRupee,
  Filter,
  Calendar,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface SalesRow {
  id: string
  date: string
  customerId: string
  customer: { id: string; name: string } | null
  brickType: string
  quantity: number
  rate: number
  totalAmount: number
  orderId: string | null
}

interface ProductionRow {
  id: string
  date: string
  brickType: string
  quantityProduced: number
  shift: string
}

interface CustomerLedgerRow {
  customerId: string
  customer: { id: string; name: string } | null
  totalOrders: number
  totalPayments: number
  outstanding: number
}

interface StockRow {
  id: string
  brickType: string
  openingStock: number
  currentStock: number
  lowStockAlert: boolean
  stockValue: number
}

interface ProfitLossData {
  reportType: string
  month: string
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  expensesByCategory: Record<string, number>
}

interface OutstandingRow {
  id: string
  customerId: string
  customer: { id: string; name: string } | null
  totalOrders: number
  totalPayments: number
  outstanding: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

const numberFormatter = new Intl.NumberFormat('en-IN')

function formatNumber(n: number): string {
  return numberFormatter.format(n)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

// ── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => {
        const str = String(cell ?? '')
        // Escape cells that contain commas, quotes, or newlines
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }).join(',')
    ),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function exportPDF() {
  window.print()
}

// ── Report Date Filters ─────────────────────────────────────────────────────

export type ReportPreset = 'all' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'last30' | 'custom'

export interface ReportFilterValue {
  preset: ReportPreset
  month: string         // 'YYYY-MM' — used when preset === 'thisMonth' | 'lastMonth'
  from: string          // 'YYYY-MM-DD'
  to: string            // 'YYYY-MM-DD'
}

/**
 * Returns the {month?, from?, to?} object the API expects.
 * Returns {} when preset === 'all' (no filter).
 */
function resolveFilterApiParams(v: ReportFilterValue): { month?: string; from?: string; to?: string } {
  const now = new Date()
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  switch (v.preset) {
    case 'thisMonth': {
      const m = ym(now)
      return { month: m }
    }
    case 'lastMonth': {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return { month: ym(d) }
    }
    case 'thisYear': {
      const start = `${now.getFullYear()}-01-01`
      const end = `${now.getFullYear()}-12-31`
      return { from: start, to: end }
    }
    case 'last30': {
      const end = new Date()
      const start = new Date()
      start.setDate(end.getDate() - 30)
      return { from: ymd(start), to: ymd(end) }
    }
    case 'custom': {
      const out: { month?: string; from?: string; to?: string } = {}
      if (v.from) out.from = v.from
      if (v.to) out.to = v.to
      // If only from is set, treat it as a month filter for cleaner API behavior
      if (!v.from && !v.to && v.month) out.month = v.month
      return out
    }
    case 'all':
    default:
      return {}
  }
}

function describeFilter(v: ReportFilterValue): string {
  switch (v.preset) {
    case 'all':
      return 'All Time'
    case 'thisMonth':
      return 'This Month'
    case 'lastMonth':
      return 'Last Month'
    case 'thisYear':
      return 'This Year'
    case 'last30':
      return 'Last 30 Days'
    case 'custom': {
      if (v.from && v.to) return `${v.from} → ${v.to}`
      if (v.from) return `From ${v.from}`
      if (v.to) return `Up to ${v.to}`
      if (v.month) return `Month: ${v.month}`
      return 'Custom'
    }
    default:
      return '—'
  }
}

const DEFAULT_FILTER: ReportFilterValue = {
  preset: 'all',
  month: '',
  from: '',
  to: '',
}

function ReportFilters({
  value,
  onChange,
  excludePresets,
}: {
  value: ReportFilterValue
  onChange: (v: ReportFilterValue) => void
  /** Hide presets that don't make sense for this report (e.g. stock is a snapshot) */
  excludePresets?: ReportPreset[]
}) {
  const [expanded, setExpanded] = React.useState(false)
  const exclude = new Set<ReportPreset>(excludePresets || [])
  const allPresets: { key: ReportPreset; label: string }[] = [
    { key: 'all', label: 'All Time' },
    { key: 'thisMonth', label: 'This Month' },
    { key: 'lastMonth', label: 'Last Month' },
    { key: 'last30', label: 'Last 30 Days' },
    { key: 'thisYear', label: 'This Year' },
    { key: 'custom', label: 'Custom' },
  ]
  const presets = allPresets.filter((p) => !exclude.has(p.key))

  const setPreset = (p: ReportPreset) => {
    // Reset custom fields when moving to a preset that doesn't use them
    onChange({ ...value, preset: p })
  }

  const isCustom = value.preset === 'custom'
  const isDirty = JSON.stringify(value) !== JSON.stringify(DEFAULT_FILTER)

  return (
    <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-900/10 p-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mr-2">Period:</span>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <Button
              key={p.key}
              type="button"
              size="sm"
              variant={value.preset === p.key ? 'default' : 'outline'}
              onClick={() => setPreset(p.key)}
              className={`h-7 px-2.5 text-xs ${
                value.preset === p.key
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                  : 'border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20'
              }`
            }
            >
              {p.label}
            </Button>
          ))}
        </div>

        {/* Show current range as a badge */}
        <Badge
          variant="outline"
          className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 ml-1"
        >
          <Calendar className="h-3 w-3 mr-1" />
          {describeFilter(value)}
        </Badge>

        {isCustom && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((e) => !e)}
            className="h-7 px-2 text-xs text-emerald-700 dark:text-emerald-400"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? 'Hide dates' : 'Set dates'}
          </Button>
        )}

        {isDirty && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange({ ...DEFAULT_FILTER })}
            className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        )}
      </div>

      {isCustom && expanded && (
        <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From date</label>
            <input
              type="date"
              value={value.from}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To date</label>
            <input
              type="date"
              value={value.to}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Or pick a month</label>
            <input
              type="month"
              value={value.month}
              onChange={(e) => onChange({ ...value, month: e.target.value })}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-3">
            Tip: leave the date fields empty and pick a month to filter by whole month. Or set From/To for a custom range.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Stock Status ─────────────────────────────────────────────────────────────

function getStockStatus(currentStock: number) {
  if (currentStock > 200) {
    return {
      label: 'In Stock',
      className:
        'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    }
  }
  if (currentStock >= 100) {
    return {
      label: 'Moderate',
      className:
        'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    }
  }
  return {
    label: 'Low Stock',
    className:
      'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
  }
}

// ── Skeleton Table ───────────────────────────────────────────────────────────

function TableSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 mb-4">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="rounded-md border overflow-x-auto max-h-[70vh] overflow-y-auto">
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCard({
  title,
  value,
  icon: Icon,
  variant = 'default',
}: {
  title: string
  value: string
  icon: React.ElementType
  variant?: 'default' | 'positive' | 'negative'
}) {
  const colorMap = {
    default: 'text-emerald-600 dark:text-emerald-400',
    positive: 'text-emerald-600 dark:text-emerald-400',
    negative: 'text-rose-600 dark:text-rose-400',
  }

  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-4 px-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
          <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{title}</p>
          <p className={`text-lg font-semibold ${colorMap[variant]} truncate`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Sales Report ─────────────────────────────────────────────────────────────

function SalesReport() {
  const [data, setData] = React.useState<SalesRow[]>([])
  const [totalSales, setTotalSales] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<ReportFilterValue>({ ...DEFAULT_FILTER })

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getReport('sales', resolveFilterApiParams(filter))) as {
        data: SalesRow[]
        totalSales: number
      }
      setData(res.data || [])
      setTotalSales(res.totalSales || 0)
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to load sales report',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [filter])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const handleExportCSV = () => {
    const headers = ['Date', 'Customer', 'Brick Type', 'Quantity', 'Rate', 'Amount']
    const rows = data.map((row) => [
      formatDate(row.date),
      row.customer?.name || '—',
      row.brickType,
      String(row.quantity),
      formatCurrency(row.rate),
      formatCurrency(row.totalAmount),
    ])
    exportCSV('sales-report', headers, rows)
  }

  if (loading) return <TableSkeleton cols={6} />

  return (
    <div className="space-y-4">
      <ReportFilters value={filter} onChange={setFilter} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard title="Total Sales" value={formatCurrency(totalSales)} icon={IndianRupee} variant="positive" />
        <SummaryCard title="Total Dispatches" value={formatNumber(data.length)} icon={BarChart3} />
        <SummaryCard title="Avg. per Dispatch" value={data.length ? formatCurrency(totalSales / data.length) : '₹0'} icon={TrendingUp} />
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button
          onClick={handleExportCSV}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          size="sm"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel
        </Button>
        <Button
          onClick={exportPDF}
          variant="outline"
          className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
          size="sm"
        >
          <FileText className="h-4 w-4" />
          Export PDF
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto max-h-[70vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10">
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Brick Type</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No sales data available.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDate(row.date)}</TableCell>
                  <TableCell className="font-medium">{row.customer?.name || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400">
                      {row.brickType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(row.quantity)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.rate)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(row.totalAmount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {data.length > 0 && (
            <TableFooter>
              <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10">
                <TableCell colSpan={5} className="font-semibold">
                  Total
                </TableCell>
                <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(totalSales)}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}

// ── Production Report ────────────────────────────────────────────────────────

function ProductionReport() {
  const [data, setData] = React.useState<ProductionRow[]>([])
  const [totalProduced, setTotalProduced] = React.useState(0)
  const [byBrickType, setByBrickType] = React.useState<Record<string, number>>({})
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<ReportFilterValue>({ ...DEFAULT_FILTER })

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getReport('production', resolveFilterApiParams(filter))) as {
        data: ProductionRow[]
        totalProduced: number
        byBrickType: Record<string, number>
      }
      setData(res.data || [])
      setTotalProduced(res.totalProduced || 0)
      setByBrickType(res.byBrickType || {})
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to load production report',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [filter])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const handleExportCSV = () => {
    const headers = ['Date', 'Brick Type', 'Quantity Produced', 'Shift']
    const rows = data.map((row) => [
      formatDate(row.date),
      row.brickType,
      String(row.quantityProduced),
      row.shift,
    ])
    exportCSV('production-report', headers, rows)
  }

  if (loading) return <TableSkeleton cols={4} />

  return (
    <div className="space-y-4">
      <ReportFilters value={filter} onChange={setFilter} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard title="Total Produced" value={formatNumber(totalProduced)} icon={Factory} variant="positive" />
        <SummaryCard title="Total Entries" value={formatNumber(data.length)} icon={BarChart3} />
        <SummaryCard title="Brick Types" value={String(Object.keys(byBrickType).length)} icon={Package} />
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button
          onClick={handleExportCSV}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          size="sm"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel
        </Button>
        <Button
          onClick={exportPDF}
          variant="outline"
          className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
          size="sm"
        >
          <FileText className="h-4 w-4" />
          Export PDF
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto max-h-[70vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10">
              <TableHead>Date</TableHead>
              <TableHead>Brick Type</TableHead>
              <TableHead className="text-right">Quantity Produced</TableHead>
              <TableHead>Shift</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No production data available.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDate(row.date)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400">
                      {row.brickType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatNumber(row.quantityProduced)}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        row.shift === 'Day'
                          ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                          : 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800'
                      }
                      variant="outline"
                    >
                      {row.shift}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {data.length > 0 && (
            <TableFooter>
              <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10">
                <TableCell colSpan={2} className="font-semibold">
                  Total
                </TableCell>
                <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                  {formatNumber(totalProduced)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {Object.keys(byBrickType).length > 0 && (
        <Card className="py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Production by Brick Type</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Object.entries(byBrickType).map(([type, qty]) => (
                <div
                  key={type}
                  className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-3 text-center"
                >
                  <p className="text-xs text-muted-foreground truncate">{type}</p>
                  <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">{formatNumber(qty)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Customer Ledger Report ───────────────────────────────────────────────────

function CustomerLedgerReport() {
  const [data, setData] = React.useState<CustomerLedgerRow[]>([])
  const [loading, setLoading] = React.useState(true)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      // Fetch all customers first
      const [customersRes, ordersRes, paymentsRes] = await Promise.all([
        api.getCustomers() as Promise<{ customers: { id: string; name: string }[] }>,
        api.getOrders() as Promise<{ orders: { customerId: string; amount: number }[] }>,
        api.getPayments() as Promise<{ payments: { customerId: string; amount: number }[] }>,
      ])

      const customerMap = new Map(
        (customersRes.customers || []).map((c) => [c.id, c])
      )

      // Aggregate order totals by customer
      const orderTotals = new Map<string, number>()
      for (const order of ordersRes.orders || []) {
        orderTotals.set(order.customerId, (orderTotals.get(order.customerId) || 0) + order.amount)
      }

      // Aggregate payment totals by customer
      const paymentTotals = new Map<string, number>()
      for (const payment of paymentsRes.payments || []) {
        paymentTotals.set(payment.customerId, (paymentTotals.get(payment.customerId) || 0) + payment.amount)
      }

      // Build ledger rows
      const allCustomerIds = new Set([
        ...orderTotals.keys(),
        ...paymentTotals.keys(),
      ])

      const ledgerData: CustomerLedgerRow[] = [...allCustomerIds].map((cId) => {
        const totalOrders = orderTotals.get(cId) || 0
        const totalPayments = paymentTotals.get(cId) || 0
        return {
          customerId: cId,
          customer: customerMap.get(cId)
            ? { id: cId, name: customerMap.get(cId)!.name }
            : null,
          totalOrders,
          totalPayments,
          outstanding: totalOrders - totalPayments,
        }
      })

      setData(ledgerData)
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to load customer ledger',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const handleExportCSV = () => {
    const headers = ['Customer', 'Total Orders', 'Total Payments', 'Outstanding Balance']
    const rows = data.map((row) => [
      row.customer?.name || '—',
      formatCurrency(row.totalOrders),
      formatCurrency(row.totalPayments),
      formatCurrency(row.outstanding),
    ])
    exportCSV('customer-ledger', headers, rows)
  }

  const totalOrders = data.reduce((sum, r) => sum + r.totalOrders, 0)
  const totalPayments = data.reduce((sum, r) => sum + r.totalPayments, 0)
  const totalOutstanding = data.reduce((sum, r) => sum + r.outstanding, 0)

  if (loading) return <TableSkeleton cols={4} />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard title="Total Orders" value={formatCurrency(totalOrders)} icon={IndianRupee} variant="positive" />
        <SummaryCard title="Total Payments" value={formatCurrency(totalPayments)} icon={Users} />
        <SummaryCard
          title="Outstanding Balance"
          value={formatCurrency(totalOutstanding)}
          icon={AlertCircle}
          variant={totalOutstanding > 0 ? 'negative' : 'positive'}
        />
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button
          onClick={handleExportCSV}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          size="sm"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel
        </Button>
        <Button
          onClick={exportPDF}
          variant="outline"
          className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
          size="sm"
        >
          <FileText className="h-4 w-4" />
          Export PDF
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto max-h-[70vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10">
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Total Orders</TableHead>
              <TableHead className="text-right">Total Payments</TableHead>
              <TableHead className="text-right">Outstanding Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No customer ledger data available.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.customerId}>
                  <TableCell className="font-medium">{row.customer?.name || '—'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.totalOrders)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.totalPayments)}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        row.outstanding > 0
                          ? 'text-rose-600 dark:text-rose-400 font-medium'
                          : 'text-emerald-600 dark:text-emerald-400 font-medium'
                      }
                    >
                      {formatCurrency(row.outstanding)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {data.length > 0 && (
            <TableFooter>
              <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10">
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(totalOrders)}
                </TableCell>
                <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(totalPayments)}
                </TableCell>
                <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(totalOutstanding)}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}

// ── Stock Report ─────────────────────────────────────────────────────────────

function StockReport() {
  const [data, setData] = React.useState<StockRow[]>([])
  const [totalCurrentStock, setTotalCurrentStock] = React.useState(0)
  const [totalOpeningStock, setTotalOpeningStock] = React.useState(0)
  const [loading, setLoading] = React.useState(true)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getReport('stock')) as {
        data: StockRow[]
        totalCurrentStock: number
        totalOpeningStock: number
        lowStockItems: StockRow[]
      }
      setData(res.data || [])
      setTotalCurrentStock(res.totalCurrentStock || 0)
      setTotalOpeningStock(res.totalOpeningStock || 0)
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to load stock report',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const handleExportCSV = () => {
    const headers = ['Brick Type', 'Opening Stock', 'Current Stock', 'Status']
    const rows = data.map((row) => {
      const status = getStockStatus(row.currentStock)
      return [row.brickType, String(row.openingStock), String(row.currentStock), status.label]
    })
    exportCSV('stock-report', headers, rows)
  }

  const lowStockCount = data.filter((r) => r.lowStockAlert).length

  if (loading) return <TableSkeleton cols={4} />

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-900/10 p-3 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2 print:hidden">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Stock is a <b>live snapshot</b> of all-time production minus all-time sales.
          Date filters don&apos;t apply here — open the <b>Production</b> or <b>Sales</b> tab
          if you want period-based numbers.
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard title="Total Current Stock" value={formatNumber(totalCurrentStock)} icon={Package} variant="positive" />
        <SummaryCard title="Total Opening Stock" value={formatNumber(totalOpeningStock)} icon={BarChart3} />
        <SummaryCard
          title="Low Stock Items"
          value={String(lowStockCount)}
          icon={AlertCircle}
          variant={lowStockCount > 0 ? 'negative' : 'positive'}
        />
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button
          onClick={handleExportCSV}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          size="sm"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel
        </Button>
        <Button
          onClick={exportPDF}
          variant="outline"
          className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
          size="sm"
        >
          <FileText className="h-4 w-4" />
          Export PDF
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto max-h-[70vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10">
              <TableHead>Brick Type</TableHead>
              <TableHead className="text-right">Opening Stock</TableHead>
              <TableHead className="text-right">Current Stock</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No stock data available.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => {
                const status = getStockStatus(row.currentStock)
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.brickType}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.openingStock)}</TableCell>
                    <TableCell className="text-right font-medium">{formatNumber(row.currentStock)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={status.className}>
                        {status.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
          {data.length > 0 && (
            <TableFooter>
              <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10">
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                  {formatNumber(totalOpeningStock)}
                </TableCell>
                <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                  {formatNumber(totalCurrentStock)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}

// ── Profit & Loss Report ─────────────────────────────────────────────────────

function ProfitLossReport() {
  const [data, setData] = React.useState<ProfitLossData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<ReportFilterValue>({
    ...DEFAULT_FILTER,
    preset: 'thisMonth', // P&L defaults to current month
  })

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getReport('profit-loss', resolveFilterApiParams(filter))) as unknown as ProfitLossData
      setData(res)
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to load profit & loss report',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [filter])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const handleExportCSV = () => {
    if (!data) return
    const headers = ['Category', 'Amount']
    const rows: string[][] = [
      ['Revenue', formatCurrency(data.totalRevenue)],
      ['Expenses', formatCurrency(data.totalExpenses)],
      ['Net Profit', formatCurrency(data.netProfit)],
    ]
    if (data.expensesByCategory) {
      rows.push(['', ''])
      rows.push(['--- Expense Breakdown ---', ''])
      for (const [cat, amount] of Object.entries(data.expensesByCategory)) {
        rows.push([cat, formatCurrency(amount)])
      }
    }
    exportCSV('profit-loss-report', headers, rows)
  }

  if (loading) return <TableSkeleton cols={3} />

  if (!data) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No data available.
      </div>
    )
  }

  const isProfit = data.netProfit >= 0

  return (
    <div className="space-y-4">
      <ReportFilters value={filter} onChange={setFilter} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard title="Revenue" value={formatCurrency(data.totalRevenue)} icon={TrendingUp} variant="positive" />
        <SummaryCard title="Expenses" value={formatCurrency(data.totalExpenses)} icon={IndianRupee} variant="negative" />
        <SummaryCard
          title={isProfit ? 'Net Profit' : 'Net Loss'}
          value={formatCurrency(Math.abs(data.netProfit))}
          icon={isProfit ? TrendingUp : AlertCircle}
          variant={isProfit ? 'positive' : 'negative'}
        />
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button
          onClick={handleExportCSV}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          size="sm"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel
        </Button>
        <Button
          onClick={exportPDF}
          variant="outline"
          className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
          size="sm"
        >
          <FileText className="h-4 w-4" />
          Export PDF
        </Button>
      </div>

      {/* Summary Table */}
      <div className="rounded-md border overflow-x-auto max-h-[70vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10">
              <TableHead>Particulars</TableHead>
              <TableHead className="text-right">Amount (₹)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Revenue (Monthly Sales)</TableCell>
              <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-medium">
                {formatCurrency(data.totalRevenue)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Expenses (Monthly)</TableCell>
              <TableCell className="text-right text-rose-600 dark:text-rose-400 font-medium">
                ({formatCurrency(data.totalExpenses)})
              </TableCell>
            </TableRow>
            <TableRow className="border-t-2">
              <TableCell className="font-bold text-base">
                {isProfit ? 'Net Profit' : 'Net Loss'}
              </TableCell>
              <TableCell
                className={`text-right font-bold text-base ${
                  isProfit
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {isProfit ? '' : '('}
                {formatCurrency(Math.abs(data.netProfit))}
                {isProfit ? '' : ')'}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Expense Breakdown */}
      {data.expensesByCategory && Object.keys(data.expensesByCategory).length > 0 && (
        <Card className="py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expense Breakdown by Category</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="rounded-md border overflow-x-auto max-h-[70vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(data.expensesByCategory).map(([category, amount]) => (
                    <TableRow key={category}>
                      <TableCell>{category}</TableCell>
                      <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Total Expenses</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(data.totalExpenses)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Outstanding Report ───────────────────────────────────────────────────────

function OutstandingReport() {
  const [data, setData] = React.useState<OutstandingRow[]>([])
  const [totalOutstanding, setTotalOutstanding] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<ReportFilterValue>({ ...DEFAULT_FILTER })

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getReport('outstanding', resolveFilterApiParams(filter))) as {
        data: OutstandingRow[]
        totalOutstanding: number
      }
      setData(res.data || [])
      setTotalOutstanding(res.totalOutstanding || 0)
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to load outstanding report',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [filter])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const handleExportCSV = () => {
    const headers = ['Customer', 'Total Amount Due', 'Amount Paid', 'Balance Due']
    const rows = data.map((row) => [
      row.customer?.name || '—',
      formatCurrency(row.totalOrders),
      formatCurrency(row.totalPayments),
      formatCurrency(row.outstanding),
    ])
    exportCSV('outstanding-report', headers, rows)
  }

  const totalDue = data.reduce((sum, r) => sum + r.totalOrders, 0)
  const totalPaid = data.reduce((sum, r) => sum + r.totalPayments, 0)

  if (loading) return <TableSkeleton cols={4} />

  return (
    <div className="space-y-4">
      <ReportFilters value={filter} onChange={setFilter} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard title="Total Amount Due" value={formatCurrency(totalDue)} icon={IndianRupee} variant="negative" />
        <SummaryCard title="Total Paid" value={formatCurrency(totalPaid)} icon={Users} variant="positive" />
        <SummaryCard
          title="Balance Due"
          value={formatCurrency(totalOutstanding)}
          icon={AlertCircle}
          variant={totalOutstanding > 0 ? 'negative' : 'positive'}
        />
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button
          onClick={handleExportCSV}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          size="sm"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel
        </Button>
        <Button
          onClick={exportPDF}
          variant="outline"
          className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
          size="sm"
        >
          <FileText className="h-4 w-4" />
          Export PDF
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto max-h-[70vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10">
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Total Amount Due</TableHead>
              <TableHead className="text-right">Amount Paid</TableHead>
              <TableHead className="text-right">Balance Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No outstanding balances found.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.customer?.name || '—'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.totalOrders)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.totalPayments)}</TableCell>
                  <TableCell className="text-right">
                    <span className="text-rose-600 dark:text-rose-400 font-medium">
                      {formatCurrency(row.outstanding)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {data.length > 0 && (
            <TableFooter>
              <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10">
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(totalDue)}
                </TableCell>
                <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(totalPaid)}
                </TableCell>
                <TableCell className="text-right font-bold text-rose-600 dark:text-rose-400">
                  {formatCurrency(totalOutstanding)}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}

// ── Main Report Module ───────────────────────────────────────────────────────

export function ReportModule() {
  const [activeTab, setActiveTab] = React.useState('sales')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
          <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Generate and export business reports
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1 bg-emerald-50/50 dark:bg-emerald-900/10 p-1">
          <TabsTrigger
            value="sales"
            className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Sales Report</span>
            <span className="sm:hidden">Sales</span>
          </TabsTrigger>
          <TabsTrigger
            value="production"
            className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <Factory className="h-4 w-4" />
            <span className="hidden sm:inline">Production Report</span>
            <span className="sm:hidden">Production</span>
          </TabsTrigger>
          <TabsTrigger
            value="customer-ledger"
            className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Customer Ledger</span>
            <span className="sm:hidden">Ledger</span>
          </TabsTrigger>
          <TabsTrigger
            value="stock"
            className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Stock Report</span>
            <span className="sm:hidden">Stock</span>
          </TabsTrigger>
          <TabsTrigger
            value="profit-loss"
            className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Profit & Loss</span>
            <span className="sm:hidden">P&L</span>
          </TabsTrigger>
          <TabsTrigger
            value="outstanding"
            className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <AlertCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Outstanding Report</span>
            <span className="sm:hidden">Outstanding</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <SalesReport />
        </TabsContent>
        <TabsContent value="production">
          <ProductionReport />
        </TabsContent>
        <TabsContent value="customer-ledger">
          <CustomerLedgerReport />
        </TabsContent>
        <TabsContent value="stock">
          <StockReport />
        </TabsContent>
        <TabsContent value="profit-loss">
          <ProfitLossReport />
        </TabsContent>
        <TabsContent value="outstanding">
          <OutstandingReport />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ReportModule
