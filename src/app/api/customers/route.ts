import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Customer } from '@/lib/models'

export async function GET(request: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    const filter: any = {}
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
      ]
    }

    const customers = await Customer.find(filter).sort({ createdAt: -1 })
    return NextResponse.json({ customers: customers.map(toObject) })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()

    if (!body.name || !body.mobile) {
      return NextResponse.json({ error: 'Name and mobile are required' }, { status: 400 })
    }

    const customer = await Customer.create({
      name: body.name,
      mobile: body.mobile,
      gstNumber: body.gstNumber || '',
      address: body.address || '',
      creditLimit: Number(body.creditLimit) || 0,
    })

    return NextResponse.json({ customer: toObject(customer) }, { status: 201 })
  } catch (error) {
    console.error('Error creating customer:', error)
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  }
}
