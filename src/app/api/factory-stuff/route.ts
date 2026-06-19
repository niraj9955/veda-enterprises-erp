import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { FactoryStuff } from '@/lib/models'

// Force dynamic — never cache list responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    await connectDB()
    const records = await FactoryStuff.find({}).sort({ date: -1 }).lean()
    return NextResponse.json({ factoryStuffs: records.map(toObject) })
  } catch (error) {
    console.error('Error fetching factory stuff:', error)
    return NextResponse.json({ error: 'Failed to fetch factory stuff' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    if (!body.date || !body.itemName || !body.amount) {
      return NextResponse.json({ error: 'Date, item name and amount are required' }, { status: 400 })
    }
    const record = await FactoryStuff.create({
      date: body.date,
      itemName: body.itemName,
      quantity: Number(body.quantity) || 0,
      amount: Number(body.amount),
      remarks: body.remarks || '',
    })
    return NextResponse.json({ factoryStuff: toObject(record) }, { status: 201 })
  } catch (error) {
    console.error('Error creating factory stuff:', error)
    return NextResponse.json({ error: 'Failed to create factory stuff' }, { status: 500 })
  }
}
