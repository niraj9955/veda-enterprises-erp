import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Bill } from '@/lib/models'
import { getSession } from '@/lib/auth'

// GET single bill
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const bill = await Bill.findById(id).lean()
    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }
    return NextResponse.json({ bill: toObject(bill) })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch bill' }, { status: 500 })
  }
}

// PUT — update bill
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const existing = await Bill.findById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    // Recalculate amounts if items changed
    const items = Array.isArray(body.items) ? body.items : existing.items
    const subTotal = items.reduce((sum: number, item: Record<string, number>) => sum + (Number(item.amount) || 0), 0)
    const discountPercent = body.discountPercent !== undefined ? Number(body.discountPercent) : existing.discountPercent
    const discountAmount = body.discountAmount !== undefined ? Number(body.discountAmount) : (subTotal * discountPercent / 100)
    const taxableAmount = subTotal - discountAmount

    const cgstPercent = body.cgstPercent !== undefined ? Number(body.cgstPercent) : existing.cgstPercent
    const cgstAmount = taxableAmount * cgstPercent / 100
    const sgstPercent = body.sgstPercent !== undefined ? Number(body.sgstPercent) : existing.sgstPercent
    const sgstAmount = taxableAmount * sgstPercent / 100
    const igstPercent = body.igstPercent !== undefined ? Number(body.igstPercent) : existing.igstPercent
    const igstAmount = taxableAmount * igstPercent / 100

    const totalBeforeRound = taxableAmount + cgstAmount + sgstAmount + igstAmount
    const grandTotal = Math.round(totalBeforeRound)
    const roundOff = grandTotal - totalBeforeRound

    const paidAmount = body.paidAmount !== undefined ? Number(body.paidAmount) : existing.paidAmount
    const balanceAmount = grandTotal - paidAmount

    const updateData: Record<string, unknown> = {
      ...body,
      items,
      subTotal,
      discountPercent,
      discountAmount,
      taxableAmount,
      cgstPercent, cgstAmount,
      sgstPercent, sgstAmount,
      igstPercent, igstAmount,
      roundOff,
      grandTotal,
      paidAmount,
      balanceAmount,
    }

    if (body.status !== undefined) {
      updateData.status = body.status
    } else if (paidAmount >= grandTotal && grandTotal > 0) {
      updateData.status = 'paid'
    } else if (paidAmount > 0) {
      updateData.status = 'partial'
    }

    const updated = await Bill.findByIdAndUpdate(id, updateData, { new: true })
    return NextResponse.json({ bill: toObject(updated) })
  } catch (error) {
    console.error('Error updating bill:', error)
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 })
  }
}

// DELETE bill
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const deleted = await Bill.findByIdAndDelete(id)
    if (!deleted) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }
    return NextResponse.json({ message: 'Bill deleted successfully' })
  } catch {
    return NextResponse.json({ error: 'Failed to delete bill' }, { status: 500 })
  }
}
