import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getSession } from '@/lib/auth'
import {
  Company,
  User,
  Customer,
  Production,
  Stock,
  DailySell,
  CustomerPayment,
  LabourPayment,
  TractorPayment,
  DustPurchase,
  CementPurchase,
  Hardner,
  Electricity,
  FactoryStuff,
  Order,
  Dispatch,
  Payment,
  Expense,
  Bill,
} from '@/lib/models'

export const dynamic = 'force-dynamic'

type ModelLike = {
  countDocuments: (filter?: any) => Promise<number>
  deleteMany: (filter?: any) => Promise<{ deletedCount: number }>
}

// Map of clearable collections — `companies` and `users` are intentionally
// excluded so the admin can never wipe their own login or company profile
// via this endpoint (use the dedicated Company / Users tabs for those).
const CLEARABLE: { key: string; label: string; model: ModelLike }[] = [
  { key: 'customers',        label: 'Customers',           model: Customer as unknown as ModelLike },
  { key: 'productions',      label: 'Production Records',  model: Production as unknown as ModelLike },
  { key: 'stocks',           label: 'Stock Entries',       model: Stock as unknown as ModelLike },
  { key: 'dailySells',       label: 'Daily Sales',         model: DailySell as unknown as ModelLike },
  { key: 'customerPayments', label: 'Customer Payments',   model: CustomerPayment as unknown as ModelLike },
  { key: 'labourPayments',   label: 'Labour Payments',     model: LabourPayment as unknown as ModelLike },
  { key: 'tractorPayments',  label: 'Tractor Payments',    model: TractorPayment as unknown as ModelLike },
  { key: 'dustPurchases',    label: 'Dust Purchases',      model: DustPurchase as unknown as ModelLike },
  { key: 'cementPurchases',  label: 'Cement Purchases',    model: CementPurchase as unknown as ModelLike },
  { key: 'hardners',         label: 'Hardner Records',     model: Hardner as unknown as ModelLike },
  { key: 'electricities',    label: 'Electricity Records', model: Electricity as unknown as ModelLike },
  { key: 'factoryStuffs',    label: 'Factory Stuff',       model: FactoryStuff as unknown as ModelLike },
  { key: 'orders',           label: 'Orders',              model: Order as unknown as ModelLike },
  { key: 'dispatches',       label: 'Dispatches',          model: Dispatch as unknown as ModelLike },
  { key: 'payments',         label: 'Payments',            model: Payment as unknown as ModelLike },
  { key: 'expenses',         label: 'Expenses',            model: Expense as unknown as ModelLike },
  { key: 'bills',            label: 'Bills',               model: Bill as unknown as ModelLike },
]

// GET /api/database/clear-section
// Returns the list of clearable collections + current count for each — used
// to populate the dropdown in the Database tab UI.
export async function GET() {
  try {
    await connectDB()

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden — only admins can list clearable sections' },
        { status: 403 }
      )
    }

    const counts = await Promise.all(
      CLEARABLE.map(({ model }) => model.countDocuments({}))
    )

    const sections = CLEARABLE.map((c, i) => ({
      key: c.key,
      label: c.label,
      count: counts[i],
    }))

    return NextResponse.json({ sections })
  } catch (error) {
    console.error('Error listing clearable sections:', error)
    return NextResponse.json(
      { error: 'Failed to list clearable sections' },
      { status: 500 }
    )
  }
}

// POST /api/database/clear-section
// Body: { collection: 'customers' | 'orders' | ... }
// Deletes ALL documents from the requested collection. Admin-only.
// Returns the deletedCount so the UI can show "N records deleted".
export async function POST(request: Request) {
  try {
    await connectDB()

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden — only admins can clear sections' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { collection } = body as { collection?: string }

    if (!collection) {
      return NextResponse.json(
        { error: 'collection is required' },
        { status: 400 }
      )
    }

    const target = CLEARABLE.find((c) => c.key === collection)
    if (!target) {
      return NextResponse.json(
        { error: `Unknown collection "${collection}"` },
        { status: 400 }
      )
    }

    const result = await target.model.deleteMany({})

    return NextResponse.json({
      message: `Cleared ${result.deletedCount} record${result.deletedCount === 1 ? '' : 's'} from ${target.label}`,
      collection: target.key,
      label: target.label,
      deletedCount: result.deletedCount,
    })
  } catch (error) {
    console.error('Error clearing section:', error)
    return NextResponse.json(
      { error: 'Failed to clear section: ' + (error instanceof Error ? error.message : 'unknown error') },
      { status: 500 }
    )
  }
}
