'use client'

import * as React from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  History, ShoppingCart, Truck, Banknote, IndianRupee, Package, TrendingUp,
  TrendingDown, Calendar, FileText, Loader2, Phone, MapPin,
} from 'lucide-react'

interface CustomerHistoryProps {
  customerId: string | null
  customerName?: string
  open: boolean
  onClose: () => void
}

interface Summary {
  totalOrderedAmount: number
  totalOrderedQty: number
  totalDispatchedQty: number
  totalCustomerPayments: number
  totalLegacyPayments: number
  totalPaid: number
  totalDailySellAmount: number
  billableAmount: number
  balance: number
  productionCount: number
  orderCount: number
  dispatchCount: number
  paymentCount: number
  dailySellCount: number
}

interface ProductionTotals {
  zigZagGrey80: number
  zigZagRed80: number
  zigZagYellow80: number
  zigZagGrey60: number
  zigZagRed60: number
  zigZagYellow60: number
  curveStone: number
  chequreTile: number
  dumbleGrey80: number
  dumbleRed80: number
  dumbleYellow80: number
  transportationCharge: number
}

interface TimelineEvent {
  id: string
  date: string
  type: 'order' | 'dispatch' | 'payment' | 'daily_sell' | 'customer_payment' | 'production'
  description: string
  amount: number
  qty?: number
  reference?: string
  remarks?: string
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(amount || 0)

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const eventTypeMeta: Record<TimelineEvent['type'], { label: string; color: string; icon: React.ReactNode }> = {
  order: { label: 'Order', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <ShoppingCart className="size-3" /> },
  dispatch: { label: 'Dispatch', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: <Truck className="size-3" /> },
  payment: { label: 'Payment', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <Banknote className="size-3" /> },
  customer_payment: { label: 'Cust. Payment', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <Banknote className="size-3" /> },
  daily_sell: { label: 'Daily Sell', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <TrendingUp className="size-3" /> },
  production: { label: 'Production', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: <Package className="size-3" /> },
}

export function CustomerHistoryModal({ customerId, open, onClose }: CustomerHistoryProps) {
  const [loading, setLoading] = React.useState(false)
  const [customer, setCustomer] = React.useState<Record<string, unknown> | null>(null)
  const [summary, setSummary] = React.useState<Summary | null>(null)
  const [productionTotals, setProductionTotals] = React.useState<ProductionTotals | null>(null)
  const [timeline, setTimeline] = React.useState<TimelineEvent[]>([])
  const [activeTab, setActiveTab] = React.useState<'timeline' | 'orders' | 'dispatches' | 'payments' | 'sells' | 'production'>('timeline')

  // raw collections for tab views
  const [orders, setOrders] = React.useState<Record<string, unknown>[]>([])
  const [dispatches, setDispatches] = React.useState<Record<string, unknown>[]>([])
  const [payments, setPayments] = React.useState<Record<string, unknown>[]>([])
  const [customerPayments, setCustomerPayments] = React.useState<Record<string, unknown>[]>([])
  const [dailySells, setDailySells] = React.useState<Record<string, unknown>[]>([])
  const [productions, setProductions] = React.useState<Record<string, unknown>[]>([])

  React.useEffect(() => {
    if (!open || !customerId) return
    let cancelled = false
    setLoading(true)
    setActiveTab('timeline')
    api.getCustomerHistory(customerId)
      .then((res) => {
        if (cancelled) return
        setCustomer(res.customer as Record<string, unknown>)
        setSummary(res.summary as unknown as Summary)
        setProductionTotals(res.productionTotals as unknown as ProductionTotals)
        setTimeline(res.timeline as unknown as TimelineEvent[])
        setOrders(res.orders as Record<string, unknown>[])
        setDispatches(res.dispatches as Record<string, unknown>[])
        setPayments(res.payments as Record<string, unknown>[])
        setCustomerPayments(res.customerPayments as Record<string, unknown>[])
        setDailySells(res.dailySells as Record<string, unknown>[])
        setProductions(res.productions as Record<string, unknown>[])
      })
      .catch((err) => {
        if (!cancelled) {
          toast({
            title: 'Error',
            description: err instanceof Error ? err.message : 'Failed to fetch customer history',
            variant: 'destructive',
          })
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, customerId])

  const tabs: { key: typeof activeTab; label: string; count: number }[] = [
    { key: 'timeline', label: 'Timeline', count: timeline.length },
    { key: 'orders', label: 'Orders', count: orders.length },
    { key: 'dispatches', label: 'Dispatch', count: dispatches.length },
    { key: 'payments', label: 'Payments', count: payments.length + customerPayments.length },
    { key: 'sells', label: 'Daily Sells', count: dailySells.length },
    { key: 'production', label: 'Production', count: productions.length },
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <History className="size-5 text-emerald-600" />
            Customer History — {customer ? String(customer.name || 'Loading…') : 'Loading…'}
          </DialogTitle>
          <DialogDescription>
            Complete transaction history from start to date
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
            <Skeleton className="h-8 w-full" />
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : !summary ? (
          <div className="py-8 text-center text-muted-foreground">No data available</div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Customer info bar */}
            {customer && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm border-b pb-3">
                <span className="flex items-center gap-2">
                  <Phone className="size-3.5 text-muted-foreground" />
                  <span className="font-medium">{String(customer.mobile || '—')}</span>
                </span>
                {customer.gstNumber ? (
                  <span className="flex items-center gap-2">
                    <FileText className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">{String(customer.gstNumber)}</span>
                  </span>
                ) : null}
                {customer.address ? (
                  <span className="flex items-center gap-2">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground line-clamp-1">{String(customer.address)}</span>
                  </span>
                ) : null}
                <span className="flex items-center gap-2">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Since {formatDate(String(customer.createdAt || ''))}</span>
                </span>
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 text-xs text-blue-700 mb-1">
                    <ShoppingCart className="size-3" /> Total Ordered
                  </div>
                  <div className="text-lg font-bold text-blue-900">{formatCurrency(summary.totalOrderedAmount || summary.totalDailySellAmount)}</div>
                  <div className="text-xs text-blue-700/80">{summary.orderCount} orders • {summary.totalOrderedQty} qty</div>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 mb-1">
                    <Banknote className="size-3" /> Total Paid
                  </div>
                  <div className="text-lg font-bold text-emerald-900">{formatCurrency(summary.totalPaid)}</div>
                  <div className="text-xs text-emerald-700/80">{summary.paymentCount} payments</div>
                </CardContent>
              </Card>
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 text-xs text-purple-700 mb-1">
                    <Truck className="size-3" /> Dispatched
                  </div>
                  <div className="text-lg font-bold text-purple-900">{summary.totalDispatchedQty} qty</div>
                  <div className="text-xs text-purple-700/80">{summary.dispatchCount} dispatches</div>
                </CardContent>
              </Card>
              <Card className={summary.balance >= 0 ? 'border-orange-200 bg-orange-50/50' : 'border-emerald-200 bg-emerald-50/50'}>
                <CardContent className="p-3">
                  <div className={`flex items-center gap-1.5 text-xs mb-1 ${summary.balance >= 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
                    {summary.balance >= 0 ? <TrendingDown className="size-3" /> : <TrendingUp className="size-3" />}
                    {summary.balance >= 0 ? 'Balance Due' : 'Advance'}
                  </div>
                  <div className={`text-lg font-bold ${summary.balance >= 0 ? 'text-orange-900' : 'text-emerald-900'}`}>
                    {formatCurrency(Math.abs(summary.balance))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {summary.balance >= 0 ? 'To collect' : 'To refund / adjust'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Production totals strip (only if production entries exist) */}
            {productionTotals && summary.productionCount > 0 && (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Package className="size-3" /> Production Summary ({summary.productionCount} entries)
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {productionTotals.zigZagGrey80 > 0 && <Badge variant="outline" className="bg-white">ZZ Grey 80: <b className="ml-1">{productionTotals.zigZagGrey80}</b></Badge>}
                  {productionTotals.zigZagRed80 > 0 && <Badge variant="outline" className="bg-white">ZZ Red 80: <b className="ml-1">{productionTotals.zigZagRed80}</b></Badge>}
                  {productionTotals.zigZagYellow80 > 0 && <Badge variant="outline" className="bg-white">ZZ Yellow 80: <b className="ml-1">{productionTotals.zigZagYellow80}</b></Badge>}
                  {productionTotals.zigZagGrey60 > 0 && <Badge variant="outline" className="bg-white">ZZ Grey 60: <b className="ml-1">{productionTotals.zigZagGrey60}</b></Badge>}
                  {productionTotals.zigZagRed60 > 0 && <Badge variant="outline" className="bg-white">ZZ Red 60: <b className="ml-1">{productionTotals.zigZagRed60}</b></Badge>}
                  {productionTotals.zigZagYellow60 > 0 && <Badge variant="outline" className="bg-white">ZZ Yellow 60: <b className="ml-1">{productionTotals.zigZagYellow60}</b></Badge>}
                  {productionTotals.dumbleGrey80 > 0 && <Badge variant="outline" className="bg-white">D Grey 80: <b className="ml-1">{productionTotals.dumbleGrey80}</b></Badge>}
                  {productionTotals.dumbleRed80 > 0 && <Badge variant="outline" className="bg-white">D Red 80: <b className="ml-1">{productionTotals.dumbleRed80}</b></Badge>}
                  {productionTotals.dumbleYellow80 > 0 && <Badge variant="outline" className="bg-white">D Yellow 80: <b className="ml-1">{productionTotals.dumbleYellow80}</b></Badge>}
                  {productionTotals.curveStone > 0 && <Badge variant="outline" className="bg-white">Curve Stone: <b className="ml-1">{productionTotals.curveStone}</b></Badge>}
                  {productionTotals.chequreTile > 0 && <Badge variant="outline" className="bg-white">Chequre Tile: <b className="ml-1">{productionTotals.chequreTile}</b></Badge>}
                  {productionTotals.transportationCharge > 0 && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                      <IndianRupee className="size-2.5 mr-0.5" />Transport: <b className="ml-1">{formatCurrency(productionTotals.transportationCharge)}</b>
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 border-b">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors ${
                    activeTab === t.key
                      ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {t.label} <span className="ml-1 text-xs opacity-70">({t.count})</span>
                </button>
              ))}
            </div>

            {/* Tab content — scrollable */}
            <div className="flex-1 overflow-y-auto pr-1 min-h-0">
              {activeTab === 'timeline' && (
                <TimelineView events={timeline} />
              )}
              {activeTab === 'orders' && (
                <OrdersView orders={orders} />
              )}
              {activeTab === 'dispatches' && (
                <DispatchesView dispatches={dispatches} />
              )}
              {activeTab === 'payments' && (
                <PaymentsView payments={payments} customerPayments={customerPayments} />
              )}
              {activeTab === 'sells' && (
                <DailySellsView dailySells={dailySells} />
              )}
              {activeTab === 'production' && (
                <ProductionView productions={productions} />
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Sub-views ──────────────────────────────────────────────────────────────

function TimelineView({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">No transactions yet for this customer.</div>
  }
  return (
    <div className="space-y-2">
      {events.map((e) => {
        const meta = eventTypeMeta[e.type]
        return (
          <div key={`${e.type}-${e.id}`} className="flex items-start gap-3 p-2.5 rounded-md border bg-card hover:bg-accent/50 transition-colors">
            <Badge variant="outline" className={`shrink-0 ${meta.color}`}>
              {meta.icon}
              <span className="ml-1">{meta.label}</span>
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">{e.description}</span>
                {e.amount > 0 && (
                  <span className="font-semibold text-sm whitespace-nowrap">{formatCurrency(e.amount)}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1"><Calendar className="size-3" />{formatDate(e.date)}</span>
                {e.reference && <span>Ref: <b>{e.reference}</b></span>}
                {e.qty !== undefined && e.qty > 0 && <span>Qty: <b>{e.qty}</b></span>}
                {e.remarks && <span className="truncate">{e.remarks}</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function OrdersView({ orders }: { orders: Record<string, unknown>[] }) {
  if (orders.length === 0) return <EmptyState message="No orders for this customer." />
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order #</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Products</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Rate</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.flatMap((o) => {
          // Multi-item orders store line items in `items[]`. Single-item
          // (legacy) orders only have the top-level `brickType` field. We
          // expand each multi-item order into N sub-rows so every product
          // gets its own Product / Qty / Rate / Amount cell — same Excel-
          // style layout the user requested for the main Order module.
          const items = Array.isArray(o.items) && o.items.length > 0
            ? (o.items as Array<{ description: string; quantity: number; rate: number; amount: number }>)
            : [{
                description: String(o.brickType || ''),
                quantity: Number(o.quantity || 0),
                rate: Number(o.rate || 0),
                amount: Number(o.amount || 0),
              }]
          const isMulti = items.length > 1
          const rowSpan = isMulti ? items.length : 1
          return items.map((line, idx) => {
            const isFirst = idx === 0
            return (
              <TableRow key={`${String(o._id || o.id)}-line-${idx}`}>
                {isFirst && (
                  <>
                    <TableCell className="font-mono text-xs align-top" rowSpan={rowSpan}>
                      <div className="flex flex-col gap-0.5">
                        <span>{String(o.orderNumber || '—')}</span>
                        {isMulti && (
                          <span className="inline-flex w-fit items-center rounded bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                            {items.length} items
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap align-top" rowSpan={rowSpan}>
                      {formatDate(String(o.deliveryDate || ''))}
                    </TableCell>
                  </>
                )}
                <TableCell className="align-top">
                  <span className="text-xs font-medium">{line.description || '—'}</span>
                </TableCell>
                <TableCell className="text-right align-top">{Number(line.quantity || 0)}</TableCell>
                <TableCell className="text-right align-top">{formatCurrency(Number(line.rate || 0))}</TableCell>
                <TableCell className="text-right font-medium align-top">{formatCurrency(Number(line.amount || 0))}</TableCell>
                {isFirst && (
                  <TableCell className="align-top" rowSpan={rowSpan}>
                    <Badge variant="outline" className="text-xs">{String(o.status || 'Pending')}</Badge>
                  </TableCell>
                )}
              </TableRow>
            )
          })
        })}
      </TableBody>
    </Table>
  )
}

function DispatchesView({ dispatches }: { dispatches: Record<string, unknown>[] }) {
  if (dispatches.length === 0) return <EmptyState message="No dispatches for this customer." />
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Dispatch #</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Brick Type</TableHead>
          <TableHead>Truck</TableHead>
          <TableHead>Driver</TableHead>
          <TableHead className="text-right">Qty</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dispatches.map((d) => (
          <TableRow key={String(d._id || d.id)}>
            <TableCell className="font-mono text-xs">{String(d.dispatchNumber || '—')}</TableCell>
            <TableCell className="whitespace-nowrap">{formatDate(String(d.date || ''))}</TableCell>
            <TableCell>{String(d.brickType || '—')}</TableCell>
            <TableCell className="font-mono text-xs">{String(d.truckNumber || '—')}</TableCell>
            <TableCell>{String(d.driverName || '—')}</TableCell>
            <TableCell className="text-right font-medium">{Number(d.quantity || 0)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function PaymentsView({ payments, customerPayments }: { payments: Record<string, unknown>[]; customerPayments: Record<string, unknown>[] }) {
  if (payments.length === 0 && customerPayments.length === 0) {
    return <EmptyState message="No payments recorded for this customer." />
  }
  const rows: { id: string; date: string; type: string; amount: number; remarks: string }[] = []
  for (const p of payments) {
    rows.push({
      id: String(p._id || p.id),
      date: String(p.date || ''),
      type: String(p.paymentType || 'Payment'),
      amount: Number(p.amount || 0),
      remarks: String(p.remarks || ''),
    })
  }
  for (const p of customerPayments) {
    rows.push({
      id: String(p._id || p.id),
      date: String(p.date || ''),
      type: 'Customer Payment',
      amount: Number(p.amount || 0),
      remarks: String(p.remarks || ''),
    })
  }
  rows.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Remarks</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="whitespace-nowrap">{formatDate(r.date)}</TableCell>
            <TableCell><Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{r.type}</Badge></TableCell>
            <TableCell className="text-right font-medium">{formatCurrency(r.amount)}</TableCell>
            <TableCell className="text-muted-foreground">{r.remarks || '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function DailySellsView({ dailySells }: { dailySells: Record<string, unknown>[] }) {
  if (dailySells.length === 0) return <EmptyState message="No daily sell records for this customer." />
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Rate</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Remarks</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dailySells.flatMap((d) => {
          // Multi-product records store line items in `products[]`. Single-
          // product (legacy) records only have the top-level `product` field.
          // Expand each multi-product record into N sub-rows so every product
          // gets its own Product / Qty / Rate / Amount cell (Excel-style).
          const prods = Array.isArray(d.products) && d.products.length > 0
            ? (d.products as Array<{ product: string; quantity: number; rate: number; amount: number }>)
            : [{
                product: String(d.product || ''),
                quantity: Number(d.quantity || 0),
                rate: Number(d.rate || 0),
                amount: Number(d.amount || 0),
              }]
          const isMulti = prods.length > 1
          const rowSpan = isMulti ? prods.length : 1
          return prods.map((line, idx) => {
            const isFirst = idx === 0
            return (
              <TableRow key={`${String(d._id || d.id)}-line-${idx}`}>
                {isFirst && (
                  <TableCell className="whitespace-nowrap align-top" rowSpan={rowSpan}>
                    <div className="flex flex-col gap-0.5">
                      <span>{formatDate(String(d.date || ''))}</span>
                      {isMulti && (
                        <span className="inline-flex w-fit items-center rounded bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                          {prods.length} items
                        </span>
                      )}
                    </div>
                  </TableCell>
                )}
                <TableCell className="align-top">
                  <span className="text-xs font-medium">{line.product || '—'}</span>
                </TableCell>
                <TableCell className="text-right align-top">{Number(line.quantity || 0)}</TableCell>
                <TableCell className="text-right align-top">{formatCurrency(Number(line.rate || 0))}</TableCell>
                <TableCell className="text-right font-medium align-top">{formatCurrency(Number(line.amount || 0))}</TableCell>
                {isFirst && (
                  <>
                    <TableCell className="text-muted-foreground align-top" rowSpan={rowSpan}>{String(d.address || '—')}</TableCell>
                    <TableCell className="align-top" rowSpan={rowSpan}>{String(d.contactNumber || '—')}</TableCell>
                    <TableCell className="text-muted-foreground align-top" rowSpan={rowSpan}>{String(d.remarks || '—')}</TableCell>
                  </>
                )}
              </TableRow>
            )
          })
        })}
      </TableBody>
    </Table>
  )
}

function ProductionView({ productions }: { productions: Record<string, unknown>[] }) {
  if (productions.length === 0) return <EmptyState message="No production entries for this customer." />
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">ZZ G80</TableHead>
            <TableHead className="text-right">ZZ R80</TableHead>
            <TableHead className="text-right">ZZ Y80</TableHead>
            <TableHead className="text-right">ZZ G60</TableHead>
            <TableHead className="text-right">ZZ R60</TableHead>
            <TableHead className="text-right">ZZ Y60</TableHead>
            <TableHead className="text-right">Curve</TableHead>
            <TableHead className="text-right">Chequre</TableHead>
            <TableHead className="text-right">D G80</TableHead>
            <TableHead className="text-right">D R80</TableHead>
            <TableHead className="text-right">D Y80</TableHead>
            <TableHead className="text-right">Transport</TableHead>
            <TableHead>Remarks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {productions.map((p) => (
            <TableRow key={String(p._id || p.id)}>
              <TableCell className="whitespace-nowrap">{formatDate(String(p.date || ''))}</TableCell>
              <TableCell className="text-right">{Number(p.zigZagGrey80 || 0)}</TableCell>
              <TableCell className="text-right">{Number(p.zigZagRed80 || 0)}</TableCell>
              <TableCell className="text-right">{Number(p.zigZagYellow80 || 0)}</TableCell>
              <TableCell className="text-right">{Number(p.zigZagGrey60 || 0)}</TableCell>
              <TableCell className="text-right">{Number(p.zigZagRed60 || 0)}</TableCell>
              <TableCell className="text-right">{Number(p.zigZagYellow60 || 0)}</TableCell>
              <TableCell className="text-right">{Number(p.curveStone || 0)}</TableCell>
              <TableCell className="text-right">{Number(p.chequreTile || 0)}</TableCell>
              <TableCell className="text-right">{Number(p.dumbleGrey80 || 0)}</TableCell>
              <TableCell className="text-right">{Number(p.dumbleRed80 || 0)}</TableCell>
              <TableCell className="text-right">{Number(p.dumbleYellow80 || 0)}</TableCell>
              <TableCell className="text-right whitespace-nowrap">{formatCurrency(Number(p.transportationCharge || 0))}</TableCell>
              <TableCell className="text-muted-foreground text-xs">{String(p.remarks || '—')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="py-10 text-center text-muted-foreground text-sm">{message}</div>
}

export default CustomerHistoryModal
