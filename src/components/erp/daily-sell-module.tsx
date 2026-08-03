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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FieldVoiceInput } from '@/components/ui/field-voice-input'
import { ShoppingCart, Plus, Trash2, Pencil, Loader2, Upload, Search, Trash, RefreshCw, CheckCircle2, X, Save, AlertTriangle, Filter, Calendar, ChevronDown, ChevronUp, RotateCcw, IndianRupee } from 'lucide-react'
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
  // ── Multi-product line items ───────────────────────────────────────
  // When a sale has multiple products, ALL line items live here. Empty
  // array (or undefined) = single-product record (use legacy `product/
  // quantity/rate/amount` fields above).
  products?: Array<{
    product: string
    quantity: number
    rate: number
    amount: number
  }>
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

// ── Multi-product line item (for "Add Multiple Products" mode) ─────────────
// Each line represents one product entry. On save, we create a separate
// DailySell record per line item — all sharing the same date/customer/
// transporter/receivedAmount. This lets a user record a customer buying
// 3 types of bricks in a single dialog without creating 3 separate entries
// manually.
interface ProductLineItem {
  id: string
  product: string
  quantity: string
  rate: string
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

  // ── Add Sale dialog state ───────────────────────────────────────────
  // The form lives inside a popup Dialog (opened by the "Add Sale" button).
  // On submit, the record is saved, auto-synced to Customer / Order /
  // Customer Payment / Payment / Tractor Payment / Stock, and then the
  // dialog closes — the new row appears at the top of the table.
  const [newRow, setNewRow] = React.useState<DailySellFormData>(emptyForm)
  const [savingNew, setSavingNew] = React.useState(false)
  const [formOpen, setFormOpen] = React.useState(false)

  // ── Multi-product line items ──────────────────────────────────────
  // The Add Sale dialog ALWAYS shows a line-items table — starts with one
  // row. The user can click "Add More Product" to add more rows for
  // customers buying multiple brick types in one sale. Each row becomes a
  // separate DailySell record on Save (sharing date/customer/contact/
  // transporter/received across all rows).
  const [lineItems, setLineItems] = React.useState<ProductLineItem[]>([
    { id: `li-${Date.now()}`, product: '', quantity: '', rate: '' },
  ])

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: `li-${Date.now()}-${prev.length}`, product: '', quantity: '', rate: '' },
    ])
  }

  const removeLineItem = (id: string) => {
    setLineItems((prev) => (prev.length === 1 ? prev : prev.filter((li) => li.id !== id)))
  }

  const updateLineItem = (id: string, field: keyof ProductLineItem, value: string) => {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, [field]: value } : li))
    )
  }

  const openAddDialog = () => {
    setEditingId(null)
    setNewRow(emptyForm)
    setLineItems([{ id: `li-${Date.now()}`, product: '', quantity: '', rate: '' }])
    setFormOpen(true)
  }

  // ── Edit-mode tracking ────────────────────────────────────────────────
  // When the user clicks "Edit" on a row, we open the SAME Add Sale dialog
  // (formOpen) pre-filled with the record's existing data — including all
  // multi-product line items. editingId tracks which record is being edited
  // so the Save button knows whether to POST (create) or PUT (update).
  const [editingId, setEditingId] = React.useState<string | null>(null)

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
    // Sum of (qty × rate) for every non-empty line item.
    // The dialog always shows the line-items table now (no toggle).
    return lineItems.reduce((sum, li) => {
      const qty = Number(li.quantity) || 0
      const rate = Number(li.rate) || 0
      return sum + qty * rate
    }, 0)
  }, [lineItems])

  const newComputedPending = React.useMemo(() => {
    return Math.max(0, newComputedAmount - (Number(newRow.receivedAmount) || 0))
  }, [newComputedAmount, newRow.receivedAmount])

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

  // ── Unified save handler — branches between Create (POST) and Edit (PUT)
  // The same Dialog form serves both "Add Sale" and "Edit Sale". When
  // `editingId` is null → POST a new record. When set → PUT an update to
  // that record. Either way, the lineItems[] array is converted to a
  // `products[]` payload and sent to the server.
  const handleSave = async () => {
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

    // ── Build products[] from line items ──────────────────────────────
    // All line items go into ONE DailySell record (single POST or PUT). The
    // server stores them in the `products` array and derives legacy
    // single-product fields as a summary. Empty lines (no product/qty/rate)
    // are skipped.
    type ProductEntry = {
      product: string
      quantity: number
      rate: number
      amount: number
    }
    const entries: ProductEntry[] = []

    const filled = lineItems.filter(
      (li) => li.product || li.quantity || li.rate
    )
    if (filled.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Add at least one product with quantity and rate.',
        variant: 'destructive',
      })
      return
    }
    for (const li of filled) {
      if (!li.product) {
        toast({
          title: 'Validation Error',
          description: 'Every line item must have a product selected.',
          variant: 'destructive',
        })
        return
      }
      const qty = Number(li.quantity) || 0
      const rate = Number(li.rate) || 0
      if (qty <= 0) {
        toast({
          title: 'Validation Error',
          description: `Quantity for "${li.product}" must be greater than 0.`,
          variant: 'destructive',
        })
        return
      }
      entries.push({
        product: li.product,
        quantity: qty,
        rate,
        amount: qty * rate,
      })
    }

    // ── Low-stock validation ──────────────────────────────────────────
    // For NEW records: validate every entry against available stock.
    // For EDITED records: when the same product was already in the
    // original record, add back its original qty (since saving will
    // replace the old entry). This prevents false "low stock" rejections
    // when the user only edits non-qty fields.
    if (!stockLoading) {
      const originalItem = editingId
        ? dailySells.find((s) => s.id === editingId)
        : null
      const originalProducts = Array.isArray(originalItem?.products)
        ? (originalItem!.products as Array<{ product: string; quantity: number; rate: number; amount: number }>)
        : originalItem
          ? [{
              product: String(originalItem.product || ''),
              quantity: Number(originalItem.quantity) || 0,
              rate: Number(originalItem.rate) || 0,
              amount: Number(originalItem.amount) || 0,
            }]
          : []
      for (const entry of entries) {
        if (!entry.product) continue
        const avail = getProductAvail(entry.product)
        if (avail == null) continue
        // Add back the original qty for the same product (since editing
        // replaces the old entry — those units come back into stock).
        const originalQtyForThisProduct = originalProducts
          .filter((p) => p.product === entry.product)
          .reduce((s, p) => s + (Number(p.quantity) || 0), 0)
        const effectiveAvail = avail + originalQtyForThisProduct
        if (entry.quantity > effectiveAvail) {
          toast({
            title: 'Low Stock — Cannot Save',
            description:
              originalQtyForThisProduct > 0
                ? `Only ${avail.toLocaleString('en-IN')} units of "${entry.product}" are available (incl. ${originalQtyForThisProduct.toLocaleString('en-IN')} from this entry), but you entered ${entry.quantity.toLocaleString('en-IN')}.`
                : `Only ${avail.toLocaleString('en-IN')} units of "${entry.product}" are available, but you entered ${entry.quantity.toLocaleString('en-IN')}. Please reduce the quantity or add production first.`,
            variant: 'destructive',
          })
          return
        }
      }
    }

    setSavingNew(true)
    try {
      // Total amount = sum of all line-item amounts. Received is what the
      // customer paid total; pending is the difference.
      const totalAmount = entries.reduce((s, e) => s + e.amount, 0)
      const totalReceived = Number(newRow.receivedAmount) || 0
      const totalPending = Math.max(0, totalAmount - totalReceived)

      const payload: Record<string, unknown> = {
        date: newRow.date,
        customerName: newRow.customerName.trim(),
        address: newRow.address.trim(),
        contactNumber: newRow.contactNumber.trim(),
        // Legacy single-product fields are derived on the server from
        // products[] — we still pass them so single-product Excel imports
        // (which don't have products[]) keep working via the same route.
        product: entries[0].product,
        quantity: entries.reduce((s, e) => s + e.quantity, 0),
        rate: 0,
        amount: totalAmount,
        transporterName: newRow.transporterName.trim(),
        transporterFair: Number(newRow.transporterFair) || 0,
        receivedAmount: totalReceived,
        pendingAmount: totalPending,
        remarks: newRow.remarks.trim(),
        // ← THE KEY FIELD: line items are stored here on the server.
        products: entries,
      }

      if (editingId) {
        // ── EDIT: PUT update ──
        const res = await api.updateDailySell(editingId, payload)
        const synced = (res as any)?.dailySell?.syncNotes
        toast({
          title: 'Success',
          description: synced
            ? `Entry updated · Auto-synced: ${synced}`
            : 'Daily sell entry updated successfully',
        })
      } else {
        // ── CREATE: POST new record ──
        const res = await api.createDailySell(payload)
        const syncNotes = (res as any)?.dailySell?.syncNotes || ''
        toast({
          title: 'Success',
          description:
            entries.length > 1
              ? `Sale created with ${entries.length} products${syncNotes ? ` · Auto-synced: ${syncNotes}` : ''}`
              : syncNotes
                ? `Entry created · Auto-synced: ${syncNotes}`
                : 'Daily sell entry created successfully',
        })
      }

      // Reset form + close dialog
      setNewRow(emptyForm)
      setLineItems([{ id: `li-${Date.now()}`, product: '', quantity: '', rate: '' }])
      setEditingId(null)
      setFormOpen(false)
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

  // ── Open the dialog in EDIT mode ─────────────────────────────────────
  // Pre-fills `newRow` and `lineItems` from the existing record so the
  // user sees the same form they used to create it — fully editable,
  // including all line items (add/remove/edit each product).
  const handleStartEdit = (item: DailySell) => {
    const prods = Array.isArray(item.products) && item.products.length > 0
      ? (item.products as Array<{ product: string; quantity: number; rate: number; amount: number }>)
      : []
    setEditingId(item.id)
    setNewRow({
      date: item.date ? item.date.split('T')[0] : '',
      customerName: item.customerName || '',
      address: item.address || '',
      contactNumber: item.contactNumber || '',
      // Legacy single-product fields are not used by the dialog when line
      // items are present (lineItems[] is the source of truth). We still
      // populate them so AI-fill / single-product legacy paths still work.
      product: prods.length > 0 ? '' : String(item.product || ''),
      quantity: prods.length > 0 ? '' : String(item.quantity ?? ''),
      rate: prods.length > 0 ? '' : String(item.rate ?? ''),
      amount: String(item.amount || ''),
      transporterName: item.transporterName || '',
      transporterFair: String(item.transporterFair ?? ''),
      receivedAmount: String(item.receivedAmount ?? ''),
      pendingAmount: String(item.pendingAmount ?? ''),
      remarks: item.remarks || '',
    })
    setLineItems(
      prods.length > 0
        ? prods.map((p, idx) => ({
            id: `li-${item.id}-${idx}`,
            product: String(p.product || ''),
            quantity: String(p.quantity ?? ''),
            rate: String(p.rate ?? ''),
          }))
        : [{
            id: `li-${item.id}-0`,
            product: String(item.product || ''),
            quantity: String(item.quantity ?? ''),
            rate: String(item.rate ?? ''),
          }]
    )
    setFormOpen(true)
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
          <Button onClick={openAddDialog} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="size-4 mr-2" />
            Add Sale
          </Button>
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
              <span>Daily Sell Records</span>
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
                {/* Loading skeletons */}
                {loading && renderSkeletons()}

                {/* Empty state */}
                {!loading && filteredDailySells.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={16} className="h-32 text-center text-muted-foreground">
                      No daily sell entries yet. Click the <span className="font-semibold text-emerald-700">Add Sale</span> button above to create your first entry.
                    </TableCell>
                  </TableRow>
                )}

                {/* Existing rows — read mode (edit happens in the dialog) */}
                {!loading && filteredDailySells.flatMap((item) => {
                  // ── Multi-product expansion (Excel-style) ──────────────────────
                  // When a DailySell record has 2+ products in `products[]`,
                  // we expand it into N table rows — one per product — so each
                  // product gets its own Product/Qty/Rate/Amount cell with the
                  // real values (not "varies" / "sum: N"). The Date, Customer,
                  // Address, Contact, Transporter, T.Fair, Received, Pending,
                  // Remarks, Synced, and Actions cells use `rowSpan={N}` on the
                  // FIRST sub-row so they visually span across all sub-rows
                  // (exactly like merged cells in the user's Excel template).
                  //
                  // Single-product records (or legacy records without products[])
                  // render as before — exactly one table row.
                  //
                  // Multi-product sub-rows get alternating tinted backgrounds so
                  // each product row is visually distinct (Excel-like stripes).
                  // Editing happens via the same popup dialog used for creating
                  // new records — click the Pencil icon to open it.
                  const prods = Array.isArray(item.products) ? item.products : []
                  const lines = prods.length > 0
                    ? prods.map((p: any) => ({
                        product: String(p.product || ''),
                        quantity: Number(p.quantity) || 0,
                        rate: Number(p.rate) || 0,
                        amount: Number(p.amount) || (Number(p.quantity) || 0) * (Number(p.rate) || 0),
                      }))
                    : [{
                        product: String(item.product || ''),
                        quantity: Number(item.quantity) || 0,
                        rate: Number(item.rate ?? 0) || 0,
                        amount: Number(item.amount) || 0,
                      }]
                  const isMulti = lines.length > 1
                  const rowSpan = isMulti ? lines.length : 1

                  // Build the sub-rows. The FIRST sub-row contains all the
                  // customer/date/transporter/etc cells with rowSpan. The
                  // remaining sub-rows contain ONLY the product-line cells
                  // (Product, Qty, Rate, Amount).
                  return lines.map((line, lineIdx) => {
                    const isFirstLine = lineIdx === 0
                    // ── Background colors for multi-product sub-rows ──
                    // Alternating shades within the multi-product group so
                    // each product line is visually distinct (Excel stripes).
                    // Selected rows take precedence (emerald tint).
                    const rowBg = selectedIds.has(item.id)
                      ? 'bg-emerald-50/70 dark:bg-emerald-900/20'
                      : isMulti
                      ? lineIdx % 2 === 0
                        ? 'bg-blue-50/60 dark:bg-blue-900/20'
                        : 'bg-sky-50/40 dark:bg-sky-900/10'
                      : ''
                    const rowBorder = isMulti && lineIdx > 0
                      ? 'border-t border-blue-200/70 dark:border-blue-800/40'
                      : ''
                    return (
                      <TableRow
                        key={`${item.id}-line-${lineIdx}`}
                        data-state={selectedIds.has(item.id) ? 'selected' : undefined}
                        className={`${rowBg} ${rowBorder}`.trim()}
                      >
                  {/* ── Checkbox cell — only on first sub-row, spans all sub-rows */}
                  {isFirstLine && (
                    <TableCell className="w-10 sticky left-0 bg-inherit z-10 align-top" rowSpan={rowSpan}>
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                        aria-label={`Select row for ${item.customerName}`}
                      />
                    </TableCell>
                  )}

                  {/* ── Read mode (always — editing happens in the dialog) ── */}
                  {/* Multi-product records: the FIRST sub-row carries the
                      "shared" cells (Date, Customer, Address, Contact,
                      Transporter, T.Fair, Received, Pending, Remarks,
                      Synced, Actions) with rowSpan so they visually merge
                      across all N product sub-rows. EVERY sub-row (incl.
                      the first) carries the per-product cells:
                      Product, Qty, Rate, Amount — each with its own real
                      value (no "varies" / "sum: N"). */}
                  {isFirstLine && (
                    <>
                      <TableCell
                        className="font-medium whitespace-nowrap sticky left-10 bg-inherit z-10 align-top"
                        rowSpan={rowSpan}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span>{formatDate(item.date)}</span>
                          {isMulti && (
                            <span className="inline-flex w-fit items-center rounded bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                              {lines.length} items
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap align-top" rowSpan={rowSpan}>
                        {item.customerName}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground align-top" rowSpan={rowSpan}>
                        {item.address || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap align-top" rowSpan={rowSpan}>
                        {item.contactNumber || '—'}
                      </TableCell>
                    </>
                  )}
                  {/* ── Per-line cells (rendered on EVERY sub-row) ── */}
                  <TableCell className="whitespace-nowrap align-top">
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400">
                      {line.product || '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap tabular-nums align-top">
                    {line.quantity.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap tabular-nums align-top">
                    {formatCurrency(line.rate)}
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap tabular-nums align-top">
                    {formatCurrency(line.amount)}
                  </TableCell>
                  {isFirstLine && (
                    <>
                      <TableCell className="max-w-[150px] truncate align-top" rowSpan={rowSpan}>
                        {item.transporterName || '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap tabular-nums align-top" rowSpan={rowSpan}>
                        {item.transporterFair != null ? formatCurrency(item.transporterFair) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap tabular-nums align-top text-blue-700 dark:text-blue-300" rowSpan={rowSpan}>
                        {item.receivedAmount != null ? formatCurrency(item.receivedAmount) : '—'}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium whitespace-nowrap tabular-nums align-top ${(item.pendingAmount ?? 0) > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}
                        rowSpan={rowSpan}
                      >
                        {item.pendingAmount != null ? formatCurrency(item.pendingAmount) : '—'}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground align-top" rowSpan={rowSpan}>
                        {item.remarks || '—'}
                      </TableCell>
                      <TableCell className="text-center align-top" rowSpan={rowSpan}>
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
                      <TableCell className="text-right align-top" rowSpan={rowSpan}>
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
                  })
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

      {/* Add / Edit Sale Dialog — popup form (same dialog used for both) */}
      <Dialog open={formOpen} onOpenChange={(open) => {
        if (!savingNew) {
          setFormOpen(open)
          if (!open) setEditingId(null)
        }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Daily Sale' : 'Add Daily Sale'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the details below. Changes will auto-sync to Customer, Order, Payment & Stock.'
                : 'Fill in the details to create a new daily sell entry. The record will auto-sync to Customer, Order, Payment & Stock.'}
            </DialogDescription>
          </DialogHeader>

          {/* Auto-sync info banner */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/15 px-3 py-2.5 flex items-start gap-2">
            <RefreshCw className="size-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
              <span className="font-semibold">Auto-sync on save:</span> Customer record, Order,
              Customer Payment, Tractor Payment and Stock availability will be auto-created / updated
              in their respective modules.
            </div>
          </div>

          {/* AI fill button */}
          <div className="flex justify-end">
            <AiFillButton module="dailySell" onApply={applyAiToNewRow} />
          </div>

          <div className="grid gap-3 py-1">
            {/* Date + Customer (2 col) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ds-date">Date <span className="text-destructive">*</span></Label>
                <Input id="ds-date" type="date" value={newRow.date} onChange={(e) => handleNewRowChange('date', e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ds-customer">Customer Name <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input id="ds-customer" placeholder="Enter customer name" value={newRow.customerName} onChange={(e) => handleNewRowChange('customerName', e.target.value)} className="pr-9" />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                    <FieldVoiceInput fieldLabel="customer name" onChange={(text) => handleNewRowChange('customerName', text)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="grid gap-1.5">
              <Label htmlFor="ds-address">Address</Label>
              <div className="relative">
                <Input id="ds-address" placeholder="Enter address" value={newRow.address} onChange={(e) => handleNewRowChange('address', e.target.value)} className="pr-9" />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <FieldVoiceInput fieldLabel="address" onChange={(text) => handleNewRowChange('address', text)} />
                </div>
              </div>
            </div>

            {/* Contact Number (full width) */}
            <div className="grid gap-1.5">
              <Label htmlFor="ds-contact">Contact Number</Label>
              <div className="relative">
                <Input id="ds-contact" placeholder="Enter contact number" value={newRow.contactNumber} onChange={(e) => handleNewRowChange('contactNumber', e.target.value)} className="pr-9" />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <FieldVoiceInput fieldLabel="contact number" onChange={(text) => handleNewRowChange('contactNumber', text.replace(/[^0-9+\-\s]/g, '').trim())} />
                </div>
              </div>
            </div>

            {/* ── Products line-items table ─────────────────────────────── */}
            {/* Always shown. Starts with one row. User clicks "Add More
                Product" below to add another row for multi-product sales.
                Each row becomes a separate DailySell record on Save. */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Products <span className="text-destructive">*</span></Label>
                <span className="text-xs text-muted-foreground">
                  Total: <span className="font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(newComputedAmount)}</span>
                </span>
              </div>
              <div className="rounded-md border divide-y">
                {lineItems.map((li, idx) => {
                  const qty = Number(li.quantity) || 0
                  const rate = Number(li.rate) || 0
                  const lineAmount = qty * rate
                  const avail = li.product ? getProductAvail(li.product) : null
                  const lowStock = avail != null && qty > avail
                  return (
                    <div key={li.id} className="p-2.5 grid gap-2">
                      {/* Row 1: product label + avail badge (own line, wraps cleanly) + delete button */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                            Product #{idx + 1}
                          </span>
                          {avail != null && (
                            <span
                              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${avail > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}
                            >
                              Avail: {avail.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          disabled={lineItems.length === 1}
                          onClick={() => removeLineItem(li.id)}
                          title="Remove this product"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                      {/* Row 2: product select — full width, no Avail badge inside the trigger */}
                      <Select
                        value={li.product}
                        onValueChange={(v) => updateLineItem(li.id, 'product', v)}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Product Items {stockLoading ? '(loading…)' : ''}</SelectLabel>
                            {productsWithAvail.map((p) => (
                              <SelectItem key={p.key} value={p.key} textValue={p.label}>
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
                      {/* Row 3: Qty | Rate | Amount — 3-col grid, comfortable spacing */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="grid gap-1">
                          <span className="text-[10px] font-medium text-muted-foreground">Qty</span>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={li.quantity}
                            onChange={(e) => updateLineItem(li.id, 'quantity', e.target.value)}
                            className={`h-9 ${lowStock ? 'border-rose-500 ring-1 ring-rose-400 bg-rose-50 dark:bg-rose-950/30' : ''}`}
                          />
                        </div>
                        <div className="grid gap-1">
                          <span className="text-[10px] font-medium text-muted-foreground">Rate</span>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={li.rate}
                            onChange={(e) => updateLineItem(li.id, 'rate', e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="grid gap-1">
                          <span className="text-[10px] font-medium text-muted-foreground">Amount</span>
                          <div className="h-9 flex items-center justify-end rounded-md border bg-emerald-50 dark:bg-emerald-900/20 px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            {formatCurrency(lineAmount)}
                          </div>
                        </div>
                      </div>
                      {lowStock && (
                        <p className="text-xs text-rose-600 flex items-center gap-1">
                          <AlertTriangle className="size-3" />
                          Only {avail!.toLocaleString('en-IN')} units of &quot;{li.product}&quot; available in stock
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Add More Product button — below the table, full visibility */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLineItem}
                className="h-8 text-xs w-full border-dashed"
              >
                <Plus className="size-3.5 mr-1" />
                Add More Product
              </Button>
            </div>

            {/* Amount + Pending (auto-calc display, 2 col) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Amount <span className="text-muted-foreground text-xs font-normal">(auto)</span></Label>
                <div className="flex h-9 items-center rounded-md border bg-emerald-50 dark:bg-emerald-900/20 px-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(newComputedAmount)}
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Pending <span className="text-muted-foreground text-xs font-normal">(auto)</span></Label>
                <div className="flex h-9 items-center rounded-md border bg-amber-50 dark:bg-amber-900/20 px-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
                  {formatCurrency(newComputedPending)}
                </div>
              </div>
            </div>

            {/* Transporter Name + T Fair (2 col) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ds-transporter">Transporter Name</Label>
                <div className="relative">
                  <Input id="ds-transporter" placeholder="e.g. Ramesh Transport" value={newRow.transporterName} onChange={(e) => handleNewRowChange('transporterName', e.target.value)} className="pr-9" />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                    <FieldVoiceInput fieldLabel="transporter name" onChange={(text) => handleNewRowChange('transporterName', text)} />
                  </div>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ds-tfair">Transporter Fair (₹)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="ds-tfair"
                    type="number"
                    min="0"
                    placeholder="0"
                    className="pl-9 pr-9"
                    value={newRow.transporterFair}
                    onChange={(e) => handleNewRowChange('transporterFair', e.target.value)}
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                    <FieldVoiceInput fieldLabel="transporter fair" onChange={(text) => handleNewRowChange('transporterFair', text.replace(/[^0-9.]/g, ''))} />
                  </div>
                </div>
              </div>
            </div>

            {/* Received Amount */}
            <div className="grid gap-1.5">
              <Label htmlFor="ds-received">Received Amount (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="ds-received"
                  type="number"
                  min="0"
                  placeholder="0"
                  className="pl-9 pr-9"
                  value={newRow.receivedAmount}
                  onChange={(e) => handleNewRowChange('receivedAmount', e.target.value)}
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <FieldVoiceInput fieldLabel="received amount" onChange={(text) => handleNewRowChange('receivedAmount', text.replace(/[^0-9.]/g, ''))} />
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div className="grid gap-1.5">
              <Label htmlFor="ds-remarks">Remarks</Label>
              <div className="relative">
                <Textarea id="ds-remarks" placeholder="Optional remarks..." value={newRow.remarks} onChange={(e) => handleNewRowChange('remarks', e.target.value)} className="min-h-[70px] pr-9" />
                <div className="absolute right-1.5 top-2">
                  <FieldVoiceInput fieldLabel="remarks" onChange={(text) => handleNewRowChange('remarks', text)} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setFormOpen(false); setEditingId(null) }} disabled={savingNew}>Cancel</Button>
            <Button onClick={handleSave} disabled={savingNew} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {savingNew && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingId ? (
                <>
                  <Save className="size-4 mr-1" />
                  Save Changes
                </>
              ) : (
                <>
                  <Plus className="size-4 mr-1" />
                  Create Entry
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExcelImport module="dailySell" open={importOpen} onClose={() => setImportOpen(false)} onSuccess={fetchData} />
    </div>
  )
}

export default DailySellModule
