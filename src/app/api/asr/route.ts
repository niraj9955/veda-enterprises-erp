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
 * Accuracy chain (the "bolta kuchh hu sunta kuchh aur" fix):
 *   - ERP vocabulary prompt anchors decoding toward business terms.
 *   - verbose_json returns per-segment avg_logprob; when confidence is weak
 *     the clip is retried once with language=hi (Whisper auto-detect often
 *     mishears short Hinglish clips as another language) and the more
 *     confident result wins.
 *   - ffmpeg trims leading/trailing silence (0.3s lead kept) — silence
 *     padding is the #1 hallucination trigger for Whisper.
 *   - Common hallucinations ("Thank you.", "मैं आपकी...", "amara.org"...) are
 *     filtered out instead of being filled into form fields.
 *   - Body may include optional `lang` ('hi' | 'en' | 'hi-IN' | 'en-IN') to
 *     force a language (skips auto-detect + retry).
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

    /** One ZAI ASR attempt. Returns cleaned text, throws on API failure.
     *  Noise/silence can make the engine "transcribe" symbol garbage (e.g. "#",
     *  "...") or classic Whisper-style hallucinations — all treated as empty
     *  so the retry chain still runs. */
    const tryAsr = async (b64: string): Promise<string> => {
      const zai = await ZAI.create()
      const response = await zai.audio.asr.create({ file_base64: b64 })
      return cleanTranscript(response?.text || '')
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
    let usedEngine: 'zai' | 'groq' | '' = ''
    let groqLanguage = ''
    if (!text) {
      try {
        const wav = await convertToWav(bin)
        const audio = wav || bin
        const forced = normalizeLang(body?.lang)
        let best = await tryGroqAsr(audio, forced || undefined)
        let g = cleanTranscript(best.text)
        // Whisper auto-detect often mishears short Hindi/Hinglish clips as
        // some other language ("bolta kuchh hu sunta kuchh aur"). When no
        // explicit language was requested and confidence is weak, retry once
        // with a Hindi hint and keep the more confident result.
        if (!forced && g && best.meanLogprob !== null && best.meanLogprob < -1.0) {
          console.log(`[ASR] weak confidence (avg_logprob ${best.meanLogprob.toFixed(2)}), retrying with language=hi`)
          try {
            const r2 = await tryGroqAsr(audio, 'hi')
            const g2 = cleanTranscript(r2.text)
            if (g2 && (r2.meanLogprob ?? -9) > (best.meanLogprob ?? -9)) {
              best = r2
              g = g2
              console.log('[ASR] hi-retry won with better confidence')
            }
          } catch (e2: any) {
            console.warn('[ASR] hi-retry failed (keeping first pass):', e2?.message || e2)
          }
        }
        text = g
        if (text) {
          usedEngine = 'groq'
          groqLanguage = best.detectedLanguage || ''
        }
      } catch (err: any) {
        groqErr = String(err?.message || err)
        console.warn(`[ASR] attempt 3 failed (groq): ${groqErr}`)
      }
    }

    if (text) {
      if (!usedEngine) usedEngine = 'zai'
      console.log(`[ASR] ok (${usedEngine}${groqLanguage ? `, lang=${groqLanguage}` : ''}): "${text.slice(0, 60)}"`)
      return NextResponse.json({
        text,
        engine: usedEngine,
        ...(usedEngine === 'groq' && groqLanguage ? { language: groqLanguage } : {}),
      })
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
 * Returns { text, meanLogprob, detectedLanguage }:
 *   - meanLogprob: duration-weighted avg_logprob of segments (null if unknown).
 *     Closer to 0 = more confident. Used by the caller for the Hindi retry.
 *   - detectedLanguage: Whisper's language guess (verbose_json).
 * Throws Error('no-groq-key') when no key is usable and
 * Error('groq-<status>: ...') when Groq rejects the request.
 *
 * The ERP vocabulary `prompt` biases decoding toward business terms — this
 * alone removes a big chunk of the "bolta kuchh sunta kuchh aur" problem on
 * short commands. Prompt must stay under Whisper's 224-token limit.
 */
const ERP_ASR_PROMPT =
  'Veda Enterprises ERP voice command. Hindi business words: बिल बनाओ, पेमेंट, कस्टमर, ग्राहक, नाम, मोबाइल नंबर, रुपये, रकम, जमा, बाकी, बकाया, टोटल बैलेंस, ऑर्डर, प्रोडक्ट, सामान, कील, पेच, सीमेंट, तार, वेतन, किराया, बिजली, खर्च, आज का, कल का, नया कस्टमर जोड़ो, दिखाओ, बताओ. English: customer, bill, payment, balance, order, product, total, amount, rupees.'

async function tryGroqAsr(
  bin: Buffer,
  language?: string
): Promise<{ text: string; meanLogprob: number | null; detectedLanguage: string }> {
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

  // Label the upload honestly — Whisper sniffs bytes but correct container
  // naming avoids edge cases (raw webm/mp4 was previously named audio.wav).
  const kind = detectFormat(bin)
  const mime = kind === 'wav' ? 'audio/wav' : kind === 'webm' ? 'audio/webm' : kind === 'ogg' ? 'audio/ogg' : 'audio/mp4'
  const name = mime.replace('audio/', 'audio.')

  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(bin)], { type: mime }), name)
  form.append('model', 'whisper-large-v3')
  form.append('response_format', 'verbose_json')
  form.append('temperature', '0')
  form.append('prompt', ERP_ASR_PROMPT)
  if (language) form.append('language', language)

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200)
    throw new Error(`groq-${res.status}: ${detail}`)
  }
  const data = (await res.json()) as {
    text?: string
    language?: string
    segments?: Array<{ avg_logprob?: number; start?: number; end?: number }>
  }

  // Duration-weighted mean of segment avg_logprob (defensive: if Groq ever
  // omits segments, confidence is unknown → caller skips the retry logic).
  let meanLogprob: number | null = null
  const segs = Array.isArray(data?.segments) ? data.segments : []
  if (segs.length) {
    let wsum = 0
    let w = 0
    let plain = 0
    for (const s of segs) {
      const lp = typeof s.avg_logprob === 'number' ? s.avg_logprob : null
      if (lp === null) continue
      const dur = Math.max(0.1, (Number(s.end) || 0) - (Number(s.start) || 0))
      wsum += lp * dur
      w += dur
      plain += lp
    }
    meanLogprob = w > 0 ? wsum / w : plain / segs.length
  }

  return {
    text: (data?.text || '').trim(),
    meanLogprob,
    detectedLanguage: typeof data?.language === 'string' ? data.language : '',
  }
}

/** Normalize an optional client language hint to a Whisper ISO code. */
function normalizeLang(v: unknown): string {
  if (typeof v !== 'string') return ''
  const s = v.trim().toLowerCase()
  if (s.startsWith('hi')) return 'hi'
  if (s.startsWith('en')) return 'en'
  return ''
}

/** Whisper hallucinates whole sentences on silence/noise (subtitle training
 *  data). These are real words so hasRealContent passes them — blocklist the
 *  known ones so they never land in form fields. Only applied to short
 *  texts (<80 chars) so genuine long speech is never nuked. */
const HALLUCINATION_PATTERNS: RegExp[] = [
  /^thank(s| you)[ .!]*$/i,
  /^thanks for watching[ .!]*$/i,
  /^like and subscribe[ .!]*$/i,
  /^subscribe[ .!]*$/i,
  /^(www\.|https?:\/\/|amara\.org)\S*$/i,
  /^\S+\.(com|org|net)[ .!]*$/i,
  /^(मैं आपकी|मुझे उम्मीद|आपके वीडियो|चैनल को सब्सक्राइब)/,
  /^धन्यवाद[ .!]*$/,
  /^सबसे (बड़ी|अच्छी)/,
  /^(गुड बाय|बाय बाय)[ .!]*$/i,
]

function isHallucination(t: string): boolean {
  const s = t.trim().replace(/[.!।?]+$/, '').trim()
  if (!s) return true
  if (s.length > 80) return false
  return HALLUCINATION_PATTERNS.some((re) => re.test(s))
}

/** Final cleanup for any engine output: keep only text that has real
 *  letters/digits/Devanagari AND is not a known silence hallucination. */
function cleanTranscript(t: string): string {
  const s = (t || '').trim()
  if (!s) return ''
  if (!/[a-zA-Z0-9\u0900-\u097F]/.test(s)) return ''
  if (isHallucination(s)) return ''
  return s
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
function detectFormat(buf: Buffer): 'wav' | 'webm' | 'ogg' | 'other' {
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF') return 'wav'
  // EBML header = WebM / Matroska
  if (buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'webm'
  // OggS = ogg/opus (Firefox MediaRecorder default)
  if (buf.length > 4 && buf.toString('ascii', 0, 4) === 'OggS') return 'ogg'
  return 'other'
}

/** Convert any audio container to 16kHz mono PCM WAV via ffmpeg (temp files).
 *  Also trims leading/trailing silence (keeping a 0.3s lead-in and 0.15s
 *  tail) — trailing VAD silence padding is the main trigger for Whisper
 *  hallucinations on short commands. If trimming collapses the clip
 *  (all-silence input), returns null so callers fall back to raw bytes. */
async function convertToWav(bin: Buffer): Promise<Buffer | null> {
  const id = crypto.randomUUID()
  const inPath = path.join(tmpdir(), `asr-${id}.bin`)
  const outPath = path.join(tmpdir(), `asr-${id}.wav`)
  try {
    await writeFile(inPath, bin)
    await execFileAsync(
      'ffmpeg',
      [
        '-y', '-loglevel', 'error', '-i', inPath,
        '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le',
        '-af',
        'silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.3,areverse,silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.15,areverse',
        outPath,
      ],
      { timeout: 20000 }
    )
    const out = await readFile(outPath)
    // WAV header is 44 bytes; anything under ~1.5KB of PCM after trimming is
    // effectively an all-silence clip — fall back to the raw original.
    if (out.length < 1536) {
      console.log('[ASR] trimmed WAV too small (all silence?), falling back to untrimmed')
      return null
    }
    return out
  } catch (err: any) {
    console.error('[ASR] ffmpeg convert error:', err?.message || err)
    return null
  } finally {
    await unlink(inPath).catch(() => {})
    await unlink(outPath).catch(() => {})
  }
}
