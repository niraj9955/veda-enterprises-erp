import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import bcrypt from 'bcryptjs'
import { timingSafeEqualStr } from '@/lib/auth'

// ─────────────────────────────────────────────────────────────────────────────
// EMERGENCY ADMIN PASSWORD RESET
//
// WHY THIS EXISTS:
//   The backup-export route strips User.password for security. When a backup
//   is restored, the sanitizeRow() helper replaces missing passwords with a
//   random placeholder. The user cannot know this random password, so they
//   get locked out of their own ERP after a restore.
//
// WHAT THIS DOES:
//   - Resets the password of the admin@veda.com user (or the first admin
//     user if admin@veda.com doesn't exist) back to "admin123".
//   - Re-activates the account if it was disabled.
//   - Returns enough info for the user to log back in.
//
// SECURITY:
//   This endpoint REQUIRES the env var EMERGENCY_RESET_KEY to be set, and
//   the caller must supply it via the X-Emergency-Reset-Key header (or
//   ?key=... query param). Comparison is timing-safe.
//
//   If EMERGENCY_RESET_KEY is NOT set in the environment, the endpoint
//   refuses to run — returning 503. This is the inverse of the previous
//   behaviour (which was "open by default"), and prevents anonymous
//   attackers from resetting the admin password to a known value.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    await connectDB()

    // Require env-var gate — refuse to run if not set
    const expectedKey = process.env.EMERGENCY_RESET_KEY
    if (!expectedKey || expectedKey.length < 8) {
      return NextResponse.json(
        {
          error:
            'Emergency reset is disabled. Set the EMERGENCY_RESET_KEY environment variable (>=8 chars) to enable this endpoint.',
        },
        { status: 503 }
      )
    }

    const url = new URL(request.url)
    const headerKey = request.headers.get('x-emergency-reset-key') || ''
    const queryKey = url.searchParams.get('key') || ''

    // Timing-safe comparison — both header and query are checked, but a
    // passing match on EITHER is enough. Both must fail to reject.
    const headerOk = headerKey.length > 0 && timingSafeEqualStr(headerKey, expectedKey)
    const queryOk = queryKey.length > 0 && timingSafeEqualStr(queryKey, expectedKey)
    if (!headerOk && !queryOk) {
      return NextResponse.json(
        { error: 'Unauthorized — emergency reset key required' },
        { status: 403 }
      )
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
      const hashedPassword = await bcrypt.hash('admin123', 12)
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
    const hashedPassword = await bcrypt.hash('admin123', 12)
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
