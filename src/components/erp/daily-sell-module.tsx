'use client'

import * as React from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollableTable } from '@/components/ui/scrollable-table'
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
import { ShoppingCart, Plus, Trash2, Pencil, Loader2, Upload, Search, Trash, RefreshCw, CheckCircle2, X, Save, AlertTriangle, Filter, Calendar, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import ExcelImport from '@/components/erp/excel-import'
import { AiFillButton } from '@/components/ui/ai-fill-button'
import { consumePendingAiResult } from '@/components/ui/ai-chat-widget'
import { isFormEmpty, showPleaseFillDataToast } from '@/lib/form-validation'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ── Product list (single source of truth — matches Stock Overview items) ──
// Each product key matches the `name` field returned by /api/stock/summary so
// we can look up the live available-quantity for each item and show it next
// to the product name in the dropdown (e.g. "Cement (Avail: 1,234)").
const PRODUCT_ITEMS: { key: string; label: string }[] = [
  { key: 'Cement', label: 'Cement' },
  { key: 'Zig Zag Grey 80mm', label: 'Zig Zag Grey 80mm' },
  { key: 'Zig Zag Red 80mm', label: 'Zig Zag Red 80mm' },
  { key: 'Zig Zag Yellow 80mm', label: 'Zig Zag Yellow 80mm' },
  { key: 'Zig Zag Grey 60mm', label: 'Zig Zag Grey 60mm' },
  { key: 'Zig Zag Red 60mm', label: 'Zig Zag Red 60mm' },
  { key: 'Zig Zag Yellow 60mm', label: 'Zig Zag Yellow 60mm' },
  { key: 'Chequre Tile', label: 'Chequre Tile' },
  { key: 'Curve Stone', label: 'Curve Stone' },
  { key: 'Dumble Grey 80mm', label: 'Dumble Grey 80mm' },
  { key: 'Dumble Red 80mm', label: 'Dumble Red 80mm' },
  { key: 'Dumble Yellow 80mm', label: 'Dumble Yellow 80mm' },
]

// ── Stock summary type ─────────────────────────────────────────────────────
// Matches the shape returned by /api/stock/summary. Only the fields we use
// for display are typed — the rest are ignored.
interface StockSummaryItem {
  id: string
  key: string
  name: string
  totalProduction: number
  sellItem: number
  availableQuantity: number
}

// ── Types ───────────────────────────────────────────────────────────────────

interface DailySell {
  id: string
  date: string
  customerName: string
  address: string
  contactNumber: string
  product: string
  quantity: number
  rate?: number
  amount: number
  transporterName?: string
  transporterFair?: number
  receivedAmount?: number
  pendingAmount?: number
  remarks: string
  customerId?: string | null
  orderId?: string | null
  customerPaymentId?: string | null
  syncNotes?: string
  createdAt: string
  updatedAt: string
}

interface DailySellFormData {
  date: string
  customerName: string
  address: string
  contactNumber: string
  product: string
  quantity: string
  rate: string
  amount: string
  transporterName: string
  transporterFair: string
  receivedAmount: string
  pendingAmount: string
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

const emptyForm: DailySellFormData = {
  date: '',
  customerName: '',
  address: '',
  contactNumber: '',
  product: '',
  quantity: '',
  rate: '',
  amount: '',
  transporterName: '',
  transporterFair: '',
  receivedAmount: '',
  pendingAmount: '',
  remarks: '',
}

// ── Reusable inline cell input ──────────────────────────────────────────────
// Small text/number Input that fits inside a table cell. Memoized so the
// entire table doesn't re-render on every keystroke.

const CellInput = React.memo(function CellInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  min,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  min?: string
  className?: string
}) {
  return (
    <Input
      type={type}
      min={min}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className ?? 'h-8 text-xs px-2 min-w-[80px]'}
    />
  )
})

// ── Component ───────────────────────────────────────────────────────────────

export function DailySellModule() {
  const [dailySells, setDailySells] = React.useState<DailySell[]>([])
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [loading, setLoading] = React.useState(true)

  // ── Advanced filter state ───────────────────────────────────────────
  // Lets the user narrow records by date range, product, customer, payment
  // status, and sync status — independent of the free-text search box.
  const [showFilters, setShowFilters] = React.useState(false)
  const [filterDateFrom, setFilterDateFrom] = React.useState('')
  const [filterDateTo, setFilterDateTo] = React.useState('')
  const [filterProduct, setFilterProduct] = React.useState<string>('__all__')
  const [filterCustomer, setFilterCustomer] = React.useState<string>('__all__')
  const [filterPaymentStatus, setFilterPaymentStatus] = React.useState<string>('__all__')
  const [filterSyncStatus, setFilterSyncStatus] = React.useState<string>('__all__')

  // ── Stock summary for the product dropdown ──────────────────────────
  // We fetch /api/stock/summary in parallel with the daily sells so we can
  // show "(Avail: 1,234)" next to each product name in the dropdown. The
  // summary is refreshed whenever the user adds/edits a row (since each
  // save changes the available quantity for that product).
  const [stockMap, setStockMap] = React.useState<Record<string, StockSummaryItem>>({})
  const [stockLoading, setStockLoading] = React.useState(true)

  // ── Inline "Quick Add" row state ─────────────────────────────────────
  // The form is now an inline row at the top of the table — no popup.
  const [newRow, setNewRow] = React.useState<DailySellFormData>(emptyForm)
  const [savingNew, setSavingNew] = React.useState(false)

  // ── Inline edit mode for an existing row ─────────────────────────────
  // When editingId is set, that row becomes editable in place.
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editRow, setEditRow] = React.useState<DailySellFormData>(emptyForm)
  const [savingEdit, setSavingEdit] = React.useState(false)

  // ── Multi-select / delete state ──────────────────────────────────────
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false)
  const [bulkDeleting, setBulkDeleting] = React.useState(false)
  const [deleteAllOpen, setDeleteAllOpen] = React.useState(false)
  const [deletingAll, setDeletingAll] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<DailySell | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getDailySells()
      // Sort by date desc; within the same date, the most recently added
      // record (createdAt) appears first so new entries show at the top.
      const data = (res.dailySells as DailySell[]).sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
        if (dateDiff !== 0) return dateDiff
        // Secondary sort: newest createdAt first (fallback to updatedAt)
        const aCreated = new Date(a.createdAt ?? a.updatedAt ?? 0).getTime()
        const bCreated = new Date(b.createdAt ?? b.updatedAt ?? 0).getTime()
        return bCreated - aCreated
      })
      setDailySells(data)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to fetch daily sell data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch stock summary so the product dropdown can show "(Avail: N)" next
  // to each product name. Called once on mount and again after every save
  // (since saving a daily sell reduces the available qty for that product).
  const fetchStock = React.useCallback(async () => {
    setStockLoading(true)
    try {
      const res = await api.getStockSummary()
      const map: Record<string, StockSummaryItem> = {}
      for (const item of res.summary) {
        // Index by name (e.g. "Cement") so we can look up by the product
        // key used in the dropdown.
        map[item.name] = item
      }
      setStockMap(map)
    } catch {
      // Non-blocking — dropdown still works, just without avail-qty labels
    } finally {
      setStockLoading(false)
    }
  }, [])

  // Debounced search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  // Derived list of unique customer names for the customer filter dropdown.
  // Computed once per data refresh — saves React from re-deriving on every render.
  const uniqueCustomers = React.useMemo(() => {
    const set = new Set<string>()
    dailySells.forEach((s) => { if (s.customerName?.trim()) set.add(s.customerName.trim()) })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'en-IN'))
  }, [dailySells])

  // Count how many advanced filters are currently active — used to badge
  // the "Filters" toggle button so the user can see at a glance that filters
  // are applied even when the panel is collapsed.
  const activeFilterCount = React.useMemo(() => {
    let n = 0
    if (filterDateFrom) n++
    if (filterDateTo) n++
    if (filterProduct !== '__all__') n++
    if (filterCustomer !== '__all__') n++
    if (filterPaymentStatus !== '__all__') n++
    if (filterSyncStatus !== '__all__') n++
    return n
  }, [filterDateFrom, filterDateTo, filterProduct, filterCustomer, filterPaymentStatus, filterSyncStatus])

  const clearAllFilters = () => {
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterProduct('__all__')
    setFilterCustomer('__all__')
    setFilterPaymentStatus('__all__')
    setFilterSyncStatus('__all__')
  }

  const filteredDailySells = React.useMemo(() => {
    let result = dailySells

    // 1) Free-text search across common fields
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter((item: any) =>
        ['date', 'customerName', 'address', 'contactNumber', 'product', 'remarks'].some((f) =>
          String((item as any)[f] ?? '').toLowerCase().includes(q)
        )
      )
    }

    // 2) Date range filter (inclusive on both ends; compares YYYY-MM-DD strings)
    if (filterDateFrom) {
      result = result.filter((item) => (item.date ?? '') >= filterDateFrom)
    }
    if (filterDateTo) {
      result = result.filter((item) => (item.date ?? '') <= filterDateTo)
    }

    // 3) Exact product match
    if (filterProduct !== '__all__') {
      result = result.filter((item) => item.product === filterProduct)
    }

    // 4) Exact customer match
    if (filterCustomer !== '__all__') {
      result = result.filter((item) => item.customerName === filterCustomer)
    }

    // 5) Payment status:
    //    - paid       → receivedAmount >= amount (no pending)
    //    - partial    → 0 < receivedAmount < amount
    //    - pending    → receivedAmount == 0 (or undefined)
    if (filterPaymentStatus !== '__all__') {
      result = result.filter((item) => {
        const amt = Number(item.amount) || 0
        const rec = Number(item.receivedAmount) || 0
        const pend = Number(item.pendingAmount ?? Math.max(0, amt - rec)) || 0
        if (filterPaymentStatus === 'paid') return pend <= 0
        if (filterPaymentStatus === 'partial') return rec > 0 && pend > 0
        if (filterPaymentStatus === 'pending') return rec <= 0 && amt > 0
        return true
      })
    }

    // 6) Sync status: synced if any of the linked IDs exist
    if (filterSyncStatus !== '__all__') {
      const wantSynced = filterSyncStatus === 'synced'
      result = result.filter((item) => {
        const isSynced = !!(item.orderId || item.customerPaymentId || item.customerId)
        return wantSynced ? isSynced : !isSynced
      })
    }

    return result
  }, [dailySells, debouncedSearch, filterDateFrom, filterDateTo, filterProduct, filterCustomer, filterPaymentStatus, filterSyncStatus])

  React.useEffect(() => {
    fetchData()
    fetchStock()
  }, [fetchData, fetchStock])

  // ── Auto-calc for new row ────────────────────────────────────────────
  const newComputedAmount = React.useMemo(() => {
    const qty = Number(newRow.quantity) || 0
    const rate = Number(newRow.rate) || 0
    return qty * rate
  }, [newRow.quantity, newRow.rate])

  const newComputedPending = React.useMemo(() => {
    return Math.max(0, newComputedAmount - (Number(newRow.receivedAmount) || 0))
  }, [newComputedAmount, newRow.receivedAmount])

  // ── Auto-calc for edit row ───────────────────────────────────────────
  const editComputedAmount = React.useMemo(() => {
    const qty = Number(editRow.quantity) || 0
    const rate = Number(editRow.rate) || 0
    return qty * rate
  }, [editRow.quantity, editRow.rate])

  const editComputedPending = React.useMemo(() => {
    return Math.max(0, editComputedAmount - (Number(editRow.receivedAmount) || 0))
  }, [editComputedAmount, editRow.receivedAmount])

  // ── Auto-fill from chat-widget AI result ─────────────────────────────
  React.useEffect(() => {
    const pending = consumePendingAiResult('dailySell')
    if (pending) {
      setNewRow({
        date: String(pending.date || ''),
        customerName: String(pending.customerName || ''),
        address: String(pending.address || ''),
        contactNumber: String(pending.contactNumber || ''),
        product: String(pending.product || ''),
        quantity: pending.quantity != null ? String(pending.quantity) : '',
        rate: pending.rate != null ? String(pending.rate) : '',
        amount: pending.amount != null ? String(pending.amount) : '',
        transporterName: String(pending.transporterName || ''),
        transporterFair: pending.transporterFair != null ? String(pending.transporterFair) : '',
        receivedAmount: (pending as any).receivedAmount != null ? String((pending as any).receivedAmount) : '',
        pendingAmount: (pending as any).pendingAmount != null ? String((pending as any).pendingAmount) : '',
        remarks: String(pending.remarks || ''),
      })
      toast({ title: 'AI auto-fill applied', description: 'Review the top row and click Save.' })
    }
  }, [])

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleNewRowChange = (field: keyof DailySellFormData, value: string) => {
    setNewRow((prev) => ({ ...prev, [field]: value }))
  }
  const handleEditRowChange = (field: keyof DailySellFormData, value: string) => {
    setEditRow((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveNew = async () => {
    if (isFormEmpty([newRow.date, newRow.customerName])) {
      toast(showPleaseFillDataToast())
      return
    }
    if (!newRow.date) {
      toast({ title: 'Validation Error', description: 'Date is required', variant: 'destructive' })
      return
    }
    if (!newRow.customerName.trim()) {
      toast({ title: 'Validation Error', description: 'Customer name is required', variant: 'destructive' })
      return
    }

    // ── Low-stock validation ──────────────────────────────────────────
    // If the user selected a product AND we have stock data for it AND
    // the entered quantity exceeds the available quantity, warn the user
    // and abort the save. The user must either reduce the quantity or
    // add production stock first.
    if (newRow.product && !stockLoading) {
      const avail = getProductAvail(newRow.product)
      const qty = Number(newRow.quantity) || 0
      if (avail != null && qty > avail) {
        toast({
          title: 'Low Stock — Cannot Save',
          description: `Only ${avail.toLocaleString('en-IN')} units of "${newRow.product}" are available, but you entered ${qty.toLocaleString('en-IN')}. Please reduce the quantity or add production first.`,
          variant: 'destructive',
        })
        return
      }
      // Also warn (but allow) when stock is critically low (≤10% of qty requested)
      if (avail != null && avail > 0 && qty > 0 && avail < qty * 1.1 && avail >= qty) {
        toast({
          title: 'Low Stock Warning',
          description: `Only ${avail.toLocaleString('en-IN')} units of "${newRow.product}" left in stock after this sale.`,
          variant: 'default',
        })
      }
    }

    setSavingNew(true)
    try {
      const payload = {
        date: newRow.date,
        customerName: newRow.customerName.trim(),
        address: newRow.address.trim(),
        contactNumber: newRow.contactNumber.trim(),
        product: newRow.product.trim(),
        quantity: Number(newRow.quantity) || 0,
        rate: Number(newRow.rate) || 0,
        amount: newComputedAmount,
        transporterName: newRow.transporterName.trim(),
        transporterFair: Number(newRow.transporterFair) || 0,
        receivedAmount: Number(newRow.receivedAmount) || 0,
        remarks: newRow.remarks.trim(),
      }
      const res = await api.createDailySell(payload)
      const synced = (res as any)?.dailySell?.syncNotes
      toast({
        title: 'Success',
        description: synced
          ? `Entry created · Auto-synced: ${synced}`
          : 'Daily sell entry created successfully',
      })
      setNewRow(emptyForm)
      fetchData()
      fetchStock()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save daily sell entry',
        variant: 'destructive',
      })
    } finally {
      setSavingNew(false)
    }
  }

  const handleStartEdit = (item: DailySell) => {
    setEditingId(item.id)
    setEditRow({
      date: item.date ? item.date.split('T')[0] : '',
      customerName: item.customerName || '',
      address: item.address || '',
      contactNumber: item.contactNumber || '',
      product: item.product || '',
      quantity: String(item.quantity ?? ''),
      rate: String(item.rate ?? ''),
      amount: String(item.amount || ''),
      transporterName: item.transporterName || '',
      transporterFair: String(item.transporterFair ?? ''),
      receivedAmount: String(item.receivedAmount ?? ''),
      pendingAmount: String(item.pendingAmount ?? ''),
      remarks: item.remarks || '',
    })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditRow(emptyForm)
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    if (!editRow.date) {
      toast({ title: 'Validation Error', description: 'Date is required', variant: 'destructive' })
      return
    }
    if (!editRow.customerName.trim()) {
      toast({ title: 'Validation Error', description: 'Customer name is required', variant: 'destructive' })
      return
    }

    // ── Low-stock validation (edit mode) ──────────────────────────────
    // Same logic as Quick Add — but we add back the existing row's qty
    // because editing it means the old qty is "returned" to stock first.
    if (editRow.product && !stockLoading) {
      const avail = getProductAvail(editRow.product)
      const newQty = Number(editRow.quantity) || 0
      const originalItem = dailySells.find((s) => s.id === editingId)
      const originalQty =
        originalItem && originalItem.product === editRow.product
          ? Number(originalItem.quantity) || 0
          : 0
      const effectiveAvail = (avail ?? 0) + originalQty
      if (avail != null && newQty > effectiveAvail) {
        toast({
          title: 'Low Stock — Cannot Save',
          description: `Only ${effectiveAvail.toLocaleString('en-IN')} units of "${editRow.product}" are available (incl. ${originalQty.toLocaleString('en-IN')} from this entry), but you entered ${newQty.toLocaleString('en-IN')}. Please reduce the quantity or add production first.`,
          variant: 'destructive',
        })
        return
      }
    }

    setSavingEdit(true)
    try {
      const payload = {
        date: editRow.date,
        customerName: editRow.customerName.trim(),
        address: editRow.address.trim(),
        contactNumber: editRow.contactNumber.trim(),
        product: editRow.product.trim(),
        quantity: Number(editRow.quantity) || 0,
        rate: Number(editRow.rate) || 0,
        amount: editComputedAmount,
        transporterName: editRow.transporterName.trim(),
        transporterFair: Number(editRow.transporterFair) || 0,
        receivedAmount: Number(editRow.receivedAmount) || 0,
        remarks: editRow.remarks.trim(),
      }
      const res = await api.updateDailySell(editingId, payload)
      const synced = (res as any)?.dailySell?.syncNotes
      toast({
        title: 'Success',
        description: synced
          ? `Entry updated · Auto-synced: ${synced}`
          : 'Daily sell entry updated successfully',
      })
      handleCancelEdit()
      fetchData()
      fetchStock()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update daily sell entry',
        variant: 'destructive',
      })
    } finally {
      setSavingEdit(false)
    }
  }

  // ── Selection handlers ──────────────────────────────────────────────
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
      if (prev.size === filteredDailySells.length && filteredDailySells.length > 0) {
        return new Set()
      }
      return new Set(filteredDailySells.map((s) => s.id))
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  // ── Bulk delete selected ────────────────────────────────────────────
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkDeleting(true)
    try {
      const res = await api.bulkDeleteDailySells(ids)
      toast({
        title: 'Success',
        description: `${res.deletedCount} of ${ids.length} entr${res.deletedCount === 1 ? 'y' : 'ies'} deleted`,
      })
      setBulkDeleteOpen(false)
      clearSelection()
      fetchData()
      fetchStock()
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

  // ── Delete ALL ──────────────────────────────────────────────────────
  const handleDeleteAll = async () => {
    setDeletingAll(true)
    try {
      const res = await api.deleteAllDailySells()
      toast({
        title: 'Success',
        description: `${res.deletedCount} entr${res.deletedCount === 1 ? 'y' : 'ies'} deleted`,
      })
      setDeleteAllOpen(false)
      clearSelection()
      fetchData()
      fetchStock()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete all entries',
        variant: 'destructive',
      })
    } finally {
      setDeletingAll(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteDailySell(deleteTarget.id)
      toast({ title: 'Success', description: 'Daily sell entry deleted successfully' })
      setDeleteTarget(null)
      fetchData()
      fetchStock()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete entry',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  // ── Summary totals ──────────────────────────────────────────────────
  // Memoized — three separate `.reduce()` calls over the full list on every
  // render (including every keystroke in search/filter inputs) is wasteful.
  // One pass, only recomputed when `dailySells` actually changes.
  const { totalAmount, totalReceived, totalPending } = React.useMemo(() => {
    let amt = 0, rec = 0, pend = 0
    for (const s of dailySells) {
      amt += s.amount || 0
      rec += s.receivedAmount || 0
      pend += s.pendingAmount ?? Math.max(0, (s.amount || 0) - (s.receivedAmount || 0))
    }
    return { totalAmount: amt, totalReceived: rec, totalPending: pend }
  }, [dailySells])

  // ── Build product option labels with avail-qty in brackets ─────────
  // e.g. "Cement (Avail: 1,234)" or "Cement (Avail: 0)" when out of stock.
  // Memoized so we don't recompute the labels on every keystroke.
  const productsWithAvail = React.useMemo(() => {
    return PRODUCT_ITEMS.map((p) => {
      const stock = stockMap[p.key]
      const avail = stock?.availableQuantity ?? null
      return {
        ...p,
        avail,
        // Compact label used inside the SelectItem — keep it short so the
        // dropdown doesn't get too wide.
        labelWithAvail:
          avail == null
            ? p.label
            : `${p.label} (Avail: ${avail.toLocaleString('en-IN')})`,
      }
    })
  }, [stockMap])

  // Helper to render the product cell in read-mode with avail-qty tooltip.
  // Looks up by the product name string stored on the daily sell row.
  const getProductAvail = (productName: string): number | null => {
    if (!productName) return null
    return stockMap[productName]?.availableQuantity ?? null
  }

  const renderSkeletons = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-6" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-8 w-20" /></TableCell>
      </TableRow>
    ))

  // ── Reusable AI-fill handler for the Quick Add row ──────────────────
  const applyAiToNewRow = (fields: any) =>
    setNewRow((prev) => ({
      date: fields.date != null ? String(fields.date) : prev.date,
      customerName: fields.customerName != null ? String(fields.customerName) : prev.customerName,
      address: fields.address != null ? String(fields.address) : prev.address,
      contactNumber: fields.contactNumber != null ? String(fields.contactNumber) : prev.contactNumber,
      product: fields.product != null ? String(fields.product) : prev.product,
      quantity: fields.quantity != null ? String(fields.quantity) : prev.quantity,
      rate: fields.rate != null ? String(fields.rate) : prev.rate,
      amount: fields.amount != null ? String(fields.amount) : prev.amount,
      transporterName: fields.transporterName != null ? String(fields.transporterName) : prev.transporterName,
      transporterFair: fields.transporterFair != null ? String(fields.transporterFair) : prev.transporterFair,
      receivedAmount: fields.receivedAmount != null ? String(fields.receivedAmount) : prev.receivedAmount,
      pendingAmount: fields.pendingAmount != null ? String(fields.pendingAmount) : prev.pendingAmount,
      remarks: fields.remarks != null ? String(fields.remarks) : prev.remarks,
    }))

  return (
    <div className="space-y-6 relative">
      {/* Full-screen loading overlay for delete operations */}
      {(deleting || deletingAll || bulkDeleting) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4 min-w-[280px]">
            <Loader2 className="size-12 animate-spin text-emerald-600" />
            <div className="text-center">
              <p className="text-lg font-semibold">
                {bulkDeleting
                  ? `Deleting ${selectedIds.size} entries...`
                  : deletingAll
                  ? 'Deleting all entries...'
                  : 'Deleting entry...'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Please wait while records are removed.</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <ShoppingCart className="size-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Daily Sell</h2>
            <p className="text-sm text-muted-foreground">
              Track daily sales — auto-syncs to Customer, Order, Payment &amp; Stock
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="w-full sm:w-auto">
            <Upload className="size-4 mr-2" />
            Import Excel
          </Button>
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkDeleting || loading}
              className="w-full sm:w-auto text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4 mr-2" />
              Delete Selected
              <Badge variant="secondary" className="ml-2 bg-destructive/10 text-destructive border-destructive/30">
                {selectedIds.size}
              </Badge>
            </Button>
          )}
          {selectedIds.size > 0 && (
            <Button variant="ghost" onClick={clearSelection} disabled={bulkDeleting} className="w-full sm:w-auto">
              Clear Selection
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setDeleteAllOpen(true)}
            disabled={dailySells.length === 0 || loading}
            className="w-full sm:w-auto text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash className="size-4 mr-2" />
            Delete All
          </Button>
        </div>
      </div>

      {/* Summary cards — 3 cards: Total Sales, Total Received, Total Pending */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-emerald-500 py-1">
          <CardContent className="p-2">
            <p className="text-[11px] text-muted-foreground">Total Sales</p>
            {loading ? (
              <Skeleton className="h-5 w-32 mt-0.5" />
            ) : (
              <p className="text-base font-bold text-emerald-700">{formatCurrency(totalAmount)}</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500 py-1">
          <CardContent className="p-2">
            <p className="text-[11px] text-muted-foreground">Total Received</p>
            {loading ? (
              <Skeleton className="h-5 w-32 mt-0.5" />
            ) : (
              <p className="text-base font-bold text-blue-700">{formatCurrency(totalReceived)}</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500 py-1">
          <CardContent className="p-2">
            <p className="text-[11px] text-muted-foreground">Total Pending</p>
            {loading ? (
              <Skeleton className="h-5 w-32 mt-0.5" />
            ) : (
              <p className="text-base font-bold text-amber-700">{formatCurrency(totalPending)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search + Filters */}
      <Card className="py-1">
        <CardContent className="px-3 py-1.5 space-y-1.5">
          {/* Top row: free-text search + filter toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search across all fields (date, name, remarks, etc.)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-7 text-sm"
              />
            </div>
            <Button
              type="button"
              variant={showFilters ? 'default' : 'outline'}
              onClick={() => setShowFilters((v) => !v)}
              className={`gap-2 ${activeFilterCount > 0 ? 'border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60' : ''}`}
              title="Toggle advanced filters"
            >
              <Filter className="size-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 bg-emerald-600 text-white hover:bg-emerald-600">
                  {activeFilterCount}
                </Badge>
              )}
              {showFilters ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </Button>
            {activeFilterCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={clearAllFilters}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
                title="Clear all filters"
              >
                <RotateCcw className="size-3.5" />
                <span>Clear</span>
              </Button>
            )}
          </div>

          {/* Collapsible advanced filter panel */}
          {showFilters && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Date From */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="size-3" /> Date From
                  </label>
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                {/* Date To */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="size-3" /> Date To
                  </label>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                {/* Product */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Product</label>
                  <Select value={filterProduct} onValueChange={setFilterProduct}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="All products" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All products</SelectItem>
                      <SelectGroup>
                        <SelectLabel>Products</SelectLabel>
                        {PRODUCT_ITEMS.map((p) => (
                          <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                {/* Customer */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Customer</label>
                  <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="All customers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All customers</SelectItem>
                      <SelectGroup>
                        <SelectLabel>Customers ({uniqueCustomers.length})</SelectLabel>
                        {uniqueCustomers.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                {/* Payment status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Payment Status</label>
                  <Select value={filterPaymentStatus} onValueChange={setFilterPaymentStatus}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Any status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All statuses</SelectItem>
                      <SelectItem value="paid">✓ Fully Paid</SelectItem>
                      <SelectItem value="partial">⟳ Partially Paid</SelectItem>
                      <SelectItem value="pending">✗ Pending / Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Sync status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Sync Status</label>
                  <Select value={filterSyncStatus} onValueChange={setFilterSyncStatus}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Any sync" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All records</SelectItem>
                      <SelectItem value="synced">✓ Synced</SelectItem>
                      <SelectItem value="unsynced">✗ Not synced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Active filter chips row */}
              {activeFilterCount > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-muted-foreground">Active filters:</span>
                  {filterDateFrom && (
                    <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200">
                      From: {filterDateFrom}
                      <button onClick={() => setFilterDateFrom('')} className="hover:text-emerald-900"><X className="size-3" /></button>
                    </Badge>
                  )}
                  {filterDateTo && (
                    <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200">
                      To: {filterDateTo}
                      <button onClick={() => setFilterDateTo('')} className="hover:text-emerald-900"><X className="size-3" /></button>
                    </Badge>
                  )}
                  {filterProduct !== '__all__' && (
                    <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200">
                      {filterProduct}
                      <button onClick={() => setFilterProduct('__all__')} className="hover:text-emerald-900"><X className="size-3" /></button>
                    </Badge>
                  )}
                  {filterCustomer !== '__all__' && (
                    <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200">
                      {filterCustomer}
                      <button onClick={() => setFilterCustomer('__all__')} className="hover:text-emerald-900"><X className="size-3" /></button>
                    </Badge>
                  )}
                  {filterPaymentStatus !== '__all__' && (
                    <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200">
                      {filterPaymentStatus === 'paid' ? 'Fully Paid' : filterPaymentStatus === 'partial' ? 'Partially Paid' : 'Pending'}
                      <button onClick={() => setFilterPaymentStatus('__all__')} className="hover:text-emerald-900"><X className="size-3" /></button>
                    </Badge>
                  )}
                  {filterSyncStatus !== '__all__' && (
                    <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200">
                      {filterSyncStatus === 'synced' ? 'Synced' : 'Not synced'}
                      <button onClick={() => setFilterSyncStatus('__all__')} className="hover:text-emerald-900"><X className="size-3" /></button>
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="ml-auto h-7 text-xs text-muted-foreground hover:text-destructive"
                  >
                    Clear all
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Table card — inline editable */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span>Daily Sell Records — Inline Editable</span>
              <AiFillButton module="dailySell" onApply={applyAiToNewRow} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedIds.size > 0 && (
                <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/30">
                  {selectedIds.size} selected
                </Badge>
              )}
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                {filteredDailySells.length} of {dailySells.length} record{dailySells.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollableTable maxHeight="max-h-[70vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 sticky left-0 bg-background z-20">
                    <Checkbox
                      checked={
                        filteredDailySells.length > 0 &&
                        selectedIds.size === filteredDailySells.length
                      }
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all rows"
                    />
                  </TableHead>
                  <TableHead className="sticky left-10 bg-background z-20 whitespace-nowrap">Date</TableHead>
                  <TableHead className="whitespace-nowrap">Customer Name</TableHead>
                  <TableHead className="whitespace-nowrap">Address</TableHead>
                  <TableHead className="whitespace-nowrap">Contact</TableHead>
                  <TableHead className="whitespace-nowrap">Product</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Qty</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Rate</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Amount</TableHead>
                  <TableHead className="whitespace-nowrap">Transporter</TableHead>
                  <TableHead className="text-right whitespace-nowrap">T. Fair</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Received</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Pending</TableHead>
                  <TableHead className="whitespace-nowrap">Remarks</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Synced</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* ───────────── Quick Add row — 2 proper flex rows, sized per placeholder ─────────────
                    Row 1: Date, Customer, Address, Contact, Product  (wider — name/address fields)
                    Row 2: Qty, Rate, Transporter, T Fair, Received, Remarks, Save  (compact numbers)
                */}
                <TableRow className="bg-emerald-50/60 dark:bg-emerald-900/15 border-t-2 border-t-emerald-400 hover:bg-emerald-50/60">
                  <TableCell colSpan={16} className="p-2 space-y-2">
                    {/* Row 1 — identity fields, wider */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Input
                        type="date"
                        value={newRow.date}
                        onChange={(e) => handleNewRowChange('date', e.target.value)}
                        className="h-7 text-xs px-1.5 w-[160px] shrink-0"
                      />
                      <CellInput value={newRow.customerName} onChange={(v) => handleNewRowChange('customerName', v)} placeholder="Customer Name" className="h-7 text-xs px-2 w-[180px] shrink-0" />
                      <CellInput value={newRow.address} onChange={(v) => handleNewRowChange('address', v)} placeholder="Address" className="h-7 text-xs px-2 w-[200px] shrink-0" />
                      <CellInput value={newRow.contactNumber} onChange={(v) => handleNewRowChange('contactNumber', v)} placeholder="Contact" className="h-7 text-xs px-2 w-[120px] shrink-0" />
                      <Select value={newRow.product} onValueChange={(v) => handleNewRowChange('product', v)}>
                        <SelectTrigger className="h-7 text-xs px-2 w-[180px] shrink-0">
                          <SelectValue placeholder="Product" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Product Items {stockLoading ? '(loading stock…)' : ''}</SelectLabel>
                            {productsWithAvail.map((p) => (
                              <SelectItem key={p.key} value={p.key}>
                                <span className="flex items-center gap-2">
                                  <span>{p.label}</span>
                                  {p.avail != null && (
                                    <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${p.avail > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
                                      Avail: {p.avail.toLocaleString('en-IN')}
                                    </span>
                                  )}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Row 2 — numeric / transaction fields + Save */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(() => {
                        const enteredQty = Number(newRow.quantity) || 0
                        const avail = newRow.product ? getProductAvail(newRow.product) : null
                        const isOver = avail != null && enteredQty > avail
                        return (
                          <div className="relative w-[80px] shrink-0">
                            <CellInput
                              type="number"
                              min="0"
                              value={newRow.quantity}
                              onChange={(v) => handleNewRowChange('quantity', v)}
                              placeholder="Qty"
                              className={`h-7 text-xs px-2 w-full ${isOver ? 'border-rose-500 ring-1 ring-rose-400 bg-rose-50 dark:bg-rose-950/30' : ''}`}
                            />
                            {isOver && (
                              <span
                                className="absolute -top-1.5 -right-1.5 flex items-center justify-center size-4 rounded-full bg-rose-500 text-white shadow"
                                title={`Available: ${avail?.toLocaleString('en-IN')}, you entered: ${enteredQty.toLocaleString('en-IN')}`}
                              >
                                <AlertTriangle className="size-2.5" />
                              </span>
                            )}
                          </div>
                        )
                      })()}
                      <CellInput type="number" min="0" value={newRow.rate} onChange={(v) => handleNewRowChange('rate', v)} placeholder="Rate" className="h-7 text-xs px-2 w-[80px] shrink-0" />
                      <CellInput value={newRow.transporterName} onChange={(v) => handleNewRowChange('transporterName', v)} placeholder="Transporter" className="h-7 text-xs px-2 w-[140px] shrink-0" />
                      <CellInput type="number" min="0" value={newRow.transporterFair} onChange={(v) => handleNewRowChange('transporterFair', v)} placeholder="T Fair" className="h-7 text-xs px-2 w-[90px] shrink-0" />
                      <CellInput type="number" min="0" value={newRow.receivedAmount} onChange={(v) => handleNewRowChange('receivedAmount', v)} placeholder="Received" className="h-7 text-xs px-2 w-[110px] shrink-0" />
                      <CellInput value={newRow.remarks} onChange={(v) => handleNewRowChange('remarks', v)} placeholder="Remarks" className="h-7 text-xs px-2 w-[130px] shrink-0" />
                      <Button
                        size="sm"
                        onClick={handleSaveNew}
                        disabled={savingNew}
                        className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-xs w-[90px] shrink-0 px-2"
                      >
                        {savingNew ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <>
                            <Plus className="size-3.5 mr-1" />
                            Save
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Computed Amount / Pending — shown as a small hint below the grid */}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>Amount: <b className="text-emerald-700 dark:text-emerald-300">{formatCurrency(newComputedAmount)}</b></span>
                      <span>Pending: <b className="text-amber-700 dark:text-amber-300">{formatCurrency(newComputedPending)}</b></span>
                    </div>
                  </TableCell>
                </TableRow>

                {/* Loading skeletons */}
                {loading && renderSkeletons()}

                {/* Empty state */}
                {!loading && filteredDailySells.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={16} className="h-32 text-center text-muted-foreground">
                      No daily sell entries yet. Fill the green row above and click Save to add your first entry.
                    </TableCell>
                  </TableRow>
                )}

                {/* Existing rows — read mode OR edit mode */}
                {!loading && filteredDailySells.map((item) => {
                  const isEditing = editingId === item.id
                  return (
                    <TableRow
                      key={item.id}
                      data-state={selectedIds.has(item.id) ? 'selected' : undefined}
                      className={
                        selectedIds.has(item.id)
                          ? 'bg-emerald-50/60 dark:bg-emerald-900/15'
                          : isEditing
                          ? 'bg-blue-50/60 dark:bg-blue-900/15'
                          : ''
                      }
                    >
                      <TableCell className="w-10 sticky left-0 bg-background z-10">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                          aria-label={`Select row for ${item.customerName}`}
                          disabled={isEditing}
                        />
                      </TableCell>

                      {isEditing ? (
                        // ── Edit mode — all cells become inputs ──
                        <>
                          <TableCell className="sticky left-10 bg-background z-10 min-w-[130px]">
                            <Input
                              type="date"
                              value={editRow.date}
                              onChange={(e) => handleEditRowChange('date', e.target.value)}
                              className="h-8 text-xs px-2"
                            />
                          </TableCell>
                          <TableCell className="min-w-[140px]">
                            <CellInput value={editRow.customerName} onChange={(v) => handleEditRowChange('customerName', v)} placeholder="Customer" />
                          </TableCell>
                          <TableCell className="min-w-[140px]">
                            <CellInput value={editRow.address} onChange={(v) => handleEditRowChange('address', v)} placeholder="Address" />
                          </TableCell>
                          <TableCell className="min-w-[120px]">
                            <CellInput value={editRow.contactNumber} onChange={(v) => handleEditRowChange('contactNumber', v)} placeholder="Contact" />
                          </TableCell>
                          <TableCell className="min-w-[180px]">
                            <Select value={editRow.product} onValueChange={(v) => handleEditRowChange('product', v)}>
                              <SelectTrigger className="h-8 text-xs px-2">
                                <SelectValue placeholder="Product" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectLabel>Product Items {stockLoading ? '(loading stock…)' : ''}</SelectLabel>
                                  {productsWithAvail.map((p) => (
                                    <SelectItem key={p.key} value={p.key}>
                                      <span className="flex items-center gap-2">
                                        <span>{p.label}</span>
                                        {p.avail != null && (
                                          <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${p.avail > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
                                            Avail: {p.avail.toLocaleString('en-IN')}
                                          </span>
                                        )}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="min-w-[80px]">
                            {(() => {
                              const enteredQty = Number(editRow.quantity) || 0
                              const avail = editRow.product ? getProductAvail(editRow.product) : null
                              // For edit mode we add back the original qty of this row (if same product)
                              // because that qty is currently "out of stock" but will be returned on save.
                              const originalItem = dailySells.find((s) => s.id === editingId)
                              const originalQty =
                                originalItem && originalItem.product === editRow.product
                                  ? Number(originalItem.quantity) || 0
                                  : 0
                              const effectiveAvail = (avail ?? 0) + originalQty
                              const isOver = avail != null && enteredQty > effectiveAvail
                              return (
                                <div className="relative">
                                  <CellInput
                                    type="number"
                                    min="0"
                                    value={editRow.quantity}
                                    onChange={(v) => handleEditRowChange('quantity', v)}
                                    placeholder="0"
                                    className={isOver ? 'border-rose-500 ring-1 ring-rose-400 bg-rose-50 dark:bg-rose-950/30' : ''}
                                  />
                                  {isOver && (
                                    <span
                                      className="absolute -top-1.5 -right-1.5 flex items-center justify-center size-4 rounded-full bg-rose-500 text-white shadow"
                                      title={`Available: ${effectiveAvail.toLocaleString('en-IN')} (incl. ${originalQty.toLocaleString('en-IN')} from this entry), you entered: ${enteredQty.toLocaleString('en-IN')}`}
                                    >
                                      <AlertTriangle className="size-2.5" />
                                    </span>
                                  )}
                                </div>
                              )
                            })()}
                          </TableCell>
                          <TableCell className="min-w-[90px]">
                            <CellInput type="number" min="0" value={editRow.rate} onChange={(v) => handleEditRowChange('rate', v)} placeholder="0" />
                          </TableCell>
                          <TableCell className="text-right font-semibold whitespace-nowrap tabular-nums text-emerald-700 dark:text-emerald-300">
                            {formatCurrency(editComputedAmount)}
                          </TableCell>
                          <TableCell className="min-w-[130px]">
                            <CellInput value={editRow.transporterName} onChange={(v) => handleEditRowChange('transporterName', v)} placeholder="Transporter" />
                          </TableCell>
                          <TableCell className="min-w-[90px]">
                            <CellInput type="number" min="0" value={editRow.transporterFair} onChange={(v) => handleEditRowChange('transporterFair', v)} placeholder="0" />
                          </TableCell>
                          <TableCell className="min-w-[100px]">
                            <CellInput type="number" min="0" value={editRow.receivedAmount} onChange={(v) => handleEditRowChange('receivedAmount', v)} placeholder="0" />
                          </TableCell>
                          <TableCell className="text-right font-semibold whitespace-nowrap tabular-nums text-amber-700 dark:text-amber-300">
                            {formatCurrency(editComputedPending)}
                          </TableCell>
                          <TableCell className="min-w-[140px]">
                            <CellInput value={editRow.remarks} onChange={(v) => handleEditRowChange('remarks', v)} placeholder="Remarks" />
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">—</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={handleSaveEdit}
                                disabled={savingEdit}
                                title="Save"
                                className="h-8 w-8 text-emerald-600 hover:bg-emerald-100"
                              >
                                {savingEdit ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={handleCancelEdit}
                                disabled={savingEdit}
                                title="Cancel"
                                className="h-8 w-8 text-muted-foreground hover:bg-zinc-100"
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        // ── Read mode — display values + Edit/Delete buttons ──
                        <>
                          <TableCell className="font-medium whitespace-nowrap sticky left-10 bg-background z-10">
                            {formatDate(item.date)}
                          </TableCell>
                          <TableCell className="font-medium whitespace-nowrap">{item.customerName}</TableCell>
                          <TableCell className="max-w-[150px] truncate text-muted-foreground">{item.address || '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{item.contactNumber || '—'}</TableCell>
                          <TableCell className="max-w-[180px] truncate">
                            {item.product ? (
                              <span className="truncate">{item.product}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                            {item.quantity != null ? item.quantity.toLocaleString('en-IN') : '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                            {item.rate != null ? formatCurrency(item.rate) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">{formatCurrency(item.amount)}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{item.transporterName || '—'}</TableCell>
                          <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                            {item.transporterFair != null ? formatCurrency(item.transporterFair) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium whitespace-nowrap tabular-nums text-blue-700 dark:text-blue-300">
                            {item.receivedAmount != null ? formatCurrency(item.receivedAmount) : '—'}
                          </TableCell>
                          <TableCell className={`text-right font-medium whitespace-nowrap tabular-nums ${(item.pendingAmount ?? 0) > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                            {item.pendingAmount != null ? formatCurrency(item.pendingAmount) : '—'}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate text-muted-foreground">{item.remarks || '—'}</TableCell>
                          <TableCell className="text-center">
                            {item.orderId || item.customerPaymentId || item.customerId ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                                title={item.syncNotes || 'Auto-synced'}
                              >
                                <CheckCircle2 className="size-3" />
                                Synced
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-muted-foreground"
                                title="Created before auto-sync was enabled"
                              >
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStartEdit(item)}
                                title="Edit"
                                disabled={!!editingId}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(item)}
                                title="Delete"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={!!editingId}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollableTable>
        </CardContent>
      </Card>

      {/* Delete single confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Daily Sell Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this daily sell entry? Auto-linked Order and Customer
              Payment will also be cleaned up. This action cannot be undone.
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
        if (!open && !deletingAll) setDeleteAllOpen(false)
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete ALL Daily Sell Entries?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <span className="block">
                You are about to permanently delete{' '}
                <strong className="text-destructive">all daily sell entries</strong>.
                This action <strong>cannot be undone</strong>.
              </span>
              <span className="block text-muted-foreground">
                All {dailySells.length} record{dailySells.length !== 1 ? 's' : ''} will be removed.
                Auto-linked Orders and Customer Payment entries will also be cleaned up.
                Customer master records are preserved.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll} className="border-border">No, Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deletingAll && <Loader2 className="mr-2 size-4 animate-spin" />}
              Yes, Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Selected confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => {
        if (!open && !bulkDeleting) setBulkDeleteOpen(false)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Delete {selectedIds.size} Selected Daily Sell {selectedIds.size === 1 ? 'Entry' : 'Entries'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to permanently delete{' '}
              <strong className="text-destructive">{selectedIds.size}</strong>{' '}
              daily sell {selectedIds.size === 1 ? 'entry' : 'entries'}.
              Auto-linked Orders and Customer Payments will also be cleaned up.
              This action <strong>cannot be undone</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {bulkDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExcelImport module="dailySell" open={importOpen} onClose={() => setImportOpen(false)} onSuccess={fetchData} />
    </div>
  )
}

export default DailySellModule
