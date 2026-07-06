import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Stock, Production, DailySell } from '@/lib/models'

// Force dynamic — never cache summary responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Item-wise Stock Summary ───────────────────────────────────────────────
//
// Returns ONE row per product item (Cement, Zig Zag Grey 80mm, etc.) with:
//   • id           — stable key derived from the field name (used by React)
//   • key          — the schema field name (cement, zigZagGrey80, …)
//   • name         — human-readable label
//   • available    — current stock on hand = the LATEST stock snapshot's
//                    value for this field (most recent date's stock)
//   • sold         — total sold of this item across all DailySell records
//                    whose `product` text matches the item's label
//                    (DailySell has only a free-text `product` field and a
//                    rupee `amount`, so we count matching records AND sum
//                    their amounts — the UI can decide which to show)
//   • soldCount    — number of matching DailySell records
//   • soldAmount   — sum of amount across matching DailySell records
//   • production   — total produced across ALL Production records (sum of
//                    this field across every production row)
//   • prevYearStock — stock value for this field at the end of the previous
//                     year (latest stock record whose date is in a year
//                     before the current one). 0 if no such record exists.
//
// The frontend renders this as the table the user requested:
//   Item name | Available Quantity | Sell Number | Production | Previous Year Stock
//
// All aggregation happens server-side so the client gets a small, fixed
// payload (one row per product, ~12 rows total) regardless of how many
// production / stock / daily-sell records exist.

const CURRENT_YEAR = new Date().getFullYear()
const PREV_YEAR_STR = String(CURRENT_YEAR - 1)

interface ProductField {
  key: string
  name: string
  // Aliases used in DailySell.product free-text matching. We match
  // case-insensitively against any of these.
  aliases: string[]
}

const PRODUCT_FIELDS: ProductField[] = [
  { key: 'cement',         name: 'Cement',              aliases: ['cement'] },
  { key: 'zigZagGrey80',   name: 'Zig Zag Grey 80mm',   aliases: ['zig zag grey 80', 'zigzag grey 80', 'zig zag grey 80mm'] },
  { key: 'zigZagRed80',    name: 'Zig Zag Red 80mm',    aliases: ['zig zag red 80', 'zigzag red 80', 'zig zag red 80mm'] },
  { key: 'zigZagYellow80', name: 'Zig Zag Yellow 80mm', aliases: ['zig zag yellow 80', 'zigzag yellow 80', 'zig zag yellow 80mm'] },
  { key: 'zigZagGrey60',   name: 'Zig Zag Grey 60mm',   aliases: ['zig zag grey 60', 'zigzag grey 60', 'zig zag grey 60mm'] },
  { key: 'zigZagRed60',    name: 'Zig Zag Red 60mm',    aliases: ['zig zag red 60', 'zigzag red 60', 'zig zag red 60mm'] },
  { key: 'zigZagYellow60', name: 'Zig Zag Yellow 60mm', aliases: ['zig zag yellow 60', 'zigzag yellow 60', 'zig zag yellow 60mm'] },
  { key: 'chequreTile',    name: 'Chequre Tile',        aliases: ['chequre tile', 'chequretile', 'chequer tile'] },
  { key: 'curveStone',     name: 'Curve Stone',         aliases: ['curve stone', 'curvestone'] },
  { key: 'dumbleGrey80',   name: 'Dumble Grey 80mm',    aliases: ['dumble grey 80', 'dumblegrey80', 'dumble grey 80mm'] },
  { key: 'dumbleRed80',    name: 'Dumble Red 80mm',     aliases: ['dumble red 80', 'dumblered80', 'dumble red 80mm'] },
  { key: 'dumbleYellow80', name: 'Dumble Yellow 80mm',  aliases: ['dumble yellow 80', 'dumbleyellow80', 'dumble yellow 80mm'] },
]

export async function GET() {
  try {
    await connectDB()

    // ── Fetch all source data in parallel ──────────────────────────────
    // Three queries total, regardless of how many items we summarize.
    const [stocks, productions, dailySells] = await Promise.all([
      Stock.find({}).sort({ date: -1 }).lean(),
      Production.find({}).lean(),
      DailySell.find({}).lean(),
    ])

    // ── Build per-item summaries ───────────────────────────────────────
    const summaries = PRODUCT_FIELDS.map((field) => {
      // Available = latest stock snapshot value for this field.
      // stocks[] is sorted date-desc, so the first non-zero (or first
      // overall) entry is the most recent.
      let available = 0
      for (const s of stocks) {
        const v = Number((s as Record<string, unknown>)[field.key]) || 0
        if (v > 0) { available = v; break }
      }
      // Fallback: if no non-zero value, take the first stock record's value
      if (available === 0 && stocks.length > 0) {
        available = Number((stocks[0] as Record<string, unknown>)[field.key]) || 0
      }

      // Production = sum of this field across every Production record.
      let production = 0
      for (const p of productions) {
        production += Number((p as Record<string, unknown>)[field.key]) || 0
      }

      // Previous Year Stock = stock value at end of previous year.
      // Find the most recent stock record whose date's year is < current year.
      let prevYearStock = 0
      for (const s of stocks) {
        const d = String((s as Record<string, unknown>).date || '')
        // Date is stored as YYYY-MM-DD. Compare the year prefix.
        const yearStr = d.slice(0, 4)
        if (yearStr && Number(yearStr) < CURRENT_YEAR) {
          const v = Number((s as Record<string, unknown>)[field.key]) || 0
          if (v > 0) { prevYearStock = v; break }
        }
      }

      // Sell = match DailySell records by free-text product field.
      // We do case-insensitive substring matching against any alias.
      const lowerAliases = field.aliases.map((a) => a.toLowerCase())
      let soldCount = 0
      let soldAmount = 0
      for (const ds of dailySells) {
        const productText = String((ds as Record<string, unknown>).product || '').toLowerCase()
        if (!productText) continue
        if (lowerAliases.some((alias) => productText.includes(alias))) {
          soldCount++
          soldAmount += Number((ds as Record<string, unknown>).amount) || 0
        }
      }

      return {
        id: field.key,        // stable React key
        key: field.key,       // schema field name
        name: field.name,     // human label
        available,
        soldCount,
        soldAmount,
        sold: soldCount,      // primary "Sell Number" shown in UI = count of sales
        production,
        prevYearStock,
      }
    })

    return NextResponse.json({ summary: summaries })
  } catch (error) {
    console.error('Error fetching stock summary:', error)
    return NextResponse.json({ error: 'Failed to fetch stock summary' }, { status: 500 })
  }
}
