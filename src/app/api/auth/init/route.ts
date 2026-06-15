import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { User, Company } from '@/lib/models'
import bcrypt from 'bcryptjs'

export async function POST() {
  try {
    await connectDB()

    const existingCount = await User.countDocuments({})
    if (existingCount > 0) {
      return NextResponse.json(
        { message: 'Users already exist. Initialization skipped.' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash('admin123', 10)

    const admin = await User.create({
      name: 'Admin',
      email: 'admin@veda.com',
      password: hashedPassword,
      role: 'admin',
    })

    // Initialize company with Veda branding
    const existingCompany = await Company.findOne({})
    if (!existingCompany) {
      const vedaLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none"><rect width="200" height="200" rx="40" fill="#059669"/><path d="M100 30L40 75v15h20v55h30v-35h20v35h30V90h20V75L100 30z" fill="white" opacity="0.95"/><rect x="85" y="95" width="30" height="20" rx="2" fill="white" opacity="0.6"/><path d="M35 155h130v10a10 10 0 01-10 10H45a10 10 0 01-10-10v-10z" fill="white" opacity="0.8"/><text x="100" y="192" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="white" opacity="0.9">VEDA</text></svg>`
      const vedaLogoDataUrl = `data:image/svg+xml;base64,${Buffer.from(vedaLogoSvg).toString('base64')}`

      await Company.create({
        name: 'Veda Enterprises',
        tagline: 'Building the future, one brick at a time',
        logoUrl: vedaLogoDataUrl,
        setupComplete: true,
      })
    }

    return NextResponse.json(
      {
        message: 'Default admin user created successfully',
        user: {
          id: admin._id.toString(),
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error initializing admin user:', error)
    return NextResponse.json(
      { error: 'Failed to initialize admin user' },
      { status: 500 }
    )
  }
}
