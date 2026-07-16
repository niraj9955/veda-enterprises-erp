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
import { Checkbox } from '@/components/ui/checkbox'
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
import { Package, Plus, Trash2, Pencil, Loader2, Upload, Search } from 'lucide-react'
import ExcelImport from '@/components/erp/excel-import'
import { FieldVoiceInput } from '@/components/ui/field-voice-input'
import { isFormEmpty, showPleaseFillDataToast } from '@/lib/form-validation'

// ── Types ───────────────────────────────────────────────────────────────────

interface Stock {
  id: string
  date: string
  cement: number
  zigZagGrey80: number
  zigZagRed80: number
  zigZagYellow80: number
  zigZagGrey60: number
  zigZagRed60: number
  zigZagYellow60: number
  chequreTile: number
  curveStone: number
  dumbleGrey80: number
  dumbleRed80: number
  dumbleYellow80: number
  createdAt: string
  updatedAt: string
}

interface StockSummaryItem {
  id: string
  key: string
  name: string
  totalProduction: number
  sellItem: number
  availableQuantity: number
  previousYearStock: number
  latestDate: string
  latestQuantity: number
  productionDays: number
}

interface StockFormData {
  date: string
  cement: string
  zigZagGrey80: string
  zigZagRed80: string
  zigZagYellow80: string
  zigZagGrey60: string
  zigZagRed60: string
  zigZagYellow60: string
  chequreTile: string
  curveStone: string
  dumbleGrey80: string
  dumbleRed80: string
  dumbleYellow80: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (dateStr: string): string =>
  new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

const enIN = new Intl.NumberFormat('en-IN')

const emptyForm: StockFormData = {
  date: '',
  cement: '',
  zigZagGrey80: '',
  zigZagRed80: '',
  zigZagYellow80: '',
  zigZagGrey60: '',
  zigZagRed60: '',
  zigZagYellow60: '',
  chequreTile: '',
  curveStone: '',
  dumbleGrey80: '',
  dumbleRed80: '',
  dumbleYellow80: '',
}

const PRODUCT_FIELDS: { key: keyof StockFormData; label: string }[] = [
  { key: 'cement', label: 'Cement' },
  { key: 'zigZagGrey80', label: 'Zig Zag Grey 80mm' },
  { key: 'zigZagRed80', label: 'Zig Zag Red 80mm' },
  { key: 'zigZagYellow80', label: 'Zig Zag Yellow 80mm' },
  { key: 'zigZagGrey60', label: 'Zig Zag Grey 60mm' },
  { key: 'zigZagRed60', label: 'Zig Zag Red 60mm' },
  { key: 'zigZagYellow60', label: 'Zig Zag Yellow 60mm' },
  { key: 'chequreTile', label: 'Chequre Tile' },
  { key: 'curveStone', label: 'Curve Stone' },
  { key: 'dumbleGrey80', label: 'Dumble Grey 80mm' },
  { key: 'dumbleRed80', label: 'Dumble Red 80mm' },
  { key: 'dumbleYellow80', label: 'Dumble Yellow 80mm' },
]

// ── Component ───────────────────────────────────────────────────────────────

export function StockModule() {
  // Summary view (item-wise aggregated rows) — primary view the user wants.
  const [summary, setSummary] = React.useState<StockSummaryItem[]>([])
  const [summaryLoading, setSummaryLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')

  // Multi-select for bulk delete (mirrors Production module pattern).
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false)
  const [bulkDeleting, setBulkDeleting] = React.useState(false)

  // Delete All (mirrors Production module pattern).
  const [deleteAllOpen, setDeleteAllOpen] = React.useState(false)
  const [deletingAll, setDeletingAll] = React.useState(false)

  // Add/Edit form (still uses per-date stock records under the hood).
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingStock, setEditingStock] = React.useState<Stock | null>(null)
  const [formData, setFormData] = React.useState<StockFormData>(emptyForm)
  const [formSubmitting, setFormSubmitting] = React.useState(false)

  // Excel import
  const [importOpen, setImportOpen] = React.useState(false)

  // ── Fetch summary (item-wise aggregated rows) ──────────────────────
  const fetchSummary = React.useCallback(async () => {
    setSummaryLoading(true)
    try {
      const res = await api.getStockSummary()
      setSummary(res.summary as StockSummaryItem[])
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to fetch stock summary',
        variant: 'destructive',
      })
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  // Debounced search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const filteredSummary = React.useMemo(() => {
    if (!debouncedSearch.trim()) return summary
    const q = debouncedSearch.toLowerCase()
    return summary.filter((item) => item.name.toLowerCase().includes(q))
  }, [summary, debouncedSearch])

  React.useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

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
      if (prev.size === filteredSummary.length) return new Set()
      return new Set(filteredSummary.map((s) => s.id))
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  // ── Bulk delete selected ───────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    setBulkDeleting(true)
    try {
      // NOTE: stock summary rows are aggregates — there is no per-item
      // DB record to delete. Bulk delete here clears the underlying
      // per-date stock records so the summary recomputes empty.
      // We fetch the underlying stock ids and pass them to bulkDeleteStocks.
      const stockRes = await api.getStock()
      const ids = (stockRes.stocks as Stock[]).map((s) => s.id)
      if (ids.length > 0) {
        await api.bulkDeleteStocks(ids)
      }
      toast({
        title: 'Success',
        description: `${ids.length} stock entr${ids.length === 1 ? 'y' : 'ies'} deleted. Summary refreshed.`,
      })
      setBulkDeleteOpen(false)
      clearSelection()
      fetchSummary()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete stock entries',
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
      const res = await api.deleteAllStocks()
      toast({
        title: 'Success',
        description: `${res.deletedCount} stock entr${res.deletedCount === 1 ? 'y' : 'ies'} deleted`,
      })
      setDeleteAllOpen(false)
      clearSelection()
      fetchSummary()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete all stock entries',
        variant: 'destructive',
      })
    } finally {
      setDeletingAll(false)
    }
  }

  // ── Add/Edit form handlers ─────────────────────────────────────────
  const openAddDialog = () => {
    setEditingStock(null)
    setFormData(emptyForm)
    setFormOpen(true)
  }

  const handleFormChange = (field: keyof StockFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    // Unified empty-form check — show ONE popup instead of cascading errors
    if (isFormEmpty([
      formData.date, formData.cement,
      formData.zigZagGrey80, formData.zigZagRed80, formData.zigZagYellow80,
      formData.zigZagGrey60, formData.zigZagRed60, formData.zigZagYellow60,
      formData.chequreTile, formData.curveStone,
      formData.dumbleGrey80, formData.dumbleRed80, formData.dumbleYellow80,
    ])) {
      toast(showPleaseFillDataToast())
      return
    }
    if (!formData.date) {
      toast({ title: 'Validation Error', description: 'Date is required', variant: 'destructive' })
      return
    }

    setFormSubmitting(true)
    try {
      const payload = {
        date: formData.date,
        cement: Number(formData.cement) || 0,
        zigZagGrey80: Number(formData.zigZagGrey80) || 0,
        zigZagRed80: Number(formData.zigZagRed80) || 0,
        zigZagYellow80: Number(formData.zigZagYellow80) || 0,
        zigZagGrey60: Number(formData.zigZagGrey60) || 0,
        zigZagRed60: Number(formData.zigZagRed60) || 0,
        zigZagYellow60: Number(formData.zigZagYellow60) || 0,
        chequreTile: Number(formData.chequreTile) || 0,
        curveStone: Number(formData.curveStone) || 0,
        dumbleGrey80: Number(formData.dumbleGrey80) || 0,
        dumbleRed80: Number(formData.dumbleRed80) || 0,
        dumbleYellow80: Number(formData.dumbleYellow80) || 0,
      }

      if (editingStock) {
        await api.updateStock(editingStock.id, payload)
        toast({ title: 'Success', description: 'Stock entry updated successfully' })
      } else {
        await api.createStock(payload)
        toast({ title: 'Success', description: 'Stock entry created successfully' })
      }

      setFormOpen(false)
      setFormData(emptyForm)
      setEditingStock(null)
      fetchSummary()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save stock entry',
        variant: 'destructive',
      })
    } finally {
      setFormSubmitting(false)
    }
  }

  // ── Render: Loading skeletons ──────────────────────────────────────
  const renderSkeletons = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-6" /></TableCell>
        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
        <TableCell className="text-right"><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell className="text-right"><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell className="text-right"><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell className="text-right"><Skeleton className="h-4 w-24" /></TableCell>
      </TableRow>
    ))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <Package className="size-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Stock Overview</h2>
            <p className="text-sm text-muted-foreground">
              Available = Total Production − Sell Item • Previous Year Stock = production before this year
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="w-full sm:w-auto"
          >
            <Upload className="size-4 mr-2" />
            Import Excel
          </Button>
          <Button
            onClick={openAddDialog}
            className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
          >
            <Plus className="size-4" />
            Add Stock Entry
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="py-1">
        <CardContent className="px-3 py-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by item name (e.g. 'cement', 'zig zag grey')..."
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
            <span>Stock Summary — Available Quantity, Sell, Production & Previous Year</span>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                  className="h-8"
                >
                  <Trash2 className="size-4 mr-1" />
                  Delete Selected ({selectedIds.size})
                </Button>
              )}
              {summary.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteAllOpen(true)}
                  className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="size-4 mr-1" />
                  Delete All
                </Button>
              )}
              {selectedIds.size > 0 && (
                <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/30">
                  {selectedIds.size} selected
                </Badge>
              )}
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                {filteredSummary.length} of {summary.length} item{summary.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Stock summary table — fits inside the card (no horizontal
              overflow). Vertical scroll only when there are many rows.
              We deliberately do NOT use ScrollableTable here because its
              `min-w-max` + sticky-left columns force the table wider than
              the card, which the user reported as "kata hua" (cut off). */}
          <div className="rounded-md border overflow-y-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        filteredSummary.length > 0 &&
                        selectedIds.size === filteredSummary.length
                      }
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all rows"
                    />
                  </TableHead>
                  <TableHead className="min-w-[140px]">Item Name</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Available Qty</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Sell Item</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Total Prod.</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Prev. Year</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryLoading ? (
                  renderSkeletons()
                ) : filteredSummary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No stock data yet. Production entries will auto-populate the summary.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSummary.map((item) => {
                    // Color-code Available Quantity so low/negative stock
                    // stands out at a glance. Red = negative (over-sold),
                    // amber = zero, emerald = healthy positive stock.
                    const avail = item.availableQuantity
                    const availClass =
                      avail < 0
                        ? 'text-red-600 dark:text-red-400 font-semibold'
                        : avail === 0
                        ? 'text-amber-600 dark:text-amber-400 font-semibold'
                        : 'text-emerald-700 dark:text-emerald-400 font-semibold'
                    return (
                    <TableRow
                      key={item.id}
                      data-state={selectedIds.has(item.id) ? 'selected' : undefined}
                      className={selectedIds.has(item.id) ? 'bg-emerald-50/60 dark:bg-emerald-900/15' : ''}
                    >
                      <TableCell className="w-10">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                          aria-label={`Select ${item.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.name}
                      </TableCell>
                      <TableCell className={`text-right font-mono tabular-nums ${availClass}`}>
                        {enIN.format(item.availableQuantity)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                        {enIN.format(item.sellItem)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {enIN.format(item.totalProduction)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                        {enIN.format(item.previousYearStock)}
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStock ? 'Edit Stock Entry' : 'Add Stock Entry'}
            </DialogTitle>
            <DialogDescription>
              {editingStock
                ? 'Update the stock entry details below.'
                : 'Fill in the product quantities for this date. Stock Overview will auto-refresh.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="stock-date">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="stock-date"
                type="date"
                value={formData.date}
                onChange={(e) => handleFormChange('date', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PRODUCT_FIELDS.map((f) => (
                <div key={f.key} className="grid gap-2">
                  <Label htmlFor={`stock-${f.key}`}>{f.label}</Label>
                  <div className="relative">
                    <Input
                      id={`stock-${f.key}`}
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData[f.key]}
                      onChange={(e) => handleFormChange(f.key, e.target.value)}
                      className="pr-10"
                    />
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                      <FieldVoiceInput
                        fieldLabel={f.label}
                        onChange={(text) => handleFormChange(f.key, text.replace(/[^0-9.]/g, ''))}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={formSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={formSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {formSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingStock ? 'Update Entry' : 'Create Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All confirmation — simple Yes / No dialog (mirrors Production) */}
      <AlertDialog open={deleteAllOpen} onOpenChange={(open) => {
        if (!open && !deletingAll) setDeleteAllOpen(false)
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete ALL Stock Entries?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <span className="block">
                You are about to permanently delete{' '}
                <strong className="text-destructive">all stock entries</strong>.
                This action <strong>cannot be undone</strong>.
              </span>
              <span className="block text-muted-foreground">
                Stock Overview summary will refresh to show all zeros after deletion.
                Production, Customer, Order, Payment, and Dispatch records are NOT affected.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deletingAll}
              className="border-border"
            >
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
              Delete All Stock Records?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <span className="block">
                You are about to permanently delete{' '}
                <strong className="text-destructive">all underlying stock records</strong>{' '}
                that feed this summary.
                This action <strong>cannot be undone</strong>.
              </span>
              <span className="block text-muted-foreground">
                The Stock Overview summary will refresh to show all zeros after deletion.
              </span>
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
              Delete Records
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExcelImport module="stock" open={importOpen} onClose={() => setImportOpen(false)} onSuccess={fetchSummary} />
    </div>
  )
}

export default StockModule
