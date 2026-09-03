'use client'

import * as React from 'react'
import { Mic, Square, RefreshCw, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

import { activeVoiceControllerLike as activeVoiceController, stopAllVoiceInputs as stopAllFieldVoiceInputs } from '@/components/ui/voice-active-controller'
import { useVoiceRecorder, type VoiceErrorKind } from '@/hooks/use-voice-recorder'

export { stopAllFieldVoiceInputs }

// ─── FieldVoiceInput ────────────────────────────────────────────────────────
//
// Small inline mic button for form fields. Records via MediaRecorder and
// transcribes server-side (/api/asr) — works on ALL browsers (Chrome, Safari,
// Firefox; Android + iOS + desktop). The old Web Speech API approach only
// worked in Chrome-family browsers and failed silently elsewhere.

interface FieldVoiceInputProps {
  onChange: (text: string) => void
  /** Kept for API compatibility — server ASR has no live interim; called with '' on completion. */
  onInterim?: (text: string) => void
  language?: 'hi-IN' | 'en-IN'
  className?: string
  disabled?: boolean
  fieldLabel?: string
}

let _voiceInputIdCounter = 0
function nextVoiceInputId(): string {
  _voiceInputIdCounter += 1
  return `field-voice-${_voiceInputIdCounter}`
}

export function FieldVoiceInput({
  onChange,
  onInterim,
  language = 'en-IN',
  className,
  disabled,
  fieldLabel = 'this field',
}: FieldVoiceInputProps) {
  const instanceIdRef = React.useRef<string>(nextVoiceInputId())
  const [permBlocked, setPermBlocked] = React.useState(false)
  const [justDone, setJustDone] = React.useState(false)
  const doneTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const onInterimRef = React.useRef(onInterim)
  React.useEffect(() => {
    onInterimRef.current = onInterim
  }, [onInterim])

  const handleError = React.useCallback((message: string, kind?: VoiceErrorKind) => {
    if (kind === 'permission') setPermBlocked(true)
    // Surface a short toast-style hint via console (field UI shows state visually)
    if (kind !== 'no-speech') console.warn('[FieldVoiceInput]', message)
  }, [])

  const handleResult = React.useCallback(
    (text: string) => {
      try { onInterimRef.current?.('') } catch { /* ignore */ }
      onChange(text)
      setJustDone(true)
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current)
      doneTimerRef.current = setTimeout(() => setJustDone(false), 1500)
    },
    [onChange]
  )

  const { isRecording, isBusy, level, start, stop } = useVoiceRecorder({
    onResult: handleResult,
    onError: handleError,
  })

  const stopRef = React.useRef(stop)
  React.useEffect(() => {
    stopRef.current = stop
  }, [stop])

  // Global single-listener coordination (same as chat mic)
  React.useEffect(() => {
    if (isRecording) {
      activeVoiceController.takeOver(instanceIdRef.current, () => stopRef.current())
    } else {
      activeVoiceController.release(instanceIdRef.current)
    }
    return () => {
      if (isRecording) activeVoiceController.release(instanceIdRef.current)
    }
  }, [isRecording])

  React.useEffect(() => {
    const id = instanceIdRef.current
    return () => {
      activeVoiceController.release(id)
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current)
    }
  }, [])

  const toggle = () => {
    if (disabled || isBusy) return
    if (isRecording) stop()
    else void start()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || isBusy}
        title={
          permBlocked
            ? `Mic BLOCKED — address bar mein 🔒 icon pe click karo → Microphone → Allow → page refresh (F5)`
            : isRecording
              ? `Listening to ${fieldLabel}... chup hone par apne aap fill ho jayega (click to stop)`
              : `Speak ${fieldLabel} (voice input)`
        }
        aria-label={
          permBlocked
            ? `Microphone blocked. Refresh page after allowing permission.`
            : isRecording
              ? `Stop listening to ${fieldLabel}`
              : `Speak ${fieldLabel}`
        }
        className={cn(
          'inline-flex items-center justify-center rounded-md p-1 transition-all',
          'text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30',
          isRecording && 'text-red-600 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40',
          permBlocked && 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 animate-pulse',
          (disabled || isBusy) && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        {isBusy && !isRecording ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : permBlocked ? (
          <RefreshCw className="size-3.5" />
        ) : isRecording ? (
          <Square className="size-3.5 animate-pulse" />
        ) : justDone ? (
          <Check className="size-3.5 text-emerald-600" />
        ) : (
          <Mic className="size-3.5" />
        )}
      </button>

      {/* Floating recording indicator while listening — live level bars prove
          the mic is actually hearing sound (diagnoses muted mics instantly) */}
      {isRecording && (
        <div className="absolute bottom-full right-0 mb-1 z-30 w-[210px] max-w-[calc(100vw-2rem)] px-2 py-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] shadow-lg break-words pointer-events-none overflow-hidden">
          <span className="flex items-center gap-2">
            <span className="flex items-end gap-[2px] h-3 shrink-0" aria-hidden>
              {[1, 0.7, 0.45, 0.7, 1].map((f, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-sm bg-emerald-400 transition-[height] duration-100"
                  style={{ height: `${Math.max(2, Math.min(12, level * f * 0.12))}px` }}
                />
              ))}
            </span>
            <span className="line-clamp-2">
              {level < 6 ? 'Awaz nahi aa rahi — bolo!' : `${fieldLabel} bolo... chup hone par apne aap bhar jayega`}
            </span>
          </span>
        </div>
      )}

      {/* Permission blocked tooltip */}
      {permBlocked && (
        <div className="absolute bottom-full right-0 mb-1 z-30 w-[240px] max-w-[calc(100vw-2rem)] px-2 py-1.5 rounded-md bg-orange-600 text-white text-[11px] shadow-lg pointer-events-none">
          Mic blocked! Address bar 🔒 icon → Microphone → Allow, phir <b>page refresh (F5)</b> karo
        </div>
      )}
    </div>
  )
}

export default FieldVoiceInput
