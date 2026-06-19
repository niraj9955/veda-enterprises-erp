import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { CustomerPayment } from '@/lib/models'

// Force dynamic — never cache list responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    await connectDB()
    const records = await CustomerPayment.find({}).sort({ date: -1 }).lean()
    return NextResponse.json({ customerPayments: records.map(toObject) })
  } catch (error) {
    console.error('Error fetching customer payments:', error)
    return NextResponse.json({ error: 'Failed to fetch customer payments' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    if (!body.date || !body.name || !body.amount) {
      return NextResponse.json({ error: 'Date, name and amount are required' }, { status: 400 })
    }
    const record = await CustomerPayment.create({
      date: body.date,
      name: body.name,
      address: body.address || '',
      amount: Number(body.amount),
      remarks: body.remarks || '',
    })
    return NextResponse.json({ customerPayment: toObject(record) }, { status: 201 })
  } catch (error) {
    console.error('Error creating customer payment:', error)
    return NextResponse.json({ error: 'Failed to create customer payment' }, { status: 500 })
  }
}
