import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import bcrypt from 'bcryptjs'

// ─────────────────────────────────────────────────────────────────────────────
// EMERGENCY ADMIN PASSWORD RESET
//
// WHY THIS EXISTS:
//   The backup-export route strips User.password for security. When a backup
//   is restored, the sanitizeRow() helper replaces missing passwords with a
//   random placeholder (`veda-reset-<random>`). The user cannot know this
//   random password, so they get locked out of their own ERP after a restore.
//
// WHAT THIS DOES:
//   - Resets the password of the admin@veda.com user (or the first admin
//     user if admin@veda.com doesn't exist) back to "admin123".
//   - Re-activates the account if it was disabled.
//   - Returns enough info for the user to log back in.
//
// SECURITY:
//   This endpoint is unauthenticated BY DESIGN — it is meant for the
//   "locked out of my own ERP" scenario. To prevent abuse, it ONLY resets
//   accounts whose role is 'admin'. Operator/Accountant accounts are never
//   touched. Once the user is back in, they should change the password via
//   User Management → Edit User.
//
//   For an extra layer of protection, if the env var EMERGENCY_RESET_KEY is
//   set, the caller must supply it via the X-Emergency-Reset-Key header
//   (or ?key=... query param). If the env var is not set, the endpoint is
//   open. This lets the user disable the endpoint by setting a random
//   EMERGENCY_RESET_KEY in Vercel env vars once they no longer need it.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    await connectDB()

    // Optional env-var gate
    const expectedKey = process.env.EMERGENCY_RESET_KEY
    if (expectedKey) {
      const url = new URL(request.url)
      const headerKey = request.headers.get('x-emergency-reset-key')
      const queryKey = url.searchParams.get('key')
      if (headerKey !== expectedKey && queryKey !== expectedKey) {
        return NextResponse.json(
          { error: 'Unauthorized — emergency reset key required' },
          { status: 403 }
        )
      }
    }

    // Find admin@veda.com first; fall back to any admin user
    let admin = await User.findOne({ email: 'admin@veda.com' })
    let usedFallback = false
    if (!admin) {
      admin = await User.findOne({ role: 'admin' })
      usedFallback = true
    }

    if (!admin) {
      // No admin user exists — create one with default credentials
      const hashedPassword = await bcrypt.hash('admin123', 10)
      const newAdmin = await User.create({
        name: 'Admin',
        email: 'admin@veda.com',
        password: hashedPassword,
        role: 'admin',
        active: true,
      })
      return NextResponse.json({
        message: 'No admin user found. Created a new admin with default credentials.',
        credentials: { email: 'admin@veda.com', password: 'admin123' },
        userId: newAdmin._id.toString(),
        action: 'created',
      })
    }

    // Reset password and re-activate
    const hashedPassword = await bcrypt.hash('admin123', 10)
    admin.password = hashedPassword
    admin.active = true
    await admin.save()

    return NextResponse.json({
      message: 'Admin password reset to default. Please login and change it immediately.',
      credentials: { email: admin.email, password: 'admin123' },
      userId: admin._id.toString(),
      action: 'reset',
      note: usedFallback
        ? `admin@veda.com not found — reset the first admin user (${admin.email}) instead.`
        : undefined,
    })
  } catch (error) {
    console.error('Error resetting admin password:', error)
    return NextResponse.json(
      { error: 'Failed to reset admin password: ' + (error instanceof Error ? error.message : 'unknown error') },
      { status: 500 }
    )
  }
}
