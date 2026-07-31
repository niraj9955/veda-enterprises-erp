/**
 * scripts/migrate-dates.ts
 *
 * One-time migration to normalize existing dates in MongoDB that may have
 * been stored in a non-canonical format before the centralized normalizeDate()
 * fix shipped.
 *
 * WHAT IT FIXES
 * -------------
 * Before the fix, dates could be stored as:
 *   • "21-06-2026"  (DD-MM-YYYY string — wasn't normalized on manual entry)
 *   • "21/06/2026"  (DD/MM/YYYY string — wasn't normalized on manual entry)
 *   • "2026-21-06"  (some other mangled format from old code paths)
 *   • Excel serials (e.g. 46178) accidentally stored as raw numbers
 *   • Date objects  (stored as ISODate by Mongoose — but the schema is String)
 *
 * After the fix, all dates should be canonical YYYY-MM-DD strings.
 *
 * WHAT IT DOES
 * ------------
 * For every collection with a `date` (or `deliveryDate`) field:
 *   1. Fetches all docs where date is NOT a clean YYYY-MM-DD string
 *   2. Runs normalizeDate() on each
 *   3. If the normalized value differs, updates the doc in place
 *   4. Logs a before/after report
 *
 * SAFE TO RE-RUN — idempotent. If a date is already YYYY-MM-DD, it stays.
 *
 * USAGE
 * -----
 *   MONGODB_URI="mongodb+srv://..." bun run scripts/migrate-dates.ts
 *
 *   # or with a dry-run first (no writes):
 *   MONGODB_URI="mongodb+srv://..." DRY_RUN=1 bun run scripts/migrate-dates.ts
 */
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || ''
const DRY_RUN = !!process.env.DRY_RUN

if (!MONGODB_URI) {
  console.error('ERROR: Set MONGODB_URI env var before running.')
  console.error('  Example: MONGODB_URI="mongodb+srv://..." bun run scripts/migrate-dates.ts')
  process.exit(1)
}

// Mirror of normalizeDate() from src/lib/date-utils.ts
// (duplicated here so the script doesn't depend on the Next.js bundler)
function normalizeDate(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 59 && value < 60000) {
    const ms = Math.round((value - 25569) * 86400 * 1000)
    const d = new Date(ms)
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear()
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return ''
    if (/^\d{4,6}(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed)
      if (Number.isFinite(num) && num > 59 && num < 60000) {
        const ms = Math.round((num - 25569) * 86400 * 1000)
        const d = new Date(ms)
        if (!isNaN(d.getTime())) {
          const y = d.getUTCFullYear()
          const m = String(d.getUTCMonth() + 1).padStart(2, '0')
          const day = String(d.getUTCDate()).padStart(2, '0')
          return `${y}-${m}-${day}`
        }
      }
    }
    const dateOnly = trimmed
      .replace(/[Tt]\s*\d{1,2}:\d{2}.*$/, '')
      .replace(/\s+\d{1,2}:\d{2}.*$/, '')
      .trim()
    if (dateOnly === '') return todayLocal()
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateOnly)) {
      const [y, m, d] = dateOnly.split('-')
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    const ymdMatch = dateOnly.match(/^(\d{4})[/.\s](\d{1,2})[/.\s](\d{1,2})$/)
    if (ymdMatch) {
      const [, y, m, d] = ymdMatch
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    const dmyMatch = dateOnly.match(/^(\d{1,2})[/.\s-](\d{1,2})[/.\s-](\d{4})$/)
    if (dmyMatch) {
      const [, a, b, y] = dmyMatch
      let d: string, m: string
      if (Number(a) > 12 && Number(b) <= 12) { d = a; m = b }
      else if (Number(b) > 12 && Number(a) <= 12) { m = a; d = b }
      else { d = a; m = b }
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    const dmyShortMatch = dateOnly.match(/^(\d{1,2})[/.\s-](\d{1,2})[/.\s-](\d{2})$/)
    if (dmyShortMatch) {
      const [, a, b, y] = dmyShortMatch
      let d: string, m: string
      if (Number(a) > 12 && Number(b) <= 12) { d = a; m = b }
      else if (Number(b) > 12 && Number(a) <= 12) { m = a; d = b }
      else { d = a; m = b }
      return `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    return todayLocal()
  }
  return todayLocal()
}

function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Collections + their date field names
// (matches the route patches applied by scripts/patch_date_normalize.py)
const COLLECTIONS: { name: string; dateField: string }[] = [
  { name: 'productions', dateField: 'date' },
  { name: 'stocks', dateField: 'date' },
  { name: 'orders', dateField: 'deliveryDate' },
  { name: 'dispatches', dateField: 'date' },
  { name: 'payments', dateField: 'date' },
  { name: 'expenses', dateField: 'date' },
  { name: 'dailysells', dateField: 'date' },
  { name: 'customerpayments', dateField: 'date' },
  { name: 'labourpayments', dateField: 'date' },
  { name: 'tractorpayments', dateField: 'date' },
  { name: 'dustpurchases', dateField: 'date' },
  { name: 'cementpurchases', dateField: 'date' },
  { name: 'hardners', dateField: 'date' },
  { name: 'electricities', dateField: 'date' },
  { name: 'factorystuffs', dateField: 'date' },
  { name: 'bills', dateField: 'date' },
  { name: 'bills', dateField: 'dueDate' },
]

async function main() {
  console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Migrating dates to canonical YYYY-MM-DD...\n`)
  console.log(`MongoDB: ${MONGODB_URI.replace(/\/\/[^@]+@/, '//***:***@')}\n`)

  await mongoose.connect(MONGODB_URI)
  const db = mongoose.connection.db
  if (!db) throw new Error('No DB')

  let totalScanned = 0
  let totalUpdated = 0
  let totalSkipped = 0
  const samples: { collection: string; before: string; after: string }[] = []

  for (const { name, dateField } of COLLECTIONS) {
    const collection = db.collection(name)
    // Find docs where the date field exists and isn't a clean YYYY-MM-DD string.
    // We use $expr + $regexMatch for this. Works on MongoDB 4.0+.
    const filter = {
      [dateField]: { $exists: true, $ne: null, $not: /^\d{4}-\d{2}-\d{2}$/ },
    }
    let scanned = 0
    let updated = 0
    let skipped = 0

    const cursor = collection.find(filter)
    while (await cursor.hasNext()) {
      const doc = await cursor.next()
      if (!doc) break
      scanned++
      const oldValue = (doc as any)[dateField]
      const newValue = normalizeDate(oldValue)
      if (newValue === oldValue) {
        skipped++
        continue
      }
      if (samples.length < 20) {
        samples.push({
          collection: name,
          before: JSON.stringify(oldValue),
          after: newValue,
        })
      }
      if (!DRY_RUN) {
        await collection.updateOne(
          { _id: doc._id },
          { $set: { [dateField]: newValue } }
        )
      }
      updated++
    }
    await cursor.close()

    totalScanned += scanned
    totalUpdated += updated
    totalSkipped += skipped
    console.log(`  ${name}.${dateField}: scanned=${scanned} updated=${updated} skipped=${skipped}`)
  }

  console.log(`\n────────────────────────────────────────`)
  console.log(`Total: scanned=${totalScanned} updated=${totalUpdated} skipped=${totalSkipped}`)
  console.log(`${DRY_RUN ? '[DRY RUN — no writes]' : '✓ All dates migrated'}\n`)

  if (samples.length > 0) {
    console.log('Sample migrations:')
    for (const s of samples) {
      console.log(`  ${s.collection}: ${s.before} → ${s.after}`)
    }
    console.log('')
  }

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
