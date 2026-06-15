import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Stock } from '@/lib/models'

export async function GET() {
  try {
    await connectDB()
    const stocks = await Stock.find({}).sort({ brickType: 1 })
    return NextResponse.json({ stocks: stocks.map(toObject) })
  } catch (error) {
    console.error('Error fetching stock:', error)
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 })
  }
}
