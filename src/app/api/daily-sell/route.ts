import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { DailySell } from '@/lib/models'
import { getSession } from '@/lib/auth'

// Force dynamic — never cache list responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    await connectDB()
    const records = await DailySell.find({}).sort({ date: -1 }).lean()
    return NextResponse.json({ dailySells: records.map(toObject) })
  } catch (error) {
    console.error('Error fetching daily sells:', error)
    return NextResponse.json({ error: 'Failed to fetch daily sells' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()

    // ── Bulk delete: POST /api/daily-sell with { ids: [...] } ──────────
    // Mirrors the production bulk-delete API so the same client-side
    // multi-select pattern works for both modules.
    if (body && Array.isArray(body.ids)) {
      const ids = body.ids.filter((id: unknown) => typeof id === 'string' && id.length > 0)
      if (ids.length === 0) {
        return NextResponse.json({ error: 'No ids provided' }, { status: 400 })
      }
      const result = await DailySell.deleteMany({ _id: { $in: ids } })
      return NextResponse.json({
        message: 'Daily sell entries deleted successfully',
        deletedCount: result.deletedCount || 0,
      })
    }

    if (!body.date || !body.customerName || body.amount == null) {
      return NextResponse.json({ error: 'Date, customer name and amount are required' }, { status: 400 })
    }
    const record = await DailySell.create({
      date: body.date,
      customerName: body.customerName,
      address: body.address || '',
      contactNumber: body.contactNumber || '',
      product: body.product || '',
      quantity: Number(body.quantity) || 0,
      rate: Number(body.rate) || 0,
      amount: Number(body.amount),
      transporterName: body.transporterName || '',
      transporterFair: Number(body.transporterFair) || 0,
      remarks: body.remarks || '',
    })
    return NextResponse.json({ dailySell: toObject(record) }, { status: 201 })
  } catch (error) {
    console.error('Error creating daily sell:', error)
    return NextResponse.json({ error: 'Failed to create daily sell' }, { status: 500 })
  }
}

// DELETE /api/daily-sell?all=true — delete every daily sell entry
// (Delete All button). Mirrors the production delete-all API so the same
// client-side pattern works. Gated behind admin session — only admins can
// perform bulk destructive operations.
export async function DELETE(request: Request) {
  try {
    await connectDB()
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized — only admins can delete all daily sell entries' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all')

    if (all === 'true' || all === '1') {
      const result = await DailySell.deleteMany({})
      return NextResponse.json({
        message: 'All daily sell entries deleted successfully',
        deletedCount: result.deletedCount || 0,
      })
    }

    // Without ?all=true this route is not used for single deletes —
    // those go through /api/daily-sell/[id]. Return a clear error.
    return NextResponse.json(
      { error: 'Use DELETE /api/daily-sell/[id] for single deletes, or ?all=true to delete every entry.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error deleting daily sell entries:', error)
    return NextResponse.json({ error: 'Failed to delete daily sell entries' }, { status: 500 })
  }
}
