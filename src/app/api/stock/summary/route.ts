import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Stock, Production } from '@/lib/models'

// Force dynamic — never cache summary responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Item-wise Stock Summary ───────────────────────────────────────────────
//
// Returns ONE row per product item (Cement, Zig Zag Grey 80mm, etc.) with:
//   • id              — stable key derived from the field name (used by React)
//   • key             — the schema field name (cement, zigZagGrey80, …)
//   • name            — human-readable label
//   • totalProduction — sum of this field across EVERY Production record
//                       (matches the column total shown in the Production
//                       module — this is the canonical "how much have we
//                       produced" number)
//   • latestDate      — the most recent date (YYYY-MM-DD) on which this item
//                       had a non-zero production value. Empty string if the
//                       item has never been produced.
//   • latestQuantity  — the production value on that latest date (sum across
//                       all Production rows for that date — since Stock is
//                       auto-synced per-date from Production, this equals the
//                       latest Stock snapshot value for the field)
//   • productionDays  — count of UNIQUE dates that have a non-zero production
//                       value for this field. Lets the user see how often the
//                       item is produced (1 day vs 48 days).
//
// Why we removed `sold`, `soldCount`, `soldAmount`, `prevYearStock`:
//   • DailySell.product is a free-text field with no quantity column — we
//     could only count records, not units sold, and the count was always 0
//     in practice because nobody fills DailySell for paver blocks.
//   • Dispatch.brickType uses Red Brick / Fly Ash Brick / etc. — different
//     product line, never matches "Zig Zag Grey 80mm".
//   • Previous-year stock was always 0 because Stock is auto-synced from
//     Production on every mutation, so no historical snapshots survive.
//
// The frontend renders this as a clean 4-column summary table:
//   Item Name | Total Production | Latest Production (date + qty) | Production Days
//
// All aggregation happens server-side so the client gets a small, fixed
// payload (one row per product, ~12 rows total) regardless of how many
// production records exist.

interface ProductField {
  key: string
  name: string
}

const PRODUCT_FIELDS: ProductField[] = [
  { key: 'cement',         name: 'Cement' },
  { key: 'zigZagGrey80',   name: 'Zig Zag Grey 80mm' },
  { key: 'zigZagRed80',    name: 'Zig Zag Red 80mm' },
  { key: 'zigZagYellow80', name: 'Zig Zag Yellow 80mm' },
  { key: 'zigZagGrey60',   name: 'Zig Zag Grey 60mm' },
  { key: 'zigZagRed60',    name: 'Zig Zag Red 60mm' },
  { key: 'zigZagYellow60', name: 'Zig Zag Yellow 60mm' },
  { key: 'chequreTile',    name: 'Chequre Tile' },
  { key: 'curveStone',     name: 'Curve Stone' },
  { key: 'dumbleGrey80',   name: 'Dumble Grey 80mm' },
  { key: 'dumbleRed80',    name: 'Dumble Red 80mm' },
  { key: 'dumbleYellow80', name: 'Dumble Yellow 80mm' },
]

export async function GET() {
  try {
    await connectDB()

    // ── Fetch all source data in parallel ──────────────────────────────
    // Two queries total, regardless of how many items we summarize.
    // We pull Production (the canonical source) and Stock (the per-date
    // snapshot, used to find the "latest" production date quickly without
    // re-aggregating Production in JS).
    const [productions, stocks] = await Promise.all([
      Production.find({}).sort({ date: -1 }).lean(),
      Stock.find({}).sort({ date: -1 }).lean(),
    ])

    // ── Build per-item summaries ───────────────────────────────────────
    const summaries = PRODUCT_FIELDS.map((field) => {
      // Total Production = sum of this field across EVERY Production record.
      // This matches the column total the user sees in the Production module.
      let totalProduction = 0
      for (const p of productions) {
        totalProduction += Number((p as Record<string, unknown>)[field.key]) || 0
      }

      // Latest production info.
      // stocks[] is sorted date-desc, so the first non-zero value is the
      // most recent date on which the item was produced. Because Stock is
      // auto-synced from Production per-date (see src/lib/sync-stock.ts),
      // Stock[field] for a given date === sum of Production[field] for that
      // same date, so reading from Stock gives the same answer as iterating
      // Production but is faster (fewer rows — one per date, not per entry).
      let latestDate = ''
      let latestQuantity = 0
      for (const s of stocks) {
        const v = Number((s as Record<string, unknown>)[field.key]) || 0
        if (v > 0) {
          latestDate = String((s as Record<string, unknown>).date || '')
          latestQuantity = v
          break
        }
      }

      // Fallback: if Stock has no non-zero entry but Production does, the
      // sync may have been interrupted. Walk Production (sorted date-desc)
      // to find the latest date with a non-zero value.
      if (!latestDate) {
        for (const p of productions) {
          const v = Number((p as Record<string, unknown>)[field.key]) || 0
          if (v > 0) {
            latestDate = String((p as Record<string, unknown>).date || '')
            latestQuantity = v
            break
          }
        }
      }

      // Production Days = count of UNIQUE dates whose Production sum for
      // this field is > 0. We use a Set of date strings to dedupe.
      const uniqueDates = new Set<string>()
      for (const p of productions) {
        const v = Number((p as Record<string, unknown>)[field.key]) || 0
        if (v > 0) {
          uniqueDates.add(String((p as Record<string, unknown>).date || ''))
        }
      }
      const productionDays = uniqueDates.size

      return {
        id: field.key,           // stable React key
        key: field.key,          // schema field name
        name: field.name,        // human label
        totalProduction,
        latestDate,
        latestQuantity,
        productionDays,
      }
    })

    return NextResponse.json({ summary: summaries })
  } catch (error) {
    console.error('Error fetching stock summary:', error)
    return NextResponse.json({ error: 'Failed to fetch stock summary' }, { status: 500 })
  }
}
