'use client'

import * as React from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Truck,
  Plus,
  Trash2,
  Eye,
  Printer,
  Loader2,
  Building2,
  Phone,
  MapPin,
  Upload,
  Search,
} from 'lucide-react'
import ExcelImport from '@/components/erp/excel-import'
import CustomerSearchInput from '@/components/erp/customer-search-input'
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

interface Order {
  id: string
  orderNumber: string
  customerId: string
  brickType: string
  quantity: number
  rate: number
  amount: number
  deliveryDate: string
  status: string
  createdAt: string
  updatedAt: string
  customer?: { name: string } | null
}

interface Dispatch {
  id: string
  dispatchNumber: string
  customerId: string
  orderId: string | null
  brickType: string
  quantity: number
  truckNumber: string
  driverName: string
  date: string
  createdAt: string
  updatedAt: string
  customer: Customer | null
  order: { id: string; orderNumber: string } | null
}

interface DispatchFormData {
  customerId: string
  orderId: string
  brickType: string
  quantity: string
  truckNumber: string
  driverName: string
  date: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const BRICK_TYPES = ['Red Brick', 'Fly Ash Brick', 'Cement Brick', 'Hollow Block']

const emptyForm: DispatchFormData = {
  customerId: '',
  orderId: '',
  brickType: '',
  quantity: '',
  truckNumber: '',
  driverName: '',
  date: '',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—'
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ── Component ───────────────────────────────────────────────────────────────

export function DispatchModule() {
  // ── State ─────────────────────────────────────────────────────────────
  const [dispatches, setDispatches] = React.useState<Dispatch[]>([])
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [loading, setLoading] = React.useState(true)

  // Create dialog
  const [createOpen, setCreateOpen] = React.useState(false)
  const [formData, setFormData] = React.useState<DispatchFormData>(emptyForm)
  const [submitting, setSubmitting] = React.useState(false)

  // Dropdown data
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [orders, setOrders] = React.useState<Order[]>([])
  const [dropdownsLoading, setDropdownsLoading] = React.useState(false)

  // Challan dialog
  const [challanDispatch, setChallanDispatch] = React.useState<Dispatch | null>(null)

  // Excel import
  const [importOpen, setImportOpen] = React.useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = React.useState<Dispatch | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  // ── Fetch dispatches ──────────────────────────────────────────────────
  const fetchDispatches = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getDispatches()
      setDispatches(res.dispatches as Dispatch[])
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to fetch dispatches',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  // Client-side filter
  const filteredDispatches = React.useMemo(() => {
    if (!debouncedSearch.trim()) return dispatches
    const q = debouncedSearch.toLowerCase()
    return dispatches.filter((item: any) =>
      ['dispatchNumber', 'truckNumber', 'driverName', 'brickType', 'date'].some((f) =>
        String((item as any)[f] ?? '').toLowerCase().includes(q)
      )
    )
  }, [dispatches, debouncedSearch])

  React.useEffect(() => {
    fetchDispatches()
  }, [fetchDispatches])

  // ── Fetch dropdown data when create dialog opens ──────────────────────
  React.useEffect(() => {
    if (!createOpen) return

    const fetchDropdownData = async () => {
      setDropdownsLoading(true)
      try {
        const [custRes, ordRes] = await Promise.all([
          api.getCustomers(),
          api.getOrders(),
        ])
        setCustomers(custRes.customers as Customer[])
        setOrders(ordRes.orders as Order[])
      } catch (err) {
        toast({
          title: 'Error',
          description: 'Failed to load dropdown data',
          variant: 'destructive',
        })
      } finally {
        setDropdownsLoading(false)
      }
    }

    fetchDropdownData()
  }, [createOpen])

  // ── Filter orders by selected customer ────────────────────────────────
  const pendingOrdersForCustomer = React.useMemo(() => {
    if (!formData.customerId) return []
    return orders.filter(
      (o) =>
        o.customerId === formData.customerId &&
        (o.status === 'Pending' || o.status === 'Processing')
    )
  }, [orders, formData.customerId])

  // ── Auto-fill brick type when order is selected ───────────────────────
  const handleOrderChange = (orderId: string) => {
    setFormData((prev) => {
      if (!orderId) return { ...prev, orderId: '' }
      const selectedOrder = orders.find((o) => o.id === orderId)
      return {
        ...prev,
        orderId,
        brickType: selectedOrder?.brickType || prev.brickType,
        quantity: selectedOrder ? String(selectedOrder.quantity) : prev.quantity,
      }
    })
  }

  // ── Create dispatch ───────────────────────────────────────────────────
  const handleCreate = async () => {
    // Unified empty-form check — show ONE popup instead of cascading errors
    if (isFormEmpty([formData.customerId, formData.orderId, formData.brickType, formData.quantity, formData.truckNumber, formData.driverName, formData.date])) {
      toast(showPleaseFillDataToast())
      return
    }
    if (!formData.customerId) {
      toast({ title: 'Validation Error', description: 'Please select a customer', variant: 'destructive' })
      return
    }
    if (!formData.brickType) {
      toast({ title: 'Validation Error', description: 'Please select a brick type', variant: 'destructive' })
      return
    }
    if (!formData.quantity || Number(formData.quantity) <= 0) {
      toast({ title: 'Validation Error', description: 'Please enter a valid quantity', variant: 'destructive' })
      return
    }
    if (!formData.truckNumber.trim()) {
      toast({ title: 'Validation Error', description: 'Please enter the truck number', variant: 'destructive' })
      return
    }
    if (!formData.driverName.trim()) {
      toast({ title: 'Validation Error', description: 'Please enter the driver name', variant: 'destructive' })
      return
    }
    if (!formData.date) {
      toast({ title: 'Validation Error', description: 'Please select a date', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        customerId: formData.customerId,
        orderId: formData.orderId || null,
        brickType: formData.brickType,
        quantity: Number(formData.quantity),
        truckNumber: formData.truckNumber.trim(),
        driverName: formData.driverName.trim(),
        date: formData.date,
      }

      await api.createDispatch(payload)
      toast({ title: 'Success', description: 'Dispatch created successfully' })
      setCreateOpen(false)
      setFormData(emptyForm)
      fetchDispatches()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create dispatch',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete dispatch ───────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteDispatch(deleteTarget.id)
      toast({ title: 'Success', description: 'Dispatch deleted successfully' })
      setDeleteTarget(null)
      fetchDispatches()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete dispatch',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  // ── Open create dialog ────────────────────────────────────────────────
  const openCreateDialog = () => {
    setFormData(emptyForm)
    setCreateOpen(true)
  }

  // ── Print challan ─────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print()
  }

  // ── Render: Loading skeletons ─────────────────────────────────────────
  const renderSkeletons = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-8 w-20" /></TableCell>
      </TableRow>
    ))

  // ── Render: Create dispatch dialog ────────────────────────────────────
  const renderCreateDialog = () => (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="size-5 text-emerald-600" />
            Create Dispatch
          </DialogTitle>
          <DialogDescription>
            Fill in the details to create a new dispatch entry.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Customer — SEARCHABLE (replaces old dropdown) */}
          <CustomerSearchInput
            value={formData.customerId}
            onSelect={(c) =>
              setFormData((prev) => ({ ...prev, customerId: c.id, orderId: '', brickType: '', quantity: '' }))
            }
            onClear={() =>
              setFormData((prev) => ({ ...prev, customerId: '', orderId: '', brickType: '', quantity: '' }))
            }
            required
            label="Customer"
            placeholder="Type customer name or mobile to search..."
          />

          {/* Order (optional) */}
          <div className="grid gap-2">
            <Label>
              Order <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </Label>
            <Select
              value={formData.orderId}
              onValueChange={handleOrderChange}
              disabled={!formData.customerId || pendingOrdersForCustomer.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    !formData.customerId
                      ? 'Select a customer first'
                      : pendingOrdersForCustomer.length === 0
                        ? 'No pending orders'
                        : 'Select order'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {pendingOrdersForCustomer.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.orderNumber} — {o.brickType} ({o.quantity.toLocaleString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Brick Type */}
          <div className="grid gap-2">
            <Label>
              Brick Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.brickType}
              onValueChange={(val) => setFormData((prev) => ({ ...prev, brickType: val }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select brick type" />
              </SelectTrigger>
              <SelectContent>
                {BRICK_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="grid gap-2">
            <Label htmlFor="dispatch-quantity">
              Quantity <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dispatch-quantity"
              type="number"
              min="1"
              placeholder="Enter quantity"
              value={formData.quantity}
              onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
            />
          </div>

          {/* Truck Number */}
          <div className="grid gap-2">
            <Label htmlFor="dispatch-truck">
              Truck Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dispatch-truck"
              placeholder="e.g. RJ-14-AB-1234"
              value={formData.truckNumber}
              onChange={(e) => setFormData((prev) => ({ ...prev, truckNumber: e.target.value }))}
            />
          </div>

          {/* Driver Name */}
          <div className="grid gap-2">
            <Label htmlFor="dispatch-driver">
              Driver Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dispatch-driver"
              placeholder="Enter driver name"
              value={formData.driverName}
              onChange={(e) => setFormData((prev) => ({ ...prev, driverName: e.target.value }))}
            />
          </div>

          {/* Date */}
          <div className="grid gap-2">
            <Label htmlFor="dispatch-date">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dispatch-date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setCreateOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create Dispatch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // ── Render: Challan / Print View dialog ───────────────────────────────
  const renderChallanDialog = () => {
    if (!challanDispatch) return null
    const d = challanDispatch

    return (
      <Dialog open={!!challanDispatch} onOpenChange={(open) => !open && setChallanDispatch(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:p-0 print:shadow-none print:border-none">
          {/* Screen-only close button header */}
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-5 text-emerald-600" />
              Dispatch Challan
            </DialogTitle>
            <DialogDescription>
              Preview and print the dispatch slip
            </DialogDescription>
          </DialogHeader>

          {/* ── Challan Content (Print-friendly) ─────────────────────── */}
          <div id="challan-content" className="print:p-6">
            {/* Company Header */}
            <div className="text-center mb-6 print:mb-8">
              <div className="flex items-center justify-center gap-3 mb-2">
                <Building2 className="size-8 text-emerald-600 print:text-black" />
                <h1 className="text-2xl font-bold tracking-wide text-emerald-800 print:text-black">
                  Veda Enterprises
                </h1>
              </div>
              <p className="text-sm text-muted-foreground print:text-gray-600">
                Brick Manufacturing &amp; Supply
              </p>
              <Separator className="mt-4 print:mt-6" />
            </div>

            {/* Title */}
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold underline underline-offset-4 print:text-black">
                DISPATCH SLIP
              </h2>
            </div>

            {/* Dispatch & Customer Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm print:text-black">
              {/* Left column: Dispatch info */}
              <div className="space-y-2">
                <div className="flex justify-between border-b border-dashed pb-1.5 print:border-gray-400">
                  <span className="text-muted-foreground print:text-gray-500">Dispatch No:</span>
                  <span className="font-semibold">{d.dispatchNumber}</span>
                </div>
                <div className="flex justify-between border-b border-dashed pb-1.5 print:border-gray-400">
                  <span className="text-muted-foreground print:text-gray-500">Date:</span>
                  <span className="font-semibold">{formatDate(d.date)}</span>
                </div>
                {d.order && (
                  <div className="flex justify-between border-b border-dashed pb-1.5 print:border-gray-400">
                    <span className="text-muted-foreground print:text-gray-500">Order Ref:</span>
                    <span className="font-semibold">{d.order.orderNumber}</span>
                  </div>
                )}
              </div>

              {/* Right column: Customer info */}
              <div className="space-y-2">
                <div className="flex justify-between border-b border-dashed pb-1.5 print:border-gray-400">
                  <span className="text-muted-foreground print:text-gray-500">Customer:</span>
                  <span className="font-semibold">{d.customer?.name || '—'}</span>
                </div>
                {d.customer?.mobile && (
                  <div className="flex items-center justify-between border-b border-dashed pb-1.5 print:border-gray-400">
                    <span className="text-muted-foreground print:text-gray-500 flex items-center gap-1">
                      <Phone className="size-3" /> Phone:
                    </span>
                    <span>{d.customer.mobile}</span>
                  </div>
                )}
                {d.customer?.address && (
                  <div className="flex items-start justify-between border-b border-dashed pb-1.5 print:border-gray-400">
                    <span className="text-muted-foreground print:text-gray-500 flex items-center gap-1 shrink-0">
                      <MapPin className="size-3" /> Address:
                    </span>
                    <span className="text-right max-w-[60%]">{d.customer.address}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator className="mb-6 print:border-gray-400" />

            {/* Transport Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm print:text-black">
              <div className="flex justify-between border-b border-dashed pb-1.5 print:border-gray-400">
                <span className="text-muted-foreground print:text-gray-500">Truck Number:</span>
                <span className="font-semibold">
                  <Badge
                    variant="outline"
                    className="font-mono text-xs print:border-black print:text-black print:bg-transparent"
                  >
                    {d.truckNumber}
                  </Badge>
                </span>
              </div>
              <div className="flex justify-between border-b border-dashed pb-1.5 print:border-gray-400">
                <span className="text-muted-foreground print:text-gray-500">Driver Name:</span>
                <span className="font-semibold">{d.driverName}</span>
              </div>
            </div>

            <Separator className="mb-6 print:border-gray-400" />

            {/* Material Details */}
            <div className="mb-8 print:text-black">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground print:text-gray-500 uppercase tracking-wider">
                Material Details
              </h3>
              <Table>
                <TableHeader>
                  <TableRow className="print:border-gray-400">
                    <TableHead className="print:text-black print:border-gray-400">Brick Type</TableHead>
                    <TableHead className="text-right print:text-black print:border-gray-400">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="print:border-gray-400">
                    <TableCell className="font-medium print:text-black print:border-gray-400">
                      {d.brickType}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold print:text-black print:border-gray-400">
                      {d.quantity.toLocaleString()}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Signature area */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mt-12 print:grid-cols-2 print:text-black">
              <div className="text-center">
                <div className="border-t border-gray-400 pt-2 text-sm text-muted-foreground print:text-gray-500">
                  Driver Signature
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-400 pt-2 text-sm text-muted-foreground print:text-gray-500">
                  Authorized Signature
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-xs text-muted-foreground print:text-gray-400 print:mt-12">
              <p>This is a computer-generated dispatch slip from Veda Enterprises ERP.</p>
            </div>
          </div>

          {/* Screen-only footer with print button */}
          <DialogFooter className="print:hidden">
            <Button
              variant="outline"
              onClick={() => setChallanDispatch(null)}
            >
              Close
            </Button>
            <Button
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Printer className="size-4" />
              Print Challan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // ── Render: Delete confirmation ───────────────────────────────────────
  const renderDeleteDialog = () => (
    <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Dispatch</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete dispatch{' '}
            <strong>{deleteTarget?.dispatchNumber}</strong>? This action cannot
            be undone and the stock will not be restored.
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

  // ── Render: Main ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6 print:hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <Truck className="size-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Dispatch Management</h2>
            <p className="text-sm text-muted-foreground">
              Manage dispatch entries and generate challans
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:w-auto">
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
            Create Dispatch
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search across all fields (date, name, remarks, etc.)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Dispatches</span>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
              {filteredDispatches.length} of {dispatches.length} record{dispatches.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Dispatch No.</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Brick Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Truck No.</TableHead>
                  <TableHead className="hidden md:table-cell">Driver</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  renderSkeletons()
                ) : filteredDispatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Truck className="size-8 text-muted-foreground/40" />
                        <span>No dispatch entries yet. Click &quot;Create Dispatch&quot; to get started.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDispatches.map((dispatch) => (
                    <TableRow key={dispatch.id}>
                      <TableCell className="font-medium font-mono text-xs">
                        {dispatch.dispatchNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{dispatch.customer?.name || '—'}</span>
                          {dispatch.order && (
                            <span className="block text-xs text-muted-foreground">
                              Ref: {dispatch.order.orderNumber}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{dispatch.brickType}</TableCell>
                      <TableCell className="text-right font-mono">
                        {dispatch.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-mono text-xs bg-amber-50 text-amber-700 border-amber-200"
                        >
                          {dispatch.truckNumber}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {dispatch.driverName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(dispatch.date)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setChallanDispatch(dispatch)}
                            title="View Challan"
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          >
                            <Eye className="size-4" />
                            <span className="sr-only">View Challan</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(dispatch)}
                            title="Delete Dispatch"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Delete</span>
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

      {/* Dialogs */}
      {renderCreateDialog()}
      {renderChallanDialog()}
      {renderDeleteDialog()}

      <ExcelImport module="dispatch" open={importOpen} onClose={() => setImportOpen(false)} onSuccess={fetchDispatches} />
    </div>
  )
}

export default DispatchModule
