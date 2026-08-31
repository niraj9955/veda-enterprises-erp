'use client'

import * as React from 'react'
import { Mic, Square, Check, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { activeVoiceControllerLike as activeVoiceController, stopAllVoiceInputs as stopAllFieldVoiceInputs } from '@/components/ui/voice-active-controller'

// Re-export so existing imports keep working
export { stopAllFieldVoiceInputs }

// ─── FieldVoiceInput ────────────────────────────────────────────────────────
//
// A small mic icon button designed to be placed INSIDE an input field.
// When clicked: starts listening, shows live transcript, fills the field.
//
// This uses the browser's NATIVE SpeechRecognition API (Chrome/Edge).
// It does NOT call OpenAI/Groq — no API key needed.
//
// FIX (2026-08-26): Now creates a FRESH SpeechRecognition instance on every
// toggle, and checks the Permissions API before starting. This fixes the
// issue where granting mic permission in browser settings had no effect
// until page refresh — the old instance was stuck in denied state.

interface FieldVoiceInputProps {
  onChange: (text: string) => void
  onInterim?: (text: string) => void
  language?: 'hi-IN' | 'en-IN'
  className?: string
  disabled?: boolean
  fieldLabel?: string
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

let _voiceInputIdCounter = 0
function nextVoiceInputId(): string {
  _voiceInputIdCounter += 1
  return `field-voice-${_voiceInputIdCounter}`
}

async function getMicPermissionState(): Promise<string> {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as any })
    return result.state
  } catch {
    return 'unsupported'
  }
}

export function FieldVoiceInput({
  onChange,
  onInterim,
  language = 'en-IN',
  className,
  disabled,
  fieldLabel = 'this field',
}: FieldVoiceInputProps) {
  const [listening, setListening] = React.useState(false)
  const [supported, setSupported] = React.useState(true)
  const [interimText, setInterimText] = React.useState('')
  const [permBlocked, setPermBlocked] = React.useState(false)

  const instanceIdRef = React.useRef<string>(nextVoiceInputId())
  const onChangeRef = React.useRef(onChange)
  const onInterimRef = React.useRef(onInterim)
  const userWantsToListenRef = React.useRef(false)
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null)
  const restartTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    onChangeRef.current = onChange
    onInterimRef.current = onInterim
  }, [onChange, onInterim])

  // Check speech support on mount
  React.useEffect(() => {
    if (typeof window === 'undefined') { setSupported(false); return }
    const hasSupport = !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition
    setSupported(hasSupport)
  }, [])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      userWantsToListenRef.current = false
      if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null }
      try { recognitionRef.current?.abort() } catch { /* ignore */ }
      recognitionRef.current = null
      activeVoiceController.release(instanceIdRef.current)
    }
  }, [])

  /**
   * Create a FRESH SpeechRecognition instance.
   * Called every time the user clicks the mic button so that
   * permission changes (deny → allow) are picked up.
   */
  const createRecognition = React.useCallback((): SpeechRecognitionLike | null => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionCtor) return null

    const recognition = new SpeechRecognitionCtor() as SpeechRecognitionLike
    recognition.lang = language
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        if (result.isFinal) {
          final += (final ? ' ' : '') + transcript
        } else {
          interim += transcript
        }
      }
      if (interim) {
        setInterimText(interim)
        if (onInterimRef.current) onInterimRef.current(interim)
      }
      if (final) {
        const cleaned = final.trim()
        if (cleaned && onChangeRef.current) onChangeRef.current(cleaned)
        setInterimText('')
        if (onInterimRef.current) onInterimRef.current('')
        userWantsToListenRef.current = false
        try { recognition.stop() } catch { /* ignore */ }
        setListening(false)
      }
    }

    recognition.onerror = (event: any) => {
      console.warn('[FieldVoiceInput] error:', event.error)
      const err = event.error
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        userWantsToListenRef.current = false
        setListening(false)
        setInterimText('')
        setPermBlocked(true)
      } else if (err === 'audio-capture') {
        userWantsToListenRef.current = false
        setListening(false)
        setInterimText('')
      } else if (err === 'network') {
        userWantsToListenRef.current = false
        setListening(false)
        setInterimText('')
      }
      // 'no-speech' and 'aborted' are non-fatal — onend handles them
    }

    recognition.onend = () => {
      if (userWantsToListenRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
        restartTimerRef.current = setTimeout(() => {
          if (userWantsToListenRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start()
              setListening(true)
            } catch {
              restartTimerRef.current = setTimeout(() => {
                if (userWantsToListenRef.current && recognitionRef.current) {
                  try {
                    recognitionRef.current.start()
                    setListening(true)
                  } catch {
                    userWantsToListenRef.current = false
                    setListening(false)
                  }
                }
              }, 300)
            }
          }
        }, 150)
      } else {
        setListening(false)
        setInterimText('')
      }
    }

    return recognition
  }, [language])

  const toggle = async () => {
    if (!supported) return

    if (listening) {
      // ── STOP ──
      userWantsToListenRef.current = false
      if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null }
      try { recognitionRef.current?.stop() } catch { /* ignore */ }
      setListening(false)
      setInterimText('')
      activeVoiceController.release(instanceIdRef.current)
      return
    }

    // ── START ──
    setPermBlocked(false)

    // STEP 1: Request mic via getUserMedia — triggers the REAL browser prompt
    // if state is 'prompt'; gives a clear error if denied. Never lies like the
    // Permissions API can.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
    } catch (err: any) {
      console.warn('[FieldVoiceInput] getUserMedia failed:', err?.name, err?.message)
      setPermBlocked(true)
      return
    }

    // Register with global controller
    activeVoiceController.takeOver(instanceIdRef.current, () => {
      userWantsToListenRef.current = false
      if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null }
      try { recognitionRef.current?.stop() } catch { /* ignore */ }
      setListening(false)
      setInterimText('')
    })

    // Kill old instance and create FRESH one
    try { recognitionRef.current?.abort() } catch { /* ignore */ }
    recognitionRef.current = null

    const recognition = createRecognition()
    if (!recognition) {
      activeVoiceController.release(instanceIdRef.current)
      return
    }

    recognitionRef.current = recognition
    userWantsToListenRef.current = true
    setInterimText('')

    try {
      recognition.start()
      setListening(true)
    } catch {
      restartTimerRef.current = setTimeout(() => {
        if (userWantsToListenRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start()
            setListening(true)
          } catch {
            userWantsToListenRef.current = false
            setListening(false)
            activeVoiceController.release(instanceIdRef.current)
          }
        }
      }, 250)
    }
  }

  if (!supported) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        title={
          permBlocked
            ? `Mic BLOCKED — address bar mein 🔒 icon pe click karo → Microphone → Allow → page refresh (F5)`
            : listening
              ? `Listening to ${fieldLabel}... click to stop`
              : `Speak ${fieldLabel} (voice input)`
        }
        aria-label={
          permBlocked
            ? `Microphone blocked. Refresh page after allowing permission.`
            : listening
              ? `Stop listening to ${fieldLabel}`
              : `Speak ${fieldLabel}`
        }
        className={cn(
          'inline-flex items-center justify-center rounded-md p-1 transition-all',
          'text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30',
          listening && 'text-red-600 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40',
          permBlocked && 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 animate-pulse',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        {permBlocked ? (
          <RefreshCw className="size-3.5" />
        ) : listening ? (
          <Square className="size-3.5 animate-pulse" />
        ) : interimText ? (
          <Check className="size-3.5 text-emerald-600" />
        ) : (
          <Mic className="size-3.5" />
        )}
      </button>

      {/* Floating interim-text badge while listening */}
      {listening && interimText && (
        <div className="absolute bottom-full right-0 mb-1 z-30 w-[180px] max-w-[calc(100vw-2rem)] px-2 py-1 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] shadow-lg break-words pointer-events-none overflow-hidden">
          <span className="block line-clamp-3">{interimText}</span>
          <span className="ml-1 inline-block w-1 h-1 rounded-full bg-current animate-pulse align-middle" />
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
