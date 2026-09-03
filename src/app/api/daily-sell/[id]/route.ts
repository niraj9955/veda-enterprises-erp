import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { DailySell } from '@/lib/models'
import { syncAllFromDailySell, cleanupDailySellLinks } from '@/lib/daily-sell-sync'
import { requireSession, requireRole } from '@/lib/auth'
import { normalizeDate } from '@/lib/date-utils'

// Force dynamic — never cache individual daily-sell responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Whitelist of updatable fields. Must match DailySellSchema in src/lib/models.ts.
// Note: customerId / orderId / customerPaymentId / syncNotes are managed by the
// auto-sync engine — NOT user-editable through this route.
// pendingAmount is auto-derived (amount − receivedAmount) on save.
const DAILY_SELL_FIELDS = [
  'date',
  'customerName',
  'address',
  'contactNumber',
  'product',
  'quantity',
  'rate',
  'amount',
  'transporterName',
  'transporterFair',
  'receivedAmount',
  'remarks',
] as const

const NUMERIC_FIELDS = new Set(['amount', 'quantity', 'rate', 'transporterFair', 'receivedAmount'])

// GET /api/daily-sell/[id] — fetch a single daily sell entry
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params
    const record = await DailySell.findById(id).lean()
    if (!record) {
      return NextResponse.json({ error: 'Daily sell entry not found' }, { status: 404 })
    }
    return NextResponse.json({ dailySell: toObject(record) })
  } catch (error) {
    console.error('Error fetching daily sell entry:', error)
    return NextResponse.json({ error: 'Failed to fetch daily sell entry' }, { status: 500 })
  }
}

// PUT /api/daily-sell/[id] — update a single daily sell entry
// After updating the user-facing fields, we re-run the auto-sync engine:
//   1. Delete the previously-linked Order + CustomerPayment (cleanup)
//   2. Re-create them with the new data
//   3. Update the linked Customer's address if it changed
//   4. Refresh syncNotes with the new summary
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(['admin', 'operator', 'accountant'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params
    const body = await request.json()
    // Normalize date to canonical YYYY-MM-DD
    // (handles dd-mm-yyyy, dd/mm/yyyy, Excel serials, Date objects, etc.)
    if (body.date) body.date = normalizeDate(body.date)

    const updateData: Record<string, unknown> = {}
    for (const field of DAILY_SELL_FIELDS) {
      if (body[field] !== undefined) {
        if (NUMERIC_FIELDS.has(field)) {
          updateData[field] = Number(body[field])
        } else {
          updateData[field] = String(body[field])
        }
      }
    }

    // ── Multi-product support ────────────────────────────────────────
    // If the body includes a `products` array, store it AND recompute the
    // legacy summary fields (product/quantity/rate/amount) from it. If the
    // body does NOT include `products`, the existing array is preserved
    // (so editing only the customer/date/transporter/received fields on a
    // multi-product record doesn't wipe out the line items).
    type ProductEntry = { product: string; quantity: number; rate: number; amount: number }
    if (Array.isArray(body.products)) {
      const products: ProductEntry[] = body.products
        .filter((p: any) => p && typeof p === 'object')
        .map((p: any) => ({
          product: String(p.product || '').trim(),
          quantity: Number(p.quantity) || 0,
          rate: Number(p.rate) || 0,
          amount: Number(p.amount) || (Number(p.quantity) || 0) * (Number(p.rate) || 0),
        }))
      if (products.length > 0) {
        // Recompute summary fields from the products array.
        updateData.products = products
        updateData.product =
          products.length === 1
            ? products[0].product
            : `${products[0].product}, +${products.length - 1} more`
        updateData.quantity = products.reduce((s, p) => s + (Number(p.quantity) || 0), 0)
        updateData.amount = products.reduce((s, p) => s + (Number(p.amount) || 0), 0)
        updateData.rate = 0
      } else {
        // Empty array — clear multi-product storage.
        updateData.products = []
      }
    }

    const record = await DailySell.findByIdAndUpdate(id, updateData, { new: true })
    if (!record) {
      return NextResponse.json({ error: 'Daily sell entry not found' }, { status: 404 })
    }

    // ── Auto-compute pendingAmount = amount − receivedAmount ───────────
    const amt = Number(record.amount) || 0
    const rec = Number(record.receivedAmount) || 0
    record.pendingAmount = Math.max(0, amt - rec)

    // ── Re-run auto-sync with the new field values ────────────────────
    // Step 1: clean up the previously-linked Order + CustomerPayment +
    // Payment + TractorPayment so we don't leave stale mirrors when the
    // user edits the entry.
    try {
      await cleanupDailySellLinks({
        customerId: record.customerId?.toString(),
        orderId: record.orderId?.toString(),
        customerPaymentId: record.customerPaymentId?.toString(),
        paymentId: (record as any).paymentId?.toString(),
        tractorPaymentId: (record as any).tractorPaymentId?.toString(),
      })
    } catch (cleanupErr) {
      console.error('[daily-sell PUT] Cleanup error (non-blocking):', cleanupErr)
    }

    // Step 2: re-create the mirrors with the updated field values.
    // If the record has a `products` array, pass it through so syncOrder
    // creates the Order with one line item per product.
    try {
      const recordProducts = Array.isArray((record as any).products)
        ? (record as any).products.map((p: any) => ({
            product: String(p.product || ''),
            quantity: Number(p.quantity) || 0,
            rate: Number(p.rate) || 0,
            amount: Number(p.amount) || 0,
          }))
        : undefined
      const sync = await syncAllFromDailySell({
        dailySellId: String(record._id),
        date: String(record.date),
        customerName: String(record.customerName),
        address: String(record.address || ''),
        contactNumber: String(record.contactNumber || ''),
        product: String(record.product || ''),
        quantity: Number(record.quantity) || 0,
        rate: Number(record.rate) || 0,
        amount: amt,
        transporterName: String(record.transporterName || ''),
        transporterFair: Number(record.transporterFair) || 0,
        receivedAmount: rec,
        pendingAmount: Number(record.pendingAmount) || 0,
        remarks: String(record.remarks || ''),
        products: recordProducts && recordProducts.length > 0 ? recordProducts : undefined,
      })
      record.customerId = sync.customerId as any
      record.orderId = sync.orderId as any
      record.customerPaymentId = sync.customerPaymentId as any
      ;(record as any).paymentId = sync.paymentId as any
      ;(record as any).tractorPaymentId = sync.tractorPaymentId as any
      record.syncNotes = sync.syncNotes
      await record.save()
    } catch (syncErr) {
      console.error('[daily-sell PUT] Auto-sync failed (non-blocking):', syncErr)
      record.customerId = null
      record.orderId = null
      record.customerPaymentId = null
      ;(record as any).paymentId = null
      ;(record as any).tractorPaymentId = null
      record.syncNotes = 'Auto-sync failed on edit — entry saved but mirrors may be stale'
      await record.save()
    }

    return NextResponse.json({ dailySell: toObject(record) })
  } catch (error) {
    console.error('Error updating daily sell entry:', error)
    return NextResponse.json({ error: 'Failed to update daily sell entry' }, { status: 500 })
  }
}

// DELETE /api/daily-sell/[id] — delete a single daily sell entry
// Before deleting, clean up the linked Order + CustomerPayment mirrors.
// The Customer record is preserved (may have other transactions).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(['admin', 'operator', 'accountant'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params

    const record = await DailySell.findById(id).lean()
    if (!record) {
      return NextResponse.json({ error: 'Daily sell entry not found' }, { status: 404 })
    }

    // Clean up linked mirrors (best-effort)
    try {
      await cleanupDailySellLinks({
        customerId: (record as any).customerId?.toString(),
        orderId: (record as any).orderId?.toString(),
        customerPaymentId: (record as any).customerPaymentId?.toString(),
        paymentId: (record as any).paymentId?.toString(),
        tractorPaymentId: (record as any).tractorPaymentId?.toString(),
      })
    } catch (cleanupErr) {
      console.error('[daily-sell DELETE] Cleanup error (non-blocking):', cleanupErr)
    }

    await DailySell.findByIdAndDelete(id)

    return NextResponse.json({ message: 'Daily sell entry deleted successfully' })
  } catch (error) {
    console.error('Error deleting daily sell entry:', error)
    return NextResponse.json({ error: 'Failed to delete daily sell entry' }, { status: 500 })
  }
}
