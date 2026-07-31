import { NextResponse } from 'next/server'
import { connectDB, toObject, extractCustomer, extractOrder } from '@/lib/db'
import { Dispatch, Stock } from '@/lib/models'
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
    const dispatches = await Dispatch.find({}).populate('customerId').populate('orderId').sort({ createdAt: -1 })

    const result = dispatches.map((d: any) => {
      const obj = toObject(d)
      const { customer, customerId } = extractCustomer(d)
      const { order, orderId } = extractOrder(d)
      obj.customer = customer
      obj.customerId = customerId
      obj.order = order
      obj.orderId = orderId
      obj.customerName = customer?.name || ''
      return obj
    })

    return NextResponse.json({ dispatches: result })
  } catch (error) {
    console.error('Error fetching dispatches:', error)
    return NextResponse.json({ error: 'Failed to fetch dispatches' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole(['admin', 'operator'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const body = await request.json()
    // Normalize date to canonical YYYY-MM-DD
    // (handles dd-mm-yyyy, dd/mm/yyyy, Excel serials, Date objects, etc.)
    if (body.date) body.date = normalizeDate(body.date)

    if (!body.customerId || !body.truckNumber || !body.quantity || !body.brickType || !body.date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const count = await Dispatch.countDocuments({})
    const { Company } = await import('@/lib/models')
    const company = await Company.findOne({})
    const prefix = company?.dispatchPrefix || 'DSP'
    const dispatchNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`

    const dispatch = await Dispatch.create({
      dispatchNumber,
      customerId: body.customerId,
      orderId: body.orderId || null,
      truckNumber: body.truckNumber,
      driverName: body.driverName || '',
      quantity: Number(body.quantity),
      brickType: body.brickType,
      date: body.date,
    })

    // Auto-update stock - reduce on dispatch
    const stock = await Stock.findOne({ brickType: body.brickType })
    if (stock) {
      stock.currentStock = Math.max(0, stock.currentStock - Number(body.quantity))
      await stock.save()
    }

    const populated = await Dispatch.findById(dispatch._id).populate('customerId').populate('orderId')
    const obj = toObject(populated)
    const { customer, customerId } = extractCustomer(populated)
    const { order, orderId } = extractOrder(populated)
    obj.customer = customer
    obj.customerId = customerId
    obj.order = order
    obj.orderId = orderId
    obj.customerName = customer?.name || ''

    return NextResponse.json({ dispatch: obj }, { status: 201 })
  } catch (error) {
    console.error('Error creating dispatch:', error)
    return NextResponse.json({ error: 'Failed to create dispatch' }, { status: 500 })
  }
}
