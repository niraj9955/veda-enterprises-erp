import { NextResponse } from 'next/server'
import { connectDB, toObject, extractCustomer } from '@/lib/db'
import { Payment } from '@/lib/models'
import { resyncBillPaidAmount } from '../route'
import { syncUpdateCustomerPayment, syncDeleteCustomerPayment } from '@/lib/payment-customer-sync'
import { requireSession, requireRole } from '@/lib/auth'
import { normalizeDate } from '@/lib/date-utils'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params
    const payment = await Payment.findById(id).populate('customerId')
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }
    const obj = toObject(payment)
    const { customer, customerId } = extractCustomer(payment)
    obj.customer = customer
    obj.customerId = customerId
    return NextResponse.json({ payment: obj })
  } catch (error) {
    console.error('Error fetching payment:', error)
    return NextResponse.json({ error: 'Failed to fetch payment' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT — update a Payment.
//
// AUTO-SYNC (reverse direction):
//   • If this Payment is linked to a Bill (billId), we re-sync the Bill's
//     paidAmount after the update so the Bill reflects the new payment amount.
//   • If the billId is being CHANGED (payment moved to a different bill):
//       1. Re-sync the OLD bill (its paidAmount drops by the old amount).
//       2. Re-sync the NEW bill (its paidAmount rises by the new amount).
//   • If billId is being CLEARED (unlinked): re-sync the old bill.
//   • If billId is being SET for the first time: re-sync the new bill.
//
// This makes the Bill module always reflect the truth of all Payments,
// regardless of which side was edited.
// ─────────────────────────────────────────────────────────────────────────────
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(['admin', 'accountant'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params
    const body = await request.json()
    // Normalize date to canonical YYYY-MM-DD
    // (handles dd-mm-yyyy, dd/mm/yyyy, Excel serials, Date objects, etc.)
    if (body.date) body.date = normalizeDate(body.date)

    // Capture the old billId (if any) before update so we can re-sync it
    const existing = await Payment.findById(id).lean()
    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }
    const oldBillId = existing.billId ? String(existing.billId) : null

    const updateData: Record<string, unknown> = {}
    const fields = ['customerId', 'paymentType', 'amount', 'date', 'remarks']
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }

    // Handle billId changes — explicit null means "unlink", undefined means "no change"
    let newBillId: string | null = oldBillId
    if (body.billId !== undefined) {
      if (body.billId) {
        // Linking to a new bill — also update billNumber for display
        const { Bill } = await import('@/lib/models')
        const linkedBill = await Bill.findById(body.billId).lean()
        if (!linkedBill) {
          return NextResponse.json({ error: 'Linked bill not found' }, { status: 400 })
        }
        updateData.billId = linkedBill._id
        updateData.billNumber = linkedBill.billNumber
        newBillId = String(linkedBill._id)
      } else {
        // Explicit unlink — clear billId + billNumber
        updateData.billId = null
        updateData.billNumber = ''
        newBillId = null
      }
    }

    const payment = await Payment.findByIdAndUpdate(id, updateData, { new: true }).populate('customerId')
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // ── Reverse sync: recompute Bills' paidAmount ────────────────────────
    // Re-sync OLD bill (if payment was previously linked and bill changed)
    if (oldBillId && oldBillId !== newBillId) {
      try { await resyncBillPaidAmount(oldBillId) } catch (e) { console.error('reverse-sync old bill failed:', e) }
    }
    // Re-sync NEW bill (if payment is now linked)
    if (newBillId) {
      try { await resyncBillPaidAmount(newBillId) } catch (e) { console.error('reverse-sync new bill failed:', e) }
    }

    // ── Mirror update into CustomerPayment module ──────────────────────
    // Best-effort: any failure is logged but does not fail the Payment update.
    try {
      await syncUpdateCustomerPayment({
        paymentId: id,
        customerId: String(updateData.customerId || existing.customerId),
        amount: Number(updateData.amount ?? existing.amount) || 0,
        date: String(updateData.date || existing.date),
        paymentType: String(updateData.paymentType || existing.paymentType || ''),
        remarks: String((updateData.remarks ?? existing.remarks) || ''),
        billNumber: String((updateData.billNumber ?? existing.billNumber) || ''),
      })
    } catch (syncErr) {
      console.error('Payment → CustomerPayment mirror on update failed:', syncErr)
    }

    const obj = toObject(payment)
    const { customer, customerId } = extractCustomer(payment)
    obj.customer = customer
    obj.customerId = customerId
    return NextResponse.json({ payment: obj })
  } catch (error) {
    console.error('Error updating payment:', error)
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE — remove a Payment.
//
// AUTO-SYNC (reverse direction):
//   • If this Payment was linked to a Bill (billId), re-sync the Bill so its
//     paidAmount drops by this Payment's amount. The Bill's status is
//     recomputed (paid → partial → draft) automatically.
//   • The mirrored CustomerPayment record (if any) is also deleted so the
//     Customer Payment module stays in sync.
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(['admin', 'accountant'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params

    // Capture the billId BEFORE deleting so we can re-sync afterwards
    const existing = await Payment.findById(id).lean()
    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }
    const linkedBillId = existing.billId ? String(existing.billId) : null

    // ── Mirror delete into CustomerPayment module ──────────────────────
    // Must run BEFORE the Payment itself is deleted, because the sync helper
    // reads `existing.customerPaymentId` to know which mirror to remove.
    try {
      await syncDeleteCustomerPayment(id)
    } catch (syncErr) {
      console.error('Payment → CustomerPayment mirror on delete failed:', syncErr)
    }

    await Payment.findByIdAndDelete(id)

    // Reverse sync: recompute the Bill's paidAmount (will drop by this payment's amount)
    if (linkedBillId) {
      try { await resyncBillPaidAmount(linkedBillId) } catch (e) { console.error('reverse-sync on delete failed:', e) }
    }

    return NextResponse.json({ message: 'Payment deleted successfully' })
  } catch (error) {
    console.error('Error deleting payment:', error)
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 })
  }
}
