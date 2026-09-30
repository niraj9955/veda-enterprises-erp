import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { requireSession } from '@/lib/auth'
import { AiConfig } from '@/lib/models'
import { connectDB } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

/**
 * POST /api/tts  —  Text → Speech (the AI's VOICE — talking system out-path)
 * Body: { text: string, speed?: number }
 * Returns: audio/wav binary (RIFF) on success, JSON { error, kind } on failure.
 *
 * Engine chain (mirrors /api/asr — Vercel-optimized):
 *   1. Groq PlayAI TTS (model=playai-tts) — primary on Vercel where the user's
 *      GROQ_API_KEY works. Key resolution: env GROQ_API_KEY → DB AiConfig
 *      (provider='groq' && enabled), same as ASR.
 *   2. Built-in ZAI TTS (voice 'tongtong') — sandbox / Groq outage fallback.
 *
 * CRITICAL FORMAT GOTCHA (learned the hard way in v3.15 test suites):
 * the ZAI SDK TTS returns HEADERLESS raw PCM — no RIFF/WAVE header. Playing
 * that raw = garbage noise. The server detects the missing RIFF magic and
 * wraps the PCM in a proper 16kHz mono 16-bit WAV header (16kHz verified
 * good; 24kHz plays garbage). If a future SDK returns a real WAV we pass
 * it through untouched.
 *
 * Text hygiene: agent replies arrive as chat markdown (bold, bullets, ₹,
 * emojis, tables). Everything that reads badly aloud is stripped BEFORE
 * synthesis: markdown markers, emojis/symbols, URLs; ₹ → "rupaye";
 * whitespace collapsed; hard cap 950 chars (SDK limit is 1024) cut at the
 * last sentence boundary so spoken replies stay short and natural.
 *
 * Failure contract (kind hints, like ASR):
 *   'no-provider'  — neither engine available (Vercel without Groq key etc.)
 *   'groq-auth'    — Groq key present but rejected (401/403)
 *   'tts-fail'     — engine attempted but synthesis failed
 * The chat widget degrades gracefully: reply still shows as text.
 */

const MAX_SPEECH_CHARS = 950

/** Make chat markdown safe+natural for speaking. */
function cleanTextForSpeech(raw: string): string {
  let t = String(raw || '')
  // fenced code blocks → drop entirely
  t = t.replace(/```[\s\S]*?```/g, ' ')
  // inline code ticks → keep content
  t = t.replace(/`([^`]*)`/g, '$1')
  // markdown bold/italic/header/strike markers
  t = t.replace(/[*_#~]+/g, ' ')
  // table pipes → commas
  t = t.replace(/\|/g, ', ')
  // bullet markers at line starts → drop (numbered lists keep their numbers)
  t = t.replace(/^\s*[-•·]\s+/gm, '')
  // URLs → drop
  t = t.replace(/https?:\/\/\S+/g, ' ')
  // emojis, pictographs, arrows & misc symbols that TTS reads weirdly
  t = t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2190}-\u{21FF}]/gu, ' ')
  // rupee → spoken word
  t = t.replace(/₹\s*/g, ' rupaye ')
  t = t.replace(/\bRs\.?\s*/gi, ' rupaye ')
  // collapse all whitespace
  t = t.replace(/\s+/g, ' ').trim()
  // cap at the last sentence boundary within the limit
  if (t.length > MAX_SPEECH_CHARS) {
    const slice = t.slice(0, MAX_SPEECH_CHARS)
    const cut = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'), slice.lastIndexOf(','))
    t = (cut > 200 ? slice.slice(0, cut + 1) : slice).trim()
  }
  return t
}

/** Wrap headerless raw PCM into a valid 16kHz mono 16-bit WAV container. */
function wrapPcmAsWav(pcm: Buffer, sampleRate = 16000, channels = 1): Buffer {
  const bitsPerSample = 16
  const byteRate = (sampleRate * channels * bitsPerSample) / 8
  const blockAlign = (channels * bitsPerSample) / 8
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM format
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

function hasRiffHeader(b: Buffer): boolean {
  return b.length > 44 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 // 'RIFF'
}

/** Same Groq key resolution as /api/asr: env first, then DB AiConfig. */
async function resolveGroqKey(): Promise<string> {
  const envKey = process.env.GROQ_API_KEY || ''
  if (envKey) return envKey
  try {
    await connectDB()
    const cfg = (await AiConfig.findOne().lean()) as Record<string, unknown> | null
    if (cfg && cfg.provider === 'groq' && cfg.enabled && cfg.openaiApiKey) {
      return String(cfg.openaiApiKey)
    }
  } catch (e: any) {
    console.warn('[TTS] AiConfig lookup failed:', e?.message || e)
  }
  return ''
}

/** Groq PlayAI TTS attempt. Returns a real WAV (RIFF) buffer on success. */
async function tryGroqTts(text: string, speed: number, key: string): Promise<Buffer> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'playai-tts',
        voice: 'Celeste-PlayAI',
        input: text,
        response_format: 'wav',
        speed,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      if (res.status === 401 || res.status === 403) {
        const e: any = new Error(`groq ${res.status}: ${errText.slice(0, 200)}`)
        e.isAuth = true
        throw e
      }
      throw new Error(`groq ${res.status}: ${errText.slice(0, 200)}`)
    }
    const buf = Buffer.from(new Uint8Array(await res.arrayBuffer()))
    if (!hasRiffHeader(buf)) throw new Error('groq returned non-WAV payload')
    return buf
  } finally {
    clearTimeout(timeout)
  }
}

/** ZAI TTS attempt — may return headerless PCM, we wrap it. */
async function tryZaiTts(text: string, speed: number): Promise<Buffer> {
  const zai = await ZAI.create()
  const response = await zai.audio.tts.create({
    input: text,
    voice: 'tongtong',
    speed,
    response_format: 'wav',
    stream: false,
  })
  const buf = Buffer.from(new Uint8Array(await response.arrayBuffer()))
  if (buf.length < 100) throw new Error('zai tts returned empty audio')
  // Known SDK behavior: headerless raw PCM @16kHz mono. If RIFF present, pass through.
  if (hasRiffHeader(buf)) return buf
  return wrapPcmAsWav(buf, 16000, 1)
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    const body = await request.json().catch(() => null)
    const rawText = typeof body?.text === 'string' ? body.text : ''
    if (!rawText.trim()) {
      return NextResponse.json({ error: 'Text khali hai — bolne ke liye kuch do.', kind: 'bad-request' }, { status: 400 })
    }

    let speed = Number(body?.speed)
    if (!Number.isFinite(speed)) speed = 1.0
    speed = Math.min(2.0, Math.max(0.5, speed))

    const text = cleanTextForSpeech(rawText)
    if (!text) {
      return NextResponse.json({ error: 'Text me sirf symbols/emojis the — bolne layak kuch nahi.', kind: 'bad-request' }, { status: 400 })
    }

    console.log(`[TTS] request: ${rawText.length} chars raw → ${text.length} chars clean, speed=${speed}`)

    // Engine 1: Groq PlayAI (primary on Vercel — clean IPs + user's key live there)
    let groqAuthFailed = false
    const groqKey = await resolveGroqKey()
    if (groqKey) {
      try {
        const wav = await tryGroqTts(text, speed, groqKey)
        console.log(`[TTS] engine=groq-playai, ${wav.length} bytes`)
        return new NextResponse(new Uint8Array(wav), {
          status: 200,
          headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store', 'X-TTS-Engine': 'groq-playai' },
        })
      } catch (err: any) {
        const auth = err?.isAuth || /401|403/.test(String(err?.message))
        if (auth) groqAuthFailed = true
        console.warn(`[TTS] groq attempt failed${auth ? ' (auth)' : ''}: ${err?.message || err}`)
        if (err?.name === 'AbortError') console.warn('[TTS] groq timeout after 30s')
        // fall through to ZAI
      }
    }

    // Engine 2: built-in ZAI (sandbox / Groq outage)
    try {
      const wav = await tryZaiTts(text, speed)
      console.log(`[TTS] engine=zai-tongtong, ${wav.length} bytes`)
      return new NextResponse(new Uint8Array(wav), {
        status: 200,
        headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store', 'X-TTS-Engine': 'zai-tongtong' },
      })
    } catch (err: any) {
      console.warn(`[TTS] zai attempt failed: ${err?.message || err}`)
      const noProvider = !groqKey
      return NextResponse.json(
        {
          error: noProvider
            ? 'Awaaz engine server par available nahi hai (na Groq key, na built-in engine).'
            : groqAuthFailed
              ? 'Groq voice engine ne request reject ki (PlayAI terms accept nahi hain — console.groq.com/playai par accept karo).'
              : 'Awaaz banane me problem aayi (dono engines fail).',
          kind: noProvider ? 'no-provider' : groqAuthFailed ? 'groq-auth' : 'tts-fail',
        },
        { status: 503 }
      )
    }
  } catch (err: any) {
    console.error('[TTS] unexpected error:', err?.message || err)
    return NextResponse.json({ error: 'Awaaz system me unexpected error aaya.', kind: 'tts-fail' }, { status: 500 })
  }
}
