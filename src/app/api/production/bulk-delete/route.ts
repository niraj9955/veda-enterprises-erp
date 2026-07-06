import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Production } from '@/lib/models'
import { syncStockForDates } from '@/lib/sync-stock'
import { getSession } from '@/lib/auth'

// Force dynamic — never cache
export const dynamic = 'force-dynamic'

// POST /api/production/bulk-delete
// Body: { ids: string[] }
// Deletes the production entries whose `_id` is in `ids`.
// Re-aggregates Stock snapshots for every touched date so the Stock module
// reflects the deletions automatically.
// Gated behind admin/operator session — bulk destructive operations should
// not be callable by unauthenticated users.
export async function POST(request: Request) {
  try {
    await connectDB()

    // Auth gate — any logged-in user with admin or operator role can bulk-delete.
    // Accountant role is read-only for production per the existing permission
    // matrix, so we deny here.
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized — please log in' },
        { status: 401 }
      )
    }
    if (session.role === 'accountant') {
      return NextResponse.json(
        { error: 'Forbidden — accountants cannot delete production entries' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { ids } = body as { ids?: string[] }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids array is required and must be non-empty' },
        { status: 400 }
      )
    }

    // Fetch the dates of the rows we're about to delete — we need them to
    // re-sync the Stock snapshot afterwards.
    const docs = await Production.find({ _id: { $in: ids } })
      .select('date')
      .lean() as { date?: string; _id: unknown }[]

    if (docs.length === 0) {
      return NextResponse.json(
        { error: 'No matching production entries found — they may have been already deleted' },
        { status: 404 }
      )
    }

    const result = await Production.deleteMany({ _id: { $in: ids } })

    // Re-aggregate Stock snapshots for every touched date so Stock Overview
    // is consistent. We deduplicate dates to avoid redundant re-syncs.
    const touchedDates = Array.from(
      new Set(
        docs
          .map((d) => String(d.date || '').split('T')[0])
          .filter(Boolean)
      )
    )
    if (touchedDates.length > 0) {
      try {
        await syncStockForDates(touchedDates)
      } catch (err) {
        console.error('[POST /production/bulk-delete] Stock sync failed:', err)
        // Don't fail the request — rows were already deleted.
      }
    }

    return NextResponse.json({
      message: `${result.deletedCount} production entr${result.deletedCount === 1 ? 'y' : 'ies'} deleted`,
      deletedCount: result.deletedCount,
      requestedCount: ids.length,
      stockResyncedDates: touchedDates.length,
    })
  } catch (error) {
    console.error('Error bulk-deleting productions:', error)
    return NextResponse.json(
      { error: 'Failed to bulk-delete production entries' },
      { status: 500 }
    )
  }
}
