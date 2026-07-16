import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Payment, CustomerPayment } from '@/lib/models'
import { requireAdmin } from '@/lib/auth'

// Force dynamic — never cache
export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/debug/payment-sync
// Returns a diagnostic snapshot showing the link state between Payment and
// CustomerPayment records. Useful to verify the cross-module sync is working.
// Admin-only — exposes financial PII.
export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    await connectDB()

    const payments = await Payment.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('customerId')
      .lean()

    const customerPayments = await CustomerPayment.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    const linked = payments.filter((p: any) => p.customerPaymentId)
    const unlinked = payments.filter((p: any) => !p.customerPaymentId)

    return NextResponse.json({
      summary: {
        totalPayments: payments.length,
        linkedToCustomerPayment: linked.length,
        unlinked: unlinked.length,
        totalCustomerPayments: customerPayments.length,
      },
      unlinkedPayments: unlinked.map((p: any) => ({
        id: String(p._id),
        amount: p.amount,
        date: p.date,
        paymentType: p.paymentType,
        customerId: p.customerId?._id ?? p.customerId,
        customerName: p.customerId?.name ?? null,
        customerPaymentId: p.customerPaymentId ?? null,
        createdAt: p.createdAt,
      })),
      recentPayments: payments.map((p: any) => ({
        id: String(p._id),
        amount: p.amount,
        date: p.date,
        paymentType: p.paymentType,
        customerName: p.customerId?.name ?? null,
        customerPaymentId: p.customerPaymentId ? String(p.customerPaymentId) : null,
      })),
      recentCustomerPayments: customerPayments.map((cp: any) => ({
        id: String(cp._id),
        date: cp.date,
        name: cp.name,
        amount: cp.amount,
        remarks: cp.remarks,
        createdAt: cp.createdAt,
      })),
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
