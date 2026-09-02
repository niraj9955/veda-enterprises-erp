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
 * Flow: getUserMedia → MediaRecorder records → AudioContext meter runs a
 * live level loop → auto-stop triggers:
 *   1. user stays silent for `silenceStopMs` AFTER speaking → stop + submit
 *      (one-tap UX: tap mic, speak, pause — text appears, no second tap)
 *   2. no meaningful sound at all for `noSpeechTimeoutMs` → stop with a
 *      "mic mute / wrong device" diagnostic error (catches muted mics)
 *   3. maxDurationMs hard cap → stop + submit
 * Manual stop (second tap) still works anytime.
 */

export type VoiceRecorderStatus = 'idle' | 'requesting' | 'recording' | 'processing'

export type VoiceErrorKind = 'permission' | 'device' | 'unsupported' | 'network' | 'no-speech' | 'no-signal' | 'other'

interface UseVoiceRecorderOptions {
  /** Called with the final transcribed text after stop() succeeds. */
  onResult: (text: string) => void
  /** Called with user-friendly Hinglish error messages + a machine-readable kind. */
  onError: (message: string, kind?: VoiceErrorKind) => void
  /** Max recording length in ms (auto-stop). Default 60s. */
  maxDurationMs?: number
  /** Silence length (after speech was detected) that auto-submits. Default 2s. */
  silenceStopMs?: number
  /** If NO meaningful sound at all for this long, report mic-signal problem. Default 10s. */
  noSpeechTimeoutMs?: number
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

export function useVoiceRecorder({
  onResult,
  onError,
  maxDurationMs = 60000,
  silenceStopMs = 2000,
  noSpeechTimeoutMs = 10000,
}: UseVoiceRecorderOptions) {
  const [status, setStatus] = React.useState<VoiceRecorderStatus>('idle')
  /** Live mic loudness 0-100, updated ~10x/sec while recording (for UI bars). */
  const [level, setLevel] = React.useState(0)

  const streamRef = React.useRef<MediaStream | null>(null)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const maxTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTsRef = React.useRef(0)
  // Live metering / VAD
  const audioCtxRef = React.useRef<AudioContext | null>(null)
  const meterTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const hasSpeechRef = React.useRef(false)
  const lastVoiceTsRef = React.useRef(0)
  // When a no-signal stop happens, onstop must NOT transcribe — it should
  // just clean up (the error is reported directly by the no-signal path).
  const skipTranscribeRef = React.useRef(false)
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
    if (meterTimerRef.current) {
      clearInterval(meterTimerRef.current)
      meterTimerRef.current = null
    }
    if (audioCtxRef.current) {
      try { void audioCtxRef.current.close() } catch { /* ignore */ }
      audioCtxRef.current = null
    }
    try {
      recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop()
    } catch { /* ignore */ }
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    chunksRef.current = []
    hasSpeechRef.current = false
    setLevel(0)
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
    skipTranscribeRef.current = false
    hasSpeechRef.current = false

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
      if (skipTranscribeRef.current) {
        // no-signal path already reported the error — nothing to transcribe
        skipTranscribeRef.current = false
        return
      }
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

    // ── Live metering + silence auto-stop (VAD) ────────────────────────────
    // AudioContext + AnalyserNode give us the mic loudness ~10x/sec. This
    // powers the UI bars AND the one-tap auto-submit: once the user has
    // spoken (level above threshold) and then stays quiet for silenceStopMs,
    // we stop + transcribe automatically. If NO sound is ever detected for
    // noSpeechTimeoutMs, the mic is probably muted/wrong-device — report a
    // diagnostic error instead of wasting an ASR call on silence.
    try {
      const Ctx: typeof AudioContext | undefined =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctx) {
        const ctx = new Ctx()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        source.connect(analyser)
        audioCtxRef.current = ctx
        const buf = new Uint8Array(analyser.fftSize)
        meterTimerRef.current = setInterval(() => {
          const a = audioCtxRef.current?.state === 'closed' ? null : analyser
          if (!a) return
          a.getByteTimeDomainData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / buf.length) // 0..1
          const lvl = Math.min(100, Math.round(rms * 400))
          setLevel(lvl)
          const now = Date.now()
          if (lvl >= 6) {
            // speech/noise detected — remember the last time we "heard" them
            hasSpeechRef.current = true
            lastVoiceTsRef.current = now
          }
          const rec = recorderRef.current
          if (!rec || rec.state !== 'recording') return
          if (hasSpeechRef.current && now - lastVoiceTsRef.current >= silenceStopMs) {
            // user finished speaking → auto-submit
            try { rec.stop() } catch { /* onstop handles the rest */ }
          } else if (!hasSpeechRef.current && now - startTsRef.current >= noSpeechTimeoutMs) {
            // mic produced no meaningful signal the whole time → muted mic?
            skipTranscribeRef.current = true
            try { rec.stop() } catch { /* ignore */ }
            cleanup()
            setStatus('idle')
            onErrorRef.current(
              'Mic se awaz nahi pahunch rahi! Check karo: (1) device ka mic MUTE to nahi hai, (2) phone/laptop me sahi mic selected hai, (3) mic pe hath ya cover to nahi hai. Phir dubara try karo.',
              'no-signal'
            )
          }
        }, 100)
      }
    } catch (err) {
      // Metering is optional — recording still works without it (manual stop)
      console.warn('[VoiceRecorder] meter setup failed (voice still works, no auto-stop):', err)
    }

    // Safety: auto-stop after maxDurationMs
    maxTimerRef.current = setTimeout(() => {
      if (recorderRef.current?.state === 'recording') {
        try { recorderRef.current.stop() } catch { /* ignore */ }
      }
    }, maxDurationMs)
  }, [status, transcribe, cleanup, silenceStopMs, noSpeechTimeoutMs])

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

  return { status, isRecording: status === 'recording', isBusy: status !== 'idle' && status !== 'recording', level, start, stop, toggle }
}

export default useVoiceRecorder
