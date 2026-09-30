'use client'

import * as React from 'react'

/**
 * useSpeechOut — the AI's VOICE output (talking system out-path).
 *
 * speak(text): POST /api/tts → WAV blob → Audio playback.
 *  - Blob-URL cache keyed by cleaned text (repeat replies play instantly,
 *    no second server round trip).
 *  - Resolves true when playback finished, false when TTS failed/unavailable
 *    (via onError callback with a user-friendly Hinglish message) or was
 *    superseded by a newer speak()/stop() call (barge-in).
 *  - stop(): barge-in — pauses + drops the current audio immediately.
 *  - enabled: persisted in localStorage ('veda-ai-voice-out'), header toggle.
 *
 * Superseding: starting a new speak while one plays stops the old one
 * first — only the newest reply is ever heard.
 */

const LS_KEY = 'veda-ai-voice-out'
const MAX_CACHE = 8
const MAX_SPEAK_CHARS = 900

/** Client-side mirror of the server clean — keep the cache key tidy. */
function cleanForSpeechKey(raw: string): string {
  let t = String(raw || '')
  t = t.replace(/```[\s\S]*?```/g, ' ')
  t = t.replace(/`([^`]*)`/g, '$1')
  t = t.replace(/[*_#~]+/g, ' ')
  t = t.replace(/\|/g, ', ')
  t = t.replace(/^\s*[-•·]\s+/gm, '')
  t = t.replace(/https?:\/\/\S+/g, ' ')
  t = t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2190}-\u{21FF}]/gu, ' ')
  t = t.replace(/₹\s*/g, ' rupaye ')
  t = t.replace(/\bRs\.?\s*/gi, ' rupaye ')
  t = t.replace(/\s+/g, ' ').trim()
  if (t.length > MAX_SPEAK_CHARS) {
    const slice = t.slice(0, MAX_SPEAK_CHARS)
    const cut = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'), slice.lastIndexOf(','))
    t = (cut > 200 ? slice.slice(0, cut + 1) : slice).trim()
  }
  return t
}

// Module-level cache shared across widget remounts (widget opens/closes often)
const blobUrlCache = new Map<string, string>()

function cacheGet(key: string): string | undefined {
  return blobUrlCache.get(key)
}

function cachePut(key: string, url: string) {
  if (blobUrlCache.size >= MAX_CACHE) {
    const oldest = blobUrlCache.keys().next().value
    if (oldest) {
      const old = blobUrlCache.get(oldest)
      if (old) { try { URL.revokeObjectURL(old) } catch { /* ignore */ } }
      blobUrlCache.delete(oldest)
    }
  }
  blobUrlCache.set(key, url)
}

export interface UseSpeechOutOptions {
  onError?: (message: string) => void
}

export function useSpeechOut({ onError }: UseSpeechOutOptions = {}) {
  const [enabled, setEnabled] = React.useState(false)
  const [speaking, setSpeaking] = React.useState(false)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const speakSeqRef = React.useRef(0) // supersedes stale playbacks
  const onErrorRef = React.useRef(onError)
  React.useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  // Load persisted toggle + stop any audio on unmount
  React.useEffect(() => {
    try { setEnabled(localStorage.getItem(LS_KEY) !== '0') } catch { /* ignore */ }
    return () => {
      speakSeqRef.current += 1
      const a = audioRef.current
      if (a) { try { a.pause() } catch { /* ignore */ } }
      audioRef.current = null
    }
  }, [])

  const stop = React.useCallback(() => {
    speakSeqRef.current += 1 // invalidate any in-flight playback chain
    const a = audioRef.current
    if (a) {
      try { a.pause() } catch { /* ignore */ }
      try { a.currentTime = 0 } catch { /* ignore */ }
    }
    audioRef.current = null
    setSpeaking(false)
  }, [])

  const setEnabledPersisted = React.useCallback((next: boolean) => {
    setEnabled(next)
    try { localStorage.setItem(LS_KEY, next ? '1' : '0') } catch { /* ignore */ }
    if (!next) stop()
  }, [stop])

  /**
   * Speak a reply. Resolves:
   *   true  — playback finished (or was cached + finished)
   *   false — TTS unavailable/failed (onError fired) OR superseded/stopped
   */
  const speak = React.useCallback(async (rawText: string): Promise<boolean> => {
    stop()
    const text = cleanForSpeechKey(rawText)
    if (!text) return false
    const seq = ++speakSeqRef.current
    setSpeaking(true)
    try {
      let url = cacheGet(text)
      if (!url) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 45000)
        let res: Response
        try {
          res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ text }),
            signal: controller.signal,
          })
        } finally {
          clearTimeout(timeout)
        }
        if (seq !== speakSeqRef.current) return false // superseded mid-fetch
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          onErrorRef.current?.(data?.error || 'Awaaz system me problem aayi. Jawab text me dikh raha hai.')
          setSpeaking(false)
          return false
        }
        const blob = await res.blob()
        url = URL.createObjectURL(blob)
        cachePut(text, url)
      }
      if (seq !== speakSeqRef.current) return false

      const audio = new Audio(url)
      audioRef.current = audio
      await new Promise<void>((resolve) => {
        const done = () => { resolve() }
        audio.onended = done
        audio.onerror = done
        audio.play().catch(() => resolve())
      })
      if (seq !== speakSeqRef.current) return false // stopped/superseded during play
      return true
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        onErrorRef.current?.('Awaaz banane me server ne zyada time liya (timeout). Jawab text me dikh raha hai.')
      } else {
        console.warn('[SpeechOut] speak error:', err?.message || err)
        onErrorRef.current?.('Awaaz play nahi ho payi. Jawab text me dikh raha hai.')
      }
      return false
    } finally {
      if (seq === speakSeqRef.current) {
        setSpeaking(false)
        audioRef.current = null
      }
    }
  }, [stop])

  return { enabled, setEnabled: setEnabledPersisted, speaking, speak, stop }
}

export default useSpeechOut
