import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import {
  Customer, Production, Stock, Order, Dispatch, Payment, Expense,
  DailySell, CustomerPayment, LabourPayment, TractorPayment,
  DustPurchase, CementPurchase, Hardner, Electricity, FactoryStuff,
} from '@/lib/models'
import { syncStockForDates } from '@/lib/sync-stock'
import { requireRole } from '@/lib/auth'

// Force dynamic — this route must never be cached/previewed as a static asset.
export const dynamic = 'force-dynamic'

// Max rows per import call — prevents abuse / OOM on huge files
const MAX_IMPORT_ROWS = 5000

// ─── Server-side date normalization ─────────────────────────────────────────
//
// The client (excel-import.tsx) already normalizes dates to YYYY-MM-DD, but
// we re-normalize here as defense-in-depth so a direct API call (or a future
// caller that bypasses the Excel wizard) is still safe.
//
// IMPORTANT: This is an Indian ERP — DD-MM-YYYY (day-first) is the DEFAULT.
// We never use native new Date(string) as a fallback because JS interprets
// "05-06-2026" as MM-DD-YYYY (US format), which silently swaps day/month.
//
// Supported input formats (any separator among - / . or space):
//   • YYYY-MM-DD          (already canonical)
//   • YYYY/MM/DD  YYYY.MM.DD
//   • DD-MM-YYYY  DD/MM/YYYY  DD.MM.YYYY   (day-first, Indian format — DEFAULT)
//   • DD-MM-YY    DD/MM/YY    DD.MM.YY     (short year, prefixed with 20)
//   • MM/DD/YYYY  (only when first number > 12, e.g. 13/01/2024 -> Jan 13)
//   • Datetime strings like "2024-01-15 10:30:00" (time part stripped)
//   • Excel serial numbers (e.g. 46178)
//   • Fallback: today's date in YYYY-MM-DD (NOT new Date(string)).
function normalizeDate(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date && !isNaN(value.getTime())) {
    // Use LOCAL getters — Date objects represent local moments,
    // and toISOString() would shift the date back by one day in IST (UTC+5:30).
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 59 && value < 60000) {
    // Excel serial date: days since 1899-12-30.
    // Use UTC getters because the serial represents a UTC midnight,
    // and we want that exact date without timezone shifting.
    const ms = Math.round((value - 25569) * 86400 * 1000)
    const d = new Date(ms)
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear()
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
  }
  const raw = String(value ?? '').trim()
  if (raw === '') return ''

  // Strip time portion
  const trimmed = raw
    .replace(/[Tt]\s*\d{1,2}:\d{2}.*$/, '')
    .replace(/\s+\d{1,2}:\d{2}.*$/, '')
    .trim()
  if (trimmed === '') return raw

  // YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = trimmed.match(/^(\d{4})[/.\s](\d{1,2})[/.\s](\d{1,2})$/)
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY (Indian default — day first)
  // Heuristic: if FIRST number > 12, it MUST be a day → DD-MM (Indian) format.
  //            if SECOND number > 12, it MUST be a day → MM-DD (US) format.
  //            otherwise, default to DD-MM (Indian).
  const dmyMatch = trimmed.match(/^(\d{1,2})[/.\s-](\d{1,2})[/.\s-](\d{4})$/)
  if (dmyMatch) {
    const [, a, b, y] = dmyMatch
    let d: string, m: string
    if (Number(a) > 12 && Number(b) <= 12) {
      d = a; m = b   // DD-MM (Indian)
    } else if (Number(b) > 12 && Number(a) <= 12) {
      m = a; d = b   // MM-DD (US)
    } else {
      d = a; m = b   // Default DD-MM (Indian)
    }
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // DD-MM-YY / DD/MM/YY / DD.MM.YY
  const dmyShortMatch = trimmed.match(/^(\d{1,2})[/.\s-](\d{1,2})[/.\s-](\d{2})$/)
  if (dmyShortMatch) {
    const [, a, b, y] = dmyShortMatch
    let d: string, m: string
    if (Number(a) > 12 && Number(b) <= 12) {
      d = a; m = b
    } else if (Number(b) > 12 && Number(a) <= 12) {
      m = a; d = b
    } else {
      d = a; m = b
    }
    return `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // NO native Date(string) fallback — it silently interprets DD-MM as MM-DD.
  // Last resort — return today's date so a row can still be inserted
  // and the user can fix the date manually if needed.
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Normalize every date-like field on a row before validation/insert.
// This keeps the per-module switch statement below simple.
function normalizeRowDates(row: Record<string, unknown>): void {
  if ('date' in row) row.date = normalizeDate(row.date)
  if ('deliveryDate' in row) row.deliveryDate = normalizeDate(row.deliveryDate)
}

// ─── Duplicate detection ────────────────────────────────────────────────────
//
// Per user request: "jo duplicate ho use skip kre or uska mess de but jo
// duplicate nhi h usko import kre record me" — when an Excel row matches an
// existing record in the DB (by a natural key), SKIP it with a clear message
// but still IMPORT every non-duplicate row.
//
// To keep this fast, for each module we run ONE batched `find()` that
// returns every existing row whose date falls within the dates seen in
// the import payload, then build a Set of natural-key strings. Per-row
// lookup then becomes an O(1) Set.has() check instead of a findOne().
//
// APPEND-ONLY semantics are preserved — we never wipe existing rows.

// Build a stable natural-key string for a row, per module.
function rowKey(module: string, row: Record<string, unknown>): string {
  const s = (v: unknown) => String(v ?? '').trim().toLowerCase()
  switch (module) {
    case 'customers':
      return s(row.mobile)
    case 'production':
      // One production entry per date — same date = duplicate (matches stock semantics)
      return s(row.date)
    case 'stock':
      // One stock entry per date — same date = duplicate
      return s(row.date)
    case 'dailySell':
      return `${s(row.date)}|${s(row.customerName)}|${s(row.amount)}`
    case 'customerPayment':
      return `${s(row.date)}|${s(row.name)}|${s(row.amount)}`
    case 'labourPayment':
      return `${s(row.date)}|${s(row.name)}|${s(row.amount)}`
    case 'tractorPayment':
      return `${s(row.date)}|${s(row.vendorName)}|${s(row.quantityTon)}|${s(row.rate)}`
    case 'dustPurchase':
      return `${s(row.date)}|${s(row.vendorName)}|${s(row.quantity)}|${s(row.rate)}`
    case 'cementPurchase':
      return `${s(row.date)}|${s(row.vendorName)}|${s(row.itemName)}|${s(row.quantity)}|${s(row.rate)}`
    case 'hardner':
      // Only date+amount available — same date AND same amount = duplicate
      return `${s(row.date)}|${s(row.amount)}`
    case 'electricity':
      return `${s(row.date)}|${s(row.name)}|${s(row.work)}|${s(row.amount)}`
    case 'factoryStuff':
      return `${s(row.date)}|${s(row.itemName)}|${s(row.amount)}`
    case 'orders':
      return `${s(row.customerId)}|${s(row.brickType)}|${s(row.quantity)}|${s(row.rate)}|${s(row.deliveryDate || row.date)}`
    case 'dispatch':
      return `${s(row.customerId)}|${s(row.truckNumber)}|${s(row.brickType)}|${s(row.quantity)}|${s(row.date)}`
    case 'payments':
      return `${s(row.customerId)}|${s(row.paymentType)}|${s(row.amount)}|${s(row.date)}`
    case 'expenses':
      return `${s(row.category)}|${s(row.amount)}|${s(row.date)}|${s(row.description)}`
    default:
      return ''
  }
}

// Map a DB record back into the same natural-key shape as a row.
// IMPORTANT: this MUST mirror rowKey() exactly — if rowKey uses just `date`
// for production, dbKey must also use just `date` for production. A mismatch
// here means existingKeys will contain keys like "2026-06-21||" while the
// incoming row key is "2026-06-21", so the duplicate check NEVER matches and
// duplicates get imported. This was the root cause of duplicate production
// entries being imported.
function dbKey(module: string, doc: Record<string, unknown>): string {
  const s = (v: unknown) => String(v ?? '').trim().toLowerCase()
  switch (module) {
    case 'customers':
      return s(doc.mobile)
    case 'production':
      // One production entry per date — matches rowKey('production')
      return s(doc.date)
    case 'stock':
      return s(doc.date)
    case 'dailySell':
      return `${s(doc.date)}|${s(doc.customerName)}|${s(doc.amount)}`
    case 'customerPayment':
      return `${s(doc.date)}|${s(doc.name)}|${s(doc.amount)}`
    case 'labourPayment':
      return `${s(doc.date)}|${s(doc.name)}|${s(doc.amount)}`
    case 'tractorPayment':
      return `${s(doc.date)}|${s(doc.vendorName)}|${s(doc.quantityTon)}|${s(doc.rate)}`
    case 'dustPurchase':
      return `${s(doc.date)}|${s(doc.vendorName)}|${s(doc.quantity)}|${s(doc.rate)}`
    case 'cementPurchase':
      return `${s(doc.date)}|${s(doc.vendorName)}|${s(doc.itemName)}|${s(doc.quantity)}|${s(doc.rate)}`
    case 'hardner':
      return `${s(doc.date)}|${s(doc.amount)}`
    case 'electricity':
      return `${s(doc.date)}|${s(doc.name)}|${s(doc.work)}|${s(doc.amount)}`
    case 'factoryStuff':
      return `${s(doc.date)}|${s(doc.itemName)}|${s(doc.amount)}`
    case 'orders':
      return `${s(doc.customerId)}|${s(doc.brickType)}|${s(doc.quantity)}|${s(doc.rate)}|${s(doc.deliveryDate)}`
    case 'dispatch':
      return `${s(doc.customerId)}|${s(doc.truckNumber)}|${s(doc.brickType)}|${s(doc.quantity)}|${s(doc.date)}`
    case 'payments':
      return `${s(doc.customerId)}|${s(doc.paymentType)}|${s(doc.amount)}|${s(doc.date)}`
    case 'expenses':
      return `${s(doc.category)}|${s(doc.amount)}|${s(doc.date)}|${s(doc.description)}`
    default:
      return ''
  }
}

// Pre-fetch existing DB records that could collide with any row in `data`.
// Returns a Set of natural-key strings.
async function buildExistingKeys(module: string, data: Record<string, unknown>[]): Promise<Set<string>> {
  const keys = new Set<string>()
  if (data.length === 0) return keys

  // Collect unique dates and customerIds from the import payload so we can
  // narrow the DB query. This keeps the result set small.
  const dates = new Set<string>()
  const mobiles = new Set<string>()
  const customerIds = new Set<string>()
  for (const row of data) {
    const d = String(row.date ?? '').split('T')[0]
    if (d) dates.add(d)
    const dd = String(row.deliveryDate ?? '').split('T')[0]
    if (dd) dates.add(dd)
    const m = String(row.mobile ?? '').trim()
    if (m) mobiles.add(m)
    const cid = String(row.customerId ?? '').trim()
    if (cid) customerIds.add(cid)
  }

  let docs: Record<string, unknown>[] = []

  switch (module) {
    case 'customers':
      docs = mobiles.size > 0
        ? await Customer.find({ mobile: { $in: Array.from(mobiles) } }).lean() as any
        : []
      break
    case 'production':
      docs = dates.size > 0
        ? await Production.find({ date: { $in: Array.from(dates) } }).lean() as any
        : []
      break
    case 'stock':
      docs = dates.size > 0
        ? await Stock.find({ date: { $in: Array.from(dates) } }).lean() as any
        : []
      break
    case 'dailySell':
      docs = dates.size > 0
        ? await DailySell.find({ date: { $in: Array.from(dates) } }).lean() as any
        : []
      break
    case 'customerPayment':
      docs = dates.size > 0
        ? await CustomerPayment.find({ date: { $in: Array.from(dates) } }).lean() as any
        : []
      break
    case 'labourPayment':
      docs = dates.size > 0
        ? await LabourPayment.find({ date: { $in: Array.from(dates) } }).lean() as any
        : []
      break
    case 'tractorPayment':
      docs = dates.size > 0
        ? await TractorPayment.find({ date: { $in: Array.from(dates) } }).lean() as any
        : []
      break
    case 'dustPurchase':
      docs = dates.size > 0
        ? await DustPurchase.find({ date: { $in: Array.from(dates) } }).lean() as any
        : []
      break
    case 'cementPurchase':
      docs = dates.size > 0
        ? await CementPurchase.find({ date: { $in: Array.from(dates) } }).lean() as any
        : []
      break
    case 'hardner':
      docs = dates.size > 0
        ? await Hardner.find({ date: { $in: Array.from(dates) } }).lean() as any
        : []
      break
    case 'electricity':
      docs = dates.size > 0
        ? await Electricity.find({ date: { $in: Array.from(dates) } }).lean() as any
        : []
      break
    case 'factoryStuff':
      docs = dates.size > 0
        ? await FactoryStuff.find({ date: { $in: Array.from(dates) } }).lean() as any
        : []
      break
    case 'orders':
      docs = customerIds.size > 0
        ? await Order.find({ customerId: { $in: Array.from(customerIds) } }).lean() as any
        : []
      break
    case 'dispatch':
      docs = customerIds.size > 0
        ? await Dispatch.find({ customerId: { $in: Array.from(customerIds) } }).lean() as any
        : []
      break
    case 'payments':
      docs = customerIds.size > 0
        ? await Payment.find({ customerId: { $in: Array.from(customerIds) } }).lean() as any
        : []
      break
    case 'expenses':
      // Expenses dedupe by category+amount+date — narrow by date
      docs = dates.size > 0
        ? await Expense.find({ date: { $in: Array.from(dates) } }).lean() as any
        : []
      break
  }

  for (const d of docs) {
    const k = dbKey(module, d as Record<string, unknown>)
    if (k) keys.add(k)
  }
  return keys
}

export async function POST(request: Request) {
  try {
    // Admin/operator only — bulk import is a privileged write operation
    const session = await requireRole(['admin', 'operator'])
    if (session instanceof NextResponse) return session

    await connectDB()
    const body = await request.json()
    const { module, data } = body

    if (!module || !data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Module and data array are required' }, { status: 400 })
    }

    // Cap import size to prevent abuse / OOM
    if (data.length > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        { error: `Too many rows (${data.length}). Maximum ${MAX_IMPORT_ROWS} rows per import. Split your file and try again.` },
        { status: 413 }
      )
    }

    // ── Pre-fetch existing keys (1 DB query for the whole batch) ──────────
    const existingKeys = await buildExistingKeys(module, data as Record<string, unknown>[])
    // Track keys we've already seen WITHIN this batch so a duplicate Excel
    // row doesn't get inserted twice in the same import run.
    const seenInBatch = new Set<string>()

    let imported = 0
    let skipped = 0
    let duplicatesSkipped = 0
    const errors: string[] = []
    const skippedReasons: string[] = []

    // ── Bulk insert optimization ──────────────────────────────────────────
    // Instead of calling `await Model.create(doc)` for each row (N DB round
    // trips), we collect ALL valid documents into a `toInsert` array and do a
    // single `Model.insertMany(toInsert)` call after the loop. This makes the
    // import dramatically faster — 48 rows that previously took 8-10 seconds
    // (timing out on Vercel Hobby's 10s limit) now take under 1 second.
    //
    // `rowIndexByDoc` maps each document back to its original Excel row index
    // so we can report per-row errors if insertMany throws.
    const toInsert: any[] = []
    const rowIndexByDoc: number[] = []

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i]

        // Normalize date fields BEFORE duplicate check / validation / insert
        // so DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, datetime strings, and Excel
        // serial numbers are all converted to canonical YYYY-MM-DD.
        normalizeRowDates(row as Record<string, unknown>)

        // ── Duplicate check (against DB AND within this batch) ──────────
        // Duplicates are pushed to the `errors` array (not just skippedReasons)
        // so they appear in the RED error popup with a clear "Duplicate data
        // found" message, exactly as the user requested. The row is still
        // counted in duplicatesSkipped for the summary card.
        const key = rowKey(module, row as Record<string, unknown>)
        if (key) {
          if (existingKeys.has(key)) {
            skipped++
            duplicatesSkipped++
            const label = duplicateRowLabel(module, row as Record<string, unknown>)
            errors.push(`Row ${i + 1}: Duplicate data found — ${label} already exists in records`)
            continue
          }
          if (seenInBatch.has(key)) {
            skipped++
            duplicatesSkipped++
            const label = duplicateRowLabel(module, row as Record<string, unknown>)
            errors.push(`Row ${i + 1}: Duplicate data found — ${label} appears more than once in this Excel file`)
            continue
          }
          seenInBatch.add(key)
        }

        switch (module) {
          // ─── Customers ──────────────────────────────────────────────
          case 'customers': {
            if (!row.name || !row.mobile) {
              errors.push(`Row ${i + 1}: Name and mobile are required`)
              skipped++
              continue
            }
            toInsert.push({
              name: String(row.name).trim(),
              mobile: String(row.mobile).trim(),
              gstNumber: row.gstNumber || '',
              address: row.address || '',
              creditLimit: Number(row.creditLimit) || 0,
            })
            rowIndexByDoc.push(i)
            break
          }

          // ─── Production ─────────────────────────────────────────────
          case 'production': {
            if (!row.date) {
              errors.push(`Row ${i + 1}: Date is required`)
              skipped++
              continue
            }
            toInsert.push({
              date: String(row.date),
              customerId: row.customerId || null,
              cement: Number(row.cement) || 0,
              zigZagGrey80: Number(row.zigZagGrey80) || 0,
              zigZagRed80: Number(row.zigZagRed80) || 0,
              zigZagYellow80: Number(row.zigZagYellow80) || 0,
              zigZagGrey60: Number(row.zigZagGrey60) || 0,
              zigZagRed60: Number(row.zigZagRed60) || 0,
              zigZagYellow60: Number(row.zigZagYellow60) || 0,
              curveStone: Number(row.curveStone) || 0,
              chequreTile: Number(row.chequreTile) || 0,
              dumbleGrey80: Number(row.dumbleGrey80) || 0,
              dumbleRed80: Number(row.dumbleRed80) || 0,
              dumbleYellow80: Number(row.dumbleYellow80) || 0,
              transportationCharge: Number(row.transportationCharge) || 0,
              remarks: String(row.remarks || ''),
            })
            rowIndexByDoc.push(i)
            break
          }

          // ─── Stock ─────────────────────────────────────────────────
          case 'stock': {
            if (!row.date) {
              errors.push(`Row ${i + 1}: Date is required`)
              skipped++
              continue
            }
            toInsert.push({
              date: String(row.date),
              cement: Number(row.cement) || 0,
              zigZagGrey80: Number(row.zigZagGrey80) || 0,
              zigZagRed80: Number(row.zigZagRed80) || 0,
              zigZagYellow80: Number(row.zigZagYellow80) || 0,
              zigZagGrey60: Number(row.zigZagGrey60) || 0,
              zigZagRed60: Number(row.zigZagRed60) || 0,
              zigZagYellow60: Number(row.zigZagYellow60) || 0,
              chequreTile: Number(row.chequreTile) || 0,
              curveStone: Number(row.curveStone) || 0,
              dumbleGrey80: Number(row.dumbleGrey80) || 0,
              dumbleRed80: Number(row.dumbleRed80) || 0,
              dumbleYellow80: Number(row.dumbleYellow80) || 0,
            })
            rowIndexByDoc.push(i)
            break
          }

          // ─── Daily Sell ────────────────────────────────────────────
          case 'dailySell': {
            if (!row.date || !row.customerName || !row.amount) {
              errors.push(`Row ${i + 1}: Date, customer name, and amount are required`)
              skipped++
              continue
            }
            toInsert.push({
              date: String(row.date),
              customerName: String(row.customerName),
              address: String(row.address || ''),
              contactNumber: String(row.contactNumber || row.mobile || ''),
              product: String(row.product || ''),
              amount: Number(row.amount),
              remarks: String(row.remarks || ''),
            })
            rowIndexByDoc.push(i)
            break
          }

          // ─── Customer Payment ──────────────────────────────────────
          case 'customerPayment': {
            if (!row.date || !row.name || !row.amount) {
              errors.push(`Row ${i + 1}: Date, name, and amount are required`)
              skipped++
              continue
            }
            toInsert.push({
              date: String(row.date),
              name: String(row.name),
              address: String(row.address || ''),
              amount: Number(row.amount),
              remarks: String(row.remarks || ''),
            })
            rowIndexByDoc.push(i)
            break
          }

          // ─── Labour Payment ────────────────────────────────────────
          case 'labourPayment': {
            if (!row.date || !row.name || !row.amount) {
              errors.push(`Row ${i + 1}: Date, name, and amount are required`)
              skipped++
              continue
            }
            toInsert.push({
              date: String(row.date),
              name: String(row.name),
              address: String(row.address || ''),
              amount: Number(row.amount),
              remarks: String(row.remarks || ''),
            })
            rowIndexByDoc.push(i)
            break
          }

          // ─── Tractor Payment ───────────────────────────────────────
          case 'tractorPayment': {
            if (!row.date || !row.vendorName || !row.quantityTon || !row.rate) {
              errors.push(`Row ${i + 1}: Date, vendor, quantity, and rate are required`)
              skipped++
              continue
            }
            const qty = Number(row.quantityTon)
            const rate = Number(row.rate)
            const totalAmount = Number(row.totalAmount) || qty * rate
            const paidAmount = Number(row.paidAmount) || 0
            toInsert.push({
              date: String(row.date),
              vendorName: String(row.vendorName),
              quantityTon: qty,
              rate,
              totalAmount,
              paidAmount,
              remainingAmount: Number(row.remainingAmount) || (totalAmount - paidAmount),
              remarks: String(row.remarks || ''),
            })
            rowIndexByDoc.push(i)
            break
          }

          // ─── Dust Purchase ─────────────────────────────────────────
          case 'dustPurchase': {
            if (!row.date || !row.vendorName || !row.quantity || !row.rate) {
              errors.push(`Row ${i + 1}: Date, vendor, quantity, and rate are required`)
              skipped++
              continue
            }
            const qty = Number(row.quantity)
            const rate = Number(row.rate)
            const totalAmount = Number(row.totalAmount) || qty * rate
            const paidAmount = Number(row.paidAmount) || 0
            toInsert.push({
              date: String(row.date),
              vendorName: String(row.vendorName),
              cementName: String(row.cementName || ''),
              quantity: qty,
              rate,
              totalAmount,
              paidAmount,
              transportationCharge: Number(row.transportationCharge) || 0,
              gst: Number(row.gst) || 0,
              remarks: String(row.remarks || ''),
            })
            rowIndexByDoc.push(i)
            break
          }

          // ─── Cement Purchase ───────────────────────────────────────
          case 'cementPurchase': {
            if (!row.date || !row.vendorName || !row.quantity || !row.rate) {
              errors.push(`Row ${i + 1}: Date, vendor, quantity, and rate are required`)
              skipped++
              continue
            }
            const qty = Number(row.quantity)
            const rate = Number(row.rate)
            const totalAmount = Number(row.totalAmount) || qty * rate
            const paidAmount = Number(row.paidAmount) || 0
            toInsert.push({
              date: String(row.date),
              vendorName: String(row.vendorName),
              itemName: String(row.itemName || ''),
              quantity: qty,
              rate,
              totalAmount,
              paidAmount,
              transportationCharge: Number(row.transportationCharge) || 0,
              gst: Number(row.gst) || 0,
              remarks: String(row.remarks || ''),
            })
            rowIndexByDoc.push(i)
            break
          }

          // ─── Hardner ───────────────────────────────────────────────
          case 'hardner': {
            if (!row.date || !row.amount) {
              errors.push(`Row ${i + 1}: Date and amount are required`)
              skipped++
              continue
            }
            toInsert.push({
              date: String(row.date),
              amount: Number(row.amount),
            })
            rowIndexByDoc.push(i)
            break
          }

          // ─── Electricity ───────────────────────────────────────────
          case 'electricity': {
            if (!row.date || !row.amount) {
              errors.push(`Row ${i + 1}: Date and amount are required`)
              skipped++
              continue
            }
            toInsert.push({
              date: String(row.date),
              name: String(row.name || ''),
              work: String(row.work || ''),
              amount: Number(row.amount),
              remarks: String(row.remarks || ''),
            })
            rowIndexByDoc.push(i)
            break
          }

          // ─── Factory Stuff ─────────────────────────────────────────
          case 'factoryStuff': {
            if (!row.date || !row.itemName || !row.amount) {
              errors.push(`Row ${i + 1}: Date, item name, and amount are required`)
              skipped++
              continue
            }
            toInsert.push({
              date: String(row.date),
              itemName: String(row.itemName),
              quantity: Number(row.quantity) || 0,
              amount: Number(row.amount),
              remarks: String(row.remarks || ''),
            })
            rowIndexByDoc.push(i)
            break
          }

          // ─── Legacy modules (Orders/Dispatch/Payments/Expenses) ────
          case 'orders': {
            if (!row.customerId || !row.brickType || !row.quantity || !row.rate) {
              errors.push(`Row ${i + 1}: Customer, brick type, quantity, and rate are required`)
              skipped++
              continue
            }
            // Defer orderNumber generation to the bulk phase below — we just
            // collect the row here. The bulk phase runs ONE countDocuments
            // and ONE Company.findOne for the whole batch, then issues a
            // single insertMany with sequential orderNumbers computed in
            // memory. This eliminates the previous N × 3 query pattern.
            toInsert.push({
              customerId: row.customerId,
              brickType: row.brickType,
              quantity: Number(row.quantity),
              rate: Number(row.rate),
              amount: Number(row.amount) || Number(row.quantity) * Number(row.rate),
              deliveryDate: row.deliveryDate || row.date || new Date().toISOString().split('T')[0],
              status: row.status || 'Pending',
            })
            rowIndexByDoc.push(i)
            break
          }

          case 'dispatch': {
            if (!row.customerId || !row.truckNumber || !row.quantity || !row.brickType || !row.date) {
              errors.push(`Row ${i + 1}: Customer, truck, quantity, brick type, and date are required`)
              skipped++
              continue
            }
            // Same deferral as orders — orderNumber generation happens in
            // the bulk phase below.
            toInsert.push({
              customerId: row.customerId,
              orderId: row.orderId || null,
              truckNumber: row.truckNumber,
              driverName: row.driverName || '',
              quantity: Number(row.quantity),
              brickType: row.brickType,
              date: row.date,
            })
            rowIndexByDoc.push(i)
            break
          }

          case 'payments': {
            if (!row.customerId || !row.paymentType || !row.amount || !row.date) {
              errors.push(`Row ${i + 1}: Customer, payment type, amount, and date are required`)
              skipped++
              continue
            }
            toInsert.push({
              customerId: row.customerId,
              paymentType: row.paymentType,
              amount: Number(row.amount),
              date: row.date,
              remarks: row.remarks || '',
            })
            rowIndexByDoc.push(i)
            break
          }

          case 'expenses': {
            if (!row.category || !row.amount || !row.date) {
              errors.push(`Row ${i + 1}: Category, amount, and date are required`)
              skipped++
              continue
            }
            toInsert.push({
              category: row.category,
              amount: Number(row.amount),
              date: row.date,
              description: row.description || '',
            })
            rowIndexByDoc.push(i)
            break
          }

          default:
            errors.push(`Unknown module: ${module}`)
        }
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Import failed'}`)
        skipped++
      }
    }

    // ── Bulk insert all valid documents in ONE DB call ───────────────────
    // This is the key optimization: instead of N separate `Model.create()`
    // calls (each a DB round trip), we do a single `Model.insertMany()`.
    //
    // For `orders` and `dispatch`, we need sequential orderNumber/dispatchNumber
    // values. We do that efficiently here: ONE countDocuments + ONE
    // Company.findOne for the whole batch, then compute sequential numbers
    // in memory and insertMany in one call. Previously this was done
    // per-row inside the loop (N × 3 queries).
    if (toInsert.length > 0) {
      try {
        const Model = getModelForModule(module)

        // ── Sequential numbering for orders & dispatch ──────────────────
        // Pre-compute orderNumber/dispatchNumber for each doc in memory
        // using a single count + single Company lookup.
        if (module === 'orders' || module === 'dispatch') {
          const { Company } = await import('@/lib/models')
          const [existingCount, company] = await Promise.all([
            module === 'orders' ? Order.countDocuments({}) : Dispatch.countDocuments({}),
            Company.findOne({}),
          ])
          const prefix =
            module === 'orders'
              ? (company?.orderPrefix || 'ORD')
              : (company?.dispatchPrefix || 'DSP')
          const numField = module === 'orders' ? 'orderNumber' : 'dispatchNumber'
          toInsert.forEach((doc, idx) => {
            doc[numField] = `${prefix}-${String(existingCount + idx + 1).padStart(4, '0')}`
          })
        }

        if (Model) {
          // `ordered: false` lets MongoDB insert all valid docs even if some
          // fail validation — we collect per-doc errors from the result.
          const result = await Model.insertMany(toInsert, { ordered: false, rawResult: false })
          imported += Array.isArray(result) ? result.length : 0
        }
      } catch (err: any) {
        // insertMany with `ordered: false` throws a BulkWriteError containing
        // `insertErrors` and `result` with details about which docs failed.
        if (err?.name === 'BulkWriteError' || err?.code === 11000) {
          // Some docs may have been inserted before the error — count them.
          const insertedCount = err?.insertedDocs?.length ?? err?.result?.nInserted ?? 0
          imported += insertedCount
          // Walk the writeErrors to map each failure back to its row index.
          const writeErrors = err?.result?.writeErrors || err?.writeErrors || []
          for (const we of writeErrors) {
            const docIdx = we.index
            const rowIdx = rowIndexByDoc[docIdx]
            if (rowIdx !== undefined) {
              const isDup = we.code === 11000
              const label = duplicateRowLabel(module, data[rowIdx] as Record<string, unknown>)
              if (isDup) {
                errors.push(`Row ${rowIdx + 1}: Duplicate data found — ${label}`)
                duplicatesSkipped++
                skipped++
              } else {
                errors.push(`Row ${rowIdx + 1}: ${we.errmsg || we.message || 'Insert failed'}`)
                skipped++
              }
            }
          }
        } else {
          // Generic error — record it once with the count.
          errors.push(`Bulk insert failed: ${err instanceof Error ? err.message : 'Unknown error'}. ${toInsert.length} row(s) were not imported.`)
          skipped += toInsert.length
        }
      }
    }

    // Merge errors and skippedReasons so the UI can show every reason a row
    // was not imported (validation error OR duplicate OR anything else).
    const allReasons = [...errors, ...skippedReasons]

    // Auto-sync Stock Overview from Production — when production rows are
    // imported, the Stock module must reflect the latest daily totals
    // automatically. We collect every date touched by THIS import and
    // re-aggregate the matching Stock snapshot for each.
    if (module === 'production' && imported > 0) {
      const touchedDates = data
        .map((row) => String(row.date || '').split('T')[0])
        .filter(Boolean)
      if (touchedDates.length > 0) {
        try {
          await syncStockForDates(touchedDates)
        } catch (err) {
          console.error('[import] Stock sync failed:', err)
          // Don't fail the import — production rows were already saved.
          // Just append a soft warning to the error list.
          allReasons.push('Warning: production rows imported, but Stock Overview auto-sync failed. Check server logs.')
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      duplicatesSkipped,
      total: data.length,
      errors: allReasons.length > 0 ? allReasons.slice(0, 50) : undefined,
    })
  } catch (error) {
    console.error('Error importing data:', error)
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 })
  }
}

// Map module name to its Mongoose model. Used by the bulk-insert path so we
// can do a single `Model.insertMany(toInsert)` call instead of N creates.
function getModelForModule(module: string) {
  switch (module) {
    case 'customers': return Customer
    case 'production': return Production
    case 'stock': return Stock
    case 'dailySell': return DailySell
    case 'customerPayment': return CustomerPayment
    case 'labourPayment': return LabourPayment
    case 'tractorPayment': return TractorPayment
    case 'dustPurchase': return DustPurchase
    case 'cementPurchase': return CementPurchase
    case 'hardner': return Hardner
    case 'electricity': return Electricity
    case 'factoryStuff': return FactoryStuff
    case 'payments': return Payment
    case 'expenses': return Expense
    // Orders and dispatch now use the bulk-insert path too — their
    // sequential orderNumber/dispatchNumber is pre-computed in memory
    // before insertMany is called. See the bulk phase in POST handler.
    case 'orders': return Order
    case 'dispatch': return Dispatch
    default: return null
  }
}

// Human-readable label for a duplicate row, used in the skip reason.
function duplicateRowLabel(module: string, row: Record<string, unknown>): string {
  switch (module) {
    case 'customers':
      return `customer "${row.name}" (mobile ${row.mobile})`
    case 'production':
      return `production entry on ${row.date}`
    case 'stock':
      return `stock entry for ${row.date}`
    case 'dailySell':
      return `daily sell for "${row.customerName}" on ${row.date} (₹${row.amount})`
    case 'customerPayment':
      return `payment by "${row.name}" on ${row.date} (₹${row.amount})`
    case 'labourPayment':
      return `payment to "${row.name}" on ${row.date} (₹${row.amount})`
    case 'tractorPayment':
      return `tractor payment to "${row.vendorName}" on ${row.date}`
    case 'dustPurchase':
      return `dust purchase from "${row.vendorName}" on ${row.date}`
    case 'cementPurchase':
      return `cement purchase from "${row.vendorName}" on ${row.date}`
    case 'hardner':
      return `hardner entry on ${row.date} (₹${row.amount})`
    case 'electricity':
      return `electricity entry on ${row.date} (₹${row.amount})`
    case 'factoryStuff':
      return `factory stuff "${row.itemName}" on ${row.date} (₹${row.amount})`
    case 'orders':
      return `order for customer ${row.customerId} on ${row.deliveryDate || row.date}`
    case 'dispatch':
      return `dispatch to customer ${row.customerId} on ${row.date}`
    case 'payments':
      return `payment for customer ${row.customerId} on ${row.date}`
    case 'expenses':
      return `expense "${row.category}" on ${row.date} (₹${row.amount})`
    default:
      return 'record'
  }
}

// GET endpoint — return all available modules + their required fields for import template
export async function GET() {
  const modules = [
    { id: 'customers', label: 'Customers', fields: ['name', 'mobile', 'address', 'gstNumber', 'creditLimit'] },
    { id: 'production', label: 'Production', fields: ['date', 'cement', 'zigZagGrey80', 'zigZagRed80', 'zigZagYellow80', 'zigZagGrey60', 'zigZagRed60', 'zigZagYellow60', 'curveStone', 'chequreTile', 'dumbleGrey80', 'dumbleRed80', 'dumbleYellow80', 'transportationCharge', 'remarks'] },
    { id: 'stock', label: 'Stock', fields: ['date', 'cement', 'zigZagGrey80', 'zigZagRed80', 'zigZagYellow80', 'zigZagGrey60', 'zigZagRed60', 'zigZagYellow60', 'chequreTile', 'curveStone', 'dumbleGrey80', 'dumbleRed80', 'dumbleYellow80'] },
    { id: 'dailySell', label: 'Daily Sell', fields: ['date', 'customerName', 'address', 'contactNumber', 'product', 'amount', 'remarks'] },
    { id: 'customerPayment', label: 'Customer Payment', fields: ['date', 'name', 'address', 'amount', 'remarks'] },
    { id: 'labourPayment', label: 'Labour Payment', fields: ['date', 'name', 'address', 'amount', 'remarks'] },
    { id: 'tractorPayment', label: 'Tractor Payment', fields: ['date', 'vendorName', 'quantityTon', 'rate', 'totalAmount', 'paidAmount', 'remainingAmount', 'remarks'] },
    { id: 'dustPurchase', label: 'Dust Purchase', fields: ['date', 'vendorName', 'cementName', 'quantity', 'rate', 'totalAmount', 'paidAmount', 'transportationCharge', 'gst', 'remarks'] },
    { id: 'cementPurchase', label: 'Cement Purchase', fields: ['date', 'vendorName', 'itemName', 'quantity', 'rate', 'totalAmount', 'paidAmount', 'transportationCharge', 'gst', 'remarks'] },
    { id: 'hardner', label: 'Hardner', fields: ['date', 'amount'] },
    { id: 'electricity', label: 'Electricity', fields: ['date', 'name', 'work', 'amount', 'remarks'] },
    { id: 'factoryStuff', label: 'Factory Stuff', fields: ['date', 'itemName', 'quantity', 'amount', 'remarks'] },
  ]
  return NextResponse.json({ modules })
}
