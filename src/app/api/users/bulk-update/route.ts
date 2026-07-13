import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/users/bulk-update
// Body: { ids: string[], active: boolean }
// Admin-only — bulk activate / deactivate users in one call.
// Self-deactivation is blocked (you can't lock yourself out by accident).
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
        { error: 'Forbidden — only admins can bulk-update users' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { ids, active } = body as { ids?: string[]; active?: boolean }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids array is required and must be non-empty' },
        { status: 400 }
      )
    }
    if (typeof active !== 'boolean') {
      return NextResponse.json(
        { error: 'active (boolean) is required' },
        { status: 400 }
      )
    }

    // If deactivating, block self-deactivation AND block deactivating the last admin
    if (active === false) {
      if (session.userId && ids.includes(session.userId)) {
        return NextResponse.json(
          { error: 'Cannot deactivate your own account. Remove yourself from the selection first.' },
          { status: 400 }
        )
      }
      const adminCount = await User.countDocuments({ role: 'admin', active: true })
      const adminsBeingDeactivated = await User.countDocuments({
        _id: { $in: ids },
        role: 'admin',
        active: true,
      })
      if (adminCount > 0 && adminsBeingDeactivated >= adminCount) {
        return NextResponse.json(
          { error: 'Cannot deactivate the last active admin. Promote another user to admin first.' },
          { status: 400 }
        )
      }
    }

    const result = await User.updateMany(
      { _id: { $in: ids } },
      { $set: { active } }
    )

    if (result.modifiedCount === 0 && result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'No matching users found' },
        { status: 404 }
      )
    }

    const action = active ? 'activated' : 'deactivated'
    return NextResponse.json({
      message: `${result.modifiedCount} user${result.modifiedCount === 1 ? '' : 's'} ${action}`,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
      requestedCount: ids.length,
      active,
    })
  } catch (error) {
    console.error('Error bulk-updating users:', error)
    return NextResponse.json(
      { error: 'Failed to bulk-update users' },
      { status: 500 }
    )
  }
}
