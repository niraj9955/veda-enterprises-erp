import { NextResponse } from 'next/server'
import { connectDB, toObject, extractCustomer } from '@/lib/db'
import { Order } from '@/lib/models'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const order = await Order.findById(id).populate('customerId')
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    const obj = toObject(order)
    const { customer, customerId } = extractCustomer(order)
    obj.customer = customer
    obj.customerId = customerId
    return NextResponse.json({ order: obj })
  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = {}
    const fields = ['customerId', 'brickType', 'quantity', 'rate', 'amount', 'deliveryDate', 'status']
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }

    // Items array — when provided, normalize each item and recompute
    // the summary quantity/rate/amount fields so they stay in sync.
    if (Array.isArray(body.items)) {
      const items = body.items
        .map((it: any) => ({
          description: String(it.description || '').trim(),
          hsn: String(it.hsn || ''),
          quantity: Number(it.quantity) || 0,
          unit: String(it.unit || 'pcs'),
          rate: Number(it.rate) || 0,
          amount: Number(it.amount) || (Number(it.quantity) || 0) * (Number(it.rate) || 0),
        }))
        .filter((it: any) => it.description)
      updateData.items = items
      if (items.length > 0) {
        const totalQty = items.reduce((s: number, it: any) => s + it.quantity, 0)
        const totalAmt = items.reduce((s: number, it: any) => s + it.amount, 0)
        updateData.quantity = totalQty
        updateData.amount = totalAmt
        updateData.rate = totalQty > 0 ? totalAmt / totalQty : 0
        if (!updateData.brickType) updateData.brickType = items[0].description
      }
    }

    const order = await Order.findByIdAndUpdate(id, updateData, { new: true }).populate('customerId')
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const obj = toObject(order)
    const { customer, customerId } = extractCustomer(order)
    obj.customer = customer
    obj.customerId = customerId
    return NextResponse.json({ order: obj })
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const order = await Order.findByIdAndDelete(id)
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    return NextResponse.json({ message: 'Order deleted successfully' })
  } catch (error) {
    console.error('Error deleting order:', error)
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })
  }
}
