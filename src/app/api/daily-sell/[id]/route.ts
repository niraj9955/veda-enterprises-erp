import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { DailySell } from '@/lib/models'

// Force dynamic — never cache individual daily-sell responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Whitelist of updatable fields. Must match DailySellSchema in src/lib/models.ts.
const DAILY_SELL_FIELDS = [
  'date',
  'customerName',
  'address',
  'contactNumber',
  'product',
  'quantity',
  'amount',
  'remarks',
] as const

// GET /api/daily-sell/[id] — fetch a single daily sell entry
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params
    const record = await DailySell.findById(id).lean()
    if (!record) {
      return NextResponse.json({ error: 'Daily sell entry not found' }, { status: 404 })
    }
    return NextResponse.json({ dailySell: toObject(record) })
  } catch (error) {
    console.error('Error fetching daily sell entry:', error)
    return NextResponse.json({ error: 'Failed to fetch daily sell entry' }, { status: 500 })
  }
}

// PUT /api/daily-sell/[id] — update a single daily sell entry
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = {}
    for (const field of DAILY_SELL_FIELDS) {
      if (body[field] !== undefined) {
        if (field === 'amount' || field === 'quantity') {
          updateData[field] = Number(body[field])
        } else {
          updateData[field] = String(body[field])
        }
      }
    }

    const record = await DailySell.findByIdAndUpdate(id, updateData, { new: true })
    if (!record) {
      return NextResponse.json({ error: 'Daily sell entry not found' }, { status: 404 })
    }

    return NextResponse.json({ dailySell: toObject(record) })
  } catch (error) {
    console.error('Error updating daily sell entry:', error)
    return NextResponse.json({ error: 'Failed to update daily sell entry' }, { status: 500 })
  }
}

// DELETE /api/daily-sell/[id] — delete a single daily sell entry
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    const record = await DailySell.findByIdAndDelete(id)
    if (!record) {
      return NextResponse.json({ error: 'Daily sell entry not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Daily sell entry deleted successfully' })
  } catch (error) {
    console.error('Error deleting daily sell entry:', error)
    return NextResponse.json({ error: 'Failed to delete daily sell entry' }, { status: 500 })
  }
}
