import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Company, User, Customer, Production, Stock, Order, Dispatch, Payment, Expense } from '@/lib/models'

export async function GET() {
  try {
    await connectDB()
    const [companies, users, customers, productions, stocks, orders, dispatches, payments, expenses] = await Promise.all([
      Company.find({}),
      User.find({}),
      Customer.find({}),
      Production.find({}),
      Stock.find({}),
      Order.find({}),
      Dispatch.find({}),
      Payment.find({}),
      Expense.find({}),
    ])

    // Strip passwords from users
    const safeUsers = users.map((u: any) => {
      const obj = toObject(u)
      delete obj.password
      return obj
    })

    return NextResponse.json({
      data: {
        companies: companies.map(toObject),
        users: safeUsers,
        customers: customers.map(toObject),
        productions: productions.map(toObject),
        stocks: stocks.map(toObject),
        orders: orders.map(toObject),
        dispatches: dispatches.map(toObject),
        payments: payments.map(toObject),
        expenses: expenses.map(toObject),
      },
      counts: {
        companies: companies.length,
        users: users.length,
        customers: customers.length,
        productions: productions.length,
        stocks: stocks.length,
        orders: orders.length,
        dispatches: dispatches.length,
        payments: payments.length,
        expenses: expenses.length,
      },
    })
  } catch (error) {
    console.error('Error exporting backup:', error)
    return NextResponse.json({ error: 'Failed to export backup' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    const data = body.data

    // Clear all collections and restore
    await Promise.all([
      Company.deleteMany({}),
      User.deleteMany({}),
      Customer.deleteMany({}),
      Production.deleteMany({}),
      Stock.deleteMany({}),
      Order.deleteMany({}),
      Dispatch.deleteMany({}),
      Payment.deleteMany({}),
      Expense.deleteMany({}),
    ])

    const counts: Record<string, number> = {}

    if (data.companies?.length) { await Company.insertMany(data.companies); counts.companies = data.companies.length }
    if (data.users?.length) { await User.insertMany(data.users); counts.users = data.users.length }
    if (data.customers?.length) { await Customer.insertMany(data.customers); counts.customers = data.customers.length }
    if (data.productions?.length) { await Production.insertMany(data.productions); counts.productions = data.productions.length }
    if (data.stocks?.length) { await Stock.insertMany(data.stocks); counts.stocks = data.stocks.length }
    if (data.orders?.length) { await Order.insertMany(data.orders); counts.orders = data.orders.length }
    if (data.dispatches?.length) { await Dispatch.insertMany(data.dispatches); counts.dispatches = data.dispatches.length }
    if (data.payments?.length) { await Payment.insertMany(data.payments); counts.payments = data.payments.length }
    if (data.expenses?.length) { await Expense.insertMany(data.expenses); counts.expenses = data.expenses.length }

    return NextResponse.json({ message: 'Backup restored successfully', counts })
  } catch (error) {
    console.error('Error restoring backup:', error)
    return NextResponse.json({ error: 'Failed to restore backup' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await connectDB()
    await Promise.all([
      Customer.deleteMany({}),
      Production.deleteMany({}),
      Stock.deleteMany({}),
      Order.deleteMany({}),
      Dispatch.deleteMany({}),
      Payment.deleteMany({}),
      Expense.deleteMany({}),
    ])

    return NextResponse.json({ message: 'All data cleared successfully (users and company preserved)' })
  } catch (error) {
    console.error('Error clearing data:', error)
    return NextResponse.json({ error: 'Failed to clear data' }, { status: 500 })
  }
}
