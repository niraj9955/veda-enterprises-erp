import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const { id } = await params

    const customer = await db.customer.findUnique({
      where: { id },
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ customer, session })
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const { id } = await params
    const body = await request.json()

    const existing = await db.customer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    const customer = await db.customer.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.mobile !== undefined && { mobile: body.mobile }),
        ...(body.gstNumber !== undefined && { gstNumber: body.gstNumber }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.creditLimit !== undefined && { creditLimit: body.creditLimit }),
      },
    })

    return NextResponse.json({ customer, session })
  } catch (error) {
    console.error('Error updating customer:', error)
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const { id } = await params

    const existing = await db.customer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    await db.customer.delete({ where: { id } })

    return NextResponse.json(
      { message: 'Customer deleted successfully', session },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    )
  }
}
