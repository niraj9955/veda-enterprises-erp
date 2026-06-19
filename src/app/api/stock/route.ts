import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Stock } from '@/lib/models'

// Force dynamic — never cache list responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    await connectDB()
    const stocks = await Stock.find({}).sort({ date: -1 }).lean()
    return NextResponse.json({ stocks: stocks.map(toObject) })
  } catch (error) {
    console.error('Error fetching stock:', error)
    return NextResponse.json({ error: 'Failed to fetch stock entries' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    if (!body.date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }
    const stock = await Stock.create({
      date: body.date,
      cement: Number(body.cement) || 0,
      zigZagGrey80: Number(body.zigZagGrey80) || 0,
      zigZagRed80: Number(body.zigZagRed80) || 0,
      zigZagYellow80: Number(body.zigZagYellow80) || 0,
      zigZagGrey60: Number(body.zigZagGrey60) || 0,
      zigZagRed60: Number(body.zigZagRed60) || 0,
      zigZagYellow60: Number(body.zigZagYellow60) || 0,
      chequreTile: Number(body.chequreTile) || 0,
      curveStone: Number(body.curveStone) || 0,
      dumbleGrey80: Number(body.dumbleGrey80) || 0,
      dumbleRed80: Number(body.dumbleRed80) || 0,
      dumbleYellow80: Number(body.dumbleYellow80) || 0,
    })
    return NextResponse.json({ stock: toObject(stock) }, { status: 201 })
  } catch (error) {
    console.error('Error creating stock:', error)
    return NextResponse.json({ error: 'Failed to create stock entry' }, { status: 500 })
  }
}
