import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
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

// Force dynamic — never cache database backup/restore responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─────────────────────────────────────────────────────────────────────────────
// All 19 collections we back up / restore / clear.
// Listed in dependency order so that restore() can insert parents before
// children (Customers before Orders, Orders before Dispatches, etc.) — even
// though Mongoose doesn't enforce FK on insert, this keeps the data
// referentially consistent at the end of the restore.
// ─────────────────────────────────────────────────────────────────────────────
type ModelLike = {
  find: (...args: any[]) => any
  deleteMany: (...args: any[]) => any
  insertMany: (docs: any[], opts?: any) => Promise<any>
  countDocuments: (filter?: any) => Promise<number>
}

const COLLECTIONS: { key: string; model: ModelLike; preservedOnClear?: boolean }[] = [
  { key: 'companies',         model: Company as unknown as ModelLike, preservedOnClear: true },
  { key: 'users',             model: User as unknown as ModelLike,     preservedOnClear: true },
  { key: 'customers',         model: Customer as unknown as ModelLike },
  { key: 'productions',       model: Production as unknown as ModelLike },
  { key: 'stocks',            model: Stock as unknown as ModelLike },
  { key: 'dailySells',        model: DailySell as unknown as ModelLike },
  { key: 'customerPayments',  model: CustomerPayment as unknown as ModelLike },
  { key: 'labourPayments',    model: LabourPayment as unknown as ModelLike },
  { key: 'tractorPayments',   model: TractorPayment as unknown as ModelLike },
  { key: 'dustPurchases',     model: DustPurchase as unknown as ModelLike },
  { key: 'cementPurchases',   model: CementPurchase as unknown as ModelLike },
  { key: 'hardners',          model: Hardner as unknown as ModelLike },
  { key: 'electricities',     model: Electricity as unknown as ModelLike },
  { key: 'factoryStuffs',     model: FactoryStuff as unknown as ModelLike },
  { key: 'orders',            model: Order as unknown as ModelLike },
  { key: 'dispatches',        model: Dispatch as unknown as ModelLike },
  { key: 'payments',          model: Payment as unknown as ModelLike },
  { key: 'expenses',          model: Expense as unknown as ModelLike },
  { key: 'bills',             model: Bill as unknown as ModelLike },
]

// Convert a Mongoose doc to a backup-safe plain object.
// Differs from `toObject` in that we KEEP `_id` (as a string) so that
// references between collections (e.g., Order.customerId → Customer._id)
// survive a backup → clear → restore cycle. We also strip `__v`.
function toBackupObject(doc: any): any {
  if (!doc) return doc
  if (Array.isArray(doc)) return doc.map(toBackupObject)
  const obj = doc.toObject ? doc.toObject() : { ...doc }
  // Preserve _id as a string — when restoring, we set it back so Mongoose
  // uses our value instead of generating a new ObjectId.
  if (obj._id) {
    obj._id = obj._id.toString()
  }
  if (obj.__v !== undefined) delete obj.__v
  // Convert any nested ObjectId instances to strings (customerId, orderId, etc.)
  for (const key of Object.keys(obj)) {
    const v = obj[key]
    if (v && typeof v === 'object' && v._bsontype === 'ObjectID') {
      obj[key] = v.toString()
    } else if (Array.isArray(v)) {
      obj[key] = v.map((item: any) =>
        item && typeof item === 'object' && item._bsontype === 'ObjectID'
          ? item.toString()
          : item
      )
    }
  }
  return obj
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — Export a complete backup as JSON.
// Returns { version, exportedAt, data: { ...19 collections... }, counts: { ... } }
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    await connectDB()
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all collections in parallel
    const findResults = await Promise.all(
      COLLECTIONS.map(({ model }) => model.find({}).lean())
    )

    const data: Record<string, unknown[]> = {}
    const counts: Record<string, number> = {}
    COLLECTIONS.forEach(({ key }, i) => {
      const rows = findResults[i]
      data[key] = rows.map(toBackupObject)
      counts[key] = rows.length
    })

    // Strip passwords from users before exporting — they cannot be restored
    // anyway because they're hashed with a salt that lives server-side.
    if (Array.isArray(data.users)) {
      data.users = data.users.map((u: any) => {
        const { password, ...safe } = u
        return safe
      })
    }

    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      data,
      counts,
    }

    const res = NextResponse.json(payload)
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    res.headers.set('Pragma', 'no-cache')
    res.headers.set('Expires', '0')
    return res
  } catch (error) {
    console.error('Error exporting backup:', error)
    return NextResponse.json(
      { error: 'Failed to export backup: ' + (error instanceof Error ? error.message : 'unknown error') },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT — Restore a backup.
// Accepts two payload shapes for backwards compatibility:
//   Shape A (v2 backup file): { data: { customers: [...], ... }, counts, version }
//     → frontend calls api.restoreBackup(parsedFile) which wraps once more,
//       so the server actually sees { data: { data: {...}, counts, ... } }
//   Shape B (already-unwrapped): { data: { customers: [...], ... } }
//   Shape C (raw): { customers: [...], ... } — sent directly without wrapping
// We normalise all three to a single `data` object before processing.
// ─────────────────────────────────────────────────────────────────────────────
export async function PUT(request: Request) {
  try {
    await connectDB()
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Normalise: extract the actual collection map from any of the supported shapes
    let data: Record<string, unknown[]> = {}
    if (body?.data?.data && typeof body.data.data === 'object') {
      // Shape A — frontend wrapped a v2 backup file
      data = body.data.data
    } else if (body?.data && Array.isArray((body.data as any).customers) || (body.data as any)?.customers !== undefined) {
      // Shape B — frontend passed the inner data object directly
      data = body.data as Record<string, unknown[]>
    } else if (body?.customers !== undefined || body?.data) {
      // Shape C — raw collections, or body.data is the collections map
      data = (body.data || body) as Record<string, unknown[]>
    }

    // Safety: if we still don't have any recognizable collection, abort early
    // with a clear error so the user knows the file is corrupt.
    const recognizedKeys = COLLECTIONS.map((c) => c.key)
    const hasAnyCollection = recognizedKeys.some((k) => Array.isArray(data[k]))
    if (!hasAnyCollection) {
      return NextResponse.json(
        {
          error:
            'Backup file format not recognised. Expected a JSON export from the Admin → Database → Export Backup button.',
        },
        { status: 400 }
      )
    }

    // Clear all collections (including Company and User — a restore is a full
    // reset, NOT a clear). Use deleteMany in parallel for speed.
    await Promise.all(COLLECTIONS.map(({ model }) => model.deleteMany({})))

    // Restore: insert each collection's docs. Use insertMany with
    // `rawResult: false, ordered: false` so a single bad doc doesn't fail
    // the entire batch — we want as many rows as possible to make it back.
    const counts: Record<string, number> = {}
    const errors: Record<string, string> = {}

    for (const { key, model } of COLLECTIONS) {
      const rows = data[key]
      if (!Array.isArray(rows) || rows.length === 0) {
        counts[key] = 0
        continue
      }
      try {
        // Sanitize each row: ensure _id is a valid ObjectId string (or
        // strip it if invalid), convert date strings back to Date objects
        // for fields that look like timestamps.
        const sanitized = rows.map((row: any) => sanitizeRow(row, key))
        await model.insertMany(sanitized, { ordered: false, rawResult: false })
        counts[key] = sanitized.length
      } catch (err: any) {
        // insertMany with ordered:false can throw a partial-error
        // AggregateError on Mongoose ≥7. Treat as best-effort: count
        // whatever was inserted and surface the error message.
        const inserted = err?.insertedDocs?.length ?? 0
        counts[key] = inserted
        errors[key] = err?.message || String(err)
        console.error(`Restore: partial failure for ${key}:`, err?.message)
      }
    }

    const totalRestored = Object.values(counts).reduce((s, n) => s + n, 0)
    const res = NextResponse.json({
      message: `Backup restored successfully — ${totalRestored} documents across ${Object.keys(counts).length} collections.`,
      counts,
      errors: Object.keys(errors).length ? errors : undefined,
    })
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    return res
  } catch (error) {
    console.error('Error restoring backup:', error)
    return NextResponse.json(
      { error: 'Failed to restore backup: ' + (error instanceof Error ? error.message : 'unknown error') },
      { status: 500 }
    )
  }
}

// Sanitize a row about to be inserted via insertMany:
//   1. Keep _id (so cross-collection references survive)
//   2. Strip the `id` field — Mongoose treats it as a strict-schema field
//      only if defined; otherwise it gets stored as a useless extra key
//   3. Convert ISO date strings back to Date objects for createdAt/updatedAt
function sanitizeRow(row: any, _collectionKey: string): any {
  if (!row || typeof row !== 'object') return row
  const out: any = { ...row }

  // Keep _id as a string — Mongoose will cast it back to ObjectId on insert
  // (works for any field declared as ObjectId in the schema, including _id).
  if (out._id !== undefined && out._id !== null) {
    out._id = String(out._id)
  } else {
    delete out._id // let Mongoose generate a fresh one
  }

  // Drop the `id` alias — only `_id` is meaningful for restore.
  delete out.id
  // Drop __v if present (will be regenerated)
  delete out.__v

  // Convert date strings back to Date for the standard timestamp fields.
  // Mongoose's auto-cast usually handles this, but being explicit avoids
  // edge cases where a serialized Date came through as a string.
  for (const k of ['createdAt', 'updatedAt']) {
    if (out[k] && typeof out[k] === 'string') {
      const d = new Date(out[k])
      if (!isNaN(d.getTime())) out[k] = d
    }
  }

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE — Clear all transactional data.
// Preserves Company and User collections (so the user can log back in and
// the company profile / branding stays intact). All other 17 collections are
// wiped.
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    await connectDB()
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cleared: Record<string, number> = {}
    const toClear = COLLECTIONS.filter((c) => !c.preservedOnClear)
    const results = await Promise.all(
      toClear.map(({ model }) => model.deleteMany({}))
    )
    toClear.forEach(({ key }, i) => {
      cleared[key] = (results[i] as any)?.deletedCount ?? 0
    })

    const totalCleared = Object.values(cleared).reduce((s, n) => s + n, 0)
    const res = NextResponse.json({
      message: `Cleared ${totalCleared} documents across ${toClear.length} collections. Users and company preserved.`,
      cleared,
    })
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    return res
  } catch (error) {
    console.error('Error clearing data:', error)
    return NextResponse.json(
      { error: 'Failed to clear data: ' + (error instanceof Error ? error.message : 'unknown error') },
      { status: 500 }
    )
  }
}
