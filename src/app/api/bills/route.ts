import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Bill, Company, Payment } from '@/lib/models'
import { requireSession } from '@/lib/auth'
import { normalizeDate } from '@/lib/date-utils'

// Force dynamic — never cache bill list responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET — list all bills (with optional filter by type/status/search)
export async function GET(request: Request) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    await connectDB()

    const { searchParams } = new URL(request.url)
    const billType = searchParams.get('billType')
    const status = searchParams.get('status')
    const search = searchParams.get('search')?.trim()

    // Build query — search matches billNumber OR party name (toName) OR
    // customer phone (toPhone). Case-insensitive regex.
    const query: Record<string, unknown> = {}
    if (billType) query.billType = billType
    if (status) query.status = status
    if (search) {
      // Escape regex metacharacters to prevent ReDoS
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      query.$or = [
        { billNumber: { $regex: safe, $options: 'i' } },
        { toName: { $regex: safe, $options: 'i' } },
        { toPhone: { $regex: safe, $options: 'i' } },
      ]
    }

    // Cap at 50 when searching (dropdown UX), otherwise return all
    const limit = search ? 50 : 0
    const bills = await Bill.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
    const res = NextResponse.json({ bills: toObject(bills) })
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    return res
  } catch (error) {
    console.error('Error fetching bills:', error)
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 })
  }
}

// POST — create new bill
export async function POST(request: Request) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    await connectDB()

    const body = await request.json()
    // Normalize date to canonical YYYY-MM-DD
    // (handles dd-mm-yyyy, dd/mm/yyyy, Excel serials, Date objects, etc.)
    if (body.date) body.date = normalizeDate(body.date)
    if (body.dueDate) body.dueDate = normalizeDate(body.dueDate)

    // Generate bill number: BILL-YYYYMM-0001
    const count = await Bill.countDocuments({})
    const now = new Date()
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    const billNumber = `BILL-${yyyymm}-${String(count + 1).padStart(4, '0')}`

    // Get company info for "from" fields (defaults)
    const company = await Company.findOne({})
    const fromName = body.fromName || company?.name || 'Veda Enterprises'
    const fromAddress = body.fromAddress || [company?.address, company?.city, company?.state, company?.pincode].filter(Boolean).join(', ')
    const fromGst = body.fromGst || company?.gstNumber || ''
    const fromPhone = body.fromPhone || company?.phone || ''

    // Calculate amounts if items present
    const items = Array.isArray(body.items) ? body.items : []
    const subTotal = items.reduce((sum: number, item: Record<string, number>) => sum + (Number(item.amount) || 0), 0)
    const discountPercent = Number(body.discountPercent) || 0
    const discountAmount = Number(body.discountAmount) || (subTotal * discountPercent / 100)
    const taxableAmount = subTotal - discountAmount

    const cgstPercent = Number(body.cgstPercent) || 0
    const cgstAmount = Number(body.cgstAmount) || (taxableAmount * cgstPercent / 100)
    const sgstPercent = Number(body.sgstPercent) || 0
    const sgstAmount = Number(body.sgstAmount) || (taxableAmount * sgstPercent / 100)
    const igstPercent = Number(body.igstPercent) || 0
    const igstAmount = Number(body.igstAmount) || (taxableAmount * igstPercent / 100)

    const totalBeforeRound = taxableAmount + cgstAmount + sgstAmount + igstAmount
    const grandTotal = Math.round(totalBeforeRound)
    const roundOff = grandTotal - totalBeforeRound

    const paidAmount = Number(body.paidAmount) || 0
    const balanceAmount = grandTotal - paidAmount

    // customerId is optional — may be null when the bill is for a walk-in party
    const customerId = body.customerId || null

    const bill = await Bill.create({
      billNumber,
      billType: body.billType || 'sales',
      date: body.date || new Date().toISOString().split('T')[0],
      dueDate: body.dueDate || '',
      customerId,
      fromName, fromAddress, fromGst, fromPhone,
      toName: body.toName,
      toAddress: body.toAddress || '',
      toGst: body.toGst || '',
      toPhone: body.toPhone || '',
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
      paymentMode: body.paymentMode || 'Cash',
      notes: body.notes || '',
      terms: body.terms || company?.terms || '',
      status: paidAmount >= grandTotal && grandTotal > 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'draft'),
      createdBy: session.name,
    })

    // Auto-sync Payment: if a customer is linked AND there's a non-zero paid
    // amount, create a corresponding Payment row so the receipt shows up in
    // the Payments module without manual entry. The Payment carries billId so
    // future updates / deletes on this Bill propagate atomically.
    if (customerId && paidAmount > 0) {
      try {
        await Payment.create({
          customerId,
          paymentType: body.paymentMode || 'Cash',
          amount: paidAmount,
          date: bill.date,
          remarks: `Auto-synced from bill ${bill.billNumber}`,
          billId: bill._id,
          billNumber: bill.billNumber,
        })
      } catch (syncErr) {
        // Sync failure is logged but must NOT fail the bill creation — the
        // bill is the source of truth, the Payment is a convenience mirror.
        console.error('Bill → Payment auto-sync failed on create:', syncErr)
      }
    }

    return NextResponse.json({ bill: toObject(bill) }, { status: 201 })
  } catch (error) {
    console.error('Error creating bill:', error)
    return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 })
  }
}
