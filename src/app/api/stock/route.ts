import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Stock } from '@/lib/models'
import { requireSession, requireAdmin } from '@/lib/auth'

// Force dynamic — never cache list responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

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
    // All POST routes (bulk-delete AND create) require admin session
    const session = await requireAdmin()
    if (session instanceof NextResponse) return session

    await connectDB()
    const body = await request.json()

    // ── Bulk delete: POST /api/stock with { ids: [...] } ───────────────
    // Mirrors the production bulk-delete API so the same client-side
    // pattern works for both modules.
    if (body && Array.isArray(body.ids)) {
      const ids = body.ids.filter((id: unknown) => typeof id === 'string' && id.length > 0)
      if (ids.length === 0) {
        return NextResponse.json({ error: 'No ids provided' }, { status: 400 })
      }
      const result = await Stock.deleteMany({ _id: { $in: ids } })
      return NextResponse.json({
        message: 'Stock entries deleted successfully',
        deletedCount: result.deletedCount || 0,
      })
    }

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

// DELETE /api/stock?all=true — delete every stock entry (Delete All button).
// Admin-only — destructive bulk operation.
export async function DELETE(request: Request) {
  try {
    const session = await requireAdmin()
    if (session instanceof NextResponse) return session

    await connectDB()
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all')

    if (all === 'true') {
      const result = await Stock.deleteMany({})
      return NextResponse.json({
        message: 'All stock entries deleted successfully',
        deletedCount: result.deletedCount || 0,
      })
    }

    // Without ?all=true this route is not used for single deletes —
    // those go through /api/stock/[id]. Return a clear error.
    return NextResponse.json(
      { error: 'Use DELETE /api/stock/[id] for single deletes, or ?all=true to delete every entry.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error deleting stock entries:', error)
    return NextResponse.json({ error: 'Failed to delete stock entries' }, { status: 500 })
  }
}
