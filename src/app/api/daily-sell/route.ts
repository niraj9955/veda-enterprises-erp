import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { DailySell } from '@/lib/models'
import { requireRole } from '@/lib/auth'
import { syncAllFromDailySell } from '@/lib/daily-sell-sync'
import { normalizeDate } from '@/lib/date-utils'

// Force dynamic — never cache list responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const session = await requireRole(['admin', 'operator', 'accountant'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const records = await DailySell.find({}).sort({ date: -1 }).lean()
    return NextResponse.json({ dailySells: records.map(toObject) })
  } catch (error) {
    console.error('Error fetching daily sells:', error)
    return NextResponse.json({ error: 'Failed to fetch daily sells' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole(['admin', 'operator', 'accountant'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const body = await request.json()
    // Normalize date to canonical YYYY-MM-DD
    // (handles dd-mm-yyyy, dd/mm/yyyy, Excel serials, Date objects, etc.)
    if (body.date) body.date = normalizeDate(body.date)

    // ── Bulk delete: POST /api/daily-sell with { ids: [...] } ──────────
    // Admin/operator only — destructive bulk op.
    if (body && Array.isArray(body.ids)) {
      // Only admins can bulk-delete via this branch — operators/accountants must use the dedicated bulk-delete route
      if (session && typeof session === 'object' && 'role' in session && session.role !== 'admin') {
        return NextResponse.json(
          { error: 'Forbidden — only admins can bulk-delete via POST' },
          { status: 403 }
        )
      }
      const ids = body.ids.filter((id: unknown) => typeof id === 'string' && id.length > 0)
      if (ids.length === 0) {
        return NextResponse.json({ error: 'No ids provided' }, { status: 400 })
      }
      // Before deleting, fetch the records so we can clean up their linked
      // Order + CustomerPayment mirrors. Best-effort — cleanup failures
      // don't block the parent delete.
      try {
        const records = await DailySell.find({ _id: { $in: ids } }).lean()
        const { cleanupDailySellLinks } = await import('@/lib/daily-sell-sync')
        await Promise.all(
          records.map((r: any) =>
            cleanupDailySellLinks({
              customerId: r.customerId?.toString(),
              orderId: r.orderId?.toString(),
              customerPaymentId: r.customerPaymentId?.toString(),
              paymentId: r.paymentId?.toString(),
              tractorPaymentId: r.tractorPaymentId?.toString(),
            }).catch(() => {})
          )
        )
      } catch (cleanupErr) {
        console.error('[daily-sell bulk-delete] Cleanup error (non-blocking):', cleanupErr)
      }
      const result = await DailySell.deleteMany({ _id: { $in: ids } })
      return NextResponse.json({
        message: 'Daily sell entries deleted successfully',
        deletedCount: result.deletedCount || 0,
      })
    }

    if (!body.date || !body.customerName || body.amount == null) {
      return NextResponse.json({ error: 'Date, customer name and amount are required' }, { status: 400 })
    }

    // ── Multi-product support ────────────────────────────────────────
    // If the request includes a `products` array (>=1 item), we store it
    // AND use it to derive the legacy single-product fields as a SUMMARY:
    //   • product  = first product's name (with ", +N more" if multiple)
    //   • quantity = sum of all line-item quantities
    //   • amount   = sum of all line-item amounts
    //   • rate     = 0 (varies per item — meaningless as a single value)
    // If no `products` array is provided, fall back to the legacy single-
    // product path (use body.product/quantity/rate/amount as-is).
    type ProductEntry = { product: string; quantity: number; rate: number; amount: number }
    let products: ProductEntry[] = []
    if (Array.isArray(body.products) && body.products.length > 0) {
      products = body.products
        .filter((p: any) => p && typeof p === 'object')
        .map((p: any) => ({
          product: String(p.product || '').trim(),
          quantity: Number(p.quantity) || 0,
          rate: Number(p.rate) || 0,
          amount: Number(p.amount) || (Number(p.quantity) || 0) * (Number(p.rate) || 0),
        }))
    }

    const hasMulti = products.length > 0

    // Derive the legacy summary fields.
    let legacyProduct: string
    let legacyQuantity: number
    let legacyRate: number
    let legacyAmount: number

    if (hasMulti) {
      legacyProduct =
        products.length === 1
          ? products[0].product
          : `${products[0].product}, +${products.length - 1} more`
      legacyQuantity = products.reduce((s, p) => s + (Number(p.quantity) || 0), 0)
      legacyAmount = products.reduce((s, p) => s + (Number(p.amount) || 0), 0)
      legacyRate = 0
    } else {
      legacyProduct = String(body.product || '')
      legacyQuantity = Number(body.quantity) || 0
      legacyRate = Number(body.rate) || 0
      legacyAmount = Number(body.amount)
    }

    const received = Number(body.receivedAmount) || 0
    const pending = Math.max(0, legacyAmount - received)

    const record = await DailySell.create({
      date: body.date,
      customerName: body.customerName,
      address: body.address || '',
      contactNumber: body.contactNumber || '',
      product: legacyProduct,
      quantity: legacyQuantity,
      rate: legacyRate,
      amount: legacyAmount,
      transporterName: body.transporterName || '',
      transporterFair: Number(body.transporterFair) || 0,
      receivedAmount: received,
      pendingAmount: pending,
      products: hasMulti ? products : [],
      remarks: body.remarks || '',
    })

    // ── AUTO-SYNC to Customer, Order, Customer Payment, Payment, Tractor Payment, Stock ──
    // Best-effort: if any sub-sync fails, the DailySell record still
    // exists; the failure is recorded in `syncNotes` so the UI can
    // surface it to the user.
    try {
      const sync = await syncAllFromDailySell({
        dailySellId: String(record._id),
        date: body.date,
        customerName: body.customerName,
        address: body.address || '',
        contactNumber: body.contactNumber || '',
        product: legacyProduct,
        quantity: legacyQuantity,
        rate: legacyRate,
        amount: legacyAmount,
        transporterName: body.transporterName || '',
        transporterFair: Number(body.transporterFair) || 0,
        receivedAmount: received,
        pendingAmount: pending,
        remarks: body.remarks || '',
        products: hasMulti ? products : undefined,
      })
      record.customerId = sync.customerId as any
      record.orderId = sync.orderId as any
      record.customerPaymentId = sync.customerPaymentId as any
      record.paymentId = sync.paymentId as any
      record.tractorPaymentId = sync.tractorPaymentId as any
      record.syncNotes = sync.syncNotes
      await record.save()
    } catch (syncErr) {
      console.error('[daily-sell POST] Auto-sync failed (non-blocking):', syncErr)
      record.syncNotes = 'Auto-sync failed — entry saved but not mirrored to other modules'
      await record.save()
    }

    return NextResponse.json({ dailySell: toObject(record) }, { status: 201 })
  } catch (error) {
    console.error('Error creating daily sell:', error)
    return NextResponse.json({ error: 'Failed to create daily sell' }, { status: 500 })
  }
}

// DELETE /api/daily-sell?all=true — delete every daily sell entry
// (Delete All button). Mirrors the production delete-all API so the same
// client-side pattern works. Gated behind admin session — only admins can
// perform bulk destructive operations.
export async function DELETE(request: Request) {
  try {
    const session = await requireRole(['admin'])
    if (session instanceof NextResponse) return session

    await connectDB()

    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all')

    if (all === 'true' || all === '1') {
      // Before deleting everything, clean up linked Order + CustomerPayment
      // mirrors for each record. Best-effort — cleanup failures don't block
      // the parent delete.
      try {
        const records = await DailySell.find({}).lean()
        const { cleanupDailySellLinks } = await import('@/lib/daily-sell-sync')
        await Promise.all(
          records.map((r: any) =>
            cleanupDailySellLinks({
              customerId: r.customerId?.toString(),
              orderId: r.orderId?.toString(),
              customerPaymentId: r.customerPaymentId?.toString(),
              paymentId: r.paymentId?.toString(),
              tractorPaymentId: r.tractorPaymentId?.toString(),
            }).catch(() => {})
          )
        )
      } catch (cleanupErr) {
        console.error('[daily-sell delete-all] Cleanup error (non-blocking):', cleanupErr)
      }
      const result = await DailySell.deleteMany({})
      return NextResponse.json({
        message: 'All daily sell entries deleted successfully',
        deletedCount: result.deletedCount || 0,
      })
    }

    // Without ?all=true this route is not used for single deletes —
    // those go through /api/daily-sell/[id]. Return a clear error.
    return NextResponse.json(
      { error: 'Use DELETE /api/daily-sell/[id] for single deletes, or ?all=true to delete every entry.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error deleting daily sell entries:', error)
    return NextResponse.json({ error: 'Failed to delete daily sell entries' }, { status: 500 })
  }
}
