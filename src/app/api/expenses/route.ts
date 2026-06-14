import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const date = searchParams.get('date')

    const where: Record<string, unknown> = {}

    if (category) {
      where.category = category
    }

    if (date) {
      if (date.includes(',')) {
        const [startDate, endDate] = date.split(',')
        where.date = { gte: startDate, lte: endDate }
      } else {
        where.date = date
      }
    }

    const expenses = await db.expense.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ expenses, session })
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    const body = await request.json()
    const { category, amount, date, description } = body

    if (!category || !amount || !date) {
      return NextResponse.json(
        { error: 'Category, amount, and date are required' },
        { status: 400 }
      )
    }

    const expense = await db.expense.create({
      data: {
        category,
        amount,
        date,
        description: description || '',
      },
    })

    return NextResponse.json(
      { expense, session },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating expense:', error)
    return NextResponse.json(
      { error: 'Failed to create expense' },
      { status: 500 }
    )
  }
}
