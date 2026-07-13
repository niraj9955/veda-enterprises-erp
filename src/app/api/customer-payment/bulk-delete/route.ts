import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { CustomerPayment } from '@/lib/models'
import { getSession } from '@/lib/auth'

// Force dynamic — never cache
export const dynamic = 'force-dynamic'

// POST /api/customer-payment/bulk-delete
// Body: { ids: string[] }
// Deletes customer payment entries whose `_id` is in `ids`.
// Gated behind admin/operator session — accountants are read-only.
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
        { error: 'Forbidden — accountants cannot delete customer payment entries' },
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

    const result = await CustomerPayment.deleteMany({ _id: { $in: ids } })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'No matching customer payment entries found — they may have been already deleted' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: `${result.deletedCount} customer payment entr${result.deletedCount === 1 ? 'y' : 'ies'} deleted`,
      deletedCount: result.deletedCount,
      requestedCount: ids.length,
    })
  } catch (error) {
    console.error('Error bulk-deleting customer payments:', error)
    return NextResponse.json(
      { error: 'Failed to bulk-delete customer payment entries' },
      { status: 500 }
    )
  }
}
