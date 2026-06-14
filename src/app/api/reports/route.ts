import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const customerId = searchParams.get('customerId')

    if (!type) {
      return NextResponse.json(
        { error: 'Report type is required. Valid types: sales, production, customer-ledger, stock, profit-loss, outstanding' },
        { status: 400 }
      )
    }

    switch (type) {
      case 'sales': {
        const where: Record<string, unknown> = {}
        if (startDate && endDate) {
          where.date = { gte: startDate, lte: endDate }
        } else if (startDate) {
          where.date = { gte: startDate }
        } else if (endDate) {
          where.date = { lte: endDate }
        }

        const dispatches = await db.dispatch.findMany({
          where,
          orderBy: { date: 'desc' },
        })

        // Fetch customers for dispatches
        const custIds = [...new Set(dispatches.map((d) => d.customerId))]
        const customers = await db.customer.findMany({
          where: { id: { in: custIds } },
        })
        const customerMap = new Map(customers.map((c) => [c.id, c]))

        // Fetch orders for rate calculation
        const orderIds = dispatches
          .map((d) => d.orderId)
          .filter(Boolean) as string[]
        const orders = await db.order.findMany({
          where: { id: { in: orderIds } },
        })
        const orderMap = new Map(orders.map((o) => [o.id, o]))

        const salesData = dispatches.map((d) => {
          const order = d.orderId ? orderMap.get(d.orderId) : null
          const rate = order?.rate || 0
          return {
            ...d,
            customer: customerMap.get(d.customerId) || null,
            rate,
            totalAmount: d.quantity * rate,
          }
        })

        const totalSales = salesData.reduce((sum, s) => sum + s.totalAmount, 0)

        return NextResponse.json({
          reportType: 'sales',
          data: salesData,
          totalSales,
          session,
        })
      }

      case 'production': {
        const where: Record<string, unknown> = {}
        if (startDate && endDate) {
          where.date = { gte: startDate, lte: endDate }
        } else if (startDate) {
          where.date = { gte: startDate }
        } else if (endDate) {
          where.date = { lte: endDate }
        }

        const productions = await db.production.findMany({
          where,
          orderBy: { date: 'desc' },
        })

        const totalProduced = productions.reduce(
          (sum, p) => sum + p.quantityProduced,
          0
        )

        // Group by brickType
        const byBrickType: Record<string, number> = {}
        for (const p of productions) {
          byBrickType[p.brickType] =
            (byBrickType[p.brickType] || 0) + p.quantityProduced
        }

        return NextResponse.json({
          reportType: 'production',
          data: productions,
          totalProduced,
          byBrickType,
          session,
        })
      }

      case 'customer-ledger': {
        if (!customerId) {
          return NextResponse.json(
            { error: 'customerId is required for customer-ledger report' },
            { status: 400 }
          )
        }

        const customer = await db.customer.findUnique({
          where: { id: customerId },
        })

        if (!customer) {
          return NextResponse.json(
            { error: 'Customer not found' },
            { status: 404 }
          )
        }

        const customerOrders = await db.order.findMany({
          where: { customerId },
          orderBy: { date: 'desc' },
        })

        const customerPayments = await db.payment.findMany({
          where: { customerId },
          orderBy: { date: 'desc' },
        })

        const customerDispatches = await db.dispatch.findMany({
          where: { customerId },
          orderBy: { date: 'desc' },
        })

        const totalOrderAmount = customerOrders.reduce(
          (sum, o) => sum + o.amount,
          0
        )
        const totalPaid = customerPayments.reduce(
          (sum, p) => sum + p.amount,
          0
        )
        const balance = totalOrderAmount - totalPaid

        return NextResponse.json({
          reportType: 'customer-ledger',
          customer,
          orders: customerOrders,
          payments: customerPayments,
          dispatches: customerDispatches,
          totalOrderAmount,
          totalPaid,
          balance,
          session,
        })
      }

      case 'stock': {
        const stocks = await db.stock.findMany({
          orderBy: { brickType: 'asc' },
        })

        const stockWithAlert = stocks.map((s) => ({
          ...s,
          lowStockAlert: s.currentStock < 100,
          stockValue: s.currentStock, // Can be enhanced with rate
        }))

        const totalCurrentStock = stocks.reduce(
          (sum, s) => sum + s.currentStock,
          0
        )
        const totalOpeningStock = stocks.reduce(
          (sum, s) => sum + s.openingStock,
          0
        )
        const lowStockItems = stockWithAlert.filter((s) => s.lowStockAlert)

        return NextResponse.json({
          reportType: 'stock',
          data: stockWithAlert,
          totalCurrentStock,
          totalOpeningStock,
          lowStockItems,
          session,
        })
      }

      case 'profit-loss': {
        const currentMonth = new Date().toISOString().split('T')[0].substring(0, 7)
        const monthFilter = startDate || currentMonth

        // Revenue from dispatches
        const dispatches = await db.dispatch.findMany({
          where: {
            date: { startsWith: monthFilter },
          },
        })

        // Get order rates for revenue calculation
        const orderIds = dispatches
          .map((d) => d.orderId)
          .filter(Boolean) as string[]
        const orders = await db.order.findMany({
          where: { id: { in: orderIds } },
        })
        const orderMap = new Map(orders.map((o) => [o.id, o]))

        let totalRevenue = 0
        for (const d of dispatches) {
          const order = d.orderId ? orderMap.get(d.orderId) : null
          const rate = order?.rate || 0
          totalRevenue += d.quantity * rate
        }

        // Expenses
        const expenses = await db.expense.findMany({
          where: {
            date: { startsWith: monthFilter },
          },
        })

        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

        // Group expenses by category
        const expensesByCategory: Record<string, number> = {}
        for (const e of expenses) {
          expensesByCategory[e.category] =
            (expensesByCategory[e.category] || 0) + e.amount
        }

        const netProfit = totalRevenue - totalExpenses

        return NextResponse.json({
          reportType: 'profit-loss',
          month: monthFilter,
          totalRevenue,
          totalExpenses,
          netProfit,
          expensesByCategory,
          dispatchDetails: dispatches,
          expenseDetails: expenses,
          session,
        })
      }

      case 'outstanding': {
        const allOrders = await db.order.findMany()
        const allPayments = await db.payment.findMany()

        // Group by customer
        const customerOrderTotals = new Map<string, number>()
        for (const order of allOrders) {
          const current = customerOrderTotals.get(order.customerId) || 0
          customerOrderTotals.set(order.customerId, current + order.amount)
        }

        const customerPaymentTotals = new Map<string, number>()
        for (const payment of allPayments) {
          const current = customerPaymentTotals.get(payment.customerId) || 0
          customerPaymentTotals.set(payment.customerId, current + payment.amount)
        }

        // Get all unique customer IDs
        const allCustomerIds = new Set([
          ...customerOrderTotals.keys(),
          ...customerPaymentTotals.keys(),
        ])

        const customerIds = [...allCustomerIds]
        const customers = await db.customer.findMany({
          where: { id: { in: customerIds } },
        })
        const customerMap = new Map(customers.map((c) => [c.id, c]))

        const outstandingData = customerIds
          .map((cId) => {
            const orderTotal = customerOrderTotals.get(cId) || 0
            const paymentTotal = customerPaymentTotals.get(cId) || 0
            const outstanding = orderTotal - paymentTotal
            return {
              customer: customerMap.get(cId) || null,
              customerId: cId,
              totalOrders: orderTotal,
              totalPayments: paymentTotal,
              outstanding: Math.max(0, outstanding),
            }
          })
          .filter((item) => item.outstanding > 0)

        const totalOutstanding = outstandingData.reduce(
          (sum, item) => sum + item.outstanding,
          0
        )

        return NextResponse.json({
          reportType: 'outstanding',
          data: outstandingData,
          totalOutstanding,
          session,
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid report type. Valid types: sales, production, customer-ledger, stock, profit-loss, outstanding' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
