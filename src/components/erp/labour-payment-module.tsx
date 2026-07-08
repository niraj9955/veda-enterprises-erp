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
import { HardHat, Plus, Trash2, Pencil, Loader2, IndianRupee, Upload , Search} from 'lucide-react'
import ExcelImport from '@/components/erp/excel-import'
import { AiFillButton } from '@/components/ui/ai-fill-button'
import { FieldVoiceInput } from '@/components/ui/field-voice-input'
import { consumePendingAiResult } from '@/components/ui/ai-chat-widget'
import { isFormEmpty, showPleaseFillDataToast } from '@/lib/form-validation'

interface LabourPayment {
  id: string
  date: string
  name: string
  address: string
  amount: number
  remarks: string
  createdAt: string
  updatedAt: string
}

interface LabourPaymentFormData {
  date: string
  name: string
  address: string
  amount: string
  remarks: string
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)

const formatDate = (dateStr: string): string =>
  new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

const emptyForm: LabourPaymentFormData = { date: '', name: '', address: '', amount: '', remarks: '' }

export function LabourPaymentModule() {
  const [items, setItems] = React.useState<LabourPayment[]>([])
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<LabourPayment | null>(null)
  const [formData, setFormData] = React.useState<LabourPaymentFormData>(emptyForm)
  const [formSubmitting, setFormSubmitting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<LabourPayment | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getLabourPayments()
      const data = (res.labourPayments as LabourPayment[]).sort(
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
      ['date', 'name', 'address', 'remarks'].some((f) =>
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
    // Check if AI chat widget has a pending result for this module
    const pending = consumePendingAiResult('labourPayment')
    if (pending) {
      setFormData((prev) => ({
        ...prev,
        date: pending.date ? String(pending.date).slice(0, 10) : prev.date,
        name: pending.name != null ? String(pending.name) : prev.name,
        address: pending.address != null ? String(pending.address) : prev.address,
        amount: pending.amount != null ? String(pending.amount) : prev.amount,
        remarks: pending.remarks != null ? String(pending.remarks) : prev.remarks,
      }))
    }
    setFormOpen(true)
  }
  const openEditDialog = (item: LabourPayment) => {
    setEditingItem(item)
    setFormData({ date: item.date ? item.date.split('T')[0] : '', name: item.name || '', address: item.address || '', amount: String(item.amount || ''), remarks: item.remarks || '' })
    setFormOpen(true)
  }

  const handleFormChange = (field: keyof LabourPaymentFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    // Unified empty-form check — show ONE popup instead of cascading errors
    if (isFormEmpty([formData.date, formData.name, formData.address, formData.amount, formData.remarks])) {
      toast(showPleaseFillDataToast())
      return
    }
    if (!formData.date) { toast({ title: 'Validation Error', description: 'Date is required', variant: 'destructive' }); return }
    if (!formData.name.trim()) { toast({ title: 'Validation Error', description: 'Name is required', variant: 'destructive' }); return }
    setFormSubmitting(true)
    try {
      const payload = { date: formData.date, name: formData.name.trim(), address: formData.address.trim(), amount: Number(formData.amount) || 0, remarks: formData.remarks.trim() }
      if (editingItem) {
        await api.updateLabourPayment(editingItem.id, payload)
        toast({ title: 'Success', description: 'Labour payment updated successfully' })
      } else {
        await api.createLabourPayment(payload)
        toast({ title: 'Success', description: 'Labour payment created successfully' })
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
      await api.deleteLabourPayment(deleteTarget.id)
      toast({ title: 'Success', description: 'Labour payment deleted successfully' })
      setDeleteTarget(null); fetchData()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete', variant: 'destructive' })
    } finally { setDeleting(false) }
  }

  const totalAmount = items.reduce((sum, i) => sum + (i.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><HardHat className="size-5" /></div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Labour Payment</h2>
            <p className="text-sm text-muted-foreground">Track payments made to labourers</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="w-full sm:w-auto"><Upload className="size-4 mr-2" />Import Excel</Button>
          <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"><Plus className="size-4" />Add Payment</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-emerald-500"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Labour Payments</p>{loading ? <Skeleton className="h-6 w-32 mt-1" /> : <p className="text-xl font-bold text-emerald-700">{formatCurrency(totalAmount)}</p>}</CardContent></Card>
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
        <CardHeader><CardTitle className="flex items-center justify-between"><span>Labour Payment Records</span><Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">{filteredItems.length} of {items.length} record{items.length !== 1 ? 's' : ''}</Badge></CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10"><TableRow><TableHead>Date</TableHead><TableHead>Name</TableHead><TableHead>Address</TableHead><TableHead className="text-right">Amount (₹)</TableHead><TableHead>Remarks</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell><Skeleton className="h-4 w-24" /></TableCell><TableCell><Skeleton className="h-4 w-32" /></TableCell><TableCell><Skeleton className="h-4 w-28" /></TableCell><TableCell><Skeleton className="h-4 w-24" /></TableCell><TableCell><Skeleton className="h-4 w-20" /></TableCell><TableCell><Skeleton className="h-8 w-20" /></TableCell></TableRow>)
                : filteredItems.length === 0 ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No labour payments yet. Click &quot;Add Payment&quot; to get started.</TableCell></TableRow>
                : filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium whitespace-nowrap">{formatDate(item.date)}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="max-w-[150px] truncate text-muted-foreground">{item.address || '—'}</TableCell>
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
          <h3 className="text-base font-semibold">Records</h3>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">{filteredItems.length} of {items.length}</Badge>
        </div>
        {loading ? Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-4 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>)
        : filteredItems.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground">No labour payments yet. Tap &quot;Add Payment&quot; to get started.</CardContent></Card>
        : filteredItems.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                </div>
                <p className="font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(item.amount)}</p>
              </div>
              {item.address && <p className="text-sm text-muted-foreground truncate"><span className="font-medium text-foreground">Address:</span> {item.address}</p>}
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
          <DialogHeader><DialogTitle>{editingItem ? 'Edit Labour Payment' : 'Add Labour Payment'}</DialogTitle><DialogDescription>{editingItem ? 'Update the payment details.' : 'Fill in the details to create a new labour payment.'}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="lp-date">Date <span className="text-destructive">*</span></Label><Input id="lp-date" type="date" value={formData.date} onChange={(e) => handleFormChange('date', e.target.value)} /></div>
            {!editingItem && (
              <div className="flex justify-end">
                <AiFillButton module="labourPayment" onApply={(fields) => setFormData((prev) => ({
                  ...prev,
                  date: fields.date ? String(fields.date).slice(0, 10) : prev.date,
                  name: fields.name != null ? String(fields.name) : prev.name,
                  address: fields.address != null ? String(fields.address) : prev.address,
                  amount: fields.amount != null ? String(fields.amount) : prev.amount,
                  remarks: fields.remarks != null ? String(fields.remarks) : prev.remarks,
                }))} />
              </div>
            )}
            <div className="grid gap-2"><Label htmlFor="lp-name">Name <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input id="lp-name" placeholder="Enter name" value={formData.name} onChange={(e) => handleFormChange('name', e.target.value)} className="pr-9" />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <FieldVoiceInput fieldLabel="name" onChange={(text) => handleFormChange('name', text)} />
                </div>
              </div>
            </div>
            <div className="grid gap-2"><Label htmlFor="lp-address">Address</Label>
              <div className="relative">
                <Input id="lp-address" placeholder="Enter address" value={formData.address} onChange={(e) => handleFormChange('address', e.target.value)} className="pr-9" />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <FieldVoiceInput fieldLabel="address" onChange={(text) => handleFormChange('address', text)} />
                </div>
              </div>
            </div>
            <div className="grid gap-2"><Label htmlFor="lp-amount">Amount (₹)</Label><div className="relative"><IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input id="lp-amount" type="number" min="0" placeholder="0" className="pl-9 pr-9" value={formData.amount} onChange={(e) => handleFormChange('amount', e.target.value)} />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <FieldVoiceInput fieldLabel="amount" onChange={(text) => handleFormChange('amount', text.replace(/[^0-9.]/g, ''))} />
              </div>
            </div></div>
            <div className="grid gap-2"><Label htmlFor="lp-remarks">Remarks</Label>
              <div className="relative">
                <Textarea id="lp-remarks" placeholder="Optional remarks..." value={formData.remarks} onChange={(e) => handleFormChange('remarks', e.target.value)} className="min-h-[80px] pr-9" />
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
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Labour Payment</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this payment entry? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-white hover:bg-destructive/90">{deleting && <Loader2 className="mr-2 size-4 animate-spin" />}Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <ExcelImport module="labourPayment" open={importOpen} onClose={() => setImportOpen(false)} onSuccess={fetchData} />
    </div>
  )
}

export default LabourPaymentModule
