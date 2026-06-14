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
