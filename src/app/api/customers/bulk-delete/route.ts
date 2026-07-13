import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Customer, Order, Payment, CustomerPayment, Production, Dispatch } from '@/lib/models'
import { getSession } from '@/lib/auth'

// Force dynamic — never cache
export const dynamic = 'force-dynamic'

// POST /api/customers/bulk-delete
// Body: { ids: string[] }
// Deletes the customers whose `_id` is in `ids`.
// Also nulls-out (or disassociates) references in linked collections so
// historical orders / payments don't carry dangling customerId pointers —
// we set customerId = null instead of hard-deleting the financial records
// because the user may still want the audit trail of past transactions.
// Gated behind admin/operator session — accountants cannot bulk-delete.
export async function POST(request: Request) {
  try {
    await connectDB()

    // Auth gate
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized — please log in' },
        { status: 401 }
      )
    }
    if (session.role === 'accountant') {
      return NextResponse.json(
        { error: 'Forbidden — accountants cannot delete customers' },
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

    // Verify the customers exist (so we can give an accurate error if
    // they were already deleted by another tab/session).
    const existing = await Customer.find({ _id: { $in: ids } })
      .select('_id name')
      .lean()

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'No matching customers found — they may have been already deleted' },
        { status: 404 }
      )
    }

    const validIds = existing.map((c) => String(c._id))

    // Delete the customer documents
    const result = await Customer.deleteMany({ _id: { $in: validIds } })

    // Disassociate linked financial records — keep the audit trail but
    // remove the dangling customerId pointer so orders/payments don't
    // show a phantom customer name in their UIs.
    try {
      await Promise.all([
        Order.updateMany({ customerId: { $in: validIds } }, { $set: { customerId: null } }),
        Payment.updateMany({ customerId: { $in: validIds } }, { $set: { customerId: null } }),
        CustomerPayment.updateMany({ customerId: { $in: validIds } }, { $set: { customerId: null } }),
        Production.updateMany({ customerId: { $in: validIds } }, { $set: { customerId: null } }),
        Dispatch.updateMany({ customerId: { $in: validIds } }, { $set: { customerId: null } }),
      ])
    } catch (err) {
      console.error('[POST /customers/bulk-delete] Linked record cleanup failed:', err)
      // Don't fail the request — customers were already deleted.
    }

    return NextResponse.json({
      message: `${result.deletedCount} customer${result.deletedCount === 1 ? '' : 's'} deleted`,
      deletedCount: result.deletedCount,
      requestedCount: ids.length,
    })
  } catch (error) {
    console.error('Error bulk-deleting customers:', error)
    return NextResponse.json(
      { error: 'Failed to bulk-delete customers' },
      { status: 500 }
    )
  }
}
