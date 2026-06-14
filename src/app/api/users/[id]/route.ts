import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { User } from '@/lib/models'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
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
    await connectDB()
    const { id } = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.email !== undefined) updateData.email = body.email
    if (body.role !== undefined) updateData.role = body.role
    if (body.active !== undefined) updateData.active = body.active

    // Handle password change separately
    if (body.password) {
      const bcrypt = await import('bcryptjs')
      updateData.password = await bcrypt.default.hash(body.password, 10)
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
    await connectDB()
    const { id } = await params
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
