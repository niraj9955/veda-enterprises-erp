import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { LabourPayment } from '@/lib/models'
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
    const records = await LabourPayment.find({}).sort({ date: -1 }).lean()
    return NextResponse.json({ labourPayments: records.map(toObject) })
  } catch (error) {
    console.error('Error fetching labour payments:', error)
    return NextResponse.json({ error: 'Failed to fetch labour payments' }, { status: 500 })
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
    if (!body.date || !body.name || !body.amount) {
      return NextResponse.json({ error: 'Date, name and amount are required' }, { status: 400 })
    }
    const record = await LabourPayment.create({
      date: body.date,
      name: body.name,
      address: body.address || '',
      amount: Number(body.amount),
      remarks: body.remarks || '',
    })
    return NextResponse.json({ labourPayment: toObject(record) }, { status: 201 })
  } catch (error) {
    console.error('Error creating labour payment:', error)
    return NextResponse.json({ error: 'Failed to create labour payment' }, { status: 500 })
  }
}
