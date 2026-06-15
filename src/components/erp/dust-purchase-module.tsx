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
import { Mountain, Plus, Trash2, Pencil, Loader2, IndianRupee } from 'lucide-react'

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
  const [loading, setLoading] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<DustPurchase | null>(null)
  const [formData, setFormData] = React.useState<DustPurchaseFormData>(emptyForm)
  const [formSubmitting, setFormSubmitting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<DustPurchase | null>(null)
  const [deleting, setDeleting] = React.useState(false)

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

  React.useEffect(() => { fetchData() }, [fetchData])

  const openAddDialog = () => { setEditingItem(null); setFormData(emptyForm); setFormOpen(true) }
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Mountain className="size-5" /></div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Dust Purchase</h2>
            <p className="text-sm text-muted-foreground">Track dust/raw material purchases</p>
          </div>
        </div>
        <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"><Plus className="size-4" />Add Purchase</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-emerald-500"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Purchase Value</p>{loading ? <Skeleton className="h-6 w-32 mt-1" /> : <p className="text-xl font-bold text-emerald-700">{formatCurrency(grandTotal)}</p>}</CardContent></Card>
        <Card className="border-l-4 border-l-amber-500"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Records</p>{loading ? <Skeleton className="h-6 w-16 mt-1" /> : <p className="text-xl font-bold text-amber-700">{items.length}</p>}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center justify-between"><span>Dust Purchase Records</span><Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">{items.length} record{items.length !== 1 ? 's' : ''}</Badge></CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Vendor Name</TableHead><TableHead>Cement Name</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Total (₹)</TableHead><TableHead className="text-right">Paid (₹)</TableHead><TableHead className="text-right">Transport (₹)</TableHead><TableHead className="text-right">GST (₹)</TableHead><TableHead>Remarks</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 11 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>)}</TableRow>)
                : items.length === 0 ? <TableRow><TableCell colSpan={11} className="h-32 text-center text-muted-foreground">No dust purchases yet. Click &quot;Add Purchase&quot; to get started.</TableCell></TableRow>
                : items.map((item) => (
                  <TableRow key={item.id}>
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? 'Edit Dust Purchase' : 'Add Dust Purchase'}</DialogTitle><DialogDescription>{editingItem ? 'Update the purchase details.' : 'Fill in the details to create a new dust purchase.'}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="dp-date">Date <span className="text-destructive">*</span></Label><Input id="dp-date" type="date" value={formData.date} onChange={(e) => handleFormChange('date', e.target.value)} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label htmlFor="dp-vendor">Vendor Name <span className="text-destructive">*</span></Label><Input id="dp-vendor" placeholder="Enter vendor name" value={formData.vendorName} onChange={(e) => handleFormChange('vendorName', e.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="dp-cement">Cement Name</Label><Input id="dp-cement" placeholder="Enter cement name" value={formData.cementName} onChange={(e) => handleFormChange('cementName', e.target.value)} /></div>
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
            <div className="grid gap-2"><Label htmlFor="dp-remarks">Remarks</Label><Textarea id="dp-remarks" placeholder="Optional remarks..." value={formData.remarks} onChange={(e) => handleFormChange('remarks', e.target.value)} className="min-h-[80px]" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)} disabled={formSubmitting}>Cancel</Button><Button onClick={handleSubmit} disabled={formSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">{formSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}{editingItem ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Dust Purchase</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this purchase entry? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-white hover:bg-destructive/90">{deleting && <Loader2 className="mr-2 size-4 animate-spin" />}Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default DustPurchaseModule
