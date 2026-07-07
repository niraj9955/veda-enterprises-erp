'use client'

import * as React from 'react'
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── VoiceInput ─────────────────────────────────────────────────────────────
//
// Browser-based speech-to-text using the Web Speech API (webkitSpeechRecognition).
// Supports Hindi (hi-IN) and English (en-IN) — defaults to Hindi since most users
// in this ERP will speak Hinglish or Hindi.
//
// Behavior:
//   • Click the mic button → starts listening, button turns red with stop icon
//   • Click again → stops listening, final transcript is committed to onResult
//   • Live interim results stream to onInterim for real-time text display
//   • Browser not supported → button is disabled with a tooltip
//
// Key fixes vs. naive implementation:
//   1. Callback refs — useEffect doesn't re-run on every parent render, which
//      previously caused recognition to restart mid-sentence (only first word
//      came through).
//   2. Auto-restart on silent end — Chrome's Web Speech API auto-stops after
//      ~5-15 sec of silence. We track the user's intent (still listening) and
//      restart recognition automatically so the user can keep speaking.
//   3. Proper cleanup — abort on unmount, no zombie listeners.
//
// Note: Web Speech API is only available in Chrome/Edge and requires HTTPS.
// In other browsers (Firefox/Safari), the button gracefully disables and the
// user falls back to typing in the text field.

interface VoiceInputProps {
  onResult: (text: string) => void
  onInterim?: (text: string) => void
  disabled?: boolean
  language?: 'hi-IN' | 'en-IN'
  className?: string
}

// Minimal type for the webkitSpeechRecognition API — TS doesn't ship it.
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

export function VoiceInput({
  onResult,
  onInterim,
  disabled,
  language = 'hi-IN',
  className,
}: VoiceInputProps) {
  const [listening, setListening] = React.useState(false)
  const [supported, setSupported] = React.useState(true)

  // Refs to keep the latest callbacks without re-creating the recognition
  // instance on every parent re-render (which was causing only the first
  // word to come through).
  const onResultRef = React.useRef(onResult)
  const onInterimRef = React.useRef(onInterim)
  // Track the user's intent — true = user wants to keep listening, even if
  // the browser auto-stops the recognition session due to silence.
  const userWantsToListenRef = React.useRef(false)
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null)

  React.useEffect(() => {
    onResultRef.current = onResult
    onInterimRef.current = onInterim
  }, [onResult, onInterim])

  React.useEffect(() => {
    // Detect support on mount only — doesn't change during session
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
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      let interimText = ''
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalText += transcript
        } else {
          interimText += transcript
        }
      }
      if (interimText && onInterimRef.current) onInterimRef.current(interimText)
      if (finalText) {
        if (onResultRef.current) onResultRef.current(finalText)
        // Clear interim once we have a final result
        if (onInterimRef.current) onInterimRef.current('')
      }
    }

    recognition.onerror = (event: any) => {
      console.error('[VoiceInput] Speech recognition error:', event.error)
      // 'no-speech' and 'aborted' are not fatal — recognition.onend will
      // fire and our restart logic kicks in if user still wants to listen.
      // 'not-allowed' / 'service-not-allowed' mean mic permission denied —
      // in that case we should stop trying to restart.
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        userWantsToListenRef.current = false
        setListening(false)
      }
    }

    recognition.onend = () => {
      // Chrome's Web Speech API auto-stops after silence. If the user still
      // wants to listen (didn't click Stop), restart the session. This is
      // the standard workaround used by all production voice-input libraries.
      if (userWantsToListenRef.current) {
        try {
          recognition.start()
        } catch (err) {
          // start() throws if called too quickly after end — small delay
          setTimeout(() => {
            if (userWantsToListenRef.current) {
              try {
                recognition.start()
              } catch {
                userWantsToListenRef.current = false
                setListening(false)
              }
            }
          }, 100)
        }
      } else {
        setListening(false)
      }
    }

    recognitionRef.current = recognition

    return () => {
      userWantsToListenRef.current = false
      try {
        recognition.abort()
      } catch {
        // ignore
      }
    }
  }, [language])

  const toggle = () => {
    if (!recognitionRef.current) return
    if (listening) {
      // User explicitly stopped — set intent to false so onend doesn't restart
      userWantsToListenRef.current = false
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      setListening(false)
    } else {
      userWantsToListenRef.current = true
      try {
        recognitionRef.current.start()
        setListening(true)
      } catch (err) {
        console.error('[VoiceInput] Failed to start:', err)
        // If already started, try stopping first then starting
        try {
          recognitionRef.current.abort()
          setTimeout(() => {
            try {
              recognitionRef.current?.start()
              setListening(true)
            } catch {
              userWantsToListenRef.current = false
              setListening(false)
            }
          }, 200)
        } catch {
          userWantsToListenRef.current = false
          setListening(false)
        }
      }
    }
  }

  if (!supported) {
    // Don't render anything if browser doesn't support — silently hide
    return null
  }

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
