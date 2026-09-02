import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { requireSession } from '@/lib/auth'
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

    let asrBase64 = base64
    if (format === 'other') {
      // mp4/aac (iOS Safari), ogg/opus (Firefox), 3gpp, etc. — convert to WAV
      const converted = await convertToWav(bin)
      if (converted) {
        asrBase64 = converted.toString('base64')
        console.log(`[ASR] converted ${format} -> WAV (${converted.length} bytes)`)
      } else {
        // conversion failed — try the original anyway (maybe it was supported)
        console.warn('[ASR] ffmpeg conversion failed, sending original bytes')
      }
    }

    const zai = await ZAI.create()
    const response = await zai.audio.asr.create({ file_base64: asrBase64 })
    const text = (response?.text || '').trim()
    console.log(`[ASR] ok: "${text.slice(0, 60)}"`)

    return NextResponse.json({ text })
  } catch (error: any) {
    console.error('[ASR] transcription failed:', error?.message || error)
    return NextResponse.json(
      { error: 'Awaz samajh nahi paye. Thoda saaf bolke dubara try karo.' },
      { status: 500 }
    )
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
