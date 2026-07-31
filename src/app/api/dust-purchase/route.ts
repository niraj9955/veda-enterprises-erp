import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { DustPurchase } from '@/lib/models'
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
    const records = await DustPurchase.find({}).sort({ date: -1 }).lean()
    return NextResponse.json({ dustPurchases: records.map(toObject) })
  } catch (error) {
    console.error('Error fetching dust purchases:', error)
    return NextResponse.json({ error: 'Failed to fetch dust purchases' }, { status: 500 })
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
    if (!body.date || !body.vendorName || !body.quantity || !body.rate) {
      return NextResponse.json({ error: 'Date, vendor name, quantity and rate are required' }, { status: 400 })
    }
    const totalAmount = Number(body.quantity) * Number(body.rate)
    const record = await DustPurchase.create({
      date: body.date,
      vendorName: body.vendorName,
      cementName: body.cementName || '',
      quantity: Number(body.quantity),
      rate: Number(body.rate),
      totalAmount,
      paidAmount: Number(body.paidAmount) || 0,
      transportationCharge: Number(body.transportationCharge) || 0,
      gst: Number(body.gst) || 0,
      remarks: body.remarks || '',
    })
    return NextResponse.json({ dustPurchase: toObject(record) }, { status: 201 })
  } catch (error) {
    console.error('Error creating dust purchase:', error)
    return NextResponse.json({ error: 'Failed to create dust purchase' }, { status: 500 })
  }
}
