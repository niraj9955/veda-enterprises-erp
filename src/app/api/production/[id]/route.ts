import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Production, Stock } from '@/lib/models'

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
    const fields = ['date', 'brickType', 'quantityProduced', 'shift', 'remarks']
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

    // Reduce stock
    const stock = await Stock.findOne({ brickType: production.brickType })
    if (stock) {
      stock.currentStock = Math.max(0, stock.currentStock - production.quantityProduced)
      await stock.save()
    }

    await Production.findByIdAndDelete(id)
    return NextResponse.json({ message: 'Production entry deleted successfully' })
  } catch (error) {
    console.error('Error deleting production:', error)
    return NextResponse.json({ error: 'Failed to delete production entry' }, { status: 500 })
  }
}
