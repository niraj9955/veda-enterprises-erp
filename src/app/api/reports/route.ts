import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Production, DailySell, Expense, Customer, TractorPayment } from '@/lib/models'
import { getSession } from '@/lib/auth'

// ── Product fields (single source of truth — must match /api/stock/summary) ─
const PRODUCT_FIELDS: { key: string; name: string }[] = [
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

export async function GET(request: Request) {
  try {
    await connectDB()
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'sales'
    // Optional month filter: YYYY-MM. If provided, sales/production/P&L are
    // narrowed to that month. Default = current month for P&L, all-time for others.
    const monthFilter = searchParams.get('month') // e.g. "2026-07"
    const fromFilter = searchParams.get('from')   // e.g. "2026-07-01"
    const toFilter = searchParams.get('to')       // e.g. "2026-07-31"

    // Helper: should this date string pass the filter?
    const dateMatches = (dateStr: string): boolean => {
      if (fromFilter && dateStr < fromFilter) return false
      if (toFilter && dateStr > toFilter) return false
      if (monthFilter && !dateStr.startsWith(monthFilter)) return false
      return true
    }

    switch (type) {
      // ─────────────────────────────────────────────────────────────────────
      // SALES REPORT — source: DailySell
      // Frontend expects: { data: SalesRow[], totalSales: number }
      // SalesRow = { id, date, customerId, customer: {id, name} | null,
      //              brickType, quantity, rate, totalAmount, orderId }
      // ─────────────────────────────────────────────────────────────────────
      case 'sales': {
        const dailySells = await DailySell.find({}).sort({ date: -1 }).lean()
        const rows = dailySells
          .filter((d: any) => dateMatches(String(d.date || '')))
          .map((d: any) => ({
            id: String(d._id),
            date: String(d.date || ''),
            customerId: d.customerId ? String(d.customerId) : '',
            customer: d.customerName
              ? { id: d.customerId ? String(d.customerId) : '', name: String(d.customerName) }
              : null,
            brickType: String(d.product || ''),
            quantity: Number(d.quantity) || 0,
            rate: Number(d.rate) || 0,
            totalAmount: Number(d.amount) || 0,
            orderId: d.orderId ? String(d.orderId) : null,
          }))
        const totalSales = rows.reduce((sum, r) => sum + r.totalAmount, 0)
        return NextResponse.json({ data: rows, totalSales })
      }

      // ─────────────────────────────────────────────────────────────────────
      // PRODUCTION REPORT — source: Production (12 product columns per row)
      // Frontend expects: { data: ProductionRow[], totalProduced, byBrickType }
      // ProductionRow = { id, date, brickType, quantityProduced, shift }
      // We flatten: each non-zero product field becomes a separate row.
      // ─────────────────────────────────────────────────────────────────────
      case 'production': {
        const productions = await Production.find({}).sort({ date: -1 }).lean()
        const rows: any[] = []
        const byBrickType: Record<string, number> = {}
        let totalProduced = 0
        for (const p of productions) {
          const dateStr = String(p.date || '')
          if (!dateMatches(dateStr)) continue
          for (const f of PRODUCT_FIELDS) {
            const qty = Number((p as any)[f.key]) || 0
            if (qty <= 0) continue
            rows.push({
              id: `${p._id}-${f.key}`,
              date: dateStr,
              brickType: f.name,
              quantityProduced: qty,
              shift: '', // not tracked in this schema
            })
            byBrickType[f.name] = (byBrickType[f.name] || 0) + qty
            totalProduced += qty
          }
        }
        return NextResponse.json({ data: rows, totalProduced, byBrickType })
      }

      // ─────────────────────────────────────────────────────────────────────
      // STOCK REPORT — source: Production - Sold (matches /api/stock/summary)
      // Frontend expects: { data: StockRow[], totalCurrentStock,
      //                     totalOpeningStock, lowStockItems }
      // StockRow = { id, brickType, openingStock, currentStock,
      //              lowStockAlert, stockValue }
      //   - openingStock   = previous-year production
      //   - currentStock   = total production − total sold (availableQuantity)
      //   - lowStockAlert  = currentStock < 100
      // ─────────────────────────────────────────────────────────────────────
      case 'stock': {
        const [productions, dailySells] = await Promise.all([
          Production.find({}).sort({ date: -1 }).lean(),
          DailySell.find({}).lean(),
        ])

        const currentYear = new Date().getFullYear()
        const currentYearStart = `${currentYear}-01-01`

        // Single-pass per-field aggregation
        const totalByField     = new Array(PRODUCT_FIELDS.length).fill(0)
        const prevYearByField  = new Array(PRODUCT_FIELDS.length).fill(0)
        for (const p of productions) {
          const dateStr = String(p.date || '')
          const isPrevYear = dateStr && dateStr < currentYearStart
          for (let i = 0; i < PRODUCT_FIELDS.length; i++) {
            const v = Number((p as any)[PRODUCT_FIELDS[i].key]) || 0
            if (v <= 0) continue
            totalByField[i] += v
            if (isPrevYear) prevYearByField[i] += v
          }
        }

        // Sold by product name (DailySell.product = human-readable name)
        const soldByField: Record<string, number> = {}
        for (const d of dailySells) {
          const prod = String((d as any).product || '').trim()
          if (!prod) continue
          const qty = Number((d as any).quantity) || 0
          soldByField[prod] = (soldByField[prod] || 0) + qty
        }

        const rows = PRODUCT_FIELDS.map((f, i) => {
          const openingStock  = prevYearByField[i]
          const totalProd     = totalByField[i]
          const sold          = soldByField[f.name] || 0
          const currentStock  = Math.max(0, totalProd - sold)
          const lowStockAlert = currentStock < 100
          return {
            id: f.key,
            brickType: f.name,
            openingStock,
            currentStock,
            lowStockAlert,
            stockValue: 0, // could be filled if rate data is available
          }
        })
        const totalCurrentStock = rows.reduce((s, r) => s + r.currentStock, 0)
        const totalOpeningStock = rows.reduce((s, r) => s + r.openingStock, 0)
        const lowStockItems = rows.filter((r) => r.lowStockAlert)
        return NextResponse.json({
          data: rows,
          totalCurrentStock,
          totalOpeningStock,
          lowStockItems,
        })
      }

      // ─────────────────────────────────────────────────────────────────────
      // PROFIT & LOSS — source: DailySell (revenue) + Expense (expenses)
      // Frontend expects ProfitLossData = { reportType, month, totalRevenue,
      //   totalExpenses, netProfit, expensesByCategory }
      // ─────────────────────────────────────────────────────────────────────
      case 'profit-loss': {
        const effectiveMonth = monthFilter || new Date().toISOString().substring(0, 7)
        const [dailySells, expenses] = await Promise.all([
          DailySell.find({}).lean(),
          Expense.find({}).lean(),
        ])

        const filteredSales = dailySells.filter((d: any) =>
          dateMatches(String(d.date || ''))
        )
        const filteredExpenses = expenses.filter((e: any) =>
          dateMatches(String(e.date || ''))
        )

        const totalRevenue = filteredSales.reduce((sum, s: any) => sum + (Number(s.amount) || 0), 0)
        const totalExpenses = filteredExpenses.reduce((sum, e: any) => sum + (Number(e.amount) || 0), 0)
        const expensesByCategory: Record<string, number> = {}
        for (const e of filteredExpenses) {
          const cat = String((e as any).category || 'Other')
          expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (Number((e as any).amount) || 0)
        }
        const netProfit = totalRevenue - totalExpenses
        return NextResponse.json({
          reportType: 'profit-loss',
          month: effectiveMonth,
          totalRevenue,
          totalExpenses,
          netProfit,
          expensesByCategory,
          // Extras (not in TS type but useful for the UI):
          totalPaymentsReceived: filteredSales.reduce((s, x: any) => s + (Number(x.receivedAmount) || 0), 0),
          outstanding: filteredSales.reduce((s, x: any) => s + (Number(x.pendingAmount) || 0), 0),
        })
      }

      // ─────────────────────────────────────────────────────────────────────
      // OUTSTANDING REPORT — per-customer pending payments
      // Frontend expects: { data: OutstandingRow[], totalOutstanding }
      // OutstandingRow = { customerId, customer: {id, name} | null,
      //                    totalOrders, totalPayments, outstanding }
      // Source: DailySell grouped by customerName. We use customerName as
      // the primary grouping key because that's what the user types into
      // the Daily Sell form; customerId may be null on older entries.
      // ─────────────────────────────────────────────────────────────────────
      case 'outstanding': {
        const dailySells = await DailySell.find({}).lean()
        // Group by customerName → { totalOrders, totalPayments, outstanding, customerId }
        const byCustomer = new Map<string, {
          customerId: string
          totalOrders: number
          totalPayments: number
          outstanding: number
        }>()
        for (const d of dailySells) {
          const name = String((d as any).customerName || '').trim()
          if (!name) continue
          if (!dateMatches(String((d as any).date || ''))) continue
          const amt = Number((d as any).amount) || 0
          const rec = Number((d as any).receivedAmount) || 0
          const pend = Number((d as any).pendingAmount ?? Math.max(0, amt - rec)) || 0
          const cid = (d as any).customerId ? String((d as any).customerId) : ''
          const existing = byCustomer.get(name) || {
            customerId: cid,
            totalOrders: 0,
            totalPayments: 0,
            outstanding: 0,
          }
          existing.totalOrders += amt
          existing.totalPayments += rec
          existing.outstanding += pend
          // Prefer a non-empty customerId if we see one
          if (!existing.customerId && cid) existing.customerId = cid
          byCustomer.set(name, existing)
        }
        const data = Array.from(byCustomer.entries())
          .map(([name, v]) => ({
            id: v.customerId || `name:${name}`, // stable React key
            customerId: v.customerId,
            customer: { id: v.customerId, name },
            totalOrders: v.totalOrders,
            totalPayments: v.totalPayments,
            outstanding: v.outstanding,
          }))
          // Show customers with outstanding > 0 first, then by totalOrders desc
          .sort((a, b) => {
            if ((b.outstanding > 0 ? 1 : 0) !== (a.outstanding > 0 ? 1 : 0)) {
              return (b.outstanding > 0 ? 1 : 0) - (a.outstanding > 0 ? 1 : 0)
            }
            return b.totalOrders - a.totalOrders
          })
        const totalOutstanding = data.reduce((s, r) => s + r.outstanding, 0)
        return NextResponse.json({ data, totalOutstanding })
      }

      // ─────────────────────────────────────────────────────────────────────
      // CUSTOMER LEDGER — kept for backward compat (older reports UI)
      // Same shape as outstanding but groups by Customer collection ID.
      // ─────────────────────────────────────────────────────────────────────
      case 'customer-ledger': {
        const [customers, dailySells] = await Promise.all([
          Customer.find({}).lean(),
          DailySell.find({}).lean(),
        ])
        // Build by customerId (fallback to customerName)
        const byKey = new Map<string, {
          customerId: string
          customerName: string
          totalOrders: number
          totalPayments: number
        }>()
        for (const d of dailySells) {
          const cid = (d as any).customerId ? String((d as any).customerId) : ''
          const name = String((d as any).customerName || '').trim()
          const key = cid || `name:${name}`
          const amt = Number((d as any).amount) || 0
          const rec = Number((d as any).receivedAmount) || 0
          const existing = byKey.get(key) || {
            customerId: cid,
            customerName: name,
            totalOrders: 0,
            totalPayments: 0,
          }
          existing.totalOrders += amt
          existing.totalPayments += rec
          byKey.set(key, existing)
        }
        const ledger = Array.from(byKey.values()).map((v) => ({
          customerId: v.customerId,
          customer: { id: v.customerId, name: v.customerName },
          totalOrders: v.totalOrders,
          totalPayments: v.totalPayments,
          outstanding: Math.max(0, v.totalOrders - v.totalPayments),
        }))
        return NextResponse.json({ customerLedger: ledger })
      }

      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
