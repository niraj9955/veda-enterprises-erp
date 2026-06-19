'use client'

import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { Plus, Trash2, Edit, Printer, FileText, IndianRupee, Search, UserCheck, X } from 'lucide-react'

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

const PRODUCT_PRESETS = [
  'Zig Zag White 80mm',
  'Zig Zag Red 80mm',
  'Zig Zag Yellow 80mm',
  'Zig Zag White 60mm',
  'Zig Zag Red 60mm',
  'Zig Zag Yellow 60mm',
  'Curve Stone',
  'Chequre Tile',
  'Dumble Grey 80mm',
  'Dumble Red 80mm',
  'Dumble Yellow 80mm',
  'Cement',
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

export default function BillModule() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
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

  if (printBill) {
    return <PrintBill bill={printBill} onClose={() => setPrintBill(null)} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">Billing System</h1>
          <p className="text-sm text-muted-foreground">Generate invoices, quotations, and bills for any transaction</p>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setEditingBill(null)}>
              <Plus className="h-4 w-4 mr-2" /> Create New Bill
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingBill ? 'Edit Bill' : 'Create New Bill'}</DialogTitle>
            </DialogHeader>
            <BillForm
              bill={editingBill}
              onSave={async () => {
                setShowForm(false)
                setEditingBill(null)
                await loadBills()
              }}
              onCancel={() => {
                setShowForm(false)
                setEditingBill(null)
              }}
            />
          </DialogContent>
        </Dialog>
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
                        <Button size="icon" variant="ghost" onClick={() => { setEditingBill(bill); setShowForm(true) }} title="Edit">
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

// ─── Bill Form Component ──────────────────────────────────────────────────────
function BillForm({ bill, onSave, onCancel }: { bill: Bill | null; onSave: () => void; onCancel: () => void }) {
  const [billType, setBillType] = useState(bill?.billType || 'sales')
  const [date, setDate] = useState(bill?.date || new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(bill?.dueDate || '')
  // Customer link — when set, the bill's paidAmount auto-syncs to a Payment
  // document for this customer. May be null (manual party entry).
  const [customerId, setCustomerId] = useState<string | null>(bill?.customerId || null)
  const [toName, setToName] = useState(bill?.toName || '')
  const [toAddress, setToAddress] = useState(bill?.toAddress || '')
  const [toGst, setToGst] = useState(bill?.toGst || '')
  const [toPhone, setToPhone] = useState(bill?.toPhone || '')
  const [items, setItems] = useState<BillItem[]>(
    bill?.items?.length ? bill.items : [{ description: '', hsn: '', quantity: 1, unit: 'pcs', rate: 0, amount: 0 }]
  )
  const [discountPercent, setDiscountPercent] = useState(bill?.discountPercent || 0)
  const [cgstPercent, setCgstPercent] = useState(bill?.cgstPercent || 0)
  const [sgstPercent, setSgstPercent] = useState(bill?.sgstPercent || 0)
  const [igstPercent, setIgstPercent] = useState(bill?.igstPercent || 0)
  const [paidAmount, setPaidAmount] = useState(bill?.paidAmount || 0)
  const [paymentMode, setPaymentMode] = useState(bill?.paymentMode || 'Cash')
  const [notes, setNotes] = useState(bill?.notes || '')
  const [terms, setTerms] = useState(bill?.terms || '')
  const [saving, setSaving] = useState(false)

  // Recalculate item amount when qty/rate changes
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

  // Calculations
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
      if (bill) {
        await api.updateBill(bill.id, payload)
        toast({ title: 'Updated', description: 'Bill updated successfully' })
      } else {
        await api.createBill(payload)
        toast({ title: 'Created', description: 'Bill created successfully' })
      }
      onSave()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save bill', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Bill Type & Date */}
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

      {/* Customer search & auto-fill */}
      <CustomerSearchCard
        selectedCustomerId={customerId}
        onSelectCustomer={(c) => {
          setCustomerId(c.id)
          setToName(c.name)
          setToPhone(c.mobile || '')
          setToAddress(c.address || '')
          setToGst(c.gstNumber || '')
        }}
        onClear={() => setCustomerId(null)}
      />

      {/* Bill To */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Bill To (Party Details)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Party Name *</Label>
              <Input value={toName} onChange={(e) => {
                setToName(e.target.value)
                // Manual edits break the customer link so we don't accidentally
                // sync payments to the wrong customer.
                if (customerId) setCustomerId(null)
              }} placeholder="Customer / Vendor name" required />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input value={toPhone} onChange={(e) => {
                setToPhone(e.target.value)
                if (customerId) setCustomerId(null)
              }} placeholder="Contact number" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Address</Label>
            <Textarea value={toAddress} onChange={(e) => {
              setToAddress(e.target.value)
              if (customerId) setCustomerId(null)
            }} placeholder="Full address" rows={2} />
          </div>
          <div>
            <Label className="text-xs">GST Number</Label>
            <Input value={toGst} onChange={(e) => {
              setToGst(e.target.value)
              if (customerId) setCustomerId(null)
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
        </CardContent>
      </Card>

      {/* Tax & Discount */}
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

      {/* Action buttons */}
      <div className="flex gap-2 justify-end pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
          {saving ? 'Saving...' : (bill ? 'Update Bill' : 'Create Bill')}
        </Button>
      </div>
    </form>
  )
}

// ─── Print Bill Component ─────────────────────────────────────────────────────
function PrintBill({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  useEffect(() => {
    // Auto-trigger print dialog on mount
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

// ─── Customer Search Card ─────────────────────────────────────────────────────
// Live-searches /api/customers by name / mobile / address and lets the user
// pick a customer to auto-fill the Bill To fields. The selected customer's
// id is propagated up so the Bill can be linked and the paid amount can
// auto-sync to the Payments module.
interface CustomerSearchResult {
  id: string
  name: string
  mobile?: string
  address?: string
  gstNumber?: string
}

function CustomerSearchCard({
  selectedCustomerId,
  onSelectCustomer,
  onClear,
}: {
  selectedCustomerId: string | null
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
        // Map raw customer records to the search-result shape
        const list = (data.customers as CustomerSearchResult[]).map((c: any) => ({
          id: c.id,
          name: c.name,
          mobile: c.mobile || '',
          address: c.address || '',
          gstNumber: c.gstNumber || '',
        }))
        setResults(list)
        setOpen(true)
      } catch {
        setResults([])
        setOpen(false)
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [query])

  // Close the dropdown on outside click
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

  const handleClear = () => {
    onClear()
    setQuery('')
    setResults([])
  }

  return (
    <Card className="border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Search className="h-4 w-4 text-emerald-600" />
          Search Customer (auto-fill party details)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {selectedCustomerId ? (
          <div className="flex items-center justify-between gap-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-md px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <UserCheck className="h-4 w-4 text-emerald-600" />
              <span className="font-medium">Customer linked</span>
              <Badge variant="outline" className="text-xs">{selectedCustomerId.slice(-6)}</Badge>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={handleClear}>
              <X className="h-3 w-3 mr-1" /> Unlink
            </Button>
          </div>
        ) : (
          <div ref={boxRef} className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Type customer name, mobile, or address to search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => results.length > 0 && setOpen(true)}
                className="pl-9"
              />
              {loading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Searching...</span>
              )}
            </div>
            {open && results.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-background border rounded-md shadow-lg max-h-72 overflow-auto">
                {results.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => handlePick(c)}
                    className="w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-b last:border-0 transition-colors"
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
                ))}
              </div>
            )}
            {open && results.length === 0 && !loading && query.trim() && (
              <div className="absolute z-50 mt-1 w-full bg-background border rounded-md shadow-lg px-3 py-3 text-sm text-muted-foreground">
                No matching customers found. You can still enter party details manually below.
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Tip: linking a customer lets the bill's paid amount auto-sync to the Payments module — no manual payment entry needed.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
