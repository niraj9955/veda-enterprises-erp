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
import { Mountain, Plus, Trash2, Pencil, Loader2, IndianRupee, Upload , Search} from 'lucide-react'
import ExcelImport from '@/components/erp/excel-import'
import { AiFillButton } from '@/components/ui/ai-fill-button'
import { FieldVoiceInput } from '@/components/ui/field-voice-input'
import { consumePendingAiResult } from '@/components/ui/ai-chat-widget'
import { isFormEmpty, showPleaseFillDataToast } from '@/lib/form-validation'
import { Checkbox } from '@/components/ui/checkbox'

interface DustPurchase {
  id: string
  date: string
  vendorName: string
  cementName: string
  quantity: number
  rate: number
  totalAmount: number
  paidAmount: number
  transportationCharge: number
  gst: number
  remarks: string
  createdAt: string
  updatedAt: string
}

interface DustPurchaseFormData {
  date: string
  vendorName: string
  cementName: string
  quantity: string
  rate: string
  paidAmount: string
  transportationCharge: string
  gst: string
  remarks: string
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)

const formatDate = (dateStr: string): string =>
  new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

const emptyForm: DustPurchaseFormData = { date: '', vendorName: '', cementName: '', quantity: '', rate: '', paidAmount: '', transportationCharge: '', gst: '', remarks: '' }

export function DustPurchaseModule() {
  const [items, setItems] = React.useState<DustPurchase[]>([])
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<DustPurchase | null>(null)
  const [formData, setFormData] = React.useState<DustPurchaseFormData>(emptyForm)
  const [formSubmitting, setFormSubmitting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<DustPurchase | null>(null)
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
      if (prev.size === filteredItems.length && filteredItems.length > 0) {
        return new Set()
      }
      return new Set(filteredItems.map((i) => i.id))
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkDeleting(true)
    try {
      const res = await api.bulkDeleteDustPurchases(ids)
      toast({
        title: 'Success',
        description: `${res.deletedCount} of ${ids.length} dust purchase entr${res.deletedCount === 1 ? 'y' : 'ies'} deleted`,
      })
      setBulkDeleteOpen(false)
      clearSelection()
      fetchData()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete selected entries',
        variant: 'destructive',
      })
    } finally {
      setBulkDeleting(false)
    }
  }

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getDustPurchases()
      const data = (res.dustPurchases as DustPurchase[]).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      setItems(data)
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to fetch data', variant: 'destructive' })
    } finally { setLoading(false) }
  }, [])

  // Debounced search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  // Client-side filter
  const filteredItems = React.useMemo(() => {
    if (!debouncedSearch.trim()) return items
    const q = debouncedSearch.toLowerCase()
    return items.filter((item: any) =>
      ['date', 'vendorName', 'cementName', 'remarks'].some((f) =>
        String((item as any)[f] ?? '').toLowerCase().includes(q)
      )
    )
  }, [items, debouncedSearch])

  React.useEffect(() => { fetchData() }, [fetchData])

  // Excel import

  const [importOpen, setImportOpen] = React.useState(false)


  const openAddDialog = () => {
    setEditingItem(null)
    setFormData(emptyForm)
    const pending = consumePendingAiResult('dustPurchase')
    if (pending) {
      setFormData((prev) => ({
        ...prev,
        date: pending.date ? String(pending.date).slice(0, 10) : prev.date,
        vendorName: pending.vendorName != null ? String(pending.vendorName) : prev.vendorName,
        cementName: pending.cementName != null ? String(pending.cementName) : prev.cementName,
        quantity: pending.quantity != null ? String(pending.quantity) : prev.quantity,
        rate: pending.rate != null ? String(pending.rate) : prev.rate,
        paidAmount: pending.paidAmount != null ? String(pending.paidAmount) : prev.paidAmount,
        transportationCharge: pending.transportationCharge != null ? String(pending.transportationCharge) : prev.transportationCharge,
        gst: pending.gst != null ? String(pending.gst) : prev.gst,
        remarks: pending.remarks != null ? String(pending.remarks) : prev.remarks,
      }))
    }
    setFormOpen(true)
  }
  const openEditDialog = (item: DustPurchase) => {
    setEditingItem(item)
    setFormData({
      date: item.date ? item.date.split('T')[0] : '',
      vendorName: item.vendorName || '',
      cementName: item.cementName || '',
      quantity: String(item.quantity || ''),
      rate: String(item.rate || ''),
      paidAmount: String(item.paidAmount || ''),
      transportationCharge: String(item.transportationCharge || ''),
      gst: String(item.gst || ''),
      remarks: item.remarks || '',
    })
    setFormOpen(true)
  }

  const handleFormChange = (field: keyof DustPurchaseFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // Auto-calculated
  const qty = Number(formData.quantity) || 0
  const rate = Number(formData.rate) || 0
  const totalAmount = qty * rate

  const handleSubmit = async () => {
    // Unified empty-form check — show ONE popup instead of cascading errors
    if (isFormEmpty([formData.date, formData.vendorName, formData.cementName, formData.quantity, formData.rate, formData.paidAmount, formData.transportationCharge, formData.gst, formData.remarks])) {
      toast(showPleaseFillDataToast())
      return
    }
    if (!formData.date) { toast({ title: 'Validation Error', description: 'Date is required', variant: 'destructive' }); return }
    if (!formData.vendorName.trim()) { toast({ title: 'Validation Error', description: 'Vendor name is required', variant: 'destructive' }); return }
    setFormSubmitting(true)
    try {
      const payload = {
        date: formData.date,
        vendorName: formData.vendorName.trim(),
        cementName: formData.cementName.trim(),
        quantity: qty,
        rate,
        totalAmount,
        paidAmount: Number(formData.paidAmount) || 0,
        transportationCharge: Number(formData.transportationCharge) || 0,
        gst: Number(formData.gst) || 0,
        remarks: formData.remarks.trim(),
      }
      if (editingItem) {
        await api.updateDustPurchase(editingItem.id, payload)
        toast({ title: 'Success', description: 'Dust purchase updated successfully' })
      } else {
        await api.createDustPurchase(payload)
        toast({ title: 'Success', description: 'Dust purchase created successfully' })
      }
      setFormOpen(false); setFormData(emptyForm); setEditingItem(null); fetchData()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save', variant: 'destructive' })
    } finally { setFormSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteDustPurchase(deleteTarget.id)
      toast({ title: 'Success', description: 'Dust purchase deleted successfully' })
      setDeleteTarget(null); fetchData()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete', variant: 'destructive' })
    } finally { setDeleting(false) }
  }

  const grandTotal = items.reduce((sum, i) => sum + (i.totalAmount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Full-screen loading overlay during bulk delete */}
      {bulkDeleting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4 min-w-[280px]">
            <Loader2 className="size-12 animate-spin text-emerald-600" />
            <div className="text-center">
              <p className="text-lg font-semibold">Deleting {selectedIds.size} entr{selectedIds.size === 1 ? 'y' : 'ies'}...</p>
              <p className="text-sm text-muted-foreground mt-1">Please wait while records are removed.</p>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Mountain className="size-5" /></div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Dust Purchase</h2>
            <p className="text-sm text-muted-foreground">Track dust/raw material purchases</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 w-full sm:hidden">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="w-full"><Upload className="size-4 mr-2" />Import Excel</Button>
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkDeleting || loading}
              className="w-full text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4 mr-2" />Delete Selected
              <Badge variant="secondary" className="ml-2 bg-destructive/10 text-destructive border-destructive/30">{selectedIds.size}</Badge>
            </Button>
          )}
          {selectedIds.size > 0 && (
            <Button variant="ghost" onClick={clearSelection} disabled={bulkDeleting} className="w-full">Clear Selection</Button>
          )}
          <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"><Plus className="size-4" />Add Purchase</Button>
        </div>
        <div className="hidden sm:flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="size-4 mr-2" />Import Excel</Button>
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkDeleting || loading}
              className="text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4 mr-2" />Delete Selected
              <Badge variant="secondary" className="ml-2 bg-destructive/10 text-destructive border-destructive/30">{selectedIds.size}</Badge>
            </Button>
          )}
          {selectedIds.size > 0 && (
            <Button variant="ghost" onClick={clearSelection} disabled={bulkDeleting}>Clear Selection</Button>
          )}
          <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="size-4" />Add Purchase</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-emerald-500"><CardContent className="p-2.5"><p className="text-xs text-muted-foreground">Total Purchase Value</p>{loading ? <Skeleton className="h-5 w-32 mt-0.5" /> : <p className="text-base font-bold text-emerald-700">{formatCurrency(grandTotal)}</p>}</CardContent></Card>
        <Card className="border-l-4 border-l-amber-500"><CardContent className="p-2.5"><p className="text-xs text-muted-foreground">Total Records</p>{loading ? <Skeleton className="h-5 w-16 mt-0.5" /> : <p className="text-base font-bold text-amber-700">{items.length}</p>}</CardContent></Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search across all fields (date, name, remarks, etc.)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Desktop: Table view */}
      <Card className="hidden sm:block">
        <CardHeader><CardTitle className="flex items-center justify-between"><span>Dust Purchase Records</span><div className="flex items-center gap-2">{selectedIds.size > 0 && <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/30">{selectedIds.size} selected</Badge>}<Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">{filteredItems.length} of {items.length} record{items.length !== 1 ? 's' : ''}</Badge></div></CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10"><TableRow><TableHead className="w-10"><Checkbox checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length} onCheckedChange={toggleSelectAll} aria-label="Select all rows" /></TableHead><TableHead>Date</TableHead><TableHead>Vendor Name</TableHead><TableHead>Cement Name</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Total (₹)</TableHead><TableHead className="text-right">Paid (₹)</TableHead><TableHead className="text-right">Transport (₹)</TableHead><TableHead className="text-right">GST (₹)</TableHead><TableHead>Remarks</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 12 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>)}</TableRow>)
                : filteredItems.length === 0 ? <TableRow><TableCell colSpan={12} className="h-32 text-center text-muted-foreground">No dust purchases yet. Click &quot;Add Purchase&quot; to get started.</TableCell></TableRow>
                : filteredItems.map((item) => (
                  <TableRow key={item.id} data-state={selectedIds.has(item.id) ? 'selected' : undefined} className={selectedIds.has(item.id) ? 'bg-emerald-50/60 dark:bg-emerald-900/15' : ''}>
                    <TableCell className="w-10"><Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} aria-label={`Select row for ${item.vendorName}`} /></TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{formatDate(item.date)}</TableCell>
                    <TableCell className="font-medium">{item.vendorName}</TableCell>
                    <TableCell>{item.cementName || '—'}</TableCell>
                    <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.rate)}</TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">{formatCurrency(item.totalAmount)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatCurrency(item.paidAmount)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatCurrency(item.transportationCharge)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatCurrency(item.gst)}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-muted-foreground">{item.remarks || '—'}</TableCell>
                    <TableCell className="text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} title="Edit"><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)} title="Delete" className="text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="size-4" /></Button></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile: Card list view */}
      <div className="sm:hidden space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
              onCheckedChange={toggleSelectAll}
              aria-label="Select all"
            />
            <h3 className="text-base font-semibold">Records</h3>
          </div>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">{filteredItems.length} of {items.length}</Badge>
        </div>
        {loading ? Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-4 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>)
        : filteredItems.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground">No dust purchases yet. Tap &quot;Add Purchase&quot; to get started.</CardContent></Card>
        : filteredItems.map((item) => (
          <Card key={item.id} data-state={selectedIds.has(item.id) ? 'selected' : undefined} className={selectedIds.has(item.id) ? 'border-destructive/40 bg-destructive/5' : ''}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} aria-label={`Select ${item.vendorName}`} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{item.vendorName}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                  </div>
                </div>
                <p className="font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(item.totalAmount)}</p>
              </div>
              {item.cementName && <p className="text-sm text-muted-foreground truncate"><span className="font-medium text-foreground">Cement:</span> {item.cementName}</p>}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-xs text-muted-foreground">Quantity</p><p className="font-medium">{item.quantity}</p></div>
                <div><p className="text-xs text-muted-foreground">Rate</p><p className="font-medium">{formatCurrency(item.rate)}</p></div>
                <div><p className="text-xs text-muted-foreground">Paid</p><p className="font-medium text-emerald-700">{formatCurrency(item.paidAmount)}</p></div>
                <div><p className="text-xs text-muted-foreground">Transport</p><p className="font-medium">{formatCurrency(item.transportationCharge)}</p></div>
                <div className="col-span-2"><p className="text-xs text-muted-foreground">GST</p><p className="font-medium">{formatCurrency(item.gst)}</p></div>
              </div>
              {item.remarks && <p className="text-sm text-muted-foreground truncate"><span className="font-medium text-foreground">Remarks:</span> {item.remarks}</p>}
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => openEditDialog(item)} className="h-8"><Pencil className="size-3.5 mr-1" />Edit</Button>
                <Button variant="outline" size="sm" onClick={() => setDeleteTarget(item)} className="h-8 text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3.5 mr-1" />Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? 'Edit Dust Purchase' : 'Add Dust Purchase'}</DialogTitle><DialogDescription>{editingItem ? 'Update the purchase details.' : 'Fill in the details to create a new dust purchase.'}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="dp-date">Date <span className="text-destructive">*</span></Label><Input id="dp-date" type="date" value={formData.date} onChange={(e) => handleFormChange('date', e.target.value)} /></div>
            {!editingItem && (
              <div className="flex justify-end">
                <AiFillButton module="dustPurchase" onApply={(fields) => setFormData((prev) => ({
                  ...prev,
                  date: fields.date ? String(fields.date).slice(0, 10) : prev.date,
                  vendorName: fields.vendorName != null ? String(fields.vendorName) : prev.vendorName,
                  cementName: fields.cementName != null ? String(fields.cementName) : prev.cementName,
                  quantity: fields.quantity != null ? String(fields.quantity) : prev.quantity,
                  rate: fields.rate != null ? String(fields.rate) : prev.rate,
                  paidAmount: fields.paidAmount != null ? String(fields.paidAmount) : prev.paidAmount,
                  transportationCharge: fields.transportationCharge != null ? String(fields.transportationCharge) : prev.transportationCharge,
                  gst: fields.gst != null ? String(fields.gst) : prev.gst,
                  remarks: fields.remarks != null ? String(fields.remarks) : prev.remarks,
                }))} />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2"><Label htmlFor="dp-vendor">Vendor Name <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input id="dp-vendor" placeholder="Enter vendor name" value={formData.vendorName} onChange={(e) => handleFormChange('vendorName', e.target.value)} className="pr-9" />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <FieldVoiceInput fieldLabel="vendor name" onChange={(text) => handleFormChange('vendorName', text)} />
                </div>
              </div>
            </div>
              <div className="grid gap-2"><Label htmlFor="dp-cement">Cement Name</Label>
                <div className="relative">
                  <Input id="dp-cement" placeholder="Enter cement name" value={formData.cementName} onChange={(e) => handleFormChange('cementName', e.target.value)} className="pr-9" />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                    <FieldVoiceInput fieldLabel="cement name" onChange={(text) => handleFormChange('cementName', text)} />
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label htmlFor="dp-qty">Quantity</Label><Input id="dp-qty" type="number" min="0" placeholder="0" value={formData.quantity} onChange={(e) => handleFormChange('quantity', e.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="dp-rate">Rate</Label><div className="relative"><IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input id="dp-rate" type="number" min="0" placeholder="0" className="pl-9" value={formData.rate} onChange={(e) => handleFormChange('rate', e.target.value)} /></div></div>
            </div>
            <div className="grid gap-2"><Label>Total Amount (₹)</Label><div className="h-10 flex items-center px-3 rounded-md border bg-muted/50 font-medium">{formatCurrency(totalAmount)}</div></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label htmlFor="dp-paid">Paid Amount (₹)</Label><div className="relative"><IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input id="dp-paid" type="number" min="0" placeholder="0" className="pl-9" value={formData.paidAmount} onChange={(e) => handleFormChange('paidAmount', e.target.value)} /></div></div>
              <div className="grid gap-2"><Label htmlFor="dp-transport">Transportation Charge (₹)</Label><div className="relative"><IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input id="dp-transport" type="number" min="0" placeholder="0" className="pl-9" value={formData.transportationCharge} onChange={(e) => handleFormChange('transportationCharge', e.target.value)} /></div></div>
            </div>
            <div className="grid gap-2"><Label htmlFor="dp-gst">GST (₹)</Label><div className="relative"><IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input id="dp-gst" type="number" min="0" placeholder="0" className="pl-9" value={formData.gst} onChange={(e) => handleFormChange('gst', e.target.value)} /></div></div>
            <div className="grid gap-2"><Label htmlFor="dp-remarks">Remarks</Label>
              <div className="relative">
                <Textarea id="dp-remarks" placeholder="Optional remarks..." value={formData.remarks} onChange={(e) => handleFormChange('remarks', e.target.value)} className="min-h-[80px] pr-9" />
                <div className="absolute right-1.5 top-2">
                  <FieldVoiceInput fieldLabel="remarks" onChange={(text) => handleFormChange('remarks', text)} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)} disabled={formSubmitting}>Cancel</Button><Button onClick={handleSubmit} disabled={formSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">{formSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}{editingItem ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Dust Purchase</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this purchase entry? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-white hover:bg-destructive/90">{deleting && <Loader2 className="mr-2 size-4 animate-spin" />}Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Selected confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!open && !bulkDeleting) setBulkDeleteOpen(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete {selectedIds.size} Selected Dust Purchase {selectedIds.size === 1 ? 'Entry' : 'Entries'}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <span className="block">You are about to permanently delete <strong className="text-destructive">{selectedIds.size} dust purchase {selectedIds.size === 1 ? 'entry' : 'entries'}</strong>. This action <strong>cannot be undone</strong>.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting || selectedIds.size === 0} className="bg-destructive text-white hover:bg-destructive/90">{bulkDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}Delete {selectedIds.size} {selectedIds.size === 1 ? 'Entry' : 'Entries'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExcelImport module="dustPurchase" open={importOpen} onClose={() => setImportOpen(false)} onSuccess={fetchData} />
    </div>
  )
}

export default DustPurchaseModule
