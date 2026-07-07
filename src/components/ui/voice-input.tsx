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
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
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
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null)

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
      if (interimText && onInterim) onInterim(interimText)
      if (finalText) onResult(finalText)
    }

    recognition.onerror = (event: any) => {
      console.error('[VoiceInput] Speech recognition error:', event.error)
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognitionRef.current = recognition

    return () => {
      try {
        recognition.abort()
      } catch {
        // ignore
      }
    }
  }, [language, onInterim, onResult])

  const toggle = () => {
    if (!recognitionRef.current) return
    if (listening) {
      recognitionRef.current.stop()
      setListening(false)
    } else {
      try {
        recognitionRef.current.start()
        setListening(true)
      } catch (err) {
        console.error('[VoiceInput] Failed to start:', err)
        setListening(false)
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
