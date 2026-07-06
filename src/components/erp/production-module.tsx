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
import { Factory, Plus, Trash2, Pencil, Loader2, IndianRupee, Upload , Search, Trash} from 'lucide-react'
import ExcelImport from '@/components/erp/excel-import'

// ── Types ───────────────────────────────────────────────────────────────────

interface Production {
  id: string
  date: string
  cement: number
  zigZagWhite80: number
  zigZagRed80: number
  zigZagYellow80: number
  zigZagWhite60: number
  zigZagRed60: number
  zigZagYellow60: number
  curveStone: number
  chequreTile: number
  transportationCharge: number
  remarks: string
  createdAt: string
  updatedAt: string
}

interface ProductionFormData {
  date: string
  cement: string
  zigZagWhite80: string
  zigZagRed80: string
  zigZagYellow80: string
  zigZagWhite60: string
  zigZagRed60: string
  zigZagYellow60: string
  curveStone: string
  chequreTile: string
  transportationCharge: string
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

const enIN = new Intl.NumberFormat('en-IN')

const emptyForm: ProductionFormData = {
  date: '',
  cement: '',
  zigZagWhite80: '',
  zigZagRed80: '',
  zigZagYellow80: '',
  zigZagWhite60: '',
  zigZagRed60: '',
  zigZagYellow60: '',
  curveStone: '',
  chequreTile: '',
  transportationCharge: '',
  remarks: '',
}

const PRODUCT_FIELDS: { key: keyof ProductionFormData; label: string }[] = [
  { key: 'zigZagWhite80', label: 'Zig Zag White 80mm' },
  { key: 'zigZagRed80', label: 'Zig Zag Red 80mm' },
  { key: 'zigZagYellow80', label: 'Zig Zag Yellow 80mm' },
  { key: 'zigZagWhite60', label: 'Zig Zag White 60mm' },
  { key: 'zigZagRed60', label: 'Zig Zag Red 60mm' },
  { key: 'zigZagYellow60', label: 'Zig Zag Yellow 60mm' },
  { key: 'curveStone', label: 'Curve Stone' },
  { key: 'chequreTile', label: 'Chequre Tile' },
]

// ── Component ───────────────────────────────────────────────────────────────

export function ProductionModule() {
  const [productions, setProductions] = React.useState<Production[]>([])
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingProduction, setEditingProduction] = React.useState<Production | null>(null)
  const [formData, setFormData] = React.useState<ProductionFormData>(emptyForm)
  const [formSubmitting, setFormSubmitting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Production | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [deleteAllOpen, setDeleteAllOpen] = React.useState(false)
  const [deletingAll, setDeletingAll] = React.useState(false)
  const [deleteAllConfirm, setDeleteAllConfirm] = React.useState('')

  const fetchProductions = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getProduction()
      const data = (res.productions as Production[]).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      setProductions(data)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to fetch production data',
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
  const filteredProductions = React.useMemo(() => {
    if (!debouncedSearch.trim()) return productions
    const q = debouncedSearch.toLowerCase()
    return productions.filter((item: any) =>
      ['date', 'remarks'].some((f) =>
        String((item as any)[f] ?? '').toLowerCase().includes(q)
      )
    )
  }, [productions, debouncedSearch])

  React.useEffect(() => {
    fetchProductions()
  }, [fetchProductions])

  // Excel import
  const [importOpen, setImportOpen] = React.useState(false)

  const openAddDialog = () => {
    setEditingProduction(null)
    setFormData(emptyForm)
    setFormOpen(true)
  }

  const openEditDialog = (prod: Production) => {
    setEditingProduction(prod)
    setFormData({
      date: prod.date ? prod.date.split('T')[0] : '',
      cement: String(prod.cement || ''),
      zigZagWhite80: String(prod.zigZagWhite80 || ''),
      zigZagRed80: String(prod.zigZagRed80 || ''),
      zigZagYellow80: String(prod.zigZagYellow80 || ''),
      zigZagWhite60: String(prod.zigZagWhite60 || ''),
      zigZagRed60: String(prod.zigZagRed60 || ''),
      zigZagYellow60: String(prod.zigZagYellow60 || ''),
      curveStone: String(prod.curveStone || ''),
      chequreTile: String(prod.chequreTile || ''),
      transportationCharge: String(prod.transportationCharge || ''),
      remarks: prod.remarks || '',
    })
    setFormOpen(true)
  }

  const handleFormChange = (field: keyof ProductionFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!formData.date) {
      toast({ title: 'Validation Error', description: 'Date is required', variant: 'destructive' })
      return
    }

    setFormSubmitting(true)
    try {
      const payload = {
        date: formData.date,
        cement: Number(formData.cement) || 0,
        zigZagWhite80: Number(formData.zigZagWhite80) || 0,
        zigZagRed80: Number(formData.zigZagRed80) || 0,
        zigZagYellow80: Number(formData.zigZagYellow80) || 0,
        zigZagWhite60: Number(formData.zigZagWhite60) || 0,
        zigZagRed60: Number(formData.zigZagRed60) || 0,
        zigZagYellow60: Number(formData.zigZagYellow60) || 0,
        curveStone: Number(formData.curveStone) || 0,
        chequreTile: Number(formData.chequreTile) || 0,
        transportationCharge: Number(formData.transportationCharge) || 0,
        remarks: formData.remarks.trim(),
      }

      if (editingProduction) {
        await api.updateProduction(editingProduction.id, payload)
        toast({ title: 'Success', description: 'Production entry updated successfully' })
      } else {
        await api.createProduction(payload)
        toast({ title: 'Success', description: 'Production entry created successfully' })
      }

      setFormOpen(false)
      setFormData(emptyForm)
      setEditingProduction(null)
      fetchProductions()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save production entry',
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
      await api.deleteProduction(deleteTarget.id)
      toast({ title: 'Success', description: 'Production entry deleted successfully' })
      setDeleteTarget(null)
      fetchProductions()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete production entry',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteAll = async () => {
    if (deleteAllConfirm !== 'DELETE ALL') return
    setDeletingAll(true)
    try {
      const res = await api.deleteAllProductions()
      toast({
        title: 'Success',
        description: `${res.deletedCount} production entr${res.deletedCount === 1 ? 'y' : 'ies'} deleted`,
      })
      setDeleteAllOpen(false)
      setDeleteAllConfirm('')
      fetchProductions()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete all production entries',
        variant: 'destructive',
      })
    } finally {
      setDeletingAll(false)
    }
  }

  const renderSkeletons = () =>
    Array.from({ length: 3 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        {PRODUCT_FIELDS.map((_, j) => (
          <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
        ))}
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
            <Factory className="size-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Production Management</h2>
            <p className="text-sm text-muted-foreground">
              Track daily paver block production entries
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
          <Button
            variant="outline"
            onClick={() => setDeleteAllOpen(true)}
            disabled={productions.length === 0 || loading}
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
            Add Production Entry
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
            <span>Production Records</span>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
              {filteredProductions.length} of {productions.length} record{productions.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10">Date</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Cement</TableHead>
                  {PRODUCT_FIELDS.map((f) => (
                    <TableHead key={f.key} className="text-right whitespace-nowrap">{f.label}</TableHead>
                  ))}
                  <TableHead className="text-right whitespace-nowrap">Transport ₹</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  renderSkeletons()
                ) : filteredProductions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={PRODUCT_FIELDS.length + 5} className="h-32 text-center text-muted-foreground">
                      No production entries yet. Click &quot;Add Production Entry&quot; to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProductions.map((prod) => (
                    <TableRow key={prod.id}>
                      <TableCell className="font-medium whitespace-nowrap sticky left-0 bg-background z-10">
                        {formatDate(prod.date)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {enIN.format(prod.cement || 0)}
                      </TableCell>
                      {PRODUCT_FIELDS.map((f) => (
                        <TableCell key={f.key} className="text-right font-mono">
                          {enIN.format((prod as unknown as Record<string, unknown>)[f.key] as number || 0)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right whitespace-nowrap">
                        {formatCurrency(prod.transportationCharge || 0)}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground">
                        {prod.remarks || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(prod)}
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(prod)}
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduction ? 'Edit Production Entry' : 'Add Production Entry'}
            </DialogTitle>
            <DialogDescription>
              {editingProduction
                ? 'Update the production entry details below.'
                : 'Fill in the details to create a new production entry.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="prod-date">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="prod-date"
                type="date"
                value={formData.date}
                onChange={(e) => handleFormChange('date', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prod-cement">Cement (bags)</Label>
              <Input
                id="prod-cement"
                type="number"
                min="0"
                placeholder="0"
                value={formData.cement}
                onChange={(e) => handleFormChange('cement', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PRODUCT_FIELDS.map((f) => (
                <div key={f.key} className="grid gap-2">
                  <Label htmlFor={`prod-${f.key}`}>{f.label}</Label>
                  <Input
                    id={`prod-${f.key}`}
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData[f.key]}
                    onChange={(e) => handleFormChange(f.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prod-transport">Transportation Charge (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="prod-transport"
                  type="number"
                  min="0"
                  placeholder="0"
                  className="pl-9"
                  value={formData.transportationCharge}
                  onChange={(e) => handleFormChange('transportationCharge', e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prod-remarks">Remarks</Label>
              <Textarea
                id="prod-remarks"
                placeholder="Optional remarks..."
                value={formData.remarks}
                onChange={(e) => handleFormChange('remarks', e.target.value)}
                className="min-h-[80px]"
              />
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
              {editingProduction ? 'Update Entry' : 'Create Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Production Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this production entry? This action cannot be undone.
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

      {/* Delete All confirmation */}
      <AlertDialog open={deleteAllOpen} onOpenChange={(open) => {
        if (!open) {
          setDeleteAllOpen(false)
          setDeleteAllConfirm('')
        }
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete ALL Production Entries?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <span className="block">
                You are about to permanently delete{' '}
                <strong className="text-destructive">{productions.length} production entr{productions.length === 1 ? 'y' : 'ies'}</strong>.
                This action <strong>cannot be undone</strong>.
              </span>
              <span className="block text-muted-foreground">
                Linked customer bill-history aggregations will lose their production totals.
                Customer, Order, Bill, Payment, Stock, and Dispatch records are NOT affected.
              </span>
              <span className="block font-medium">
                Type <code className="px-1 py-0.5 rounded bg-muted text-destructive font-mono text-xs">DELETE ALL</code> below to confirm:
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteAllConfirm}
            onChange={(e) => setDeleteAllConfirm(e.target.value)}
            placeholder="Type DELETE ALL to confirm"
            className="font-mono"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll} onClick={() => { setDeleteAllOpen(false); setDeleteAllConfirm('') }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deletingAll || deleteAllConfirm !== 'DELETE ALL'}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deletingAll && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExcelImport module="production" open={importOpen} onClose={() => setImportOpen(false)} onSuccess={fetchProductions} />
    </div>
  )
}

export default ProductionModule
