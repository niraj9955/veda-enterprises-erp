import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Production, Stock } from '@/lib/models'

export async function GET(request: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const brickType = searchParams.get('brickType')

    const filter: any = {}
    if (date) filter.date = date
    if (brickType) filter.brickType = brickType

    const productions = await Production.find(filter).sort({ createdAt: -1 })
    return NextResponse.json({ productions: productions.map(toObject) })
  } catch (error) {
    console.error('Error fetching production:', error)
    return NextResponse.json({ error: 'Failed to fetch production entries' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()

    if (!body.date || !body.brickType || !body.quantityProduced || !body.shift) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const production = await Production.create({
      date: body.date,
      brickType: body.brickType,
      quantityProduced: Number(body.quantityProduced),
      shift: body.shift,
      remarks: body.remarks || '',
    })

    // Auto-update stock
    let stock = await Stock.findOne({ brickType: body.brickType })
    if (!stock) {
      stock = await Stock.create({
        brickType: body.brickType,
        openingStock: 0,
        currentStock: Number(body.quantityProduced),
      })
    } else {
      stock.currentStock += Number(body.quantityProduced)
      await stock.save()
    }

    return NextResponse.json({ production: toObject(production) }, { status: 201 })
  } catch (error) {
    console.error('Error creating production:', error)
    return NextResponse.json({ error: 'Failed to create production entry' }, { status: 500 })
  }
}
