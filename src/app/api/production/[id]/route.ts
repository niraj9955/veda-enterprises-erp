import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Production } from '@/lib/models'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const production = await Production.findById(id)
    if (!production) {
      return NextResponse.json({ error: 'Production entry not found' }, { status: 404 })
    }
    return NextResponse.json({ production: toObject(production) })
  } catch (error) {
    console.error('Error fetching production:', error)
    return NextResponse.json({ error: 'Failed to fetch production entry' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = {}
    const fields = [
      'date',
      'customerId',
      'zigZagWhite80',
      'zigZagRed80',
      'zigZagYellow80',
      'zigZagWhite60',
      'zigZagRed60',
      'zigZagYellow60',
      'curveStone',
      'chequreTile',
      'transportationCharge',
      'remarks',
    ]
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }

    const production = await Production.findByIdAndUpdate(id, updateData, { new: true })
    if (!production) {
      return NextResponse.json({ error: 'Production entry not found' }, { status: 404 })
    }

    return NextResponse.json({ production: toObject(production) })
  } catch (error) {
    console.error('Error updating production:', error)
    return NextResponse.json({ error: 'Failed to update production entry' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params

    const production = await Production.findById(id)
    if (!production) {
      return NextResponse.json({ error: 'Production entry not found' }, { status: 404 })
    }

    // Note: Stock auto-update on production delete is intentionally omitted —
    // Production tracks daily output quantities per product, while Stock is a
    // separate daily snapshot. The two are reconciled via the Stock module UI.

    await Production.findByIdAndDelete(id)
    return NextResponse.json({ message: 'Production entry deleted successfully' })
  } catch (error) {
    console.error('Error deleting production:', error)
    return NextResponse.json({ error: 'Failed to delete production entry' }, { status: 500 })
  }
}
