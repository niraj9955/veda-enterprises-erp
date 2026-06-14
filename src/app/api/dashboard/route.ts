import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()

    const today = new Date().toISOString().split('T')[0]
    const currentMonth = today.substring(0, 7) // YYYY-MM

    // Today's production
    const todayProductions = await db.production.findMany({
      where: { date: today },
    })
    const todayProduction = todayProductions.reduce(
      (sum, p) => sum + p.quantityProduced,
      0
    )

    // Total stock
    const stocks = await db.stock.findMany()
    const totalStock = stocks.reduce((sum, s) => sum + s.currentStock, 0)

    // Today's dispatch
    const todayDispatches = await db.dispatch.findMany({
      where: { date: today },
    })
    const todayDispatch = todayDispatches.reduce(
      (sum, d) => sum + d.quantity,
      0
    )

    // Pending orders
    const pendingOrders = await db.order.count({
      where: { status: 'Pending' },
    })

    // Outstanding payments: sum of (order amount - payments received) for all customers
    const allOrders = await db.order.findMany()
    const allPayments = await db.payment.findMany()

    // Group payments by customerId
    const paymentsByCustomer = new Map<string, number>()
    for (const payment of allPayments) {
      const current = paymentsByCustomer.get(payment.customerId) || 0
      paymentsByCustomer.set(payment.customerId, current + payment.amount)
    }

    // Group order amounts by customerId
    const ordersByCustomer = new Map<string, number>()
    for (const order of allOrders) {
      const current = ordersByCustomer.get(order.customerId) || 0
      ordersByCustomer.set(order.customerId, current + order.amount)
    }

    // Calculate outstanding
    let outstandingPayments = 0
    for (const [customerId, orderTotal] of ordersByCustomer) {
      const paidAmount = paymentsByCustomer.get(customerId) || 0
      const outstanding = orderTotal - paidAmount
      if (outstanding > 0) {
        outstandingPayments += outstanding
      }
    }

    // Monthly sales: sum of dispatch amounts for current month
    // We need to calculate dispatch amount = quantity * rate (from order)
    const monthlyDispatches = await db.dispatch.findMany({
      where: {
        date: { startsWith: currentMonth },
      },
    })

    // Get order rates for dispatch amounts
    const orderIds = monthlyDispatches
      .map((d) => d.orderId)
      .filter(Boolean) as string[]

    const ordersForRates = await db.order.findMany({
      where: { id: { in: orderIds } },
    })

    const orderRateMap = new Map(ordersForRates.map((o) => [o.id, o.rate]))

    let monthlySales = 0
    for (const dispatch of monthlyDispatches) {
      if (dispatch.orderId) {
        const rate = orderRateMap.get(dispatch.orderId) || 0
        monthlySales += dispatch.quantity * rate
      }
    }

    // Monthly expenses
    const monthlyExpenses = await db.expense.findMany({
      where: {
        date: { startsWith: currentMonth },
      },
    })
    const totalMonthlyExpenses = monthlyExpenses.reduce(
      (sum, e) => sum + e.amount,
      0
    )

    const monthlyProfit = monthlySales - totalMonthlyExpenses

    // Recent productions (last 5)
    const recentProductions = await db.production.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    // Recent dispatches (last 5)
    const recentDispatches = await db.dispatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    // Monthly production data: grouped by date for current month
    const monthlyProductions = await db.production.findMany({
      where: {
        date: { startsWith: currentMonth },
      },
      orderBy: { date: 'asc' },
    })

    const monthlyProductionData: Record<string, number> = {}
    for (const p of monthlyProductions) {
      monthlyProductionData[p.date] =
        (monthlyProductionData[p.date] || 0) + p.quantityProduced
    }

    // Format for charts: array of { date, quantity }
    const monthlyProductionChartData = Object.entries(monthlyProductionData).map(
      ([date, quantity]) => ({ date, quantity })
    )

    // Monthly expense data: grouped by category for current month
    const monthlyExpenseData: Record<string, number> = {}
    for (const e of monthlyExpenses) {
      monthlyExpenseData[e.category] =
        (monthlyExpenseData[e.category] || 0) + e.amount
    }

    // Format for charts: array of { category, amount }
    const monthlyExpenseChartData = Object.entries(monthlyExpenseData).map(
      ([category, amount]) => ({ category, amount })
    )

    return NextResponse.json({
      todayProduction,
      totalStock,
      todayDispatch,
      pendingOrders,
      outstandingPayments,
      monthlySales,
      monthlyProfit,
      recentProductions,
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
