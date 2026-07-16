import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Payment, CustomerPayment, Customer } from '@/lib/models'
import { requireAdmin } from '@/lib/auth'

// Force dynamic — never cache
export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/debug/payment-sync/backfill
//
// One-time backfill: for every Payment that does NOT have a customerPaymentId,
// create the missing CustomerPayment mirror and link it back. Safe to run
// repeatedly — skips Payments that already have a mirror.
//
// This handles the case where Payments were created BEFORE the cross-module
// sync feature was deployed, so they never got their mirror record.
//
// Admin-only — mutates data.
export async function POST() {
  try {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    await connectDB()

    const unlinked = await Payment.find({
      $or: [
        { customerPaymentId: null },
        { customerPaymentId: { $exists: false } },
      ],
    }).lean()

    const results: Array<{ paymentId: string; ok: boolean; error?: string }> = []

    for (const p of unlinked as any[]) {
      try {
        // Resolve customer name + address
        const customer = await Customer.findById(p.customerId).lean()
        if (!customer) {
          results.push({
            paymentId: String(p._id),
            ok: false,
            error: 'customer not found',
          })
          continue
        }

        const mirror = await CustomerPayment.create({
          date: p.date,
          name: String((customer as any).name || ''),
          address: String((customer as any).address || ''),
          amount: Number(p.amount) || 0,
          remarks: [
            p.paymentType,
            p.billNumber ? `Bill ${p.billNumber}` : '',
            p.remarks || '',
            '[synced from Payments]',
          ]
            .filter(Boolean)
            .join(' • '),
        })

        await Payment.findByIdAndUpdate(p._id, {
          customerPaymentId: mirror._id,
        })

        results.push({ paymentId: String(p._id), ok: true })
      } catch (err) {
        results.push({
          paymentId: String(p._id),
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return NextResponse.json({
      totalScanned: unlinked.length,
      successCount: results.filter((r) => r.ok).length,
      failureCount: results.filter((r) => !r.ok).length,
      results,
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
