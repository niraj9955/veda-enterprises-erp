import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Company } from '@/lib/models'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    await connectDB()
    const session = await getSession()

    let company = await Company.findOne({})
    if (!company) {
      // Seed sensible defaults so the footer / invoices show real contact
      // info even before an admin opens Settings to customize them.
      company = await Company.create({
        name: 'Veda Enterprises',
        tagline: 'Paper Block ERP',
        address: 'Purushottampur, Muzaffarpur',
        city: 'Muzaffarpur',
        state: 'Bihar',
        pincode: '842002',
        phone: '9572831213',
        email: 'vedaenterprises@gmail.com',
        setupComplete: false,
      })
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
        name: 'My Company',
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
