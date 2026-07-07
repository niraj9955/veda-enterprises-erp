'use client'

import * as React from 'react'
import { Mic, Square, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── FieldVoiceInput ────────────────────────────────────────────────────────
//
// A small mic icon button designed to be placed INSIDE an input field
// (overlapping the right edge). When clicked:
//   1. Starts listening (en-IN by default — Hindi spoken → Latin script out)
//   2. Live transcript is shown as a tiny floating badge above the field
//   3. When user stops speaking, the final transcript REPLACES the field value
//      (via onChange) — direct, no preview, no chat, no AI round-trip.
//
// This is for FAST per-field voice entry: click the mic next to "Customer
// Name", say "Ramesh Kumar", and the name is filled instantly.
//
// For complex multi-field entries (e.g., "aaj 500 bricks banaye..."), use
// the AiFillButton + AiFillDialog flow instead — that one uses AI to extract
// multiple fields at once.
//
// IMPORTANT: This component uses the browser's NATIVE SpeechRecognition API
// (Chrome/Edge `webkitSpeechRecognition`). It does NOT call OpenAI/Groq, so
// it does NOT depend on the AI config (no API key needed, no need for AI to
// be "enabled" in Admin Panel). The mic should always be visible as long as
// the browser supports speech recognition. This is intentionally different
// from the AiFillButton / AiChatWidget which DO need an API key.
//
// ─── GLOBAL SINGLETON (mic-reliability fix) ─────────────────────────────────
//
// Browsers only allow ONE active SpeechRecognition session at a time. If
// two FieldVoiceInput instances (or a FieldVoiceInput + the AiChatWidget's
// VoiceInput) are running simultaneously, Chrome silently kills one of them,
// which is the #1 cause of "mic doesn't work everywhere".
//
// Solution: a single shared `ActiveVoiceController` (in voice-active-controller.ts)
// that owns the only active recognition. When a new FieldVoiceInput wants to
// listen, it asks the controller to `takeOver`. If another input was listening,
// it is told to stop first. This guarantees only one mic runs at any time
// across the whole app — including the AI chat widget and the AI fill dialog.

import { activeVoiceControllerLike as activeVoiceController, stopAllVoiceInputs as stopAllFieldVoiceInputs } from '@/components/ui/voice-active-controller'

// Re-export so existing imports keep working
export { stopAllFieldVoiceInputs }

interface FieldVoiceInputProps {
  /** Called with the final transcript when the user stops speaking. */
  onChange: (text: string) => void
  /** Optional: live interim text for preview. */
  onInterim?: (text: string) => void
  /** Optional: language — defaults to en-IN (Hindi spoken → Latin output). */
  language?: 'hi-IN' | 'en-IN'
  /** Optional: extra className for the button. */
  className?: string
  /** Optional: disabled state (e.g., when parent form is submitting). */
  disabled?: boolean
  /** Optional: label shown in the listening tooltip. */
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

// Unique id generator for each FieldVoiceInput instance
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
  const [listening, setListening] = React.useState(false)
  const [supported, setSupported] = React.useState(true)
  const [interimText, setInterimText] = React.useState('')

  // STABLE instance id — used for the global singleton registry
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

  React.useEffect(() => {
    const SpeechRecognition =
      (typeof window !== 'undefined' &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null
    if (!SpeechRecognition) {
      setSupported(false)
      return
    }

    const recognition = new SpeechRecognition() as SpeechRecognitionLike
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
        // After a final result, stop listening (single-shot per click).
        userWantsToListenRef.current = false
        try {
          recognition.stop()
        } catch {
          // ignore
        }
        setListening(false)
      }
    }

    recognition.onerror = (event: any) => {
      console.warn('[FieldVoiceInput] error:', event.error)
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        userWantsToListenRef.current = false
        setListening(false)
        setInterimText('')
      }
    }

    recognition.onend = () => {
      if (userWantsToListenRef.current) {
        // Auto-restart for silence — but for per-field use, we expect a single
        // short utterance. After 2 seconds of silence we give up.
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
        restartTimerRef.current = setTimeout(() => {
          if (userWantsToListenRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start()
            } catch {
              restartTimerRef.current = setTimeout(() => {
                if (userWantsToListenRef.current && recognitionRef.current) {
                  try {
                    recognitionRef.current.start()
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

    recognitionRef.current = recognition

    return () => {
      userWantsToListenRef.current = false
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }
      try {
        recognition.abort()
      } catch {
        // ignore
      }
      recognitionRef.current = null
      // Release the global slot if we still own it
      activeVoiceController.release(instanceIdRef.current)
    }
  }, [language])

  const toggle = () => {
    if (!recognitionRef.current) return
    if (listening) {
      userWantsToListenRef.current = false
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      setListening(false)
      setInterimText('')
      activeVoiceController.release(instanceIdRef.current)
    } else {
      // ─── KEY FIX ──────────────────────────────────────────────────────
      // Tell the global controller we want to take over. If another
      // FieldVoiceInput is listening, it will be stopped first.
      activeVoiceController.takeOver(instanceIdRef.current, () => {
        // This stop function will be invoked if another input asks to take over
        userWantsToListenRef.current = false
        if (restartTimerRef.current) {
          clearTimeout(restartTimerRef.current)
          restartTimerRef.current = null
        }
        try {
          recognitionRef.current?.stop()
        } catch {
          // ignore
        }
        setListening(false)
        setInterimText('')
      })

      userWantsToListenRef.current = true
      setInterimText('')
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
              activeVoiceController.release(instanceIdRef.current)
            }
          }
        }, 250)
      }
    }
  }

  // Hidden only if browser doesn't support SpeechRecognition.
  // NOTE: We intentionally do NOT hide this when AI is "disabled" in the
  // Admin Panel — per-field voice uses the browser's native speech API,
  // not OpenAI/Groq, so it works without any API key.
  if (!supported) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        title={
          listening
            ? `Listening to ${fieldLabel}... click to stop`
            : `Speak ${fieldLabel} (voice input)`
        }
        aria-label={listening ? `Stop listening to ${fieldLabel}` : `Speak ${fieldLabel}`}
        className={cn(
          'inline-flex items-center justify-center rounded-md p-1 transition-all',
          'text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30',
          listening && 'text-red-600 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        {listening ? (
          <Square className="size-3.5 animate-pulse" />
        ) : interimText ? (
          <Check className="size-3.5 text-emerald-600" />
        ) : (
          <Mic className="size-3.5" />
        )}
      </button>

      {/* Floating interim-text badge while listening */}
      {listening && interimText && (
        <div className="absolute bottom-full right-0 mb-1 z-20 max-w-[200px] px-2 py-1 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] shadow-lg whitespace-normal break-words pointer-events-none">
          {interimText}
          <span className="ml-1 inline-block w-1 h-1 rounded-full bg-current animate-pulse align-middle" />
        </div>
      )}
    </div>
  )
}

export default FieldVoiceInput
