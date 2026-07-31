import { NextResponse } from 'next/server'
import { connectDB, toObject, extractCustomer } from '@/lib/db'
import { Payment, Bill } from '@/lib/models'
import {
  syncCreateCustomerPayment,
  syncUpdateCustomerPayment,
  syncDeleteCustomerPayment,
} from '@/lib/payment-customer-sync'
import { requireSession, requireRole } from '@/lib/auth'
import { normalizeDate } from '@/lib/date-utils'

// Force dynamic — never cache list responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    await connectDB()
    const payments = await Payment.find({}).populate('customerId').sort({ createdAt: -1 })

    const result = payments.map((p: any) => {
      const obj = toObject(p)
      const { customer, customerId } = extractCustomer(p)
      obj.customer = customer
      obj.customerId = customerId
      return obj
    })

    return NextResponse.json({ payments: result })
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — create a new Payment (manual entry from Payments module).
//
// AUTO-SYNC: This is the reverse direction of the Bill → Payment sync.
// When a user creates a Payment from the Payments module:
//   • If body.billId is supplied → link this Payment to that Bill and
//     increment the Bill's paidAmount by this Payment's amount. The Bill's
//     balanceAmount + status are recomputed.
//   • If body.billId is NOT supplied but the customer has an outstanding
//     Bill (status = 'partial' or 'draft' or 'sent'), we DO NOT auto-link.
//     The user must explicitly choose a bill from the dropdown in the UI.
//     We avoid auto-applying payments to arbitrary bills because that could
//     pay off the wrong invoice.
//
// After creating the Payment, if a billId was provided, we recompute the
// Bill's paidAmount as the SUM of all Payments linked to that bill
// (including this new one). This is more robust than incrementing by
// `amount` because it self-heals if any prior sync was missed.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const session = await requireRole(['admin', 'accountant'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const body = await request.json()
    // Normalize date to canonical YYYY-MM-DD
    // (handles dd-mm-yyyy, dd/mm/yyyy, Excel serials, Date objects, etc.)
    if (body.date) body.date = normalizeDate(body.date)

    if (!body.customerId || !body.paymentType || !body.amount || !body.date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Resolve billId — optional. If provided, must be a valid Bill _id.
    let billId: string | null = null
    let billNumber = ''
    if (body.billId) {
      const linkedBill = await Bill.findById(body.billId).lean()
      if (!linkedBill) {
        return NextResponse.json({ error: 'Linked bill not found' }, { status: 400 })
      }
      billId = String(linkedBill._id)
      billNumber = linkedBill.billNumber
    }

    const payment = await Payment.create({
      customerId: body.customerId,
      paymentType: body.paymentType,
      amount: Number(body.amount),
      date: body.date,
      remarks: body.remarks || '',
      billId,
      billNumber,
    })

    // ── Reverse sync: update the linked Bill's paidAmount ────────────────
    if (billId) {
      try {
        await resyncBillPaidAmount(billId)
      } catch (syncErr) {
        // Sync failure must NOT fail the payment creation.
        console.error('Payment → Bill reverse-sync failed on create:', syncErr)
      }
    }

    // ── Mirror into CustomerPayment module ────────────────────────────────
    // Best-effort: any failure is logged but does not fail the Payment create.
    try {
      await syncCreateCustomerPayment({
        paymentId: payment._id,
        customerId: body.customerId,
        amount: Number(body.amount) || 0,
        date: body.date,
        paymentType: body.paymentType,
        remarks: body.remarks || '',
        billNumber,
      })
    } catch (syncErr) {
      console.error('Payment → CustomerPayment mirror on create failed:', syncErr)
    }

    const populated = await Payment.findById(payment._id).populate('customerId')
    const obj = toObject(populated)
    const { customer, customerId } = extractCustomer(populated)
    obj.customer = customer
    obj.customerId = customerId
    return NextResponse.json({ payment: obj }, { status: 201 })
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: recompute a Bill's paidAmount + balanceAmount + status from the
// sum of all Payments linked to it via billId.
//
// Used by:
//   • /api/payments POST (new payment linked to bill)
//   • /api/payments/[id] PUT (payment updated — amount may have changed)
//   • /api/payments/[id] DELETE (payment removed — bill's paidAmount drops)
//
// This makes the Bill always reflect the actual sum of linked payments,
// regardless of which side was edited. Idempotent — safe to call repeatedly.
// ─────────────────────────────────────────────────────────────────────────────
export async function resyncBillPaidAmount(billId: string): Promise<void> {
  const bill = await Bill.findById(billId)
  if (!bill) return

  // Sum all Payments linked to this bill
  const agg = await Payment.aggregate([
    { $match: { billId: bill._id } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ])
  const totalPaid = agg.length > 0 ? Number(agg[0].total) || 0 : 0

  // Recompute balance + status
  const grandTotal = Number(bill.grandTotal) || 0
  const balanceAmount = grandTotal - totalPaid

  let status: string
  if (totalPaid >= grandTotal && grandTotal > 0) {
    status = 'paid'
  } else if (totalPaid > 0) {
    status = 'partial'
  } else {
    status = 'draft'
  }

  await Bill.findByIdAndUpdate(bill._id, {
    paidAmount: totalPaid,
    balanceAmount,
    status,
  })
}
