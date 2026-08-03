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
  History, ShoppingCart, Truck, Banknote, IndianRupee,
  TrendingUp, TrendingDown, Calendar, FileText, Loader2, Phone, MapPin,
  ArrowLeft, Printer,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CustomerHistoryPageProps {
  customerId: string
  onBack: () => void
}

interface Summary {
  totalOrderedAmount: number
  totalOrderedQty: number
  totalDispatchedQty: number
  totalCustomerPayments: number
  totalLegacyPayments: number
  totalPaid: number
  billableAmount: number
  balance: number
  orderCount: number
  dispatchCount: number
  paymentCount: number
}

interface TimelineEvent {
  id: string
  date: string
  type: 'order' | 'dispatch' | 'payment' | 'customer_payment'
  description: string
  amount: number
  qty?: number
  reference?: string
  remarks?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CustomerHistoryPage({ customerId, onBack }: CustomerHistoryPageProps) {
  const [loading, setLoading] = React.useState(true)
  const [customer, setCustomer] = React.useState<Record<string, unknown> | null>(null)
  const [summary, setSummary] = React.useState<Summary | null>(null)
  const [timeline, setTimeline] = React.useState<TimelineEvent[]>([])

  // raw collections for tab views
  const [orders, setOrders] = React.useState<Record<string, unknown>[]>([])
  const [dispatches, setDispatches] = React.useState<Record<string, unknown>[]>([])
  const [payments, setPayments] = React.useState<Record<string, unknown>[]>([])
  const [customerPayments, setCustomerPayments] = React.useState<Record<string, unknown>[]>([])

  const [activeTab, setActiveTab] = React.useState<'timeline' | 'orders' | 'dispatches' | 'payments'>('timeline')

  React.useEffect(() => {
    if (!customerId) return
    let cancelled = false
    setLoading(true)
    setActiveTab('timeline')
    api.getCustomerHistory(customerId)
      .then((res) => {
        if (cancelled) return
        setCustomer(res.customer as Record<string, unknown>)
        setSummary(res.summary as unknown as Summary)
        setTimeline(res.timeline as unknown as TimelineEvent[])
        setOrders(res.orders as Record<string, unknown>[])
        setDispatches(res.dispatches as Record<string, unknown>[])
        setPayments(res.payments as Record<string, unknown>[])
        setCustomerPayments(res.customerPayments as Record<string, unknown>[])
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
  }, [customerId])

  const handlePrint = React.useCallback(() => {
    window.print()
  }, [])

  const tabs: { key: typeof activeTab; label: string; count: number }[] = [
    { key: 'timeline', label: 'Timeline', count: timeline.length },
    { key: 'orders', label: 'Orders', count: orders.length },
    { key: 'dispatches', label: 'Dispatch', count: dispatches.length },
    { key: 'payments', label: 'Payments', count: payments.length + customerPayments.length },
  ]

  return (
    <div className="space-y-4 print:space-y-3">
      {/* Top bar — Back + Print (hidden when printing) */}
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4 mr-1.5" />
          Back to Customers
        </Button>
        <Button onClick={handlePrint} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Printer className="size-4 mr-1.5" />
          Print History
        </Button>
      </div>

      {/* Header — visible on screen AND in print */}
      <div className="border-b pb-3 print:border-black print:border-b-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight print:text-3xl">
          <History className="size-6 text-emerald-600 print:hidden" />
          Customer Ledger
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Complete transaction history from start to date
        </p>
      </div>

      {loading ? (
        <HistorySkeleton />
      ) : !summary ? (
        <div className="py-8 text-center text-muted-foreground">No data available</div>
      ) : (
        <>
          {/* Customer info bar */}
          {customer && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm border-b pb-3 print:border-black/30">
              <span className="text-xl font-bold text-emerald-700 print:text-black">
                {String(customer.name || '—')}
              </span>
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

          {/* Summary cards — 4 KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:grid-cols-4 print:gap-2">
            <Card className="border-blue-200 bg-blue-50/50 print:border-black print:bg-white">
              <CardContent className="p-3 print:border print:border-black/30">
                <div className="flex items-center gap-1.5 text-xs text-blue-700 mb-1 print:text-black">
                  <ShoppingCart className="size-3" /> Total Ordered
                </div>
                <div className="text-lg font-bold text-blue-900 print:text-black">{formatCurrency(summary.totalOrderedAmount)}</div>
                <div className="text-xs text-blue-700/80 print:text-black">{summary.orderCount} orders • {summary.totalOrderedQty} qty</div>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50/50 print:border-black print:bg-white">
              <CardContent className="p-3 print:border print:border-black/30">
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 mb-1 print:text-black">
                  <Banknote className="size-3" /> Total Paid
                </div>
                <div className="text-lg font-bold text-emerald-900 print:text-black">{formatCurrency(summary.totalPaid)}</div>
                <div className="text-xs text-emerald-700/80 print:text-black">{summary.paymentCount} payments</div>
              </CardContent>
            </Card>
            <Card className="border-purple-200 bg-purple-50/50 print:border-black print:bg-white">
              <CardContent className="p-3 print:border print:border-black/30">
                <div className="flex items-center gap-1.5 text-xs text-purple-700 mb-1 print:text-black">
                  <Truck className="size-3" /> Dispatched
                </div>
                <div className="text-lg font-bold text-purple-900 print:text-black">{summary.totalDispatchedQty} qty</div>
                <div className="text-xs text-purple-700/80 print:text-black">{summary.dispatchCount} dispatches</div>
              </CardContent>
            </Card>
            <Card className={summary.balance >= 0 ? 'border-orange-200 bg-orange-50/50 print:border-black print:bg-white' : 'border-emerald-200 bg-emerald-50/50 print:border-black print:bg-white'}>
              <CardContent className="p-3 print:border print:border-black/30">
                <div className={`flex items-center gap-1.5 text-xs mb-1 print:text-black ${summary.balance >= 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
                  {summary.balance >= 0 ? <TrendingDown className="size-3" /> : <TrendingUp className="size-3" />}
                  {summary.balance >= 0 ? 'Balance Due' : 'Advance'}
                </div>
                <div className={`text-lg font-bold print:text-black ${summary.balance >= 0 ? 'text-orange-900' : 'text-emerald-900'}`}>
                  {formatCurrency(Math.abs(summary.balance))}
                </div>
                <div className="text-xs text-muted-foreground print:text-black">
                  {summary.balance >= 0 ? 'To collect' : 'To refund / adjust'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs — hidden when printing (print shows full timeline) */}
          <div className="flex flex-wrap gap-1 border-b print:hidden">
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

          {/* Tab content — on screen, scrollable; on print, show full timeline */}
          <div className="print:hidden">
            {activeTab === 'timeline' && <TimelineView events={timeline} />}
            {activeTab === 'orders' && <OrdersView orders={orders} />}
            {activeTab === 'dispatches' && <DispatchesView dispatches={dispatches} />}
            {activeTab === 'payments' && <PaymentsView payments={payments} customerPayments={customerPayments} />}
          </div>

          {/* Print-only: full timeline table */}
          <div className="hidden print:block">
            <PrintTimelineView events={timeline} />
          </div>
        </>
      )}
    </div>
  )
}

// ─── Sub-views ──────────────────────────────────────────────────────────────

function HistorySkeleton() {
  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  )
}

function TimelineView({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">No transactions yet for this customer.</div>
  }
  return (
    <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-2">
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
    <div className="max-h-[60vh] overflow-y-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
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
          {orders.map((o) => {
            // Multi-item orders store line items in `items[]`. Single-item
            // (legacy) orders only have the top-level `brickType` field.
            const items = Array.isArray(o.items) ? (o.items as Array<{ description: string; quantity: number; rate: number; amount: number }>) : []
            const hasMulti = items.length > 1
            return (
              <TableRow key={String(o._id || o.id)}>
                <TableCell className="font-mono text-xs">{String(o.orderNumber || '—')}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(String(o.deliveryDate || ''))}</TableCell>
                <TableCell>
                  {hasMulti ? (
                    <div className="flex flex-col gap-0.5">
                      {items.map((it, i) => (
                        <span key={i} className="text-xs">
                          <span className="font-medium">{it.description || '—'}</span>
                          <span className="text-muted-foreground"> × {Number(it.quantity || 0)}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs">{String(o.brickType || items[0]?.description || '—')}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {hasMulti ? (
                    <span className="text-xs text-muted-foreground italic">sum: {Number(o.quantity || 0)}</span>
                  ) : (
                    Number(o.quantity || 0)
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {hasMulti ? (
                    <span className="text-xs text-muted-foreground italic">varies</span>
                  ) : (
                    formatCurrency(Number(o.rate || 0))
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(Number(o.amount || 0))}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{String(o.status || 'Pending')}</Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function DispatchesView({ dispatches }: { dispatches: Record<string, unknown>[] }) {
  if (dispatches.length === 0) return <EmptyState message="No dispatches for this customer." />
  return (
    <div className="max-h-[60vh] overflow-y-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
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
    </div>
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
    <div className="max-h-[60vh] overflow-y-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
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
    </div>
  )
}

// Print-only view: full table with all events, no scroll, no interactivity.
function PrintTimelineView({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p style={{ textAlign: 'center', fontStyle: 'italic' }}>No transactions on record.</p>
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '8px' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid black' }}>
          <th style={{ textAlign: 'left', padding: '4px 6px' }}>Date</th>
          <th style={{ textAlign: 'left', padding: '4px 6px' }}>Type</th>
          <th style={{ textAlign: 'left', padding: '4px 6px' }}>Description</th>
          <th style={{ textAlign: 'right', padding: '4px 6px' }}>Qty</th>
          <th style={{ textAlign: 'right', padding: '4px 6px' }}>Amount</th>
          <th style={{ textAlign: 'left', padding: '4px 6px' }}>Reference</th>
          <th style={{ textAlign: 'left', padding: '4px 6px' }}>Remarks</th>
        </tr>
      </thead>
      <tbody>
        {events.map((e) => (
          <tr key={`${e.type}-${e.id}`} style={{ borderBottom: '1px solid #ccc' }}>
            <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>{formatDate(e.date)}</td>
            <td style={{ padding: '4px 6px' }}>{eventTypeMeta[e.type].label}</td>
            <td style={{ padding: '4px 6px' }}>{e.description}</td>
            <td style={{ padding: '4px 6px', textAlign: 'right' }}>{e.qty || '—'}</td>
            <td style={{ padding: '4px 6px', textAlign: 'right' }}>{e.amount > 0 ? formatCurrency(e.amount) : '—'}</td>
            <td style={{ padding: '4px 6px' }}>{e.reference || '—'}</td>
            <td style={{ padding: '4px 6px' }}>{e.remarks || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="py-10 text-center text-muted-foreground text-sm">{message}</div>
}

export default CustomerHistoryPage
