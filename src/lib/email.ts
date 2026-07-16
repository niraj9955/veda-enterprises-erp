import nodemailer from 'nodemailer'

// ─────────────────────────────────────────────────────────────────────────────
// Email sending utility — used by the forgot-password flow to deliver OTPs.
//
// CONFIG (env vars):
//   • EMAIL_USER     — Gmail address (e.g. dataanalogydirector@gmail.com)
//   • EMAIL_PASS     — Gmail App Password (16 chars, no spaces). Regular Gmail
//                      password will NOT work — must be an App Password from
//                      https://myaccount.google.com/apppasswords
//   • EMAIL_FROM     — (optional) "From" header, defaults to EMAIL_USER
//   • EMAIL_TO_OVERRIDE — (optional) if set, ALL emails go to this address
//                      regardless of the `to` param. Useful for staging.
//
// DEV FALLBACK: if EMAIL_USER or EMAIL_PASS is not set, we skip actually sending
// the email and instead log it to the server console + return a `devPreview`
// field in the response. This lets the developer see the OTP locally without
// needing SMTP. In production, set the env vars — otherwise OTPs are NOT
// delivered to the user.
// ─────────────────────────────────────────────────────────────────────────────

interface SendMailArgs {
  to: string
  subject: string
  text: string
  html?: string
}

export interface SendMailResult {
  delivered: boolean
  devPreview?: { otp?: string; message: string }
  messageId?: string
  error?: string
}

let cachedTransporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter) return cachedTransporter

  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS

  if (!user || !pass) {
    return null // dev mode — no SMTP configured
  }

  cachedTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })
  return cachedTransporter
}

export function isEmailConfigured(): boolean {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
}

export async function sendMail(args: SendMailArgs): Promise<SendMailResult> {
  const { to, subject, text, html } = args

  // Honor EMAIL_TO_OVERRIDE if set (e.g. for staging environments)
  const actualTo = process.env.EMAIL_TO_OVERRIDE || to

  const transporter = getTransporter()

  // DEV FALLBACK — log + return preview
  if (!transporter) {
    // Try to extract OTP from text for the dev preview (best-effort)
    const otpMatch = text.match(/\b(\d{6})\b/)
    const otp = otpMatch?.[1]
    console.warn(
      '\n' +
      '┌──────────────────────────────────────────────────────────────┐\n' +
      '│  [DEV EMAIL]  SMTP not configured (EMAIL_USER/EMAIL_PASS).   │\n' +
      '│              Email was NOT actually sent.                    │\n' +
      '├──────────────────────────────────────────────────────────────┤'
    )
    console.warn(`│  To:      ${actualTo.padEnd(46)}│`)
    console.warn(`│  Subject: ${subject.slice(0, 46).padEnd(46)}│`)
    if (otp) console.warn(`│  OTP:     ${otp.padEnd(46)}│`)
    console.warn(
      '└──────────────────────────────────────────────────────────────┘\n' +
      (otp ? `>>> DEV OTP for ${actualTo}: ${otp} <<<\n` : '')
    )

    return {
      delivered: false,
      devPreview: {
        otp,
        message: 'SMTP not configured — OTP logged to server console only.',
      },
    }
  }

  // PRODUCTION PATH — actually send via Gmail SMTP
  try {
    const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'Veda ERP <no-reply@veda>'
    const info = await transporter.sendMail({
      from,
      to: actualTo,
      subject,
      text,
      html: html || text,
    })
    return { delivered: true, messageId: info.messageId }
  } catch (err) {
    console.error('Email send failed:', err)
    return {
      delivered: false,
      error: err instanceof Error ? err.message : 'Unknown email error',
    }
  }
}

// Helper: builds the OTP email body
export function buildOtpEmail(opts: { name?: string; otp: string; expiryMinutes: number }): { subject: string; text: string; html: string } {
  const { name, otp, expiryMinutes } = opts
  const greeting = name ? `Hello ${name},` : 'Hello,'
  const subject = `Veda ERP — Password Reset OTP (${otp})`
  const text = `${greeting}

You requested a password reset for your Veda ERP account.

Your One-Time Password (OTP) is: ${otp}

This OTP is valid for ${expiryMinutes} minutes. Do not share it with anyone.

If you did not request this reset, you can safely ignore this email — your password remains unchanged.

— Veda ERP Team`
  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
  <div style="text-align: center; margin-bottom: 24px;">
    <div style="display: inline-block; width: 48px; height: 48px; background: #059669; border-radius: 12px; line-height: 48px; color: white; font-weight: bold; font-size: 20px;">V</div>
    <h2 style="margin: 12px 0 4px; color: #059669;">Veda ERP</h2>
    <p style="margin: 0; color: #6b7280; font-size: 13px;">Password Reset Verification</p>
  </div>
  <p>${greeting}</p>
  <p>You requested a password reset for your Veda ERP account. Please use the OTP below to continue:</p>
  <div style="text-align: center; margin: 24px 0;">
    <div style="display: inline-block; padding: 16px 32px; background: #f0fdf4; border: 2px dashed #059669; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #059669; font-family: 'Courier New', monospace;">${otp}</div>
  </div>
  <p style="color: #6b7280; font-size: 13px;">⏱ This OTP is valid for <strong>${expiryMinutes} minutes</strong>. Do not share it with anyone.</p>
  <p style="color: #6b7280; font-size: 13px;">If you did not request this reset, you can safely ignore this email — your password remains unchanged.</p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">— Veda ERP Team</p>
</div>`
  return { subject, text, html }
}
