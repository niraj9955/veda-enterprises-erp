import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const brickType = searchParams.get('brickType')

    const where: Record<string, unknown> = {}

    if (date) {
      if (date.includes(',')) {
        const [startDate, endDate] = date.split(',')
        where.date = { gte: startDate, lte: endDate }
      } else {
        where.date = date
      }
    }

    if (brickType) {
      where.brickType = brickType
    }

    const productions = await db.production.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ productions, session })
  } catch (error) {
    console.error('Error fetching productions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch productions' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    const body = await request.json()
    const { date, brickType, quantityProduced, shift, remarks } = body

    if (!date || !brickType || !quantityProduced || !shift) {
      return NextResponse.json(
        { error: 'Date, brickType, quantityProduced, and shift are required' },
        { status: 400 }
      )
    }

    const production = await db.production.create({
      data: {
        date,
        brickType,
        quantityProduced,
        shift,
        remarks: remarks || '',
      },
    })

    // Update stock: increment currentStock by quantityProduced for that brickType
    const existingStock = await db.stock.findUnique({
      where: { brickType },
    })

    if (existingStock) {
      await db.stock.update({
        where: { brickType },
        data: {
          currentStock: existingStock.currentStock + quantityProduced,
        },
      })
    } else {
      await db.stock.create({
        data: {
          brickType,
          openingStock: 0,
          currentStock: quantityProduced,
        },
      })
    }

    return NextResponse.json(
      { production, session },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating production:', error)
    return NextResponse.json(
      { error: 'Failed to create production' },
      { status: 500 }
    )
  }
}
