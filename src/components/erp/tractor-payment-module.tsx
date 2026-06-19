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
import { Truck, Plus, Trash2, Pencil, Loader2, IndianRupee, Upload } from 'lucide-react'
import ExcelImport from '@/components/erp/excel-import'

interface TractorPayment {
  id: string
  date: string
  vendorName: string
  quantityTon: number
  rate: number
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  remarks: string
  createdAt: string
  updatedAt: string
}

interface TractorPaymentFormData {
  date: string
  vendorName: string
  quantityTon: string
  rate: string
  paidAmount: string
  remarks: string
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)

const formatDate = (dateStr: string): string =>
  new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

const emptyForm: TractorPaymentFormData = { date: '', vendorName: '', quantityTon: '', rate: '', paidAmount: '', remarks: '' }

export function TractorPaymentModule() {
  const [items, setItems] = React.useState<TractorPayment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<TractorPayment | null>(null)
  const [formData, setFormData] = React.useState<TractorPaymentFormData>(emptyForm)
  const [formSubmitting, setFormSubmitting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<TractorPayment | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getTractorPayments()
      const data = (res.tractorPayments as TractorPayment[]).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      setItems(data)
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to fetch data', variant: 'destructive' })
    } finally { setLoading(false) }
  }, [])

  React.useEffect(() => { fetchData() }, [fetchData])

  // Excel import

  const [importOpen, setImportOpen] = React.useState(false)


  const openAddDialog = () => { setEditingItem(null); setFormData(emptyForm); setFormOpen(true) }
  const openEditDialog = (item: TractorPayment) => {
    setEditingItem(item)
    setFormData({
      date: item.date ? item.date.split('T')[0] : '',
      vendorName: item.vendorName || '',
      quantityTon: String(item.quantityTon || ''),
      rate: String(item.rate || ''),
      paidAmount: String(item.paidAmount || ''),
      remarks: item.remarks || '',
    })
    setFormOpen(true)
  }

  const handleFormChange = (field: keyof TractorPaymentFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // Auto-calculated values
  const qty = Number(formData.quantityTon) || 0
  const rate = Number(formData.rate) || 0
  const totalAmount = qty * rate
  const paidAmount = Number(formData.paidAmount) || 0
  const remainingAmount = totalAmount - paidAmount

  const handleSubmit = async () => {
    if (!formData.date) { toast({ title: 'Validation Error', description: 'Date is required', variant: 'destructive' }); return }
    if (!formData.vendorName.trim()) { toast({ title: 'Validation Error', description: 'Vendor name is required', variant: 'destructive' }); return }
    setFormSubmitting(true)
    try {
      const payload = {
        date: formData.date,
        vendorName: formData.vendorName.trim(),
        quantityTon: qty,
        rate,
        totalAmount,
        paidAmount,
        remainingAmount,
        remarks: formData.remarks.trim(),
      }
      if (editingItem) {
        await api.updateTractorPayment(editingItem.id, payload)
        toast({ title: 'Success', description: 'Tractor payment updated successfully' })
      } else {
        await api.createTractorPayment(payload)
        toast({ title: 'Success', description: 'Tractor payment created successfully' })
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
      await api.deleteTractorPayment(deleteTarget.id)
      toast({ title: 'Success', description: 'Tractor payment deleted successfully' })
      setDeleteTarget(null); fetchData()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete', variant: 'destructive' })
    } finally { setDeleting(false) }
  }

  const grandTotal = items.reduce((sum, i) => sum + (i.totalAmount || 0), 0)
  const grandPaid = items.reduce((sum, i) => sum + (i.paidAmount || 0), 0)
  const grandRemaining = items.reduce((sum, i) => sum + (i.remainingAmount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Truck className="size-5" /></div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Tractor Payment</h2>
            <p className="text-sm text-muted-foreground">Track tractor vendor payments and dues</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="w-full sm:w-auto"><Upload className="size-4 mr-2" />Import Excel</Button>
          <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"><Plus className="size-4" />Add Payment</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-emerald-500"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Amount</p>{loading ? <Skeleton className="h-6 w-32 mt-1" /> : <p className="text-xl font-bold text-emerald-700">{formatCurrency(grandTotal)}</p>}</CardContent></Card>
        <Card className="border-l-4 border-l-amber-500"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Paid</p>{loading ? <Skeleton className="h-6 w-32 mt-1" /> : <p className="text-xl font-bold text-amber-700">{formatCurrency(grandPaid)}</p>}</CardContent></Card>
        <Card className="border-l-4 border-l-rose-500"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Remaining</p>{loading ? <Skeleton className="h-6 w-32 mt-1" /> : <p className="text-xl font-bold text-rose-700">{formatCurrency(grandRemaining)}</p>}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center justify-between"><span>Tractor Payment Records</span><Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">{items.length} record{items.length !== 1 ? 's' : ''}</Badge></CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Vendor Name</TableHead><TableHead className="text-right">Qty (Ton)</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Total (₹)</TableHead><TableHead className="text-right">Paid (₹)</TableHead><TableHead className="text-right">Remaining (₹)</TableHead><TableHead>Remarks</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 9 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>)
                : items.length === 0 ? <TableRow><TableCell colSpan={9} className="h-32 text-center text-muted-foreground">No tractor payments yet. Click &quot;Add Payment&quot; to get started.</TableCell></TableRow>
                : items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium whitespace-nowrap">{formatDate(item.date)}</TableCell>
                    <TableCell className="font-medium">{item.vendorName}</TableCell>
                    <TableCell className="text-right font-mono">{item.quantityTon}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.rate)}</TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">{formatCurrency(item.totalAmount)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap text-emerald-700">{formatCurrency(item.paidAmount)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap font-medium text-rose-700">{formatCurrency(item.remainingAmount)}</TableCell>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingItem ? 'Edit Tractor Payment' : 'Add Tractor Payment'}</DialogTitle><DialogDescription>{editingItem ? 'Update the payment details.' : 'Fill in the details to create a new tractor payment.'}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="tp-date">Date <span className="text-destructive">*</span></Label><Input id="tp-date" type="date" value={formData.date} onChange={(e) => handleFormChange('date', e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="tp-vendor">Vendor Name <span className="text-destructive">*</span></Label><Input id="tp-vendor" placeholder="Enter vendor name" value={formData.vendorName} onChange={(e) => handleFormChange('vendorName', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label htmlFor="tp-qty">Quantity (Ton)</Label><Input id="tp-qty" type="number" min="0" step="0.01" placeholder="0" value={formData.quantityTon} onChange={(e) => handleFormChange('quantityTon', e.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="tp-rate">Rate</Label><div className="relative"><IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input id="tp-rate" type="number" min="0" placeholder="0" className="pl-9" value={formData.rate} onChange={(e) => handleFormChange('rate', e.target.value)} /></div></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Total Amount (₹)</Label><div className="h-10 flex items-center px-3 rounded-md border bg-muted/50 font-medium">{formatCurrency(totalAmount)}</div></div>
              <div className="grid gap-2"><Label>Remaining (₹)</Label><div className={`h-10 flex items-center px-3 rounded-md border font-medium ${remainingAmount > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{formatCurrency(remainingAmount)}</div></div>
            </div>
            <div className="grid gap-2"><Label htmlFor="tp-paid">Paid Amount (₹)</Label><div className="relative"><IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input id="tp-paid" type="number" min="0" placeholder="0" className="pl-9" value={formData.paidAmount} onChange={(e) => handleFormChange('paidAmount', e.target.value)} /></div></div>
            <div className="grid gap-2"><Label htmlFor="tp-remarks">Remarks</Label><Textarea id="tp-remarks" placeholder="Optional remarks..." value={formData.remarks} onChange={(e) => handleFormChange('remarks', e.target.value)} className="min-h-[80px]" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)} disabled={formSubmitting}>Cancel</Button><Button onClick={handleSubmit} disabled={formSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">{formSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}{editingItem ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Tractor Payment</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this payment entry? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-white hover:bg-destructive/90">{deleting && <Loader2 className="mr-2 size-4 animate-spin" />}Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <ExcelImport module="tractorPayment" open={importOpen} onClose={() => setImportOpen(false)} onSuccess={fetchData} />
    </div>
  )
}

export default TractorPaymentModule
