import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { mobile: { contains: search } },
        { gstNumber: { contains: search } },
        { address: { contains: search } },
      ]
    }

    const customers = await db.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ customers, session })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    const body = await request.json()
    const { name, mobile, gstNumber, address, creditLimit } = body

    if (!name || !mobile) {
      return NextResponse.json(
        { error: 'Name and mobile are required' },
        { status: 400 }
      )
    }

    const customer = await db.customer.create({
      data: {
        name,
        mobile,
        gstNumber: gstNumber || '',
        address: address || '',
        creditLimit: creditLimit || 0,
      },
    })

    return NextResponse.json(
      { customer, session },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating customer:', error)
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    )
  }
}
