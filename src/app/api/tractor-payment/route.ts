import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { TractorPayment } from '@/lib/models'

export async function GET() {
  try {
    await connectDB()
    const records = await TractorPayment.find({}).sort({ date: -1 })
    return NextResponse.json({ tractorPayments: records.map(toObject) })
  } catch (error) {
    console.error('Error fetching tractor payments:', error)
    return NextResponse.json({ error: 'Failed to fetch tractor payments' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    if (!body.date || !body.vendorName || !body.quantityTon || !body.rate) {
      return NextResponse.json({ error: 'Date, vendor name, quantity and rate are required' }, { status: 400 })
    }
    const totalAmount = Number(body.quantityTon) * Number(body.rate)
    const paidAmount = Number(body.paidAmount) || 0
    const record = await TractorPayment.create({
      date: body.date,
      vendorName: body.vendorName,
      quantityTon: Number(body.quantityTon),
      rate: Number(body.rate),
      totalAmount,
      paidAmount,
      remainingAmount: totalAmount - paidAmount,
      remarks: body.remarks || '',
    })
    return NextResponse.json({ tractorPayment: toObject(record) }, { status: 201 })
  } catch (error) {
    console.error('Error creating tractor payment:', error)
    return NextResponse.json({ error: 'Failed to create tractor payment' }, { status: 500 })
  }
}
