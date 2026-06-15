import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { LabourPayment } from '@/lib/models'

export async function GET() {
  try {
    await connectDB()
    const records = await LabourPayment.find({}).sort({ date: -1 })
    return NextResponse.json({ labourPayments: records.map(toObject) })
  } catch (error) {
    console.error('Error fetching labour payments:', error)
    return NextResponse.json({ error: 'Failed to fetch labour payments' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    if (!body.date || !body.name || !body.amount) {
      return NextResponse.json({ error: 'Date, name and amount are required' }, { status: 400 })
    }
    const record = await LabourPayment.create({
      date: body.date,
      name: body.name,
      address: body.address || '',
      amount: Number(body.amount),
      remarks: body.remarks || '',
    })
    return NextResponse.json({ labourPayment: toObject(record) }, { status: 201 })
  } catch (error) {
    console.error('Error creating labour payment:', error)
    return NextResponse.json({ error: 'Failed to create labour payment' }, { status: 500 })
  }
}
