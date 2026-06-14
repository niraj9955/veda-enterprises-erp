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
} from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────────────────

interface Customer {
  id: string
  name: string
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
  customer: { id: string; name: string }
}

interface OrderFormData {
  customerId: string
  brickType: string
  quantity: number | string
  rate: number | string
  deliveryDate: string
  status: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const BRICK_TYPES = ['Red Brick', 'Fly Ash Brick', 'Cement Brick', 'Hollow Block'] as const

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
}

// ── Component ───────────────────────────────────────────────────────────────

export function OrderModule() {
  // State
  const [orders, setOrders] = React.useState<Order[]>([])
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

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = React.useState<Order | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  // ── Computed amount ─────────────────────────────────────────────────────
  const computedAmount = React.useMemo(() => {
    const qty = Number(formData.quantity) || 0
    const rate = Number(formData.rate) || 0
    return qty * rate
  }, [formData.quantity, formData.rate])

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

    setFormSubmitting(true)
    try {
      const payload = {
        customerId: formData.customerId,
        brickType: formData.brickType,
        quantity: Number(formData.quantity),
        rate: Number(formData.rate),
        amount: computedAmount,
        deliveryDate: formData.deliveryDate,
        status: formData.status,
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Order</DialogTitle>
          <DialogDescription>
            Fill in the details to create a new order.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Customer */}
          <div className="grid gap-2">
            <Label htmlFor="order-customer">
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

          {/* Brick Type */}
          <div className="grid gap-2">
            <Label htmlFor="order-brick">
              Brick Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.brickType}
              onValueChange={(val) => handleFormChange('brickType', val)}
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

          {/* Quantity & Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="order-qty">
                Quantity <span className="text-destructive">*</span>
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
                Rate (₹) <span className="text-destructive">*</span>
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
      <DialogContent className="sm:max-w-md">
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
        <Button
          onClick={openCreateDialog}
          className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
        >
          <Plus className="size-4" />
          Create Order
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Orders</span>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
              {orders.length} record{orders.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order No.</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Brick Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Rate (₹)</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead>Delivery Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  renderSkeletons()
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      No orders yet. Click &quot;Create Order&quot; to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell>{order.customer?.name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{order.brickType}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat('en-IN').format(order.quantity)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatCurrency(order.rate)}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatCurrency(order.amount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(order.deliveryDate)}
                      </TableCell>
                      <TableCell>{renderStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-right">
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
      {renderEditStatusDialog()}
      {renderDeleteDialog()}
    </div>
  )
}

export default OrderModule
