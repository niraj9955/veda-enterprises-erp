import { NextResponse } from 'next/server'
import { connectDB, toObject, extractCustomer } from '@/lib/db'
import { Payment } from '@/lib/models'

// Force dynamic — never cache list responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    await connectDB()
    const payments = await Payment.find({}).populate('customerId').sort({ createdAt: -1 })

    const result = payments.map((p: any) => {
      const obj = toObject(p)
      const { customer, customerId } = extractCustomer(p)
      obj.customer = customer
      obj.customerId = customerId
      return obj
    })

    return NextResponse.json({ payments: result })
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()

    if (!body.customerId || !body.paymentType || !body.amount || !body.date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const payment = await Payment.create({
      customerId: body.customerId,
      paymentType: body.paymentType,
      amount: Number(body.amount),
      date: body.date,
      remarks: body.remarks || '',
    })

    const populated = await Payment.findById(payment._id).populate('customerId')
    const obj = toObject(populated)
    const { customer, customerId } = extractCustomer(populated)
    obj.customer = customer
    obj.customerId = customerId

    return NextResponse.json({ payment: obj }, { status: 201 })
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}
