import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Hardner } from '@/lib/models'

export async function GET() {
  try {
    await connectDB()
    const records = await Hardner.find({}).sort({ date: -1 })
    return NextResponse.json({ hardners: records.map(toObject) })
  } catch (error) {
    console.error('Error fetching hardners:', error)
    return NextResponse.json({ error: 'Failed to fetch hardners' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    if (!body.date || !body.amount) {
      return NextResponse.json({ error: 'Date and amount are required' }, { status: 400 })
    }
    const record = await Hardner.create({
      date: body.date,
      amount: Number(body.amount),
    })
    return NextResponse.json({ hardner: toObject(record) }, { status: 201 })
  } catch (error) {
    console.error('Error creating hardner:', error)
    return NextResponse.json({ error: 'Failed to create hardner' }, { status: 500 })
  }
}
