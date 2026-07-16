import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { User } from '@/lib/models'
import { requireAdmin } from '@/lib/auth'

const VALID_ROLES = new Set(['admin', 'operator', 'accountant'])

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    await connectDB()
    const { id } = await params
    const user = await User.findById(id)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const obj = toObject(user)
    delete obj.password
    return NextResponse.json({ user: obj })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    await connectDB()
    const { id } = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }
      updateData.name = body.name.trim()
    }
    if (body.email !== undefined) {
      if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }
      updateData.email = body.email.trim()
    }
    if (body.role !== undefined) {
      if (!VALID_ROLES.has(body.role)) {
        return NextResponse.json(
          { error: `Invalid role. Must be one of: ${Array.from(VALID_ROLES).join(', ')}` },
          { status: 400 }
        )
      }
      updateData.role = body.role
    }
    if (body.active !== undefined) {
      updateData.active = Boolean(body.active)
    }

    // Handle password change separately
    if (body.password) {
      if (typeof body.password !== 'string' || body.password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
      }
      const bcrypt = await import('bcryptjs')
      updateData.password = await bcrypt.default.hash(body.password, 12)
    }

    const user = await User.findByIdAndUpdate(id, updateData, { new: true })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const obj = toObject(user)
    delete obj.password
    return NextResponse.json({ user: obj })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    await connectDB()
    const { id } = await params

    // Block self-delete — prevent admin from locking themselves out
    if (auth && typeof auth === 'object' && 'userId' in auth && auth.userId === id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Block deleting the LAST admin
    const adminCount = await User.countDocuments({ role: 'admin', active: true })
    const target = await User.findById(id).lean()
    if (target && target.role === 'admin' && target.active && adminCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot delete the last active admin account. Promote another user to admin first.' },
        { status: 400 }
      )
    }

    const user = await User.findByIdAndDelete(id)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
