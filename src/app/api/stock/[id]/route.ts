import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Stock } from '@/lib/models'

// Force dynamic — never cache individual stock responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/stock/[id] — fetch a single stock entry
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params
    const stock = await Stock.findById(id).lean()
    if (!stock) {
      return NextResponse.json({ error: 'Stock entry not found' }, { status: 404 })
    }
    return NextResponse.json({ stock: toObject(stock) })
  } catch (error) {
    console.error('Error fetching stock entry:', error)
    return NextResponse.json({ error: 'Failed to fetch stock entry' }, { status: 500 })
  }
}

// PUT /api/stock/[id] — update a single stock entry
//
// Whitelist of updatable fields. Must match StockSchema in src/lib/models.ts.
// Old UI used keys with "mm" suffix (zigZagGrey80mm etc.) which silently
// failed — that bug is now fixed in stock-module.tsx but we still accept
// both spellings here for backward compatibility (in case any old client
// caches the JS).
const STOCK_FIELDS: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: 'date',           aliases: [] },
  { canonical: 'cement',         aliases: [] },
  { canonical: 'zigZagGrey80',   aliases: ['zigZagGrey80mm'] },
  { canonical: 'zigZagRed80',    aliases: ['zigZagRed80mm'] },
  { canonical: 'zigZagYellow80', aliases: ['zigZagYellow80mm'] },
  { canonical: 'zigZagGrey60',   aliases: ['zigZagGrey60mm'] },
  { canonical: 'zigZagRed60',    aliases: ['zigZagRed60mm'] },
  { canonical: 'zigZagYellow60', aliases: ['zigZagYellow60mm'] },
  { canonical: 'chequreTile',    aliases: [] },
  { canonical: 'curveStone',     aliases: [] },
  { canonical: 'dumbleGrey80',   aliases: ['dumbleGrey80mm'] },
  { canonical: 'dumbleRed80',    aliases: ['dumbleRed80mm'] },
  { canonical: 'dumbleYellow80', aliases: ['dumbleYellow80mm'] },
]

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = {}
    for (const { canonical, aliases } of STOCK_FIELDS) {
      // Check canonical name first
      if (body[canonical] !== undefined) {
        updateData[canonical] = body[canonical]
        continue
      }
      // Then aliases (backward compat)
      for (const alias of aliases) {
        if (body[alias] !== undefined) {
          updateData[canonical] = body[alias]
          break
        }
      }
    }

    const stock = await Stock.findByIdAndUpdate(id, updateData, { new: true })
    if (!stock) {
      return NextResponse.json({ error: 'Stock entry not found' }, { status: 404 })
    }

    return NextResponse.json({ stock: toObject(stock) })
  } catch (error) {
    console.error('Error updating stock entry:', error)
    return NextResponse.json({ error: 'Failed to update stock entry' }, { status: 500 })
  }
}

// DELETE /api/stock/[id] — delete a single stock entry
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    const stock = await Stock.findByIdAndDelete(id)
    if (!stock) {
      return NextResponse.json({ error: 'Stock entry not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Stock entry deleted successfully' })
  } catch (error) {
    console.error('Error deleting stock entry:', error)
    return NextResponse.json({ error: 'Failed to delete stock entry' }, { status: 500 })
  }
}
