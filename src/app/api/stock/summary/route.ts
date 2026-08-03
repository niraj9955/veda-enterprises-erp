import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Stock, Production, DailySell } from '@/lib/models'
import { requireSession } from '@/lib/auth'

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
    const session = await requireSession()
    if (session instanceof NextResponse) return session

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
    const currentYear = new Date().getFullYear()
    const currentYearStart = `${currentYear}-01-01`

    // ── SINGLE PASS over Production ────────────────────────────────────
    // Previously the code walked `productions` 4 times per field (total /
    // prevYear / latest / uniqueDates), giving 48 passes over the array
    // for 12 product fields. We now walk it ONCE and accumulate per-field
    // tallies in parallel arrays.
    const totalProductionByField   = new Array(PRODUCT_FIELDS.length).fill(0)
    const previousYearByField      = new Array(PRODUCT_FIELDS.length).fill(0)
    const latestDateByField        = new Array<string>(PRODUCT_FIELDS.length).fill('')
    const latestQtyByField         = new Array<number>(PRODUCT_FIELDS.length).fill(0)
    const uniqueDatesByField: Set<string>[] = PRODUCT_FIELDS.map(() => new Set<string>())

    for (const p of productions) {
      const dateStr = String((p as Record<string, unknown>).date || '')
      const isPrevYear = dateStr && dateStr < currentYearStart
      for (let i = 0; i < PRODUCT_FIELDS.length; i++) {
        const key = PRODUCT_FIELDS[i].key
        const v = Number((p as Record<string, unknown>)[key]) || 0
        if (v <= 0) continue
        totalProductionByField[i] += v
        if (isPrevYear) previousYearByField[i] += v
        // productions is sorted date-desc, so the FIRST non-zero value we
        // encounter for a field is the latest date for that field.
        if (!latestDateByField[i]) {
          latestDateByField[i] = dateStr
          latestQtyByField[i] = v
        }
        if (dateStr) uniqueDatesByField[i].add(dateStr)
      }
    }

    // ── SINGLE PASS over Stock (for latest date fallback) ──────────────
    // Stocks are also sorted date-desc. Used only when Production had no
    // entries for a field (rare edge case).
    const stockLatestDate  = new Array<string>(PRODUCT_FIELDS.length).fill('')
    const stockLatestQty   = new Array<number>(PRODUCT_FIELDS.length).fill(0)
    for (const s of stocks) {
      const dateStr = String((s as Record<string, unknown>).date || '')
      for (let i = 0; i < PRODUCT_FIELDS.length; i++) {
        if (stockLatestDate[i]) continue // already found latest for this field
        const key = PRODUCT_FIELDS[i].key
        const v = Number((s as Record<string, unknown>)[key]) || 0
        if (v > 0) {
          stockLatestDate[i] = dateStr
          stockLatestQty[i] = v
        }
      }
    }

    // ── SINGLE PASS over DailySell (sell quantity by product name) ─────
    // Multi-product records store line items in `products[]`; legacy single-
    // product records only have `product` + `quantity`. We iterate over
    // `products[]` when present so EVERY sold item is counted toward the
    // correct product's stock — otherwise multi-product sales would only
    // reduce the first product's available quantity.
    const sellByProductName = new Map<string, number>()
    const addSell = (rawName: string, qty: number) => {
      const name = rawName.toLowerCase().trim()
      if (!name) return
      sellByProductName.set(name, (sellByProductName.get(name) || 0) + qty)
    }
    for (const d of dailySells) {
      const prods = Array.isArray((d as any).products) ? (d as any).products : []
      if (prods.length > 0) {
        for (const p of prods) {
          addSell(String((p as any).product || ''), Number((p as any).quantity) || 0)
        }
      } else {
        addSell(
          String((d as Record<string, unknown>).product || ''),
          Number((d as Record<string, unknown>).quantity) || 0,
        )
      }
    }

    // ── Assemble per-field summary rows ────────────────────────────────
    const summaries = PRODUCT_FIELDS.map((field, i) => {
      const totalProduction   = totalProductionByField[i]
      const previousYearStock = previousYearByField[i]
      const sellItem          = sellByProductName.get(field.name.toLowerCase()) || 0
      const availableQuantity = totalProduction - sellItem
      const latestDate        = latestDateByField[i] || stockLatestDate[i]
      const latestQuantity    = latestDateByField[i] ? latestQtyByField[i] : stockLatestQty[i]
      const productionDays    = uniqueDatesByField[i].size

      return {
        id: field.key,
        key: field.key,
        name: field.name,
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
