import ZAI from 'z-ai-web-dev-sdk'
import OpenAI from 'openai'
import { AiConfig } from '@/lib/models'
import { connectDB } from '@/lib/db'

/**
 * Unified AI completion layer — the AI can NEVER hard-fail because of a
 * missing/invalid/expired API key again.
 *
 * ── How it works ──
 * 1. If the admin configured a provider (Groq/OpenAI) and it's healthy,
 *    requests go there.
 * 2. The FIRST time the provider fails with an auth/key error (401/403/404)
 *    or rate limit (429), it is marked "dead" for a cool-off window and we
 *    transparently switch to the built-in ZAI engine (no key needed).
 * 3. ZAI tool-calling: GLM accepts OpenAI-style tools; if it ever rejects
 *    them we retry text-only. `tool` role messages are flattened to
 *    user-role (ZAI only speaks system/user/assistant).
 *
 * Dead-provider memo is module-level so the failed-key roundtrip tax is
 * paid at most once per cool-off window per server process, not per call.
 */

/** provider key/rate failures → skip provider for this long (ms) */
const DEAD_AUTH_MS = 10 * 60_000 // 10 min after 401/403/404
const DEAD_RATE_MS = 60_000 // 1 min after 429

let deadAuthUntil = 0
let deadRateUntil = 0

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  tool_calls?: unknown[]
}

export interface AiChatBody {
  messages: AiChatMessage[]
  tools?: unknown[]
  tool_choice?: string
  temperature?: number
  max_tokens?: number
  response_format?: unknown
}

export interface AiChat {
  /** Configured model name (informational). */
  model: string
  /** true when requests are currently served by the stored provider. */
  usingProvider: () => boolean
  /** Send a chat completion — never throws for key/config problems alone. */
  create: (body: AiChatBody) => Promise<any>
}

/** ZAI-compatible message flattening. */
function toZaiMessages(messages: AiChatMessage[]) {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return { role: 'user' as const, content: `[Tool result] ${m.content}` }
    }
    return { role: m.role, content: m.content }
  })
}

async function zaiCompletion(zai: Awaited<ReturnType<typeof ZAI.create>>, body: AiChatBody) {
  const zaiBody: Record<string, unknown> = { messages: toZaiMessages(body.messages) }
  if (body.tools) {
    zaiBody.tools = body.tools
    zaiBody.tool_choice = body.tool_choice
  }
  // ZAI may not support OpenAI's response_format — replace with an instruction
  if (body.response_format) {
    const sys = zaiBody.messages as Array<{ role: string; content: string }>
    const idx = sys.findIndex((m) => m.role === 'system')
    const jsonNote =
      'IMPORTANT: Reply with ONLY a single valid JSON object. No explanations, no markdown fences.'
    if (idx >= 0) sys[idx].content = `${sys[idx].content}\n\n${jsonNote}`
    else sys.unshift({ role: 'system', content: jsonNote })
  }
  try {
    return await zai.chat.completions.create(zaiBody as never)
  } catch (err: any) {
    if (zaiBody.tools) {
      // Some engines reject tools — degrade to plain text chat
      console.warn(`[AI] ZAI tools rejected (${err?.message || err}), retrying text-only`)
      return zai.chat.completions.create({ messages: zaiBody.messages } as never)
    }
    throw err
  }
}

/** Build a per-request chat caller with automatic provider→ZAI failover. */
export async function makeAiChat(): Promise<AiChat> {
  await connectDB()
  const configDoc = (await AiConfig.findOne().lean()) as Record<string, unknown> | null
  const apiKey = String(configDoc?.openaiApiKey || '')
  const enabled = !!configDoc?.enabled
  const provider = String(configDoc?.provider || 'openai')
  const model = String(configDoc?.model || 'gpt-4o-mini')

  let client: OpenAI | null = null
  if (enabled && apiKey && Date.now() >= deadAuthUntil && Date.now() >= deadRateUntil) {
    const opts: ConstructorParameters<typeof OpenAI>[0] = {
      apiKey,
      timeout: 30_000,
      maxRetries: 1,
    }
    if (provider === 'groq') opts.baseURL = 'https://api.groq.com/openai/v1'
    client = new OpenAI(opts)
  }

  let providerDead = !client
  let zai: Awaited<ReturnType<typeof ZAI.create>> | null = null

  const markDead = (err: any) => {
    const status = Number(err?.status || err?.response?.status || 0)
    if (status === 401 || status === 403 || status === 404) {
      deadAuthUntil = Date.now() + DEAD_AUTH_MS
      providerDead = true
    } else if (status === 429) {
      deadRateUntil = Date.now() + DEAD_RATE_MS
      providerDead = true
    }
    return status
  }

  return {
    model,
    usingProvider: () => !providerDead,
    async create(body: AiChatBody) {
      if (client && !providerDead) {
        try {
          return await client.chat.completions.create(body as never)
        } catch (err: any) {
          const status = markDead(err)
          console.warn(
            `[AI] provider ${provider} failed (status ${status || '?'}): switching to built-in ZAI engine`
          )
        }
      }
      if (!zai) zai = await ZAI.create()
      return zaiCompletion(zai, body)
    },
  }
}

/**
 * Lenient JSON extraction from an LLM reply — handles markdown fences,
 * leading/trailing prose, and other engine quirks. Returns null if the
 * reply truly contains no JSON object.
 */
export function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null
  let t = text.trim()
  // strip ```json ... ``` fences
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  // fall back to first { … last }
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(t.slice(start, end + 1))
  } catch {
    return null
  }
}
