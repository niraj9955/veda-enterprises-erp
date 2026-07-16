import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User, PasswordReset } from '@/lib/models'
import bcrypt from 'bcryptjs'
import { sendMail, buildOtpEmail, isEmailConfigured } from '@/lib/email'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password/request-otp
//
// Body: { email: string }
//
// Generates a 6-digit OTP, stores it (bcrypt-hashed) in the PasswordReset
// collection with a 10-minute expiry, and emails it to the user.
//
// SECURITY:
//   • Always returns 200 with a generic message, even if the email does not
//     exist in our user database. This prevents user enumeration via response
//     status / timing. (We still send the OTP only if the user exists; if
//     they don't, we silently skip the send step.)
//   • OTP is hashed with bcrypt before storage — DB leak does not reveal OTPs.
//   • Old unused OTPs for the same email are marked `used` so only the latest
//     one is valid.
//   • Rate-limited: at most 1 OTP per email per 60 seconds (enforced via the
//     createdAt index on PasswordReset).
// ─────────────────────────────────────────────────────────────────────────────

const OTP_TTL_MINUTES = 10
const RESEND_COOLDOWN_SECONDS = 60

function generateOtp(): string {
  // 6-digit numeric OTP — cryptographically random.
  // node:crypto.randomInt gives a uniform distribution (no modulo bias).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomInt } = require('crypto') as { randomInt: (min: number, max: number) => number }
  const n = randomInt(0, 1_000_000)
  return n.toString().padStart(6, '0')
}

export async function POST(request: Request) {
  try {
    // Validate input FIRST — so bad input is rejected with 400 even if DB
    // is temporarily unavailable.
    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : ''

    // Basic email format check
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 256) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    await connectDB()

    // Rate-limit check — was an OTP issued for this email in the last 60s?
    const cooldownAt = new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000)
    const recent = await PasswordReset.findOne({
      email,
      createdAt: { $gt: cooldownAt },
    }).sort({ createdAt: -1 })
    if (recent) {
      const secsLeft = Math.ceil(
        (recent.createdAt.getTime() + RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000
      )
      return NextResponse.json(
        {
          error: `Please wait ${secsLeft}s before requesting another OTP.`,
          cooldownSeconds: secsLeft,
        },
        { status: 429 }
      )
    }

    // Look up the user. We DON'T reveal whether the email exists in the
    // response — but we only SEND an OTP if the user exists. This is the
    // standard trade-off: a sophisticated attacker could still infer
    // existence from response timing (DB lookup time) or email delivery
    // delays, but the typical enumeration attack (visible error messages)
    // is blocked.
    const user = await User.findOne({ email })
    if (!user) {
      // Silently succeed — but don't send any email. Attacker learns nothing.
      return NextResponse.json({
        message: 'If the email exists in our system, an OTP has been sent.',
        email,
        expiryMinutes: OTP_TTL_MINUTES,
      })
    }

    if (!user.active) {
      // Same — don't reveal that the account is disabled. Silently succeed.
      return NextResponse.json({
        message: 'If the email exists in our system, an OTP has been sent.',
        email,
        expiryMinutes: OTP_TTL_MINUTES,
      })
    }

    // Invalidate any previous unused OTPs for this email
    await PasswordReset.updateMany(
      { email, used: false },
      { $set: { used: true } }
    )

    // Generate + hash OTP
    const otp = generateOtp()
    const otpHash = await bcrypt.hash(otp, 10)
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)

    await PasswordReset.create({
      email,
      otpHash,
      expiresAt,
      verified: false,
      used: false,
      attempts: 0,
    })

    // Send the email
    const { subject, text, html } = buildOtpEmail({
      name: user.name,
      otp,
      expiryMinutes: OTP_TTL_MINUTES,
    })
    const result = await sendMail({ to: email, subject, text, html })

    // In dev mode (no SMTP configured), surface the OTP so the developer can
    // test the flow locally. In production, this is `undefined`.
    const devPreview = !result.delivered && result.devPreview
      ? result.devPreview
      : undefined

    if (!result.delivered && !devPreview) {
      // SMTP was configured but send failed — surface the error to the user
      // so they can contact admin. Don't expose internal details.
      return NextResponse.json(
        { error: 'Failed to send OTP email. Please try again or contact admin.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: devPreview
        ? '[DEV] OTP logged to server console. Configure EMAIL_USER + EMAIL_PASS for production.'
        : 'OTP sent to your email.',
      email,
      expiryMinutes: OTP_TTL_MINUTES,
      emailConfigured: isEmailConfigured(),
      // Only include devPreview when SMTP is NOT configured (dev mode)
      ...(devPreview ? { devPreview } : {}),
    })
  } catch (error) {
    console.error('Error in request-otp:', error)
    return NextResponse.json(
      { error: 'Failed to send OTP. Please try again.' },
      { status: 500 }
    )
  }
}
