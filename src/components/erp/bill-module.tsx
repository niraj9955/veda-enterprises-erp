'use client'

import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import {
  Plus, Trash2, Edit, Printer, FileText, Search, UserCheck, X,
  ArrowLeft, Loader2, Package, Truck, FileSpreadsheet, ShoppingCart,
  ClipboardList, IndianRupee,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface BillItem {
  description: string
  hsn: string
  quantity: number
  unit: string
  rate: number
  amount: number
}

interface Bill {
  id: string
  billNumber: string
  billType: string
  date: string
  dueDate?: string
  customerId?: string | null
  fromName: string
  fromAddress: string
  fromGst: string
  fromPhone: string
  toName: string
  toAddress: string
  toGst: string
  toPhone: string
  items: BillItem[]
  subTotal: number
  discountPercent: number
  discountAmount: number
  taxableAmount: number
  cgstPercent: number
  cgstAmount: number
  sgstPercent: number
  sgstAmount: number
  igstPercent: number
  igstAmount: number
  roundOff: number
  grandTotal: number
  paidAmount: number
  balanceAmount: number
  paymentMode: string
  notes: string
  terms: string
  status: string
}

interface CustomerSearchResult {
  id: string
  name: string
  mobile?: string
  address?: string
  gstNumber?: string
}

interface ProductionRow {
  id: string
  date: string
  customerName?: string
  address?: string
  zigZagGrey80?: number
  zigZagRed80?: number
  zigZagYellow80?: number
  zigZagGrey60?: number
  zigZagRed60?: number
  zigZagYellow60?: number
  curveStone?: number
  chequreTile?: number
  dumbleGrey80?: number
  dumbleRed80?: number
  dumbleYellow80?: number
  transportationCharge?: number
  remarks?: string
}

interface OrderRow {
  id: string
  orderNumber: string
  brickType?: string
  quantity?: number
  rate?: number
  amount?: number
  deliveryDate: string
  status?: string
  items?: Array<{
    description: string
    hsn?: string
    quantity: number
    unit?: string
    rate: number
    amount: number
  }>
}

interface PaymentRow {
  id: string
  paymentType: string
  amount: number
  date: string
  remarks?: string
  billId?: string | null
  billNumber?: string
}

interface CustomerBillHistory {
  customer: { id: string; name: string; mobile?: string; address?: string; gstNumber?: string }
  productions: ProductionRow[]
  dispatches: any[]
  bills: any[]
  orders: OrderRow[]
  payments: PaymentRow[]
  productFields: Array<{ key: string; label: string; hsn: string }>
  summary: {
    productionCount: number
    dispatchCount: number
    billCount: number
    orderCount: number
    paymentCount: number
    totalDispatchedQty: number
    totalPreviouslyBilled: number
    totalPreviouslyPaid: number
    totalPaymentsReceived: number
    outstanding: number
    productTotals: Record<string, number>
  }
}

const PRODUCT_PRESETS = [
  'Cement',
  'Zig Zag Grey 80mm',
  'Zig Zag Red 80mm',
  'Zig Zag Yellow 80mm',
  'Zig Zag Grey 60mm',
  'Zig Zag Red 60mm',
  'Zig Zag Yellow 60mm',
  'Chequre Tile',
  'Curve Stone',
  'Dumble Grey 80mm',
  'Dumble Red 80mm',
  'Dumble Yellow 80mm',
  'Dust',
  'Hardner',
  'Other',
]

const BILL_TYPES = [
  { value: 'sales', label: 'Sales Invoice' },
  { value: 'purchase', label: 'Purchase Bill' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'service', label: 'Service Bill' },
  { value: 'other', label: 'Other Bill' },
]

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500 line-through',
}

// Map a production field key to the matching PRODUCT_PRESETS label
const PROD_FIELD_TO_LABEL: Record<string, string> = {
  cement: 'Cement (bags)',
  zigZagGrey80: 'Zig Zag Grey 80mm',
  zigZagRed80: 'Zig Zag Red 80mm',
  zigZagYellow80: 'Zig Zag Yellow 80mm',
  zigZagGrey60: 'Zig Zag Grey 60mm',
  zigZagRed60: 'Zig Zag Red 60mm',
  zigZagYellow60: 'Zig Zag Yellow 60mm',
  chequreTile: 'Chequre Tile',
  curveStone: 'Curve Stone',
  dumbleGrey80: 'Dumble Grey 80mm',
  dumbleRed80: 'Dumble Red 80mm',
  dumbleYellow80: 'Dumble Yellow 80mm',
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN MODULE
// ════════════════════════════════════════════════════════════════════════════
export default function BillModule() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  // Three view states:
  //   list   → bills table + Create button
  //   create → full-screen Create Bill page
  //   edit   → full-screen Edit Bill page (uses same component as create)
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [printBill, setPrintBill] = useState<Bill | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')

  const loadBills = async () => {
    setLoading(true)
    try {
      const data = await api.getBills()
      setBills(data.bills as Bill[])
    } catch {
      toast({ title: 'Error', description: 'Failed to load bills', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBills()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bill?')) return
    try {
      await api.deleteBill(id)
      toast({ title: 'Deleted', description: 'Bill deleted successfully' })
      loadBills()
    } catch {
      toast({ title: 'Error', description: 'Failed to delete bill', variant: 'destructive' })
    }
  }

  const filteredBills = bills.filter((b) => {
    const matchSearch = b.billNumber.toLowerCase().includes(search.toLowerCase()) ||
      b.toName.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || b.billType === filterType
    return matchSearch && matchType
  })

  const totalAmount = filteredBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0)
  const totalPaid = filteredBills.reduce((sum, b) => sum + (b.paidAmount || 0), 0)
  const totalDue = filteredBills.reduce((sum, b) => sum + (b.balanceAmount || 0), 0)

  // Print view takes over the entire module area
  if (printBill) {
    return <PrintBill bill={printBill} onClose={() => setPrintBill(null)} />
  }

  // Create / Edit full-screen view
  if (view === 'create' || view === 'edit') {
    return (
      <BillCreatePage
        editingBill={view === 'edit' ? editingBill : null}
        onBack={async () => {
          setView('list')
          setEditingBill(null)
          await loadBills()
        }}
      />
    )
  }

  // Default: list view
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">Billing System</h1>
          <p className="text-sm text-muted-foreground">Generate invoices, quotations, and bills for any transaction</p>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => { setEditingBill(null); setView('create') }}
        >
          <Plus className="h-4 w-4 mr-2" /> Create New Bill
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Billed</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">₹{totalAmount.toLocaleString('en-IN')}</p>
            <p className="text-xs text-muted-foreground mt-1">{filteredBills.length} bills</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Received</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">₹{totalPaid.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Outstanding</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">₹{totalDue.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by bill number or party name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {BILL_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bills table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Bill No.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Party Name</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading bills...</TableCell>
                </TableRow>
              ) : filteredBills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    No bills yet. Click "Create New Bill" to generate your first invoice.
                  </TableCell>
                </TableRow>
              ) : (
                filteredBills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">{bill.billNumber}</TableCell>
                    <TableCell>{bill.date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {BILL_TYPES.find((t) => t.value === bill.billType)?.label || bill.billType}
                      </Badge>
                    </TableCell>
                    <TableCell>{bill.toName}</TableCell>
                    <TableCell className="text-right font-medium">₹{(bill.grandTotal || 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-right text-emerald-600 dark:text-emerald-400">₹{(bill.paidAmount || 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-right text-amber-600 dark:text-amber-400">₹{(bill.balanceAmount || 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[bill.status] || STATUS_COLORS.draft}`}>
                        {bill.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setPrintBill(bill)} title="Print/View">
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { setEditingBill(bill); setView('edit') }} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(bill.id)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// FULL-SCREEN CREATE / EDIT BILL PAGE
// ════════════════════════════════════════════════════════════════════════════
// Replaces the old Dialog-based form. Lives at the top level of BillModule
// (not in a Dialog) so the user gets a proper full-page experience with
// plenty of room for the customer search + history + items table.
function BillCreatePage({
  editingBill,
  onBack,
}: {
  editingBill: Bill | null
  onBack: () => void
}) {
  const [billType, setBillType] = useState(editingBill?.billType || 'sales')
  const [date, setDate] = useState(editingBill?.date || new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(editingBill?.dueDate || '')
  const [customerId, setCustomerId] = useState<string | null>(editingBill?.customerId || null)
  const [toName, setToName] = useState(editingBill?.toName || '')
  const [toAddress, setToAddress] = useState(editingBill?.toAddress || '')
  const [toGst, setToGst] = useState(editingBill?.toGst || '')
  const [toPhone, setToPhone] = useState(editingBill?.toPhone || '')
  const [items, setItems] = useState<BillItem[]>(
    editingBill?.items?.length ? editingBill.items : [{ description: '', hsn: '', quantity: 1, unit: 'pcs', rate: 0, amount: 0 }]
  )
  const [discountPercent, setDiscountPercent] = useState(editingBill?.discountPercent || 0)
  const [cgstPercent, setCgstPercent] = useState(editingBill?.cgstPercent || 0)
  const [sgstPercent, setSgstPercent] = useState(editingBill?.sgstPercent || 0)
  const [igstPercent, setIgstPercent] = useState(editingBill?.igstPercent || 0)
  const [paidAmount, setPaidAmount] = useState(editingBill?.paidAmount || 0)
  const [paymentMode, setPaymentMode] = useState(editingBill?.paymentMode || 'Cash')
  const [notes, setNotes] = useState(editingBill?.notes || '')
  const [terms, setTerms] = useState(editingBill?.terms || '')
  const [saving, setSaving] = useState(false)

  // History panel state — populated when a customer is selected
  const [history, setHistory] = useState<CustomerBillHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [activeHistoryTab, setActiveHistoryTab] = useState<'orders' | 'production' | 'dispatches' | 'bills' | 'payments'>('orders')

  // ─── Customer selection handler ──────────────────────────────────────────
  // When a customer is picked from the search dropdown:
  //   1. Set the customer link (so paidAmount auto-syncs to Payments)
  //   2. Fill party details from the customer record
  //   3. Fetch their full production/dispatch/bill history
  const selectCustomer = async (c: CustomerSearchResult) => {
    setCustomerId(c.id)
    setToName(c.name)
    setToPhone(c.mobile || '')
    setToAddress(c.address || '')
    setToGst(c.gstNumber || '')
    await loadHistory(c.id)
  }

  const loadHistory = async (id: string) => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const data = await api.getCustomerBillHistory(id)
      setHistory(data)
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load history')
      setHistory(null)
    } finally {
      setHistoryLoading(false)
    }
  }

  // ─── Item management ─────────────────────────────────────────────────────
  const updateItem = (index: number, field: keyof BillItem, value: string | number) => {
    const newItems = [...items]
    if (field === 'description' || field === 'hsn' || field === 'unit') {
      newItems[index][field] = value as string
    } else {
      newItems[index][field] = Number(value) || 0
    }
    newItems[index].amount = newItems[index].quantity * newItems[index].rate
    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, { description: '', hsn: '', quantity: 1, unit: 'pcs', rate: 0, amount: 0 }])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index))
  }

  // ─── Add a single production row's products to the bill ──────────────────
  // Flattens the production's product-wise quantities into individual line
  // items (skipping zero-quantity products). Transportation charge, if any,
  // is added as a separate "Transportation" line item.
  const addProductionToBill = (prod: ProductionRow) => {
    const newItems: BillItem[] = []
    for (const [key, label] of Object.entries(PROD_FIELD_TO_LABEL)) {
      const qty = Number((prod as any)[key]) || 0
      if (qty > 0) {
        newItems.push({
          description: label,
          hsn: '6810',
          quantity: qty,
          unit: 'pcs',
          rate: 0,
          amount: 0,
        })
      }
    }
    if (Number(prod.transportationCharge) > 0) {
      newItems.push({
        description: 'Transportation Charge',
        hsn: '9965',
        quantity: 1,
        unit: 'lot',
        rate: Number(prod.transportationCharge),
        amount: Number(prod.transportationCharge),
      })
    }
    if (newItems.length === 0) {
      toast({ title: 'No products', description: 'This production record has no billable quantities.', variant: 'destructive' })
      return
    }
    // Merge into existing items — if an item with the same description already
    // exists, sum the quantities (so multiple production rows for the same
    // product combine into one line).
    setItems((prev) => {
      const merged = [...prev.filter((i) => i.description.trim() !== '')]
      for (const ni of newItems) {
        const existing = merged.find((m) => m.description === ni.description && m.unit === ni.unit)
        if (existing) {
          existing.quantity += ni.quantity
          existing.amount = existing.quantity * existing.rate
        } else {
          merged.push(ni)
        }
      }
      // Always ensure at least one editable row at the bottom
      if (merged.length === 0 || merged[merged.length - 1].description.trim() !== '') {
        merged.push({ description: '', hsn: '', quantity: 1, unit: 'pcs', rate: 0, amount: 0 })
      }
      return merged
    })
    toast({
      title: 'Added to bill',
      description: `${newItems.length} item${newItems.length > 1 ? 's' : ''} from production dated ${prod.date}. Set the rate for each item to calculate amounts.`,
    })
  }

  // ─── Add ALL production rows' products to the bill in one click ──────────
  // Uses the aggregated product totals from the summary so we get a single
  // line per product type with the summed quantity.
  const addAllProductionToBill = () => {
    if (!history || !history.summary.productTotals) {
      toast({ title: 'No data', description: 'No production history to add.', variant: 'destructive' })
      return
    }
    const newItems: BillItem[] = []
    for (const [key, label] of Object.entries(PROD_FIELD_TO_LABEL)) {
      const qty = Number(history.summary.productTotals[key]) || 0
      if (qty > 0) {
        newItems.push({
          description: label,
          hsn: '6810',
          quantity: qty,
          unit: 'pcs',
          rate: 0,
          amount: 0,
        })
      }
    }
    if (newItems.length === 0) {
      toast({ title: 'No products', description: 'Customer has no production records to bill.', variant: 'destructive' })
      return
    }
    setItems((prev) => {
      const merged = [...prev.filter((i) => i.description.trim() !== '')]
      for (const ni of newItems) {
        const existing = merged.find((m) => m.description === ni.description && m.unit === ni.unit)
        if (existing) {
          existing.quantity += ni.quantity
          existing.amount = existing.quantity * existing.rate
        } else {
          merged.push(ni)
        }
      }
      if (merged.length === 0 || merged[merged.length - 1].description.trim() !== '') {
        merged.push({ description: '', hsn: '', quantity: 1, unit: 'pcs', rate: 0, amount: 0 })
      }
      return merged
    })
    toast({
      title: 'All production added',
      description: `${newItems.length} product types from ${history.summary.productionCount} production records. Set rates to calculate amounts.`,
    })
  }

  // ─── Add an order's line items to the bill ──────────────────────────────
  // Order items already have description, hsn, quantity, unit, rate, amount —
  // we copy them straight into the bill's items[] table. If the order uses
  // the legacy brickType + quantity + rate fields (no items[]), we convert
  // those into a single line item.
  const addOrderToBill = (order: OrderRow) => {
    const newItems: BillItem[] = []
    if (order.items && order.items.length > 0) {
      for (const it of order.items) {
        if (!it.description?.trim() && Number(it.quantity) === 0) continue
        newItems.push({
          description: it.description || order.brickType || 'Item',
          hsn: it.hsn || '',
          quantity: Number(it.quantity) || 0,
          unit: it.unit || 'pcs',
          rate: Number(it.rate) || 0,
          amount: Number(it.amount) || (Number(it.quantity) || 0) * (Number(it.rate) || 0),
        })
      }
    } else if (order.brickType && Number(order.quantity) > 0) {
      // Legacy single-line order — convert to one bill item
      newItems.push({
        description: order.brickType,
        hsn: '6810',
        quantity: Number(order.quantity) || 0,
        unit: 'pcs',
        rate: Number(order.rate) || 0,
        amount: Number(order.amount) || (Number(order.quantity) || 0) * (Number(order.rate) || 0),
      })
    }
    if (newItems.length === 0) {
      toast({ title: 'No items', description: 'This order has no billable items.', variant: 'destructive' })
      return
    }
    // Replace current items (an order IS the bill spec, so we don't merge —
    // we overwrite). Keep the bottom editable blank row for further edits.
    setItems(() => {
      const merged = [...newItems]
      if (merged.length === 0 || merged[merged.length - 1].description.trim() !== '') {
        merged.push({ description: '', hsn: '', quantity: 1, unit: 'pcs', rate: 0, amount: 0 })
      }
      return merged
    })
    // Auto-fill paidAmount if customer has advance payments (so the user
    // doesn't have to manually look up what's been paid already).
    const totalReceived = history?.summary?.totalPaymentsReceived ?? 0
    if (totalReceived > 0 && paidAmount === 0) {
      setPaidAmount(totalReceived)
      toast({
        title: 'Order imported + advance applied',
        description: `${newItems.length} item${newItems.length > 1 ? 's' : ''} from order ${order.orderNumber}. Advance of ₹${totalReceived.toLocaleString('en-IN')} auto-applied to Paid Amount — adjust if needed.`,
      })
    } else {
      toast({
        title: 'Order imported',
        description: `${newItems.length} item${newItems.length > 1 ? 's' : ''} from order ${order.orderNumber} added to bill.`,
      })
    }
  }

  // ─── Calculations ────────────────────────────────────────────────────────
  const subTotal = items.reduce((sum, item) => sum + (item.amount || 0), 0)
  const discountAmount = (subTotal * discountPercent) / 100
  const taxableAmount = subTotal - discountAmount
  const cgstAmount = (taxableAmount * cgstPercent) / 100
  const sgstAmount = (taxableAmount * sgstPercent) / 100
  const igstAmount = (taxableAmount * igstPercent) / 100
  const totalBeforeRound = taxableAmount + cgstAmount + sgstAmount + igstAmount
  const grandTotal = Math.round(totalBeforeRound)
  const roundOff = grandTotal - totalBeforeRound
  const balanceAmount = grandTotal - paidAmount

  // ─── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!toName.trim()) {
      toast({ title: 'Error', description: 'Party name is required', variant: 'destructive' })
      return
    }
    if (items.length === 0 || items.every((i) => !i.description.trim())) {
      toast({ title: 'Error', description: 'Add at least one item', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const payload = {
        billType,
        date,
        dueDate,
        customerId: customerId || null,
        toName, toAddress, toGst, toPhone,
        items: items.filter((i) => i.description.trim()),
        discountPercent,
        cgstPercent, sgstPercent, igstPercent,
        paidAmount,
        paymentMode,
        notes,
        terms,
      }
      if (editingBill) {
        await api.updateBill(editingBill.id, payload)
        toast({ title: 'Updated', description: 'Bill updated successfully' })
      } else {
        await api.createBill(payload)
        toast({ title: 'Created', description: 'Bill created successfully' })
      }
      onBack()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save bill', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 sticky top-0 bg-background/95 backdrop-blur z-20 pb-2 border-b">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
            {editingBill ? `Edit Bill ${editingBill.billNumber}` : 'Create New Bill'}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onBack}>Cancel</Button>
          <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {saving ? 'Saving...' : (editingBill ? 'Update Bill' : 'Create Bill')}
          </Button>
        </div>
      </div>

      {/* Bill meta row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Bill Type</Label>
          <Select value={billType} onValueChange={setBillType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {BILL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <Label className="text-xs">Due Date (optional)</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Payment Mode</Label>
          <Select value={paymentMode} onValueChange={setPaymentMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="UPI">UPI</SelectItem>
              <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
              <SelectItem value="Cheque">Cheque</SelectItem>
              <SelectItem value="Credit">Credit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Customer search + History — two-column layout on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: customer search + party details + items (spans 2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer Search — BIG and prominent */}
          <CustomerSearchBlock
            selectedCustomerId={customerId}
            selectedCustomerName={toName}
            onSelectCustomer={selectCustomer}
            onClear={() => { setCustomerId(null); setHistory(null) }}
          />

          {/* Bill To */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                Bill To (Party Details)
                {customerId && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs">
                    <UserCheck className="h-3 w-3 mr-1" /> Linked
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Party Name *</Label>
                  <Input value={toName} onChange={(e) => {
                    setToName(e.target.value)
                    // Manual edits break the customer link so we don't
                    // accidentally sync payments to the wrong customer.
                    if (customerId) { setCustomerId(null); setHistory(null) }
                  }} placeholder="Customer / Vendor name" required />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input value={toPhone} onChange={(e) => {
                    setToPhone(e.target.value)
                    if (customerId) { setCustomerId(null); setHistory(null) }
                  }} placeholder="Contact number" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Address</Label>
                <Textarea value={toAddress} onChange={(e) => {
                  setToAddress(e.target.value)
                  if (customerId) { setCustomerId(null); setHistory(null) }
                }} placeholder="Full address" rows={2} />
              </div>
              <div>
                <Label className="text-xs">GST Number</Label>
                <Input value={toGst} onChange={(e) => {
                  setToGst(e.target.value)
                  if (customerId) { setCustomerId(null); setHistory(null) }
                }} placeholder="GSTIN (optional)" />
              </div>
              {customerId && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <UserCheck className="h-3 w-3" />
                  Linked to customer record — paid amount will auto-sync to Payments module.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Items</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-3 w-3 mr-1" /> Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground px-2">
                <div className="col-span-4">Description</div>
                <div className="col-span-2">HSN</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-2">Rate</div>
                <div className="col-span-1">Amount</div>
                <div className="col-span-1"></div>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                  <Input
                    list="product-list"
                    className="col-span-12 md:col-span-4"
                    placeholder="Item description"
                    value={item.description}
                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                  />
                  <datalist id="product-list">
                    {PRODUCT_PRESETS.map((p) => <option key={p} value={p} />)}
                  </datalist>
                  <Input
                    className="col-span-4 md:col-span-2"
                    placeholder="HSN"
                    value={item.hsn}
                    onChange={(e) => updateItem(idx, 'hsn', e.target.value)}
                  />
                  <Input
                    type="number"
                    className="col-span-3 md:col-span-2"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                  />
                  <Input
                    type="number"
                    className="col-span-3 md:col-span-2"
                    placeholder="Rate"
                    value={item.rate}
                    onChange={(e) => updateItem(idx, 'rate', e.target.value)}
                  />
                  <div className="col-span-2 md:col-span-1 flex items-center h-9 text-sm font-medium">
                    ₹{(item.amount || 0).toLocaleString('en-IN')}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="col-span-1 h-9 w-9 text-destructive"
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-2">
                Tip: pick a customer above, then go to the &quot;Orders&quot; tab on the right and click &quot;Add to Bill&quot; to auto-fill items from the order. Or use the &quot;Production&quot; tab to add manufactured quantities.
              </p>
            </CardContent>
          </Card>

          {/* Tax & Discount + Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Tax & Discount</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Discount %</Label>
                    <Input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-xs">CGST %</Label>
                    <Input type="number" value={cgstPercent} onChange={(e) => setCgstPercent(Number(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-xs">SGST %</Label>
                    <Input type="number" value={sgstPercent} onChange={(e) => setSgstPercent(Number(e.target.value) || 0)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">IGST % (for inter-state)</Label>
                  <Input type="number" value={igstPercent} onChange={(e) => setIgstPercent(Number(e.target.value) || 0)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Summary</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Sub Total</span><span>₹{subTotal.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-red-600">-₹{discountAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Taxable Amount</span><span>₹{taxableAmount.toLocaleString('en-IN')}</span></div>
                {cgstPercent > 0 && <div className="flex justify-between"><span className="text-muted-foreground">CGST ({cgstPercent}%)</span><span>₹{cgstAmount.toFixed(2)}</span></div>}
                {sgstPercent > 0 && <div className="flex justify-between"><span className="text-muted-foreground">SGST ({sgstPercent}%)</span><span>₹{sgstAmount.toFixed(2)}</span></div>}
                {igstPercent > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IGST ({igstPercent}%)</span><span>₹{igstAmount.toFixed(2)}</span></div>}
                {Math.abs(roundOff) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Round Off</span><span>₹{roundOff.toFixed(2)}</span></div>}
                <div className="border-t pt-2 flex justify-between font-bold text-base"><span>Grand Total</span><span className="text-emerald-600 dark:text-emerald-400">₹{grandTotal.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paid Amount</span><span>₹{paidAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between font-medium"><span>Balance Due</span><span className={balanceAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}>₹{balanceAmount.toLocaleString('en-IN')}</span></div>
              </CardContent>
            </Card>
          </div>

          {/* Payment & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Paid Amount (₹)</Label>
              <Input type="number" value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value) || 0)} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes (optional)" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Terms & Conditions</Label>
            <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Terms and conditions" rows={2} />
          </div>
        </div>

        {/* RIGHT: Customer history sidebar (1 col on desktop, full width on mobile) */}
        <div className="lg:col-span-1">
          <CustomerHistoryPanel
            customerId={customerId}
            history={history}
            loading={historyLoading}
            error={historyError}
            activeTab={activeHistoryTab}
            onTabChange={setActiveHistoryTab}
            onAddProduction={addProductionToBill}
            onAddAllProduction={addAllProductionToBill}
            onAddOrder={addOrderToBill}
          />
        </div>
      </div>
    </form>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// CUSTOMER SEARCH BLOCK — large, prominent search at top of Create Bill page
// ════════════════════════════════════════════════════════════════════════════
function CustomerSearchBlock({
  selectedCustomerId,
  selectedCustomerName,
  onSelectCustomer,
  onClear,
}: {
  selectedCustomerId: string | null
  selectedCustomerName: string
  onSelectCustomer: (c: CustomerSearchResult) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Debounced search — fires 350ms after the user stops typing
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const data = await api.getCustomers(query.trim())
        const list: CustomerSearchResult[] = (data.customers as any[]).map((c) => ({
          id: c.id,
          name: c.name,
          mobile: c.mobile || '',
          address: c.address || '',
          gstNumber: c.gstNumber || '',
        }))
        setResults(list)
        setOpen(list.length > 0)
      } catch {
        setResults([])
        setOpen(false)
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handlePick = (c: CustomerSearchResult) => {
    onSelectCustomer(c)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <Card className="border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Search className="h-4 w-4 text-emerald-600" />
          Search Customer (from Customer Module)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {selectedCustomerId ? (
          <div className="flex items-center justify-between gap-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-md px-3 py-3">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <UserCheck className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium truncate">{selectedCustomerName}</p>
                <p className="text-xs text-muted-foreground">Linked — history loaded on the right</p>
              </div>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={onClear}>
              <X className="h-3 w-3 mr-1" /> Unlink
            </Button>
          </div>
        ) : (
          <div ref={boxRef} className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Type customer name or mobile number to search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => results.length > 0 && setOpen(true)}
                className="pl-10 h-12 text-base"
                autoFocus
              />
              {loading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                </span>
              )}
            </div>

            {open && (
              <div className="absolute z-50 mt-1 w-full bg-background border rounded-md shadow-lg max-h-96 overflow-auto">
                {results.length > 0 ? (
                  results.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => handlePick(c)}
                      className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-b last:border-0 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[c.mobile, c.address].filter(Boolean).join(' • ') || 'No contact info'}
                          </p>
                        </div>
                        {c.gstNumber && (
                          <Badge variant="outline" className="text-xs shrink-0">GST</Badge>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  !loading && query.trim() && (
                    <div className="px-3 py-3 text-sm text-muted-foreground">
                      No matching customers. You can still enter party details manually below.
                    </div>
                  )
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-2">
              Search fetches live from the Customer module. Selecting a customer auto-fills party details AND loads their orders, production, dispatches, previous bills, and payments — pick anything to import into this bill.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// CUSTOMER HISTORY PANEL — shown when a customer is selected
// Shows tabs: Orders | Production | Dispatches | Bills | Payments
// User can click "Add to Bill" on any production row OR any order row to
// auto-fill items in the bill.
// ════════════════════════════════════════════════════════════════════════════
function CustomerHistoryPanel({
  customerId,
  history,
  loading,
  error,
  activeTab,
  onTabChange,
  onAddProduction,
  onAddAllProduction,
  onAddOrder,
}: {
  customerId: string | null
  history: CustomerBillHistory | null
  loading: boolean
  error: string | null
  activeTab: 'orders' | 'production' | 'dispatches' | 'bills' | 'payments'
  onTabChange: (t: 'orders' | 'production' | 'dispatches' | 'bills' | 'payments') => void
  onAddProduction: (p: ProductionRow) => void
  onAddAllProduction: () => void
  onAddOrder: (o: OrderRow) => void
}) {
  if (!customerId) {
    return (
      <Card className="sticky top-20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Customer History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Select a customer to view their orders, production, dispatches, bills, and payments.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="sticky top-20">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          <span className="ml-2 text-sm text-muted-foreground">Loading history...</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="sticky top-20 border-destructive/30">
        <CardContent className="py-4 text-sm text-destructive">
          Failed to load history: {error}
        </CardContent>
      </Card>
    )
  }

  if (!history) return null

  const { summary, productions, dispatches, bills, orders, payments } = history

  return (
    <Card className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-hidden flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="h-4 w-4 text-emerald-600" />
          {history.customer.name}&apos;s History
        </CardTitle>
        {/* Summary chips */}
        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
          <div className="bg-muted/40 rounded px-2 py-1">
            <span className="text-muted-foreground">Orders:</span>{' '}
            <span className="font-medium">{summary.orderCount}</span>
          </div>
          <div className="bg-muted/40 rounded px-2 py-1">
            <span className="text-muted-foreground">Productions:</span>{' '}
            <span className="font-medium">{summary.productionCount}</span>
          </div>
          <div className="bg-muted/40 rounded px-2 py-1">
            <span className="text-muted-foreground">Prev. Bills:</span>{' '}
            <span className="font-medium">{summary.billCount}</span>
          </div>
          <div className="bg-muted/40 rounded px-2 py-1">
            <span className="text-muted-foreground">Outstanding:</span>{' '}
            <span className="font-medium text-amber-600">₹{summary.outstanding.toLocaleString('en-IN')}</span>
          </div>
          <div className="bg-muted/40 rounded px-2 py-1 col-span-2">
            <span className="text-muted-foreground">Total Payments Received:</span>{' '}
            <span className="font-medium text-emerald-600">₹{Number(summary.totalPaymentsReceived || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </CardHeader>

      {/* Tabs */}
      <div className="flex border-b shrink-0 overflow-x-auto">
        {[
          { key: 'orders' as const, label: 'Orders', icon: ClipboardList, count: summary.orderCount },
          { key: 'production' as const, label: 'Production', icon: Package, count: summary.productionCount },
          { key: 'dispatches' as const, label: 'Dispatches', icon: Truck, count: summary.dispatchCount },
          { key: 'bills' as const, label: 'Bills', icon: FileSpreadsheet, count: summary.billCount },
          { key: 'payments' as const, label: 'Payments', icon: IndianRupee, count: summary.paymentCount },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`flex-1 min-w-[60px] px-2 py-2 text-xs font-medium flex items-center justify-center gap-1 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-3 w-3" />
            {tab.label}
            <span className="ml-1 text-[10px] bg-muted-foreground/20 rounded-full px-1.5 py-0.5">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {activeTab === 'orders' && (
          orders.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No orders for this customer. Create an order first, then come back to bill it.
            </p>
          ) : (
            orders.map((o) => {
              const itemCount = (o.items?.length || 0)
              const totalQty = o.items?.reduce((s, it) => s + (Number(it.quantity) || 0), 0) ?? Number(o.quantity || 0)
              const totalAmt = o.items?.reduce((s, it) => s + (Number(it.amount) || 0), 0) ?? Number(o.amount || 0)
              return (
                <div key={o.id} className="border rounded p-2 text-xs hover:border-emerald-300">
                  <div className="flex items-center justify-between mb-1">
                    <div className="min-w-0">
                      <span className="font-medium">{o.orderNumber}</span>
                      <span className="text-muted-foreground ml-1">• {o.deliveryDate}</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => onAddOrder(o)}
                    >
                      <Plus className="h-3 w-3 mr-0.5" /> Add to Bill
                    </Button>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-[10px]">{o.status || 'Pending'}</Badge>
                    {o.brickType && !itemCount && (
                      <Badge variant="outline" className="text-[10px]">{o.brickType}</Badge>
                    )}
                  </div>
                  {itemCount > 0 ? (
                    <div className="space-y-0.5">
                      {o.items!.slice(0, 5).map((it, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-muted-foreground truncate pr-1">{it.description}</span>
                          <span className="font-medium whitespace-nowrap">
                            {it.quantity} {it.unit || 'pcs'} × ₹{Number(it.rate || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                      {itemCount > 5 && (
                        <p className="text-[10px] text-muted-foreground italic">+ {itemCount - 5} more items</p>
                      )}
                      <div className="flex justify-between pt-1 mt-1 border-t">
                        <span className="text-muted-foreground">Total ({itemCount} items, {totalQty} qty)</span>
                        <span className="font-medium text-emerald-700 dark:text-emerald-400">₹{totalAmt.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ) : o.brickType ? (
                    <div className="space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{o.brickType}</span>
                        <span className="font-medium">{o.quantity} qty × ₹{Number(o.rate || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between pt-1 mt-1 border-t">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-medium text-emerald-700 dark:text-emerald-400">₹{totalAmt.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No items</p>
                  )}
                </div>
              )
            })
          )
        )}

        {activeTab === 'production' && (
          <>
            {productions.length > 0 && (
              <Button
                type="button"
                size="sm"
                className="w-full bg-emerald-600 hover:bg-emerald-700 mb-2"
                onClick={onAddAllProduction}
              >
                <ShoppingCart className="h-3 w-3 mr-1" />
                Add ALL Production to Bill ({summary.productionCount} records)
              </Button>
            )}
            {productions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No production records for this customer.
              </p>
            ) : (
              productions.map((p) => {
                const products = Object.entries(PROD_FIELD_TO_LABEL)
                  .map(([k, label]) => ({ label, qty: Number((p as any)[k]) || 0 }))
                  .filter((x) => x.qty > 0)
                return (
                  <div key={p.id} className="border rounded p-2 text-xs hover:border-emerald-300">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{p.date}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => onAddProduction(p)}
                      >
                        <Plus className="h-3 w-3 mr-0.5" /> Add
                      </Button>
                    </div>
                    {products.length > 0 ? (
                      <div className="space-y-0.5">
                        {products.map((pr) => (
                          <div key={pr.label} className="flex justify-between">
                            <span className="text-muted-foreground">{pr.label}</span>
                            <span className="font-medium">{pr.qty}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No billable products</p>
                    )}
                    {Number(p.transportationCharge) > 0 && (
                      <div className="flex justify-between mt-1 pt-1 border-t">
                        <span className="text-muted-foreground">Transport</span>
                        <span className="font-medium">₹{Number(p.transportationCharge).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {p.remarks && (
                      <p className="text-[10px] text-muted-foreground italic mt-1">{p.remarks}</p>
                    )}
                  </div>
                )
              })
            )}
          </>
        )}

        {activeTab === 'dispatches' && (
          dispatches.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No dispatch records for this customer.
            </p>
          ) : (
            (dispatches as any[]).map((d) => (
              <div key={d.id} className="border rounded p-2 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{d.date}</span>
                  <Badge variant="outline" className="text-[10px]">{d.dispatchNumber}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{d.brickType}</span>
                  <span className="font-medium">{d.quantity} qty</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Truck: {d.truckNumber || '-'}</span>
                </div>
              </div>
            ))
          )
        )}

        {activeTab === 'bills' && (
          bills.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No previous bills for this customer.
            </p>
          ) : (
            (bills as any[]).map((b) => (
              <div key={b.id} className="border rounded p-2 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{b.billNumber}</span>
                  <Badge variant="outline" className="text-[10px]">{b.status}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{b.date}</span>
                  <span className="font-medium">₹{Number(b.grandTotal || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Paid: ₹{Number(b.paidAmount || 0).toLocaleString('en-IN')}</span>
                  <span>Bal: ₹{Number(b.balanceAmount || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))
          )
        )}

        {activeTab === 'payments' && (
          payments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No payment records for this customer.
            </p>
          ) : (
            <>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded p-2 mb-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Received:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    ₹{Number(summary.totalPaymentsReceived || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
              {payments.map((p) => (
                <div key={p.id} className="border rounded p-2 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{p.date}</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">{p.paymentType}</Badge>
                    {p.billNumber && (
                      <Badge variant="outline" className="text-[10px] text-emerald-700">{p.billNumber}</Badge>
                    )}
                  </div>
                  {p.remarks && (
                    <p className="text-[10px] text-muted-foreground italic mt-1">{p.remarks}</p>
                  )}
                </div>
              ))}
            </>
          )
        )}
      </div>
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PRINT BILL COMPONENT
// ════════════════════════════════════════════════════════════════════════════
function PrintBill({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  useEffect(() => {
    setTimeout(() => window.print(), 300)
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Print</Button>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>

      <div className="bg-white text-black p-8 shadow-lg print:shadow-none print:p-0 max-w-4xl mx-auto" id="print-area">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-emerald-600 pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-emerald-700">{bill.fromName || 'Veda Enterprises'}</h1>
            {bill.fromAddress && <p className="text-sm text-gray-600 mt-1 max-w-md">{bill.fromAddress}</p>}
            {bill.fromGst && <p className="text-sm text-gray-600">GST: {bill.fromGst}</p>}
            {bill.fromPhone && <p className="text-sm text-gray-600">Phone: {bill.fromPhone}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold uppercase text-emerald-700">
              {BILL_TYPES.find((t) => t.value === bill.billType)?.label || 'Invoice'}
            </h2>
            <p className="text-sm font-medium mt-1">{bill.billNumber}</p>
            <p className="text-sm text-gray-600">Date: {bill.date}</p>
            {bill.dueDate && <p className="text-sm text-gray-600">Due: {bill.dueDate}</p>}
          </div>
        </div>

        {/* Bill To */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs font-bold uppercase text-gray-500 mb-1">Bill To</p>
            <p className="font-bold text-lg">{bill.toName}</p>
            {bill.toAddress && <p className="text-sm text-gray-600 whitespace-pre-line">{bill.toAddress}</p>}
            {bill.toPhone && <p className="text-sm text-gray-600">Phone: {bill.toPhone}</p>}
            {bill.toGst && <p className="text-sm text-gray-600">GST: {bill.toGst}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase text-gray-500 mb-1">Payment Status</p>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${STATUS_COLORS[bill.status]}`}>
              {bill.status}
            </span>
            <p className="text-sm text-gray-600 mt-2">Payment Mode: {bill.paymentMode}</p>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full border-collapse mb-6">
          <thead>
            <tr className="bg-emerald-600 text-white">
              <th className="text-left p-2 text-sm">#</th>
              <th className="text-left p-2 text-sm">Description</th>
              <th className="text-center p-2 text-sm">HSN</th>
              <th className="text-right p-2 text-sm">Qty</th>
              <th className="text-right p-2 text-sm">Rate</th>
              <th className="text-right p-2 text-sm">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="p-2 text-sm">{idx + 1}</td>
                <td className="p-2 text-sm">{item.description}</td>
                <td className="p-2 text-sm text-center">{item.hsn || '-'}</td>
                <td className="p-2 text-sm text-right">{item.quantity} {item.unit}</td>
                <td className="p-2 text-sm text-right">₹{item.rate.toLocaleString('en-IN')}</td>
                <td className="p-2 text-sm text-right font-medium">₹{item.amount.toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Sub Total:</span><span>₹{bill.subTotal.toLocaleString('en-IN')}</span></div>
            {bill.discountAmount > 0 && <div className="flex justify-between"><span className="text-gray-600">Discount ({bill.discountPercent}%):</span><span>-₹{bill.discountAmount.toFixed(2)}</span></div>}
            {bill.cgstAmount > 0 && <div className="flex justify-between"><span className="text-gray-600">CGST ({bill.cgstPercent}%):</span><span>₹{bill.cgstAmount.toFixed(2)}</span></div>}
            {bill.sgstAmount > 0 && <div className="flex justify-between"><span className="text-gray-600">SGST ({bill.sgstPercent}%):</span><span>₹{bill.sgstAmount.toFixed(2)}</span></div>}
            {bill.igstAmount > 0 && <div className="flex justify-between"><span className="text-gray-600">IGST ({bill.igstPercent}%):</span><span>₹{bill.igstAmount.toFixed(2)}</span></div>}
            {Math.abs(bill.roundOff) > 0 && <div className="flex justify-between"><span className="text-gray-600">Round Off:</span><span>₹{bill.roundOff.toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-lg border-t-2 border-emerald-600 pt-2">
              <span>Grand Total:</span><span className="text-emerald-700">₹{bill.grandTotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between"><span className="text-gray-600">Paid:</span><span className="text-emerald-600">₹{bill.paidAmount.toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between font-bold"><span>Balance Due:</span><span className="text-amber-600">₹{bill.balanceAmount.toLocaleString('en-IN')}</span></div>
          </div>
        </div>

        {/* Notes & Terms */}
        {(bill.notes || bill.terms) && (
          <div className="mt-8 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4 text-xs">
            {bill.notes && (
              <div>
                <p className="font-bold uppercase text-gray-500 mb-1">Notes</p>
                <p className="text-gray-600">{bill.notes}</p>
              </div>
            )}
            {bill.terms && (
              <div>
                <p className="font-bold uppercase text-gray-500 mb-1">Terms & Conditions</p>
                <p className="text-gray-600 whitespace-pre-line">{bill.terms}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200 flex justify-between items-end">
          <div className="text-xs text-gray-500">
            <p>This is a computer-generated document.</p>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 w-48 mt-12 pt-1">
              <p className="text-sm font-medium">Authorized Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
