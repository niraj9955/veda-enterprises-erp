import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { CementPurchase } from '@/lib/models'
import { requireSession, requireRole } from '@/lib/auth'
import { normalizeDate } from '@/lib/date-utils'

// Force dynamic — never cache individual responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Whitelist of updatable fields. Must match CementPurchaseSchema in src/lib/models.ts.
const FIELDS = [
  'date',
  'vendorName',
  'itemName',
  'quantity',
  'rate',
  'totalAmount',
  'paidAmount',
  'transportationCharge',
  'gst',
  'remarks',
] as const

// GET /api/cement-purchase/[id] — fetch a single cement-purchase entry
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params
    const record = await CementPurchase.findById(id).lean()
    if (!record) {
      return NextResponse.json({ error: 'cementPurchase entry not found' }, { status: 404 })
    }
    return NextResponse.json({ cementPurchase: toObject(record) })
  } catch (error) {
    console.error('Error fetching cement-purchase entry:', error)
    return NextResponse.json({ error: 'Failed to fetch cement-purchase entry' }, { status: 500 })
  }
}

// PUT /api/cement-purchase/[id] — update a single cement-purchase entry
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

    const record = await CementPurchase.findByIdAndUpdate(id, updateData, { new: true })
    if (!record) {
      return NextResponse.json({ error: 'cementPurchase entry not found' }, { status: 404 })
    }

    return NextResponse.json({ cementPurchase: toObject(record) })
  } catch (error) {
    console.error('Error updating cement-purchase entry:', error)
    return NextResponse.json({ error: 'Failed to update cement-purchase entry' }, { status: 500 })
  }
}

// DELETE /api/cement-purchase/[id] — delete a single cement-purchase entry
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(['admin', 'operator', 'accountant'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params

    const record = await CementPurchase.findByIdAndDelete(id)
    if (!record) {
      return NextResponse.json({ error: 'cementPurchase entry not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'cementPurchase entry deleted successfully' })
  } catch (error) {
    console.error('Error deleting cement-purchase entry:', error)
    return NextResponse.json({ error: 'Failed to delete cement-purchase entry' }, { status: 500 })
  }
}
