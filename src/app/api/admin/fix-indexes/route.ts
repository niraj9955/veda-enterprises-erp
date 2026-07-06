import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Stock, Production } from '@/lib/models'
import mongoose from 'mongoose'

// Force dynamic — never cache
export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/admin/fix-indexes
// One-shot fix: drops stale indexes from collections that no longer have those
// fields in their schema. Specifically:
//   - stocks.brickType_1   (old Stock schema had a brickType field — now removed)
//   - any other indexes not in the current schema
//
// Safe to call multiple times. Returns before/after index lists for audit.
export async function GET() {
  const result: Record<string, unknown> = {
    collections: {},
    timestamp: new Date().toISOString(),
  }

  try {
    await connectDB()

    // ── Stock collection ────────────────────────────────────────────────
    const stockCollection = mongoose.connection.collection('stocks')
    const stockIndexesBefore = await stockCollection.indexes()

    // Drop every index that's not _id_ and not in the current schema.
    // Current StockSchema indexes: _id_, date_-1
    const stockValidIndexes = new Set(['_id_', 'date_-1'])
    const stockStaleIndexes = stockIndexesBefore.filter(
      (idx) => !stockValidIndexes.has(idx.name)
    )

    const stockDropped: string[] = []
    for (const idx of stockStaleIndexes) {
      try {
        await stockCollection.dropIndex(idx.name)
        stockDropped.push(idx.name)
      } catch (err) {
        // Index may already be gone — log and continue
        stockDropped.push(`${idx.name} (drop failed: ${(err as Error).message})`)
      }
    }

    // Recreate the date index (idempotent — Mongoose would do this on next
    // syncIndexes call anyway, but we do it explicitly here for safety).
    try {
      await stockCollection.createIndex({ date: -1 }, { name: 'date_-1' })
    } catch {
      // Already exists — fine
    }

    const stockIndexesAfter = await stockCollection.indexes()

    result.collections.stocks = {
      indexesBefore: stockIndexesBefore.map((i) => i.name),
      stale: stockStaleIndexes.map((i) => i.name),
      dropped: stockDropped,
      indexesAfter: stockIndexesAfter.map((i) => i.name),
    }

    // ── Production collection (defensive) ───────────────────────────────
    const prodCollection = mongoose.connection.collection('productions')
    const prodIndexesBefore = await prodCollection.indexes()

    // Drop any non-_id_ indexes that might be stale from old schemas
    // (e.g. customerName_1, address_1 if those were ever indexed)
    const prodValidIndexes = new Set(['_id_', 'date_-1', 'customerId_1'])
    const prodStaleIndexes = prodIndexesBefore.filter(
      (idx) => !prodValidIndexes.has(idx.name)
    )

    const prodDropped: string[] = []
    for (const idx of prodStaleIndexes) {
      try {
        await prodCollection.dropIndex(idx.name)
        prodDropped.push(idx.name)
      } catch (err) {
        prodDropped.push(`${idx.name} (drop failed: ${(err as Error).message})`)
      }
    }

    const prodIndexesAfter = await prodCollection.indexes()

    result.collections.productions = {
      indexesBefore: prodIndexesBefore.map((i) => i.name),
      stale: prodStaleIndexes.map((i) => i.name),
      dropped: prodDropped,
      indexesAfter: prodIndexesAfter.map((i) => i.name),
    }

    return NextResponse.json(result)
  } catch (err) {
    result.error = err instanceof Error ? {
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 10),
    } : String(err)
    return NextResponse.json(result, { status: 500 })
  }
}
