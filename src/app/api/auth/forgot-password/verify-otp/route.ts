import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { PasswordReset } from '@/lib/models'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password/verify-otp
//
// Body: { email: string, otp: string }
//
// Validates the OTP against the latest unused PasswordReset doc for that email.
// On success: marks the doc as `verified` and returns a short-lived JWT
// `resetToken` (10 min) that the client must include in the subsequent
// /reset call. The resetToken encodes the email + the docId so the reset
// endpoint can confirm the OTP was actually verified.
//
// SECURITY:
//   • bcrypt compare against the stored hash (no plaintext OTP in DB).
//   • Max 5 wrong attempts per OTP doc — after that the doc is invalidated
//     and the user must request a new OTP.
//   • OTP expiry (10 min) is enforced.
//   • resetToken is signed with the same JWT_SECRET as login tokens — it's
//     a different `purpose` claim so it cannot be reused as a login token.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5

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
    const otp = typeof body?.otp === 'string' ? body.otp.trim() : ''

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email.' }, { status: 400 })
    }
    if (!otp || !/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: 'OTP must be a 6-digit number.' },
        { status: 400 }
      )
    }

    await connectDB()

    // Find the latest unused, unverified PasswordReset doc for this email
    const doc = await PasswordReset.findOne({
      email,
      used: false,
      verified: false,
    }).sort({ createdAt: -1 })

    if (!doc) {
      return NextResponse.json(
        { error: 'No active OTP found. Please request a new OTP.' },
        { status: 404 }
      )
    }

    // Expiry check
    if (doc.expiresAt.getTime() < Date.now()) {
      await PasswordReset.updateOne({ _id: doc._id }, { $set: { used: true } })
      return NextResponse.json(
        { error: 'OTP has expired. Please request a new OTP.' },
        { status: 410 }
      )
    }

    // Attempt-limit check
    if (doc.attempts >= MAX_ATTEMPTS) {
      await PasswordReset.updateOne({ _id: doc._id }, { $set: { used: true } })
      return NextResponse.json(
        { error: 'Too many wrong attempts. Please request a new OTP.' },
        { status: 429 }
      )
    }

    // bcrypt verify
    const ok = await bcrypt.compare(otp, doc.otpHash).catch(() => false)
    if (!ok) {
      // Increment attempts
      await PasswordReset.updateOne(
        { _id: doc._id },
        { $inc: { attempts: 1 } }
      )
      const attemptsLeft = MAX_ATTEMPTS - (doc.attempts + 1)
      return NextResponse.json(
        {
          error: `Wrong OTP. ${attemptsLeft} attempt(s) remaining.`,
          attemptsLeft: Math.max(0, attemptsLeft),
        },
        { status: 401 }
      )
    }

    // Success — mark as verified
    await PasswordReset.updateOne(
      { _id: doc._id },
      { $set: { verified: true } }
    )

    // Issue a short-lived resetToken (10 min) tied to this doc
    const resetToken = await new SignJWT({
      email,
      docId: doc._id.toString(),
      purpose: 'password-reset',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('10m')
      .setIssuedAt()
      .sign(getSecret())

    return NextResponse.json({
      message: 'OTP verified. You can now set a new password.',
      resetToken,
      email,
    })
  } catch (error) {
    console.error('Error in verify-otp:', error)
    return NextResponse.json(
      { error: 'Failed to verify OTP. Please try again.' },
      { status: 500 }
    )
  }
}
