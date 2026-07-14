import { NextResponse } from 'next/server'
import { connectDB, toObject, extractCustomer } from '@/lib/db'
import { Production, Stock, Dispatch, Order, Payment, Expense, Customer } from '@/lib/models'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    await connectDB()
    const session = await getSession()

    const today = new Date().toISOString().split('T')[0]
    const currentMonth = today.substring(0, 7)
    // Pre-compute the date range for "this month" queries. Using $gte/$lt
    // lets Mongo use the `date` index efficiently — much faster than the
    // old `{ date: { $regex: '^YYYY-MM' } }` which scanned every doc.
    const monthStart = `${currentMonth}-01`
    const monthEnd = `${currentMonth}-31` // inclusive upper bound (YYYY-MM-31)

    // ── Run all independent queries in parallel ────────────────────────
    // Previously these ran as 12 sequential awaits — each adding 1 RTT of
    // latency. Batching them cuts total latency from ~12×RTT to ~1×RTT.
    const [
      todayProductions,
      stocks,
      todayDispatches,
      pendingOrders,
      // Outstanding payments — replaced two full-collection scans with two
      // $group aggregations that return one row per customer.
      ordersAgg,
      paymentsAgg,
      monthlyDispatches,
      monthlyExpenses,
      monthlyProductions,
      recentProductions,
      recentDispatchDocs,
    ] = await Promise.all([
      Production.find({ date: today }),
      Stock.find({}),
      Dispatch.find({ date: today }),
      Order.countDocuments({ status: 'Pending' }),
      Order.aggregate([
        { $group: { _id: '$customerId', total: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        { $group: { _id: '$customerId', total: { $sum: '$amount' } } },
      ]),
      Dispatch.find({ date: { $gte: monthStart, $lte: monthEnd } }),
      Expense.find({ date: { $gte: monthStart, $lte: monthEnd } }),
      Production.find({ date: { $gte: monthStart, $lte: monthEnd } }).sort({ date: 1 }),
      Production.find({}).sort({ createdAt: -1 }).limit(5),
      Dispatch.find({}).sort({ createdAt: -1 }).limit(5).populate('customerId'),
    ])

    // ── Reduce: today's production, total stock, today's dispatch ───────
    const todayProduction = todayProductions.reduce((sum, p) => sum + p.quantityProduced, 0)
    const totalStock = stocks.reduce((sum, s) => sum + s.currentStock, 0)
    const todayDispatch = todayDispatches.reduce((sum, d) => sum + d.quantity, 0)

    // ── Outstanding payments — built from the two $group results ───────
    const paymentsByCustomer = new Map<string, number>()
    for (const row of paymentsAgg) {
      paymentsByCustomer.set(String(row._id), row.total)
    }
    let outstandingPayments = 0
    for (const row of ordersAgg) {
      const paidAmount = paymentsByCustomer.get(String(row._id)) || 0
      const outstanding = row.total - paidAmount
      if (outstanding > 0) outstandingPayments += outstanding
    }

    // ── Monthly sales — need rates from referenced orders ──────────────
    const orderIds = monthlyDispatches.map((d) => d.orderId).filter(Boolean)
    const ordersForRates = orderIds.length > 0 ? await Order.find({ _id: { $in: orderIds } }) : []
    const orderRateMap = new Map(ordersForRates.map((o) => [o._id.toString(), o.rate]))
    let monthlySales = 0
    for (const dispatch of monthlyDispatches) {
      if (dispatch.orderId) {
        const rate = orderRateMap.get(dispatch.orderId.toString()) || 0
        monthlySales += dispatch.quantity * rate
      }
    }

    // ── Monthly expenses / profit ──────────────────────────────────────
    const totalMonthlyExpenses = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0)
    const monthlyProfit = monthlySales - totalMonthlyExpenses

    // ── Recent items for dashboard lists ───────────────────────────────
    const recentProductionsObj = recentProductions.map(toObject)
    const recentDispatches = recentDispatchDocs.map((d: any) => {
      const obj = toObject(d)
      const { customer, customerId } = extractCustomer(d)
      obj.customer = customer
      obj.customerId = customerId
      obj.customerName = customer?.name || ''
      return obj
    })

    // ── Monthly production chart data — single pass ────────────────────
    const monthlyProductionDataMap: Record<string, number> = {}
    for (const p of monthlyProductions) {
      monthlyProductionDataMap[p.date] = (monthlyProductionDataMap[p.date] || 0) + p.quantityProduced
    }
    const monthlyProductionChartData = Object.entries(monthlyProductionDataMap).map(([date, quantity]) => ({ date, quantity }))

    // ── Monthly expense chart data — single pass over already-fetched expenses ──
    const monthlyExpenseDataMap: Record<string, number> = {}
    for (const e of monthlyExpenses) {
      monthlyExpenseDataMap[e.category] = (monthlyExpenseDataMap[e.category] || 0) + e.amount
    }
    const monthlyExpenseChartData = Object.entries(monthlyExpenseDataMap).map(([category, amount]) => ({ category, amount }))

    return NextResponse.json({
      todayProduction,
      totalStock,
      todayDispatch,
      pendingOrders,
      outstandingPayments,
      monthlySales,
      monthlyProfit,
      recentProductions: recentProductionsObj,
      recentDispatches,
      monthlyProductionData: monthlyProductionChartData,
      monthlyExpenseData: monthlyExpenseChartData,
      session,
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
