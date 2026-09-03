import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AiConfig } from '@/lib/models'
import { requireAdmin } from '@/lib/auth'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/ai/test
// Sends a tiny test prompt to the configured AI provider to verify
// that the saved API key + model actually work. Admin-only.
export async function POST() {
  try {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    await connectDB()

    const config = await AiConfig.findOne().lean()
    if (!config) {
      return NextResponse.json({
        ok: false,
        error: 'No AI configuration found. Please save your API key first.',
      })
    }

    const key = String((config as Record<string, unknown>).openaiApiKey || '')
    const provider = String((config as Record<string, unknown>).provider || 'openai')
    const model = String((config as Record<string, unknown>).model || 'gpt-4o-mini')

    if (!key) {
      return NextResponse.json({
        ok: false,
        error: 'No API key saved. Please enter and save an API key first.',
      })
    }

    // Build the OpenAI client — for Groq we override the baseURL
    const client = new OpenAI({
      apiKey: key,
      baseURL: provider === 'groq'
        ? 'https://api.groq.com/openai/v1'
        : undefined,
    })

    const start = Date.now()

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a test assistant. Reply with exactly: OK' },
        { role: 'user', content: 'Say OK' },
      ],
      max_tokens: 10,
    })

    const latencyMs = Date.now() - start
    const preview = response.choices?.[0]?.message?.content || ''

    return NextResponse.json({
      ok: true,
      provider,
      model,
      latencyMs,
      responsePreview: preview.slice(0, 100),
      message: `Connected to ${provider === 'groq' ? 'Groq' : 'OpenAI'} (${model}) in ${latencyMs}ms`,
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    const status = (error as { status?: number }).status

    // Map common errors to helpful messages
    let hint = ''
    if (errMsg.includes('401') || errMsg.includes('Incorrect API key') || errMsg.includes('invalid_api_key')) {
      hint = ' (incorrect API key — check for typos or extra spaces)'
    } else if (errMsg.includes('404') || errMsg.includes('model_not_found')) {
      hint = ' (model not found — try a different model)'
    } else if (errMsg.includes('429') || errMsg.includes('rate_limit')) {
      hint = ' (rate limit reached — wait a moment or check your plan)'
    }

    console.error('AI test connection error:', errMsg)

    return NextResponse.json({
      ok: false,
      error: `${errMsg}${hint}`,
    })
  }
}
