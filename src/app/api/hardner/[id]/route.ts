import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Hardner } from '@/lib/models'
import { requireSession, requireRole } from '@/lib/auth'
import { normalizeDate } from '@/lib/date-utils'

// Force dynamic — never cache individual responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Whitelist of updatable fields. Must match HardnerSchema in src/lib/models.ts.
const FIELDS = [
  'date',
  'amount',
] as const

// GET /api/hardner/[id] — fetch a single hardner entry
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params
    const record = await Hardner.findById(id).lean()
    if (!record) {
      return NextResponse.json({ error: 'hardner entry not found' }, { status: 404 })
    }
    return NextResponse.json({ hardner: toObject(record) })
  } catch (error) {
    console.error('Error fetching hardner entry:', error)
    return NextResponse.json({ error: 'Failed to fetch hardner entry' }, { status: 500 })
  }
}

// PUT /api/hardner/[id] — update a single hardner entry
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(['admin', 'operator', 'accountant'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params
    const body = await request.json()
    // Normalize date to canonical YYYY-MM-DD
    // (handles dd-mm-yyyy, dd/mm/yyyy, Excel serials, Date objects, etc.)
    if (body.date) body.date = normalizeDate(body.date)

    const updateData: Record<string, unknown> = {}
    for (const field of FIELDS) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const record = await Hardner.findByIdAndUpdate(id, updateData, { new: true })
    if (!record) {
      return NextResponse.json({ error: 'hardner entry not found' }, { status: 404 })
    }

    return NextResponse.json({ hardner: toObject(record) })
  } catch (error) {
    console.error('Error updating hardner entry:', error)
    return NextResponse.json({ error: 'Failed to update hardner entry' }, { status: 500 })
  }
}

// DELETE /api/hardner/[id] — delete a single hardner entry
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(['admin', 'operator', 'accountant'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params

    const record = await Hardner.findByIdAndDelete(id)
    if (!record) {
      return NextResponse.json({ error: 'hardner entry not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'hardner entry deleted successfully' })
  } catch (error) {
    console.error('Error deleting hardner entry:', error)
    return NextResponse.json({ error: 'Failed to delete hardner entry' }, { status: 500 })
  }
}
