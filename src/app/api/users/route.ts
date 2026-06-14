import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { User } from '@/lib/models'

export async function GET() {
  try {
    await connectDB()
    const users = await User.find({}).sort({ createdAt: -1 })

    // Don't return passwords
    const result = users.map((u: any) => {
      const obj = toObject(u)
      delete obj.password
      return obj
    })

    return NextResponse.json({ users: result })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const bcrypt = await import('bcryptjs')
    const body = await request.json()

    if (!body.name || !body.email || !body.password || !body.role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if email already exists
    const existing = await User.findOne({ email: body.email })
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.default.hash(body.password, 10)
    const user = await User.create({
      name: body.name,
      email: body.email,
      password: hashedPassword,
      role: body.role,
      active: body.active !== undefined ? body.active : true,
    })

    const obj = toObject(user)
    delete obj.password
    return NextResponse.json({ user: obj }, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
