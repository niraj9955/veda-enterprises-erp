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

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getReport('sales')) as {
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
  }, [])

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

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getReport('production')) as {
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
  }, [])

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

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getReport('profit-loss')) as unknown as ProfitLossData
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
  }, [])

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

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getReport('outstanding')) as {
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
  }, [])

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
