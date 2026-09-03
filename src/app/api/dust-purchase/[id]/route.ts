import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { DustPurchase } from '@/lib/models'
import { requireSession, requireRole } from '@/lib/auth'
import { normalizeDate } from '@/lib/date-utils'

// Force dynamic — never cache individual responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Whitelist of updatable fields. Must match DustPurchaseSchema in src/lib/models.ts.
const FIELDS = [
  'date',
  'vendorName',
  'cementName',
  'quantity',
  'rate',
  'totalAmount',
  'paidAmount',
  'transportationCharge',
  'gst',
  'remarks',
] as const

// GET /api/dust-purchase/[id] — fetch a single dust-purchase entry
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params
    const record = await DustPurchase.findById(id).lean()
    if (!record) {
      return NextResponse.json({ error: 'dustPurchase entry not found' }, { status: 404 })
    }
    return NextResponse.json({ dustPurchase: toObject(record) })
  } catch (error) {
    console.error('Error fetching dust-purchase entry:', error)
    return NextResponse.json({ error: 'Failed to fetch dust-purchase entry' }, { status: 500 })
  }
}

// PUT /api/dust-purchase/[id] — update a single dust-purchase entry
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

    const record = await DustPurchase.findByIdAndUpdate(id, updateData, { new: true })
    if (!record) {
      return NextResponse.json({ error: 'dustPurchase entry not found' }, { status: 404 })
    }

    return NextResponse.json({ dustPurchase: toObject(record) })
  } catch (error) {
    console.error('Error updating dust-purchase entry:', error)
    return NextResponse.json({ error: 'Failed to update dust-purchase entry' }, { status: 500 })
  }
}

// DELETE /api/dust-purchase/[id] — delete a single dust-purchase entry
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(['admin', 'operator', 'accountant'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params

    const record = await DustPurchase.findByIdAndDelete(id)
    if (!record) {
      return NextResponse.json({ error: 'dustPurchase entry not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'dustPurchase entry deleted successfully' })
  } catch (error) {
    console.error('Error deleting dust-purchase entry:', error)
    return NextResponse.json({ error: 'Failed to delete dust-purchase entry' }, { status: 500 })
  }
}
