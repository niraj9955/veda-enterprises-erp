import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { DailySell } from '@/lib/models'
import { getSession } from '@/lib/auth'
import { syncAllFromDailySell } from '@/lib/daily-sell-sync'

// Force dynamic — never cache list responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
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
    await connectDB()
    const body = await request.json()

    // ── Bulk delete: POST /api/daily-sell with { ids: [...] } ──────────
    // Mirrors the production bulk-delete API so the same client-side
    // multi-select pattern works for both modules.
    if (body && Array.isArray(body.ids)) {
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
    const amount = Number(body.amount)
    const received = Number(body.receivedAmount) || 0
    const pending = Math.max(0, amount - received)
    const record = await DailySell.create({
      date: body.date,
      customerName: body.customerName,
      address: body.address || '',
      contactNumber: body.contactNumber || '',
      product: body.product || '',
      quantity: Number(body.quantity) || 0,
      rate: Number(body.rate) || 0,
      amount,
      transporterName: body.transporterName || '',
      transporterFair: Number(body.transporterFair) || 0,
      receivedAmount: received,
      pendingAmount: pending,
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
        product: body.product || '',
        quantity: Number(body.quantity) || 0,
        rate: Number(body.rate) || 0,
        amount,
        transporterName: body.transporterName || '',
        transporterFair: Number(body.transporterFair) || 0,
        receivedAmount: received,
        pendingAmount: pending,
        remarks: body.remarks || '',
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
    await connectDB()
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized — only admins can delete all daily sell entries' },
        { status: 403 }
      )
    }

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
