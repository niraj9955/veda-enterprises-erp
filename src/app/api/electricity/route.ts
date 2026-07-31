import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Electricity } from '@/lib/models'
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
    const records = await Electricity.find({}).sort({ date: -1 }).lean()
    return NextResponse.json({ electricitys: records.map(toObject) })
  } catch (error) {
    console.error('Error fetching electricity:', error)
    return NextResponse.json({ error: 'Failed to fetch electricity' }, { status: 500 })
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
    if (!body.date || !body.amount) {
      return NextResponse.json({ error: 'Date and amount are required' }, { status: 400 })
    }
    const record = await Electricity.create({
      date: body.date,
      name: body.name || '',
      work: body.work || '',
      amount: Number(body.amount),
      remarks: body.remarks || '',
    })
    return NextResponse.json({ electricity: toObject(record) }, { status: 201 })
  } catch (error) {
    console.error('Error creating electricity:', error)
    return NextResponse.json({ error: 'Failed to create electricity' }, { status: 500 })
  }
}
