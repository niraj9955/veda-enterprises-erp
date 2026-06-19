import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { DailySell } from '@/lib/models'

// Force dynamic — never cache list responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    await connectDB()
    const records = await DailySell.find({}).sort({ date: -1 }).lean()
    return NextResponse.json({ dailySells: records.map(toObject) })
  } catch (error) {
    console.error('Error fetching daily sells:', error)
    return NextResponse.json({ error: 'Failed to fetch daily sells' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    if (!body.date || !body.customerName || !body.amount) {
      return NextResponse.json({ error: 'Date, customer name and amount are required' }, { status: 400 })
    }
    const record = await DailySell.create({
      date: body.date,
      customerName: body.customerName,
      address: body.address || '',
      amount: Number(body.amount),
      remarks: body.remarks || '',
      contactNumber: body.contactNumber || '',
    })
    return NextResponse.json({ dailySell: toObject(record) }, { status: 201 })
  } catch (error) {
    console.error('Error creating daily sell:', error)
    return NextResponse.json({ error: 'Failed to create daily sell' }, { status: 500 })
  }
}
