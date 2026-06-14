import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()

    const stocks = await db.stock.findMany({
      orderBy: { brickType: 'asc' },
    })

    // Add computed low stock alert field
    const stocksWithAlert = stocks.map((stock) => ({
      ...stock,
      lowStockAlert: stock.currentStock < 100,
    }))

    return NextResponse.json({ stocks: stocksWithAlert, session })
  } catch (error) {
    console.error('Error fetching stocks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stocks' },
      { status: 500 }
    )
  }
}
