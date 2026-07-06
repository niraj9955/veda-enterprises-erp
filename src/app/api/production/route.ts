import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Production } from '@/lib/models'

// Force dynamic — never cache list responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const filter: any = {}
    if (date) filter.date = date
    const productions = await Production.find(filter).sort({ date: -1 }).lean()
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
    if (!body.date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }
    const production = await Production.create({
      date: body.date,
      customerId: body.customerId || null,
      zigZagWhite80: Number(body.zigZagWhite80) || 0,
      zigZagRed80: Number(body.zigZagRed80) || 0,
      zigZagYellow80: Number(body.zigZagYellow80) || 0,
      zigZagWhite60: Number(body.zigZagWhite60) || 0,
      zigZagRed60: Number(body.zigZagRed60) || 0,
      zigZagYellow60: Number(body.zigZagYellow60) || 0,
      curveStone: Number(body.curveStone) || 0,
      chequreTile: Number(body.chequreTile) || 0,
      transportationCharge: Number(body.transportationCharge) || 0,
      remarks: body.remarks || '',
    })
    return NextResponse.json({ production: toObject(production) }, { status: 201 })
  } catch (error) {
    console.error('Error creating production:', error)
    return NextResponse.json({ error: 'Failed to create production entry' }, { status: 500 })
  }
}
