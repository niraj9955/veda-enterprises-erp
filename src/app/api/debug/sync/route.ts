import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Production, Stock } from '@/lib/models'
import { syncStockForDate } from '@/lib/sync-stock'

// Force dynamic — never cache
export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/debug/sync?date=YYYY-MM-DD
// Runs the stock sync for the given date and returns detailed debug info.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')

  if (!date) {
    return NextResponse.json(
      { error: 'Missing ?date=YYYY-MM-DD parameter' },
      { status: 400 }
    )
  }

  const debug: Record<string, unknown> = {
    input_date: date,
    steps: [],
  }

  try {
    await connectDB()
    debug.steps.push({ step: 'connectDB', ok: true })

    // 1. Find productions for this date
    const productions = await Production.find({ date }).lean()
    debug.steps.push({
      step: 'findProductions',
      ok: true,
      count: productions.length,
      sample: productions[0] ?? null,
    })

    // 2. Find existing stock for this date
    const existingStock = await Stock.findOne({ date }).lean()
    debug.steps.push({
      step: 'findExistingStock',
      ok: true,
      found: !!existingStock,
      stock: existingStock,
    })

    // 3. Run the sync
    const syncResult = await syncStockForDate(date)
    debug.steps.push({
      step: 'syncStockForDate',
      ok: true,
      result: syncResult
        ? {
            id: (syncResult as any)._id ?? (syncResult as any).id,
            date: (syncResult as any).date,
            cement: (syncResult as any).cement,
            zigZagGrey80: (syncResult as any).zigZagGrey80,
            dumbleRed80: (syncResult as any).dumbleRed80,
          }
        : null,
    })

    // 4. Re-fetch stock to confirm
    const afterStock = await Stock.findOne({ date }).lean()
    debug.steps.push({
      step: 'verifyAfterSync',
      ok: true,
      stock: afterStock,
    })

    return NextResponse.json(debug)
  } catch (err) {
    debug.error = err instanceof Error ? {
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 10),
    } : String(err)
    return NextResponse.json(debug, { status: 500 })
  }
}
