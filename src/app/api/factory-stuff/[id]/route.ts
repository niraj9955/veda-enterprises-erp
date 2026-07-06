import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { FactoryStuff } from '@/lib/models'

// Force dynamic — never cache individual responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Whitelist of updatable fields. Must match FactoryStuffSchema in src/lib/models.ts.
const FIELDS = [
  'date',
  'itemName',
  'quantity',
  'amount',
  'remarks',
] as const

// GET /api/factory-stuff/[id] — fetch a single factory-stuff entry
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params
    const record = await FactoryStuff.findById(id).lean()
    if (!record) {
      return NextResponse.json({ error: 'factoryStuff entry not found' }, { status: 404 })
    }
    return NextResponse.json({ factoryStuff: toObject(record) })
  } catch (error) {
    console.error('Error fetching factory-stuff entry:', error)
    return NextResponse.json({ error: 'Failed to fetch factory-stuff entry' }, { status: 500 })
  }
}

// PUT /api/factory-stuff/[id] — update a single factory-stuff entry
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

    const record = await FactoryStuff.findByIdAndUpdate(id, updateData, { new: true })
    if (!record) {
      return NextResponse.json({ error: 'factoryStuff entry not found' }, { status: 404 })
    }

    return NextResponse.json({ factoryStuff: toObject(record) })
  } catch (error) {
    console.error('Error updating factory-stuff entry:', error)
    return NextResponse.json({ error: 'Failed to update factory-stuff entry' }, { status: 500 })
  }
}

// DELETE /api/factory-stuff/[id] — delete a single factory-stuff entry
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    const record = await FactoryStuff.findByIdAndDelete(id)
    if (!record) {
      return NextResponse.json({ error: 'factoryStuff entry not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'factoryStuff entry deleted successfully' })
  } catch (error) {
    console.error('Error deleting factory-stuff entry:', error)
    return NextResponse.json({ error: 'Failed to delete factory-stuff entry' }, { status: 500 })
  }
}
