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

    // Today's production
    const todayProductions = await Production.find({ date: today })
    const todayProduction = todayProductions.reduce((sum, p) => sum + p.quantityProduced, 0)

    // Total stock
    const stocks = await Stock.find({})
    const totalStock = stocks.reduce((sum, s) => sum + s.currentStock, 0)

    // Today's dispatch
    const todayDispatches = await Dispatch.find({ date: today })
    const todayDispatch = todayDispatches.reduce((sum, d) => sum + d.quantity, 0)

    // Pending orders
    const pendingOrders = await Order.countDocuments({ status: 'Pending' })

    // Outstanding payments
    const allOrders = await Order.find({})
    const allPayments = await Payment.find({})

    const paymentsByCustomer = new Map<string, number>()
    for (const payment of allPayments) {
      const cid = payment.customerId.toString()
      paymentsByCustomer.set(cid, (paymentsByCustomer.get(cid) || 0) + payment.amount)
    }

    const ordersByCustomer = new Map<string, number>()
    for (const order of allOrders) {
      const cid = order.customerId.toString()
      ordersByCustomer.set(cid, (ordersByCustomer.get(cid) || 0) + order.amount)
    }

    let outstandingPayments = 0
    for (const [customerId, orderTotal] of ordersByCustomer) {
      const paidAmount = paymentsByCustomer.get(customerId) || 0
      const outstanding = orderTotal - paidAmount
      if (outstanding > 0) outstandingPayments += outstanding
    }

    // Monthly sales
    const monthlyDispatches = await Dispatch.find({ date: { $regex: `^${currentMonth}` } })

    const orderIds = monthlyDispatches.map(d => d.orderId).filter(Boolean)
    const ordersForRates = orderIds.length > 0 ? await Order.find({ _id: { $in: orderIds } }) : []
    const orderRateMap = new Map(ordersForRates.map(o => [o._id.toString(), o.rate]))

    let monthlySales = 0
    for (const dispatch of monthlyDispatches) {
      if (dispatch.orderId) {
        const rate = orderRateMap.get(dispatch.orderId.toString()) || 0
        monthlySales += dispatch.quantity * rate
      }
    }

    // Monthly expenses
    const monthlyExpenses = await Expense.find({ date: { $regex: `^${currentMonth}` } })
    const totalMonthlyExpenses = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0)
    const monthlyProfit = monthlySales - totalMonthlyExpenses

    // Recent productions (last 5)
    const recentProductions = (await Production.find({}).sort({ createdAt: -1 }).limit(5)).map(toObject)

    // Recent dispatches (last 5) - with customer names
    const recentDispatchDocs = await Dispatch.find({}).sort({ createdAt: -1 }).limit(5).populate('customerId')
    const recentDispatches = recentDispatchDocs.map((d: any) => {
      const obj = toObject(d)
      const { customer, customerId } = extractCustomer(d)
      obj.customer = customer
      obj.customerId = customerId
      obj.customerName = customer?.name || ''
      return obj
    })

    // Monthly production chart data
    const monthlyProductions = await Production.find({ date: { $regex: `^${currentMonth}` } }).sort({ date: 1 })
    const monthlyProductionDataMap: Record<string, number> = {}
    for (const p of monthlyProductions) {
      monthlyProductionDataMap[p.date] = (monthlyProductionDataMap[p.date] || 0) + p.quantityProduced
    }
    const monthlyProductionChartData = Object.entries(monthlyProductionDataMap).map(([date, quantity]) => ({ date, quantity }))

    // Monthly expense chart data
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
