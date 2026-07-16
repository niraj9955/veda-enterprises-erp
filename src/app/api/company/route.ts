import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Company } from '@/lib/models'
import { getSession } from '@/lib/auth'

// ─── Default contact info for Veda Enterprises ───────────────────────────────
//
// These are sensible defaults used in two scenarios:
//   1. Brand-new install with no Company record yet — we seed these so the
//      footer / invoices show real contact info from day one.
//   2. Existing install where the Company record was created by an older
//      version of the seed (with empty phone/address). On every GET we
//      backfill any of these fields that are still empty, so existing
//      deployments get the new contact info without needing a manual
//      migration script.
//
// If an admin has already filled in their own phone/address/email through
// Settings, those user-supplied values take precedence and we never
// overwrite them.
const VEDA_DEFAULTS = {
  name: 'Veda Enterprises',
  tagline: 'Paver Block ERP',
  address: 'Purushottampur, Muzaffarpur',
  city: 'Muzaffarpur',
  state: 'Bihar',
  pincode: '842002',
  phone: '9572831213',
  email: 'vedaenterprises@gmail.com',
}

// ─── Legacy value migrations ─────────────────────────────────────────────────
//
// When we rename something globally (e.g. "Paper Block ERP" → "Paver Block
// ERP"), existing MongoDB records still hold the OLD value because the
// backfill logic above only touches EMPTY fields. This map silently
// upgrades known stale strings to their current value on every GET, so
// every existing deployment gets the rename without a manual migration
// script.
//
// To add a new migration: { field: 'tagName', from: 'old value', to: 'new value' }
// Keep the `from` comparison case-insensitive and trimmed so we catch
// "Paper Block ERP", "paper block erp", " Paper Block ERP " etc.
const LEGACY_MIGRATIONS: Array<{ field: keyof typeof VEDA_DEFAULTS; from: string; to: string }> = [
  { field: 'tagline', from: 'Paper Block ERP', to: 'Paver Block ERP' },
]

export async function GET() {
  try {
    await connectDB()
    const session = await getSession()

    let company = await Company.findOne({})
    if (!company) {
      // Brand-new install — create with full defaults.
      company = await Company.create({
        ...VEDA_DEFAULTS,
        setupComplete: false,
      })
    } else {
      // Existing install — backfill any empty contact fields with the
      // Veda defaults. This is what makes the footer / invoices show the
      // right phone + address for deployments that were created before
      // these defaults existed.
      let needsUpdate = false
      const patch: Record<string, string> = {}
      for (const key of Object.keys(VEDA_DEFAULTS) as (keyof typeof VEDA_DEFAULTS)[]) {
        const current = (company as any)[key]
        if (!current || String(current).trim() === '') {
          patch[key] = VEDA_DEFAULTS[key]
          needsUpdate = true
        }
      }

      // Legacy value migration — if a field holds a known stale value
      // (e.g. tagline was "Paper Block ERP" before the rename to "Paver
      // Block ERP"), silently upgrade it. This runs AFTER the empty-field
      // backfill above so we don't accidentally re-set a value the admin
      // had intentionally cleared.
      for (const migration of LEGACY_MIGRATIONS) {
        const current = (company as any)[migration.field]
        if (typeof current === 'string' && current.trim().toLowerCase() === migration.from.toLowerCase()) {
          patch[migration.field] = migration.to
          needsUpdate = true
        }
      }

      if (needsUpdate) {
        company = await Company.findByIdAndUpdate(
          company._id,
          { $set: patch },
          { new: true }
        )
      }
    }

    return NextResponse.json({ company: toObject(company), session })
  } catch (error) {
    console.error('Error fetching company:', error)
    return NextResponse.json(
      { error: 'Failed to fetch company settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    await connectDB()
    const session = await getSession()
    const body = await request.json()

    let company = await Company.findOne({})
    if (!company) {
      company = await Company.create({
        ...VEDA_DEFAULTS,
        setupComplete: false,
      })
    }

    const fields = [
      'name', 'tagline', 'address', 'city', 'state', 'pincode',
      'phone', 'email', 'gstNumber', 'panNumber', 'logoUrl',
      'primaryColor', 'bankName', 'bankAccount', 'bankIfsc',
      'invoicePrefix', 'dispatchPrefix', 'orderPrefix', 'terms',
      'signatureName', 'setupComplete',
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of fields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Auto-detect setup completion
    const name = (body.name !== undefined ? body.name : company.name) as string
    const address = (body.address !== undefined ? body.address : company.address) as string
    const phone = (body.phone !== undefined ? body.phone : company.phone) as string
    const gstNumber = (body.gstNumber !== undefined ? body.gstNumber : company.gstNumber) as string

    if (name && address && phone && gstNumber) {
      updateData.setupComplete = true
    }

    const updated = await Company.findByIdAndUpdate(company._id, updateData, { new: true })

    return NextResponse.json({ company: toObject(updated), session })
  } catch (error) {
    console.error('Error updating company:', error)
    return NextResponse.json(
      { error: 'Failed to update company settings' },
      { status: 500 }
    )
  }
}
