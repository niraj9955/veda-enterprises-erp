import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { TractorPayment } from '@/lib/models'

// Force dynamic — never cache individual responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Whitelist of updatable fields. Must match TractorPaymentSchema in src/lib/models.ts.
const FIELDS = [
  'date',
  'vendorName',
  'quantityTon',
  'rate',
  'totalAmount',
  'paidAmount',
  'remainingAmount',
  'remarks',
] as const

// GET /api/tractor-payment/[id] — fetch a single tractor-payment entry
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params
    const record = await TractorPayment.findById(id).lean()
    if (!record) {
      return NextResponse.json({ error: 'tractorPayment entry not found' }, { status: 404 })
    }
    return NextResponse.json({ tractorPayment: toObject(record) })
  } catch (error) {
    console.error('Error fetching tractor-payment entry:', error)
    return NextResponse.json({ error: 'Failed to fetch tractor-payment entry' }, { status: 500 })
  }
}

// PUT /api/tractor-payment/[id] — update a single tractor-payment entry
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = {}
    for (const field of FIELDS) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const record = await TractorPayment.findByIdAndUpdate(id, updateData, { new: true })
    if (!record) {
      return NextResponse.json({ error: 'tractorPayment entry not found' }, { status: 404 })
    }

    return NextResponse.json({ tractorPayment: toObject(record) })
  } catch (error) {
    console.error('Error updating tractor-payment entry:', error)
    return NextResponse.json({ error: 'Failed to update tractor-payment entry' }, { status: 500 })
  }
}

// DELETE /api/tractor-payment/[id] — delete a single tractor-payment entry
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    const record = await TractorPayment.findByIdAndDelete(id)
    if (!record) {
      return NextResponse.json({ error: 'tractorPayment entry not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'tractorPayment entry deleted successfully' })
  } catch (error) {
    console.error('Error deleting tractor-payment entry:', error)
    return NextResponse.json({ error: 'Failed to delete tractor-payment entry' }, { status: 500 })
  }
}
