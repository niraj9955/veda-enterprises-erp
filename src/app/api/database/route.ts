import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()

    const [company, users, customers, production, stock, orders, dispatch, payments, expenses] =
      await Promise.all([
        db.company.findFirst(),
        db.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        db.customer.findMany(),
        db.production.findMany(),
        db.stock.findMany(),
        db.order.findMany(),
        db.dispatch.findMany(),
        db.payment.findMany(),
        db.expense.findMany(),
      ])

    return NextResponse.json({
      data: {
        company,
        users,
        customers,
        production,
        stock,
        orders,
        dispatch,
        payments,
        expenses,
      },
      session,
    })
  } catch (error) {
    console.error('Error exporting database:', error)
    return NextResponse.json(
      { error: 'Failed to export database' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const session = await getSession()

    // Delete business data in order respecting foreign keys
    // Dispatches reference Orders and Customers
    // Payments reference Customers
    // Orders reference Customers and have Dispatches
    await db.dispatch.deleteMany()
    await db.payment.deleteMany()
    await db.expense.deleteMany()
    await db.order.deleteMany()
    await db.production.deleteMany()
    await db.stock.deleteMany()
    await db.customer.deleteMany()

    // Delete non-admin users
    await db.user.deleteMany({
      where: {
        role: { not: 'admin' },
      },
    })

    return NextResponse.json({
      message: 'Data cleared successfully',
      session,
    })
  } catch (error) {
    console.error('Error clearing database:', error)
    return NextResponse.json(
      { error: 'Failed to clear database' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession()
    const body = await request.json()
    const { data } = body

    if (!data) {
      return NextResponse.json(
        { error: 'No data provided for restore' },
        { status: 400 }
      )
    }

    const counts: Record<string, number> = {}

    // Delete existing data and restore from backup
    // Must handle in correct order due to foreign key constraints

    // 1. Dispatches (references orders and customers)
    if (data.dispatch) {
      await db.dispatch.deleteMany()
      if (data.dispatch.length > 0) {
        await db.dispatch.createMany({ data: data.dispatch })
      }
      counts.dispatch = data.dispatch.length || 0
    }

    // 2. Payments (references customers)
    if (data.payments) {
      await db.payment.deleteMany()
      if (data.payments.length > 0) {
        await db.payment.createMany({ data: data.payments })
      }
      counts.payments = data.payments.length || 0
    }

    // 3. Expenses (no foreign keys)
    if (data.expenses) {
      await db.expense.deleteMany()
      if (data.expenses.length > 0) {
        await db.expense.createMany({ data: data.expenses })
      }
      counts.expenses = data.expenses.length || 0
    }

    // 4. Orders (references customers, has dispatches)
    if (data.orders) {
      await db.order.deleteMany()
      if (data.orders.length > 0) {
        await db.order.createMany({ data: data.orders })
      }
      counts.orders = data.orders.length || 0
    }

    // 5. Production (no foreign keys)
    if (data.production) {
      await db.production.deleteMany()
      if (data.production.length > 0) {
        await db.production.createMany({ data: data.production })
      }
      counts.production = data.production.length || 0
    }

    // 6. Stock (no foreign keys)
    if (data.stock) {
      await db.stock.deleteMany()
      if (data.stock.length > 0) {
        await db.stock.createMany({ data: data.stock })
      }
      counts.stock = data.stock.length || 0
    }

    // 7. Customers (referenced by orders, dispatches, payments)
    if (data.customers) {
      await db.customer.deleteMany()
      if (data.customers.length > 0) {
        await db.customer.createMany({ data: data.customers })
      }
      counts.customers = data.customers.length || 0
    }

    return NextResponse.json({
      message: 'Data restored',
      counts,
      session,
    })
  } catch (error) {
    console.error('Error restoring database:', error)
    return NextResponse.json(
      { error: 'Failed to restore database' },
      { status: 500 }
    )
  }
}
