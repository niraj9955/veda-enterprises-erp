import { NextResponse } from 'next/server'
import { connectDB, toObject, extractCustomer } from '@/lib/db'
import { Dispatch, Stock } from '@/lib/models'
import { requireSession, requireRole } from '@/lib/auth'
import { normalizeDate } from '@/lib/date-utils'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params
    const dispatch = await Dispatch.findById(id).populate('customerId').populate('orderId')
    if (!dispatch) {
      return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 })
    }
    const obj = toObject(dispatch)
    const { customer, customerId } = extractCustomer(dispatch)
    obj.customer = customer
    obj.customerId = customerId
    return NextResponse.json({ dispatch: obj })
  } catch (error) {
    console.error('Error fetching dispatch:', error)
    return NextResponse.json({ error: 'Failed to fetch dispatch' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(['admin', 'operator'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params
    const body = await request.json()
    // Normalize date to canonical YYYY-MM-DD
    // (handles dd-mm-yyyy, dd/mm/yyyy, Excel serials, Date objects, etc.)
    if (body.date) body.date = normalizeDate(body.date)

    const updateData: Record<string, unknown> = {}
    const fields = ['customerId', 'orderId', 'truckNumber', 'driverName', 'quantity', 'brickType', 'date']
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }

    const dispatch = await Dispatch.findByIdAndUpdate(id, updateData, { new: true }).populate('customerId')
    if (!dispatch) {
      return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 })
    }

    const obj = toObject(dispatch)
    const { customer, customerId } = extractCustomer(dispatch)
    obj.customer = customer
    obj.customerId = customerId
    return NextResponse.json({ dispatch: obj })
  } catch (error) {
    console.error('Error updating dispatch:', error)
    return NextResponse.json({ error: 'Failed to update dispatch' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(['admin', 'operator'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params

    const dispatch = await Dispatch.findById(id)
    if (!dispatch) {
      return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 })
    }

    // Restore stock on delete
    const stock = await Stock.findOne({ brickType: dispatch.brickType })
    if (stock) {
      stock.currentStock += dispatch.quantity
      await stock.save()
    }

    await Dispatch.findByIdAndDelete(id)
    return NextResponse.json({ message: 'Dispatch deleted successfully' })
  } catch (error) {
    console.error('Error deleting dispatch:', error)
    return NextResponse.json({ error: 'Failed to delete dispatch' }, { status: 500 })
  }
}
