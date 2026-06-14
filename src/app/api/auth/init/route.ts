import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST() {
  try {
    const existingUsers = await db.user.count()

    if (existingUsers > 0) {
      return NextResponse.json(
        { message: 'Users already exist. Initialization skipped.' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash('admin123', 10)

    const admin = await db.user.create({
      data: {
        name: 'Admin',
        email: 'admin@veda.com',
        password: hashedPassword,
        role: 'admin',
      },
    })

    return NextResponse.json(
      {
        message: 'Default admin user created successfully',
        user: {
          id: admin.id,
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
