'use client'

import * as React from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Wallet,
  HardHat,
  Receipt,
  IndianRupee,
  Upload,
  Search,
} from 'lucide-react'
import ExcelImport from '@/components/erp/excel-import'
import { isFormEmpty, showPleaseFillDataToast } from '@/lib/form-validation'
import { Checkbox } from '@/components/ui/checkbox'

// ── Types ───────────────────────────────────────────────────────────────────

interface Expense {
  id: string
  category: string
  amount: number
  date: string
  description: string
  createdAt: string
}

interface ExpenseFormData {
  category: string
  amount: string
  date: string
  description: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = ['Labour', 'Coal', 'Diesel', 'Maintenance', 'Electricity'] as const

const CATEGORY_COLORS: Record<string, string> = {
  Labour: 'bg-amber-100 text-amber-800 border-amber-200',
  Coal: 'bg-gray-100 text-gray-800 border-gray-200',
  Diesel: 'bg-sky-100 text-sky-800 border-sky-200',
  Maintenance: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Electricity: 'bg-violet-100 text-violet-800 border-violet-200',
}

const EMPTY_FORM: ExpenseFormData = {
  category: '',
  amount: '',
  date: '',
  description: '',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)

const formatDate = (dateStr: string): string =>
  new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

function getDateFilter(dateFilter: string): string {
  const now = new Date()
  if (dateFilter === 'this-month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return `${start.toISOString().split('T')[0]},${end.toISOString().split('T')[0]}`
  }
  if (dateFilter === 'last-month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return `${start.toISOString().split('T')[0]},${end.toISOString().split('T')[0]}`
  }
  return ''
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ExpenseModule() {
  // State
  const [expenses, setExpenses] = React.useState<Expense[]>([])
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [categoryFilter, setCategoryFilter] = React.useState('all')
  const [dateFilter, setDateFilter] = React.useState('this-month')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingExpense, setEditingExpense] = React.useState<Expense | null>(null)
  const [form, setForm] = React.useState<ExpenseFormData>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  // Excel import
  const [importOpen, setImportOpen] = React.useState(false)

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
      if (prev.size === filteredExpenses.length && filteredExpenses.length > 0) {
        return new Set()
      }
      return new Set(filteredExpenses.map((i) => i.id))
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkDeleting(true)
    try {
      const res = await api.bulkDeleteExpenses(ids)
      toast({
        title: 'Success',
        description: `${res.deletedCount} of ${ids.length} expense${res.deletedCount === 1 ? '' : 's'} deleted`,
      })
      setBulkDeleteOpen(false)
      clearSelection()
      fetchExpenses()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete selected expenses',
        variant: 'destructive',
      })
    } finally {
      setBulkDeleting(false)
    }
  }

  // ── Fetch expenses ──────────────────────────────────────────────────────

  const fetchExpenses = React.useCallback(async () => {
    try {
      setLoading(true)
      const filters: { category?: string; date?: string } = {}
      if (categoryFilter && categoryFilter !== 'all') {
        filters.category = categoryFilter
      }
      const dateValue = getDateFilter(dateFilter)
      if (dateValue) {
        filters.date = dateValue
      }
      const data = await api.getExpenses(filters)
      const expenseList = (data.expenses as Expense[]) ?? []
      // Sort by date descending
      expenseList.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      setExpenses(expenseList)
    } catch {
      toast({ title: 'Error', description: 'Failed to load expenses', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, dateFilter])

  // Debounced search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  // Client-side filter
  const filteredExpenses = React.useMemo(() => {
    if (!debouncedSearch.trim()) return expenses
    const q = debouncedSearch.toLowerCase()
    return expenses.filter((item: any) =>
      ['date', 'category', 'description'].some((f) =>
        String((item as any)[f] ?? '').toLowerCase().includes(q)
      )
    )
  }, [expenses, debouncedSearch])

  React.useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  // ── Summary calculations ────────────────────────────────────────────────

  const totalThisMonth = React.useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    return expenses
      .filter((e) => {
        const d = new Date(e.date)
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear
      })
      .reduce((sum, e) => sum + e.amount, 0)
  }, [expenses])

  const labourCost = React.useMemo(
    () => expenses.filter((e) => e.category === 'Labour').reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  )

  const otherExpenses = React.useMemo(
    () => expenses.filter((e) => e.category !== 'Labour').reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  )

  // ── Dialog handlers ─────────────────────────────────────────────────────

  const openAddDialog = () => {
    setEditingExpense(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense)
    setForm({
      category: expense.category,
      amount: String(expense.amount),
      date: expense.date.split('T')[0],
      description: expense.description,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    // Unified empty-form check — show ONE popup instead of cascading errors
    if (isFormEmpty([form.category, form.amount, form.date, form.description])) {
      toast(showPleaseFillDataToast())
      return
    }
    // Validation
    if (!form.category) {
      toast({ title: 'Validation Error', description: 'Please select a category', variant: 'destructive' })
      return
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast({ title: 'Validation Error', description: 'Please enter a valid amount', variant: 'destructive' })
      return
    }
    if (!form.date) {
      toast({ title: 'Validation Error', description: 'Please select a date', variant: 'destructive' })
      return
    }

    const payload = {
      category: form.category,
      amount: Number(form.amount),
      date: form.date,
      description: form.description,
    }

    try {
      setSaving(true)
      if (editingExpense) {
        await api.updateExpense(editingExpense.id, payload)
        toast({ title: 'Success', description: 'Expense updated successfully' })
      } else {
        await api.createExpense(payload)
        toast({ title: 'Success', description: 'Expense added successfully' })
      }
      setDialogOpen(false)
      setForm(EMPTY_FORM)
      setEditingExpense(null)
      fetchExpenses()
    } catch {
      toast({
        title: 'Error',
        description: editingExpense ? 'Failed to update expense' : 'Failed to add expense',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // ── Delete handler ──────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      setDeleting(true)
      await api.deleteExpense(deleteId)
      toast({ title: 'Success', description: 'Expense deleted successfully' })
      setDeleteId(null)
      fetchExpenses()
    } catch {
      toast({ title: 'Error', description: 'Failed to delete expense', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Full-screen loading overlay during bulk delete */}
      {bulkDeleting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4 min-w-[280px]">
            <Loader2 className="size-12 animate-spin text-emerald-600" />
            <div className="text-center">
              <p className="text-lg font-semibold">Deleting {selectedIds.size} expense{selectedIds.size === 1 ? '' : 's'}...</p>
              <p className="text-sm text-muted-foreground mt-1">Please wait while records are removed.</p>
            </div>
          </div>
        </div>
      )}
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Expense Management</h2>
          <p className="text-muted-foreground text-sm">Track and manage all your business expenses</p>
        </div>
        <div className="flex flex-col gap-2 w-full sm:hidden">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            Import Excel
          </Button>
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkDeleting || loading}
              className="w-full text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />Delete Selected
              <Badge variant="secondary" className="ml-2 bg-destructive/10 text-destructive border-destructive/30">{selectedIds.size}</Badge>
            </Button>
          )}
          {selectedIds.size > 0 && (
            <Button variant="ghost" onClick={clearSelection} disabled={bulkDeleting} className="w-full">Clear Selection</Button>
          )}
          <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </div>
        <div className="hidden sm:flex sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import Excel
          </Button>
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkDeleting || loading}
              className="text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />Delete Selected
              <Badge variant="secondary" className="ml-2 bg-destructive/10 text-destructive border-destructive/30">{selectedIds.size}</Badge>
            </Button>
          )}
          {selectedIds.size > 0 && (
            <Button variant="ghost" onClick={clearSelection} disabled={bulkDeleting}>Clear Selection</Button>
          )}
          <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total This Month</CardTitle>
            <IndianRupee className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold">{formatCurrency(totalThisMonth)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Labour Cost</CardTitle>
            <HardHat className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold">{formatCurrency(labourCost)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Other Expenses</CardTitle>
            <Receipt className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold">{formatCurrency(otherExpenses)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Wallet className="text-muted-foreground h-4 w-4" />
          <span className="text-sm font-medium whitespace-nowrap">Filters:</span>
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by category, description, date..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-7 text-sm"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this-month">This Month</SelectItem>
            <SelectItem value="last-month">Last Month</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Expense Table ───────────────────────────────────────────────── */}
      <div className="rounded-md border max-h-[60vh] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={filteredExpenses.length > 0 && selectedIds.size === filteredExpenses.length} onCheckedChange={toggleSelectAll} aria-label="Select all rows" /></TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="hidden md:table-cell">Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-6" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="ml-auto h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="ml-auto h-5 w-20" /></TableCell>
                </TableRow>
              ))
            ) : filteredExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-12 text-center">
                  No expenses found. Click &quot;Add Expense&quot; to get started.
                </TableCell>
              </TableRow>
            ) : (
              filteredExpenses.map((expense) => (
                <TableRow key={expense.id} data-state={selectedIds.has(expense.id) ? 'selected' : undefined} className={selectedIds.has(expense.id) ? 'bg-emerald-50/60 dark:bg-emerald-900/15' : ''}>
                  <TableCell className="w-10"><Checkbox checked={selectedIds.has(expense.id)} onCheckedChange={() => toggleSelect(expense.id)} aria-label={`Select row for ${expense.category}`} /></TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={CATEGORY_COLORS[expense.category] ?? ''}
                    >
                      {expense.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(expense.amount)}
                  </TableCell>
                  <TableCell>{formatDate(expense.date)}</TableCell>
                  <TableCell className="hidden max-w-[200px] truncate md:table-cell">
                    {expense.description || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(expense)}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive h-8 w-8"
                        onClick={() => setDeleteId(expense.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Add / Edit Dialog ───────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
            <DialogDescription>
              {editingExpense
                ? 'Update the expense details below.'
                : 'Fill in the details to record a new expense.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Category */}
            <div className="grid gap-2">
              <Label htmlFor="expense-category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(val) => setForm((prev) => ({ ...prev, category: val }))}
              >
                <SelectTrigger id="expense-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="grid gap-2">
              <Label htmlFor="expense-amount">Amount (₹)</Label>
              <Input
                id="expense-amount"
                type="number"
                min="0"
                step="1"
                placeholder="Enter amount"
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              />
            </div>

            {/* Date */}
            <div className="grid gap-2">
              <Label htmlFor="expense-date">Date</Label>
              <Input
                id="expense-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="expense-description">Description</Label>
              <Textarea
                id="expense-description"
                placeholder="Enter description (optional)"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingExpense ? 'Update' : 'Add'} Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Selected confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!open && !bulkDeleting) setBulkDeleteOpen(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete {selectedIds.size} Selected {selectedIds.size === 1 ? 'Expense' : 'Expenses'}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <span className="block">You are about to permanently delete <strong className="text-destructive">{selectedIds.size} expense{selectedIds.size === 1 ? '' : 's'}</strong>. This action <strong>cannot be undone</strong>.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting || selectedIds.size === 0} className="bg-destructive text-white hover:bg-destructive/90">{bulkDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete {selectedIds.size} {selectedIds.size === 1 ? 'Expense' : 'Expenses'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExcelImport module="expenses" open={importOpen} onClose={() => setImportOpen(false)} onSuccess={fetchExpenses} />
    </div>
  )
}
