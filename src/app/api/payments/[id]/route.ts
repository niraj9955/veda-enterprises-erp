import { NextResponse } from 'next/server'
import { connectDB, toObject, extractCustomer } from '@/lib/db'
import { Payment } from '@/lib/models'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const payment = await Payment.findById(id).populate('customerId')
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }
    const obj = toObject(payment)
    const { customer, customerId } = extractCustomer(payment)
    obj.customer = customer
    obj.customerId = customerId
    return NextResponse.json({ payment: obj })
  } catch (error) {
    console.error('Error fetching payment:', error)
    return NextResponse.json({ error: 'Failed to fetch payment' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = {}
    const fields = ['customerId', 'paymentType', 'amount', 'date', 'remarks']
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }

    const payment = await Payment.findByIdAndUpdate(id, updateData, { new: true }).populate('customerId')
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const obj = toObject(payment)
    const { customer, customerId } = extractCustomer(payment)
    obj.customer = customer
    obj.customerId = customerId
    return NextResponse.json({ payment: obj })
  } catch (error) {
    console.error('Error updating payment:', error)
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const payment = await Payment.findByIdAndDelete(id)
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }
    return NextResponse.json({ message: 'Payment deleted successfully' })
  } catch (error) {
    console.error('Error deleting payment:', error)
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 })
  }
}
