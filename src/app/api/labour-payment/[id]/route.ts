import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { LabourPayment } from '@/lib/models'
import { requireSession, requireRole } from '@/lib/auth'

// Force dynamic — never cache individual responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Whitelist of updatable fields. Must match LabourPaymentSchema in src/lib/models.ts.
const FIELDS = [
  'date',
  'name',
  'address',
  'amount',
  'remarks',
] as const

// GET /api/labour-payment/[id] — fetch a single labour-payment entry
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params
    const record = await LabourPayment.findById(id).lean()
    if (!record) {
      return NextResponse.json({ error: 'labourPayment entry not found' }, { status: 404 })
    }
    return NextResponse.json({ labourPayment: toObject(record) })
  } catch (error) {
    console.error('Error fetching labour-payment entry:', error)
    return NextResponse.json({ error: 'Failed to fetch labour-payment entry' }, { status: 500 })
  }
}

// PUT /api/labour-payment/[id] — update a single labour-payment entry
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

    const updateData: Record<string, unknown> = {}
    for (const field of FIELDS) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const record = await LabourPayment.findByIdAndUpdate(id, updateData, { new: true })
    if (!record) {
      return NextResponse.json({ error: 'labourPayment entry not found' }, { status: 404 })
    }

    return NextResponse.json({ labourPayment: toObject(record) })
  } catch (error) {
    console.error('Error updating labour-payment entry:', error)
    return NextResponse.json({ error: 'Failed to update labour-payment entry' }, { status: 500 })
  }
}

// DELETE /api/labour-payment/[id] — delete a single labour-payment entry
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(['admin', 'operator', 'accountant'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params

    const record = await LabourPayment.findByIdAndDelete(id)
    if (!record) {
      return NextResponse.json({ error: 'labourPayment entry not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'labourPayment entry deleted successfully' })
  } catch (error) {
    console.error('Error deleting labour-payment entry:', error)
    return NextResponse.json({ error: 'Failed to delete labour-payment entry' }, { status: 500 })
  }
}
