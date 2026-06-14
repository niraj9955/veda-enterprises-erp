import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()

    let company = await db.company.findFirst()

    if (!company) {
      company = await db.company.create({
        data: {
          name: 'My Company',
          setupComplete: false,
        },
      })
    }

    return NextResponse.json({ company, session })
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
    const session = await getSession()
    const body = await request.json()

    let company = await db.company.findFirst()

    if (!company) {
      company = await db.company.create({
        data: {
          name: 'My Company',
          setupComplete: false,
        },
      })
    }

    // Build update data from body
    const updateData: Record<string, unknown> = {}

    const fields = [
      'name', 'tagline', 'address', 'city', 'state', 'pincode',
      'phone', 'email', 'gstNumber', 'panNumber', 'logoUrl',
      'primaryColor', 'bankName', 'bankAccount', 'bankIfsc',
      'invoicePrefix', 'dispatchPrefix', 'orderPrefix', 'terms',
      'signatureName', 'setupComplete',
    ]

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

    const updated = await db.company.update({
      where: { id: company.id },
      data: updateData,
    })

    return NextResponse.json({ company: updated, session })
  } catch (error) {
    console.error('Error updating company:', error)
    return NextResponse.json(
      { error: 'Failed to update company settings' },
      { status: 500 }
    )
  }
}
