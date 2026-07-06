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
import { ShoppingCart, Plus, Trash2, Pencil, Loader2, IndianRupee, Upload , Search} from 'lucide-react'
import ExcelImport from '@/components/erp/excel-import'

// ── Types ───────────────────────────────────────────────────────────────────

interface DailySell {
  id: string
  date: string
  customerName: string
  address: string
  contactNumber: string
  product: string
  amount: number
  remarks: string
  createdAt: string
  updatedAt: string
}

interface DailySellFormData {
  date: string
  customerName: string
  address: string
  contactNumber: string
  product: string
  amount: string
  remarks: string
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
  new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

const emptyForm: DailySellFormData = {
  date: '',
  customerName: '',
  address: '',
  contactNumber: '',
  product: '',
  amount: '',
  remarks: '',
}

// ── Component ───────────────────────────────────────────────────────────────

export function DailySellModule() {
  const [dailySells, setDailySells] = React.useState<DailySell[]>([])
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<DailySell | null>(null)
  const [formData, setFormData] = React.useState<DailySellFormData>(emptyForm)
  const [formSubmitting, setFormSubmitting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<DailySell | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getDailySells()
      const data = (res.dailySells as DailySell[]).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      setDailySells(data)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to fetch daily sell data',
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
  const filteredDailySells = React.useMemo(() => {
    if (!debouncedSearch.trim()) return dailySells
    const q = debouncedSearch.toLowerCase()
    return dailySells.filter((item: any) =>
      ['date', 'customerName', 'address', 'contactNumber', 'product', 'remarks'].some((f) =>
        String((item as any)[f] ?? '').toLowerCase().includes(q)
      )
    )
  }, [dailySells, debouncedSearch])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Excel import

  const [importOpen, setImportOpen] = React.useState(false)


  const openAddDialog = () => {
    setEditingItem(null)
    setFormData(emptyForm)
    setFormOpen(true)
  }

  const openEditDialog = (item: DailySell) => {
    setEditingItem(item)
    setFormData({
      date: item.date ? item.date.split('T')[0] : '',
      customerName: item.customerName || '',
      address: item.address || '',
      contactNumber: item.contactNumber || '',
      product: item.product || '',
      amount: String(item.amount || ''),
      remarks: item.remarks || '',
    })
    setFormOpen(true)
  }

  const handleFormChange = (field: keyof DailySellFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!formData.date) {
      toast({ title: 'Validation Error', description: 'Date is required', variant: 'destructive' })
      return
    }
    if (!formData.customerName.trim()) {
      toast({ title: 'Validation Error', description: 'Customer name is required', variant: 'destructive' })
      return
    }

    setFormSubmitting(true)
    try {
      const payload = {
        date: formData.date,
        customerName: formData.customerName.trim(),
        address: formData.address.trim(),
        contactNumber: formData.contactNumber.trim(),
        product: formData.product.trim(),
        amount: Number(formData.amount) || 0,
        remarks: formData.remarks.trim(),
      }

      if (editingItem) {
        await api.updateDailySell(editingItem.id, payload)
        toast({ title: 'Success', description: 'Daily sell entry updated successfully' })
      } else {
        await api.createDailySell(payload)
        toast({ title: 'Success', description: 'Daily sell entry created successfully' })
      }

      setFormOpen(false)
      setFormData(emptyForm)
      setEditingItem(null)
      fetchData()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save daily sell entry',
        variant: 'destructive',
      })
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteDailySell(deleteTarget.id)
      toast({ title: 'Success', description: 'Daily sell entry deleted successfully' })
      setDeleteTarget(null)
      fetchData()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete daily sell entry',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const totalAmount = dailySells.reduce((sum, s) => sum + (s.amount || 0), 0)

  const renderSkeletons = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-8 w-20" /></TableCell>
      </TableRow>
    ))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <ShoppingCart className="size-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Daily Sell</h2>
            <p className="text-sm text-muted-foreground">
              Track daily sales transactions
            </p>
          </div>
        </div>
        <Button
          onClick={openAddDialog}
          className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
        >
          <Plus className="size-4" />
          Add Daily Sell
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Sales</p>
            {loading ? (
              <Skeleton className="h-6 w-32 mt-1" />
            ) : (
              <p className="text-xl font-bold text-emerald-700">{formatCurrency(totalAmount)}</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Records</p>
            {loading ? (
              <Skeleton className="h-6 w-16 mt-1" />
            ) : (
              <p className="text-xl font-bold text-amber-700">{dailySells.length}</p>
            )}
          </CardContent>
        </Card>
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
            <span>Daily Sell Records</span>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
              {filteredDailySells.length} of {dailySells.length} record{dailySells.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Contact Number</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  renderSkeletons()
                ) : filteredDailySells.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      No daily sell entries yet. Click &quot;Add Daily Sell&quot; to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDailySells.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium whitespace-nowrap">{formatDate(item.date)}</TableCell>
                      <TableCell className="font-medium">{item.customerName}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground">{item.address || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.contactNumber || '—'}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{item.product || '—'}</TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">{formatCurrency(item.amount)}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground">{item.remarks || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} title="Edit">
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(item)}
                            title="Delete"
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

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Daily Sell' : 'Add Daily Sell'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the daily sell entry details.' : 'Fill in the details to create a new daily sell entry.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="ds-date">Date <span className="text-destructive">*</span></Label>
              <Input id="ds-date" type="date" value={formData.date} onChange={(e) => handleFormChange('date', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ds-customer">Customer Name <span className="text-destructive">*</span></Label>
              <Input id="ds-customer" placeholder="Enter customer name" value={formData.customerName} onChange={(e) => handleFormChange('customerName', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ds-address">Address</Label>
              <Input id="ds-address" placeholder="Enter address" value={formData.address} onChange={(e) => handleFormChange('address', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ds-contact">Contact Number</Label>
              <Input id="ds-contact" placeholder="Enter contact number" value={formData.contactNumber} onChange={(e) => handleFormChange('contactNumber', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ds-product">Product</Label>
              <Input id="ds-product" placeholder="Enter product name" value={formData.product} onChange={(e) => handleFormChange('product', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ds-amount">Amount (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input id="ds-amount" type="number" min="0" placeholder="0" className="pl-9" value={formData.amount} onChange={(e) => handleFormChange('amount', e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ds-remarks">Remarks</Label>
              <Textarea id="ds-remarks" placeholder="Optional remarks..." value={formData.remarks} onChange={(e) => handleFormChange('remarks', e.target.value)} className="min-h-[80px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={formSubmitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={formSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {formSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingItem ? 'Update Entry' : 'Create Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Daily Sell Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this daily sell entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-white hover:bg-destructive/90">
              {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExcelImport module="dailySell" open={importOpen} onClose={() => setImportOpen(false)} onSuccess={fetchData} />
    </div>
  )
}

export default DailySellModule
