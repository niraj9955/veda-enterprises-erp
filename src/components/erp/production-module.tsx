'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Search, RotateCcw, Factory } from 'lucide-react'

interface Production {
  id: string
  date: string
  brickType: string
  quantityProduced: number
  shift: string
  remarks: string
  createdAt: string
}

const BRICK_TYPES = ['Red Brick', 'Fly Ash Brick', 'Cement Brick', 'Hollow Block']
const SHIFTS = ['Morning', 'Evening', 'Night']

const SHIFT_COLORS: Record<string, string> = {
  Morning: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  Evening: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  Night: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface FormData {
  date: string
  brickType: string
  quantityProduced: string
  shift: string
  remarks: string
}

const emptyForm: FormData = {
  date: '',
  brickType: '',
  quantityProduced: '',
  shift: '',
  remarks: '',
}

export default function ProductionModule() {
  const [productions, setProductions] = useState<Production[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<FormData>(emptyForm)

  // Filters
  const [filterDate, setFilterDate] = useState('')
  const [filterBrickType, setFilterBrickType] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<{ date?: string; brickType?: string }>({})

  const fetchProductions = useCallback(async (filters?: { date?: string; brickType?: string }) => {
    setLoading(true)
    try {
      const res = await api.getProduction(filters)
      const prods = (res.productions as Production[]).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      setProductions(prods)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch production entries',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProductions()
  }, [fetchProductions])

  const handleApplyFilters = () => {
    const filters: { date?: string; brickType?: string } = {}
    if (filterDate) filters.date = filterDate
    if (filterBrickType) filters.brickType = filterBrickType
    setAppliedFilters(filters)
    fetchProductions(filters)
  }

  const handleResetFilters = () => {
    setFilterDate('')
    setFilterBrickType('')
    setAppliedFilters({})
    fetchProductions()
  }

  const openAddDialog = () => {
    setEditingId(null)
    setFormData(emptyForm)
    setDialogOpen(true)
  }

  const openEditDialog = (prod: Production) => {
    setEditingId(prod.id)
    setFormData({
      date: prod.date,
      brickType: prod.brickType,
      quantityProduced: String(prod.quantityProduced),
      shift: prod.shift,
      remarks: prod.remarks || '',
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this production entry?')) return
    try {
      await fetch(`/api/production/${id}`, { method: 'DELETE' })
      toast({ title: 'Success', description: 'Production entry deleted successfully' })
      fetchProductions(appliedFilters)
    } catch {
      toast({ title: 'Error', description: 'Failed to delete production entry', variant: 'destructive' })
    }
  }

  const handleSubmit = async () => {
    if (!formData.date || !formData.brickType || !formData.quantityProduced || !formData.shift) {
      toast({ title: 'Validation Error', description: 'Please fill all required fields', variant: 'destructive' })
      return
    }

    const quantity = Number(formData.quantityProduced)
    if (isNaN(quantity) || quantity <= 0) {
      toast({ title: 'Validation Error', description: 'Quantity must be a positive number', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        date: formData.date,
        brickType: formData.brickType,
        quantityProduced: quantity,
        shift: formData.shift,
        remarks: formData.remarks,
      }

      if (editingId) {
        await fetch(`/api/production/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        toast({ title: 'Success', description: 'Production entry updated successfully' })
      } else {
        await api.createProduction(payload)
        toast({ title: 'Success', description: 'Production entry created successfully' })
      }

      setDialogOpen(false)
      setFormData(emptyForm)
      setEditingId(null)
      fetchProductions(appliedFilters)
    } catch {
      toast({
        title: 'Error',
        description: editingId ? 'Failed to update production entry' : 'Failed to create production entry',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const totalQuantity = productions.reduce((sum, p) => sum + p.quantityProduced, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
            <Factory className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Production Management</h1>
            <p className="text-sm text-muted-foreground">Track daily brick production entries</p>
          </div>
        </div>
        <Button
          onClick={openAddDialog}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add Production Entry
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 min-w-0 space-y-1.5">
              <Label htmlFor="filter-date">Date</Label>
              <Input
                id="filter-date"
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <Label>Brick Type</Label>
              <Select value={filterBrickType} onValueChange={setFilterBrickType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  {BRICK_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleApplyFilters}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Search className="h-4 w-4" />
                Apply
              </Button>
              <Button variant="outline" onClick={handleResetFilters}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Production Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-24" />
                </div>
              ))}
            </div>
          ) : productions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Factory className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">No production entries found</h3>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {Object.keys(appliedFilters).length
                  ? 'Try adjusting your filters or reset them'
                  : 'Click "Add Production Entry" to create your first entry'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead>Brick Type</TableHead>
                    <TableHead className="text-right">Quantity Produced</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead className="hidden md:table-cell">Remarks</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productions.map((prod) => (
                    <TableRow key={prod.id}>
                      <TableCell className="font-medium">{formatDate(prod.date)}</TableCell>
                      <TableCell>{prod.brickType}</TableCell>
                      <TableCell className="text-right font-mono">
                        {prod.quantityProduced.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={SHIFT_COLORS[prod.shift] || ''}
                        >
                          {prod.shift}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px] truncate text-muted-foreground">
                        {prod.remarks || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                            onClick={() => openEditDialog(prod)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(prod.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10">
                    <TableCell colSpan={2} className="font-semibold text-emerald-700 dark:text-emerald-400">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {totalQuantity.toLocaleString()}
                    </TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              {editingId ? 'Edit Production Entry' : 'Add Production Entry'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the production entry details below.'
                : 'Fill in the details to create a new production entry.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="prod-date">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="prod-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>

            {/* Brick Type */}
            <div className="space-y-2">
              <Label>
                Brick Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.brickType}
                onValueChange={(val) => setFormData((prev) => ({ ...prev, brickType: val }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select brick type" />
                </SelectTrigger>
                <SelectContent>
                  {BRICK_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity Produced */}
            <div className="space-y-2">
              <Label htmlFor="prod-quantity">
                Quantity Produced <span className="text-destructive">*</span>
              </Label>
              <Input
                id="prod-quantity"
                type="number"
                min="1"
                placeholder="Enter quantity"
                value={formData.quantityProduced}
                onChange={(e) => setFormData((prev) => ({ ...prev, quantityProduced: e.target.value }))}
              />
            </div>

            {/* Shift */}
            <div className="space-y-2">
              <Label>
                Shift <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.shift}
                onValueChange={(val) => setFormData((prev) => ({ ...prev, shift: val }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  {SHIFTS.map((shift) => (
                    <SelectItem key={shift} value={shift}>
                      {shift}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Remarks */}
            <div className="space-y-2">
              <Label htmlFor="prod-remarks">Remarks</Label>
              <Textarea
                id="prod-remarks"
                placeholder="Optional notes about this production entry..."
                value={formData.remarks}
                onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? 'Saving...' : editingId ? 'Update Entry' : 'Create Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
