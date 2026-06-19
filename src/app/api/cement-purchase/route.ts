import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { CementPurchase } from '@/lib/models'

// Force dynamic — never cache list responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    await connectDB()
    const records = await CementPurchase.find({}).sort({ date: -1 }).lean()
    return NextResponse.json({ cementPurchases: records.map(toObject) })
  } catch (error) {
    console.error('Error fetching cement purchases:', error)
    return NextResponse.json({ error: 'Failed to fetch cement purchases' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    if (!body.date || !body.vendorName || !body.quantity || !body.rate) {
      return NextResponse.json({ error: 'Date, vendor name, quantity and rate are required' }, { status: 400 })
    }
    const totalAmount = Number(body.quantity) * Number(body.rate)
    const record = await CementPurchase.create({
      date: body.date,
      vendorName: body.vendorName,
      itemName: body.itemName || '',
      quantity: Number(body.quantity),
      rate: Number(body.rate),
      totalAmount,
      paidAmount: Number(body.paidAmount) || 0,
      transportationCharge: Number(body.transportationCharge) || 0,
      gst: Number(body.gst) || 0,
      remarks: body.remarks || '',
    })
    return NextResponse.json({ cementPurchase: toObject(record) }, { status: 201 })
  } catch (error) {
    console.error('Error creating cement purchase:', error)
    return NextResponse.json({ error: 'Failed to create cement purchase' }, { status: 500 })
  }
}
