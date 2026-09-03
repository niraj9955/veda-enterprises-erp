import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Bill, Payment } from '@/lib/models'
import { requireSession, requireAdmin } from '@/lib/auth'
import { normalizeDate } from '@/lib/date-utils'

// GET single bill
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    await connectDB()

    const { id } = await params
    const bill = await Bill.findById(id).lean()
    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }
    return NextResponse.json({ bill: toObject(bill) })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch bill' }, { status: 500 })
  }
}

// PUT — update bill
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    await connectDB()

    const { id } = await params
    const body = await request.json()
    // Normalize date to canonical YYYY-MM-DD
    // (handles dd-mm-yyyy, dd/mm/yyyy, Excel serials, Date objects, etc.)
    if (body.date) body.date = normalizeDate(body.date)
    if (body.dueDate) body.dueDate = normalizeDate(body.dueDate)

    const existing = await Bill.findById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    // Recalculate amounts if items changed
    const items = Array.isArray(body.items) ? body.items : existing.items
    const subTotal = items.reduce((sum: number, item: Record<string, number>) => sum + (Number(item.amount) || 0), 0)
    const discountPercent = body.discountPercent !== undefined ? Number(body.discountPercent) : existing.discountPercent
    const discountAmount = body.discountAmount !== undefined ? Number(body.discountAmount) : (subTotal * discountPercent / 100)
    const taxableAmount = subTotal - discountAmount

    const cgstPercent = body.cgstPercent !== undefined ? Number(body.cgstPercent) : existing.cgstPercent
    const cgstAmount = taxableAmount * cgstPercent / 100
    const sgstPercent = body.sgstPercent !== undefined ? Number(body.sgstPercent) : existing.sgstPercent
    const sgstAmount = taxableAmount * sgstPercent / 100
    const igstPercent = body.igstPercent !== undefined ? Number(body.igstPercent) : existing.igstPercent
    const igstAmount = taxableAmount * igstPercent / 100

    const totalBeforeRound = taxableAmount + cgstAmount + sgstAmount + igstAmount
    const grandTotal = Math.round(totalBeforeRound)
    const roundOff = grandTotal - totalBeforeRound

    const paidAmount = body.paidAmount !== undefined ? Number(body.paidAmount) : existing.paidAmount
    const balanceAmount = grandTotal - paidAmount

    // customerId resolution: explicit null means "unlink", undefined means "no change"
    const customerId = body.customerId !== undefined ? (body.customerId || null) : existing.customerId

    const updateData: Record<string, unknown> = {
      ...body,
      customerId,
      items,
      subTotal,
      discountPercent,
      discountAmount,
      taxableAmount,
      cgstPercent, cgstAmount,
      sgstPercent, sgstAmount,
      igstPercent, igstAmount,
      roundOff,
      grandTotal,
      paidAmount,
      balanceAmount,
    }

    if (body.status !== undefined) {
      updateData.status = body.status
    } else if (paidAmount >= grandTotal && grandTotal > 0) {
      updateData.status = 'paid'
    } else if (paidAmount > 0) {
      updateData.status = 'partial'
    }

    const updated = await Bill.findByIdAndUpdate(id, updateData, { new: true })

    // ── Auto-sync Payment ─────────────────────────────────────────────────
    // Keep the Payment mirror in sync with the bill's paidAmount + customer.
    // Three cases:
    //   1. paidAmount > 0 && customerId set  → upsert Payment (create or update)
    //   2. paidAmount === 0 || customerId null → delete any existing synced Payment
    //   3. customer changed → delete old Payment, create new under new customer
    // SKIPPED for quotations — quotations are not real invoices, so they
    // never have a "paid amount" to mirror into the Payments module. Any
    // stale Payment from a previously-invoiced record (e.g. billType was
    // changed from 'sales' to 'quotation') is still cleaned up below.
    const isQuotation = (updateData.billType || existing.billType) === 'quotation'
    try {
      const existingPayment = await Payment.findOne({ billId: existing._id })

      if (customerId && paidAmount > 0 && !isQuotation) {
        const paymentType = body.paymentMode || existing.paymentMode || 'Cash'
        const remarks = `Auto-synced from bill ${existing.billNumber}`
        if (existingPayment) {
          // Update in place — handles amount / customer / mode changes
          await Payment.findByIdAndUpdate(existingPayment._id, {
            customerId,
            paymentType,
            amount: paidAmount,
            date: body.date || existing.date,
            remarks,
          })
        } else {
          // Customer re-linked or first time paidAmount set — create fresh
          await Payment.create({
            customerId,
            paymentType,
            amount: paidAmount,
            date: body.date || existing.date,
            remarks,
            billId: existing._id,
            billNumber: existing.billNumber,
          })
        }
      } else {
        // paidAmount went to 0 OR customer was unlinked → remove the mirror
        if (existingPayment) {
          await Payment.findByIdAndDelete(existingPayment._id)
        }
      }
    } catch (syncErr) {
      // Sync failure is logged but does NOT fail the bill update — the bill
      // is the source of truth, the Payment is a convenience mirror.
      console.error('Bill → Payment auto-sync failed on update:', syncErr)
    }

    return NextResponse.json({ bill: toObject(updated) })
  } catch (error) {
    console.error('Error updating bill:', error)
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 })
  }
}

// DELETE bill — admin-only (per canPerform map, only admin can delete bills)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    await connectDB()

    const { id } = await params
    const deleted = await Bill.findByIdAndDelete(id)
    if (!deleted) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    // Cascade: remove the auto-synced Payment mirror (if any). Manual payments
    // created via /api/payments have billId = null and are never touched here.
    try {
      await Payment.deleteMany({ billId: deleted._id })
    } catch (syncErr) {
      console.error('Bill → Payment cascade delete failed:', syncErr)
    }

    return NextResponse.json({ message: 'Bill deleted successfully' })
  } catch {
    return NextResponse.json({ error: 'Failed to delete bill' }, { status: 500 })
  }
}
