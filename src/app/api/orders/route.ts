import { NextResponse } from 'next/server'
import { connectDB, toObject, extractCustomer } from '@/lib/db'
import { Order } from '@/lib/models'
import { requireSession, requireRole } from '@/lib/auth'

// Force dynamic — never cache list responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    await connectDB()
    const orders = await Order.find({}).populate('customerId').sort({ createdAt: -1 })

    const result = orders.map((o: any) => {
      const obj = toObject(o)
      const { customer, customerId } = extractCustomer(o)
      obj.customer = customer
      obj.customerId = customerId
      return obj
    })

    return NextResponse.json({ orders: result })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole(['admin', 'operator'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const body = await request.json()

    if (!body.customerId || !body.deliveryDate) {
      return NextResponse.json({ error: 'Customer and delivery date are required' }, { status: 400 })
    }
    // Either brickType+quantity+rate OR items[] must be provided
    const hasItems = Array.isArray(body.items) && body.items.length > 0
    const hasBrickType = body.brickType && body.quantity && body.rate
    if (!hasItems && !hasBrickType) {
      return NextResponse.json({ error: 'Provide either brick type + qty + rate, or at least one line item' }, { status: 400 })
    }

    const count = await Order.countDocuments({})
    const { Company } = await import('@/lib/models')
    const company = await Company.findOne({})
    const prefix = company?.orderPrefix || 'ORD'
    const orderNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`

    // Normalize items array — each item gets its amount computed from
    // quantity * rate if not explicitly provided.
    const items = hasItems
      ? body.items.map((it: any) => ({
          description: String(it.description || '').trim(),
          hsn: String(it.hsn || ''),
          quantity: Number(it.quantity) || 0,
          unit: String(it.unit || 'pcs'),
          rate: Number(it.rate) || 0,
          amount: Number(it.amount) || (Number(it.quantity) || 0) * (Number(it.rate) || 0),
        })).filter((it: any) => it.description)
      : []

    // Compute summary fields from items (if present) — these populate the
    // legacy brickType/quantity/rate/amount columns for backward compat
    // with the dispatch module + reports that read those fields.
    let brickType = String(body.brickType || '')
    let quantity = Number(body.quantity) || 0
    let rate = Number(body.rate) || 0
    let amount = Number(body.amount) || (quantity * rate)

    if (items.length > 0) {
      // If brickType wasn't provided, use the first item's description
      if (!brickType) brickType = items[0].description
      quantity = items.reduce((s: number, it: any) => s + it.quantity, 0)
      amount = items.reduce((s: number, it: any) => s + it.amount, 0)
      // Weighted average rate
      rate = quantity > 0 ? amount / quantity : 0
    }

    const order = await Order.create({
      orderNumber,
      customerId: body.customerId,
      brickType,
      quantity,
      rate,
      amount,
      items,
      deliveryDate: body.deliveryDate,
      status: body.status || 'Pending',
    })

    const populated = await Order.findById(order._id).populate('customerId')
    const obj = toObject(populated)
    const { customer, customerId } = extractCustomer(populated)
    obj.customer = customer
    obj.customerId = customerId

    return NextResponse.json({ order: obj }, { status: 201 })
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
