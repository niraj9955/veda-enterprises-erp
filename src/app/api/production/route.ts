import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Production, Stock } from '@/lib/models'
import { syncStockForDate } from '@/lib/sync-stock'
import { requireSession, requireRole, requireAdmin } from '@/lib/auth'
import { normalizeDate } from '@/lib/date-utils'

// Force dynamic — never cache list responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

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
    const session = await requireRole(['admin', 'operator'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const body = await request.json()
    // Normalize date to canonical YYYY-MM-DD
    // (handles dd-mm-yyyy, dd/mm/yyyy, Excel serials, Date objects, etc.)
    if (body.date) body.date = normalizeDate(body.date)
    if (!body.date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }
    const production = await Production.create({
      date: body.date,
      customerId: body.customerId || null,
      cement: Number(body.cement) || 0,
      zigZagGrey80: Number(body.zigZagGrey80) || 0,
      zigZagRed80: Number(body.zigZagRed80) || 0,
      zigZagYellow80: Number(body.zigZagYellow80) || 0,
      zigZagGrey60: Number(body.zigZagGrey60) || 0,
      zigZagRed60: Number(body.zigZagRed60) || 0,
      zigZagYellow60: Number(body.zigZagYellow60) || 0,
      curveStone: Number(body.curveStone) || 0,
      chequreTile: Number(body.chequreTile) || 0,
      dumbleGrey80: Number(body.dumbleGrey80) || 0,
      dumbleRed80: Number(body.dumbleRed80) || 0,
      dumbleYellow80: Number(body.dumbleYellow80) || 0,
      transportationCharge: Number(body.transportationCharge) || 0,
      remarks: body.remarks || '',
    })

    // Auto-sync Stock Overview: re-aggregate the Stock snapshot for this date
    // so it reflects the newly-added production row.
    try {
      await syncStockForDate(String(body.date))
    } catch (err) {
      console.error('[POST /production] Stock sync failed:', err)
    }

    return NextResponse.json({ production: toObject(production) }, { status: 201 })
  } catch (error) {
    console.error('Error creating production:', error)
    return NextResponse.json({ error: 'Failed to create production entry' }, { status: 500 })
  }
}

// DELETE /api/production?all=true
// Wipes ALL production entries. Gated behind admin session — only admins
// can perform bulk destructive operations.
export async function DELETE(request: Request) {
  try {
    const session = await requireAdmin()
    if (session instanceof NextResponse) return session

    await connectDB()

    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all')
    if (all !== 'true' && all !== '1') {
      return NextResponse.json(
        { error: 'Missing ?all=true — pass it to confirm bulk delete' },
        { status: 400 }
      )
    }

    const result = await Production.deleteMany({})

    // Also wipe all Stock entries since they're derived from Production.
    // (User specifically requested Stock Overview reflect Production data —
    // wiping production should also clear the synced stock snapshot.)
    try {
      await Stock.deleteMany({})
    } catch (err) {
      console.error('[DELETE /production?all] Stock wipe failed:', err)
    }

    return NextResponse.json({
      message: 'All production entries deleted',
      deletedCount: result.deletedCount,
    })
  } catch (error) {
    console.error('Error deleting all productions:', error)
    return NextResponse.json({ error: 'Failed to delete all production entries' }, { status: 500 })
  }
}
