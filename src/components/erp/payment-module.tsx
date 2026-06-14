'use client'

import * as React from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Wallet,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  IndianRupee,
  Banknote,
  Smartphone,
  Landmark,
  Users,
  Upload,
} from 'lucide-react'
import ExcelImport from '@/components/erp/excel-import'

// ── Types ───────────────────────────────────────────────────────────────────

interface Customer {
  id: string
  name: string
}

interface Payment {
  id: string
  customerId: string
  paymentType: string
  amount: number
  date: string
  remarks: string
  createdAt: string
  customer: { id: string; name: string }
}

interface Order {
  id: string
  customerId: string
  amount: number
  status: string
  createdAt: string
  customer: { id: string; name: string }
}

interface PaymentFormData {
  customerId: string
  paymentType: string
  amount: number | string
  date: string
  remarks: string
}

interface OutstandingEntry {
  customerId: string
  customerName: string
  totalOrderAmount: number
  totalPayments: number
  outstanding: number
}

// ── Constants ───────────────────────────────────────────────────────────────

const PAYMENT_TYPES = ['Cash', 'UPI', 'Bank Transfer'] as const

const PAYMENT_TYPE_COLORS: Record<string, string> = {
  Cash: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  UPI: 'bg-sky-100 text-sky-700 border-sky-200',
  'Bank Transfer': 'bg-amber-100 text-amber-700 border-amber-200',
}

const PAYMENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  Cash: <Banknote className="size-3" />,
  UPI: <Smartphone className="size-3" />,
  'Bank Transfer': <Landmark className="size-3" />,
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

const formatDate = (dateStr: string): string =>
  new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

const emptyForm: PaymentFormData = {
  customerId: '',
  paymentType: '',
  amount: '',
  date: '',
  remarks: '',
}

// ── Component ───────────────────────────────────────────────────────────────

export function PaymentModule() {
  // State
  const [payments, setPayments] = React.useState<Payment[]>([])
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [orders, setOrders] = React.useState<Order[]>([])
  const [loading, setLoading] = React.useState(true)

  // Dialog states
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingPayment, setEditingPayment] = React.useState<Payment | null>(null)
  const [formData, setFormData] = React.useState<PaymentFormData>(emptyForm)
  const [formSubmitting, setFormSubmitting] = React.useState(false)

  // Excel import
  const [importOpen, setImportOpen] = React.useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = React.useState<Payment | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  // ── Computed: Summary values ─────────────────────────────────────────────
  const totalReceived = React.useMemo(
    () => payments.reduce((sum, p) => sum + Number(p.amount), 0),
    [payments]
  )

  const cashPayments = React.useMemo(
    () =>
      payments
        .filter((p) => p.paymentType === 'Cash')
        .reduce((sum, p) => sum + Number(p.amount), 0),
    [payments]
  )

  const upiBankPayments = React.useMemo(
    () =>
      payments
        .filter((p) => p.paymentType === 'UPI' || p.paymentType === 'Bank Transfer')
        .reduce((sum, p) => sum + Number(p.amount), 0),
    [payments]
  )

  // ── Computed: Customer outstanding ───────────────────────────────────────
  const outstandingEntries = React.useMemo<OutstandingEntry[]>(() => {
    const map = new Map<string, OutstandingEntry>()

    // Sum order amounts per customer (exclude Cancelled)
    for (const order of orders) {
      if (order.status === 'Cancelled') continue
      const existing = map.get(order.customerId)
      if (existing) {
        existing.totalOrderAmount += Number(order.amount)
      } else {
        map.set(order.customerId, {
          customerId: order.customerId,
          customerName: order.customer?.name || 'Unknown',
          totalOrderAmount: Number(order.amount),
          totalPayments: 0,
          outstanding: 0,
        })
      }
    }

    // Sum payments per customer
    for (const payment of payments) {
      const existing = map.get(payment.customerId)
      if (existing) {
        existing.totalPayments += Number(payment.amount)
      } else {
        map.set(payment.customerId, {
          customerId: payment.customerId,
          customerName: payment.customer?.name || 'Unknown',
          totalOrderAmount: 0,
          totalPayments: Number(payment.amount),
          outstanding: 0,
        })
      }
    }

    // Calculate outstanding
    for (const entry of map.values()) {
      entry.outstanding = entry.totalOrderAmount - entry.totalPayments
    }

    // Return only customers with outstanding > 0, sorted by outstanding descending
    return Array.from(map.values())
      .filter((e) => e.outstanding > 0.01)
      .sort((a, b) => b.outstanding - a.outstanding)
  }, [orders, payments])

  // ── Fetch data ───────────────────────────────────────────────────────────
  const fetchPayments = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getPayments()
      const paymentList = (res.payments as Payment[]).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      setPayments(paymentList)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to fetch payments',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCustomers = React.useCallback(async () => {
    try {
      const res = await api.getCustomers()
      setCustomers(res.customers as Customer[])
    } catch {
      // Silently fail — customer dropdown will just be empty
    }
  }, [])

  const fetchOrders = React.useCallback(async () => {
    try {
      const res = await api.getOrders()
      setOrders(res.orders as Order[])
    } catch {
      // Silently fail — outstanding section will just be empty
    }
  }, [])

  React.useEffect(() => {
    fetchPayments()
    fetchCustomers()
    fetchOrders()
  }, [fetchPayments, fetchCustomers, fetchOrders])

  // ── Form handlers ────────────────────────────────────────────────────────
  const openCreateDialog = () => {
    setEditingPayment(null)
    setFormData(emptyForm)
    setDialogOpen(true)
  }

  const openEditDialog = (payment: Payment) => {
    setEditingPayment(payment)
    setFormData({
      customerId: payment.customerId,
      paymentType: payment.paymentType,
      amount: payment.amount,
      date: payment.date,
      remarks: payment.remarks,
    })
    setDialogOpen(true)
  }

  const handleFormChange = (field: keyof PaymentFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    // Validation
    if (!formData.customerId) {
      toast({ title: 'Validation Error', description: 'Please select a customer', variant: 'destructive' })
      return
    }
    if (!formData.paymentType) {
      toast({ title: 'Validation Error', description: 'Please select a payment type', variant: 'destructive' })
      return
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      toast({ title: 'Validation Error', description: 'Amount must be greater than 0', variant: 'destructive' })
      return
    }
    if (!formData.date) {
      toast({ title: 'Validation Error', description: 'Date is required', variant: 'destructive' })
      return
    }

    setFormSubmitting(true)
    try {
      const payload = {
        customerId: formData.customerId,
        paymentType: formData.paymentType,
        amount: Number(formData.amount),
        date: formData.date,
        remarks: formData.remarks,
      }

      if (editingPayment) {
        await api.updatePayment(editingPayment.id, payload)
        toast({ title: 'Success', description: 'Payment updated successfully' })
      } else {
        await api.createPayment(payload)
        toast({ title: 'Success', description: 'Payment recorded successfully' })
      }

      setDialogOpen(false)
      setEditingPayment(null)
      setFormData(emptyForm)
      fetchPayments()
      fetchOrders() // Refresh for outstanding calculations
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : `Failed to ${editingPayment ? 'update' : 'record'} payment`,
        variant: 'destructive',
      })
    } finally {
      setFormSubmitting(false)
    }
  }

  // ── Delete handler ──────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deletePayment(deleteTarget.id)
      toast({ title: 'Success', description: 'Payment deleted successfully' })
      setDeleteTarget(null)
      fetchPayments()
      fetchOrders()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete payment',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  // ── Render: Loading skeletons ───────────────────────────────────────────
  const renderSkeletons = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-8 w-20" /></TableCell>
      </TableRow>
    ))

  // ── Render: Payment type badge ──────────────────────────────────────────
  const renderPaymentTypeBadge = (type: string) => (
    <Badge className={`${PAYMENT_TYPE_COLORS[type] || 'bg-gray-100 text-gray-700 border-gray-200'} gap-1`}>
      {PAYMENT_TYPE_ICONS[type]}
      {type}
    </Badge>
  )

  // ── Render: Payment dialog ──────────────────────────────────────────────
  const renderPaymentDialog = () => (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingPayment ? 'Edit Payment' : 'Receive Payment'}
          </DialogTitle>
          <DialogDescription>
            {editingPayment
              ? 'Update the payment details below.'
              : 'Fill in the details to record a new payment.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Customer */}
          <div className="grid gap-2">
            <Label htmlFor="payment-customer">
              Customer <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.customerId}
              onValueChange={(val) => handleFormChange('customerId', val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Type */}
          <div className="grid gap-2">
            <Label htmlFor="payment-type">
              Payment Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.paymentType}
              onValueChange={(val) => handleFormChange('paymentType', val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select payment type" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="grid gap-2">
            <Label htmlFor="payment-amount">
              Amount (₹) <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="payment-amount"
                type="number"
                placeholder="0"
                min="1"
                className="pl-9"
                value={formData.amount}
                onChange={(e) => handleFormChange('amount', e.target.value)}
              />
            </div>
          </div>

          {/* Date */}
          <div className="grid gap-2">
            <Label htmlFor="payment-date">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="payment-date"
              type="date"
              value={formData.date}
              onChange={(e) => handleFormChange('date', e.target.value)}
            />
          </div>

          {/* Remarks */}
          <div className="grid gap-2">
            <Label htmlFor="payment-remarks">Remarks</Label>
            <Textarea
              id="payment-remarks"
              placeholder="Optional remarks about this payment..."
              value={formData.remarks}
              onChange={(e) => handleFormChange('remarks', e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setDialogOpen(false)}
            disabled={formSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={formSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {formSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {editingPayment ? 'Update Payment' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // ── Render: Delete confirmation ─────────────────────────────────────────
  const renderDeleteDialog = () => (
    <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Payment</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this payment of{' '}
            <strong>{deleteTarget ? formatCurrency(Number(deleteTarget.amount)) : ''}</strong>{' '}
            from <strong>{deleteTarget?.customer?.name || 'this customer'}</strong>? This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  // ── Render: Main ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <Wallet className="size-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Payment Management</h2>
            <p className="text-sm text-muted-foreground">
              Track and manage customer payments
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="w-full sm:w-auto"
          >
            <Upload className="size-4 mr-2" />
            Import Excel
          </Button>
          <Button
            onClick={openCreateDialog}
            className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
          >
            <Plus className="size-4" />
            Receive Payment
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Received
            </CardTitle>
            <IndianRupee className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold">{formatCurrency(totalReceived)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cash Payments
            </CardTitle>
            <Banknote className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold">{formatCurrency(cashPayments)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              UPI + Bank
            </CardTitle>
            <Landmark className="size-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold">{formatCurrency(upiBankPayments)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Payments</span>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
              {payments.length} record{payments.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Payment Type</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  renderSkeletons()
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No payments yet. Click &quot;Receive Payment&quot; to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {payment.customer?.name || '—'}
                      </TableCell>
                      <TableCell>{renderPaymentTypeBadge(payment.paymentType)}</TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatCurrency(Number(payment.amount))}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(payment.date)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {payment.remarks || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(payment)}
                            title="Edit Payment"
                            className="text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(payment)}
                            title="Delete Payment"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-4" />
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

      {/* Customer Outstanding Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            <span>Customer Outstanding Balances</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : outstandingEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Users className="size-10 mb-2 opacity-40" />
              <p className="text-sm">No outstanding balances. All customers are paid up!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total Orders (₹)</TableHead>
                    <TableHead className="text-right">Total Paid (₹)</TableHead>
                    <TableHead className="text-right">Outstanding (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outstandingEntries.map((entry) => (
                    <TableRow key={entry.customerId}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {entry.customerName}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatCurrency(entry.totalOrderAmount)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatCurrency(entry.totalPayments)}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        <span className="text-rose-600">{formatCurrency(entry.outstanding)}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {renderPaymentDialog()}
      {renderDeleteDialog()}

      <ExcelImport module="payments" open={importOpen} onClose={() => setImportOpen(false)} onSuccess={fetchPayments} />
    </div>
  )
}

export default PaymentModule
