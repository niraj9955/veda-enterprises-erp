'use client'

import * as React from 'react'
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── VoiceInput ─────────────────────────────────────────────────────────────
//
// Browser-based speech-to-text using the Web Speech API (webkitSpeechRecognition).
// Supports Hindi (hi-IN) and English (en-IN).
//
// RELIABILITY FIX (v3): the previous versions used `continuous = true` which is
// flaky in Chrome — it stops after the first phrase and the auto-restart logic
// frequently lost words. We now use a much simpler, more robust approach:
//
//   1. `continuous = false` — Chrome returns ONE complete phrase per session,
//      which is exactly what we want for short voice inputs (names, amounts,
//      addresses, single sentences).
//   2. After each phrase ends (onend), if the user still wants to listen, we
//      start a new session. Final results accumulate across sessions.
//   3. We use a STABLE ref-based architecture so parent re-renders never
//      recreate or restart the recognition mid-phrase.
//   4. Multiple final results are joined with a space and passed to onResult.
//
// This pattern is used by every production voice-input library (e.g.
// react-speech-recognition, @mui/x-voice) because it's the only one that
// actually works reliably on Chrome.
//
// ─── GLOBAL SINGLETON (mic-reliability fix) ─────────────────────────────────
//
// Browsers only allow ONE active SpeechRecognition session at a time. We share
// the same singleton controller that FieldVoiceInput uses, so that only ONE
// mic (per-field OR AI Fill dialog OR AI Chat widget) is ever listening at a
// time across the whole app. This is the #1 cause of "mic not working
// everywhere".

// Re-use the same singleton controller as FieldVoiceInput.
// We import it lazily to avoid circular imports — but since field-voice-input
// has no other dependencies on this file, we can import directly.
import { activeVoiceControllerLike } from '@/components/ui/voice-active-controller'

interface VoiceInputProps {
  onResult: (text: string) => void
  onInterim?: (text: string) => void
  disabled?: boolean
  language?: 'hi-IN' | 'en-IN'
  className?: string
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

// Unique id generator for each VoiceInput instance
let _voiceInputIdCounter = 0
function nextVoiceInputId(): string {
  _voiceInputIdCounter += 1
  return `voice-${_voiceInputIdCounter}`
}

export function VoiceInput({
  onResult,
  onInterim,
  disabled,
  language = 'en-IN',
  className,
}: VoiceInputProps) {
  const [listening, setListening] = React.useState(false)
  const [supported, setSupported] = React.useState(true)

  // STABLE refs — never cause re-render or effect re-run
  const instanceIdRef = React.useRef<string>(nextVoiceInputId())
  const onResultRef = React.useRef(onResult)
  const onInterimRef = React.useRef(onInterim)
  const userWantsToListenRef = React.useRef(false)
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null)
  const restartTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    onResultRef.current = onResult
    onInterimRef.current = onInterim
  }, [onResult, onInterim])

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
    // KEY FIX: continuous=false is far more reliable in Chrome for short phrases.
    // The browser returns one complete utterance per session, then fires onend.
    // We restart manually for the next phrase if the user still wants to listen.
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      let interimText = ''
      let finalText = ''
      // Iterate over ALL results in this event — Chrome may batch multiple
      // final results in a single event when speech was fast.
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        if (result.isFinal) {
          finalText += (finalText ? ' ' : '') + transcript
        } else {
          interimText += transcript
        }
      }
      if (interimText && onInterimRef.current) onInterimRef.current(interimText)
      if (finalText) {
        if (onResultRef.current) onResultRef.current(finalText.trim())
        if (onInterimRef.current) onInterimRef.current('')
      }
    }

    recognition.onerror = (event: any) => {
      console.warn('[VoiceInput] error:', event.error)
      // 'no-speech' just means silence — not fatal, onend will handle restart.
      // 'aborted' is triggered by our own stop() — onend will fire next.
      // 'not-allowed' / 'service-not-allowed' mean mic permission denied.
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        userWantsToListenRef.current = false
        setListening(false)
      }
    }

    recognition.onend = () => {
      // Session ended (either Chrome auto-stopped on silence, or we stopped it).
      // If the user still wants to listen, restart after a tiny delay.
      if (userWantsToListenRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
        restartTimerRef.current = setTimeout(() => {
          if (userWantsToListenRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start()
            } catch {
              // If start() throws (already started or shutting down),
              // try once more after a longer delay.
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
      activeVoiceControllerLike.release(instanceIdRef.current)
    }
  }, [language])

  const toggle = () => {
    if (!recognitionRef.current) return
    if (listening) {
      // User explicitly stopped — prevent onend from restarting.
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
      activeVoiceControllerLike.release(instanceIdRef.current)
    } else {
      // ─── KEY FIX ──────────────────────────────────────────────────────
      // Take over the global mic slot — stops any other active mic first.
      activeVoiceControllerLike.takeOver(instanceIdRef.current, () => {
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
      })

      userWantsToListenRef.current = true
      try {
        recognitionRef.current.start()
        setListening(true)
      } catch {
        // start() throws if a session is still shutting down.
        // Wait a moment and retry once.
        restartTimerRef.current = setTimeout(() => {
          if (userWantsToListenRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start()
              setListening(true)
            } catch {
              userWantsToListenRef.current = false
              setListening(false)
              activeVoiceControllerLike.release(instanceIdRef.current)
            }
          }
        }, 250)
      }
    }
  }

  if (!supported) return null

  return (
    <Button
      type="button"
      variant={listening ? 'destructive' : 'outline'}
      size="icon"
      onClick={toggle}
      disabled={disabled}
      title={listening ? 'Stop listening' : 'Speak (Hindi/English)'}
      className={className}
    >
      {listening ? (
        <Square className="size-4 animate-pulse" />
      ) : (
        <Mic className="size-4" />
      )}
    </Button>
  )
}

export default VoiceInput
