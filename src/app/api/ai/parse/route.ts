import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AiConfig } from '@/lib/models'
import { getSession } from '@/lib/auth'
import { AI_MODULE_MAP, buildSystemPrompt, coerceFieldValue } from '@/lib/ai-schemas'
import OpenAI from 'openai'

// Force dynamic
export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/ai/parse
// Body: { module: string, text: string }
// Returns: { fields: Record<string, unknown>, raw: Record<string, unknown> }
//
// Calls OpenAI with the module's system prompt + user input and returns the
// extracted field values, coerced to the correct types per the schema.
//
// Any logged-in user can call this — the AI button is shown to everyone,
// but disabled in the UI if no OpenAI key is configured.
export async function POST(request: Request) {
  try {
    await connectDB()

    // Auth gate — any logged-in user can use AI
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized — please log in' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { module: moduleKey, text } = body as { module?: string; text?: string }

    if (!moduleKey || typeof moduleKey !== 'string') {
      return NextResponse.json(
        { error: 'module is required' },
        { status: 400 }
      )
    }
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { error: 'text is required' },
        { status: 400 }
      )
    }

    const schema = AI_MODULE_MAP[moduleKey]
    if (!schema) {
      return NextResponse.json(
        { error: `Unknown module: ${moduleKey}` },
        { status: 400 }
      )
    }

    // ── Load AI config (API key + model) ───────────────────────────────
    const configDoc = await AiConfig.findOne().lean()
    const apiKey = String((configDoc as Record<string, unknown> | null)?.openaiApiKey || '')
    const enabled = !!(configDoc as Record<string, unknown> | null)?.enabled
    const model = String((configDoc as Record<string, unknown> | null)?.model || 'gpt-4o-mini')

    if (!enabled) {
      return NextResponse.json(
        { error: 'AI features are disabled. Ask an admin to enable them in Admin Panel.' },
        { status: 403 }
      )
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: 'No OpenAI API key configured. Ask an admin to add one in Admin Panel.' },
        { status: 403 }
      )
    }

    // ── Call OpenAI ────────────────────────────────────────────────────
    const client = new OpenAI({ apiKey })
    const systemPrompt = buildSystemPrompt(schema)

    // Build a JSON schema for structured output. Each field is optional
    // (the AI omits keys it couldn't extract), so we use additionalProperties
    // false + a permissive object with all keys as optional strings/numbers.
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text.trim() },
      ],
      temperature: 0.1, // low temperature for deterministic extraction
      max_tokens: 800,
      response_format: { type: 'json_object' },
    })

    const rawContent = response.choices[0]?.message?.content || '{}'
    let rawJson: Record<string, unknown>
    try {
      rawJson = JSON.parse(rawContent)
    } catch {
      console.error('[POST /api/ai/parse] Failed to parse AI response as JSON:', rawContent)
      return NextResponse.json(
        { error: 'AI returned invalid JSON. Please try rephrasing your input.' },
        { status: 502 }
      )
    }

    // ── Coerce values to correct types + filter unknown keys ───────────
    const coerced: Record<string, unknown> = {}
    for (const field of schema.fields) {
      if (field.key in rawJson) {
        const value = coerceFieldValue(field, rawJson[field.key])
        if (value !== undefined) {
          coerced[field.key] = value
        }
      }
    }

    return NextResponse.json({
      fields: coerced,
      raw: rawJson,
    })
  } catch (error) {
    console.error('Error in /api/ai/parse:', error)
    const message = error instanceof Error ? error.message : 'Failed to parse input'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
