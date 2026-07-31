import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { TractorPayment } from '@/lib/models'
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
    const records = await TractorPayment.find({}).sort({ date: -1 }).lean()
    return NextResponse.json({ tractorPayments: records.map(toObject) })
  } catch (error) {
    console.error('Error fetching tractor payments:', error)
    return NextResponse.json({ error: 'Failed to fetch tractor payments' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole(['admin', 'operator', 'accountant'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const body = await request.json()
    // Normalize date to canonical YYYY-MM-DD
    // (handles dd-mm-yyyy, dd/mm/yyyy, Excel serials, Date objects, etc.)
    if (body.date) body.date = normalizeDate(body.date)
    if (!body.date || !body.vendorName || !body.quantityTon || !body.rate) {
      return NextResponse.json({ error: 'Date, vendor name, quantity and rate are required' }, { status: 400 })
    }
    const totalAmount = Number(body.quantityTon) * Number(body.rate)
    const paidAmount = Number(body.paidAmount) || 0
    // 'type' field: 'tractor' (default, classic vendor payment) or
    // 'transporter' (auto-synced from Daily Sell). When the user creates
    // a record through the normal UI it's always 'tractor'.
    const type = body.type === 'transporter' ? 'transporter' : 'tractor'
    const record = await TractorPayment.create({
      date: body.date,
      vendorName: body.vendorName,
      quantityTon: Number(body.quantityTon),
      rate: Number(body.rate),
      totalAmount,
      paidAmount,
      remainingAmount: totalAmount - paidAmount,
      remarks: body.remarks || '',
      type,
      linkedDailySellId: body.linkedDailySellId || null,
    })
    return NextResponse.json({ tractorPayment: toObject(record) }, { status: 201 })
  } catch (error) {
    console.error('Error creating tractor payment:', error)
    return NextResponse.json({ error: 'Failed to create tractor payment' }, { status: 500 })
  }
}
