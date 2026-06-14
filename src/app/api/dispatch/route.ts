import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()

    const dispatches = await db.dispatch.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // Fetch customers separately for SQLite compatibility
    const customerIds = [...new Set(dispatches.map((d) => d.customerId))]
    const customers = await db.customer.findMany({
      where: { id: { in: customerIds } },
    })

    const customerMap = new Map(customers.map((c) => [c.id, c]))

    // Fetch orders separately for SQLite compatibility
    const orderIds = dispatches.filter((d) => d.orderId).map((d) => d.orderId!)
    const orderMap = new Map<string, { id: string; orderNumber: string }>()
    if (orderIds.length > 0) {
      const uniqueOrderIds = [...new Set(orderIds)]
      const orders = await db.order.findMany({
        where: { id: { in: uniqueOrderIds } },
      })
      orders.forEach((o) => orderMap.set(o.id, { id: o.id, orderNumber: o.orderNumber }))
    }

    const dispatchesWithRelations = dispatches.map((dispatch) => ({
      ...dispatch,
      customer: customerMap.get(dispatch.customerId) || null,
      order: dispatch.orderId ? orderMap.get(dispatch.orderId) || null : null,
    }))

    return NextResponse.json({ dispatches: dispatchesWithRelations, session })
  } catch (error) {
    console.error('Error fetching dispatches:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dispatches' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    const body = await request.json()
    const { dispatchNumber, customerId, orderId, truckNumber, driverName, quantity, brickType, date } = body

    if (!customerId || !truckNumber || !driverName || !quantity || !brickType || !date) {
      return NextResponse.json(
        { error: 'customerId, truckNumber, driverName, quantity, brickType, and date are required' },
        { status: 400 }
      )
    }

    const generatedDispatchNumber = dispatchNumber || `DSP-${Date.now()}`

    const dispatch = await db.dispatch.create({
      data: {
        dispatchNumber: generatedDispatchNumber,
        customerId,
        orderId: orderId || null,
        truckNumber,
        driverName,
        quantity,
        brickType,
        date,
      },
    })

    // Update stock: decrement currentStock by quantity for that brickType
    const existingStock = await db.stock.findUnique({
      where: { brickType },
    })

    if (existingStock) {
      await db.stock.update({
        where: { brickType },
        data: {
          currentStock: Math.max(0, existingStock.currentStock - quantity),
        },
      })
    } else {
      // Create stock entry with negative (shouldn't normally happen but handle gracefully)
      await db.stock.create({
        data: {
          brickType,
          openingStock: 0,
          currentStock: Math.max(0, -quantity),
        },
      })
    }

    return NextResponse.json(
      { dispatch, session },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating dispatch:', error)
    return NextResponse.json(
      { error: 'Failed to create dispatch' },
      { status: 500 }
    )
  }
}
