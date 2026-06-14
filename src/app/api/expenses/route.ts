import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Expense } from '@/lib/models'

export async function GET(request: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const dateRange = searchParams.get('date')

    const filter: any = {}
    if (category) filter.category = category

    if (dateRange) {
      const parts = dateRange.split(',')
      if (parts.length === 2) {
        filter.date = { $gte: parts[0], $lte: parts[1] }
      } else {
        filter.date = dateRange
      }
    }

    const expenses = await Expense.find(filter).sort({ date: -1 })
    return NextResponse.json({ expenses: expenses.map(toObject) })
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()

    if (!body.category || !body.amount || !body.date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const expense = await Expense.create({
      category: body.category,
      amount: Number(body.amount),
      date: body.date,
      description: body.description || '',
    })

    return NextResponse.json({ expense: toObject(expense) }, { status: 201 })
  } catch (error) {
    console.error('Error creating expense:', error)
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}
