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
import { Wrench, Plus, Trash2, Pencil, Loader2, IndianRupee, Upload , Search} from 'lucide-react'
import ExcelImport from '@/components/erp/excel-import'
import { AiFillButton } from '@/components/ui/ai-fill-button'
import { FieldVoiceInput } from '@/components/ui/field-voice-input'
import { consumePendingAiResult } from '@/components/ui/ai-chat-widget'
import { isFormEmpty, showPleaseFillDataToast } from '@/lib/form-validation'
import { Checkbox } from '@/components/ui/checkbox'

interface FactoryStuff {
  id: string
  date: string
  itemName: string
  quantity: number
  amount: number
  remarks: string
  createdAt: string
  updatedAt: string
}

interface FactoryStuffFormData {
  date: string
  itemName: string
  quantity: string
  amount: string
  remarks: string
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)

const formatDate = (dateStr: string): string =>
  new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

const enIN = new Intl.NumberFormat('en-IN')

const emptyForm: FactoryStuffFormData = { date: '', itemName: '', quantity: '', amount: '', remarks: '' }

export function FactoryStuffModule() {
  const [items, setItems] = React.useState<FactoryStuff[]>([])
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<FactoryStuff | null>(null)
  const [formData, setFormData] = React.useState<FactoryStuffFormData>(emptyForm)
  const [formSubmitting, setFormSubmitting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<FactoryStuff | null>(null)
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
      const res = await api.bulkDeleteFactoryStuffs(ids)
      toast({
        title: 'Success',
        description: `${res.deletedCount} of ${ids.length} factory stuff entr${res.deletedCount === 1 ? 'y' : 'ies'} deleted`,
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
      const res = await api.getFactoryStuffs()
      const data = (res.factoryStuffs as FactoryStuff[]).sort(
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
      ['date', 'itemName', 'remarks'].some((f) =>
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
    const pending = consumePendingAiResult('factoryStuff')
    if (pending) {
      setFormData((prev) => ({
        ...prev,
        date: pending.date ? String(pending.date).slice(0, 10) : prev.date,
        itemName: pending.itemName != null ? String(pending.itemName) : prev.itemName,
        quantity: pending.quantity != null ? String(pending.quantity) : prev.quantity,
        amount: pending.amount != null ? String(pending.amount) : prev.amount,
        remarks: pending.remarks != null ? String(pending.remarks) : prev.remarks,
      }))
    }
    setFormOpen(true)
  }
  const openEditDialog = (item: FactoryStuff) => {
    setEditingItem(item)
    setFormData({
      date: item.date ? item.date.split('T')[0] : '',
      itemName: item.itemName || '',
      quantity: String(item.quantity || ''),
      amount: String(item.amount || ''),
      remarks: item.remarks || '',
    })
    setFormOpen(true)
  }

  const handleFormChange = (field: keyof FactoryStuffFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    // Unified empty-form check — show ONE popup instead of cascading errors
    if (isFormEmpty([formData.date, formData.itemName, formData.quantity, formData.amount, formData.remarks])) {
      toast(showPleaseFillDataToast())
      return
    }
    if (!formData.date) { toast({ title: 'Validation Error', description: 'Date is required', variant: 'destructive' }); return }
    if (!formData.itemName.trim()) { toast({ title: 'Validation Error', description: 'Item name is required', variant: 'destructive' }); return }
    setFormSubmitting(true)
    try {
      const payload = { date: formData.date, itemName: formData.itemName.trim(), quantity: Number(formData.quantity) || 0, amount: Number(formData.amount) || 0, remarks: formData.remarks.trim() }
      if (editingItem) {
        await api.updateFactoryStuff(editingItem.id, payload)
        toast({ title: 'Success', description: 'Factory stuff entry updated successfully' })
      } else {
        await api.createFactoryStuff(payload)
        toast({ title: 'Success', description: 'Factory stuff entry created successfully' })
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
      await api.deleteFactoryStuff(deleteTarget.id)
      toast({ title: 'Success', description: 'Factory stuff entry deleted successfully' })
      setDeleteTarget(null); fetchData()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete', variant: 'destructive' })
    } finally { setDeleting(false) }
  }

  const totalAmount = items.reduce((sum, i) => sum + (i.amount || 0), 0)

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
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Wrench className="size-5" /></div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Factory Stuff</h2>
            <p className="text-sm text-muted-foreground">Track factory supplies and materials</p>
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
          <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"><Plus className="size-4" />Add Entry</Button>
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
          <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="size-4" />Add Entry</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-emerald-500"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Amount</p>{loading ? <Skeleton className="h-6 w-32 mt-1" /> : <p className="text-xl font-bold text-emerald-700">{formatCurrency(totalAmount)}</p>}</CardContent></Card>
        <Card className="border-l-4 border-l-amber-500"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Records</p>{loading ? <Skeleton className="h-6 w-16 mt-1" /> : <p className="text-xl font-bold text-amber-700">{items.length}</p>}</CardContent></Card>
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

      {/* Desktop: Table view */}
      <Card className="hidden sm:block">
        <CardHeader><CardTitle className="flex items-center justify-between"><span>Factory Stuff Records</span><div className="flex items-center gap-2">{selectedIds.size > 0 && <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/30">{selectedIds.size} selected</Badge>}<Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">{filteredItems.length} of {items.length} record{items.length !== 1 ? 's' : ''}</Badge></div></CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10"><TableRow><TableHead className="w-10"><Checkbox checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length} onCheckedChange={toggleSelectAll} aria-label="Select all rows" /></TableHead><TableHead>Date</TableHead><TableHead>Item Name</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Amount (₹)</TableHead><TableHead>Remarks</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>)}</TableRow>)
                : filteredItems.length === 0 ? <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No factory stuff entries yet. Click &quot;Add Entry&quot; to get started.</TableCell></TableRow>
                : filteredItems.map((item) => (
                  <TableRow key={item.id} data-state={selectedIds.has(item.id) ? 'selected' : undefined} className={selectedIds.has(item.id) ? 'bg-emerald-50/60 dark:bg-emerald-900/15' : ''}>
                    <TableCell className="w-10"><Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} aria-label={`Select row for ${item.itemName}`} /></TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{formatDate(item.date)}</TableCell>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell className="text-right font-mono">{enIN.format(item.quantity)}</TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">{formatCurrency(item.amount)}</TableCell>
                    <TableCell className="max-w-[150px] truncate text-muted-foreground">{item.remarks || '—'}</TableCell>
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
        : filteredItems.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground">No factory stuff entries yet. Tap &quot;Add Entry&quot; to get started.</CardContent></Card>
        : filteredItems.map((item) => (
          <Card key={item.id} data-state={selectedIds.has(item.id) ? 'selected' : undefined} className={selectedIds.has(item.id) ? 'border-destructive/40 bg-destructive/5' : ''}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} aria-label={`Select ${item.itemName}`} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{item.itemName}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                  </div>
                </div>
                <p className="font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(item.amount)}</p>
              </div>
              <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Quantity:</span> {enIN.format(item.quantity)}</p>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingItem ? 'Edit Factory Stuff Entry' : 'Add Factory Stuff Entry'}</DialogTitle><DialogDescription>{editingItem ? 'Update the factory stuff entry.' : 'Fill in the details to create a new factory stuff entry.'}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="fs-date">Date <span className="text-destructive">*</span></Label><Input id="fs-date" type="date" value={formData.date} onChange={(e) => handleFormChange('date', e.target.value)} /></div>
            {!editingItem && (
              <div className="flex justify-end">
                <AiFillButton module="factoryStuff" onApply={(fields) => setFormData((prev) => ({
                  ...prev,
                  date: fields.date ? String(fields.date).slice(0, 10) : prev.date,
                  itemName: fields.itemName != null ? String(fields.itemName) : prev.itemName,
                  quantity: fields.quantity != null ? String(fields.quantity) : prev.quantity,
                  amount: fields.amount != null ? String(fields.amount) : prev.amount,
                  remarks: fields.remarks != null ? String(fields.remarks) : prev.remarks,
                }))} />
              </div>
            )}
            <div className="grid gap-2"><Label htmlFor="fs-item">Item Name <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input id="fs-item" placeholder="Enter item name" value={formData.itemName} onChange={(e) => handleFormChange('itemName', e.target.value)} className="pr-9" />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <FieldVoiceInput fieldLabel="item name" onChange={(text) => handleFormChange('itemName', text)} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label htmlFor="fs-qty">Quantity</Label><Input id="fs-qty" type="number" min="0" placeholder="0" value={formData.quantity} onChange={(e) => handleFormChange('quantity', e.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="fs-amount">Amount (₹)</Label><div className="relative"><IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input id="fs-amount" type="number" min="0" placeholder="0" className="pl-9 pr-9" value={formData.amount} onChange={(e) => handleFormChange('amount', e.target.value)} />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <FieldVoiceInput fieldLabel="amount" onChange={(text) => handleFormChange('amount', text.replace(/[^0-9.]/g, ''))} />
                </div>
              </div></div>
            </div>
            <div className="grid gap-2"><Label htmlFor="fs-remarks">Remarks</Label>
              <div className="relative">
                <Textarea id="fs-remarks" placeholder="Optional remarks..." value={formData.remarks} onChange={(e) => handleFormChange('remarks', e.target.value)} className="min-h-[80px] pr-9" />
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
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Factory Stuff Entry</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this entry? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-white hover:bg-destructive/90">{deleting && <Loader2 className="mr-2 size-4 animate-spin" />}Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Selected confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!open && !bulkDeleting) setBulkDeleteOpen(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete {selectedIds.size} Selected Factory Stuff {selectedIds.size === 1 ? 'Entry' : 'Entries'}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <span className="block">You are about to permanently delete <strong className="text-destructive">{selectedIds.size} factory stuff {selectedIds.size === 1 ? 'entry' : 'entries'}</strong>. This action <strong>cannot be undone</strong>.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting || selectedIds.size === 0} className="bg-destructive text-white hover:bg-destructive/90">{bulkDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}Delete {selectedIds.size} {selectedIds.size === 1 ? 'Entry' : 'Entries'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExcelImport module="factoryStuff" open={importOpen} onClose={() => setImportOpen(false)} onSuccess={fetchData} />
    </div>
  )
}

export default FactoryStuffModule
