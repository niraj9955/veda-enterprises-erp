import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { User } from '@/lib/models'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/auth'

// Precomputed dummy hash — used when user not found so timing matches a real
// bcrypt.compare call. Prevents user enumeration via response timing.
// This is the bcrypt hash of the string "dummy" with 10 rounds.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8eVjP3wW3P3lF9lJl9eVjP3wW3P3lF'

export async function POST(request: Request) {
  try {
    await connectDB()

    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Invalid credentials format' },
        { status: 400 }
      )
    }
    // Cap input length to prevent abuse
    if (email.length > 256 || password.length > 256) {
      return NextResponse.json(
        { error: 'Input too long' },
        { status: 400 }
      )
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })

    if (!user) {
      // Run bcrypt against a dummy hash so timing matches the "user found,
      // wrong password" case. This prevents user enumeration.
      await bcrypt.compare(password, DUMMY_HASH).catch(() => {})
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    if (!user.active) {
      // Still run bcrypt to keep timing constant
      await bcrypt.compare(password, DUMMY_HASH).catch(() => {})
      return NextResponse.json(
        { error: 'Account is disabled' },
        { status: 401 }
      )
    }

    const isValid = await bcrypt.compare(password, user.password)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const token = await signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    })

    const response = NextResponse.json(
      {
        message: 'Login successful',
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 200 }
    )

    // Determine cookie security. In production we default to Secure:true
    // (the cookie only travels over HTTPS). Behind a proxy that terminates
    // TLS (Vercel, Caddy), we trust x-forwarded-proto.
    const xfp = request.headers.get('x-forwarded-proto')
    const isHttps =
      process.env.NODE_ENV === 'production' ||
      xfp === 'https' ||
      request.url.startsWith('https')

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 86400,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Error during login:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
