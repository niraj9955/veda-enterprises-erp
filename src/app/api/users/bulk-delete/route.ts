import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/users/bulk-delete
// Body: { ids: string[] }
// Admin-only — operators and accountants cannot delete users.
// Self-delete is blocked (you can't delete your own account).
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
    if (session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden — only admins can delete users' },
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

    // Block self-delete — prevent admin from locking themselves out
    if (session.userId && ids.includes(session.userId)) {
      return NextResponse.json(
        { error: 'Cannot delete your own account. Remove yourself from the selection first.' },
        { status: 400 }
      )
    }

    // Also block deleting the LAST admin — would lock everyone out of admin panel
    const adminCount = await User.countDocuments({ role: 'admin', active: true })
    const adminsBeingDeleted = await User.countDocuments({
      _id: { $in: ids },
      role: 'admin',
      active: true,
    })
    if (adminCount > 0 && adminsBeingDeleted >= adminCount) {
      return NextResponse.json(
        { error: 'Cannot delete the last active admin account. Promote another user to admin first.' },
        { status: 400 }
      )
    }

    const result = await User.deleteMany({ _id: { $in: ids } })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'No matching users found — they may have been already deleted' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: `${result.deletedCount} user${result.deletedCount === 1 ? '' : 's'} deleted`,
      deletedCount: result.deletedCount,
      requestedCount: ids.length,
    })
  } catch (error) {
    console.error('Error bulk-deleting users:', error)
    return NextResponse.json(
      { error: 'Failed to bulk-delete users' },
      { status: 500 }
    )
  }
}
