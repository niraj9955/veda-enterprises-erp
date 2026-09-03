'use client'

import * as React from 'react'
import { Mic, Play, RefreshCw, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/**
 * MicTest (diagnostic tool)
 * =========================
 * Self-service microphone test for the login page. Answers the question
 * "voice kaam kyun nahi kar raha?" WITHOUT needing the ERP session:
 *
 *   1. Detects embedded-iframe context (browsers block mic there) up-front.
 *   2. Requests getUserMedia — classifies permission / no-device failures
 *      with exact Hinglish fix steps.
 *   3. Records 2.5s with a live level meter (bars prove sound is arriving).
 *   4. Plays the recording back — if the user HEARS their own voice, the
 *      mic + browser are 100% fine and any remaining issue is app-level
 *      (stale build → check version chip / open in a real tab).
 *
 * Deliberately does NOT call /api/asr — that endpoint requires a session,
 * and physical mic proof (playback) is the stronger diagnostic anyway.
 */

type TestState = 'idle' | 'requesting' | 'recording' | 'done' | 'error'

function classifyError(err: unknown): string {
  const e = err as { name?: string; message?: string }
  const inIframe = (() => { try { return window.self !== window.top } catch { return true } })()
  if (inIframe) {
    return 'Ye page embedded window me khula hai — browser wahan mic block kar deta hai! FIX: app ka link long-press karo → "Open in new tab" → wahan Mic Test dubara chalao. ✓'
  }
  if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
    return 'Mic device hi nahi mila! FIX: (1) Phone/laptop me mic connected hai? (2) Koi dusra app (WhatsApp call/camera) mic use kar raha hai to band karo. (3) Browser dubara kholo.'
  }
  if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError' || e?.name === 'SecurityError') {
    return 'Mic permission BLOCK hai! FIX: (1) Address bar me 🔒 lock icon tap karo → Microphone → "Allow" karo. (2) Phone Settings → Apps → Chrome → Permissions → Microphone → Allow. (3) Page refresh karo.'
  }
  return `Mic start nahi hua: ${e?.name || 'Unknown error'}. Browser update karke dubara try karo.`
}

export function MicTest() {
  const [open, setOpen] = React.useState(false)
  const [state, setState] = React.useState<TestState>('idle')
  const [level, setLevel] = React.useState(0)
  const [errorMsg, setErrorMsg] = React.useState('')
  const [audioUrl, setAudioUrl] = React.useState('')

  const streamRef = React.useRef<MediaStream | null>(null)
  const ctxRef = React.useRef<AudioContext | null>(null)
  const meterRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const urlRef = React.useRef('')

  const cleanup = React.useCallback(() => {
    if (meterRef.current) { clearInterval(meterRef.current); meterRef.current = null }
    try { recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop() } catch { /* ignore */ }
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    try { void ctxRef.current?.close() } catch { /* ignore */ }
    ctxRef.current = null
    setLevel(0)
  }, [])

  // Stop everything when dialog closes or component unmounts
  React.useEffect(() => {
    if (!open) cleanup()
  }, [open, cleanup])
  React.useEffect(() => cleanup, [cleanup])

  const runTest = async () => {
    cleanup()
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = '' }
    setAudioUrl('')
    setErrorMsg('')
    setState('requesting')

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Is browser me mic support hi nahi hai. Chrome ya Safari ka latest version use karo (ya app ko Chrome me kholo).')
      setState('error')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch (err) {
      setErrorMsg(classifyError(err))
      setState('error')
      return
    }
    streamRef.current = stream

    // Live level meter (proves sound physically arrives)
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      ctxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const buf = new Uint8Array(analyser.fftSize)
      meterRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128
          sum += v * v
        }
        setLevel(Math.min(100, Math.round(Math.sqrt(sum / buf.length) * 400)))
      }, 100)
    } catch { /* meter optional */ }

    // Record 2.5 seconds
    const chunks: Blob[] = []
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      .find((t) => { try { return MediaRecorder.isTypeSupported(t) } catch { return false } })
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    } catch {
      cleanup()
      setErrorMsg('Recording start nahi ho payi. Browser update karke dubara try karo.')
      setState('error')
      return
    }
    recorderRef.current = recorder
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      cleanup()
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
      if (blob.size < 2048) {
        setErrorMsg('Recording me awaz nahi aayi (bohot chhota file). Mic MUTE to nahi hai? Mic ke paas aake bolo aur dubara test karo.')
        setState('error')
        return
      }
      urlRef.current = URL.createObjectURL(blob)
      setAudioUrl(urlRef.current)
      setState('done')
      // Auto-play so the user instantly hears their own voice
      try {
        const audio = new Audio(urlRef.current)
        void audio.play().catch(() => { /* user taps play manually */ })
      } catch { /* ignore */ }
    }
    recorder.start()
    setState('recording')
    setTimeout(() => {
      if (recorderRef.current?.state === 'recording') {
        try { recorderRef.current?.stop() } catch { /* ignore */ }
      }
    }, 2500)
  }

  const bars = [1, 0.72, 0.5, 0.72, 1]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white/90 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
        >
          <Mic className="size-3.5" />
          Mic Test
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100vw-2rem)] rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <Mic className="size-5 text-emerald-600" /> Microphone Test
          </DialogTitle>
          <DialogDescription className="text-left">
            2.5 second record hoga — apni awaz khud sun kar confirm karo ki mic theek hai.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Live status + meter */}
          <div className="flex min-h-24 flex-col items-center justify-center gap-3 rounded-lg border bg-muted/40 p-4">
            {state === 'idle' && (
              <p className="text-sm text-muted-foreground text-center">Test shuru karne ke liye niche button dabao 👇</p>
            )}
            {state === 'requesting' && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Mic access maang rahe hain...
              </p>
            )}
            {state === 'recording' && (
              <>
                <span className="flex h-6 items-end gap-1" aria-hidden>
                  {bars.map((f, i) => (
                    <span key={i} className="w-1.5 rounded-sm bg-emerald-500 transition-[height] duration-100" style={{ height: `${Math.max(4, Math.min(24, level * f * 0.24))}px` }} />
                  ))}
                </span>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Recording... apni awaz me bolo!</p>
              </>
            )}
            {state === 'done' && (
              <>
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-5" /> Mic bilkul theek hai!
                </p>
                <audio src={audioUrl} controls className="h-9 w-full max-w-xs" />
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  Agar apni awaz sun li → mic 100% kaam kar raha hai. Ab agar app ke andar voice na chale to:
                  app ko <b>NEW TAB</b> me kholo aur niche version <b>v3.3</b> hone ka dhyan rakho.
                </p>
              </>
            )}
            {state === 'error' && (
              <p className="flex items-start gap-2 text-sm text-rose-600 dark:text-rose-400 text-left">
                <XCircle className="size-5 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </p>
            )}
          </div>

          <Button onClick={runTest} className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={state === 'requesting' || state === 'recording'}>
            {state === 'requesting' || state === 'recording' ? (
              <><Loader2 className="size-4 mr-2 animate-spin" /> Test chal raha hai...</>
            ) : (
              <><RefreshCw className="size-4 mr-2" /> {state === 'done' ? 'Dubara Test Karo' : 'Test Shuru Karo'}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default MicTest
