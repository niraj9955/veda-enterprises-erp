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

    const payment = await db.payment.findUnique({
      where: { id },
    })

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ payment, session })
  } catch (error) {
    console.error('Error fetching payment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment' },
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

    const existing = await db.payment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      )
    }

    const payment = await db.payment.update({
      where: { id },
      data: {
        ...(body.customerId !== undefined && { customerId: body.customerId }),
        ...(body.paymentType !== undefined && { paymentType: body.paymentType }),
        ...(body.amount !== undefined && { amount: body.amount }),
        ...(body.date !== undefined && { date: body.date }),
        ...(body.remarks !== undefined && { remarks: body.remarks }),
      },
    })

    return NextResponse.json({ payment, session })
  } catch (error) {
    console.error('Error updating payment:', error)
    return NextResponse.json(
      { error: 'Failed to update payment' },
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

    const existing = await db.payment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      )
    }

    await db.payment.delete({ where: { id } })

    return NextResponse.json(
      { message: 'Payment deleted successfully', session },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting payment:', error)
    return NextResponse.json(
      { error: 'Failed to delete payment' },
      { status: 500 }
    )
  }
}
