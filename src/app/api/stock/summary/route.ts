import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Stock, Production, DailySell } from '@/lib/models'

// Force dynamic — never cache summary responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Item-wise Stock Summary ───────────────────────────────────────────────
//
// Returns ONE row per product item (Cement, Zig Zag Grey 80mm, etc.) with:
//   • id                   — stable key derived from the field name (used by React)
//   • key                  — the schema field name (cement, zigZagGrey80, …)
//   • name                 — human-readable label (used as the EXACT match key
//                            for DailySell.product, since the Daily Sell form
//                            now uses a dropdown of these exact names)
//   • totalProduction      — sum of this field across EVERY Production record
//                            (matches the column total shown in the Production
//                            module — this is the canonical "how much have we
//                            produced" number)
//   • sellItem             — sum of DailySell.quantity where DailySell.product
//                            EXACTLY matches this item's name (case-insensitive).
//                            Because the Daily Sell form now uses a dropdown
//                            populated with these same names, the match is exact
//                            — no fuzzy text guesswork.
//   • availableQuantity    — Total Production − Sell Item
//                            (the formula the user explicitly asked for)
//   • previousYearStock    — sum of Production[field] for entries whose date
//                            falls BEFORE the current calendar year.
//   • latestDate           — most recent date with non-zero production
//   • latestQuantity       — production value on that latest date
//   • productionDays       — count of UNIQUE dates with non-zero production
//
// The frontend renders a 5-column summary table:
//   Item Name | Available Qty | Sell Item | Total Production | Previous Year Stock
//
// All aggregation happens server-side so the client gets a small, fixed
// payload (one row per product, ~12 rows total) regardless of how many
// production / sales records exist.

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
    // Three queries total: Production (canonical source), Stock (per-date
    // snapshot for finding "latest" fast), and DailySell (sales records).
    const [productions, stocks, dailySells] = await Promise.all([
      Production.find({}).sort({ date: -1 }).lean(),
      Stock.find({}).sort({ date: -1 }).lean(),
      DailySell.find({}).lean(),
    ])

    // ── Determine current year boundary (YYYY-01-01) ───────────────────
    // Previous Year Stock = sum of Production[field] for entries whose
    // date string is strictly less than `${currentYear}-01-01`.
    const currentYear = new Date().getFullYear()
    const currentYearStart = `${currentYear}-01-01`

    // ── Pre-normalize DailySell product text once ──────────────────────
    // Avoids re-lowercasing the same product string 12 times per row.
    // We now use `quantity` (units sold) for the Sell Item column, NOT `amount`
    // (rupees) — because the user wants:
    //   Available Item = Total Production Item − Sell Product Item
    // where both sides are in UNITS, not rupees.
    const normalizedSellRows = dailySells.map((d) => ({
      product: String((d as Record<string, unknown>).product || '').toLowerCase().trim(),
      quantity: Number((d as Record<string, unknown>).quantity) || 0,
    }))

    // Build a lookup map: lowercased-product-name → total quantity sold.
    // This is O(n) instead of O(n × 12) — we walk the sales rows ONCE and
    // bucket each one under its matching product name.
    const sellByProductName = new Map<string, number>()
    for (const row of normalizedSellRows) {
      if (!row.product) continue
      sellByProductName.set(
        row.product,
        (sellByProductName.get(row.product) || 0) + row.quantity
      )
    }

    // ── Build per-item summaries ───────────────────────────────────────
    const summaries = PRODUCT_FIELDS.map((field) => {
      // Total Production = sum of this field across EVERY Production record.
      let totalProduction = 0
      let previousYearStock = 0
      for (const p of productions) {
        const v = Number((p as Record<string, unknown>)[field.key]) || 0
        totalProduction += v
        const dateStr = String((p as Record<string, unknown>).date || '')
        if (dateStr && dateStr < currentYearStart) {
          previousYearStock += v
        }
      }

      // Sell Item = sum of DailySell.quantity where product name EXACTLY
      // matches this item's name (case-insensitive). Because the Daily Sell
      // form now uses a dropdown populated with these same names, the match
      // is exact — no more fuzzy-text false positives.
      const sellItem = sellByProductName.get(field.name.toLowerCase()) || 0

      // Available Quantity = Total Production − Sell Item
      const availableQuantity = totalProduction - sellItem

      // Latest production info (unchanged from previous version).
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

      // Fallback: walk Production (sorted date-desc) if Stock has nothing.
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

      // Production Days = count of UNIQUE dates with non-zero production.
      const uniqueDates = new Set<string>()
      for (const p of productions) {
        const v = Number((p as Record<string, unknown>)[field.key]) || 0
        if (v > 0) {
          uniqueDates.add(String((p as Record<string, unknown>).date || ''))
        }
      }
      const productionDays = uniqueDates.size

      return {
        id: field.key,             // stable React key (same as schema field name)
        key: field.key,            // schema field name
        name: field.name,          // human label
        totalProduction,
        sellItem,
        availableQuantity,
        previousYearStock,
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
