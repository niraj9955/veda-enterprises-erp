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
//   • name                 — human-readable label
//   • totalProduction      — sum of this field across EVERY Production record
//                            (matches the column total shown in the Production
//                            module — this is the canonical "how much have we
//                            produced" number)
//   • sellItem             — sum of DailySell.amount where the product text
//                            matches this item (case-insensitive fuzzy match).
//                            DailySell.product is free-text, so we look for
//                            the item's name as a substring of the product
//                            field. e.g. "Zig Zag Grey 80mm" matches
//                            DailySell rows whose product contains
//                            "zig zag grey 80".
//   • availableQuantity    — Total Production − Sell Item
//                            (the formula the user explicitly asked for)
//   • previousYearStock    — sum of Production[field] for entries whose date
//                            falls BEFORE the current calendar year. Gives the
//                            user a sense of how much was produced historically
//                            before this year started.
//   • latestDate           — most recent date with non-zero production
//   • latestQuantity       — production value on that latest date
//   • productionDays       — count of UNIQUE dates with non-zero production
//
// The frontend renders a 5-column summary table:
//   Item Name | Available Quantity | Sell Item | Total Production | Previous Year Stock
//
// All aggregation happens server-side so the client gets a small, fixed
// payload (one row per product, ~12 rows total) regardless of how many
// production / sales records exist.

interface ProductField {
  key: string
  name: string
  // Lowercase search tokens used to match DailySell.product text. We match
  // if ALL tokens appear in the product text (AND match) — so "zig zag grey
  // 80" matches "zig zag grey 80mm sold to customer X" but NOT "zig zag red
  // 80mm". This avoids the common false-positive of 80mm matching everything.
  matchTokens: string[]
}

const PRODUCT_FIELDS: ProductField[] = [
  { key: 'cement',         name: 'Cement',            matchTokens: ['cement'] },
  { key: 'zigZagGrey80',   name: 'Zig Zag Grey 80mm', matchTokens: ['zig', 'zag', 'grey', '80'] },
  { key: 'zigZagRed80',    name: 'Zig Zag Red 80mm',  matchTokens: ['zig', 'zag', 'red', '80'] },
  { key: 'zigZagYellow80', name: 'Zig Zag Yellow 80mm', matchTokens: ['zig', 'zag', 'yellow', '80'] },
  { key: 'zigZagGrey60',   name: 'Zig Zag Grey 60mm', matchTokens: ['zig', 'zag', 'grey', '60'] },
  { key: 'zigZagRed60',    name: 'Zig Zag Red 60mm',  matchTokens: ['zig', 'zag', 'red', '60'] },
  { key: 'zigZagYellow60', name: 'Zig Zag Yellow 60mm', matchTokens: ['zig', 'zag', 'yellow', '60'] },
  { key: 'chequreTile',    name: 'Chequre Tile',      matchTokens: ['chequre', 'tile'] },
  { key: 'curveStone',     name: 'Curve Stone',       matchTokens: ['curve', 'stone'] },
  { key: 'dumbleGrey80',   name: 'Dumble Grey 80mm',  matchTokens: ['dumble', 'grey', '80'] },
  { key: 'dumbleRed80',    name: 'Dumble Red 80mm',   matchTokens: ['dumble', 'red', '80'] },
  { key: 'dumbleYellow80', name: 'Dumble Yellow 80mm', matchTokens: ['dumble', 'yellow', '80'] },
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
    const normalizedSellRows = dailySells.map((d) => ({
      product: String((d as Record<string, unknown>).product || '').toLowerCase().trim(),
      amount: Number((d as Record<string, unknown>).amount) || 0,
    }))

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

      // Sell Item = sum of DailySell.amount where product text matches.
      // matchTokens are AND-matched against the lowercased product text so
      // "zig zag grey 80" only matches rows that contain all four tokens.
      let sellItem = 0
      for (const row of normalizedSellRows) {
        if (!row.product) continue
        const matches = field.matchTokens.every((tok) => row.product.includes(tok))
        if (matches) {
          sellItem += row.amount
        }
      }

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
