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
import { Construction, Plus, Trash2, Pencil, Loader2, IndianRupee, Upload , Search} from 'lucide-react'
import ExcelImport from '@/components/erp/excel-import'
import { AiFillButton } from '@/components/ui/ai-fill-button'
import { FieldVoiceInput } from '@/components/ui/field-voice-input'
import { consumePendingAiResult } from '@/components/ui/ai-chat-widget'
import { isFormEmpty, showPleaseFillDataToast } from '@/lib/form-validation'

interface CementPurchase {
  id: string
  date: string
  vendorName: string
  itemName: string
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

interface CementPurchaseFormData {
  date: string
  vendorName: string
  itemName: string
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

const emptyForm: CementPurchaseFormData = { date: '', vendorName: '', itemName: '', quantity: '', rate: '', paidAmount: '', transportationCharge: '', gst: '', remarks: '' }

export function CementPurchaseModule() {
  const [items, setItems] = React.useState<CementPurchase[]>([])
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<CementPurchase | null>(null)
  const [formData, setFormData] = React.useState<CementPurchaseFormData>(emptyForm)
  const [formSubmitting, setFormSubmitting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<CementPurchase | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getCementPurchases()
      const data = (res.cementPurchases as CementPurchase[]).sort(
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
      ['date', 'vendorName', 'itemName', 'remarks'].some((f) =>
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
    const pending = consumePendingAiResult('cementPurchase')
    if (pending) {
      setFormData((prev) => ({
        ...prev,
        date: pending.date ? String(pending.date).slice(0, 10) : prev.date,
        vendorName: pending.vendorName != null ? String(pending.vendorName) : prev.vendorName,
        itemName: pending.itemName != null ? String(pending.itemName) : prev.itemName,
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
  const openEditDialog = (item: CementPurchase) => {
    setEditingItem(item)
    setFormData({
      date: item.date ? item.date.split('T')[0] : '',
      vendorName: item.vendorName || '',
      itemName: item.itemName || '',
      quantity: String(item.quantity || ''),
      rate: String(item.rate || ''),
      paidAmount: String(item.paidAmount || ''),
      transportationCharge: String(item.transportationCharge || ''),
      gst: String(item.gst || ''),
      remarks: item.remarks || '',
    })
    setFormOpen(true)
  }

  const handleFormChange = (field: keyof CementPurchaseFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // Auto-calculated
  const qty = Number(formData.quantity) || 0
  const rate = Number(formData.rate) || 0
  const totalAmount = qty * rate

  const handleSubmit = async () => {
    // Unified empty-form check — show ONE popup instead of cascading errors
    if (isFormEmpty([formData.date, formData.vendorName, formData.itemName, formData.quantity, formData.rate, formData.paidAmount, formData.transportationCharge, formData.gst, formData.remarks])) {
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
        itemName: formData.itemName.trim(),
        quantity: qty,
        rate,
        totalAmount,
        paidAmount: Number(formData.paidAmount) || 0,
        transportationCharge: Number(formData.transportationCharge) || 0,
        gst: Number(formData.gst) || 0,
        remarks: formData.remarks.trim(),
      }
      if (editingItem) {
        await api.updateCementPurchase(editingItem.id, payload)
        toast({ title: 'Success', description: 'Cement purchase updated successfully' })
      } else {
        await api.createCementPurchase(payload)
        toast({ title: 'Success', description: 'Cement purchase created successfully' })
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
      await api.deleteCementPurchase(deleteTarget.id)
      toast({ title: 'Success', description: 'Cement purchase deleted successfully' })
      setDeleteTarget(null); fetchData()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete', variant: 'destructive' })
    } finally { setDeleting(false) }
  }

  const grandTotal = items.reduce((sum, i) => sum + (i.totalAmount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Construction className="size-5" /></div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Cement Purchase</h2>
            <p className="text-sm text-muted-foreground">Track cement and material purchases</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 w-full sm:hidden">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="w-full"><Upload className="size-4 mr-2" />Import Excel</Button>
          <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"><Plus className="size-4" />Add Purchase</Button>
        </div>
        <div className="hidden sm:flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="size-4 mr-2" />Import Excel</Button>
          <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="size-4" />Add Purchase</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-emerald-500"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Purchase Value</p>{loading ? <Skeleton className="h-6 w-32 mt-1" /> : <p className="text-xl font-bold text-emerald-700">{formatCurrency(grandTotal)}</p>}</CardContent></Card>
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
        <CardHeader><CardTitle className="flex items-center justify-between"><span>Cement Purchase Records</span><Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">{filteredItems.length} of {items.length} record{items.length !== 1 ? 's' : ''}</Badge></CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10"><TableRow><TableHead>Date</TableHead><TableHead>Vendor Name</TableHead><TableHead>Item Name</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Total (₹)</TableHead><TableHead className="text-right">Paid (₹)</TableHead><TableHead className="text-right">Transport (₹)</TableHead><TableHead className="text-right">GST (₹)</TableHead><TableHead>Remarks</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 11 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>)}</TableRow>)
                : filteredItems.length === 0 ? <TableRow><TableCell colSpan={11} className="h-32 text-center text-muted-foreground">No cement purchases yet. Click &quot;Add Purchase&quot; to get started.</TableCell></TableRow>
                : filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium whitespace-nowrap">{formatDate(item.date)}</TableCell>
                    <TableCell className="font-medium">{item.vendorName}</TableCell>
                    <TableCell>{item.itemName || '—'}</TableCell>
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
          <h3 className="text-base font-semibold">Records</h3>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">{filteredItems.length} of {items.length}</Badge>
        </div>
        {loading ? Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-4 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>)
        : filteredItems.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground">No cement purchases yet. Tap &quot;Add Purchase&quot; to get started.</CardContent></Card>
        : filteredItems.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{item.vendorName}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                </div>
                <p className="font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(item.totalAmount)}</p>
              </div>
              {item.itemName && <p className="text-sm text-muted-foreground truncate"><span className="font-medium text-foreground">Item:</span> {item.itemName}</p>}
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
          <DialogHeader><DialogTitle>{editingItem ? 'Edit Cement Purchase' : 'Add Cement Purchase'}</DialogTitle><DialogDescription>{editingItem ? 'Update the purchase details.' : 'Fill in the details to create a new cement purchase.'}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="cep-date">Date <span className="text-destructive">*</span></Label><Input id="cep-date" type="date" value={formData.date} onChange={(e) => handleFormChange('date', e.target.value)} /></div>
            {!editingItem && (
              <div className="flex justify-end">
                <AiFillButton module="cementPurchase" onApply={(fields) => setFormData((prev) => ({
                  ...prev,
                  date: fields.date ? String(fields.date).slice(0, 10) : prev.date,
                  vendorName: fields.vendorName != null ? String(fields.vendorName) : prev.vendorName,
                  itemName: fields.itemName != null ? String(fields.itemName) : prev.itemName,
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
            <div className="grid gap-2"><Label htmlFor="cep-vendor">Vendor Name <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input id="cep-vendor" placeholder="Enter vendor name" value={formData.vendorName} onChange={(e) => handleFormChange('vendorName', e.target.value)} className="pr-9" />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <FieldVoiceInput fieldLabel="vendor name" onChange={(text) => handleFormChange('vendorName', text)} />
                </div>
              </div>
            </div>
              <div className="grid gap-2"><Label htmlFor="cep-item">Item Name</Label>
                <div className="relative">
                  <Input id="cep-item" placeholder="Enter item name" value={formData.itemName} onChange={(e) => handleFormChange('itemName', e.target.value)} className="pr-9" />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                    <FieldVoiceInput fieldLabel="item name" onChange={(text) => handleFormChange('itemName', text)} />
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label htmlFor="cep-qty">Quantity</Label><Input id="cep-qty" type="number" min="0" placeholder="0" value={formData.quantity} onChange={(e) => handleFormChange('quantity', e.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="cep-rate">Rate</Label><div className="relative"><IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input id="cep-rate" type="number" min="0" placeholder="0" className="pl-9" value={formData.rate} onChange={(e) => handleFormChange('rate', e.target.value)} /></div></div>
            </div>
            <div className="grid gap-2"><Label>Total Amount (₹)</Label><div className="h-10 flex items-center px-3 rounded-md border bg-muted/50 font-medium">{formatCurrency(totalAmount)}</div></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label htmlFor="cep-paid">Paid Amount (₹)</Label><div className="relative"><IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input id="cep-paid" type="number" min="0" placeholder="0" className="pl-9" value={formData.paidAmount} onChange={(e) => handleFormChange('paidAmount', e.target.value)} /></div></div>
              <div className="grid gap-2"><Label htmlFor="cep-transport">Transportation Charge (₹)</Label><div className="relative"><IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input id="cep-transport" type="number" min="0" placeholder="0" className="pl-9" value={formData.transportationCharge} onChange={(e) => handleFormChange('transportationCharge', e.target.value)} /></div></div>
            </div>
            <div className="grid gap-2"><Label htmlFor="cep-gst">GST (₹)</Label><div className="relative"><IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input id="cep-gst" type="number" min="0" placeholder="0" className="pl-9" value={formData.gst} onChange={(e) => handleFormChange('gst', e.target.value)} /></div></div>
            <div className="grid gap-2"><Label htmlFor="cep-remarks">Remarks</Label>
              <div className="relative">
                <Textarea id="cep-remarks" placeholder="Optional remarks..." value={formData.remarks} onChange={(e) => handleFormChange('remarks', e.target.value)} className="min-h-[80px] pr-9" />
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
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Cement Purchase</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this purchase entry? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-white hover:bg-destructive/90">{deleting && <Loader2 className="mr-2 size-4 animate-spin" />}Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <ExcelImport module="cementPurchase" open={importOpen} onClose={() => setImportOpen(false)} onSuccess={fetchData} />
    </div>
  )
}

export default CementPurchaseModule
