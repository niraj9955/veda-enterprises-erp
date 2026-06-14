import { NextResponse } from 'next/server'
import { connectDB, toObject, extractCustomer } from '@/lib/db'
import { Order } from '@/lib/models'

export async function GET() {
  try {
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
    await connectDB()
    const body = await request.json()

    if (!body.customerId || !body.brickType || !body.quantity || !body.rate || !body.deliveryDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const count = await Order.countDocuments({})
    const { Company } = await import('@/lib/models')
    const company = await Company.findOne({})
    const prefix = company?.orderPrefix || 'ORD'
    const orderNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`

    const order = await Order.create({
      orderNumber,
      customerId: body.customerId,
      brickType: body.brickType,
      quantity: Number(body.quantity),
      rate: Number(body.rate),
      amount: Number(body.amount) || Number(body.quantity) * Number(body.rate),
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
