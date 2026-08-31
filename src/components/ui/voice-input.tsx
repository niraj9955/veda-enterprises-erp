'use client'

import * as React from 'react'
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { activeVoiceControllerLike } from '@/components/ui/voice-active-controller'

interface VoiceInputProps {
  onResult: (text: string) => void
  onInterim?: (text: string) => void
  onError?: (error: string) => void
  onListeningChange?: (listening: boolean) => void
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

let _voiceInputIdCounter = 0
function nextVoiceInputId(): string {
  _voiceInputIdCounter += 1
  return `voice-${_voiceInputIdCounter}`
}

export function VoiceInput({
  onResult,
  onInterim,
  onError,
  onListeningChange,
  disabled,
  language = 'en-IN',
  className,
}: VoiceInputProps) {
  const [listening, setListening] = React.useState(false)
  const [supported, setSupported] = React.useState(true)

  const instanceIdRef = React.useRef<string>(nextVoiceInputId())
  const onResultRef = React.useRef(onResult)
  const onInterimRef = React.useRef(onInterim)
  const onErrorRef = React.useRef(onError)
  const onListeningChangeRef = React.useRef(onListeningChange)
  const userWantsToListenRef = React.useRef(false)
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null)
  const restartTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const notifyListening = React.useCallback((val: boolean) => {
    setListening(val)
    onListeningChangeRef.current?.(val)
  }, [])

  React.useEffect(() => {
    onResultRef.current = onResult
    onInterimRef.current = onInterim
    onErrorRef.current = onError
    onListeningChangeRef.current = onListeningChange
  }, [onResult, onInterim, onError, onListeningChange])

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
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }
      try { recognitionRef.current?.abort() } catch { /* ignore */ }
      recognitionRef.current = null
      activeVoiceControllerLike.release(instanceIdRef.current)
    }
  }, [])

  /**
   * Create a FRESH SpeechRecognition instance each time mic is clicked.
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

    recognition.onstart = () => {
      notifyListening(true)
    }

    recognition.onresult = (event: any) => {
      let interimText = ''
      let finalText = ''
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
      const err = event.error

      if (err === 'not-allowed' || err === 'service-not-allowed') {
        userWantsToListenRef.current = false
        notifyListening(false)
        onErrorRef.current?.(
          'Mic BLOCKED hai! Chrome address bar mein 🔒 (lock) icon pe click karo → Microphone → Allow select karo → phir page refresh (F5) karo.'
        )
      } else if (err === 'audio-capture') {
        userWantsToListenRef.current = false
        notifyListening(false)
        onErrorRef.current?.('Microphone device nahi mila. Koi mic connected hai?')
      } else if (err === 'network') {
        userWantsToListenRef.current = false
        notifyListening(false)
        onErrorRef.current?.('Network error. Internet connection check karo.')
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
            } catch {
              restartTimerRef.current = setTimeout(() => {
                if (userWantsToListenRef.current && recognitionRef.current) {
                  try {
                    recognitionRef.current.start()
                  } catch {
                    userWantsToListenRef.current = false
                    notifyListening(false)
                  }
                }
              }, 300)
            }
          }
        }, 150)
      } else {
        notifyListening(false)
      }
    }

    return recognition
  }, [language, notifyListening])

  const toggle = async () => {
    if (listening) {
      // ── STOP ──
      userWantsToListenRef.current = false
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }
      try { recognitionRef.current?.stop() } catch { /* ignore */ }
      notifyListening(false)
      activeVoiceControllerLike.release(instanceIdRef.current)
      return
    }

    // ── START ──
    //
    // STEP 1: Request mic permission via getUserMedia.
    // - If state is 'prompt' → browser shows the REAL native permission popup.
    // - If state is 'granted' → resolves instantly, no popup.
    // - If state is 'denied'  → rejects with NotAllowedError → we show precise steps.
    // This is THE reliable way — the Permissions API can lie, getUserMedia never does.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Permission granted! Release the mic immediately (SpeechRecognition opens its own).
      stream.getTracks().forEach((track) => track.stop())
    } catch (err: any) {
      console.warn('[VoiceInput] getUserMedia failed:', err?.name, err?.message)
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.name === 'SecurityError') {
        onErrorRef.current?.(
          'Mic BLOCKED hai! Fix: Chrome address bar mein 🔒 icon pe click karo → "Microphone" → "Allow" select karo → phir page REFRESH (F5) karo. Ye site ki permission hai, browser ki nahi.'
        )
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        onErrorRef.current?.('Microphone device nahi mila. Mic connect hai kya?')
      } else {
        onErrorRef.current?.(`Mic error: ${err?.message || err?.name || 'Unknown'}`)
      }
      return
    }

    // STEP 2: Permission OK — register with global controller
    activeVoiceControllerLike.takeOver(instanceIdRef.current, () => {
      userWantsToListenRef.current = false
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }
      try { recognitionRef.current?.stop() } catch { /* ignore */ }
      notifyListening(false)
    })

    // STEP 3: Kill old instance, create FRESH one
    try { recognitionRef.current?.abort() } catch { /* ignore */ }
    recognitionRef.current = null

    const recognition = createRecognition()
    if (!recognition) {
      activeVoiceControllerLike.release(instanceIdRef.current)
      return
    }

    recognitionRef.current = recognition
    userWantsToListenRef.current = true

    try {
      recognition.start()
      // onstart will call notifyListening(true)
    } catch {
      restartTimerRef.current = setTimeout(() => {
        if (userWantsToListenRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start()
          } catch {
            userWantsToListenRef.current = false
            notifyListening(false)
            activeVoiceControllerLike.release(instanceIdRef.current)
            onErrorRef.current?.('Microphone start nahi ho paya. Page refresh (F5) karke dubara try karo.')
          }
        }
      }, 250)
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
      title={listening ? 'Stop listening' : `Bolo (${language === 'hi-IN' ? 'Hindi' : 'English'})`}
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
