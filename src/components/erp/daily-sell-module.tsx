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
import { Checkbox } from '@/components/ui/checkbox'
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
import { ShoppingCart, Plus, Trash2, Pencil, Loader2, IndianRupee, Upload, Search, Trash } from 'lucide-react'
import ExcelImport from '@/components/erp/excel-import'
import { AiFillButton } from '@/components/ui/ai-fill-button'
import { FieldVoiceInput } from '@/components/ui/field-voice-input'
import { consumePendingAiResult } from '@/components/ui/ai-chat-widget'
import { isFormEmpty, showPleaseFillDataToast } from '@/lib/form-validation'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ── Product list (single source of truth for the dropdown) ───────────────────
// The same 12 items that appear as columns in the Production module —
// selecting from this list ensures the Stock Overview's
//   Total Production − Sell Item = Available Item
// formula matches exactly, with no fuzzy-text guesswork.
const PRODUCT_ITEMS: { key: string; label: string }[] = [
  { key: 'Cement', label: 'Cement' },
  { key: 'Zig Zag Grey 80mm', label: 'Zig Zag Grey 80mm' },
  { key: 'Zig Zag Red 80mm', label: 'Zig Zag Red 80mm' },
  { key: 'Zig Zag Yellow 80mm', label: 'Zig Zag Yellow 80mm' },
  { key: 'Zig Zag Grey 60mm', label: 'Zig Zag Grey 60mm' },
  { key: 'Zig Zag Red 60mm', label: 'Zig Zag Red 60mm' },
  { key: 'Zig Zag Yellow 60mm', label: 'Zig Zag Yellow 60mm' },
  { key: 'Chequre Tile', label: 'Chequre Tile' },
  { key: 'Curve Stone', label: 'Curve Stone' },
  { key: 'Dumble Grey 80mm', label: 'Dumble Grey 80mm' },
  { key: 'Dumble Red 80mm', label: 'Dumble Red 80mm' },
  { key: 'Dumble Yellow 80mm', label: 'Dumble Yellow 80mm' },
]

// ── Types ───────────────────────────────────────────────────────────────────

interface DailySell {
  id: string
  date: string
  customerName: string
  address: string
  contactNumber: string
  product: string
  quantity: number
  rate?: number
  amount: number
  transporterName?: string
  transporterFair?: number
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
  quantity: string
  rate: string
  amount: string
  transporterName: string
  transporterFair: string
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
  quantity: '',
  rate: '',
  amount: '',
  transporterName: '',
  transporterFair: '',
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

  // Multi-select state — mirrors the Production module pattern so the user
  // gets identical UX: tick individual rows or use the header checkbox to
  // select all currently-filtered rows, then click "Delete Selected".
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false)
  const [bulkDeleting, setBulkDeleting] = React.useState(false)

  // Delete All state — simple Yes/No confirmation dialog.
  const [deleteAllOpen, setDeleteAllOpen] = React.useState(false)
  const [deletingAll, setDeletingAll] = React.useState(false)

  // Excel import
  const [importOpen, setImportOpen] = React.useState(false)

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

  // ── Selection handlers ─────────────────────────────────────────────
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
      if (prev.size === filteredDailySells.length && filteredDailySells.length > 0) {
        return new Set()
      }
      return new Set(filteredDailySells.map((s) => s.id))
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  // ── Bulk delete selected ───────────────────────────────────────────
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkDeleting(true)
    try {
      const res = await api.bulkDeleteDailySells(ids)
      toast({
        title: 'Success',
        description: `${res.deletedCount} of ${ids.length} daily sell entr${res.deletedCount === 1 ? 'y' : 'ies'} deleted`,
      })
      setBulkDeleteOpen(false)
      clearSelection()
      fetchData()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete selected daily sell entries',
        variant: 'destructive',
      })
    } finally {
      setBulkDeleting(false)
    }
  }

  // ── Delete ALL ─────────────────────────────────────────────────────
  const handleDeleteAll = async () => {
    setDeletingAll(true)
    try {
      const res = await api.deleteAllDailySells()
      toast({
        title: 'Success',
        description: `${res.deletedCount} daily sell entr${res.deletedCount === 1 ? 'y' : 'ies'} deleted`,
      })
      setDeleteAllOpen(false)
      clearSelection()
      fetchData()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete all daily sell entries',
        variant: 'destructive',
      })
    } finally {
      setDeletingAll(false)
    }
  }

  const openAddDialog = () => {
    setEditingItem(null)
    // Check for pending AI result from chat widget — auto-fill if present
    const pending = consumePendingAiResult('dailySell')
    if (pending) {
      setFormData({
        date: String(pending.date || ''),
        customerName: String(pending.customerName || ''),
        address: String(pending.address || ''),
        contactNumber: String(pending.contactNumber || ''),
        product: String(pending.product || ''),
        quantity: pending.quantity != null ? String(pending.quantity) : '',
        rate: pending.rate != null ? String(pending.rate) : '',
        amount: pending.amount != null ? String(pending.amount) : '',
        transporterName: String(pending.transporterName || ''),
        transporterFair: pending.transporterFair != null ? String(pending.transporterFair) : '',
        remarks: String(pending.remarks || ''),
      })
      toast({ title: 'AI auto-fill applied', description: 'Edit & verify before saving.' })
    } else {
      setFormData(emptyForm)
    }
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
      quantity: String(item.quantity ?? ''),
      rate: String(item.rate ?? ''),
      amount: String(item.amount || ''),
      transporterName: item.transporterName || '',
      transporterFair: String(item.transporterFair ?? ''),
      remarks: item.remarks || '',
    })
    setFormOpen(true)
  }

  const handleFormChange = (field: keyof DailySellFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // ── Computed amount (auto = quantity × rate) ───────────────────────────
  const computedAmount = React.useMemo(() => {
    const qty = Number(formData.quantity) || 0
    const rate = Number(formData.rate) || 0
    return qty * rate
  }, [formData.quantity, formData.rate])

  const handleSubmit = async () => {
    // Unified empty-form check — show ONE popup instead of cascading errors
    if (isFormEmpty([formData.date, formData.customerName, formData.address, formData.contactNumber, formData.product, formData.quantity, formData.rate, formData.amount, formData.transporterName, formData.transporterFair, formData.remarks])) {
      toast(showPleaseFillDataToast())
      return
    }
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
        quantity: Number(formData.quantity) || 0,
        rate: Number(formData.rate) || 0,
        amount: computedAmount,
        transporterName: formData.transporterName.trim(),
        transporterFair: Number(formData.transporterFair) || 0,
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
        <TableCell><Skeleton className="h-4 w-6" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-8 w-20" /></TableCell>
      </TableRow>
    ))

  return (
    <div className="space-y-6 relative">
      {/* Full-screen loading overlay shown during any delete operation.
          Mirrors the Production module pattern so the user always sees
          that something is happening. */}
      {(deleting || deletingAll || bulkDeleting) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4 min-w-[280px]">
            <Loader2 className="size-12 animate-spin text-emerald-600" />
            <div className="text-center">
              <p className="text-lg font-semibold">
                {bulkDeleting
                  ? `Deleting ${selectedIds.size} entries...`
                  : deletingAll
                  ? 'Deleting all entries...'
                  : 'Deleting entry...'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Please wait while records are removed.
              </p>
            </div>
          </div>
        </div>
      )}

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
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="w-full sm:w-auto"
          >
            <Upload className="size-4 mr-2" />
            Import Excel
          </Button>
          {/* Bulk-delete button — only visible when at least one row is
              selected. Clicking it opens the confirmation dialog below. */}
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkDeleting || loading}
              className="w-full sm:w-auto text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4 mr-2" />
              Delete Selected
              <Badge variant="secondary" className="ml-2 bg-destructive/10 text-destructive border-destructive/30">
                {selectedIds.size}
              </Badge>
            </Button>
          )}
          {/* Clear-selection button — small, ghost-styled, only visible when rows are selected */}
          {selectedIds.size > 0 && (
            <Button
              variant="ghost"
              onClick={clearSelection}
              disabled={bulkDeleting}
              className="w-full sm:w-auto"
            >
              Clear Selection
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setDeleteAllOpen(true)}
            disabled={dailySells.length === 0 || loading}
            className="w-full sm:w-auto text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash className="size-4 mr-2" />
            Delete All
          </Button>
          <Button
            onClick={openAddDialog}
            className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
          >
            <Plus className="size-4" />
            Add Daily Sell
          </Button>
        </div>
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
          <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
            <span>Daily Sell Records</span>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedIds.size > 0 && (
                <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/30">
                  {selectedIds.size} selected
                </Badge>
              )}
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                {filteredDailySells.length} of {dailySells.length} record{dailySells.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollableTable maxHeight="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 sticky left-0 bg-background z-20">
                    <Checkbox
                      checked={
                        filteredDailySells.length > 0 &&
                        selectedIds.size === filteredDailySells.length
                      }
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all rows"
                    />
                  </TableHead>
                  <TableHead className="sticky left-10 bg-background z-20">Date</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Contact Number</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Quantity</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Rate (₹)</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Amount (₹)</TableHead>
                  <TableHead>Transporter Name</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Transporter Fair (₹)</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  renderSkeletons()
                ) : filteredDailySells.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="h-32 text-center text-muted-foreground">
                      No daily sell entries yet. Click &quot;Add Daily Sell&quot; to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDailySells.map((item) => (
                    <TableRow
                      key={item.id}
                      data-state={selectedIds.has(item.id) ? 'selected' : undefined}
                      className={selectedIds.has(item.id) ? 'bg-emerald-50/60 dark:bg-emerald-900/15' : ''}
                    >
                      <TableCell className="w-10 sticky left-0 bg-background z-10">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                          aria-label={`Select row for ${item.customerName}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap sticky left-10 bg-background z-10">
                        {formatDate(item.date)}
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{item.customerName}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground">{item.address || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.contactNumber || '—'}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{item.product || '—'}</TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                        {item.quantity != null ? item.quantity.toLocaleString('en-IN') : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                        {item.rate != null ? formatCurrency(item.rate) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">{formatCurrency(item.amount)}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{item.transporterName || '—'}</TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                        {item.transporterFair != null ? formatCurrency(item.transporterFair) : '—'}
                      </TableCell>
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
          </ScrollableTable>
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
          {!editingItem && (
            <div className="flex justify-end">
              <AiFillButton
                module="dailySell"
                onApply={(fields) => setFormData((prev) => ({
                  date: fields.date != null ? String(fields.date) : prev.date,
                  customerName: fields.customerName != null ? String(fields.customerName) : prev.customerName,
                  address: fields.address != null ? String(fields.address) : prev.address,
                  contactNumber: fields.contactNumber != null ? String(fields.contactNumber) : prev.contactNumber,
                  product: fields.product != null ? String(fields.product) : prev.product,
                  quantity: fields.quantity != null ? String(fields.quantity) : prev.quantity,
                  rate: fields.rate != null ? String(fields.rate) : prev.rate,
                  amount: fields.amount != null ? String(fields.amount) : prev.amount,
                  transporterName: fields.transporterName != null ? String(fields.transporterName) : prev.transporterName,
                  transporterFair: fields.transporterFair != null ? String(fields.transporterFair) : prev.transporterFair,
                  remarks: fields.remarks != null ? String(fields.remarks) : prev.remarks,
                }))}
              />
            </div>
          )}
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="ds-date">Date <span className="text-destructive">*</span></Label>
              <Input id="ds-date" type="date" value={formData.date} onChange={(e) => handleFormChange('date', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ds-customer">Customer Name <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input id="ds-customer" placeholder="Enter customer name" value={formData.customerName} onChange={(e) => handleFormChange('customerName', e.target.value)} className="pr-9" />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <FieldVoiceInput fieldLabel="customer name" onChange={(text) => handleFormChange('customerName', text)} />
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ds-address">Address</Label>
              <div className="relative">
                <Input id="ds-address" placeholder="Enter address" value={formData.address} onChange={(e) => handleFormChange('address', e.target.value)} className="pr-9" />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <FieldVoiceInput fieldLabel="address" onChange={(text) => handleFormChange('address', text)} />
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ds-contact">Contact Number</Label>
              <div className="relative">
                <Input id="ds-contact" placeholder="Enter contact number" value={formData.contactNumber} onChange={(e) => handleFormChange('contactNumber', e.target.value)} className="pr-9" />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <FieldVoiceInput fieldLabel="contact number" onChange={(text) => handleFormChange('contactNumber', text.replace(/[^0-9+\-\s]/g, '').trim())} />
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ds-product">Product <span className="text-destructive">*</span></Label>
              <Select
                value={formData.product}
                onValueChange={(val) => handleFormChange('product', val)}
              >
                <SelectTrigger id="ds-product" className="w-full">
                  <SelectValue placeholder="Select product item" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Product Items</SelectLabel>
                    {PRODUCT_ITEMS.map((item) => (
                      <SelectItem key={item.key} value={item.key}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the item you sold. This is used by Stock Overview to compute
                <span className="font-medium"> Available = Total Production − Sell Item</span>.
              </p>
            </div>
            {/* Quantity */}
            <div className="grid gap-2">
              <Label htmlFor="ds-quantity">Quantity</Label>
              <div className="relative">
                <Input
                  id="ds-quantity"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.quantity}
                  onChange={(e) => handleFormChange('quantity', e.target.value)}
                  className="pr-9"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <FieldVoiceInput
                    fieldLabel="quantity"
                    onChange={(text) => handleFormChange('quantity', text.replace(/[^0-9.]/g, ''))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Number of units sold. Used by Stock Overview as the “Sell Item” value.
              </p>
            </div>

            {/* Rate — comes AFTER Quantity */}
            <div className="grid gap-2">
              <Label htmlFor="ds-rate">Rate (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="ds-rate"
                  type="number"
                  min="0"
                  placeholder="0"
                  className="pl-9 pr-9"
                  value={formData.rate}
                  onChange={(e) => handleFormChange('rate', e.target.value)}
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <FieldVoiceInput
                    fieldLabel="rate"
                    onChange={(text) => handleFormChange('rate', text.replace(/[^0-9.]/g, ''))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Per-unit selling price. Amount auto-calculates as Quantity × Rate.
              </p>
            </div>

            {/* Amount — auto-calculated (read-only display) */}
            <div className="grid gap-2">
              <Label>Amount (₹) <span className="text-muted-foreground text-xs font-normal">(auto = quantity × rate)</span></Label>
              <div className="flex h-9 items-center rounded-md border bg-emerald-50 dark:bg-emerald-900/20 px-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(computedAmount)}
              </div>
            </div>

            {/* Transporter Name — NEW */}
            <div className="grid gap-2">
              <Label htmlFor="ds-transporter-name">Transporter Name</Label>
              <div className="relative">
                <Input
                  id="ds-transporter-name"
                  placeholder="e.g. Ramesh Transport"
                  value={formData.transporterName}
                  onChange={(e) => handleFormChange('transporterName', e.target.value)}
                  className="pr-9"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <FieldVoiceInput
                    fieldLabel="transporter name"
                    onChange={(text) => handleFormChange('transporterName', text)}
                  />
                </div>
              </div>
            </div>

            {/* Transporter Fair — NEW */}
            <div className="grid gap-2">
              <Label htmlFor="ds-transporter-fair">Transporter Fair (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="ds-transporter-fair"
                  type="number"
                  min="0"
                  placeholder="0"
                  className="pl-9 pr-9"
                  value={formData.transporterFair}
                  onChange={(e) => handleFormChange('transporterFair', e.target.value)}
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <FieldVoiceInput
                    fieldLabel="transporter fair"
                    onChange={(text) => handleFormChange('transporterFair', text.replace(/[^0-9.]/g, ''))}
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ds-remarks">Remarks</Label>
              <div className="relative">
                <Textarea id="ds-remarks" placeholder="Optional remarks..." value={formData.remarks} onChange={(e) => handleFormChange('remarks', e.target.value)} className="min-h-[80px] pr-9" />
                <div className="absolute right-1.5 top-2">
                  <FieldVoiceInput fieldLabel="remarks" onChange={(text) => handleFormChange('remarks', text)} />
                </div>
              </div>
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

      {/* Delete single confirmation */}
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

      {/* Delete All confirmation — simple Yes / No dialog (mirrors Production) */}
      <AlertDialog open={deleteAllOpen} onOpenChange={(open) => {
        if (!open && !deletingAll) setDeleteAllOpen(false)
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete ALL Daily Sell Entries?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <span className="block">
                You are about to permanently delete{' '}
                <strong className="text-destructive">all daily sell entries</strong>.
                This action <strong>cannot be undone</strong>.
              </span>
              <span className="block text-muted-foreground">
                All {dailySells.length} record{dailySells.length !== 1 ? 's' : ''} will be removed.
                Customer, Production, Order, Payment, and Dispatch records are NOT affected.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll} className="border-border">
              No, Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deletingAll && <Loader2 className="mr-2 size-4 animate-spin" />}
              Yes, Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Selected confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => {
        if (!open && !bulkDeleting) setBulkDeleteOpen(false)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Delete {selectedIds.size} Selected Daily Sell {selectedIds.size === 1 ? 'Entry' : 'Entries'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to permanently delete{' '}
              <strong className="text-destructive">{selectedIds.size}</strong>{' '}
              daily sell {selectedIds.size === 1 ? 'entry' : 'entries'}.
              This action <strong>cannot be undone</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {bulkDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExcelImport module="dailySell" open={importOpen} onClose={() => setImportOpen(false)} onSuccess={fetchData} />
    </div>
  )
}

export default DailySellModule
