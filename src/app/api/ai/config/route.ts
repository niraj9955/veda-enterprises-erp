import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AiConfig } from '@/lib/models'
import { requireSession, requireAdmin } from '@/lib/auth'

// Force dynamic
export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/ai/config
// Returns the AI config. The API key is MASKED (only last 4 chars
// shown) so the client can display "sk-...abcd" without exposing the full
// secret. Any logged-in user can read this — they need to know if AI is
// enabled to show/hide the AI buttons in the UI.
export async function GET() {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    await connectDB()
    const config = await AiConfig.findOne().lean()

    if (!config) {
      // No config yet — return defaults (AI disabled, no key)
      return NextResponse.json({
        provider: 'openai',
        enabled: false,
        model: 'gpt-4o-mini',
        hasKey: false,
        keyMasked: '',
      })
    }

    const key = String((config as Record<string, unknown>).openaiApiKey || '')
    // Mask differently based on provider so user knows which kind of key is saved
    const provider = String((config as Record<string, unknown>).provider || 'openai')
    const masked = key.length > 8
      ? provider === 'groq'
        ? `gsk_...${key.slice(-4)}`
        : `sk-...${key.slice(-4)}`
      : ''

    return NextResponse.json({
      provider,
      enabled: !!(config as Record<string, unknown>).enabled,
      model: String((config as Record<string, unknown>).model || 'gpt-4o-mini'),
      hasKey: key.length > 0,
      keyMasked: masked,
    })
  } catch (error) {
    console.error('Error fetching AI config:', error)
    return NextResponse.json({ error: 'Failed to fetch AI config' }, { status: 500 })
  }
}

// PUT /api/ai/config
// Updates the AI config. Admin-only — operators/accountants cannot change
// the API key (would be a security hole).
// Body: { provider?: 'openai'|'groq', openaiApiKey?: string, enabled?: boolean, model?: string }
export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    await connectDB()

    const body = await request.json()
    const update: Record<string, unknown> = {}

    if (body.provider === 'openai' || body.provider === 'groq') {
      update.provider = body.provider
    }
    if (typeof body.openaiApiKey === 'string') {
      // Allow empty string to clear the key
      update.openaiApiKey = body.openaiApiKey.trim()
    }
    if (typeof body.enabled === 'boolean') {
      update.enabled = body.enabled
    }
    if (typeof body.model === 'string' && body.model.trim()) {
      update.model = body.model.trim()
    }

    // Upsert: if no config doc exists, create one; otherwise update in place
    const existing = await AiConfig.findOne()
    let saved
    if (existing) {
      Object.entries(update).forEach(([k, v]) => existing.set(k, v))
      saved = await existing.save()
    } else {
      saved = await AiConfig.create({
        provider: 'openai',
        openaiApiKey: '',
        enabled: false,
        model: 'gpt-4o-mini',
        ...update,
      })
    }

    // Return masked — never echo the full key back
    const key = String((saved as Record<string, unknown>).openaiApiKey || '')
    const provider = String((saved as Record<string, unknown>).provider || 'openai')
    const masked = key.length > 8
      ? provider === 'groq'
        ? `gsk_...${key.slice(-4)}`
        : `sk-...${key.slice(-4)}`
      : ''

    return NextResponse.json({
      provider,
      enabled: !!(saved as Record<string, unknown>).enabled,
      model: String((saved as Record<string, unknown>).model || 'gpt-4o-mini'),
      hasKey: key.length > 0,
      keyMasked: masked,
    })
  } catch (error) {
    console.error('Error updating AI config:', error)
    return NextResponse.json({ error: 'Failed to update AI config' }, { status: 500 })
  }
}
