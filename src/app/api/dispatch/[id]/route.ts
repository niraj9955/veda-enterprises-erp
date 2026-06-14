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

    const dispatch = await db.dispatch.findUnique({
      where: { id },
    })

    if (!dispatch) {
      return NextResponse.json(
        { error: 'Dispatch not found' },
        { status: 404 }
      )
    }

    // Fetch customer and order separately for SQLite compatibility
    const customer = await db.customer.findUnique({
      where: { id: dispatch.customerId },
    })

    let order = null
    if (dispatch.orderId) {
      order = await db.order.findUnique({
        where: { id: dispatch.orderId },
      })
    }

    return NextResponse.json({
      dispatch: { ...dispatch, customer, order },
      session,
    })
  } catch (error) {
    console.error('Error fetching dispatch:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dispatch' },
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

    const existing = await db.dispatch.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Dispatch not found' },
        { status: 404 }
      )
    }

    const dispatch = await db.dispatch.update({
      where: { id },
      data: {
        ...(body.dispatchNumber !== undefined && { dispatchNumber: body.dispatchNumber }),
        ...(body.customerId !== undefined && { customerId: body.customerId }),
        ...(body.orderId !== undefined && { orderId: body.orderId }),
        ...(body.truckNumber !== undefined && { truckNumber: body.truckNumber }),
        ...(body.driverName !== undefined && { driverName: body.driverName }),
        ...(body.quantity !== undefined && { quantity: body.quantity }),
        ...(body.brickType !== undefined && { brickType: body.brickType }),
        ...(body.date !== undefined && { date: body.date }),
      },
    })

    return NextResponse.json({ dispatch, session })
  } catch (error) {
    console.error('Error updating dispatch:', error)
    return NextResponse.json(
      { error: 'Failed to update dispatch' },
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

    const existing = await db.dispatch.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Dispatch not found' },
        { status: 404 }
      )
    }

    await db.dispatch.delete({ where: { id } })

    return NextResponse.json(
      { message: 'Dispatch deleted successfully', session },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting dispatch:', error)
    return NextResponse.json(
      { error: 'Failed to delete dispatch' },
      { status: 500 }
    )
  }
}
