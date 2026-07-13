import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Payment } from '@/lib/models'
import { getSession } from '@/lib/auth'
import { syncDeleteCustomerPayment } from '@/lib/payment-customer-sync'

export const dynamic = 'force-dynamic'

// POST /api/payments/bulk-delete
// Body: { ids: string[] }
// Gated behind admin/operator session — accountants are read-only.
//
// For each Payment being deleted, we also delete the linked CustomerPayment
// mirror (if any) so the Customer Payment module stays in sync.
export async function POST(request: Request) {
  try {
    await connectDB()

    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized — please log in' },
        { status: 401 }
      )
    }
    if (session.role === 'accountant') {
      return NextResponse.json(
        { error: 'Forbidden — accountants cannot delete payments' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { ids } = body as { ids?: string[] }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids array is required and must be non-empty' },
        { status: 400 }
      )
    }

    // Best-effort: delete the CustomerPayment mirror for each Payment first
    // (so we can still read the `customerPaymentId` field before the Payment
    // itself is gone). Failures are logged inside the helper but never block
    // the parent delete.
    await Promise.all(ids.map((id) => syncDeleteCustomerPayment(id)))

    const result = await Payment.deleteMany({ _id: { $in: ids } })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'No matching payments found — they may have been already deleted' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: `${result.deletedCount} payment${result.deletedCount === 1 ? '' : 's'} deleted`,
      deletedCount: result.deletedCount,
      requestedCount: ids.length,
    })
  } catch (error) {
    console.error('Error bulk-deleting payments:', error)
    return NextResponse.json(
      { error: 'Failed to bulk-delete payments' },
      { status: 500 }
    )
  }
}
