'use client'

import * as React from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  IndianRupee,
  Upload,
  Search,
  X,
} from 'lucide-react'
import ExcelImport from '@/components/erp/excel-import'
import CustomerSearchInput from '@/components/erp/customer-search-input'
import { isFormEmpty, showPleaseFillDataToast } from '@/lib/form-validation'
import { Checkbox } from '@/components/ui/checkbox'

// ── Types ───────────────────────────────────────────────────────────────────

interface Customer {
  id: string
  name: string
}

interface OrderItem {
  description: string
  hsn: string
  quantity: number
  unit: string
  rate: number
  amount: number
}

interface Order {
  id: string
  orderNumber: string
  customerId: string
  brickType: string
  quantity: number
  rate: number
  amount: number
  items?: OrderItem[]
  deliveryDate: string
  status: string
  createdAt: string
  customer: { id: string; name: string }
}

interface OrderFormData {
  customerId: string
  brickType: string
  quantity: number | string
  rate: number | string
  deliveryDate: string
  status: string
  items: OrderItem[]
}

// ── Constants ───────────────────────────────────────────────────────────────

// Paver block product types — same 12 fields as Stock/Production schema
// (cement, zigZagGrey80, zigZagRed80, zigZagYellow80, zigZagGrey60,
//  zigZagRed60, zigZagYellow60, chequreTile, curveStone,
//  dumbleGrey80, dumbleRed80, dumbleYellow80)
const BRICK_TYPES = [
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
] as const

// Map each product label to its Stock/Production schema field name — used
// when "Add Item" rows are added so the line item's description can be
// correlated with stock/production data later.
const PRODUCT_FIELD_MAP: Record<string, string> = {
  'Cement':               'cement',
  'Zig Zag Grey 80mm':    'zigZagGrey80',
  'Zig Zag Red 80mm':     'zigZagRed80',
  'Zig Zag Yellow 80mm':  'zigZagYellow80',
  'Zig Zag Grey 60mm':    'zigZagGrey60',
  'Zig Zag Red 60mm':     'zigZagRed60',
  'Zig Zag Yellow 60mm':  'zigZagYellow60',
  'Chequre Tile':         'chequreTile',
  'Curve Stone':          'curveStone',
  'Dumble Grey 80mm':     'dumbleGrey80',
  'Dumble Red 80mm':      'dumbleRed80',
  'Dumble Yellow 80mm':   'dumbleYellow80',
}

const ORDER_STATUSES = ['Pending', 'Processing', 'Delivered', 'Cancelled'] as const

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700 border-amber-200',
  Processing: 'bg-sky-100 text-sky-700 border-sky-200',
  Delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-rose-100 text-rose-700 border-rose-200',
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

const emptyForm: OrderFormData = {
  customerId: '',
  brickType: '',
  quantity: '',
  rate: '',
  deliveryDate: '',
  status: 'Pending',
  items: [],
}

// Default new line item — used when user clicks "Add Item"
const newItem = (): OrderItem => ({
  description: '', hsn: '', quantity: 1, unit: 'pcs', rate: 0, amount: 0,
})

// ── Component ───────────────────────────────────────────────────────────────

export function OrderModule() {
  // State
  const [orders, setOrders] = React.useState<Order[]>([])
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [loading, setLoading] = React.useState(true)

  // Create dialog states
  const [createOpen, setCreateOpen] = React.useState(false)
  const [formData, setFormData] = React.useState<OrderFormData>(emptyForm)
  const [formSubmitting, setFormSubmitting] = React.useState(false)

  // Edit status dialog states
  const [editStatusOpen, setEditStatusOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<Order | null>(null)
  const [editStatus, setEditStatus] = React.useState('')
  const [editSubmitting, setEditSubmitting] = React.useState(false)

  // Excel import
  const [importOpen, setImportOpen] = React.useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = React.useState<Order | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  // ── Multi-select state ──────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false)
  const [bulkDeleting, setBulkDeleting] = React.useState(false)

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (prev.size === filteredOrders.length && filteredOrders.length > 0) {
        return new Set()
      }
      return new Set(filteredOrders.map((i) => i.id))
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkDeleting(true)
    try {
      const res = await api.bulkDeleteOrders(ids)
      toast({
        title: 'Success',
        description: `${res.deletedCount} of ${ids.length} order${res.deletedCount === 1 ? '' : 's'} deleted`,
      })
      setBulkDeleteOpen(false)
      clearSelection()
      fetchOrders()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete selected orders',
        variant: 'destructive',
      })
    } finally {
      setBulkDeleting(false)
    }
  }

  // ── Computed amount ─────────────────────────────────────────────────────
  // If items[] are present, total amount = sum of item amounts.
  // Otherwise fall back to top-level qty * rate.
  const computedAmount = React.useMemo(() => {
    if (formData.items.length > 0) {
      return formData.items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
    }
    const qty = Number(formData.quantity) || 0
    const rate = Number(formData.rate) || 0
    return qty * rate
  }, [formData.quantity, formData.rate, formData.items])

  // ── Item management ──────────────────────────────────────────────────────
  const updateItem = (idx: number, field: keyof OrderItem, value: string | number) => {
    setFormData((prev) => {
      const items = [...prev.items]
      const item = { ...items[idx] }
      if (field === 'description' || field === 'hsn' || field === 'unit') {
        (item as any)[field] = value as string
      } else {
        (item as any)[field] = Number(value) || 0
      }
      item.amount = item.quantity * item.rate
      items[idx] = item
      return { ...prev, items }
    })
  }
  const addItem = () => setFormData((prev) => ({ ...prev, items: [...prev.items, newItem()] }))
  const removeItem = (idx: number) =>
    setFormData((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))

  // ── Fetch orders ────────────────────────────────────────────────────────
  const fetchOrders = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getOrders()
      const orderList = (res.orders as Order[]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setOrders(orderList)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to fetch orders',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Fetch customers (for dropdown) ─────────────────────────────────────
  const fetchCustomers = React.useCallback(async () => {
    try {
      const res = await api.getCustomers()
      setCustomers(res.customers as Customer[])
    } catch {
      // Silently fail — customer dropdown will just be empty
    }
  }, [])

  // Debounced search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  // Client-side filter
  const filteredOrders = React.useMemo(() => {
    if (!debouncedSearch.trim()) return orders
    const q = debouncedSearch.toLowerCase()
    return orders.filter((item: any) =>
      ['orderNumber', 'brickType', 'status', 'deliveryDate'].some((f) =>
        String((item as any)[f] ?? '').toLowerCase().includes(q)
      )
    )
  }, [orders, debouncedSearch])

  React.useEffect(() => {
    fetchOrders()
    fetchCustomers()
  }, [fetchOrders, fetchCustomers])

  // ── Create dialog handlers ──────────────────────────────────────────────
  const openCreateDialog = () => {
    setFormData(emptyForm)
    setCreateOpen(true)
  }

  const handleFormChange = (field: keyof OrderFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleCreateSubmit = async () => {
    // Unified empty-form check — show ONE popup instead of cascading errors
    if (isFormEmpty([formData.customerId, formData.brickType, formData.quantity, formData.rate, formData.deliveryDate, formData.status])) {
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
      toast({ title: 'Validation Error', description: 'Quantity must be greater than 0', variant: 'destructive' })
      return
    }
    if (!formData.rate || Number(formData.rate) <= 0) {
      toast({ title: 'Validation Error', description: 'Rate must be greater than 0', variant: 'destructive' })
      return
    }
    if (!formData.deliveryDate) {
      toast({ title: 'Validation Error', description: 'Delivery date is required', variant: 'destructive' })
      return
    }

    // Either items[] OR brickType+qty+rate must be present
    const hasItems = formData.items.length > 0 && formData.items.some((i) => i.description.trim())
    if (!hasItems && (!formData.brickType || !formData.quantity || !formData.rate)) {
      toast({
        title: 'Validation Error',
        description: 'Add at least one item, OR fill brick type + quantity + rate',
        variant: 'destructive',
      })
      return
    }

    setFormSubmitting(true)
    try {
      const payload = {
        customerId: formData.customerId,
        brickType: formData.brickType,
        quantity: Number(formData.quantity) || 0,
        rate: Number(formData.rate) || 0,
        amount: computedAmount,
        deliveryDate: formData.deliveryDate,
        status: formData.status,
        items: formData.items.filter((i) => i.description.trim()),
      }

      await api.createOrder(payload)
      toast({ title: 'Success', description: 'Order created successfully' })
      setCreateOpen(false)
      setFormData(emptyForm)
      fetchOrders()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create order',
        variant: 'destructive',
      })
    } finally {
      setFormSubmitting(false)
    }
  }

  // ── Edit status handlers ────────────────────────────────────────────────
  const openEditStatusDialog = (order: Order) => {
    setEditTarget(order)
    setEditStatus(order.status)
    setEditStatusOpen(true)
  }

  const handleEditStatusSubmit = async () => {
    if (!editTarget) return
    setEditSubmitting(true)
    try {
      await api.updateOrder(editTarget.id, { status: editStatus })
      toast({ title: 'Success', description: 'Order status updated successfully' })
      setEditStatusOpen(false)
      setEditTarget(null)
      setEditStatus('')
      fetchOrders()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update order status',
        variant: 'destructive',
      })
    } finally {
      setEditSubmitting(false)
    }
  }

  // ── Delete handler ──────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteOrder(deleteTarget.id)
      toast({ title: 'Success', description: 'Order deleted successfully' })
      setDeleteTarget(null)
      fetchOrders()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete order',
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
        <TableCell><Skeleton className="h-4 w-6" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
        <TableCell><Skeleton className="h-8 w-20" /></TableCell>
      </TableRow>
    ))

  // ── Render: Status badge ────────────────────────────────────────────────
  const renderStatusBadge = (status: string) => (
    <Badge className={STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 border-gray-200'}>
      {status}
    </Badge>
  )

  // ── Render: Create Order dialog ─────────────────────────────────────────
  const renderCreateDialog = () => (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Order</DialogTitle>
          <DialogDescription>
            Fill in the details to create a new order. You can add multiple items below the brick type.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Customer — SEARCHABLE (replaces old dropdown) */}
          <CustomerSearchInput
            value={formData.customerId}
            onSelect={(c) => handleFormChange('customerId', c.id)}
            onClear={() => handleFormChange('customerId', '')}
            required
            label="Customer"
            placeholder="Type customer name or mobile to search..."
          />

          {/* Brick Type — now optional since items[] can replace it */}
          <div className="grid gap-2">
            <Label htmlFor="order-brick">
              Brick Type <span className="text-muted-foreground text-xs font-normal">(optional when items are added below)</span>
            </Label>
            <Select
              value={formData.brickType}
              onValueChange={(val) => handleFormChange('brickType', val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select brick type (or skip if using items)" />
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

          {/* Items section — multi-line item entry with paver block types */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Items <span className="text-muted-foreground text-xs font-normal">(select brick type for each line)</span></Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-3 w-3 mr-1" /> Add Item
              </Button>
            </div>
            <div className="border rounded-md p-2 space-y-2 bg-muted/20">
              {formData.items.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No items added. Use "Add Item" to add multiple paver block products, OR skip this section and use brick type + qty + rate above.
                </p>
              ) : (
                <>
                  <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground px-1">
                    <div className="col-span-5">Brick Type</div>
                    <div className="col-span-2">Qty</div>
                    <div className="col-span-2">Unit</div>
                    <div className="col-span-2">Rate (₹)</div>
                    <div className="col-span-1">Amount</div>
                  </div>
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <Select
                        value={item.description}
                        onValueChange={(val) => updateItem(idx, 'description', val)}
                      >
                        <SelectTrigger className="col-span-12 md:col-span-5 h-9">
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
                      <Input
                        type="number"
                        className="col-span-4 md:col-span-2"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                      />
                      <Input
                        className="col-span-4 md:col-span-2"
                        placeholder="Unit"
                        value={item.unit}
                        onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                      />
                      <Input
                        type="number"
                        className="col-span-4 md:col-span-2"
                        placeholder="Rate"
                        value={item.rate}
                        onChange={(e) => updateItem(idx, 'rate', e.target.value)}
                      />
                      <div className="col-span-11 md:col-span-1 flex items-center gap-1">
                        <span className="text-xs font-medium flex-1">₹{(item.amount || 0).toLocaleString('en-IN')}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive shrink-0"
                          onClick={() => removeItem(idx)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {formData.items.length > 0 && (
                <div className="flex justify-end pt-1 border-t text-sm font-medium">
                  Total: ₹{computedAmount.toLocaleString('en-IN')}
                </div>
              )}
            </div>
          </div>

          {/* Quantity & Rate — kept for backward compat / quick single-item orders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="order-qty">
                Quantity <span className="text-muted-foreground text-xs font-normal">(if no items)</span>
              </Label>
              <Input
                id="order-qty"
                type="number"
                placeholder="0"
                min="1"
                value={formData.quantity}
                onChange={(e) => handleFormChange('quantity', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="order-rate">
                Rate (₹) <span className="text-muted-foreground text-xs font-normal">(if no items)</span>
              </Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="order-rate"
                  type="number"
                  placeholder="0"
                  min="1"
                  className="pl-9"
                  value={formData.rate}
                  onChange={(e) => handleFormChange('rate', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Amount (auto-calculated) */}
          <div className="grid gap-2">
            <Label>Amount (₹)</Label>
            <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-medium">
              {formatCurrency(computedAmount)}
            </div>
          </div>

          {/* Delivery Date */}
          <div className="grid gap-2">
            <Label htmlFor="order-date">
              Delivery Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="order-date"
              type="date"
              value={formData.deliveryDate}
              onChange={(e) => handleFormChange('deliveryDate', e.target.value)}
            />
          </div>

          {/* Status */}
          <div className="grid gap-2">
            <Label htmlFor="order-status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(val) => handleFormChange('status', val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setCreateOpen(false)}
            disabled={formSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateSubmit}
            disabled={formSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {formSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // ── Render: Edit Status dialog ──────────────────────────────────────────
  const renderEditStatusDialog = () => (
    <Dialog open={editStatusOpen} onOpenChange={setEditStatusOpen}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Order Status</DialogTitle>
          <DialogDescription>
            Change the status for order <strong>{editTarget?.orderNumber}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Current Status</Label>
            <div>{editTarget ? renderStatusBadge(editTarget.status) : null}</div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-status">New Status</Label>
            <Select value={editStatus} onValueChange={setEditStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setEditStatusOpen(false)}
            disabled={editSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleEditStatusSubmit}
            disabled={editSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {editSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Update Status
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
          <AlertDialogTitle>Delete Order</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete order <strong>{deleteTarget?.orderNumber}</strong>? This
            action cannot be undone.
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
      {/* Full-screen loading overlay during bulk delete */}
      {bulkDeleting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4 min-w-[280px]">
            <Loader2 className="size-12 animate-spin text-emerald-600" />
            <div className="text-center">
              <p className="text-lg font-semibold">Deleting {selectedIds.size} order{selectedIds.size === 1 ? '' : 's'}...</p>
              <p className="text-sm text-muted-foreground mt-1">Please wait while records are removed.</p>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Order Management</h2>
            <p className="text-sm text-muted-foreground">
              Track and manage customer orders
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
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkDeleting || loading}
              className="w-full sm:w-auto text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4 mr-2" />Delete Selected
              <Badge variant="secondary" className="ml-2 bg-destructive/10 text-destructive border-destructive/30">{selectedIds.size}</Badge>
            </Button>
          )}
          {selectedIds.size > 0 && (
            <Button variant="ghost" onClick={clearSelection} disabled={bulkDeleting} className="w-full sm:w-auto">Clear Selection</Button>
          )}
          <Button
            onClick={openCreateDialog}
            className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
          >
            <Plus className="size-4" />
            Create Order
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="py-1">
        <CardContent className="px-3 py-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search across all fields (date, name, remarks, etc.)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-7 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
            <span>Orders</span>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/30">{selectedIds.size} selected</Badge>}
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                {filteredOrders.length} of {orders.length} record{orders.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={filteredOrders.length > 0 && selectedIds.size === filteredOrders.length} onCheckedChange={toggleSelectAll} aria-label="Select all rows" /></TableHead>
                  <TableHead>Order No.</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden sm:table-cell">Brick Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Rate (₹)</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead className="hidden md:table-cell">Delivery Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  renderSkeletons()
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      No orders yet. Click &quot;Create Order&quot; to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  // ── Multi-product expansion (Excel-style) ──────────────────
                  // Orders with 2+ items in `items[]` expand into N table rows
                  // — one per item — so each gets its own Brick Type / Qty /
                  // Rate / Amount cell with real values (no "varies" / "sum: N").
                  // Order No, Customer, Delivery Date, Status, Actions, and the
                  // Checkbox use `rowSpan={N}` on the first sub-row.
                  filteredOrders.flatMap((order) => {
                    const items = order.items && order.items.length > 0
                      ? order.items.map((it) => ({
                          description: String(it.description || ''),
                          quantity: Number(it.quantity) || 0,
                          rate: Number(it.rate) || 0,
                          amount: Number(it.amount) || 0,
                        }))
                      : [{
                          description: String(order.brickType || ''),
                          quantity: Number(order.quantity) || 0,
                          rate: Number(order.rate) || 0,
                          amount: Number(order.amount) || 0,
                        }]
                    const isMulti = items.length > 1
                    const rowSpan = isMulti ? items.length : 1
                    return items.map((line, lineIdx) => {
                      const isFirstLine = lineIdx === 0
                      // Alternating tinted backgrounds for multi-item sub-rows
                      // so each product line is visually distinct (Excel-like).
                      const rowBg = selectedIds.has(order.id)
                        ? 'bg-emerald-50/60 dark:bg-emerald-900/15'
                        : isMulti
                        ? lineIdx % 2 === 0
                          ? 'bg-blue-50/60 dark:bg-blue-900/20'
                          : 'bg-sky-50/40 dark:bg-sky-900/10'
                        : ''
                      const rowBorder = isMulti && lineIdx > 0 ? 'border-t border-blue-200/70 dark:border-blue-800/40' : ''
                      return (
                        <TableRow
                          key={`${order.id}-line-${lineIdx}`}
                          data-state={selectedIds.has(order.id) ? 'selected' : undefined}
                          className={`${rowBg} ${rowBorder}`.trim()}
                        >
                          {isFirstLine && (
                            <TableCell className="w-10 align-top" rowSpan={rowSpan}>
                              <Checkbox
                                checked={selectedIds.has(order.id)}
                                onCheckedChange={() => toggleSelect(order.id)}
                                aria-label={`Select row for ${order.orderNumber}`}
                              />
                            </TableCell>
                          )}
                          {isFirstLine && (
                            <TableCell className="font-medium whitespace-nowrap align-top" rowSpan={rowSpan}>
                              <div className="flex flex-col gap-0.5">
                                <span>{order.orderNumber}</span>
                                {isMulti && (
                                  <span className="inline-flex w-fit items-center rounded bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                                    {items.length} items
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          )}
                          {isFirstLine && (
                            <TableCell className="align-top" rowSpan={rowSpan}>{order.customer?.name || '—'}</TableCell>
                          )}
                          {/* Per-line cells — rendered on EVERY sub-row */}
                          <TableCell className="hidden sm:table-cell align-top">
                            <Badge variant="outline">{line.description || '—'}</Badge>
                          </TableCell>
                          <TableCell className="text-right align-top">
                            {new Intl.NumberFormat('en-IN').format(line.quantity)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-right whitespace-nowrap align-top">
                            {formatCurrency(line.rate)}
                          </TableCell>
                          <TableCell className="text-right font-medium whitespace-nowrap align-top">
                            {formatCurrency(line.amount)}
                          </TableCell>
                          {isFirstLine && (
                            <>
                              <TableCell className="hidden md:table-cell whitespace-nowrap align-top" rowSpan={rowSpan}>
                                {formatDate(order.deliveryDate)}
                              </TableCell>
                              <TableCell className="align-top" rowSpan={rowSpan}>{renderStatusBadge(order.status)}</TableCell>
                              <TableCell className="text-right align-top" rowSpan={rowSpan}>
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditStatusDialog(order)}
                                    title="Edit Status"
                                    className="text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleteTarget(order)}
                                    title="Delete Order"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      )
                    })
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      {renderCreateDialog()}
      {renderEditStatusDialog()}
      {renderDeleteDialog()}

      {/* Bulk Delete Selected confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!open && !bulkDeleting) setBulkDeleteOpen(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete {selectedIds.size} Selected {selectedIds.size === 1 ? 'Order' : 'Orders'}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <span className="block">You are about to permanently delete <strong className="text-destructive">{selectedIds.size} order{selectedIds.size === 1 ? '' : 's'}</strong>. This action <strong>cannot be undone</strong>.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting || selectedIds.size === 0} className="bg-destructive text-white hover:bg-destructive/90">{bulkDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}Delete {selectedIds.size} {selectedIds.size === 1 ? 'Order' : 'Orders'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExcelImport module="orders" open={importOpen} onClose={() => setImportOpen(false)} onSuccess={fetchOrders} />
    </div>
  )
}

export default OrderModule
