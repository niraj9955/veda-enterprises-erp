import { NextResponse } from 'next/server'
import { connectDB, toObject, extractCustomer, extractOrder } from '@/lib/db'
import { Production, Stock, Order, Dispatch, Payment, Expense, Customer } from '@/lib/models'
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    await connectDB()
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'sales'

    switch (type) {
      case 'sales': {
        const dispatches = await Dispatch.find({}).populate('customerId').populate('orderId').sort({ date: -1 })
        const sales = dispatches.map((d: any) => {
          const obj = toObject(d)
          const { customer, customerId } = extractCustomer(d)
          const { order, orderId } = extractOrder(d)
          obj.customer = customer
          obj.customerId = customerId
          obj.order = order
          obj.orderId = orderId
          obj.rate = order?.orderNumber ? (d.orderId as any)?.rate || 0 : 0
          obj.totalAmount = obj.quantity * obj.rate
          return obj
        })
        return NextResponse.json({ sales })
      }

      case 'production': {
        const productions = await Production.find({}).sort({ date: -1 })
        return NextResponse.json({ productions: productions.map(toObject) })
      }

      case 'customer-ledger': {
        const customers = await Customer.find({})
        const orders = await Order.find({})
        const payments = await Payment.find({}).populate('customerId')

        const ledger = customers.map((customer: any) => {
          const cid = customer._id.toString()
          const totalOrders = orders.filter(o => o.customerId.toString() === cid).reduce((sum, o) => sum + o.amount, 0)
          const totalPayments = payments.filter(p => {
            const pid = (p.customerId as any)?._id?.toString() || p.customerId?.toString()
            return pid === cid
          }).reduce((sum, p) => sum + p.amount, 0)

          return {
            customerId: cid,
            customer: { id: cid, name: customer.name },
            totalOrders,
            totalPayments,
            outstanding: Math.max(0, totalOrders - totalPayments),
          }
        })

        return NextResponse.json({ customerLedger: ledger })
      }

      case 'stock': {
        const stocks = await Stock.find({}).sort({ brickType: 1 })
        const stockData = stocks.map((s: any) => {
          const obj = toObject(s)
          obj.lowStockAlert = obj.currentStock < 100
          obj.stockValue = 0
          return obj
        })
        return NextResponse.json({ stocks: stockData })
      }

      case 'profit-loss': {
        const orders = await Order.find({})
        const expenses = await Expense.find({})
        const payments = await Payment.find({})

        const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0)
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
        const totalPaymentsReceived = payments.reduce((sum, p) => sum + p.amount, 0)

        return NextResponse.json({
          profitLoss: {
            totalRevenue,
            totalExpenses,
            netProfit: totalRevenue - totalExpenses,
            totalPaymentsReceived,
            outstanding: totalRevenue - totalPaymentsReceived,
          },
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
