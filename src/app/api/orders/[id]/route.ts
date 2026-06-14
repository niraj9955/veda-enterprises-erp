import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const { id } = await params

    const order = await db.order.findUnique({
      where: { id },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Fetch customer separately for SQLite compatibility
    const customer = await db.customer.findUnique({
      where: { id: order.customerId },
    })

    return NextResponse.json({ order: { ...order, customer }, session })
  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const { id } = await params
    const body = await request.json()

    const existing = await db.order.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    const order = await db.order.update({
      where: { id },
      data: {
        ...(body.orderNumber !== undefined && { orderNumber: body.orderNumber }),
        ...(body.customerId !== undefined && { customerId: body.customerId }),
        ...(body.brickType !== undefined && { brickType: body.brickType }),
        ...(body.quantity !== undefined && { quantity: body.quantity }),
        ...(body.rate !== undefined && { rate: body.rate }),
        ...(body.amount !== undefined && { amount: body.amount }),
        ...(body.deliveryDate !== undefined && { deliveryDate: body.deliveryDate }),
        ...(body.status !== undefined && { status: body.status }),
      },
    })

    return NextResponse.json({ order, session })
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const { id } = await params

    const existing = await db.order.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    await db.order.delete({ where: { id } })

    return NextResponse.json(
      { message: 'Order deleted successfully', session },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting order:', error)
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    )
  }
}
