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

    const expense = await db.expense.findUnique({
      where: { id },
    })

    if (!expense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ expense, session })
  } catch (error) {
    console.error('Error fetching expense:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expense' },
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

    const existing = await db.expense.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      )
    }

    const expense = await db.expense.update({
      where: { id },
      data: {
        ...(body.category !== undefined && { category: body.category }),
        ...(body.amount !== undefined && { amount: body.amount }),
        ...(body.date !== undefined && { date: body.date }),
        ...(body.description !== undefined && { description: body.description }),
      },
    })

    return NextResponse.json({ expense, session })
  } catch (error) {
    console.error('Error updating expense:', error)
    return NextResponse.json(
      { error: 'Failed to update expense' },
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

    const existing = await db.expense.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      )
    }

    await db.expense.delete({ where: { id } })

    return NextResponse.json(
      { message: 'Expense deleted successfully', session },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting expense:', error)
    return NextResponse.json(
      { error: 'Failed to delete expense' },
      { status: 500 }
    )
  }
}
