import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { requireSession } from '@/lib/auth'

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

    const zai = await ZAI.create()
    const response = await zai.audio.asr.create({ file_base64: base64 })
    const text = (response?.text || '').trim()

    return NextResponse.json({ text })
  } catch (error: any) {
    console.error('[ASR] transcription failed:', error?.message || error)
    return NextResponse.json(
      { error: 'Awaz samajh nahi paye. Thoda saaf bolke dubara try karo.' },
      { status: 500 }
    )
  }
}
