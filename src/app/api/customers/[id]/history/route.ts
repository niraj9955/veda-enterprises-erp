import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import {
  Customer, Production, Order, Dispatch, Payment, DailySell, CustomerPayment,
} from '@/lib/models'

// Force dynamic — customer history changes after every mutation.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    const customer = await Customer.findById(id).lean()
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const customerName = String(customer.name || '').trim()

    // Build parallel queries — match by customerId (legacy Orders/Dispatch/Payments)
    // OR by customerName (Production/DailySell/CustomerPayment store name, not ID).
    const [productions, orders, dispatches, payments, dailySells, customerPayments] =
      await Promise.all([
        Production.find({
          $or: [
            { customerId: id },
            ...(customerName ? [{ customerName: customer.name }] : []),
          ],
        }).sort({ date: -1 }).lean(),
        Order.find({ customerId: id }).sort({ createdAt: -1 }).lean(),
        Dispatch.find({ customerId: id }).sort({ date: -1 }).lean(),
        Payment.find({ customerId: id }).sort({ date: -1 }).lean(),
        DailySell.find(customerName ? { customerName: customer.name } : { _id: null })
          .sort({ date: -1 }).lean(),
        CustomerPayment.find(customerName ? { name: customer.name } : { _id: null })
          .sort({ date: -1 }).lean(),
      ])

    // ─── Aggregations ───────────────────────────────────────────────────────
    // Order total = sum of amount field across all orders
    const totalOrderedAmount = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0)
    const totalOrderedQty = orders.reduce((s, o) => s + (Number(o.quantity) || 0), 0)

    // Dispatch total = sum of quantity (dispatched)
    const totalDispatchedQty = dispatches.reduce((s, d) => s + (Number(d.quantity) || 0), 0)

    // Paid = CustomerPayment.amount + Payment.amount (legacy) + DailySell.amount is sell not payment
    const totalCustomerPayments = customerPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const totalLegacyPayments = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const totalPaid = totalCustomerPayments + totalLegacyPayments

    // Daily sell total = sum of amount
    const totalDailySellAmount = dailySells.reduce((s, d) => s + (Number(d.amount) || 0), 0)

    // Production totals — sum every numeric product column
    const productionTotals = productions.reduce(
      (acc, p) => {
        acc.zigZagWhite80 += Number(p.zigZagWhite80) || 0
        acc.zigZagRed80 += Number(p.zigZagRed80) || 0
        acc.zigZagYellow80 += Number(p.zigZagYellow80) || 0
        acc.zigZagWhite60 += Number(p.zigZagWhite60) || 0
        acc.zigZagRed60 += Number(p.zigZagRed60) || 0
        acc.zigZagYellow60 += Number(p.zigZagYellow60) || 0
        acc.curveStone += Number(p.curveStone) || 0
        acc.chequreTile += Number(p.chequreTile) || 0
        acc.transportationCharge += Number(p.transportationCharge) || 0
        return acc
      },
      {
        zigZagWhite80: 0, zigZagRed80: 0, zigZagYellow80: 0,
        zigZagWhite60: 0, zigZagRed60: 0, zigZagYellow60: 0,
        curveStone: 0, chequreTile: 0, transportationCharge: 0,
      }
    )

    // Balance: totalOrdered - totalPaid (using Orders as the source of truth for billing)
    // If no orders, use DailySell as the source of truth
    const billableAmount = totalOrderedAmount > 0 ? totalOrderedAmount : totalDailySellAmount
    const balance = billableAmount - totalPaid

    // Timeline — merge all events into one sorted array for the "all activity" view
    type TimelineEvent = {
      id: string
      date: string
      type: 'order' | 'dispatch' | 'payment' | 'daily_sell' | 'customer_payment' | 'production'
      description: string
      amount: number
      qty?: number
      reference?: string
      remarks?: string
    }
    const timeline: TimelineEvent[] = []
    for (const o of orders) {
      timeline.push({
        id: String(o._id),
        date: String(o.deliveryDate || o.createdAt || ''),
        type: 'order',
        description: `Order — ${o.brickType || ''}`,
        amount: Number(o.amount) || 0,
        qty: Number(o.quantity) || 0,
        reference: o.orderNumber,
        remarks: o.status,
      })
    }
    for (const d of dispatches) {
      timeline.push({
        id: String(d._id),
        date: String(d.date || ''),
        type: 'dispatch',
        description: `Dispatch — ${d.brickType || ''} (Truck: ${d.truckNumber || '—'})`,
        amount: 0,
        qty: Number(d.quantity) || 0,
        reference: d.dispatchNumber,
        remarks: d.driverName,
      })
    }
    for (const p of payments) {
      timeline.push({
        id: String(p._id),
        date: String(p.date || ''),
        type: 'payment',
        description: `Payment — ${p.paymentType || ''}`,
        amount: Number(p.amount) || 0,
        reference: '',
        remarks: p.remarks,
      })
    }
    for (const p of customerPayments) {
      timeline.push({
        id: String(p._id),
        date: String(p.date || ''),
        type: 'customer_payment',
        description: `Customer Payment`,
        amount: Number(p.amount) || 0,
        reference: '',
        remarks: p.remarks,
      })
    }
    for (const d of dailySells) {
      timeline.push({
        id: String(d._id),
        date: String(d.date || ''),
        type: 'daily_sell',
        description: `Daily Sell`,
        amount: Number(d.amount) || 0,
        reference: '',
        remarks: d.remarks,
      })
    }
    for (const p of productions) {
      timeline.push({
        id: String(p._id),
        date: String(p.date || ''),
        type: 'production',
        description: `Production — ${p.customerName || ''} ${p.address ? `(${p.address})` : ''}`,
        amount: Number(p.transportationCharge) || 0,
        reference: '',
        remarks: p.remarks,
      })
    }
    // Sort by date desc, fallback to createdAt
    timeline.sort((a, b) => {
      const da = new Date(a.date || 0).getTime()
      const db = new Date(b.date || 0).getTime()
      return db - da
    })

    const res = NextResponse.json({
      customer: toObject(customer),
      summary: {
        totalOrderedAmount,
        totalOrderedQty,
        totalDispatchedQty,
        totalCustomerPayments,
        totalLegacyPayments,
        totalPaid,
        totalDailySellAmount,
        billableAmount,
        balance,
        productionCount: productions.length,
        orderCount: orders.length,
        dispatchCount: dispatches.length,
        paymentCount: payments.length + customerPayments.length,
        dailySellCount: dailySells.length,
      },
      productionTotals,
      productions: productions.map(toObject),
      orders: orders.map(toObject),
      dispatches: dispatches.map(toObject),
      payments: payments.map(toObject),
      customerPayments: customerPayments.map(toObject),
      dailySells: dailySells.map(toObject),
      timeline,
    })

    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    res.headers.set('Pragma', 'no-cache')
    res.headers.set('Expires', '0')
    return res
  } catch (error) {
    console.error('Error fetching customer history:', error)
    return NextResponse.json({ error: 'Failed to fetch customer history' }, { status: 500 })
  }
}
