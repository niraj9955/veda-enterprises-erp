import { NextResponse } from 'next/server'
import { connectDB, toObject, extractCustomer } from '@/lib/db'
import { Order, Bill, Payment } from '@/lib/models'
import { requireSession, requireRole } from '@/lib/auth'
import { normalizeDate } from '@/lib/date-utils'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params
    const order = await Order.findById(id).populate('customerId')
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    const obj = toObject(order)
    const { customer, customerId } = extractCustomer(order)
    obj.customer = customer
    obj.customerId = customerId
    return NextResponse.json({ order: obj })
  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(['admin', 'operator'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params
    const body = await request.json()
    // Normalize date to canonical YYYY-MM-DD
    // (handles dd-mm-yyyy, dd/mm/yyyy, Excel serials, Date objects, etc.)
    if (body.deliveryDate) body.deliveryDate = normalizeDate(body.deliveryDate)

    const updateData: Record<string, unknown> = {}
    const fields = ['customerId', 'brickType', 'quantity', 'rate', 'amount', 'deliveryDate', 'status']
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }

    // Items array — when provided, normalize each item and recompute
    // the summary quantity/rate/amount fields so they stay in sync.
    if (Array.isArray(body.items)) {
      const items = body.items
        .map((it: any) => ({
          description: String(it.description || '').trim(),
          hsn: String(it.hsn || ''),
          quantity: Number(it.quantity) || 0,
          unit: String(it.unit || 'pcs'),
          rate: Number(it.rate) || 0,
          amount: Number(it.amount) || (Number(it.quantity) || 0) * (Number(it.rate) || 0),
        }))
        .filter((it: any) => it.description)
      updateData.items = items
      if (items.length > 0) {
        const totalQty = items.reduce((s: number, it: any) => s + it.quantity, 0)
        const totalAmt = items.reduce((s: number, it: any) => s + it.amount, 0)
        updateData.quantity = totalQty
        updateData.amount = totalAmt
        updateData.rate = totalQty > 0 ? totalAmt / totalQty : 0
        if (!updateData.brickType) updateData.brickType = items[0].description
      }
    }

    const order = await Order.findByIdAndUpdate(id, updateData, { new: true }).populate('customerId')
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const obj = toObject(order)
    const { customer, customerId } = extractCustomer(order)
    obj.customer = customer
    obj.customerId = customerId
    return NextResponse.json({ order: obj })
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE — remove an Order.
//
// CASCADE:
//   • Bills that reference this order via remarks/notes are NOT deleted
//     automatically — the user may have already printed and sent them.
//     Instead, we leave them as historical records.
//   • Dispatches linked to this order (orderId) are NOT deleted either —
//     they represent physical goods that left the factory and shouldn't be
//     erased just because the order was removed.
//
// What we DO clean up:
//   • Nothing automatically — the order is the source of truth, but its
//     deletion doesn't invalidate downstream financial records.
//
// This is the safe default. If you want aggressive cascade deletion,
// uncomment the cascade block below.
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(['admin', 'operator'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const { id } = await params
    const order = await Order.findByIdAndDelete(id)
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    return NextResponse.json({ message: 'Order deleted successfully' })
  } catch (error) {
    console.error('Error deleting order:', error)
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })
  }
}
