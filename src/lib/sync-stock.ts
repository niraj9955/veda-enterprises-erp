// Auto-sync helper: when a Production entry is created/updated/deleted/imported,
// the matching Stock snapshot for that date must be refreshed so the Stock
// Overview module reflects the latest production data without manual entry.
//
// Sync semantics:
//   - For a given date, sum every Production row's product columns.
//   - Upsert (create-or-replace) the Stock entry for that date.
//
// Performance: this used to loop over dates and do 3 DB queries per date
// (Production.find + Stock.findOne + save/create). For an import touching
// 48 unique dates that was 144 sequential round-trips. The new implementation
// does it in 3 queries total (Production.find with $in, Stock.find with $in,
// Stock.bulkWrite) and is roughly 50–100× faster.

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
 * Sync stock for multiple dates in ONE batched round-trip per DB collection.
 *
 * Previously this method called `syncStockForDate(date)` inside a sequential
 * loop, which caused N × 3 round-trips to MongoDB. For an import touching
 * 48 unique dates, that was 144 sequential DB calls — easily the slowest
 * step in the import flow and the main reason imports timed out on Vercel.
 *
 * New approach (3 round-trips total, regardless of N):
 *   1. ONE Production.find({ date: { $in: uniqueDates } }) → group in memory.
 *   2. ONE Stock.find({ date: { $in: uniqueDates } }) → build a date→doc map.
 *   3. ONE Stock.bulkWrite([updateOne | insertOne, ...]) upserts everything.
 *
 * Dates that have no production rows are deleted via a single deleteMany
 * (also batched).
 */
export async function syncStockForDates(dates: string[]) {
  const unique = Array.from(new Set(dates.filter(Boolean)))
  if (unique.length === 0) return

  await connectDB()

  // ── Step 1: fetch ALL production rows for every touched date in one query ──
  const productions = await Production.find({ date: { $in: unique } }).lean()

  // Group totals by date, computed in memory.
  // `totalsByDate` is initialized lazily — only dates that have at least one
  // production row get an entry. Dates with no productions will be handled
  // by the deleteMany below.
  const totalsByDate = new Map<string, Record<string, number>>()
  for (const p of productions) {
    const d = String((p as Record<string, unknown>).date)
    let totals = totalsByDate.get(d)
    if (!totals) {
      totals = {}
      for (const field of SYNC_FIELDS) totals[field] = 0
      totalsByDate.set(d, totals)
    }
    for (const field of SYNC_FIELDS) {
      totals[field] += Number((p as Record<string, unknown>)[field]) || 0
    }
  }

  // ── Step 2: fetch existing Stock rows for those dates in one query ────────
  const existingStocks = await Stock.find({ date: { $in: unique } }).lean()
  const existingByDate = new Map<string, boolean>()
  for (const s of existingStocks) {
    existingByDate.set(String((s as Record<string, unknown>).date), true)
  }

  // ── Step 3a: dates with NO production → delete their Stock rows in one go ─
  const emptyDates = unique.filter((d) => !totalsByDate.has(d))
  if (emptyDates.length > 0) {
    try {
      await Stock.deleteMany({ date: { $in: emptyDates } })
    } catch (err) {
      console.error('[syncStockForDates] deleteMany failed:', err)
    }
  }

  // ── Step 3b: dates WITH production → upsert via a single bulkWrite ────────
  const ops: any[] = []
  for (const [date, totals] of totalsByDate.entries()) {
    if (existingByDate.has(date)) {
      // Update existing stock row in place.
      const $set: Record<string, number> = {}
      for (const field of SYNC_FIELDS) $set[field] = totals[field]
      ops.push({
        updateOne: {
          filter: { date },
          update: { $set },
        },
      })
    } else {
      // Insert a new stock row.
      ops.push({
        insertOne: {
          document: { date, ...totals },
        },
      })
    }
  }

  if (ops.length > 0) {
    try {
      await Stock.bulkWrite(ops, { ordered: false })
    } catch (err) {
      console.error('[syncStockForDates] bulkWrite failed:', err)
      throw err
    }
  }
}
