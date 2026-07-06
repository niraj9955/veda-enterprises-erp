import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Production } from '@/lib/models'
import { syncStockForDates } from '@/lib/sync-stock'

// Force dynamic — never cache
export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/admin/sync-all-stock
// One-shot backfill: aggregates ALL existing production dates and syncs them
// to the Stock collection. Used after schema changes or to populate Stock
// Overview retroactively for historical production data.
//
// Returns a summary: how many dates were processed, how many succeeded,
// how many failed, and the per-date results.
export async function GET() {
  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  }

  try {
    await connectDB()

    // Get all distinct production dates
    const dates: string[] = await Production.distinct('date')
    result.datesFound = dates.length
    result.dates = dates

    // Sync each date, tracking success/failure
    const succeeded: string[] = []
    const failed: Array<{ date: string; error: string }> = []

    for (const date of dates) {
      try {
        // Use syncStockForDates for a single date — it already handles errors
        // internally but we want per-date reporting here so we call the single
        // date version indirectly.
        await syncStockForDates([date])
        succeeded.push(date)
      } catch (err) {
        failed.push({
          date,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    result.succeeded = succeeded.length
    result.failed = failed.length
    result.failures = failed

    return NextResponse.json(result)
  } catch (err) {
    result.error = err instanceof Error ? {
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 10),
    } : String(err)
    return NextResponse.json(result, { status: 500 })
  }
}
