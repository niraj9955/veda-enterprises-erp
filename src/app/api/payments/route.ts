import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()

    const payments = await db.payment.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // Fetch customers separately for SQLite compatibility
    const customerIds = [...new Set(payments.map((p) => p.customerId))]
    const customers = await db.customer.findMany({
      where: { id: { in: customerIds } },
    })

    const customerMap = new Map(customers.map((c) => [c.id, c]))

    const paymentsWithCustomer = payments.map((payment) => ({
      ...payment,
      customer: customerMap.get(payment.customerId) || null,
    }))

    return NextResponse.json({ payments: paymentsWithCustomer, session })
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    const body = await request.json()
    const { customerId, paymentType, amount, date, remarks } = body

    if (!customerId || !paymentType || !amount || !date) {
      return NextResponse.json(
        { error: 'customerId, paymentType, amount, and date are required' },
        { status: 400 }
      )
    }

    const payment = await db.payment.create({
      data: {
        customerId,
        paymentType,
        amount,
        date,
        remarks: remarks || '',
      },
    })

    return NextResponse.json(
      { payment, session },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    )
  }
}
