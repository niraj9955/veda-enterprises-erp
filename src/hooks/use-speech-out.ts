'use client'

import * as React from 'react'

/**
 * useSpeechOut — the AI's VOICE output (talking system out-path).
 *
 * speak(text) engine chain:
 *   1. SERVER TTS: POST /api/tts → WAV blob → <audio> playback (inside the
 *      route: Groq PlayAI → ZAI tongtong; blob-URL cache = instant repeats).
 *   2. v3.19 FALLBACK — BROWSER speechSynthesis (device ki apni voice:
 *      Android Google TTS / iOS Siri / desktop voices). This fixes the
 *      real-world Vercel failure where BOTH server engines fail (Groq
 *      PlayAI terms not accepted on the user's Groq account, and no ZAI
 *      credentials in Vercel env): the AI STILL speaks on the phone, free,
 *      no API key needed.
 *   3. Both fail → amber note via onError; the reply stays visible as text.
 *
 * stop(): barge-in — kills server audio AND browser speech instantly.
 * unlock(): call inside a real user gesture (mic tap / widget open) —
 *   primes a muted <audio> + one silent utterance so the LATER programmatic
 *   playback (which happens seconds after the gesture, after ASR + agent +
 *   TTS round trips) is allowed by mobile autoplay policies (iOS Safari
 *   especially: first speak must be gesture-primed).
 * enabled: persisted in localStorage ('veda-ai-voice-out'), header toggle.
 *
 * Superseding: starting a new speak while one plays stops the old one
 * first (seq counter) — only the newest reply is ever heard.
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

// ─────────────────────────────────────────────────────────────────────────
// Browser TTS fallback (v3.19) — window.speechSynthesis
// ─────────────────────────────────────────────────────────────────────────

let voicesWarmed = false
function warmVoices() {
  if (voicesWarmed || typeof window === 'undefined' || !('speechSynthesis' in window)) return
  voicesWarmed = true
  try {
    // Chrome loads the voice list asynchronously — read once now and again
    // on voiceschanged so pickBrowserVoice() finds real voices by speak time.
    window.speechSynthesis.getVoices()
    window.speechSynthesis.onvoiceschanged = () => { try { window.speechSynthesis.getVoices() } catch { /* ignore */ } }
  } catch { /* ignore */ }
}

function hasDevanagari(t: string): boolean {
  return /[\u0900-\u097F]/.test(t)
}

function pickBrowserVoice(text: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices() || []
  if (!voices.length) return null
  const byLang = (prefix: string) =>
    voices.find((v) => (v.lang || '').toLowerCase().replace('_', '-').startsWith(prefix))
  // Devanagari Hindi text → Hindi voice first (en-IN is a decent fallback).
  if (hasDevanagari(text)) return byLang('hi') || byLang('en-in') || voices[0]
  // Latin-script Hinglish (agent replies: "Namaste, aaj ki sale...") —
  // Indian English voice handles Hinglish words most naturally.
  return byLang('en-in') || byLang('hi') || byLang('en') || voices[0]
}

/** Speak via the device engine. Resolves true when finished, false on failure. */
function speakWithBrowser(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return resolve(false)
    const synth = window.speechSynthesis
    try {
      warmVoices()
      synth.cancel() // never overlap with a stale utterance
      const u = new SpeechSynthesisUtterance(text)
      const voice = pickBrowserVoice(text)
      if (voice) { u.voice = voice; u.lang = voice.lang } else { u.lang = hasDevanagari(text) ? 'hi-IN' : 'en-IN' }
      u.rate = 1.02
      u.pitch = 1.0
      u.volume = 1.0
      let settled = false
      const finish = (ok: boolean) => { if (!settled) { settled = true; resolve(ok) } }
      u.onend = () => finish(true)
      u.onerror = () => finish(false)
      // Chrome quirk: some failures never fire onend/onerror (voice missing,
      // engine blocked). If it hasn't actually started speaking shortly after
      // speak(), treat it as failed instead of hanging the loop forever.
      window.setTimeout(() => { if (!settled && !synth.speaking) finish(false) }, 3500)
      synth.speak(u)
    } catch {
      resolve(false)
    }
  })
}

function cancelBrowserSpeech() {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  } catch { /* ignore */ }
}

// Once-per-session note when we silently switch to the device voice
let browserVoiceNotified = false

/** 100ms of true silence as a WAV data URI — for the autoplay unlock probe. */
function makeSilentWavDataUri(): string {
  try {
    const sr = 8000
    const n = Math.floor(sr / 10)
    const buf = new ArrayBuffer(44 + n * 2)
    const v = new DataView(buf)
    const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ')
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
    w(36, 'data'); v.setUint32(40, n * 2, true)
    const bytes = new Uint8Array(buf)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return 'data:audio/wav;base64,' + btoa(bin)
  } catch {
    return ''
  }
}

export interface UseSpeechOutOptions {
  onError?: (message: string) => void
}

export function useSpeechOut({ onError }: UseSpeechOutOptions = {}) {
  const [enabled, setEnabled] = React.useState(false)
  const [speaking, setSpeaking] = React.useState(false)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const unlockAudioRef = React.useRef<HTMLAudioElement | null>(null)
  const speakSeqRef = React.useRef(0) // supersedes stale playbacks
  const onErrorRef = React.useRef(onError)
  React.useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  // Load persisted toggle + stop any audio on unmount
  React.useEffect(() => {
    try { setEnabled(localStorage.getItem(LS_KEY) !== '0') } catch { /* ignore */ }
    warmVoices()
    return () => {
      speakSeqRef.current += 1
      const a = audioRef.current
      if (a) { try { a.pause() } catch { /* ignore */ } }
      audioRef.current = null
      cancelBrowserSpeech()
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
    cancelBrowserSpeech()
    setSpeaking(false)
  }, [])

  /**
   * Call inside a user gesture (mic tap / widget open / voice toggle).
   * Primes both output paths so the later programmatic playback — which
   * happens many seconds after this gesture (ASR + agent + TTS round
   * trips) — passes strict mobile autoplay policies.
   */
  const unlock = React.useCallback(() => {
    try {
      if (!unlockAudioRef.current) unlockAudioRef.current = new Audio()
      const uri = makeSilentWavDataUri()
      if (uri) {
        unlockAudioRef.current.src = uri
        unlockAudioRef.current.volume = 0
        void unlockAudioRef.current.play().catch(() => { /* blocked — best effort */ })
      }
    } catch { /* ignore */ }
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(' ')
        u.volume = 0
        window.speechSynthesis.speak(u)
      }
    } catch { /* ignore */ }
  }, [])

  const setEnabledPersisted = React.useCallback((next: boolean) => {
    setEnabled(next)
    try { localStorage.setItem(LS_KEY, next ? '1' : '0') } catch { /* ignore */ }
    if (next) unlock()
    else stop()
  }, [stop, unlock])

  /**
   * Unified device-voice fallback — used by ALL failure paths (server 503,
   * network fail, timeout, audio-play block). Resolves true when the device
   * voice actually spoke; fires the once-per-session info note.
   */
  const tryBrowserFallback = React.useCallback(async (text: string, seq: number, slowServer: boolean): Promise<boolean> => {
    const browserOk = await speakWithBrowser(text)
    if (seq !== speakSeqRef.current) return false
    if (browserOk) {
      if (!browserVoiceNotified) {
        browserVoiceNotified = true
        onErrorRef.current?.(slowServer
          ? 'Server slow tha — ab phone ki apni voice se bol raha hoon.'
          : 'Server awaaz engine available nahi tha — ab phone ki apni voice se bol raha hoon. (Behtar awaaz ke liye console.groq.com/playai par PlayAI terms accept karo.)')
      }
      return true
    }
    return false
  }, [])

  /**
   * Speak a reply. Resolves:
   *   true  — playback finished (server audio OR device browser voice)
   *   false — every engine failed (onError fired) OR superseded/stopped
   */
  const speak = React.useCallback(async (rawText: string): Promise<boolean> => {
    stop()
    const text = cleanForSpeechKey(rawText)
    if (!text) return false
    const seq = ++speakSeqRef.current
    setSpeaking(true)
    let serverError = ''
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
          serverError = data?.error || 'Awaaz system me problem aayi. Jawab text me dikh raha hai.'
          // NO early return — fall through to the device browser voice.
        } else {
          const blob = await res.blob()
          url = URL.createObjectURL(blob)
          cachePut(text, url)
        }
      }
      if (seq !== speakSeqRef.current) return false

      if (url) {
        const audio = new Audio(url)
        audioRef.current = audio
        const played = await new Promise<boolean>((resolve) => {
          audio.onended = () => resolve(true)
          audio.onerror = () => resolve(false)
          audio.play().catch(() => resolve(false)) // autoplay block etc.
        })
        if (seq !== speakSeqRef.current) return false // stopped/superseded during play
        if (played) return true
        // Audio element refused (blocked/decode fail) → device voice below
      }

      // ── Fallback: device ki apni awaaz (browser speechSynthesis) ──
      const browserOk = await tryBrowserFallback(text, seq, false)
      if (browserOk) return true
      onErrorRef.current?.(serverError || 'Is device me koi awaaz engine available nahi hai. Jawab text me dikh raha hai.')
      return false
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        serverError = 'Awaaz banane me server ne zyada time liya (timeout).'
      } else {
        console.warn('[SpeechOut] speak error:', err?.message || err)
        serverError = 'Awaaz server tak nahi pahunchi (network).'
      }
      // Network fail / timeout → STILL try the device voice before giving up
      const browserOk = await tryBrowserFallback(text, seq, true)
      if (browserOk) return true
      onErrorRef.current?.(serverError + ' Jawab text me dikh raha hai.')
      return false
    } finally {
      if (seq === speakSeqRef.current) {
        setSpeaking(false)
        audioRef.current = null
      }
    }
  }, [stop, tryBrowserFallback])

  return { enabled, setEnabled: setEnabledPersisted, speaking, speak, stop, unlock }
}

export default useSpeechOut
