import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Dispatch } from '@/lib/models'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/dispatch/bulk-delete
// Body: { ids: string[] }
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
        { error: 'Forbidden — accountants cannot delete dispatch entries' },
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

    const result = await Dispatch.deleteMany({ _id: { $in: ids } })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'No matching dispatch entries found — they may have been already deleted' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: `${result.deletedCount} dispatch entr${result.deletedCount === 1 ? 'y' : 'ies'} deleted`,
      deletedCount: result.deletedCount,
      requestedCount: ids.length,
    })
  } catch (error) {
    console.error('Error bulk-deleting dispatches:', error)
    return NextResponse.json(
      { error: 'Failed to bulk-delete dispatch entries' },
      { status: 500 }
    )
  }
}
