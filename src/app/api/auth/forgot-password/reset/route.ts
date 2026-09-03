import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User, PasswordReset } from '@/lib/models'
import bcrypt from 'bcryptjs'
import { jwtVerify } from 'jose'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password/reset
//
// Body: { email: string, resetToken: string, newPassword: string, confirmPassword: string }
//
// Validates the resetToken (issued by /verify-otp), checks that the
// corresponding PasswordReset doc is still in `verified && !used` state,
// then updates the user's password.
//
// SECURITY:
//   • resetToken is a signed JWT with `purpose: 'password-reset'` — cannot
//     be reused as a login token.
//   • The doc must be marked `verified: true` and `used: false`. After a
//     successful reset, the doc is marked `used: true` so the same token
//     cannot be replayed.
//   • newPassword must match confirmPassword (client enforces this too).
//   • Password min length 6 (matches the /api/users route policy).
//   • bcrypt rounds: 12 (matches the rest of the auth system).
// ─────────────────────────────────────────────────────────────────────────────

const PASSWORD_MIN_LENGTH = 6
const PASSWORD_MAX_LENGTH = 256

function getSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET
  if (!raw || raw.length < 16) {
    return new TextEncoder().encode('veda-dev-only-ephemeral-secret-do-not-use-in-prod')
  }
  return new TextEncoder().encode(raw)
}

export async function POST(request: Request) {
  try {
    // Validate input FIRST.
    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : ''
    const resetToken = typeof body?.resetToken === 'string' ? body.resetToken.trim() : ''
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
    const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword : ''

    if (!email || !resetToken) {
      return NextResponse.json(
        { error: 'Missing email or reset token.' },
        { status: 400 }
      )
    }

    if (!newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'Please enter and confirm your new password.' },
        { status: 400 }
      )
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match.' },
        { status: 400 }
      )
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.` },
        { status: 400 }
      )
    }
    if (newPassword.length > PASSWORD_MAX_LENGTH) {
      return NextResponse.json(
        { error: 'Password is too long.' },
        { status: 400 }
      )
    }

    await connectDB()

    // Verify the resetToken
    let payload: { email?: string; docId?: string; purpose?: string }
    try {
      const { payload: p } = await jwtVerify(resetToken, getSecret())
      payload = p as unknown as typeof payload
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired reset token. Please restart the forgot-password flow.' },
        { status: 401 }
      )
    }

    if (payload.purpose !== 'password-reset') {
      return NextResponse.json(
        { error: 'Invalid reset token.' },
        { status: 401 }
      )
    }
    if (!payload.email || payload.email !== email) {
      return NextResponse.json(
        { error: 'Email does not match the reset token.' },
        { status: 401 }
      )
    }
    if (!payload.docId) {
      return NextResponse.json(
        { error: 'Malformed reset token.' },
        { status: 401 }
      )
    }

    // Verify the PasswordReset doc is still in verified && !used state
    const doc = await PasswordReset.findById(payload.docId)
    if (!doc || !doc.verified || doc.used) {
      return NextResponse.json(
        { error: 'Reset session is no longer valid. Please restart the forgot-password flow.' },
        { status: 401 }
      )
    }
    if (doc.email !== email) {
      return NextResponse.json(
        { error: 'Email mismatch in reset record.' },
        { status: 401 }
      )
    }

    // Find the user
    const user = await User.findOne({ email })
    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please contact admin.' },
        { status: 404 }
      )
    }
    if (!user.active) {
      return NextResponse.json(
        { error: 'Account is disabled. Please contact admin.' },
        { status: 403 }
      )
    }

    // Update the password
    const newHash = await bcrypt.hash(newPassword, 12)
    await User.updateOne({ _id: user._id }, { $set: { password: newHash } })

    // Mark the PasswordReset doc as used so the token can't be replayed
    await PasswordReset.updateOne({ _id: doc._id }, { $set: { used: true } })

    return NextResponse.json({
      message: 'Password updated successfully. You can now log in with your new password.',
      email,
    })
  } catch (error) {
    console.error('Error in reset-password:', error)
    return NextResponse.json(
      { error: 'Failed to reset password. Please try again.' },
      { status: 500 }
    )
  }
}
