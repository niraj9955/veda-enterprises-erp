import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { CustomerPayment } from '@/lib/models'

// Force dynamic — never cache individual responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Whitelist of updatable fields. Must match CustomerPaymentSchema in src/lib/models.ts.
const FIELDS = [
  'date',
  'name',
  'address',
  'amount',
  'remarks',
] as const

// GET /api/customer-payment/[id] — fetch a single customer-payment entry
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params
    const record = await CustomerPayment.findById(id).lean()
    if (!record) {
      return NextResponse.json({ error: 'customerPayment entry not found' }, { status: 404 })
    }
    return NextResponse.json({ customerPayment: toObject(record) })
  } catch (error) {
    console.error('Error fetching customer-payment entry:', error)
    return NextResponse.json({ error: 'Failed to fetch customer-payment entry' }, { status: 500 })
  }
}

// PUT /api/customer-payment/[id] — update a single customer-payment entry
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

    const record = await CustomerPayment.findByIdAndUpdate(id, updateData, { new: true })
    if (!record) {
      return NextResponse.json({ error: 'customerPayment entry not found' }, { status: 404 })
    }

    return NextResponse.json({ customerPayment: toObject(record) })
  } catch (error) {
    console.error('Error updating customer-payment entry:', error)
    return NextResponse.json({ error: 'Failed to update customer-payment entry' }, { status: 500 })
  }
}

// DELETE /api/customer-payment/[id] — delete a single customer-payment entry
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    const record = await CustomerPayment.findByIdAndDelete(id)
    if (!record) {
      return NextResponse.json({ error: 'customerPayment entry not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'customerPayment entry deleted successfully' })
  } catch (error) {
    console.error('Error deleting customer-payment entry:', error)
    return NextResponse.json({ error: 'Failed to delete customer-payment entry' }, { status: 500 })
  }
}
