'use client'

import * as React from 'react'

/**
 * useVoiceRecorder — universal voice input via MediaRecorder + backend ASR.
 *
 * Why not Web Speech API? It only works in Chrome/Edge desktop and Android
 * Chrome, silently fails on iOS Safari, Firefox, and in-app WebViews, and
 * depends on Google speech servers (often blocked/slow). MediaRecorder +
 * server-side ASR works on EVERY modern browser — mobile and laptop.
 *
 * Flow: getUserMedia → MediaRecorder records until stop() →
 * audio blob → base64 → POST /api/asr → transcribed text.
 */

export type VoiceRecorderStatus = 'idle' | 'requesting' | 'recording' | 'processing'

export type VoiceErrorKind = 'permission' | 'device' | 'unsupported' | 'network' | 'no-speech' | 'other'

interface UseVoiceRecorderOptions {
  /** Called with the final transcribed text after stop() succeeds. */
  onResult: (text: string) => void
  /** Called with user-friendly Hinglish error messages + a machine-readable kind. */
  onError: (message: string, kind?: VoiceErrorKind) => void
  /** Max recording length in ms (auto-stop). Default 60s. */
  maxDurationMs?: number
}

/** Pick the best supported audio container for this browser. */
function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const type of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type
    } catch { /* keep trying */ }
  }
  return '' // browser default
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = String(reader.result || '')
      // "data:audio/webm;base64,XXXX" -> "XXXX"
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(new Error('Audio file read nahi ho paya'))
    reader.readAsDataURL(blob)
  })
}

export function useVoiceRecorder({ onResult, onError, maxDurationMs = 60000 }: UseVoiceRecorderOptions) {
  const [status, setStatus] = React.useState<VoiceRecorderStatus>('idle')

  const streamRef = React.useRef<MediaStream | null>(null)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const maxTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTsRef = React.useRef(0)
  // Keep latest callbacks without re-creating the public API functions
  const onResultRef = React.useRef(onResult)
  const onErrorRef = React.useRef(onError)
  React.useEffect(() => {
    onResultRef.current = onResult
    onErrorRef.current = onError
  }, [onResult, onError])

  const cleanup = React.useCallback(() => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current)
      maxTimerRef.current = null
    }
    try {
      recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop()
    } catch { /* ignore */ }
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    chunksRef.current = []
  }, [])

  // Cleanup on unmount no matter what
  React.useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  const transcribe = React.useCallback(async (blob: Blob) => {
    setStatus('processing')
    try {
      // Ultra-short or empty recording → nothing to send
      if (blob.size < 2048) {
        onErrorRef.current('Kuch sunayi nahi diya. Mic ke paas bolke dubara try karo.', 'no-speech')
        setStatus('idle')
        return
      }
      const base64 = await blobToBase64(blob)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      let text = ''
      try {
        const res = await fetch('/api/asr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ audio: base64 }),
          signal: controller.signal,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          onErrorRef.current(data?.error || `Transcription fail ho gaya (HTTP ${res.status})`, res.status === 401 ? 'network' : 'other')
          return
        }
        text = (data?.text || '').trim()
      } finally {
        clearTimeout(timeout)
      }

      if (!text) {
        onErrorRef.current('Awaz samajh nahi aayi. Thoda dheere aur saaf bolke dubara try karo.', 'no-speech')
        return
      }
      onResultRef.current(text)
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        onErrorRef.current('Server ne time zyada liya (timeout). Dubara try karo.', 'network')
      } else {
        console.warn('[VoiceRecorder] transcribe error:', err?.message)
        onErrorRef.current('Voice processing me problem aayi. Dubara try karo.', 'other')
      }
    } finally {
      setStatus('idle')
    }
  }, [])

  const start = React.useCallback(async () => {
    if (status !== 'idle') return

    // Browser support check — MediaRecorder + getUserMedia (universally available)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      onErrorRef.current('Is browser me voice support nahi hai. Chrome ya Safari ka latest version use karo.', 'unsupported')
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      onErrorRef.current('Is browser me recording support nahi hai. Chrome ya Safari update karke try karo.', 'unsupported')
      return
    }

    setStatus('requesting')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch (err: any) {
      console.warn('[VoiceRecorder] getUserMedia failed:', err?.name, err?.message)
      setStatus('idle')

      if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        onErrorRef.current('Microphone device nahi mila. Mic connect karo aur dubara try karo.', 'device')
        return
      }
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.name === 'SecurityError') {
        onErrorRef.current(
          'Mic permission BLOCK hai! Fix: browser ke address bar mein 🔒 (lock) icon pe tap karo → Microphone → "Allow" select karo → page refresh karo.',
          'permission'
        )
        return
      }
      onErrorRef.current(`Mic start nahi ho paya: ${err?.message || err?.name || 'Unknown error'}`, 'other')
      return
    }

    streamRef.current = stream
    chunksRef.current = []

    const mimeType = pickMimeType()
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch {
      try {
        recorder = new MediaRecorder(stream) // fall back to browser default
      } catch (err: any) {
        console.warn('[VoiceRecorder] MediaRecorder ctor failed:', err?.message)
        cleanup()
        setStatus('idle')
        onErrorRef.current('Recording start nahi ho paya. Page refresh karke dubara try karo.', 'other')
        return
      }
    }
    recorderRef.current = recorder

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      cleanup()
      // Fire-and-forget transcription; status handled inside transcribe()
      void transcribe(blob)
    }

    try {
      recorder.start()
    } catch (err: any) {
      console.warn('[VoiceRecorder] recorder.start failed:', err?.message)
      cleanup()
      setStatus('idle')
      onErrorRef.current('Recording start nahi ho paya. Dubara try karo.', 'other')
      return
    }

    startTsRef.current = Date.now()
    setStatus('recording')

    // Safety: auto-stop after maxDurationMs
    maxTimerRef.current = setTimeout(() => {
      if (recorderRef.current?.state === 'recording') {
        try { recorderRef.current.stop() } catch { /* ignore */ }
      }
    }, maxDurationMs)
  }, [status, transcribe, cleanup])

  const stop = React.useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') {
      try { recorder.stop() } catch { cleanup(); setStatus('idle') }
    } else {
      cleanup()
      setStatus('idle')
    }
  }, [cleanup])

  const toggle = React.useCallback(() => {
    if (status === 'recording') stop()
    else if (status === 'idle') void start()
    // while 'requesting'/'processing' ignore taps
  }, [status, start, stop])

  return { status, isRecording: status === 'recording', isBusy: status !== 'idle' && status !== 'recording', start, stop, toggle }
}

export default useVoiceRecorder
