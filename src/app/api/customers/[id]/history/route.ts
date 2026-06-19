import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import {
  Customer, Order, Dispatch, Payment, CustomerPayment,
} from '@/lib/models'

// Force dynamic — customer history changes after every mutation.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Customer history now only contains: Orders, Dispatches, Payments
// (legacy Payment + CustomerPayment). Production and DailySell have
// been removed per user request — they belong to factory ops, not to
// a per-customer ledger.
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
    // OR by customerName (CustomerPayment stores name, not ID).
    const [orders, dispatches, payments, customerPayments] =
      await Promise.all([
        Order.find({ customerId: id }).sort({ createdAt: -1 }).lean(),
        Dispatch.find({ customerId: id }).sort({ date: -1 }).lean(),
        Payment.find({ customerId: id }).sort({ date: -1 }).lean(),
        CustomerPayment.find(customerName ? { name: customer.name } : { _id: null })
          .sort({ date: -1 }).lean(),
      ])

    // ─── Aggregations ───────────────────────────────────────────────────────
    const totalOrderedAmount = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0)
    const totalOrderedQty = orders.reduce((s, o) => s + (Number(o.quantity) || 0), 0)
    const totalDispatchedQty = dispatches.reduce((s, d) => s + (Number(d.quantity) || 0), 0)
    const totalCustomerPayments = customerPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const totalLegacyPayments = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const totalPaid = totalCustomerPayments + totalLegacyPayments

    const balance = totalOrderedAmount - totalPaid

    // Timeline — merge order/dispatch/payment events into one sorted list
    type TimelineEvent = {
      id: string
      date: string
      type: 'order' | 'dispatch' | 'payment' | 'customer_payment'
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
        billableAmount: totalOrderedAmount,
        balance,
        orderCount: orders.length,
        dispatchCount: dispatches.length,
        paymentCount: payments.length + customerPayments.length,
      },
      orders: orders.map(toObject),
      dispatches: dispatches.map(toObject),
      payments: payments.map(toObject),
      customerPayments: customerPayments.map(toObject),
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
