import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { requireSession } from '@/lib/auth'
import { AiConfig } from '@/lib/models'
import { connectDB } from '@/lib/db'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import crypto from 'crypto'

const execFileAsync = promisify(execFile)

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

/**
 * POST /api/asr
 * Body: { audio: string (base64, raw or data-URL), mimeType?: string }
 * Returns: { text: string }
 *
 * Universal voice input backend — works on EVERY browser (Chrome/Firefox/Safari,
 * Android/iOS/desktop) because the client only needs MediaRecorder (universally
 * supported), unlike Web Speech API which is Chrome-only and depends on
 * Google speech servers.
 *
 * Format handling (verified by testing every container against the ASR API):
 *  - WAV (RIFF)      → passes through directly ✅
 *  - WebM/Matroska   → passes through directly ✅ (Chrome/Android default)
 *  - everything else → converted to 16kHz mono WAV via ffmpeg ❌→✅
 *    (mp4/aac from iOS Safari FAILED on the ASR API before this conversion —
 *     that was the "iPhone pe voice kaam nahi karta" bug)
 *
 * Resilience: if the first transcription attempt fails or returns empty,
 * the audio is ALWAYS retried as a freshly normalized 16kHz mono WAV.
 *
 * Engine chain: built-in ZAI ASR → Groq Whisper (whisper-large-v3).
 * The ZAI engine needs sandbox credentials that do NOT exist on Vercel, so
 * there the fallback engine is REQUIRED. Groq key resolution order:
 *   1. process.env.GROQ_API_KEY   (Vercel env var — recommended)
 *   2. DB AiConfig (provider='groq' && enabled) — settable from the app's
 *      AI Settings page without redeploying.
 *
 * Empty results return HTTP 200 with { text: '' } and a `kind` hint so the
 * client can show the right message (silence vs error vs too-short vs
 * no-provider — the last one NAMES the exact missing API).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    const body = await request.json().catch(() => null)
    const audio: unknown = body?.audio
    if (!audio || typeof audio !== 'string') {
      return NextResponse.json({ error: 'No audio data provided' }, { status: 400 })
    }

    // Accept both raw base64 and data URLs ("data:audio/webm;base64,....")
    const base64 = audio.includes(',') ? audio.split(',')[1] : audio
    if (!base64 || base64.length < 100) {
      return NextResponse.json({ error: 'Audio data too small or empty' }, { status: 400 })
    }
    // Sanity cap ~20MB of binary (base64 inflates ~4/3)
    if (base64.length > 27 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio recording too large (max ~20MB)' }, { status: 413 })
    }

    const bin = Buffer.from(base64, 'base64')
    const format = detectFormat(bin)
    console.log(`[ASR] request: ${bin.length} bytes, format=${format}`)

    // Sanity: a recording under ~1.5KB of real audio is basically a mis-tap
    if (bin.length < 1536) {
      console.log('[ASR] rejected: recording too short')
      return NextResponse.json(
        { error: 'Recording bahut chhoti thi. Mic dabaye aur thoda lamba bolo.', kind: 'too-short' },
        { status: 422 }
      )
    }

    /** One ZAI ASR attempt. Returns trimmed text, throws on API failure.
     *  Noise/silence can make the engine "transcribe" symbol garbage (e.g. "#",
     *  "...") — that is treated as empty so the retry chain still runs. */
    const hasRealContent = (t: string) => /[a-zA-Z0-9\u0900-\u097F]/.test(t)
    const tryAsr = async (b64: string): Promise<string> => {
      const zai = await ZAI.create()
      const response = await zai.audio.asr.create({ file_base64: b64 })
      const t = (response?.text || '').trim()
      return hasRealContent(t) ? t : ''
    }

    let text = ''
    let lastErr: any = null
    let zaiFailed = false // at least one ZAI attempt THREW (engine down/misconfigured)
    let groqErr: string | null = null // Groq was attempted but failed (with reason)

    // Attempt 1: direct passthrough for WAV/WebM (native), converted for others
    let firstBase64 = base64
    if (format === 'other') {
      const converted = await convertToWav(bin)
      if (converted) {
        firstBase64 = converted.toString('base64')
        console.log(`[ASR] converted ${format} -> WAV (${converted.length} bytes)`)
      } else {
        console.warn('[ASR] ffmpeg conversion failed, sending original bytes')
      }
    }

    try {
      text = await tryAsr(firstBase64)
    } catch (err: any) {
      lastErr = err
      zaiFailed = true
      console.warn(`[ASR] attempt 1 failed (zai): ${err?.message || err}`)
    }

    // Attempt 2: ALWAYS retry with a freshly normalized 16k mono WAV.
    // Fixes: truncated Chrome webm blobs, odd sample rates, embedded headers,
    // transient upstream errors — normalization repairs all of these.
    if (!text) {
      try {
        const wav = await convertToWav(bin)
        if (wav) {
          console.log(`[ASR] retry with normalized WAV (${wav.length} bytes)`)
          text = await tryAsr(wav.toString('base64'))
        }
      } catch (err: any) {
        lastErr = err
        zaiFailed = true
        console.warn(`[ASR] attempt 2 failed (zai): ${err?.message || err}`)
      }
    }

    // Attempt 3: Groq Whisper fallback — REQUIRED on Vercel where the ZAI
    // engine has no credentials. Also useful when ZAI has a transient outage.
    if (!text) {
      try {
        const wav = await convertToWav(bin)
        const g = await tryGroqAsr(wav || bin)
        text = hasRealContent(g) ? g : ''
      } catch (err: any) {
        groqErr = String(err?.message || err)
        console.warn(`[ASR] attempt 3 failed (groq): ${groqErr}`)
      }
    }

    if (text) {
      console.log(`[ASR] ok${groqErr ? ' (groq)' : ''}: "${text.slice(0, 60)}"`)
      return NextResponse.json({ text, engine: groqErr ? 'groq' : 'zai' })
    }

    // Voice engine chain is down: ZAI threw AND no usable Groq key.
    // This is the "Vercel pe voice kaam nahi kar raha" case — NAME the fix.
    if (zaiFailed && groqErr === 'no-groq-key') {
      console.error('[ASR] no engine available: ZAI unavailable + GROQ_API_KEY not set')
      return NextResponse.json(
        {
          error:
            'Voice engine is server par uplabdh nahi hai (Vercel). Isko theek karne ke liye Vercel environment me GROQ_API_KEY add karo — console.groq.com se free key milti hai. Ya app ki AI Settings me Groq key daal do.',
          kind: 'no-provider',
        },
        { status: 503 }
      )
    }
    // Groq key exists but was rejected/expired — say exactly that.
    if (groqErr && groqErr.startsWith('groq-401')) {
      return NextResponse.json(
        { error: 'Groq API key invalid ya expire ho gayi hai. Nayi key generate karo (console.groq.com).', kind: 'no-provider' },
        { status: 503 }
      )
    }

    // Both attempts produced nothing — decide the user-facing message.
    // If at least one decode path SUCCEEDED but text is empty → it was silence.
    const decoded = await decodeDuration(bin, format).catch(() => 0)
    if (decoded > 0 && decoded < 1.0) {
      console.log(`[ASR] empty result, duration ${decoded.toFixed(2)}s -> too-short`)
      return NextResponse.json(
        { error: 'Bolna thoda lamba rakho — jaldi chala gaya tha.', kind: 'too-short' },
        { status: 422 }
      )
    }
    if (lastErr) {
      console.error('[ASR] transcription failed:', lastErr?.message || lastErr)
    } else {
      console.log('[ASR] empty transcription (silence/noise only)')
    }
    return NextResponse.json(
      { error: 'Awaz samajh nahi paye. Thoda saaf bolke dubara try karo.', kind: 'no-speech' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[ASR] transcription failed:', error?.message || error)
    return NextResponse.json(
      { error: 'Awaz samajh nahi paye. Thoda saaf bolke dubara try karo.', kind: 'error' },
      { status: 500 }
    )
  }
}

/**
 * Groq Whisper fallback — works everywhere including Vercel serverless.
 * Key: env GROQ_API_KEY first, then DB AiConfig (provider='groq', enabled).
 * Returns trimmed text; throws Error('no-groq-key') when no key is usable
 * and Error('groq-<status>: ...') when Groq rejects the request.
 */
async function tryGroqAsr(bin: Buffer): Promise<string> {
  let key = process.env.GROQ_API_KEY || ''
  if (!key) {
    try {
      await connectDB()
      const cfg = (await AiConfig.findOne().lean()) as Record<string, unknown> | null
      if (cfg && cfg.provider === 'groq' && cfg.enabled && cfg.openaiApiKey) {
        key = String(cfg.openaiApiKey)
      }
    } catch (e: any) {
      console.warn('[ASR] AiConfig lookup failed:', e?.message || e)
    }
  }
  if (!key) throw new Error('no-groq-key')

  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(bin)], { type: 'audio/wav' }), 'audio.wav')
  form.append('model', 'whisper-large-v3')
  form.append('response_format', 'json')
  form.append('temperature', '0')

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200)
    throw new Error(`groq-${res.status}: ${detail}`)
  }
  const data = (await res.json()) as { text?: string }
  return (data?.text || '').trim()
}

/** Audio duration in seconds (best-effort, for better error messages). */
async function decodeDuration(bin: Buffer, format: string): Promise<number> {
  const id = crypto.randomUUID()
  const inPath = path.join(tmpdir(), `asr-dur-${id}.bin`)
  try {
    await writeFile(inPath, bin)
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', inPath],
      { timeout: 8000 }
    )
    return parseFloat(stdout.trim()) || 0
  } finally {
    await unlink(inPath).catch(() => {})
  }
}

/** Detect audio container from magic bytes. */
function detectFormat(buf: Buffer): 'wav' | 'webm' | 'other' {
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF') return 'wav'
  // EBML header = WebM / Matroska
  if (buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'webm'
  return 'other'
}

/** Convert any audio container to 16kHz mono PCM WAV via ffmpeg (temp files). */
async function convertToWav(bin: Buffer): Promise<Buffer | null> {
  const id = crypto.randomUUID()
  const inPath = path.join(tmpdir(), `asr-${id}.bin`)
  const outPath = path.join(tmpdir(), `asr-${id}.wav`)
  try {
    await writeFile(inPath, bin)
    await execFileAsync(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-i', inPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outPath],
      { timeout: 20000 }
    )
    return await readFile(outPath)
  } catch (err: any) {
    console.error('[ASR] ffmpeg convert error:', err?.message || err)
    return null
  } finally {
    await unlink(inPath).catch(() => {})
    await unlink(outPath).catch(() => {})
  }
}
