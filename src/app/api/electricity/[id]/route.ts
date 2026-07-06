import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Electricity } from '@/lib/models'

// Force dynamic — never cache individual responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Whitelist of updatable fields. Must match ElectricitySchema in src/lib/models.ts.
const FIELDS = [
  'date',
  'name',
  'work',
  'amount',
  'remarks',
] as const

// GET /api/electricity/[id] — fetch a single electricity entry
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params
    const record = await Electricity.findById(id).lean()
    if (!record) {
      return NextResponse.json({ error: 'electricity entry not found' }, { status: 404 })
    }
    return NextResponse.json({ electricity: toObject(record) })
  } catch (error) {
    console.error('Error fetching electricity entry:', error)
    return NextResponse.json({ error: 'Failed to fetch electricity entry' }, { status: 500 })
  }
}

// PUT /api/electricity/[id] — update a single electricity entry
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

    const record = await Electricity.findByIdAndUpdate(id, updateData, { new: true })
    if (!record) {
      return NextResponse.json({ error: 'electricity entry not found' }, { status: 404 })
    }

    return NextResponse.json({ electricity: toObject(record) })
  } catch (error) {
    console.error('Error updating electricity entry:', error)
    return NextResponse.json({ error: 'Failed to update electricity entry' }, { status: 500 })
  }
}

// DELETE /api/electricity/[id] — delete a single electricity entry
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    const record = await Electricity.findByIdAndDelete(id)
    if (!record) {
      return NextResponse.json({ error: 'electricity entry not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'electricity entry deleted successfully' })
  } catch (error) {
    console.error('Error deleting electricity entry:', error)
    return NextResponse.json({ error: 'Failed to delete electricity entry' }, { status: 500 })
  }
}
