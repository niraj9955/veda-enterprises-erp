import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AiConfig } from '@/lib/models'
import { getSession } from '@/lib/auth'
import OpenAI from 'openai'

// Force dynamic
export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/ai/test
// Admin-only. Sends a tiny "ping" request to the configured AI provider
// using the saved key+model. Returns 200 with latency if the call succeeds,
// or 4xx/5xx with a human-readable error if it fails.
//
// This is called by the "Test Connection" button in the Admin Panel so the
// admin can immediately see whether their key+model+endpoint combination
// actually works, instead of having to navigate to a form, open the AI
// widget, type something, and try to interpret the failure.
export async function POST() {
  try {
    await connectDB()

    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized — only admins can test AI configuration' },
        { status: 403 }
      )
    }

    const configDoc = await AiConfig.findOne().lean()
    const apiKey = String((configDoc as Record<string, unknown> | null)?.openaiApiKey || '')
    const enabled = !!(configDoc as Record<string, unknown> | null)?.enabled
    const provider = String((configDoc as Record<string, unknown> | null)?.provider || 'openai')
    const model = String((configDoc as Record<string, unknown> | null)?.model || 'gpt-4o-mini')

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'No API key configured. Please save an API key first.' },
        { status: 400 }
      )
    }
    if (!enabled) {
      return NextResponse.json(
        { ok: false, error: 'AI is disabled. Toggle it on and save first.' },
        { status: 400 }
      )
    }

    // Build the OpenAI-compatible client — Groq uses a different baseURL
    const clientOptions: ConstructorParameters<typeof OpenAI>[0] = {
      apiKey,
      timeout: 10_000,
      maxRetries: 0, // no retries on test — fail fast
    }
    if (provider === 'groq') {
      clientOptions.baseURL = 'https://api.groq.com/openai/v1'
    }
    const client = new OpenAI(clientOptions)

    const t0 = Date.now()
    // Minimal ping — "Reply with OK" with json_object response_format so we
    // exercise the same code path as the real parse endpoint.
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a connectivity-test bot. Reply with a JSON object: {"status":"ok"}. Do not say anything else.',
        },
        { role: 'user', content: 'ping' },
      ],
      temperature: 0,
      max_tokens: 50,
      response_format: { type: 'json_object' },
    })
    const latencyMs = Date.now() - t0

    const content = response.choices[0]?.message?.content || ''
    let parsedOk = false
    try {
      const j = JSON.parse(content)
      parsedOk = j?.status === 'ok' || typeof j === 'object'
    } catch {
      parsedOk = false
    }

    return NextResponse.json({
      ok: true,
      provider,
      model,
      latencyMs,
      responsePreview: content.slice(0, 120),
      parsedOk,
      message: `Success — ${provider === 'groq' ? 'Groq' : 'OpenAI'} responded in ${latencyMs}ms using model "${model}".`,
    })
  } catch (error) {
    console.error('Error in /api/ai/test:', error)

    // Try to extract a useful message from OpenAI SDK errors. The SDK throws
    // APIError subclasses that have .status, .message, and .error.code.
    let message = 'Unknown error'
    let status = 500
    if (error instanceof Error) {
      message = error.message
      // Common patterns:
      //  - "401 Incorrect API key provided"
      //  - "404 The model ... does not exist"
      //  - "429 Rate limit exceeded"
      const m = message.match(/^(\d{3})\s/)
      if (m) status = Number(m[1])
    }
    return NextResponse.json(
      { ok: false, error: message, status },
      { status }
    )
  }
}
