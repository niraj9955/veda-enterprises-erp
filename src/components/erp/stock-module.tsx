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
import { Package, Plus, Trash2, Pencil, Loader2 } from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────────────────

interface Stock {
  id: string
  date: string
  cement: number
  zigZagGrey80mm: number
  zigZagRed80mm: number
  zigZagYellow80mm: number
  zigZagGrey60mm: number
  zigZagRed60mm: number
  zigZagYellow60mm: number
  chequreTile: number
  curveStone: number
  dumbleGrey80mm: number
  dumbleRed80mm: number
  dumbleYellow80mm: number
  createdAt: string
  updatedAt: string
}

interface StockFormData {
  date: string
  cement: string
  zigZagGrey80mm: string
  zigZagRed80mm: string
  zigZagYellow80mm: string
  zigZagGrey60mm: string
  zigZagRed60mm: string
  zigZagYellow60mm: string
  chequreTile: string
  curveStone: string
  dumbleGrey80mm: string
  dumbleRed80mm: string
  dumbleYellow80mm: string
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
  zigZagGrey80mm: '',
  zigZagRed80mm: '',
  zigZagYellow80mm: '',
  zigZagGrey60mm: '',
  zigZagRed60mm: '',
  zigZagYellow60mm: '',
  chequreTile: '',
  curveStone: '',
  dumbleGrey80mm: '',
  dumbleRed80mm: '',
  dumbleYellow80mm: '',
}

const PRODUCT_FIELDS: { key: keyof StockFormData; label: string }[] = [
  { key: 'cement', label: 'Cement' },
  { key: 'zigZagGrey80mm', label: 'Zig Zag Grey 80mm' },
  { key: 'zigZagRed80mm', label: 'Zig Zag Red 80mm' },
  { key: 'zigZagYellow80mm', label: 'Zig Zag Yellow 80mm' },
  { key: 'zigZagGrey60mm', label: 'Zig Zag Grey 60mm' },
  { key: 'zigZagRed60mm', label: 'Zig Zag Red 60mm' },
  { key: 'zigZagYellow60mm', label: 'Zig Zag Yellow 60mm' },
  { key: 'chequreTile', label: 'Chequre Tile' },
  { key: 'curveStone', label: 'Curve Stone' },
  { key: 'dumbleGrey80mm', label: 'Dumble Grey 80mm' },
  { key: 'dumbleRed80mm', label: 'Dumble Red 80mm' },
  { key: 'dumbleYellow80mm', label: 'Dumble Yellow 80mm' },
]

// ── Component ───────────────────────────────────────────────────────────────

export function StockModule() {
  const [stocks, setStocks] = React.useState<Stock[]>([])
  const [loading, setLoading] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingStock, setEditingStock] = React.useState<Stock | null>(null)
  const [formData, setFormData] = React.useState<StockFormData>(emptyForm)
  const [formSubmitting, setFormSubmitting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Stock | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  // ── Fetch stocks ─────────────────────────────────────────────────────
  const fetchStocks = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getStock()
      const data = (res.stocks as Stock[]).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      setStocks(data)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to fetch stock data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchStocks()
  }, [fetchStocks])

  // ── Form handlers ───────────────────────────────────────────────────
  const openAddDialog = () => {
    setEditingStock(null)
    setFormData(emptyForm)
    setFormOpen(true)
  }

  const openEditDialog = (stock: Stock) => {
    setEditingStock(stock)
    setFormData({
      date: stock.date ? stock.date.split('T')[0] : '',
      cement: String(stock.cement || ''),
      zigZagGrey80mm: String(stock.zigZagGrey80mm || ''),
      zigZagRed80mm: String(stock.zigZagRed80mm || ''),
      zigZagYellow80mm: String(stock.zigZagYellow80mm || ''),
      zigZagGrey60mm: String(stock.zigZagGrey60mm || ''),
      zigZagRed60mm: String(stock.zigZagRed60mm || ''),
      zigZagYellow60mm: String(stock.zigZagYellow60mm || ''),
      chequreTile: String(stock.chequreTile || ''),
      curveStone: String(stock.curveStone || ''),
      dumbleGrey80mm: String(stock.dumbleGrey80mm || ''),
      dumbleRed80mm: String(stock.dumbleRed80mm || ''),
      dumbleYellow80mm: String(stock.dumbleYellow80mm || ''),
    })
    setFormOpen(true)
  }

  const handleFormChange = (field: keyof StockFormData, value: string) => {
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
        zigZagGrey80mm: Number(formData.zigZagGrey80mm) || 0,
        zigZagRed80mm: Number(formData.zigZagRed80mm) || 0,
        zigZagYellow80mm: Number(formData.zigZagYellow80mm) || 0,
        zigZagGrey60mm: Number(formData.zigZagGrey60mm) || 0,
        zigZagRed60mm: Number(formData.zigZagRed60mm) || 0,
        zigZagYellow60mm: Number(formData.zigZagYellow60mm) || 0,
        chequreTile: Number(formData.chequreTile) || 0,
        curveStone: Number(formData.curveStone) || 0,
        dumbleGrey80mm: Number(formData.dumbleGrey80mm) || 0,
        dumbleRed80mm: Number(formData.dumbleRed80mm) || 0,
        dumbleYellow80mm: Number(formData.dumbleYellow80mm) || 0,
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
      fetchStocks()
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

  // ── Delete handler ──────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteStock(deleteTarget.id)
      toast({ title: 'Success', description: 'Stock entry deleted successfully' })
      setDeleteTarget(null)
      fetchStocks()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete stock entry',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  // ── Render: Loading skeletons ───────────────────────────────────────
  const renderSkeletons = () =>
    Array.from({ length: 3 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        {PRODUCT_FIELDS.map((_, j) => (
          <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
        ))}
        <TableCell><Skeleton className="h-8 w-20" /></TableCell>
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
            <h2 className="text-2xl font-bold tracking-tight">Stock Management</h2>
            <p className="text-sm text-muted-foreground">
              Track product-wise stock levels
            </p>
          </div>
        </div>
        <Button
          onClick={openAddDialog}
          className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
        >
          <Plus className="size-4" />
          Add Stock Entry
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Stock Records</span>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
              {stocks.length} record{stocks.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10">Date</TableHead>
                  {PRODUCT_FIELDS.map((f) => (
                    <TableHead key={f.key} className="text-right whitespace-nowrap">{f.label}</TableHead>
                  ))}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  renderSkeletons()
                ) : stocks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={PRODUCT_FIELDS.length + 2} className="h-32 text-center text-muted-foreground">
                      No stock entries yet. Click &quot;Add Stock Entry&quot; to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  stocks.map((stock) => (
                    <TableRow key={stock.id}>
                      <TableCell className="font-medium whitespace-nowrap sticky left-0 bg-background z-10">
                        {formatDate(stock.date)}
                      </TableCell>
                      {PRODUCT_FIELDS.map((f) => (
                        <TableCell key={f.key} className="text-right font-mono">
                          {enIN.format((stock as unknown as Record<string, unknown>)[f.key] as number || 0)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(stock)}
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(stock)}
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
              {editingStock ? 'Edit Stock Entry' : 'Add Stock Entry'}
            </DialogTitle>
            <DialogDescription>
              {editingStock
                ? 'Update the stock entry details below.'
                : 'Fill in the product quantities for this date.'}
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
                  <Input
                    id={`stock-${f.key}`}
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData[f.key]}
                    onChange={(e) => handleFormChange(f.key, e.target.value)}
                  />
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stock Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this stock entry? This action cannot be undone.
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
    </div>
  )
}

export default StockModule
