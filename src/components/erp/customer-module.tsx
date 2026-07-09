'use client'

import * as React from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollableTable } from '@/components/ui/scrollable-table'
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
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  BookOpen,
  Loader2,
  IndianRupee,
  Upload,
} from 'lucide-react'
import ExcelImport from '@/components/erp/excel-import'
import { CustomerHistoryPage } from '@/components/erp/customer-history-page'
import { AiFillButton } from '@/components/ui/ai-fill-button'
import { FieldVoiceInput } from '@/components/ui/field-voice-input'
import { consumePendingAiResult } from '@/components/ui/ai-chat-widget'
import { isFormEmpty, showPleaseFillDataToast } from '@/lib/form-validation'

// ── Types ───────────────────────────────────────────────────────────────────

interface Customer {
  id: string
  name: string
  mobile: string
  gstNumber: string
  address: string
  creditLimit: number
  createdAt: string
  updatedAt: string
}

interface Payment {
  id: string
  customerId: string
  paymentType: string
  amount: number
  date: string
  remarks: string
  customer: { name: string }
}

interface CustomerFormData {
  name: string
  mobile: string
  gstNumber: string
  address: string
  creditLimit: number | string
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

const emptyForm: CustomerFormData = {
  name: '',
  mobile: '',
  gstNumber: '',
  address: '',
  creditLimit: '',
}

// ── Component ───────────────────────────────────────────────────────────────

export function CustomerModule() {
  // State
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [totalCount, setTotalCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')

  // Dialog states
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingCustomer, setEditingCustomer] = React.useState<Customer | null>(null)
  const [formData, setFormData] = React.useState<CustomerFormData>(emptyForm)
  const [formSubmitting, setFormSubmitting] = React.useState(false)

  // Excel import
  const [importOpen, setImportOpen] = React.useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = React.useState<Customer | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  // Ledger
  const [ledgerCustomer, setLedgerCustomer] = React.useState<Customer | null>(null)
  const [ledgerPayments, setLedgerPayments] = React.useState<Payment[]>([])
  const [ledgerLoading, setLedgerLoading] = React.useState(false)

  // Full customer history PAGE (full-screen, not modal)
  const [historyCustomerId, setHistoryCustomerId] = React.useState<string | null>(null)

  // ── Debounced search ────────────────────────────────────────────────────
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // ── Fetch customers ─────────────────────────────────────────────────────
  const fetchCustomers = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getCustomers(debouncedSearch || undefined)
      setCustomers(res.customers as Customer[])
      // Track total count separately so the badge can show "X of Y" when
      // pagination is in effect (the API now returns `total` alongside
      // the page slice). If `total` is missing (older deployments), fall
      // back to the slice length.
      const r = res as { total?: number; customers: Customer[] }
      setTotalCount(r.total ?? r.customers.length)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to fetch customers',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  React.useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  // ── Form handlers ───────────────────────────────────────────────────────
  const openAddDialog = () => {
    setEditingCustomer(null)
    const pending = consumePendingAiResult('customer')
    if (pending) {
      const cl = pending.creditLimit
      setFormData({
        name: String(pending.name || ''),
        mobile: String(pending.mobile || pending.contactNumber || ''),
        gstNumber: String(pending.gstNumber || ''),
        address: String(pending.address || ''),
        creditLimit: cl != null && cl !== '' ? String(cl) : '',
      })
      toast({ title: 'AI auto-fill applied', description: 'Edit & verify before saving.' })
    } else {
      setFormData(emptyForm)
    }
    setFormOpen(true)
  }

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      mobile: customer.mobile,
      gstNumber: customer.gstNumber,
      address: customer.address,
      creditLimit: customer.creditLimit,
    })
    setFormOpen(true)
  }

  const handleFormChange = (field: keyof CustomerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    // Unified empty-form check — show ONE popup instead of cascading errors
    if (isFormEmpty([formData.name, formData.mobile, formData.gstNumber, formData.address, formData.creditLimit])) {
      toast(showPleaseFillDataToast())
      return
    }
    if (!formData.name.trim()) {
      toast({ title: 'Validation Error', description: 'Customer name is required', variant: 'destructive' })
      return
    }
    if (!formData.mobile.trim()) {
      toast({ title: 'Validation Error', description: 'Mobile number is required', variant: 'destructive' })
      return
    }

    setFormSubmitting(true)
    try {
      const payload = {
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        gstNumber: formData.gstNumber.trim(),
        address: formData.address.trim(),
        creditLimit: Number(formData.creditLimit) || 0,
      }

      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, payload)
        toast({ title: 'Success', description: 'Customer updated successfully' })
      } else {
        await api.createCustomer(payload)
        toast({ title: 'Success', description: 'Customer created successfully' })
      }

      setFormOpen(false)
      setFormData(emptyForm)
      setEditingCustomer(null)
      fetchCustomers()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save customer',
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
      await api.deleteCustomer(deleteTarget.id)
      toast({ title: 'Success', description: 'Customer deleted successfully' })
      setDeleteTarget(null)
      fetchCustomers()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete customer',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  // ── Ledger handler ──────────────────────────────────────────────────────
  const openLedger = async (customer: Customer) => {
    setLedgerCustomer(customer)
    setLedgerLoading(true)
    try {
      const res = await api.getPayments()
      const allPayments = res.payments as Payment[]
      const filtered = allPayments.filter((p) => p.customerId === customer.id)
      // Sort by date descending
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setLedgerPayments(filtered)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to fetch payment history',
        variant: 'destructive',
      })
      setLedgerPayments([])
    } finally {
      setLedgerLoading(false)
    }
  }

  // ── Render: Loading skeletons ───────────────────────────────────────────
  const renderSkeletons = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-8 w-28" /></TableCell>
      </TableRow>
    ))

  // ── Render: Form dialog ─────────────────────────────────────────────────
  const renderFormDialog = () => (
    <Dialog open={formOpen} onOpenChange={setFormOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingCustomer ? 'Edit Customer' : 'Add Customer'}
          </DialogTitle>
          <DialogDescription>
            {editingCustomer
              ? 'Update the customer details below.'
              : 'Fill in the details to create a new customer.'}
          </DialogDescription>
        </DialogHeader>
        {!editingCustomer && (
          <div className="flex justify-end">
            <AiFillButton
              module="customer"
              onApply={(fields) => setFormData((prev) => ({
                name: fields.name != null ? String(fields.name) : prev.name,
                mobile: fields.mobile != null ? String(fields.mobile) : (fields.contactNumber != null ? String(fields.contactNumber) : prev.mobile),
                gstNumber: fields.gstNumber != null ? String(fields.gstNumber) : prev.gstNumber,
                address: fields.address != null ? String(fields.address) : prev.address,
                creditLimit: fields.creditLimit != null && fields.creditLimit !== '' ? String(fields.creditLimit) : prev.creditLimit,
              }))}
            />
          </div>
        )}

        <div className="grid gap-4 py-2">
          {/* Customer Name */}
          <div className="grid gap-2">
            <Label htmlFor="cust-name">
              Customer Name <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="cust-name"
                placeholder="Enter customer name"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                className="pr-9"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <FieldVoiceInput
                  fieldLabel="customer name"
                  onChange={(text) => handleFormChange('name', text)}
                />
              </div>
            </div>
          </div>

          {/* Mobile Number */}
          <div className="grid gap-2">
            <Label htmlFor="cust-mobile">
              Mobile Number <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="cust-mobile"
                placeholder="Enter mobile number"
                value={formData.mobile}
                onChange={(e) => handleFormChange('mobile', e.target.value)}
                className="pr-9"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <FieldVoiceInput
                  fieldLabel="mobile number"
                  onChange={(text) => handleFormChange('mobile', text.replace(/[^0-9+\-\s]/g, '').trim())}
                />
              </div>
            </div>
          </div>

          {/* GST Number */}
          <div className="grid gap-2">
            <Label htmlFor="cust-gst">GST Number</Label>
            <div className="relative">
              <Input
                id="cust-gst"
                placeholder="Enter GST number (optional)"
                value={formData.gstNumber}
                onChange={(e) => handleFormChange('gstNumber', e.target.value)}
                className="pr-9"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <FieldVoiceInput
                  fieldLabel="GST number"
                  onChange={(text) => handleFormChange('gstNumber', text.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="grid gap-2">
            <Label htmlFor="cust-address">Address</Label>
            <div className="relative">
              <Textarea
                id="cust-address"
                placeholder="Enter address"
                value={formData.address}
                onChange={(e) => handleFormChange('address', e.target.value)}
                className="min-h-[80px] pr-9"
              />
              <div className="absolute right-1.5 top-2">
                <FieldVoiceInput
                  fieldLabel="address"
                  onChange={(text) => handleFormChange('address', text)}
                />
              </div>
            </div>
          </div>

          {/* Credit Limit */}
          <div className="grid gap-2">
            <Label htmlFor="cust-credit">Credit Limit (₹)</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="cust-credit"
                type="number"
                placeholder="0"
                className="pl-9"
                value={formData.creditLimit}
                onChange={(e) => handleFormChange('creditLimit', e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setFormOpen(false)}
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
            {editingCustomer ? 'Update Customer' : 'Create Customer'}
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
          <AlertDialogTitle>Delete Customer</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action
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

  // ── Render: Ledger dialog ───────────────────────────────────────────────
  const renderLedgerDialog = () => (
    <Dialog open={!!ledgerCustomer} onOpenChange={(open) => !open && setLedgerCustomer(null)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-5 text-emerald-600" />
            Payment Ledger — {ledgerCustomer?.name}
          </DialogTitle>
          <DialogDescription>
            Payment history for {ledgerCustomer?.name}
          </DialogDescription>
        </DialogHeader>

        {ledgerLoading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : ledgerPayments.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No payment records found for this customer.
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
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
                {ledgerPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(payment.date)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payment.paymentType?.toLowerCase() === 'credit' ? 'secondary' : 'outline'
                        }
                        className={
                          payment.paymentType?.toLowerCase() === 'credit'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-orange-100 text-orange-700 border-orange-200'
                        }
                      >
                        {payment.paymentType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {payment.remarks || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setLedgerCustomer(null)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // ── Render: Main ────────────────────────────────────────────────────────
  // If a customer is selected for history view, render the full-screen history page
  // INSTEAD of the customer list — user requested this be a separate page, not a modal.
  if (historyCustomerId) {
    return (
      <CustomerHistoryPage
        customerId={historyCustomerId}
        onBack={() => setHistoryCustomerId(null)}
      />
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="flex size-9 sm:size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
            <Users className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight truncate">Customer Management</h2>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              Manage your customer database and ledgers
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 w-full sm:hidden">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="w-full"
          >
            <Upload className="size-4 mr-2" />
            Import Excel
          </Button>
          <Button
            onClick={openAddDialog}
            className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
          >
            <Plus className="size-4 mr-2" />
            Add Customer
          </Button>
        </div>
        <div className="hidden sm:flex gap-2">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="size-4 mr-2" />
            Import Excel
          </Button>
          <Button
            onClick={openAddDialog}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="size-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search customers by name or mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Desktop: Table view */}
      <Card className="hidden sm:block">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Customers</span>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
              {loading
                ? 'Loading…'
                : totalCount > customers.length
                  ? `Showing ${customers.length} of ${totalCount} records`
                  : `${customers.length} record${customers.length !== 1 ? 's' : ''}`}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollableTable maxHeight="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-20 min-w-[140px]">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Mobile</TableHead>
                  <TableHead className="whitespace-nowrap">GST Number</TableHead>
                  <TableHead className="min-w-[180px]">Address</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Credit Limit (₹)</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  renderSkeletons()
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      {debouncedSearch
                        ? 'No customers found matching your search.'
                        : 'No customers yet. Click "Add Customer" to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id} className="cursor-pointer hover:bg-emerald-50/40" onClick={() => setHistoryCustomerId(customer.id)}>
                      <TableCell className="font-medium sticky left-0 bg-background z-10 min-w-[140px]">
                        <button
                          type="button"
                          className="text-emerald-700 hover:text-emerald-900 hover:underline text-left"
                          onClick={(e) => {
                            e.stopPropagation()
                            setHistoryCustomerId(customer.id)
                          }}
                          title="Click to view full customer history"
                        >
                          {customer.name}
                        </button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{customer.mobile}</TableCell>
                      <TableCell>
                        {customer.gstNumber ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                            {customer.gstNumber}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            No GST
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {customer.address || '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatCurrency(customer.creditLimit)}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setHistoryCustomerId(customer.id)}
                            title="View Full History"
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          >
                            <BookOpen className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(customer)}
                            title="Edit Customer"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(customer)}
                            title="Delete Customer"
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
          </ScrollableTable>
          <p className="text-xs text-muted-foreground mt-2 hidden sm:block">
            💡 Tip: Click on a customer's name or the book icon to view their complete transaction history (orders, dispatch, payments, sells, production, balance).
          </p>
        </CardContent>
      </Card>

      {/* Mobile: Card list view */}
      <div className="sm:hidden space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-semibold">Customers</h3>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
            {loading ? '…' : `${customers.length} of ${totalCount}`}
          </Badge>
        </div>
        {loading ? Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
        )) : customers.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            {debouncedSearch ? 'No customers found.' : 'No customers yet. Tap "Add Customer" to get started.'}
          </CardContent></Card>
        ) : customers.map((customer) => (
          <Card key={customer.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="text-emerald-700 hover:text-emerald-900 font-semibold text-left min-w-0 flex-1 truncate"
                  onClick={() => setHistoryCustomerId(customer.id)}
                  title="Tap to view full history"
                >
                  {customer.name}
                </button>
                <p className="font-bold text-emerald-700 whitespace-nowrap text-sm">{formatCurrency(customer.creditLimit)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Mobile</p>
                  <p className="font-medium truncate">{customer.mobile || '—'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">GST</p>
                  {customer.gstNumber ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">{customer.gstNumber}</Badge>
                  ) : (
                    <p className="text-muted-foreground text-xs">No GST</p>
                  )}
                </div>
              </div>
              {customer.address && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Address:</span>{' '}
                  <span className="line-clamp-2">{customer.address}</span>
                </p>
              )}
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setHistoryCustomerId(customer.id)} className="h-8 text-emerald-700 border-emerald-200">
                  <BookOpen className="size-3.5 mr-1" />History
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEditDialog(customer)} className="h-8">
                  <Pencil className="size-3.5 mr-1" />Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDeleteTarget(customer)} className="h-8 text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="size-3.5 mr-1" />Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialogs */}
      {renderFormDialog()}
      {renderDeleteDialog()}
      {renderLedgerDialog()}

      <ExcelImport module="customers" open={importOpen} onClose={() => setImportOpen(false)} onSuccess={fetchCustomers} />
    </div>
  )
}

export default CustomerModule
