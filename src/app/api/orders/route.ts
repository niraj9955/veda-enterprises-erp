import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()

    const orders = await db.order.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // Fetch customers separately for SQLite compatibility
    const customerIds = [...new Set(orders.map((o) => o.customerId))]
    const customers = await db.customer.findMany({
      where: { id: { in: customerIds } },
    })

    const customerMap = new Map(customers.map((c) => [c.id, c]))

    const ordersWithCustomer = orders.map((order) => ({
      ...order,
      customer: customerMap.get(order.customerId) || null,
    }))

    return NextResponse.json({ orders: ordersWithCustomer, session })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    const body = await request.json()
    const { orderNumber, customerId, brickType, quantity, rate, amount, deliveryDate, status } = body

    if (!customerId || !brickType || !quantity || !rate || !amount || !deliveryDate) {
      return NextResponse.json(
        { error: 'customerId, brickType, quantity, rate, amount, and deliveryDate are required' },
        { status: 400 }
      )
    }

    const generatedOrderNumber = orderNumber || `ORD-${Date.now()}`

    const order = await db.order.create({
      data: {
        orderNumber: generatedOrderNumber,
        customerId,
        brickType,
        quantity,
        rate,
        amount,
        deliveryDate,
        status: status || 'Pending',
      },
    })

    return NextResponse.json(
      { order, session },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}
