// Auto-sync helper: when a Production entry is created/updated/deleted/imported,
// the matching Stock snapshot for that date must be refreshed so the Stock
// Overview module reflects the latest production data without manual entry.
//
// Sync semantics:
//   - For a given date, sum every Production row's product columns.
//   - Upsert (create-or-replace) the Stock entry for that date.
//
// Note: this overwrites any manually-entered Stock row for the same date.
// That is intentional — production is the source of truth for daily output,
// and Stock is a derived daily snapshot used for downstream reports.

import { connectDB } from '@/lib/db'
import { Production, Stock } from '@/lib/models'

// Field list shared between Production and Stock (both schemas use the same
// product column names — only `transportationCharge` and `remarks` exist on
// Production but not Stock, so we skip those).
const SYNC_FIELDS = [
  'cement',
  'zigZagGrey80',
  'zigZagRed80',
  'zigZagYellow80',
  'zigZagGrey60',
  'zigZagRed60',
  'zigZagYellow60',
  'chequreTile',
  'curveStone',
  'dumbleGrey80',
  'dumbleRed80',
  'dumbleYellow80',
] as const

/**
 * Re-aggregate all Production rows for the given date and upsert the Stock
 * entry for that date. Safe to call multiple times.
 *
 * Returns the upserted stock doc (or null if no productions exist for the date —
 * in which case the corresponding stock entry is also deleted so the Stock
 * Overview doesn't show phantom all-zero rows for dates with no production).
 */
export async function syncStockForDate(date: string) {
  await connectDB()

  // Aggregate all production rows for this date
  const productions = await Production.find({ date }).lean()

  // Edge case: if no productions exist for this date (e.g. user deleted the
  // last one), remove the corresponding Stock entry too. Stock is a derived
  // view of Production — an empty production day should not leave a phantom
  // all-zero stock row.
  if (productions.length === 0) {
    await Stock.deleteMany({ date })
    return null
  }

  const totals: Record<string, number> = {}
  for (const field of SYNC_FIELDS) {
    totals[field] = 0
  }
  for (const p of productions) {
    for (const field of SYNC_FIELDS) {
      totals[field] += Number((p as Record<string, unknown>)[field]) || 0
    }
  }

  // Upsert: if a Stock row for this date exists, replace its quantities;
  // otherwise create a new one.
  const existing = await Stock.findOne({ date })
  if (existing) {
    for (const field of SYNC_FIELDS) {
      existing.set(field, totals[field])
    }
    await existing.save()
    return existing
  }

  const created = await Stock.create({ date, ...totals })
  return created
}

/**
 * Sync stock for multiple dates in one call. Used after production import
 * where many dates may be touched at once.
 */
export async function syncStockForDates(dates: string[]) {
  const unique = Array.from(new Set(dates.filter(Boolean)))
  for (const date of unique) {
    try {
      await syncStockForDate(date)
    } catch (err) {
      // Don't let one date's failure abort the rest of the sync
      console.error(`[syncStockForDate] Failed for ${date}:`, err)
    }
  }
}
