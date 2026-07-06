import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Customer, Production, Dispatch, Bill, Order, Payment } from '@/lib/models'

// Force dynamic — history changes after every mutation.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Product field → human-readable label map. Used to flatten a Production
// doc into billable line items. Quantities of 0 are skipped downstream.
const PRODUCT_FIELDS: Array<{ key: string; label: string; hsn: string }> = [
  { key: 'cement',         label: 'Cement (bags)',         hsn: '2523' },
  { key: 'zigZagGrey80',   label: 'Zig Zag Grey 80mm',    hsn: '6810' },
  { key: 'zigZagRed80',    label: 'Zig Zag Red 80mm',     hsn: '6810' },
  { key: 'zigZagYellow80', label: 'Zig Zag Yellow 80mm',  hsn: '6810' },
  { key: 'zigZagGrey60',   label: 'Zig Zag Grey 60mm',    hsn: '6810' },
  { key: 'zigZagRed60',    label: 'Zig Zag Red 60mm',     hsn: '6810' },
  { key: 'zigZagYellow60', label: 'Zig Zag Yellow 60mm',  hsn: '6810' },
  { key: 'curveStone',     label: 'Curve Stone',          hsn: '6810' },
  { key: 'chequreTile',    label: 'Chequre Tile',         hsn: '6810' },
  { key: 'dumbleGrey80',   label: 'Dumble Grey 80mm',     hsn: '6810' },
  { key: 'dumbleRed80',    label: 'Dumble Red 80mm',      hsn: '6810' },
  { key: 'dumbleYellow80', label: 'Dumble Yellow 80mm',   hsn: '6810' },
]

// GET /api/customers/[id]/bill-history
// Returns everything needed to generate a bill for this customer:
//   - customer record (for auto-filling party details)
//   - production records (product-wise quantities per date)
//   - dispatches (delivered quantities)
//   - orders (with their items[] — user can one-click import order items
//     into the bill, so they don't have to retype line items)
//   - payments (customer's payment history — both manual payments and
//     auto-synced payments from previous bills. Useful for setting the
//     paidAmount field on a new bill.)
//   - previous bills (so user can see what's already been billed)
//   - aggregated product totals across all production records — gives the
//     user a one-click "Add all unbilled production to bill" UX
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

    // Match production by customerId only. (customerName/address fields
    // have been removed from Production — only customerId links them now.)
    const [productions, dispatches, bills, orders, payments] = await Promise.all([
      Production.find({ customerId: id }).sort({ date: -1 }).lean(),
      Dispatch.find({ customerId: id }).sort({ date: -1 }).lean(),
      Bill.find({ customerId: id }).sort({ createdAt: -1 }).lean(),
      Order.find({ customerId: id }).sort({ createdAt: -1 }).lean(),
      Payment.find({ customerId: id }).sort({ date: -1 }).lean(),
    ])

    // Aggregate product totals across all production rows — gives a
    // quick "bill everything produced" summary.
    const productTotals: Record<string, number> = {}
    for (const p of productions) {
      for (const { key } of PRODUCT_FIELDS) {
        const qty = Number((p as any)[key]) || 0
        if (qty > 0) {
          productTotals[key] = (productTotals[key] || 0) + qty
        }
      }
    }

    // Same aggregation for dispatches (delivered quantity)
    const dispatchedTotals: Record<string, number> = {}
    // Dispatches store quantities under `quantity` + `brickType` (legacy
    // schema) — they're not product-wise like production. We just sum the
    // total dispatched quantity for display.
    const totalDispatchedQty = dispatches.reduce(
      (s, d) => s + (Number(d.quantity) || 0),
      0
    )

    // Sum previously-billed amounts so the user can see outstanding balance
    const totalPreviouslyBilled = bills.reduce(
      (s, b) => s + (Number(b.grandTotal) || 0),
      0
    )
    const totalPreviouslyPaid = bills.reduce(
      (s, b) => s + (Number(b.paidAmount) || 0),
      0
    )

    // Sum all customer payments (manual + auto-synced from bills) — gives
    // the user a quick view of how much the customer has already paid
    // across all channels.
    const totalPaymentsReceived = payments.reduce(
      (s, p) => s + (Number(p.amount) || 0),
      0
    )

    const res = NextResponse.json({
      customer: toObject(customer),
      productions: productions.map(toObject),
      dispatches: dispatches.map(toObject),
      bills: bills.map(toObject),
      orders: orders.map(toObject),
      payments: payments.map(toObject),
      productFields: PRODUCT_FIELDS,
      summary: {
        productionCount: productions.length,
        dispatchCount: dispatches.length,
        billCount: bills.length,
        orderCount: orders.length,
        paymentCount: payments.length,
        totalDispatchedQty,
        totalPreviouslyBilled,
        totalPreviouslyPaid,
        totalPaymentsReceived,
        outstanding: totalPreviouslyBilled - totalPreviouslyPaid,
        productTotals,
        dispatchedTotals,
      },
    })

    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    res.headers.set('Pragma', 'no-cache')
    res.headers.set('Expires', '0')
    return res
  } catch (error) {
    console.error('Error fetching customer bill history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer bill history' },
      { status: 500 }
    )
  }
}
