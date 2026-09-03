import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { AI_MODULE_MAP, buildSystemPrompt, coerceFieldValue } from '@/lib/ai-schemas'
import { makeAiChat, extractJson } from '@/lib/ai-completions'

// Force dynamic
export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/ai/parse
// Body: { module: string, text: string }
// Returns: { fields: Record<string, unknown>, raw: Record<string, unknown> }
//
// Calls the AI (stored provider, or the built-in ZAI engine — never fails
// for missing keys) with the module's system prompt + user input and returns
// the extracted field values, coerced to the correct types per the schema.
//
// Any logged-in user can call this — the AI button is shown to everyone.
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

    // ── AI completion — stored provider first, built-in ZAI fallback.
    // NOTE: no API-key 403 gates here anymore. A missing/invalid/expired
    // provider key no longer breaks this feature — the unified AI layer
    // (see src/lib/ai-completions.ts) transparently uses the platform ZAI
    // engine whenever the provider is absent or failing.
    const ai = await makeAiChat()
    const systemPrompt = buildSystemPrompt(schema)

    // temperature=0 for deterministic, fast extraction. Response is a tiny
    // JSON object, so max_tokens=500 is plenty.
    const response = await ai.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text.trim() },
      ],
      temperature: 0, // deterministic — fastest + most consistent extraction
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })

    const rawContent = response.choices[0]?.message?.content || '{}'
    const rawJson = extractJson(rawContent)
    if (!rawJson) {
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
